// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 2025-09-08 for v2.3.0.b10, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID, allSectionDetails, indexIntoAllSectionCodes } from './constants'
import { dashboardSettingDefs, dashboardFilterDefs } from './dashboardSettings'
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
import { getNestedValue, stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getTimeStringFromHM, getTodaysDateHyphenated, includesScheduledFutureDate } from '@helpers/dateTime'
import { clo, clof, clvt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFoldersMatching, getFolderFromFilename, getRegularNotesFromFilteredFolders } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { sendToHTMLWindow, getGlobalSharedData } from '@helpers/HTMLView'
import { isNoteFromAllowedFolder, pastCalendarNotes } from '@helpers/note'
import { saveSettings } from '@helpers/NPConfiguration'
import { getDueDateOrStartOfCalendarDate } from '@helpers/NPdateTime'
import { getNoteFromFilename, getReferencedParagraphs } from '@helpers/NPnote'
import { isAChildPara } from '@helpers/parentsAndChildren'
import { caseInsensitiveSubstringIncludes } from '@helpers/search'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { eliminateDuplicateParagraphs } from '@helpers/syncedCopies'
import { getAllTeamspaceIDsAndTitles, getTeamspaceTitleFromNote } from '@helpers/NPTeamspace'
import { getStartTimeObjFromParaContent, getTimeBlockString, isActiveOrFutureTimeBlockPara } from '@helpers/timeblocks'
import { isOpen, isOpenNotScheduled, removeDuplicates } from '@helpers/utils'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.Dashboard' // pluginJson['plugin.id']

/**
 * Return an Object that includes settings:
 * - that are about what sections to display and how they should look.
 * - that control other bits of Dashboard logic.
 * Note: this does not include logSettings or copies of NP app-level settings.
 * These can potentially be changed by setSetting(s) calls.
 */
export async function getDashboardSettings(): Promise<TDashboardSettings> {
  try {
    // Note: We think following (newer API call) is unreliable.
    // let pluginSettings = DataStore.settings
    // if (!pluginSettings || !pluginSettings.dashboardSettings) {
    //   clo(
    //     pluginSettings,
    //     `getDashboardSettings (newer API): DataStore.settings?.dashboardSettings not found; should be there by default. here's the full settings for ${pluginID} plugin: `,
    //   )

    // Fall back to the older way:
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(pluginSettings, `getDashboardSettings (older lookup): pluginSettings loaded from settings.json`)
    // }
    if (!pluginSettings.dashboardSettings) {
      throw (
        (pluginSettings,
        `getDashboardSettings (older lookup): dashboardSettings not found this way either; should be there by default. here's the full settings for ${
          pluginSettings.pluginID || ''
        } plugin: `)
      )
    }

    const parsedDashboardSettings: any = parseSettings(pluginSettings.dashboardSettings)

    // additional setting that always starts as true
    parsedDashboardSettings.showSearchSection = true

    // Note: I can't find the underlying issue, but we need to ensure number setting types are numbers, and not strings
    // const numberSettingTypes = dashboardSettingDefs.filter((ds) => ds.type === 'number')
    // for (const thisSetting of numberSettingTypes) {
    //   parsedDashboardSettings[thisSetting.key] = Number(parsedDashboardSettings[thisSetting.key])
    //   clvt(parsedDashboardSettings[thisSetting.key], `- numeric Setting '${String(thisSetting.key)}'`)
    // }

    // TODO(later): remove when the underlying problem is corrected
    // Warn if 'newTaskSectionHeadingLevel' setting is not a number
    if (typeof parsedDashboardSettings.newTaskSectionHeadingLevel !== 'number') {
      logWarn('getDashboardSettings', `At least one parsedDashboardSettings field is not a number type when it should be ...`)
      clvt(parsedDashboardSettings.maxItemsToShowInSection, `getDashboardSettings - parsedDashboardSettings.maxItemsToShowInSection:`)
      clvt(parsedDashboardSettings.newTaskSectionHeadingLevel, `getDashboardSettings - parsedDashboardSettings.newTaskSectionHeadingLevel:`)
    }

    return parsedDashboardSettings
  } catch (err) {
    logError('getDashboardSettings', `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return]
    return
  }
}

/**
 * Save all dashboard settings as a stringified array.
 * @param {TDashboardSettings} settings
 * @return {boolean} true if successful
 */
export async function saveDashboardSettings(settings: TDashboardSettings): Promise<boolean> {
  try {
    logDebug(`saveDashboardSettings saving settings in DataStore.settings`)
    const dashboardSettingsStr = JSON.stringify(settings) ?? ''
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    pluginSettings.dashboardSettings = dashboardSettingsStr

    // Save settings using the reliable helper ("the long way")
    const res = await saveSettings(pluginID, pluginSettings)
    logDebug('saveDashboardSettings', `Apparently saved with result ${String(res)}. BUT BEWARE OF RACE CONDITIONS. DO NOT UPDATE THE REACT WINDOW DATA QUICKLY AFTER THIS.`)
    return res
  } catch (error) {
    logError('saveDashboardSettings', `Error: ${error.message}`)
    return false
  }
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
      // Note: this is a workaround for a bug in NotePlan where the timeblockTextMustContainString preference is sometimes undefined.
      timeblockMustContainString: String(DataStore.preference('timeblockTextMustContainString') && DataStore.preference('timeblockTextMustContainString') !== 'undefined')
        ? String(DataStore.preference('timeblockTextMustContainString'))
        : '',
      defaultFileExtension: DataStore.defaultFileExtension,
      doneDatesAvailable: !!DataStore.preference('isAppendCompletionLinks'),
      currentTeamspaces: getAllTeamspaceIDsAndTitles(),
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
  // TODO(@dwertheimer): somehow make this automatically work for all new sections added in the future
  const sectionsToShow: Array<TSectionCode> = []
  if (config.showTimeBlockSection) sectionsToShow.push('TB')
  if (config.showTodaySection || config.showTodaySection === undefined) sectionsToShow.push('DT')
  if (config.showYesterdaySection) sectionsToShow.push('DY')
  if (config.showTomorrowSection) sectionsToShow.push('DO')
  if (config.showLastWeekSection) sectionsToShow.push('LW')
  if (config.showWeekSection) sectionsToShow.push('W')
  if (config.showMonthSection) sectionsToShow.push('M')
  if (config.showQuarterSection) sectionsToShow.push('Q')
  if (config.showProjectSection) sectionsToShow.push('PROJ')
  if (config.tagsToShow) sectionsToShow.push('TAG')
  if (config.showOverdueSection) sectionsToShow.push('OVERDUE')
  if (config.showPrioritySection) sectionsToShow.push('PRIORITY')
  if (config.showInfoSection) sectionsToShow.push('INFO')
  sectionsToShow.push('SEARCH')
  logDebug('getListOfEnabledSections', `sectionsToShow: ${String(sectionsToShow)}`)
  return sectionsToShow
}

/**
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many).
 * Note: can range from 7-70ms/para in JGC tests.
 *
 * @param {Array<TParagraph>} origParas
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>): Array<TParagraphForDashboard> {
  try {
    const timer = new Date()

    const dashboardParas: Array<TParagraphForDashboard> = origParas.map((p: TParagraph) => {
      // WARNING: p.note appears to be null for Teamspace regular note paras. But .filename and .content are OK.
      // TODO(later): remove this workaround.
      const note = p.note ?? getNoteFromFilename(p.filename ?? '') ?? null

      if (note) {
        // Note: seems to be a quick operation (1ms), but leaving a timer for now to indicate if >10ms
        const anyChildren = p.children() ?? []
        const hasChild = anyChildren.length > 0
        const isAChild = isAChildPara(p, note)

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

        const dueDateStr = getDueDateOrStartOfCalendarDate(p)
        const startTime = getStartTimeObjFromParaContent(p.content)
        const startTimeStr = startTime ? getTimeStringFromHM(startTime.hours, startTime.mins) : 'none'
        const outputPara: TParagraphForDashboard = {
          // $FlowIgnore[incompatible-type]
          filename: p.filename,
          // TODO(later): remove this workaround to fix regular teamspace paras.
          noteType: p.noteType === 'teamspaceNote' ? 'Notes' : note.type,
          title: note.type === 'Notes' ? displayTitle(note) : note.title /* will be ISO-8601 date */,
          type: p.type,
          prefix: p.rawContent.replace(p.content, ''),
          content: p.content,
          rawContent: p.rawContent,
          indents: p.indents, // TEST: not returning correct indents at times? Certainly lands up being 0 when it should be 1.
          lineIndex: p.lineIndex,
          priority: getNumericPriorityFromPara(p),
          startTime: startTimeStr,
          changedDate: note?.changedDate,
          hasChild: hasChild,
          isAChild: isAChild,
          dueDate: dueDateStr,
          isTeamspace: note.isTeamspaceNote,
        }
        // if (p.content.includes('TEST')) {
        //   clo(outputPara, `FYI 👉 makeDashboardParas - outputPara:`)
        // }
        return outputPara
      } else {
        logWarn('makeDashboardParas', `No note found for para {${p.content}} - probably an API teamspace bug?`)
        // $FlowFixMe[incompatible-call]
        return []
      }
    })
    // $FlowIgnore[unsafe-arithmetic]
    logTimer('makeDashboardParas', timer, `- done for ${origParas.length} paras (i.e. average ${((new Date() - timer) / origParas.length).toFixed(1)}ms/para)`)
    return dashboardParas
  } catch (error) {
    logError('makeDashboardParas', error.message)
    return []
  }
}

//-----------------------------------------------------------------

/**
 * Return list(s) of open task/checklist paragraphs in calendar note of type 'calendarPeriodName', or scheduled to that same date.
 * Various config.* items are used:
 * - excludedFolders? for folders to ignore for referenced notes
 * - separateSectionForReferencedNotes? if true, then two arrays will be returned: first from the calendar note; the second from references to that calendar note. If false, then both are included in a combined list (with the second being an empty array).
 * - ignoreItemsWithTerms  (from 2.1.0.b4 can be applied to calendar headings too)
 * - ignoreTasksScheduledToFuture
 * - excludeTasksWithTimeblocks & excludeChecklistsWithTimeblocks
 * 
 * TODO: finish? add support for Teamspace daily notes
 * 
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {string} calendarPeriodName
 * @param {TDashboardSettings} dashboardSettings
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open
 * @param {boolean} alsoReturnTimeblockLines? also include valid non-task/checklist lines that contain a timeblock
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
export function getOpenItemParasForTimePeriod(
  NPCalendarFilenameStr: string,
  calendarPeriodName: string,
  dashboardSettings: TDashboardSettings,
  useEditorWherePossible: boolean = false,
  alsoReturnTimeblockLines: boolean = false,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  try {
    let parasToUse: Array<TParagraph> = []
    const NPSettings = getNotePlanSettings()
    const mustContainString = NPSettings.timeblockMustContainString

    const matchingNotes: Array<TNote> = []
    const possTimePeriodNote = DataStore.calendarNoteByDateString(NPCalendarFilenameStr)
    if (possTimePeriodNote) {
      matchingNotes.push(possTimePeriodNote)
    }

    // Stable from about b1371
    if (NotePlan.environment.build >= 1371) {
      for (const teamspace of DataStore.teamspaces) {
        // Get note for this teamspace (if it exists)
        const note = DataStore.calendarNoteByDateString(NPCalendarFilenameStr, teamspace.filename)
        if (note) {
          matchingNotes.push(note)
          logDebug('getOpenItemPFCTP', `Found matching note for ${NPCalendarFilenameStr} in teamspace ${teamspace.filename}`)
        }
      }
      logDebug('getOpenItemPFCTP', `Found ${String(matchingNotes.length)} matching notes for ${NPCalendarFilenameStr}`)
    }

    //------------------------------------------------
    // Get paras from calendar note(s)
    const startTime = new Date() // for timing only
    for (const note of matchingNotes) {
      // Note: this takes 100-110ms for me
      let thisNoteParas: Array<TParagraph> = []

      // If note of interest is open in editor, then use latest version available, as the DataStore version could be stale.
      if (useEditorWherePossible && Editor && Editor.note?.filename === note.filename) {
        thisNoteParas = Editor.paragraphs
        logTimer('getOpenItemPFCTP', startTime, `Using EDITOR (${Editor.filename}) for the current time period: ${calendarPeriodName} which has ${String(Editor.paragraphs.length)} paras`)
      } else {
        // read note from DataStore in the usual way
        thisNoteParas = note.paragraphs
      }
      logDebug('getOpenItemPFCTP', `- found ${String(thisNoteParas.length)} paras for ${note.filename}`)
      if (thisNoteParas.length) {
        parasToUse = parasToUse.concat(thisNoteParas)
      }
    }

    // Note: No longer running in background thread, as I found in v1.x it more than doubled the time taken to run this section.

    // Need to filter out non-open task/checklist types for following function, and any scheduled tasks (with a >date) and any blank tasks.
    const todayHyphenated = getTodaysDateHyphenated()
    const theNoteDateHyphenated = NPCalendarFilenameStr
    const isToday = theNoteDateHyphenated === todayHyphenated
    const latestDate = todayHyphenated > theNoteDateHyphenated ? todayHyphenated : theNoteDateHyphenated
    // logDebug('getOpenItemPFCTP', `timeframe:${calendarPeriodName}: theNoteDateHyphenated: ${theNoteDateHyphenated}, todayHyphenated: ${todayHyphenated}, isToday: ${String(isToday)}`)

    // Keep only non-empty open tasks (and checklists if wanted),
    // and now add in other timeblock lines (if wanted), other than checklists (if excluded)
    let openParas = alsoReturnTimeblockLines ? parasToUse.filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString)) : parasToUse.filter((p) => isOpen(p))
    logDebug('getOpenItemPFCTP', `- after initial pull: ${openParas.length} para(s)`)
    if (dashboardSettings.ignoreChecklistItems) {
      openParas = openParas.filter((p) => !(p.type === 'checklist'))
      logDebug('getOpenItemPFCTP', `- after filtering out checklists: ${openParas.length} para(s)`)
    }

    // Filter out checklists with timeblocks, if wanted
    if (dashboardSettings.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isActiveOrFutureTimeBlockPara(p, mustContainString)))
    }
    // logTimer('getOpenItemPFCTP', startTime, `- after 'exclude checklist timeblocks' filter: ${openParas.length} paras`)

    // Filter out any blank lines
    openParas = openParas.filter((p) => p.content.trim() !== '')
    logTimer('getOpenItemPFCTP', startTime, `- after finding '${dashboardSettings.ignoreChecklistItems ? 'isOpenTaskNotScheduled' : 'isOpenNotScheduled'} ${alsoReturnTimeblockLines ? '+ timeblocks ' : ''}+ not blank' filter: ${openParas.length} paras`)

    // Keep only items not scheduled (other than >today or whatever calendar note we're on)
    const thisNoteDateSched = `>${theNoteDateHyphenated}`
    openParas = openParas.filter((p) => isOpenNotScheduled(p) || p.content.includes(thisNoteDateSched) || (isToday && p.content.includes('>today')))
    // logTimer('getOpenItemPFCTP', startTime, `- after not-scheduled-apart-from-today filter: ${openParas.length} paras`)

    // Filter out any future-scheduled tasks from this calendar note
    openParas = openParas.filter((p) => !includesScheduledFutureDate(p.content, latestDate))
    logTimer('getOpenItemPFCTP', startTime, `- after 'future' filter: ${openParas.length} paras`)

    // Filter out anything from 'ignoreItemsWithTerms' setting
    openParas = filterParasByIgnoreTerms(openParas, dashboardSettings, startTime, 'getOpenItemPFCTP')

    // Additionally apply to calendar headings in this note
    openParas = filterParasByCalendarHeadingSections(openParas, dashboardSettings, startTime, 'getOpenItemPFCTP')

    // for (const p of openParas) {
    //   logDebug('getOpenItemPFCTP', `- 👉 ${p.filename} is ${p.note.isTeamspaceNote ? '' : 'NOT'} a teamspace note`)
    // }

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // A task in today dated for today doesn't show here b/c it's not in backlinks
    let refOpenParas: Array<TParagraph> = []
    for (const note of matchingNotes) {
      logDebug('getOpenItemPFCTP', `- getting referenced paras for ${note.filename}`)
      refOpenParas = alsoReturnTimeblockLines
        ? getReferencedParagraphs(note, false).filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
        : getReferencedParagraphs(note, false).filter((p) => isOpen(p))
      logTimer('getOpenItemPFCTP', startTime, `- after initial pull of getReferencedParagraphs() ${alsoReturnTimeblockLines ? '+ timeblocks ' : ''}: ${refOpenParas.length} para(s)`)
      if (refOpenParas.length === 0) {
        continue
      }
      if (dashboardSettings.ignoreChecklistItems) {
        refOpenParas = refOpenParas.filter((p) => !(p.type === 'checklist'))
        // logDebug('getOpenItemPFCTP', `- after filtering out referenced checklists: ${refOpenParas.length} para(s)`)
      }
      if (dashboardSettings.excludeChecklistsWithTimeblocks) {
        refOpenParas = refOpenParas.filter((p) => !(p.type === 'checklist' && isActiveOrFutureTimeBlockPara(p, mustContainString)))
      }

      // Get list of allowed folders (using both include and exlcude settings)
      const allowedFoldersInCurrentPerspective = getCurrentlyAllowedFolders(dashboardSettings)
      // $FlowIgnore[incompatible-call] - p.note almost guaranteed to exist
      logDebug('getOpenItemPFCTP: refOpenParas', refOpenParas.map((p) => p.note?.filename ?? '<no note>'))

      refOpenParas = refOpenParas.filter((p) => isNoteFromAllowedFolder(p.note, allowedFoldersInCurrentPerspective, true))
      logTimer('getOpenItemPFCTP', startTime, `- after getting refOpenParas: ${refOpenParas.length} para(s)`)

      // Remove possible dupes from sync'd lines: returning the first Regular note copy found, otherwise the first copy found
      refOpenParas = eliminateDuplicateParagraphs(refOpenParas, 'first', true)
      logTimer('getOpenItemPFCTP', startTime, `- after 'eliminate sync dupes' filter: ${refOpenParas.length} para(s)`)

      // Filter out anything from 'ignoreItemsWithTerms' setting
      refOpenParas = filterParasByIgnoreTerms(refOpenParas, dashboardSettings, startTime, 'getOpenItemPFCTP')

      // TODO: now do any priority delta calculations if there is FM field 'note-priority-delta' set
    }

    // Decide whether to return two separate arrays, or one combined one
    // Note: sorting now happens later in useSectionSortAndFilter
    if (dashboardSettings.separateSectionForReferencedNotes) {
      // Extend TParagraph with the task's priority + start/end time from time block (if present)
      const openDashboardParas = makeDashboardParas(openParas)
      const refOpenDashboardParas = makeDashboardParas(refOpenParas)
      logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(openDashboardParas.length ?? 0)}+${String(refOpenDashboardParas.length ?? 0)} referenced items for ${calendarPeriodName}`)

      return [openDashboardParas, refOpenDashboardParas]
    } else {
      let combinedParas = openParas.concat(refOpenParas)
      // Remove possible dupes from sync'd lines: returning the first Regular note copy found, otherwise the first copy found
      combinedParas = eliminateDuplicateParagraphs(combinedParas, 'regular-notes', true)

      // Extend TParagraph with the task's priority + start/end time from time block (if present)
      const combinedDashboardParas = makeDashboardParas(combinedParas)
      logTimer('getOpenItemPFCTP', startTime, `- found and extended ${String(combinedDashboardParas.length ?? 0)} items for ${calendarPeriodName}`)

      return [combinedDashboardParas, []]
    }
  } catch (err) {
    logError('getOpenItemParasForTimePeriod', `Error: ${err.message} from ${NPCalendarFilenameStr}`)
    return [[], []] // for completeness
  }
}

// ---------------------------------------------------

/**
 * Get all tasks marked with a priority, filtered and sorted according to various settings.
 * The number of items returned is not limited.
 * @param {TDashboardSettings} settings
 * @returns {Array<TParagraph>}
 */
export async function getRelevantPriorityTasks(config: TDashboardSettings): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()

    await CommandBar.onAsyncThread()
    // Get list of folders to include or ignore
    // const includedFolders = config.includedFolders ? stringListOrArrayToArray(config.includedFolders, ',').map((folder) => folder.trim()) : []
    const excludedFolders = config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : []
    logInfo('getRelevantPriorityTasks', `excludedFolders: ${String(excludedFolders)}`)
    // Reduce list to all notes that are not blank or in @ folders or excludedFolders
    let notesToCheck = getRegularNotesFromFilteredFolders(excludedFolders, true).concat(pastCalendarNotes())
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Reduced to ${String(notesToCheck.length)} non-special regular notes + past calendar notes to check`)

    // Note: PDF and other non-notes are contained in the directories, and returned as 'notes' by `DataStore.projectNotes` (the call behind 'regularNotesFromFilteredFolders').
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

    // Filter out items in non-valid folders
    let filteredPriorityParas = filterParasByValidFolders(priorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

    // Filter out anything from 'ignoreItemsWithTerms' setting
    filteredPriorityParas = filterParasByIgnoreTerms(filteredPriorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

    // Also if wanted, apply to calendar headings in this note
    filteredPriorityParas = filterParasByCalendarHeadingSections(filteredPriorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

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
 * Test to see if the current line contents is allowed in the current settings/Perspective, by whether it has any 'ignore' terms (word/tag/mention).
 * Note: the match is case insensitive.
 * @param {string} lineContent
 * @param {string} ignoreItemsWithTerms CSV list of terms to ignore
 * @returns {boolean} true if disallowed
 */
export function isLineDisallowedByIgnoreTerms(lineContent: string, ignoreItemsWithTerms: string): boolean {
  // Note: can't use simple .split(',') as it does unexpected things with empty strings
  const ignoreTermsArr = stringListOrArrayToArray(ignoreItemsWithTerms, ',')
  // logDebug('isLineDisallowedByIgnoreTerms', `using ${String(ignoreTermsArr.length)} exclusions [${ignoreTermsArr.toString()}]`)

  const matchFound = caseInsensitiveSubstringIncludes(lineContent, ignoreTermsArr)
  // if (matchFound) {
  //   logDebug('isLineDisallowedByIgnoreTerms', `- DID find excluding term(s) [${ignoreTermsArr.toString()}] in '${String(lineContent)}'`)
  // }
  return matchFound
}

/**
 * Filter paragraphs to only include those from valid folders based on dashboard settings.
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing folder filters
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByValidFolders(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  const includedFolders = dashboardSettings.includedFolders ? stringListOrArrayToArray(dashboardSettings.includedFolders, ',').map((folder) => folder.trim()) : []
  const excludedFolders = dashboardSettings.excludedFolders ? stringListOrArrayToArray(dashboardSettings.excludedFolders, ',').map((folder) => folder.trim()) : []
  const validFolders = getFoldersMatching(includedFolders, true, excludedFolders)
  const filteredParas = paras.filter((p) => validFolders.includes(getFolderFromFilename(p.filename ?? '')))
  logTimer(functionName, startTime, `- after validFolders filter: ${filteredParas.length} paras`)
  return filteredParas
}

/**
 * Filter paragraphs to exclude those containing terms from ignoreItemsWithTerms setting.
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing ignore terms
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByIgnoreTerms(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  if (!dashboardSettings.ignoreItemsWithTerms) {
    return paras
  }

  const filteredParas = paras.filter((p) => !isLineDisallowedByIgnoreTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
  logTimer(functionName, startTime, `- after ignoreItemsWithTerms (${dashboardSettings.ignoreItemsWithTerms}) filter: ${filteredParas.length} paras`)
  return filteredParas
}

/**
 * Filter paragraphs to exclude those with disallowed terms in calendar heading sections.
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing ignore terms
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByCalendarHeadingSections(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  if (!dashboardSettings.ignoreItemsWithTerms || !dashboardSettings.applyIgnoreTermsToCalendarHeadingSections) {
    return paras
  }

  const filteredParas = paras.filter((p) => {
    // only apply to calendar notes
    if (p.note?.type !== 'Calendar') return true
    // Apply to all H4/H3/H2 headings in the hierarchy for this para
    const theseHeadings = getHeadingHierarchyForThisPara(p)
    let isAllowed = true
    for (const thisHeading of theseHeadings) {
      if (isLineDisallowedByIgnoreTerms(thisHeading, dashboardSettings.ignoreItemsWithTerms)) {
        isAllowed = false
        break
      }
    }
    return isAllowed
  })
  logTimer(functionName, startTime, `- after filtering out calendar headings: ${filteredParas.length} paras`)
  return filteredParas
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
 * Note: Not currently used.
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
    logError('getStartTimeFromPara', `${error.message}`)
    return '(error)'
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
 * Merge existing sections data with replacement data.
 * If the section existed before, it will be replaced with the new data.
 * If the section did not exist before, it will be added to the end of sections.
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
export function createSectionItemObject(id: string, p: TParagraph | TParagraphForDashboard, theType?: TItemType): TSectionItem {
  try {
    if (!p) {
      throw new Error(`In ID ${id}, para is null`)
    } else if (!p.filename || !p.type) {
      throw new Error(`In ID ${id}, para is missing filename or type`)
    }
    const itemObj = { ID: id, itemType: theType ?? p.type, para: p, teamspaceTitle: '' }
    const thisNote = getNoteFromFilename(p.filename)
    if (thisNote) {
      const possTeamspaceTitle = getTeamspaceTitleFromNote(thisNote)
      if (possTeamspaceTitle !== '') {
        itemObj.teamspaceTitle = possTeamspaceTitle
        logDebug('createSectionItemObject', `- added teamspaceTitle ${possTeamspaceTitle}`)
      }
    } else {
      logWarn('createSectionItemObject', `- cannot get note from para {${p.content}} -- probably a Teamspace API problem`)
    }
    // $FlowIgnore - we are not using all the types in TParagraph
    return itemObj
  } catch (error) {
    logError('createSectionItemObject', `${error.message} from {${p?.content}}`)
    // $FlowIgnore[incompatible-return]
    // $FlowIgnore[incompatible-exact] - we are not using all the types in TParagraphForDashboard
    return { ID: id, itemType: theType ?? p.type ?? 'error', para: p }
  }
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
    // $FlowIgnore[incompatible-call]
    // $FlowIgnore[prop-missing]
    if (!isOpen(socp)) {
      continue
    }
    const thisID = `${sectionNumStr}-${itemCounter}`
    const thisSectionItemObject = createSectionItemObject(thisID, socp)
    // Now add parentID where relevant
    if (socp.isAChild) {
      const parentParaID =
        socp.indents === 1
          ? lastIndent0ParentID
          : socp.indents === 2
          ? lastIndent1ParentID
            : socp.indents === 3
          ? lastIndent2ParentID
              : socp.indents === 4
          ? lastIndent3ParentID
          : '' // getting silly by this point, so stop
      thisSectionItemObject.parentID = parentParaID
      // logDebug(``, `- found parentID ${parentParaID} for ID ${thisID}`)
    }
    if (socp.hasChild) {
      switch (socp.indents) {
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

/**
 * Get the default values for all dashboard settings.
 * @returns {TDashboardSettings} The default values for all dashboard settings.
 */
export function getDashboardSettingsDefaults(): TDashboardSettings {
  const dashboardFilterDefaults = dashboardFilterDefs.filter((f) => f.key !== 'includedFolders')
  const nonFilterDefaults = dashboardSettingDefs.filter((f) => f.key)
  const dashboardSettingsDefaults = [...dashboardFilterDefaults, ...nonFilterDefaults].reduce((acc, curr) => {
    // logDebug('doSwitchToPerspective', `doSwitchToPerspective: curr.key='${String(curr.key)}' curr.default='${String(curr.default)}'`)
    if (curr.key && curr.default !== undefined) {
      // $FlowIgnore[prop-missing]
      acc[curr.key] = curr.default
    } else {
      logError('doSwitchToPerspective', `doSwitchToPerspective: default value for ${String(curr.key)} is not set in dashboardSettings file defaults.`)
    }
    return acc
  }, {})
  clo(dashboardSettingsDefaults, `dashboardSettingsDefaults:`)
  // $FlowIgnore[prop-missing]
  return dashboardSettingsDefaults
}

/**
 * Get the default values for the dashboard settings, with all sections set to false.
 * This is used on update or install to ensure that any new settings or Sections are added to the perspectives.
 * @param {TDashboardSettings} dashboardSettings - The dashboard settings to update.
 * @returns {TDashboardSettings} The default values for the dashboard settings, with all sections set to false.
 */
export function getDashboardSettingsDefaultsWithSectionsSetToFalse(): TDashboardSettings {
  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  const sectionList = allSectionDetails.map((s) => s.showSettingName).filter((s) => s !== '' && s !== undefined)
  const sectionsSetToFalse = sectionList.reduce((acc: TAnyObject, curr: string) => {
    acc[curr] = false
    return acc
  }, {})
  clo(sectionsSetToFalse, `sectionsSetToFalse:`)
  // $FlowIgnore[prop-missing]
  // $FlowIgnore[cannot-spread-indexer]
  return { ...dashboardSettingsDefaults, ...sectionsSetToFalse }
}

/**
 * Get the section code from an item ID.
 * Note: might now not be used.
 * TODO: in time we want to change the ID to start with the section code, so this will be easy.
 * @param {string} itemID - The ID of the item
 * @returns {string} The section code
 */
export function getSectionCodeFromItemID(itemID: string): string {
  const sectionNumber = Number(itemID.split('-')[0])
  // Look up the section code from the section number, based on index into allSectionCodes
  const sectionCode = indexIntoAllSectionCodes[sectionNumber]
  if (!sectionCode) {
    logWarn('getSectionCodeFromItemID', `-> unable to find section code for item ${itemID} (section number ${String(sectionNumber)})`)
    return ''
  }
  logDebug('getSectionCodeFromItemID', `-> sectionCode for ${itemID} is ${sectionCode}`)
  return sectionCode
}

/**
 * Finds all items within the provided sections that match the given field/value pairs.
 *
 * @param {Array<TSection>} sections - An array of section objects containing sectionItems.
 * @param {Array<string>} fieldPathsToMatch - An array of field paths (e.g., 'para.filename', 'itemType') to match against.
 * @param {Object<string, string|RegExp>} fieldValues - An object containing the field values to match against. Values can be strings or regular expressions.
 * @returns {Array<SectionItemIndex>} An array of objects containing the section index and item index for each matching item.
 * @example const indexes = findSectionItems(sections, ['itemType', 'filename', 'para.content'], { itemType: /open|checklist/, filename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)
 * @author @dwertheimer
 */
export function findSectionItems(
  sections: Array<TSection>,
  fieldPathsToMatch: Array<string>,
  fieldValues: { [key: string]: string | RegExp }
): Array<{ sectionIndex: number; itemIndex: number }> {
  logDebug('findSectionItems', `-> looking for items with ${fieldPathsToMatch.join(', ')} = ${JSP(fieldValues)}`)
  const matches: Array<{ sectionIndex: number; itemIndex: number }> = []
  sections.forEach((section, sectionIndex) => {
    section.sectionItems.forEach((item, itemIndex) => {
      const isMatch = fieldPathsToMatch.every((fieldPath) => {
        const itemFieldValue = getNestedValue(item, fieldPath)
        if (!itemFieldValue) {
          logDebug(`findSectionItems: ${fieldPath} is undefined in ${JSP(item)} -- may be ok if you are looking for a task and this is a review item`)
          return false
        }
        const fieldValue = fieldValues[fieldPath]
        if (fieldValue instanceof RegExp) {
          return fieldValue.test(itemFieldValue)
        } else {
          // logDebug(`findSectionItems:`,
          //   `${item.ID} itemFieldValue: ${itemFieldValue} ${
          //     itemFieldValue ? (itemFieldValue === fieldValue ? 'equals' : 'does not equal') : 'is undefined'
          //   } fieldValue: ${fieldValue}`,
          // )
          return itemFieldValue ? itemFieldValue === fieldValue : false
        }
      })

      if (isMatch) {
        matches.push({ sectionIndex, itemIndex })
      }
    })
  })

  return matches
}