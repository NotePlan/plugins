// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated for v2.1.6
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID } from './constants'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import { parseSettings } from './shared'
import type {
  TActionOnReturn,
  TBridgeClickHandlerResult,
  TDashboardSettings,
  TDashboardLoggingConfig,
  TItemType,
  TNotePlanSettings,
  TParagraphForDashboard,
  TSection,
  TSectionCode,
  TSectionItem,
} from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getAPIDateStrFromDisplayDateStr, getTimeStringFromHM, getTodaysDateHyphenated, includesScheduledFutureDate } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { sendToHTMLWindow, getGlobalSharedData } from '@helpers/HTMLView'
import { filterOutParasInExcludeFolders, isNoteFromAllowedFolder, pastCalendarNotes, projectNotesFromFilteredFolders } from '@helpers/note'
import { getReferencedParagraphs } from '@helpers/NPnote'
import { isAChildPara } from '@helpers/parentsAndChildren'
// import { isTermInURL } from '@helpers/paragraph'
import { caseInsensitiveSubstringIncludes } from '@helpers/search'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import {
  getStartTimeObjFromParaContent,
  getTimeBlockString,
  isActiveOrFutureTimeBlockPara,
  // isTypeThatCanHaveATimeBlock, RE_TIMEBLOCK_IN_LINE
} from '@helpers/timeblocks'
import { isOpenChecklist, isOpen, isOpenTask, isOpenNotScheduled, removeDuplicates } from '@helpers/utils'

//-----------------------------------------------------------------
// Types
// Note: see types.js for all the main Type definitions

//-----------------------------------------------------------------
// Settings

const pluginID = pluginJson['plugin.id']

/**
 * Return an Object that includes settings:
 * - that are about what sections to display and how they should look.
 * - that control other bits of Dashboard logic.
 * Note: this does not include logSettings or copies of NP app-level settings.
 * These can potentially be changed by setSetting(s) calls.
 */
export async function getDashboardSettings(): Promise<TDashboardSettings> {
  // Note: We think following (newer API call) is unreliable.
  let pluginSettings = DataStore.settings
  if (!pluginSettings || !pluginSettings.dashboardSettings) {
    clo(
      pluginSettings,
      `getDashboardSettings (newer API): DataStore.settings?.dashboardSettings not found; should be there by default. here's the full settings for ${pluginID} plugin: `,
    )

    // Fall back to the older way:
    pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    clo(pluginSettings, `getDashboardSettings (older lookup): pluginSettings loaded from settings.json`)
  }
  if (!pluginSettings.dashboardSettings) {
    throw (
      (pluginSettings,
      `getDashboardSettings (older lookup): dashboardSettings not found this way either; should be there by default. here's the full settings for ${
        pluginSettings.pluginID || ''
      } plugin: `)
    )
  }

  return parseSettings(pluginSettings.dashboardSettings)
}

/**
 * Get config settings from original plugin preferences system -- only to do with logging now
 */
export async function getLogSettings(): Promise<TDashboardLoggingConfig> {
  // logDebug(pluginJson, `Start of getLogSettings()`)
  try {
    // Get plugin settings
    const config: TDashboardSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(`Cannot find settings for the '${pluginID}' plugin from original plugin preferences. Please make sure you have installed it from the Plugin Settings pane.`)
    }
    const logBits = Object.fromEntries(Object.entries(config).filter(([key]) => key.startsWith('_log')))
    // $FlowIgnore
    return logBits
  } catch (err) {
    logError('getLogSettings', `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return]
    return
  }
}

/**
 * Get config settings from NotePlan's app-level preferences, which we need available for when NotePlan object isn't available to React.
 */
export function getNotePlanSettings(): TNotePlanSettings {
  try {
    // Extend settings with value we might want to use when DataStore isn't available etc.
    return {
      timeblockMustContainString: String(DataStore.preference('timeblockTextMustContainString')) ?? '',
      defaultFileExtension: DataStore.defaultFileExtension,
      doneDatesAvailable: !!DataStore.preference('isAppendCompletionLinks'),
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return]
    return
  }
}

//-----------------------------------------------------------------

/**
 * Get list of section codes, that are enabled in the display settings.
 * @param {TDashboardSettings} config
 * @returns {Array<TSectionCode>}
 */
export function getListOfEnabledSections(config: TDashboardSettings): Array<TSectionCode> {
  // Work out which sections to show
  const sectionsToShow: Array<TSectionCode> = []
  if (config.showTimeBlockSection) sectionsToShow.push('TB')
  if (config.showTodaySection || config.showTodaySection === undefined) sectionsToShow.push('DT')
  if (config.showYesterdaySection) sectionsToShow.push('DY')
  if (config.showTomorrowSection) sectionsToShow.push('DO')
  if (config.showWeekSection) sectionsToShow.push('W')
  if (config.showMonthSection) sectionsToShow.push('M')
  if (config.showQuarterSection) sectionsToShow.push('Q')
  if (config.showProjectSection) sectionsToShow.push('PROJ')
  if (config.tagsToShow) sectionsToShow.push('TAG')
  if (config.showOverdueSection) sectionsToShow.push('OVERDUE')
  if (config.showPrioritySection) sectionsToShow.push('PRIORITY')
  logDebug('getListOfEnabledSections', `sectionsToShow: ${String(sectionsToShow)}`)
  return sectionsToShow
}

/**
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many).
 *
 * @param {Array<TParagraph>} origParas
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>): Array<TParagraphForDashboard> {
  try {
    const dashboardParas: Array<TParagraphForDashboard> = origParas.map((p: TParagraph) => {
      const note = p.note
      if (note) {
        const anyChildren = p.children()
        const hasChild = anyChildren.length > 0
        const isAChild = isAChildPara(p)

        // Note: debugging why sometimes hasChild is wrong
        // TODO(later): remove this debugging
        if (hasChild) {
          const pp = note.paragraphs || []
          const nextLineIndex = p.lineIndex + 1
          clo(
            p,
            `FYI 👉 makeDashboardParas: found indented children for ${p.lineIndex} "${p.content}" (indents:${p.indents}) in "${note.filename}" paras[p.lineIndex+1]= {${
              pp[nextLineIndex]?.type
            }} (${pp[nextLineIndex]?.indents || ''} indents), content: "${pp[nextLineIndex]?.content}".`,
          )
          // clo(p.contentRange, `contentRange for paragraph`)
          clof(anyChildren, `Children of paragraph`, ['lineIndex', 'indents', 'content'])
          // clo(anyChildren[0].contentRange, `contentRange for child[0]`)
        }

        const startTime = getStartTimeObjFromParaContent(p.content)
        const startTimeStr = startTime ? getTimeStringFromHM(startTime.hours, startTime.mins) : 'none'
        return {
          filename: note.filename,
          noteType: note.type,
          title: note.type === 'Notes' ? displayTitle(note) : note.title /* will be ISO-8601 date */,
          type: p.type,
          prefix: p.rawContent.replace(p.content, ''),
          content: p.content,
          rawContent: p.rawContent,
          indentLevel: p.indents, // TEST: not returning correct indents at times?
          lineIndex: p.lineIndex,
          priority: getNumericPriorityFromPara(p),
          // timeStr: startTime,
          startTime: startTimeStr,
          changedDate: note?.changedDate,
          hasChild: hasChild,
          isAChild: isAChild,
        }
      } else {
        logWarn('makeDashboardParas', `No note found for para {${p.content}}`)
        // $FlowFixMe[incompatible-call]
        return
      }
    })
    return dashboardParas
  } catch (error) {
    logError('makeDashboardParas', error.message)
    return []
  }
}

//-----------------------------------------------------------------

/**
 * Return list(s) of open task/checklist paragraphs in calendar note of type 'timePeriodName', or scheduled to that same date.
 * Various config.* items are used:
 * - excludedFolders? for folders to ignore for referenced notes
 * - separateSectionForReferencedNotes? if true, then two arrays will be returned: first from the calendar note; the second from references to that calendar note. If false, then both are included in a combined list (with the second being an empty array).
 * - ignoreItemsWithTerms  (from 2.1.0.b4 can be applied to calendar headings too)
 * - ignoreTasksScheduledToFuture
 * - excludeTasksWithTimeblocks & excludeChecklistsWithTimeblocks
 * @param {string} timePeriodName
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {TDashboardSettings} dashboardSettings
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open
 * @param {boolean} alsoReturnTimeblockLines? also include valid non-task/checklist lines that contain a timeblock
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
export function getOpenItemParasForTimePeriod(
  timePeriodName: string,
  timePeriodNote: TNote,
  dashboardSettings: TDashboardSettings,
  useEditorWherePossible: boolean = false,
  alsoReturnTimeblockLines: boolean = false,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  try {
    let parasToUse: $ReadOnlyArray<TParagraph>
    const NPSettings = getNotePlanSettings()
    const mustContainString = NPSettings.timeblockMustContainString

    //------------------------------------------------
    // Get paras from calendar note
    // Note: this takes 100-110ms for me
    const startTime = new Date() // for timing only
    if (useEditorWherePossible && Editor && Editor?.note?.filename === timePeriodNote.filename) {
      // If note of interest is open in editor, then use latest version available, as the DataStore could be stale.
      parasToUse = Editor.paragraphs
      logTimer(
        'getOpenItemPFCTP',
        startTime,
        `Using EDITOR (${Editor.filename}) for the current time period: ${timePeriodName} which has ${String(Editor.paragraphs.length)} paras`,
      )
    } else {
      // read note from DataStore in the usual way
      parasToUse = timePeriodNote.paragraphs
      logTimer('getOpenItemPFCTP', startTime, `Processing ${timePeriodNote.filename} which has ${String(timePeriodNote.paragraphs.length)} paras`)
    }

    // Note: No longer running in background thread, as I found in v1.x it more than doubled the time taken to run this section.

    // Need to filter out non-open task/checklist types for following function, and any scheduled tasks (with a >date) and any blank tasks.
    const todayHyphenated = getTodaysDateHyphenated()
    const theNoteDateHyphenated = timePeriodNote.title || ''
    const isToday = theNoteDateHyphenated === todayHyphenated
    const latestDate = todayHyphenated > theNoteDateHyphenated ? todayHyphenated : theNoteDateHyphenated
    // logDebug('getOpenItemPFCTP', `timeframe:${timePeriodName}: theNoteDateHyphenated: ${theNoteDateHyphenated}, todayHyphenated: ${todayHyphenated}, isToday: ${String(isToday)}`)
    // Keep only non-empty open tasks (and checklists if wanted),
    // and now add in other timeblock lines (if wanted), other than checklists (if excluded)
    // let openParas = dashboardSettings.ignoreChecklistItems
    //   ? parasToUse.filter((p) => isOpenTask(p) && p.content.trim() !== '')
    //   : parasToUse.filter((p) => isOpen(p) && p.content.trim() !== '')
    let openParas = alsoReturnTimeblockLines
      ? parasToUse.filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
      : parasToUse.filter((p) => isOpen(p))
    logDebug('getOpenItemPFCTP', `- after initial pull: ${openParas.length} para(s)`)
    if (dashboardSettings.ignoreChecklistItems) {
      openParas = openParas.filter((p) => !(p.type === 'checklist'))
      logDebug('getOpenItemPFCTP', `- after filtering out checklists: ${openParas.length} para(s)`)
    }
    if (dashboardSettings.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isActiveOrFutureTimeBlockPara(p, mustContainString)))
    }
    // Filter out any blank lines
    openParas = openParas.filter((p) => p.content.trim() !== '')
    // Log this
    logTimer(
      'getOpenItemPFCTP',
      startTime,
      `- after finding '${dashboardSettings.ignoreChecklistItems ? 'isOpenTaskNotScheduled' : 'isOpenNotScheduled'} ${
        alsoReturnTimeblockLines ? '+ timeblocks ' : ''
      }+ not blank' filter: ${openParas.length} paras`,
    )
    const tempSize = openParas.length

    // Keep only items not scheduled (other than >today or whatever calendar note we're on)
    const thisNoteDateSched = `>${theNoteDateHyphenated}`
    openParas = openParas.filter((p) => isOpenNotScheduled(p) || p.content.includes(thisNoteDateSched) || (isToday && p.content.includes('>today')))
    // logTimer('getOpenItemPFCTP', startTime, `- after not-scheduled-apart-from-today filter: ${openParas.length} paras`)

    // Filter out any future-scheduled tasks from this calendar note
    openParas = openParas.filter((p) => !includesScheduledFutureDate(p.content, latestDate))
    if (openParas.length !== tempSize) {
      // logDebug('getOpenItemPFCTP', `- removed ${tempSize - openParas.length} future scheduled tasks`)
    }
    logTimer('getOpenItemPFCTP', startTime, `- after 'future' filter: ${openParas.length} paras`)

    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      openParas = openParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
      logTimer('getOpenItemPFCTP', startTime, `- after 'dashboardSettings.ignoreItemsWithTerms' filter: ${openParas.length} paras`)

      // Additionally apply to calendar headings in this note
      if (dashboardSettings.applyIgnoreTermsToCalendarHeadingSections) {
        openParas = openParas.filter((p) => {
          const thisHeading = p.heading
          return !isLineDisallowedByExcludedTerms(thisHeading, dashboardSettings.ignoreItemsWithTerms)
        })
        logTimer('getOpenItemPFCTP', startTime, `- after applying this to calendar headings as well: ${openParas.length} paras`)
      }
    } else {
      // logDebug(
      //   'getOpenItemPFCTP',
      //   `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`,
      // )
    }

    // Filter out checklists with timeblocks, if wanted
    // Note: moved earlier
    // if (dashboardSettings.excludeChecklistsWithTimeblocks) {
    //   openParas = openParas.filter((p) => !(p.type === 'checklist' && isTimeBlockPara(p)))
    // }
    // logTimer('getOpenItemPFCTP', startTime, `- after 'exclude checklist timeblocks' filter: ${openParas.length} paras`)

    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const openDashboardParas = makeDashboardParas(openParas)
    // clo(openDashboardParas)

    logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(openDashboardParas.length ?? 0)} cal items for ${timePeriodName}`)

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // A task in today dated for today doesn't show here b/c it's not in backlinks
    // (In v1.x this was 2-3x quicker than part above)
    let refOpenParas: Array<TParagraph> = []
    if (timePeriodNote) {
      refOpenParas = alsoReturnTimeblockLines
        ? getReferencedParagraphs(timePeriodNote, false).filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
        : getReferencedParagraphs(timePeriodNote, false).filter((p) => isOpen(p))
      logTimer(
        'getOpenItemPFCTP',
        startTime,
        `- after initial pull of getReferencedParagraphs() ${alsoReturnTimeblockLines ? '+ timeblocks ' : ''}: ${refOpenParas.length} para(s)`,
      )
      if (dashboardSettings.ignoreChecklistItems) {
        refOpenParas = refOpenParas.filter((p) => !(p.type === 'checklist'))
        logDebug('getOpenItemPFCTP', `- after filtering out referenced checklists: ${refOpenParas.length} para(s)`)
      }
      if (dashboardSettings.excludeChecklistsWithTimeblocks) {
        refOpenParas = refOpenParas.filter((p) => !(p.type === 'checklist' && isActiveOrFutureTimeBlockPara(p, mustContainString)))
      }

      // Get list of allowed folders (using both include and exlcude settings)
      const allowedFoldersInCurrentPerspective = getCurrentlyAllowedFolders(dashboardSettings)
      // $FlowIgnore[incompatible-call]
      refOpenParas = refOpenParas.filter((p) => isNoteFromAllowedFolder(p.note, allowedFoldersInCurrentPerspective, true))
      // logTimer('getOpenItemPFCTP', startTime, `- after getting refOpenParas: ${refOpenParas.length} para(s)`)

      // Remove possible dupes from sync'd lines
      refOpenParas = eliminateDuplicateSyncedParagraphs(refOpenParas)
      // logTimer('getOpenItemPFCTP', startTime, `- after 'dedupe' filter: ${refOpenParas.length} para(s)`)

      // Filter out anything from 'ignoreItemsWithTerms' setting
      if (dashboardSettings.ignoreItemsWithTerms) {
        refOpenParas = refOpenParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
        // logTimer('getOpenItemPFCTP', startTime, `- after 'ignore' phrases filter: ${refOpenParas.length} para(s)`)
      } else {
        // logDebug('getOpenItemParasForCurrent...', `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`)
      }
    }

    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const refOpenDashboardParas = makeDashboardParas(refOpenParas)
    // clo(refOpenDashboardParas, 'getOpenItemPFCTP refOpenDashboardParas after extending paras')

    logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(refOpenParas.length ?? 0)} referenced items for ${timePeriodName}`)

    // Sort the list by priority then time block, otherwise leaving order the same
    // Then decide whether to return two separate arrays, or one combined one
    if (dashboardSettings.separateSectionForReferencedNotes) {
      // Note: sorting now happens later in useSectionSortAndFilter
      return [openDashboardParas, refOpenDashboardParas]
    } else {
      const combinedParas = openDashboardParas.concat(refOpenDashboardParas)
      // Note: sorting now happens later in useSectionSortAndFilter
      return [combinedParas, []]
    }
  } catch (err) {
    logError('getOpenItemParasForTimePeriod', err.message)
    return [[], []] // for completeness
  }
}

// ---------------------------------------------------

/**
 * Note: suggested by ChatGPT
 * Deeply compares values, potentially recursively if they are objects.
 * Logs differences with a path to the differing property.
 * TODO(@dwertheimer): this is not used. Could it be moved to a helper file?
 * @param {any} value1 The first value to compare.
 * @param {any} value2 The second value to compare.
 * @param {string} path The base path to the property being compared.
 */
export function deepCompare(value1: any, value2: any, path: string): void {
  if (isObject(value1) && isObject(value2)) {
    const keys1 = Object.keys(value1)
    const keys2 = Object.keys(value2)
    const allKeys = new Set([...keys1, ...keys2])
    allKeys.forEach((key) => {
      if (!(key in value1)) {
        logDebug(`Property ${path}.${key} is missing in the first object value`)
      } else if (!(key in value2)) {
        logDebug(`Property ${path}.${key} is missing in the second object value`)
      } else {
        deepCompare(value1[key], value2[key], `${path}.${key}`)
      }
    })
  } else if (value1 !== value2) {
    logDebug(`Value difference at ${path}: ${value1} vs ${value2}`)
  }
}

/**
 * Note: suggested by ChatGPT
 * Helper function to determine if a value is an object.
 *
 * @param {any} value The value to check.
 * @return {boolean} True if the value is an object, false otherwise.
 */
function isObject(value: any): boolean {
  return value !== null && typeof value === 'object'
}

// ---------------------------------------------------

/**
 * Get all overdue tasks, filtered and sorted according to various settings. But the number of items returned is not limited.
 * If we are showing the Yesterday section, and we have some yesterdaysParas passed, then don't return any ones matching this list.
 * @param {TDashboardSettings} dashboardSettings
 * @param {Array<TParagraph>} yesterdaysParas
 * @returns {Array<TParagraph>}
 */
export async function getRelevantOverdueTasks(dashboardSettings: TDashboardSettings, yesterdaysParas: Array<TParagraph>): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()
    const overdueParas: $ReadOnlyArray<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
    logTimer('getRelevantOverdueTasks', thisStartTime, `Found ${overdueParas.length} overdue items`)

    // Remove items referenced from items in 'excludedFolders' (but keep calendar note matches)
    const excludedFolders = dashboardSettings.excludedFolders ? stringListOrArrayToArray(dashboardSettings.excludedFolders, ',').map((folder) => folder.trim()) : []
    // $FlowIgnore(incompatible-call) returns $ReadOnlyArray type
    let filteredOverdueParas: Array<TParagraph> = filterOutParasInExcludeFolders(overdueParas, excludedFolders, true)
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after 'excludedFolders'(${String(excludedFolders)}) filter: ${filteredOverdueParas.length} paras`)
    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      filteredOverdueParas = filteredOverdueParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
    } else {
      logDebug(
        'getRelevantOverdueTasks...',
        `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`,
      )
    }
    logTimer(
      'getRelevantOverdueTasks',
      thisStartTime,
      `- after 'dashboardSettings.ignoreItemsWithTerms'(${dashboardSettings.ignoreItemsWithTerms}) filter: ${filteredOverdueParas.length} paras`,
    )

    // Limit overdues to last N days for testing purposes
    if (!Number.isNaN(dashboardSettings.lookBackDaysForOverdue) && dashboardSettings.lookBackDaysForOverdue > 0) {
      const numDaysToLookBack = dashboardSettings.lookBackDaysForOverdue
      const cutoffDate = moment().subtract(numDaysToLookBack, 'days').format('YYYYMMDD')
      logDebug('getRelevantOverdueTasks', `lookBackDaysForOverdue limiting to last ${String(numDaysToLookBack)} days (from ${cutoffDate})`)
      filteredOverdueParas = filteredOverdueParas.filter((p) => (p.filename ? p.filename > cutoffDate : true))
    }

    // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
    // Note: not fully accurate, as it doesn't check the filename is identical, but this catches sync copies, which saves a lot of time
    // Note: this is a quick operation
    // $FlowFixMe[class-object-subtyping]
    filteredOverdueParas = removeDuplicates(filteredOverdueParas, ['content'])
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping -> ${filteredOverdueParas.length}`)

    // Remove items already in Yesterday section (if turned on)
    if (dashboardSettings.showYesterdaySection) {
      if (yesterdaysParas.length > 0) {
        // Filter out all items in array filteredOverdueParas that also appear in array yesterdaysParas
        filteredOverdueParas.map((p) => {
          if (yesterdaysParas.filter((y) => y.content === p.content).length > 0) {
            logDebug('getRelevantOverdueTasks', `- removing duplicate item {${p.content}} from overdue list`)
            filteredOverdueParas.splice(filteredOverdueParas.indexOf(p), 1)
          }
        })
      }
    }

    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping with yesterday -> ${filteredOverdueParas.length}`)
    // $FlowFixMe[class-object-subtyping]
    return filteredOverdueParas
  } catch (error) {
    logError('getRelevantOverdueTasks', error.message)
    return []
  }
}

/**
 * Get all tasks marked with a priority, filtered and sorted according to various settings. But the number of items returned is not limited.
 * @param {TDashboardSettings} settings
 * @returns {Array<TParagraph>}
 */
export async function getRelevantPriorityTasks(config: TDashboardSettings): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()

    await CommandBar.onAsyncThread()
    // Get list of folders to ignore
    const excludedFolders = config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : []
    logInfo('getRelevantPriorityTasks', `excludedFolders: ${String(excludedFolders)}`)
    // Reduce list to all notes that are not blank or in @ folders or excludedFolders
    let notesToCheck = projectNotesFromFilteredFolders(excludedFolders, true).concat(pastCalendarNotes())
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Reduced to ${String(notesToCheck.length)} non-special regular notes + past calendar notes to check`)

    // Note: PDF and other non-notes are contained in the directories, and returned as 'notes' by `DataStore.projectNotes` (the call behind 'projectNotesFromFilteredFolders').
    // Some appear to have 'undefined' content length, but I had to find a different way to distinguish them.
    // Note: JGC has asked EM to not return other sorts of files
    // Note: this takes roughly 1ms per note for JGC.
    notesToCheck = notesToCheck.filter((n) => n.filename.match(/(.txt|.md)$/)).filter((n) => n.content && !isNaN(n.content.length) && n.content.length >= 1)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(notesToCheck.length)} non-blank MD notes to check`)

    // Now find all open items in them which have a priority marker
    const priorityParas = getAllOpenPriorityParas(notesToCheck)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(priorityParas.length)} priorityParas`)
    await CommandBar.onMainThread()
    // Log for testing
    // for (const p of priorityParas) {
    //   console.log(`- ${displayTitle(p.note)} : ${p.content}`)
    // }

    // Filter out anything from 'ignoreItemsWithTerms' setting
    let filteredPriorityParas = priorityParas
    if (config.ignoreItemsWithTerms) {
      // V1
      // const phrases: Array<string> = config.ignoreItemsWithTerms.split(',').map((phrase) => phrase.trim())
      // filteredPriorityParas = filteredPriorityParas.filter((p) => !phrases.some((phrase) => p.content.includes(phrase)))

      // V2
      filteredPriorityParas = filteredPriorityParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, config.ignoreItemsWithTerms))

      logDebug('getRelevantPriorityTasks', `- after 'config.ignoreItemsWithTerms'(${config.ignoreItemsWithTerms}) filter: ${filteredPriorityParas.length} paras`)
    }

    // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
    // Note: not fully accurate, as it doesn't check the filename is identical, but this catches sync copies, which saves a lot of time
    // Note: this is a quick operation
    // $FlowFixMe[class-object-subtyping]
    filteredPriorityParas = removeDuplicates(filteredPriorityParas, ['content'])
    logTimer('getRelevantPriorityTasks', thisStartTime, `- after deduping -> ${filteredPriorityParas.length}`)

    // $FlowFixMe[class-object-subtyping]
    return filteredPriorityParas
  } catch (error) {
    logError('getRelevantPriorityTasks', error.message)
    return []
  }
}

/**
 * Test to see if the current line contents is allowed in the current settings/Perspective, by whether it has a disallowed terms (word/tag/mention).
 * Note: the match is case insensitive.
 * @param {string} lineContent
 * @param {string} ignoreItemsWithTerms CSV list of terms to ignore
 * @returns {boolean} true if disallowed
 */
export function isLineDisallowedByExcludedTerms(lineContent: string, ignoreItemsWithTerms: string): boolean {
  // Note: can't use simple .split(',') as it does unexpected things with empty strings
  const ignoreTermsArr = stringListOrArrayToArray(ignoreItemsWithTerms, ',')
  // logDebug('isLineDisallowedByExcludedTerms', `using ${String(ignoreTermsArr.length)} exclusions [${ignoreTermsArr.toString()}]`)

  const matchFound = caseInsensitiveSubstringIncludes(lineContent, ignoreTermsArr)
  if (matchFound) {
    logDebug('isLineDisallowedByExcludedTerms', `- DID find excluding term(s) [${ignoreTermsArr.toString()}] in '${String(lineContent)}'`)
  }
  return matchFound
}

/**
 * Get all paras with open items with Priority > 0.
 * @param {Array<TNote>} notesToCheck
 * @returns {Array<TParagraph>}
 */
function getAllOpenPriorityParas(notesToCheck: Array<TNote>): Array<TParagraph> {
  const priorityParas: Array<TParagraph> = []
  for (const note of notesToCheck) {
    const priorityParasForNote = getOpenPriorityItems(note)
    priorityParas.push(...priorityParasForNote)
  }
  return priorityParas
}

/**
 * Get all open items with Priority > 0 from the given note.
 * @param {TNote} note
 * @returns {Array<TParagraph>}
 */
function getOpenPriorityItems(note: TNote): Array<TParagraph> {
  const priorityParas: Array<TParagraph> = []
  for (const paragraph of note.paragraphs) {
    if (isOpenNotScheduled(paragraph) && getNumericPriorityFromPara(paragraph) > 0) {
      priorityParas.push(paragraph)
    }
  }
  return priorityParas
}

/**
 * Wrap string with href onClick event to show note in editor,
 * using item.filename param.
 * @param {string} NPDateStr
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromNPDateStr(NPDateStr: string, itemID: string): string {
  try {
    const dateFilename = `${getAPIDateStrFromDisplayDateStr(NPDateStr)}.${DataStore.defaultFileExtension}`
    // logDebug('makeNoteTitleWithOpenActionFromNPDateStr', `- making notelink with ${NPDateStr} / ${dateFilename}`)
    // Pass request back to plugin, as a single object
    return `<a class="noteTitle sectionItem" {()=>onClickDashboardItem({itemID: '${itemID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(
      dateFilename,
    )}', encodedContent: ''}}><i class="fa-regular fa-file-lines pad-right"></i> ${NPDateStr}</a>`
  } catch (error) {
    logError('makeNoteTitleWithOpenActionFromNPDateStr', `${error.message} for input '${NPDateStr}'`)
    return '(error)'
  }
}

/**
 * Note: Not currently used.
 * TODO: write tests
 * Extend the paragraph objects with a .startTime property which comes from the start time of a time block, or else 'none' (which will then sort after times).
 * Copes with 'AM' and 'PM' suffixes. Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {Array<TParagraph | TParagraphForDashboard>} paras to extend
 * @returns {Array<TParagraph | TParagraphForDashboard>} paras extended by .startTime
 */
export function extendParasToAddStartTimes(paras: Array<TParagraph | TParagraphForDashboard>): Array<TParagraph | TParagraphForDashboard> {
  try {
    // logDebug('extendParaToAddStartTime', `starting with ${String(paras.length)} paras`)
    const extendedParas = []
    for (const p of paras) {
      const thisTimeStr = getTimeBlockString(p.content)
      const extendedPara = p
      if (thisTimeStr !== '') {
        let startTimeStr = thisTimeStr.split('-')[0]
        if (startTimeStr[1] === ':') {
          startTimeStr = `0${startTimeStr}`
        }
        if (startTimeStr.endsWith('AM')) {
          startTimeStr = startTimeStr.slice(0, 5)
        }
        if (startTimeStr.endsWith('PM')) {
          startTimeStr = String(Number(startTimeStr.slice(0, 2)) + 12) + startTimeStr.slice(2, 5)
        }
        // logDebug('extendParaToAddStartTime', `found timeStr: ${thisTimeStr} from timeblock ${thisTimeStr}`)
        // $FlowIgnore(prop-missing)
        extendedPara.startTime = startTimeStr
      } else {
        // $FlowIgnore(prop-missing)
        extendedPara.startTime = 'none'
      }
      extendedParas.push(extendedPara)
    }

    return extendedParas
  } catch (error) {
    logError('extendParaToAddTimeBlock', `${JSP(error)}`)
    return []
  }
}

/**
 * TODO: write some tests for AM/PM
 * Return the start time in a given paragraph.
 * This is from the start time of a time block, or else 'none' (which will then sort after times)
 * Copes with 'AM' and 'PM' suffixes.
 * Note: A version of this now lives in helpers/timeblocks.js
 * Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {TParagraph| TParagraphForDashboard} para to process
 * @returns {string} time string found
 */
export function getStartTimeFromPara(para: TParagraph | TParagraphForDashboard): string {
  try {
    // logDebug('getStartTimeFromPara', `starting with ${String(paras.length)} paras`)
    let startTimeStr = 'none'
    const thisTimeStr = getTimeBlockString(para.content)
    if (thisTimeStr !== '') {
      startTimeStr = thisTimeStr.split('-')[0]
      if (startTimeStr[1] === ':') {
        startTimeStr = `0${startTimeStr}`
      }
      if (startTimeStr.endsWith('AM')) {
        startTimeStr = startTimeStr.slice(0, 5)
      }
      if (startTimeStr.endsWith('PM')) {
        startTimeStr = String(Number(startTimeStr.slice(0, 2)) + 12) + startTimeStr.slice(2, 5)
      }
      // logDebug('getStartTimeFromPara', `timeStr = ${startTimeStr} from timeblock ${thisTimeStr}`)
    }
    return startTimeStr
  } catch (error) {
    logError('getStartTimeFromPara', `${JSP(error)}`)
    return ''
  }
}

/**
 * WARNING: DEPRECATED in favour of newer makePluginCommandButton() in HTMLView.js
 * Make HTML for a 'fake' button that is used to call (via x-callback) one of this plugin's commands.
 * Note: this is not a real button, bcause at the time I started this real <button> wouldn't work in NP HTML views, and Eduard didn't know why.
 * @param {string} buttonText to display on button
 * @param {string} pluginName of command to call
 * @param {string} commandName to call when button is 'clicked'
 * @param {string} commandArgs (may be empty)
 * @param {string?} tooltipText to hover display next to button
 * @returns {string}
 */
export function makeFakeCallbackButton(buttonText: string, pluginName: string, commandName: string, commandArgs: string, tooltipText: string = ''): string {
  const xcallbackURL = createRunPluginCallbackUrl(pluginName, commandName, commandArgs)
  const output = tooltipText
    ? `<span class="fake-button tooltip"><a class="button" href="${xcallbackURL}">${buttonText}</a><span class="tooltiptext">${tooltipText}</span></span>`
    : `<span class="fake-button"><a class="button" href="${xcallbackURL}">${buttonText}</a></span>`
  return output
}

/**************************************************************
 *  SUPPORT FUNCTIONS previously in clickHandlers.js
 ************************************************************/

/**
 * Convenience function to create the standardized handler result object
 * @param {boolean} success - whether the action was successful
 * @param {Array<TActionOnReturn>} actionsOnSuccess - actions to be taken if success was true
 * @param {any} otherSettings - an object with any other settings, e.g. updatedParagraph
 * @returns {TBridgeClickHandlerResult}
 */
export function handlerResult(success: boolean, actionsOnSuccess?: Array<TActionOnReturn> = [], otherSettings?: any = {}): TBridgeClickHandlerResult {
  return {
    ...otherSettings,
    success,
    actionsOnSuccess,
  }
}

/**
 * Convenience function to update the global shared data in the webview window, telling React to update it
 * @param {TAnyObject} changeObject - the fields inside pluginData to update
 * @param {string} changeMessage
 * @usage await setPluginData({ refreshing: false, lastFullRefresh: new Date() }, 'Finished Refreshing all sections')
 */
export async function setPluginData(changeObject: TAnyObject, changeMessage: string = ''): Promise<void> {
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  reactWindowData.pluginData = { ...reactWindowData.pluginData, ...changeObject }
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, changeMessage)
}

/**
 * Merge existing sections data with replacement data
 * If the section existed before, it will be replaced with the new data
 * If the section did not exist before, it will be added to the end of sections
 * @param {Array<TSection>} existingSections
 * @param {Array<TSection>} newSections
 * @returns {Array<TSection>} - merged sections
 */
export function mergeSections(existingSections: Array<TSection>, newSections: Array<TSection>): Array<TSection> {
  newSections.forEach((newSection) => {
    const existingIndex = existingSections.findIndex((existingSection) => existingSection.ID === newSection.ID)
    if (existingIndex > -1) {
      existingSections[existingIndex] = newSection
    } else {
      existingSections.push(newSection)
    }
  })
  return existingSections
}

/**
 * Helper function to create a sectionItem object from its constituent parts.
 *
 * @param {string} id - The ID of the sectionItem.
 * @param {TParagraph} p - The paragraph data for the sectionItem.
 * @param {string} theType - The type of the sectionItem (if left blank, will use the para's type)
 * @returns {SectionItem} A sectionItem object.
 */
export function createSectionItemObject(id: string, p: TParagraph | TParagraphForDashboard | null = null, theType?: TItemType): TSectionItem {
  // $FlowIgnore - we are not using all the types in TParagraph
  return { ID: id, itemType: theType ?? p.type, para: p }
}

/**
 * Make a sectionItem for each open item (para) of interest.
 * Note: sometimes non-open items are included, e.g. other types of timeblocks. They need to be filtered out first.
 * @param {Array<TParagraphForDashboard>} sortedOrCombinedParas
 * @param {string} sectionNumStr
 * @returns {Array<TSectionItem>}
 */
export function createSectionOpenItemsFromParas(sortedOrCombinedParas: Array<TParagraphForDashboard>, sectionNumStr: string): Array<TSectionItem> {
  let itemCounter = 0
  let lastIndent0ParentID = ''
  let lastIndent1ParentID = ''
  let lastIndent2ParentID = ''
  let lastIndent3ParentID = ''
  const items: Array<TSectionItem> = []
  for (const socp of sortedOrCombinedParas) {
    if (!isOpen(socp)) {
      continue
    }
    const thisID = `${sectionNumStr}-${itemCounter}`
    const thisSectionItemObject = createSectionItemObject(thisID, socp)
    // Now add parentID where relevant
    if (socp.isAChild) {
      const parentParaID =
        socp.indentLevel === 1
          ? lastIndent0ParentID
          : socp.indentLevel === 2
          ? lastIndent1ParentID
          : socp.indentLevel === 3
          ? lastIndent2ParentID
          : socp.indentLevel === 4
          ? lastIndent3ParentID
          : '' // getting silly by this point, so stop
      thisSectionItemObject.parentID = parentParaID
      // logDebug(``, `- found parentID ${parentParaID} for ID ${thisID}`)
    }
    if (socp.hasChild) {
      switch (socp.indentLevel) {
        case 0: {
          lastIndent0ParentID = thisID
          break
        }
        case 1: {
          lastIndent1ParentID = thisID
          break
        }
        case 2: {
          lastIndent2ParentID = thisID
          break
        }
        case 3: {
          lastIndent3ParentID = thisID
          break
        }
      }
    }
    items.push(thisSectionItemObject)
    itemCounter++
  }
  return items
}

export function getDisplayListOfSectionCodes(sections: Array<TSection>): string {
  const outputList = []
  sections.forEach((s) => {
    if (s.sectionCode === 'TAG') {
      outputList.push(`${s.sectionCode}(${s.name})`)
    } else {
      outputList.push(s.sectionCode)
    }
  })
  return outputList.join(',')
}
