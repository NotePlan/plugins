// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 2024-08-09 for v2.1.0.a5 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { WEBVIEW_WINDOW_ID } from './constants'
import {
  isFilenameAllowedInFolderList
, getCurrentlyAllowedFolders } from './perspectivesShared'
import { parseSettings } from './shared'
import type { TActionOnReturn, TBridgeClickHandlerResult, TDashboardSettings, TDashboardLoggingConfig, TItemType, TNotePlanSettings, TParagraphForDashboard, TSection } from './types'
import { getParaAndAllChildren } from '@helpers/blocks'
import {
  getAPIDateStrFromDisplayDateStr,
  getTodaysDateHyphenated,
  includesScheduledFutureDate,
  removeDateTagsAndToday,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import {
  sendToHTMLWindow,
  getGlobalSharedData,
} from '@helpers/HTMLView'
import { filterOutParasInExcludeFolders, getNoteByFilename, pastCalendarNotes, projectNotesFromFilteredFolders } from '@helpers/note'
import { getSettingFromAnotherPlugin } from '@helpers/NPConfiguration'
import { getReferencedParagraphs } from '@helpers/NPnote'
import {
  findEndOfActivePartOfNote,
  findHeadingStartsWith,
  findStartOfActivePartOfNote,
  isTermInURL,
  parasToText,
  smartPrependPara,
} from '@helpers/paragraph'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { getNumericPriorityFromPara, sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import {
  getTimeBlockString,
  isTypeThatCanHaveATimeBlock,
  RE_TIMEBLOCK_APP,
} from '@helpers/timeblocks'
import {
  chooseHeading, chooseNote, displayTitleWithRelDate,
} from '@helpers/userInput'
import {
  isOpen, isOpenTask, isOpenNotScheduled,
  removeDuplicates
} from '@helpers/utils'

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
    clo(pluginSettings, `getDashboardSettings (newer API): DataStore.settings?.dashboardSettings not found; should be there by default. here's the full settings for ${pluginID} plugin: `)

    // Fall back to the older way:
    pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    clo(pluginSettings, `getDashboardSettings (older lookup): pluginSettings loaded from settings.json`)

  }
  if (!pluginSettings.dashboardSettings) {
    if (pluginSettings.sharedSettings) {
      logDebug('getDashboardSettings', `no dashboardSettings found in pluginSettings, so using sharedSettings instead.`)
      pluginSettings.dashboardSettings = pluginSettings.sharedSettings
      delete pluginSettings.sharedSettings
      logDebug('getDashboardSettings', `now deleted sharedSettings.`)
      DataStore.settings = pluginSettings
    } else {
      throw (pluginSettings, `getDashboardSettings (older lookup): dashboardSettings not found this way either; should be there by default. here's the full settings for ${pluginSettings.pluginID || ''} plugin: `)
    }
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
      throw new Error(`Cannot find settings for the '${pluginID}' plugin from original plugin preferences. Please make sure you have installed it from the Plugin Preferences pane.`)
    }
    const logBits = Object.fromEntries(Object.entries(config).filter(([key]) => key.startsWith('_log')))
    // $FlowIgnore
    return logBits

  } catch (err) {
    logError('getLogSettings', `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return] reason for suppression
    return
  }
}

/**
 * Get config settings from NotePlan's app-level preferences, which we need available for when NotePlan object isn't available to React.
 */
export function getNotePlanSettings(): TNotePlanSettings {
  try {
    logDebug(pluginJson, `Start of getNotePlanSettings()`)
    // Extend settings with value we might want to use when DataStore isn't available etc.
    return {
      timeblockMustContainString: String(DataStore.preference('timeblockTextMustContainString')) ?? '',
      defaultFileExtension: DataStore.defaultFileExtension,
      doneDatesAvailable: !!DataStore.preference('isAppendCompletionLinks')
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return] reason for suppression
    return
  }
}

//-----------------------------------------------------------------

/**
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many)
 * @param {Array<TParagraph>} origParas
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>): Array<TParagraphForDashboard> {
  try {
    const dashboardParas: Array<TParagraphForDashboard> = origParas.map((p) => {
      const note = p.note
      if (!note) throw new Error(`No note found for para {${p.content}}`)
      // Note: Demo data gives .children not function returning children
      // So test to see if children() function is present, before trying to use it
      // $FlowFixMe[method-unbinding]
      const anyChildren = (p.children && typeof p.children === 'function')
        ? p.children()
        : p.children
      const hasChild = anyChildren.length > 0

      // TODO(add back in later): debugging why sometimes hasChild is wrong
      // if (hasChild) {
      //   const pp = note.paragraphs || []
      //   const nextLineIndex = p.lineIndex + 1
      //   clo(p, `FYI: makeDashboardParas: found indented children for ${p.lineIndex} "${p.content}" (indents:${p.indents}) in "${note.filename}" paras[p.lineIndex+1]= {${pp[nextLineIndex]?.type}} (${pp[nextLineIndex]?.indents || ''} indents), content: "${pp[nextLineIndex]?.content}".`)
      //   clo(p.contentRange, `contentRange for paragraph`)
      //   clo(anyChildren, `Children of paragraph`)
      //   clo(anyChildren[0].contentRange, `contentRange for child[0]`)
      // }

      return {
        filename: note.filename,
        noteType: note.type,
        title: (note.type === 'Notes') ? displayTitle(note) : note.title /* will be ISO-8601 date */,
        type: p.type,
        prefix: p.rawContent.replace(p.content, ''),
        content: p.content,
        rawContent: p.rawContent,
        priority: getNumericPriorityFromPara(p),
        timeStr: getStartTimeFromPara(p), // TODO: does this do anything now?
        startTime: getStartTimeFromPara(p),
        changedDate: note?.changedDate,
        hasChild
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
 * - ignoreItemsWithTerms
 * - ignoreTasksScheduledToFuture
 * - excludeTasksWithTimeblocks & excludeChecklistsWithTimeblocks
 * @param {string} timePeriodName
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {TDashboardSettings} dashboardSettings
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
export function getOpenItemParasForCurrentTimePeriod(
  timePeriodName: string,
  timePeriodNote: TNote,
  dashboardSettings: TDashboardSettings,
  useEditorWherePossible: boolean = false,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  try {
    let parasToUse: $ReadOnlyArray<TParagraph>

    //------------------------------------------------
    // Get paras from calendar note
    // Note: this takes 100-110ms for me
    const startTime = new Date() // for timing only
    if (useEditorWherePossible && Editor && Editor?.note?.filename === timePeriodNote.filename) {
      // If note of interest is open in editor, then use latest version available, as the DataStore could be stale.
      parasToUse = Editor.paragraphs
      logTimer('getOpenItemPFCTP', startTime, `Using EDITOR (${Editor.filename}) for the current time period: ${timePeriodName} which has ${String(Editor.paragraphs.length)} paras`)
    } else {
      // read note from DataStore in the usual way
      parasToUse = timePeriodNote.paragraphs
      logTimer('getOpenItemPFCTP', startTime, `Processing ${timePeriodNote.filename} which has ${String(timePeriodNote.paragraphs.length)} paras`)
    }

    // Run following in background thread
    // NB: Has to wait until after Editor has been accessed to start this
    // Note: Commented out in v1.x, as I found it more than doubled the time taken to run this section.
    // await CommandBar.onAsyncThread()

    // Need to filter out non-open task types for following function, and any scheduled tasks (with a >date) and any blank tasks.
    // Now also allow to ignore checklist items.
    const todayHyphenated = getTodaysDateHyphenated()
    const theNoteDateHyphenated = timePeriodNote.title || ''
    const isToday = theNoteDateHyphenated === todayHyphenated
    const latestDate = todayHyphenated > theNoteDateHyphenated ? todayHyphenated : theNoteDateHyphenated
    // logDebug('getOpenItemPFCTP', `timeframe:${timePeriodName}: theNoteDateHyphenated: ${theNoteDateHyphenated}, todayHyphenated: ${todayHyphenated}, isToday: ${String(isToday)}`)
    // Keep only non-empty open tasks (and checklists if wanted)
    let openParas = dashboardSettings.ignoreChecklistItems
      ? parasToUse.filter((p) => isOpenTask(p) && p.content.trim() !== '')
      : parasToUse.filter((p) => isOpen(p) && p.content.trim() !== '')
    // logTimer('getstartTime, OpenItemPFCTP', `- after '${dashboardSettings.ignoreChecklistItems ? 'isOpenTaskNotScheduled' : 'isOpenNotScheduled'} + not blank' filter: ${openParas.length} paras`)
    const tempSize = openParas.length

    // Keep only non-empty open tasks not scheduled (other than >today)
    const thisNoteDateSched = `>${theNoteDateHyphenated}`
    openParas = openParas.filter((p) =>
      isOpenNotScheduled(p) ||
      (p.content.includes(thisNoteDateSched) ||
        (isToday && p.content.includes('>today'))))
    // logTimer('getstartTime, OpenItemPFCTP', `- after not-scheduled-apart-from-today filter: ${openParas.length} paras`)

    // Filter out any future-scheduled tasks from this calendar note
    openParas = openParas.filter((p) => !includesScheduledFutureDate(p.content, latestDate))

    if (openParas.length !== tempSize) {
      // logDebug('getOpenItemPFCTP', `- removed ${tempSize - openParas.length} future scheduled tasks`)
    }
    // logTimer('getstartTime, OpenItemPFCTP', `- after 'future' filter: ${openParas.length} paras`)

    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      const phrases: Array<string> = dashboardSettings.ignoreItemsWithTerms.split(',').map(phrase => phrase.trim())
      openParas = openParas.filter((p) => !phrases.some(phrase => p.content.includes(phrase)))
    } else {
      // logDebug('getOpenItemParasForCurrent...', `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`)
    }
    // logTimer('getstartTime, OpenItemPFCTP', `- after 'dashboardSettings.ignoreItemsWithTerms' filter: ${openParas.length} paras`)

    // Filter out checklists with timeblocks, if wanted
    if (dashboardSettings.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isTimeBlockPara(p)))
    }
    // logTimer('getstartTime, OpenItemPFCTP', `- after 'exclude checklist timeblocks' filter: ${openParas.length} paras`)

    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const openDashboardParas = makeDashboardParas(openParas)
    // clo(openDashboardParas)

    logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(openParas.length ?? 0)} cal items for ${timePeriodName}`)

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // A task in today dated for today doesn't show here b/c it's not in backlinks
    // (In v1.x this was 2-3x quicker than part above)
    let refOpenParas: Array<TParagraph> = []
    if (timePeriodNote) {
      // Allow to ignore checklist items.
      refOpenParas = dashboardSettings.ignoreChecklistItems
        ? getReferencedParagraphs(timePeriodNote, false).filter(isOpenTask)
        : getReferencedParagraphs(timePeriodNote, false).filter(isOpen)
    }

    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      const phrases: Array<string> = dashboardSettings.ignoreItemsWithTerms.split(',').map(phrase => phrase.trim())
      refOpenParas = refOpenParas.filter((p) => !phrases.some(phrase => p.content.includes(phrase)))
      logTimer('getOpenItemPFCTP', startTime, `- after 'ignore' phrases filter: ${refOpenParas.length} paras`)
    } else {
      // logDebug('getOpenItemParasForCurrent...', `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`)
    }

    // If we are using a Perspective, get list of suitable folders
    // FIXME: @jgclark: I don't understand why this is here. If someone selects a perspective it overwrites
    // the settings with the perspective values. Why would we need to do this?
    // @dbw commenting it out for now
    // if (dashboardSettings.FFlag_Perspectives && dashboardSettings.activePerspectiveName) {
    //   const allowedFoldersInCurrentPerspective = getCurrentlyAllowedFolders(dashboardSettings)
    //   refOpenParas = refOpenParas.filter((p) => isFilenameAllowedInFolderList(p.note?.filename ?? '', allowedFoldersInCurrentPerspective))
    //   logTimer('getOpenItemPFCTP', startTime, `- after Perspective '${dashboardSettings.activePerspectiveName}' folder filters: ${refOpenParas.length} paras`)
    // }

    // // Remove items referenced from items in 'excludedFolders'
    const excludedFolders = dashboardSettings.excludedFolders ? dashboardSettings.excludedFolders.split(',').map(folder => folder.trim()) : []
    refOpenParas = excludedFolders.length ? filterOutParasInExcludeFolders(refOpenParas, excludedFolders, true) : refOpenParas
    logTimer('getOpenItemPFCTP', startTime, `- after 'ignore' filter: ${refOpenParas.length} paras`)

    // Remove possible dupes from sync'd lines
    refOpenParas = eliminateDuplicateSyncedParagraphs(refOpenParas)
    // logTimer('getOpenItemPFCTP', startTime, `- after 'dedupe' filter: ${refOpenParas.length} paras`)

    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const refOpenDashboardParas = makeDashboardParas(refOpenParas)
    // clo(refOpenDashboardParas)

    logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(refOpenParas.length ?? 0)} referenced items for ${timePeriodName}`)

    // Sort the list by priority then time block, otherwise leaving order the same
    // Then decide whether to return two separate arrays, or one combined one
    if (dashboardSettings.separateSectionForReferencedNotes) {
      const sortedOpenParas = sortListBy(openDashboardParas, ['-priority', 'timeStr'])
      const sortedRefOpenParas = sortListBy(refOpenDashboardParas, ['-priority', 'timeStr'])
      // come back to main thread
      // await CommandBar.onMainThread()
      // logDebug('getOpenItemPFCTP', `- sorted after ${timer(startTime)}`)
      return [sortedOpenParas, sortedRefOpenParas]
    } else {
      const combinedParas = openDashboardParas.concat(refOpenDashboardParas)
      const combinedSortedParas = sortListBy(combinedParas, ['-priority', 'timeStr'])
      // logDebug('getOpenItemPFCTP', `- sorted after ${timer(startTime)}`)
      // come back to main thread
      // await CommandBar.onMainThread()
      return [combinedSortedParas, []]
    }
  } catch (err) {
    logError('getOpenItemParasForCurrentTimePeriod', err.message)
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
    allKeys.forEach(key => {
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
 * Decide whether this line contains an active time block.
 * Note: This is a local variant of what is in timeblocks.js, that works without referring to DataStore.
 * @author @dwertheimer
 * @param {string} contentString
 * @returns {boolean}
 */
function isTimeBlockLine(contentString: string, mustContainString: string = ''): boolean {
  try {
    // Following works around a bug when the preference isn't being set at all at the start.
    if (mustContainString !== '') {
      const res1 = contentString.includes(mustContainString)
      if (!res1) {
        return false
      }
    }
    const res2 = contentString.match(RE_TIMEBLOCK_APP) ?? []
    return res2.length > 0
  } catch (err) {
    console.log(err)
    return false
  }
}

/**
 * Decide whether this paragraph contains an active time block.
 * Also now defeats on timeblock in middle of a [...](filename) or URL
 * Note: This is a local variant of what is in timeblocks.js, that works without referring to DataStore.
 * @author @jgclark
 * @param {TParagraph} para
 * @param {string} mustContainParaArg (optional)
 * @returns {boolean}
 */
function isTimeBlockPara(para: TParagraph, mustContainStringArg: string = ''): boolean {
  if (!isTypeThatCanHaveATimeBlock(para) || !isTimeBlockLine(para.content, mustContainStringArg)) {
    return false
  }
  const tbString = getTimeBlockString(para.content)
  return !isTermInURL(tbString, para.content)
}

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
    const excludedFolders = dashboardSettings.excludedFolders ? dashboardSettings.excludedFolders.split(',').map(folder => folder.trim()) : []
    // $FlowIgnore(incompatible-call) returns $ReadOnlyArray type
    let filteredOverdueParas: Array<TParagraph> = filterOutParasInExcludeFolders(overdueParas, excludedFolders, true)
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after 'excludedFolders'(${dashboardSettings.excludedFolders.toString()}) filter: ${filteredOverdueParas.length} paras`)
    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      const phrases: Array<string> = dashboardSettings.ignoreItemsWithTerms.split(',').map(phrase => phrase.trim())
      filteredOverdueParas = filteredOverdueParas.filter((p) => !phrases.some(phrase => p.content.includes(phrase)))
    } else {
      logDebug('getRelevantOverdueTasks...', `dashboardSettings.ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`)
    }
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after 'dashboardSettings.ignoreItemsWithTerms'(${dashboardSettings.ignoreItemsWithTerms}) filter: ${filteredOverdueParas.length} paras`)

    // Limit overdues to last N days for testing purposes
    if (!Number.isNaN(dashboardSettings.lookBackDaysForOverdue) && dashboardSettings.lookBackDaysForOverdue > 0) {
      const numDaysToLookBack = dashboardSettings.lookBackDaysForOverdue
      const cutoffDate = moment().subtract(numDaysToLookBack, 'days').format('YYYYMMDD')
      logDebug('getRelevantOverdueTasks', `lookBackDaysForOverdue limiting to last ${String(numDaysToLookBack)} days (from ${cutoffDate})`)
      filteredOverdueParas = filteredOverdueParas.filter((p) => p.filename ? p.filename > cutoffDate : true)
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
export async function getRelevantPriorityTasks(
  config: TDashboardSettings,
): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()

    await CommandBar.onAsyncThread()
    // Get list of folders to ignore
    const excludedFolders = config.excludedFolders ? config.excludedFolders.split(',').map(folder => folder.trim()) : []
    logInfo('getRelevantPriorityTasks', `excludedFolders: ${excludedFolders.toString()}`)
    // Reduce list to all notes that are not blank or in @ folders or excludedFolders
    let notesToCheck = projectNotesFromFilteredFolders(excludedFolders, true).concat(pastCalendarNotes())
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Reduced to ${String(notesToCheck.length)} non-special regular notes + past calendar notes to check`)
    // Note: PDF and other non-notes are contained in the directories, and returned as 'notes' by allNotesSortedByChanged(). Some appear to have 'undefined' content length, but I had to find a different way to distinguish them.
    notesToCheck = notesToCheck
      .filter((n) => n.filename.match(/(.txt|.md)$/))
      .filter((n) => n.content && n.content.length !== 'undefined' && n.content.length >= 1)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(notesToCheck.length)} non-blank MD notes to check`)

    // Now find all open items in them which have a priority marker
    const priorityParas = getAllOpenPriorityItems(notesToCheck)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(priorityParas.length)} priorityParas`)
    await CommandBar.onMainThread()
    // Log for testing
    // for (const p of priorityParas) {
    //   console.log(`- ${displayTitle(p.note)} : ${p.content}`)
    // }

    // Filter out anything from 'ignoreItemsWithTerms' setting
    let filteredPriorityParas = priorityParas
    if (config.ignoreItemsWithTerms) {
      const phrases: Array<string> = config.ignoreItemsWithTerms.split(',').map(phrase => phrase.trim())
      filteredPriorityParas = filteredPriorityParas.filter((p) => !phrases.some(phrase => p.content.includes(phrase)))
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
 * ???
 * @param {Array<TNote>} notesToCheck 
 * @returns {Array<TParagraph>}
 */
function getAllOpenPriorityItems(notesToCheck: Array<TNote>): Array<TParagraph> {
  const priorityParas: Array<TParagraph> = []
  for (const note of notesToCheck) {
    const priorityParasForNote = getOpenPriorityItems(note)
    priorityParas.push(...priorityParasForNote)
  }
  return priorityParas
}

/**
 * ???
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
 * TODO: write some tests
 * Extend the paragraph objects with a .timeStr property which comes from the start time of a time block, or else 'none' (which will then sort after times).
 * Copes with 'AM' and 'PM' suffixes. Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {Array<TParagraph | TParagraphForDashboard>} paras to extend
 * @returns {Array<TParagraph | TParagraphForDashboard>} paras extended by .timeStr
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
        logDebug('extendParaToAddStartTime', `found timeStr: ${thisTimeStr} from timeblock ${thisTimeStr}`)
        // $FlowIgnore(prop-missing)
        extendedPara.timeStr = startTimeStr
      } else {
        // $FlowIgnore(prop-missing)
        extendedPara.timeStr = 'none'
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
 * Copes with 'AM' and 'PM' suffixes. Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
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

/**
 * Move a task or checklist from one calendar note to another.
 * It's designed to be used when the para itself is not available; the para will try to be identified from its filename and content, and it will throw an error if it fails.
 * It also moves indented child paragraphs of any type.
 * If 'headingToPlaceUnder' is provided, para is added after it (with heading being created at effective top of note if necessary).
 * If 'headingToPlaceUnder' the para will be *prepended* to the effective top of the destination note.
 * @author @jgclark
 * @param {string} NPFromDateStr from date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} NPToDateStr to date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} paraContent content of the para to move.
 * @param {string?} headingToPlaceUnder which will be created if necessary
 * @returns {TNote | false} if succesful pass the new note, otherwise false
 */
export async function moveItemBetweenCalendarNotes(NPFromDateStr: string, NPToDateStr: string, paraContent: string, headingToPlaceUnder: string = ''): Promise<TNote | false> {
  logDebug(pluginJson, `starting moveItemBetweenCalendarNotes for ${NPFromDateStr} to ${NPToDateStr} under heading '${headingToPlaceUnder}'`)
  try {
    const config = await getDashboardSettings()
    // Get calendar note to use
    const fromNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPFromDateStr))
    const toNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPToDateStr))
    // Don't proceed unless we have valid from/to notes
    if (!fromNote || !toNote) {
      logError('moveItemBetweenCalendarNotes', `- Can't get calendar note for ${NPFromDateStr} and/or ${NPToDateStr}`)
      return false
    }

    // find para in the fromNote
    const matchedPara: TParagraph | boolean = findParaFromStringAndFilename(fromNote.filename, paraContent)
    if (typeof matchedPara === 'boolean') {
      throw new Error('moveItemBetweenCalendarNotes: no para found')
    }
    // Remove any scheduled date on the parent para
    const updatedMatchedPara = removeDateTagsAndToday(paraContent, true)
    matchedPara.content = updatedMatchedPara
    fromNote.updateParagraph(matchedPara)

    // const itemType = matchedPara?.type
    const matchedParaAndChildren = getParaAndAllChildren(matchedPara)
    const targetContent = parasToText(matchedParaAndChildren)

    // add to toNote
    if (headingToPlaceUnder === '') {
      logDebug('moveItemBetweenCalendarNotes', `- Calling smartPrependPara() for '${String(matchedParaAndChildren.length)}' to '${displayTitle(toNote)}'`)
      smartPrependPara(toNote, targetContent, 'text')
    } else {
      logDebug('moveItemBetweenCalendarNotes', `- Adding ${matchedParaAndChildren.length} lines under heading '${headingToPlaceUnder}' in '${displayTitle(toNote)}'`)
      // Note: this doesn't allow setting heading level ...
      // toNote.addParagraphBelowHeadingTitle(paraContent, itemType, headingToPlaceUnder, false, true)
      // so replace with one half of /qath:
      const shouldAppend = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'shouldAppend', false)
      const matchedHeading = findHeadingStartsWith(toNote, headingToPlaceUnder)
      logDebug('moveItemBetweenCalendarNotes',
        `Adding line "${targetContent}" to '${displayTitleWithRelDate(toNote)}' below matchedHeading '${matchedHeading}' (heading was '${headingToPlaceUnder}')`,
      )
      if (matchedHeading !== '') {
        // Heading does exist in note already
        toNote.addParagraphBelowHeadingTitle(
          targetContent,
          'text',
          matchedHeading !== '' ? matchedHeading : headingToPlaceUnder,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        const headingLevel = config.newTaskSectionHeadingLevel
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${headingToPlaceUnder}`
        const insertionIndex = shouldAppend ? findEndOfActivePartOfNote(toNote) + 1 : findStartOfActivePartOfNote(toNote)

        logDebug('moveItemBetweenCalendarNotes', `- adding new heading '${headingToUse}' at line index ${insertionIndex} ${shouldAppend ? 'at end' : 'at start'}`)
        toNote.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('moveItemBetweenCalendarNotes', `- then adding text after it`)
        toNote.insertParagraph(targetContent, insertionIndex + 1, 'text')
      }
    }

    // Assuming that's not thrown an error, now remove from fromNote
    logDebug('moveItemBetweenCalendarNotes', `- Removing line(s) from '${displayTitle(fromNote)}'`)
    fromNote.removeParagraphs(matchedParaAndChildren)

    // Ask for cache refresh for these notes
    DataStore.updateCache(fromNote, false)
    DataStore.updateCache(toNote, false)

    return toNote
  } catch (err) {
    logError('moveItemBetweenCalendarNotes', `${err.name}: ${err.message} moving {${paraContent}} from ${NPFromDateStr} to ${NPToDateStr}`)
    return false
  }
}

/**
 * Note: has to be on the Plugin side, as it makes calls to the NP API.
 * @param {string} filename line is currently in
 * @param {string} content of line
 * @param {TItemType} itemType of line
 * @returns {TNote} returns new note the line was moved to
 */
export async function moveItemToRegularNote(filename: string, content: string, itemType: TItemType): Promise<TNote | null> {
  try {
    // const { filename, content } = validateAndFlattenMessageObject(data)
    logDebug('moveItemToRegularNote', `Starting with {${content}} in ${filename}`)

    // find para in the given filename
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('moveItemToRegularNote: no para found')
    }

    // const itemType = data.itemType
    logDebug('moveItemToRegularNote', `- itemType: ${itemType}`)

    // Ask user for destination project note
    const typeToDisplayToUser = itemType === 'checklist' ? 'Checklist' : 'Task'
    const destNote = await chooseNote(true, false, [], `Choose Note to Move ${typeToDisplayToUser} to`, false, true)
    logDebug('moveItemToRegularNote', `- Moving to note '${displayTitle(destNote)}'`)
    if (!destNote) return null

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeading(destNote, true, true, false)
    logDebug('moveItemToRegularNote', `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // Add text to the new location in destination note
    // Use 'headingLevel' ("Heading level for new Headings") from the setting in QuickCapture if present (or default to 2)
    const newHeadingLevel = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'headingLevel', 2)

    logDebug('moveItemToRegularNote', `- newHeadingLevel: ${newHeadingLevel}`)
    if (itemType === 'open') { // there is no "task" in itemType
      // FIXME: @jgclark: We had the exact note (destNote), but now we are going to try to find it again by title?
      // this is not great because we could have multiple notes with the same title
      // ok for now, but this helper should be able to accept a specific filename
      await addTaskToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
    } else {
      await addChecklistToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
    }

    // Trying to get the note again from DataStore in case that helps find the task (it doesn't)
    // $FlowIgnore
    const noteAfterChanges: TNote = DataStore.noteByFilename(destNote.filename, destNote.type)
    // Ask for cache refresh for this note
    const updatedDestNote = DataStore.updateCache(noteAfterChanges, false)

    // delete from existing location
    const origNote = getNoteByFilename(filename)
    const origPara = findParaFromStringAndFilename(filename, content)
    if (origNote && origPara) {
      logDebug('moveItemToRegularNote', `- Removing 1 para from original note ${filename}`)
      origNote.removeParagraph(origPara)
      DataStore.updateCache(origNote, false)
    } else {
      logWarn('moveItemToRegularNote', `couldn't remove para {${content}} from original note ${filename} because note or paragraph couldn't be found`)
    }
    // Return the destNote
    return updatedDestNote

    // Ask for cache refresh for this note
  } catch (error) {
    logError('', error.message)
    return null
  }
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
export async function setPluginData(changeObject: TAnyObject, changeMessage: string = ""): Promise<void> {
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
