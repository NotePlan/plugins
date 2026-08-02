// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 2026-08-01 for v2.4.0.b60 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

// import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID } from './constants'
import { normaliseDashboardNumberSettings } from './dashboardSettings'
import { getDashboardSettingsDefaults } from './dashboardSettingsDefaults'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import { removeInvalidTagSections } from './dashboardSettingsClean'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import { normalizePreferredWindowType } from './preferredWindowType'
import { parseSettings, validateAndFlattenMessageObject } from './shared'
import type { ValidatedData } from './shared'
import type {
  MessageDataObject,
  TActionButton,
  TActionOnReturn,
  TBridgeClickHandlerResult,
  TDashboardSettings,
  TDashboardLoggingConfig,
  TItemType,
  TLinkedNoteIconInfo,
  TNotePlanSettings,
  TParagraphForDashboard,
  TSection,
  TSectionCode,
  TSectionItem,
  TSettingItem,
} from './types'
import { getNestedValue, setNestedValue, stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  getISODateStringFromYYYYMMDD,
  getTimeStringFromHM,
  getTodaysDateHyphenated,
  includesScheduledFutureDate,
  isDailyDateStr,
  isMonthlyDateStr,
  isQuarterlyDateStr,
  isWeeklyDateStr,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
} from '@helpers/dateTime'
import { findNoteLinksForDisplay } from '@helpers/HTMLView'
import { clo, clof, clvt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFoldersMatching, getFolderFromFilename } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { sendToHTMLWindow, getGlobalSharedData, updateGlobalSharedData } from '@helpers/HTMLView'
import { isNoteFromAllowedFolder } from '@helpers/note'
import { getDueDateOrStartOfCalendarDate } from '@helpers/NPdateTime'
import { getFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { getNoteFromFilename, getReferencedParagraphs } from '@helpers/NPnote'
import { usersVersionHas } from '@helpers/NPVersions'
import { getIndentLevelFromRawContent } from '@helpers/paragraph'
import { isAChildPara } from '@helpers/parentsAndChildren'
import { caseInsensitiveStartsWith, caseInsensitiveSubstringArrayIncludes } from '@helpers/search'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { eliminateDuplicateParagraphs } from '@helpers/syncedCopies'
import { getAllTeamspaceIDsAndTitles, getTeamspaceTitleFromNote } from '@helpers/NPTeamspace'
import {
  getEndTimeFromPara,
  getEndTimeObjFromParaContent,
  getStartTimeFromPara,
  getStartTimeObjFromParaContent,
  getTimeBlockString,
  isActiveOrFutureTimeBlockPara,
  normalizeTimeBlockStartToHHMM,
} from '@helpers/timeblocks'
import { isOpen, isOpenNotScheduled } from '@helpers/utils'

//-----------------------------------------------------------------
// Constants
//-----------------------------------------------------------------

const pluginID = 'jgclark.Dashboard' // normally this could come from pluginJson, but not doing so in case it causes issues with Projects plugin that calls Dashboard.

// const NPSettings = getNotePlanSettings()

//-----------------------------------------------------------------
// Settings functions
//-----------------------------------------------------------------

/**
 * Return an Object that includes settings:
 * - that are about what sections to display and how they should look.
 * - that control other bits of Dashboard logic.
 * Note: this does not include logSettings or copies of NP app-level settings.
 * These can potentially be changed by setSetting(s) calls.
 */
/**
 * Dashboard settings for an open WebView: disk plus live pluginData (what the user sees), with invalid tag section keys stripped.
 * @author @CursorAI
 * @param {Partial<TDashboardSettings>} [pluginDataDashboardSettings]
 * @returns {Promise<TDashboardSettings>}
 */
export async function getDashboardSettingsForOpenWebView(pluginDataDashboardSettings?: Partial<TDashboardSettings>): Promise<TDashboardSettings> {
  const fromDisk = await getDashboardSettings()
  const merged =
    pluginDataDashboardSettings && Object.keys(pluginDataDashboardSettings).length > 0
      ? { ...fromDisk, ...pluginDataDashboardSettings }
      : fromDisk
  // removeInvalidTagSections() returns the loose indexed TAnyObject shape (it has to, because the
  // showTagSection_* keys are dynamic); the object it returns is still a full settings object.
  return (removeInvalidTagSections(merged): any)
}

export { removeStaleTagSections } from './dashboardSettingsClean'

export async function getDashboardSettings(): Promise<TDashboardSettings> {
  try {
    // Note: Cursor recommends breaking out the I/O into a separate function, to make testing easier.

    // Note: We think following (newer API call) is unreliable.
    // let pluginSettings = DataStore.settings
    // if (!pluginSettings || !pluginSettings.dashboardSettings) {
    //   clo(
    //     pluginSettings,
    //     `getDashboardSettings (newer API): DataStore.settings?.dashboardSettings not found; should be there by default. here's the full settings for ${pluginID} plugin: `,
    //   )

    // Fall back to the older way:
    const pluginSettings = await loadDashboardPluginSettings()
    // clo(pluginSettings, `getDashboardSettings (older lookup): pluginSettings loaded from settings.json`)
    // }
    if (!pluginSettings.dashboardSettings) {
      clo(pluginSettings,
        `getDashboardSettings (older lookup): dashboardSettings not found this way either; should be there by default. here's the full settings for ${
          pluginSettings.pluginID || ''
        } plugin: `)
    }

    let parsedDashboardSettings: TAnyObject = parseSettings(pluginSettings.dashboardSettings)

    // additional setting that always starts as true
    // parsedDashboardSettings.showSearchSection = true

    // On first run, dashboardSettings may be empty/undefined. Populate with defaults if needed.
    if (!parsedDashboardSettings || typeof parsedDashboardSettings !== 'object' || Object.keys(parsedDashboardSettings).length === 0) {
      logInfo('getDashboardSettings', `dashboardSettings is empty on first run, populating with defaults`)
      const defaults = getDashboardSettingsDefaults()
      parsedDashboardSettings = { ...defaults, showSearchSection: true }
      // Save the defaults back to DataStore so they persist
      // $FlowFixMe[prop-missing] showSearchSection is included in defaults
      await saveDashboardSettings(parsedDashboardSettings)
    } else {
      // Merge with defaults to ensure any new settings are added (existing settings take precedence)
      const defaults: TAnyObject = getDashboardSettingsDefaults()
      // $FlowIgnore[cannot-spread-indexer]
      parsedDashboardSettings = { ...defaults, ...parsedDashboardSettings, showSearchSection: true }

      // Migration: Convert old showProjectSection to showProjectReviewSection
      // @jgclark 2026-01-23: Renamed PROJ to PROJREVIEW and added PROJACT
      if (parsedDashboardSettings.showProjectSection !== undefined && parsedDashboardSettings.showProjectReviewSection === undefined) {
        logInfo('getDashboardSettings', `Migrating showProjectSection to showProjectReviewSection`)
        parsedDashboardSettings.showProjectReviewSection = parsedDashboardSettings.showProjectSection
        // Don't delete the old setting yet, in case user wants to roll back
        // delete parsedDashboardSettings.showProjectSection
      }
    }

    // Ensure that all numeric settings are actually numbers, not strings.
    // This is defensive in case earlier versions or x-callbacks stored them as strings.
    parsedDashboardSettings = normaliseDashboardNumberSettings(parsedDashboardSettings)

    // Normalize short legacy Window/Main/Split labels to long NP UI labels
    parsedDashboardSettings.preferredWindowType = normalizePreferredWindowType(parsedDashboardSettings.preferredWindowType)

    // Note: I can't find the underlying issue, but we need to ensure number setting types are numbers, and not strings
    // const numberSettingTypes = dashboardSettingDefs.filter((ds) => ds.type === 'number')
    // for (const thisSetting of numberSettingTypes) {
    //   parsedDashboardSettings[thisSetting.key] = Number(parsedDashboardSettings[thisSetting.key])
    //   clvt(parsedDashboardSettings[thisSetting.key], `- numeric Setting '${String(thisSetting.key)}'`)
    // }

    // Warn if for some reason key numeric settings still aren't numbers after normalisation
    if (typeof parsedDashboardSettings.newTaskSectionHeadingLevel !== 'number'
      || typeof parsedDashboardSettings.maxItemsToShowInSection !== 'number') {
      logWarn('getDashboardSettings', `At least one parsedDashboardSettings field is not a number type when it should be ...`)
      clvt(parsedDashboardSettings.maxItemsToShowInSection, `getDashboardSettings - parsedDashboardSettings.maxItemsToShowInSection:`)
      clvt(parsedDashboardSettings.newTaskSectionHeadingLevel, `getDashboardSettings - parsedDashboardSettings.newTaskSectionHeadingLevel:`)
    }

    // $FlowFixMe[prop-missing] showSearchSection is included in defaults and merged above
    // $FlowFixMe[incompatible-return] parsedDashboardSettings is treated as TDashboardSettings at runtime
    return (parsedDashboardSettings: any)
  } catch (err) {
    logError('getDashboardSettings', `${err.name}: ${err.message}`)
    logWarn('getDashboardSettings', `Returning defaults after load error`)
    const defaults = getDashboardSettingsDefaults()
    // $FlowFixMe[prop-missing]
    return ({ ...defaults, showSearchSection: true }: any)
  }
}

/**
 * Save all dashboard settings. The settings object will be serialized by DataStore.saveJSON().
 * @param {TDashboardSettings} settings
 * @return {boolean} true if successful
 */
export async function saveDashboardSettings(settings: TDashboardSettings): Promise<boolean> {
  try {
    logDebug(`saveDashboardSettings saving settings in DataStore.settings`)
    const pluginSettings = await loadDashboardPluginSettings()
    pluginSettings.dashboardSettings = settings

    // Save settings using the reliable helper ("the long way")
    const res = await saveDashboardPluginSettings(pluginSettings)
    logDebug('saveDashboardSettings', `Apparently saved with result ${String(res)}. BUT BEWARE OF RACE CONDITIONS. DO NOT UPDATE THE REACT WINDOW DATA QUICKLY AFTER THIS.`)
    return res
  } catch (error) {
    logError('saveDashboardSettings', `Error: ${error.message}`)
    return false
  }
}

export { getDashboardSettingsDefaults, getDashboardSettingsDefaultsWithSectionsSetToFalse } from './dashboardSettingsDefaults'

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
    logError('getLogSettings', `Error: ${err.message}\nNote: will use default of INFO / no timing.`)
    return getLogSettingsDefaults()
  }
}

/**
 * Safe defaults when log settings cannot be loaded from settings.json.
 * @returns {TDashboardLoggingConfig}
 */
export function getLogSettingsDefaults(): TDashboardLoggingConfig {
  return { _logLevel: 'INFO', _logTimer: false }
}

/**
 * Read a NotePlan preference as a plain JS string (safe to pass through the React WebView bridge).
 * @param {string} prefKey
 * @returns {string}
 */
function getPlainPreferenceString(prefKey: string): string {
  try {
    const prefValue = DataStore.preference(prefKey)
    if (prefValue == null || prefValue === 'undefined') {
      return ''
    }
    return String(prefValue)
  } catch (err) {
    return ''
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
      // String() coerces NP bridged String objects (e.g. emoji markers) to plain strings for WebView bridge serialization.
      timeblockMustContainString: getPlainPreferenceString('timeblockTextMustContainString'),
      defaultFileExtension: DataStore.defaultFileExtension,
      doneDatesAvailable: !!DataStore.preference('isAppendCompletionLinks'),
      currentTeamspaces: getAllTeamspaceIDsAndTitles(),
    }
  } catch (err) {
    logError('getNotePlanSettings', `Error: ${err.message}\nNote: will use default values instead.`)
    return getNotePlanSettingsDefaults()
  }
}

/**
 * Safe defaults when NotePlan app preferences cannot be read.
 * @returns {TNotePlanSettings}
 */
export function getNotePlanSettingsDefaults(): TNotePlanSettings {
  return {
    timeblockMustContainString: '',
    defaultFileExtension: 'md',
    doneDatesAvailable: false,
    currentTeamspaces: [],
  }
}

//-----------------------------------------------------------------
// Helper functions for these main functions
// Note: some of these are exported, but only to allow jest testing
//-----------------------------------------------------------------

/**
 * Deep-clone `dashboardSettings` before `saveSettings` when later diffs must reflect the pre-save state.
 * `saveSettings` / shared caches may mutate the loaded object in place, which can make `compareObjects` falsely empty.
 * @param {mixed} raw - value from `getSettings(...).dashboardSettings` (object, JSON string, or null/undefined)
 * @returns {{ [string]: any }}
 */
export function cloneDashboardSettingsBeforeSave(raw: mixed): { [string]: any } {
  if (raw == null) return {}
  try {
    const parsed = typeof raw === 'string' ? parseSettings(raw) : raw
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.parse(JSON.stringify(parsed))
    }
  } catch {
    /* keep empty */
  }
  return {}
}

/**
 * Safely get a note from a paragraph, trying p.note first, then looking up by filename.
 * @param {TParagraph} para - paragraph to get note from
 * @returns {TNote | null} the note, or null if not found
 */
function getNoteFromPara(para: TParagraph): TNote | null {
  return para.note ?? getNoteFromFilename(para.filename ?? '') ?? null
}

/**
 * Get the priority delta from the note's frontmatter attributes, if present.
 * @param {TNote} note
 * @returns {number} the priority delta
 */
function getPriorityDeltaFromNote(note: TNote): number {
  try {
    const FMAttributes = getFrontmatterAttributes(note)
    const priorityDeltaStr = FMAttributes['note-priority-delta'] ?? ''
    // logDebug('getPriorityDeltaFromNote', `- priorityDelta for ${note.filename} is ${priorityDeltaStr}`)
    return priorityDeltaStr ? parseInt(priorityDeltaStr) : 0
  } catch (error) {
    logError('getPriorityDeltaFromNote', error.message)
    return 0
  }
}

/**
 * Get matching calendar notes for a given date string, including teamspace notes.
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string). Note: for daily notes this can be either YYYYMMDD or YYYY-MM-DD.
 * @returns {{matchingNotes: Array<TNote>, possTimePeriodNote: TNote | null}} Object with matching notes array and private calendar note
 */
function getMatchingCalendarNotes(NPCalendarFilenameStr: string): { matchingNotes: Array<TNote>, possTimePeriodNote: ?TNote } {
  const matchingNotes: Array<TNote> = []
  const possTimePeriodNote = DataStore.calendarNoteByDateString(NPCalendarFilenameStr)
  if (possTimePeriodNote) {
    matchingNotes.push(possTimePeriodNote)
  } else {
    logInfo('getMatchingCalendarNotes', `No matching calendar note found for ${NPCalendarFilenameStr}`)
  }

  if (usersVersionHas('teamspaceNotes')) {
    for (const teamspace of DataStore.teamspaces) {
      // Get note for this teamspace
      // Note: as I report in https://discord.com/channels/763107030223290449/1439735396652028146 this seems to return even when note doesn't exist yet.
      const note = DataStore.calendarNoteByDateString(NPCalendarFilenameStr, teamspace.filename)
      // Given above, we need to check if the note has any paragraphs, before using it.
      if (note && note.paragraphs.length > 0) {
        matchingNotes.push(note)
        logDebug('getMatchingCalendarNotes', `- found non-empty matching teamspace calendar note for ${NPCalendarFilenameStr} in ${teamspace.filename}`)
      }
    }
    // logDebug('getMatchingCalendarNotes', `Found ${String(matchingNotes.length)} matching Teamspace calendar notes for ${NPCalendarFilenameStr}`)
  }

  return { matchingNotes, possTimePeriodNote }
}

/**
 * Get paragraphs from calendar notes, using editor if available.
 * @param {Array<TNote>} notes - Notes to get paragraphs from
 * @param {boolean} useEditorWherePossible - Whether to use editor paragraphs if note is open
 * @param {string} calendarPeriodName - Name of calendar period for logging
 * @param {Date} startTime - Timer start time for logging
 * @returns {Array<TParagraph>} Array of paragraphs from the notes
 */
function getParagraphsFromCalendarNotes(
  notes: Array<TNote>,
  useEditorWherePossible: boolean,
  calendarPeriodName: string,
  startTime: Date
): Array<TParagraph> {
  let parasToUse: Array<TParagraph> = []
  for (const note of notes) {
    // Note: this takes 100-110ms for me
    let thisNoteParas: Array<TParagraph> = []

    // If note of interest is open in editor, then use latest version available, as the DataStore version could be stale.
    if (useEditorWherePossible && Editor && Editor.note?.filename === note.filename) {
      thisNoteParas = Editor.paragraphs
      logTimer('getParagraphsFromCalendarNotes', startTime, `Using EDITOR (${Editor.filename}) for the current time period: ${calendarPeriodName} which has ${String(Editor.paragraphs.length)} paras`)
    } else {
      // read note from DataStore in the usual way
      thisNoteParas = note.paragraphs
    }
    logDebug('getParagraphsFromCalendarNotes', `- found ${String(thisNoteParas.length)} paras for ${note.filename}`)
    if (thisNoteParas.length) {
      parasToUse = parasToUse.concat(thisNoteParas)
    }
  }

  // Log if content contains TEST
  // Log if content contains TEST
  if (parasToUse.some((para) => para.content.includes('TEST'))) {
    const testParas = parasToUse.filter((p) => p.content.includes('TEST'))
    const testOutput = testParas.map((p) => `- ${String(p.lineIndex)}: ${p.rawContent}`).join('\n')
    logInfo('getParagraphsFromCalendarNotes', `FYI 👉 found TEST in paragraph(s):\n${testOutput}`)
  }
  return parasToUse
}

/**
 * Filter paragraphs to only include open tasks/checklists and optionally timeblocks.
 * @tests in jest file
 * @param {Array<TParagraph>} paras - Paragraphs to filter
 * @param {boolean} alsoReturnTimeblockLines - Whether to include timeblock lines
 * @param {string} mustContainString - String that timeblocks must contain
 * @returns {Array<TParagraph>} Filtered paragraphs
 */
export function filterToOpenParagraphs(
  paras: Array<TParagraph>,
  alsoReturnTimeblockLines: boolean,
  mustContainString: string
): Array<TParagraph> {
  return alsoReturnTimeblockLines
    ? paras.filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
    : paras.filter((p) => isOpen(p))
}

/**
 * Filter paragraphs by checklist settings.
 * @param {Array<TParagraph>} paras - Paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - Dashboard settings
 * @param {string} mustContainString - String that timeblocks must contain
 * @returns {Array<TParagraph>} Filtered paragraphs
 */
function filterByChecklistSettings(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  mustContainString: string
): Array<TParagraph> {
  let filteredParas = paras

  // Filter out checklists, if requested
  if (dashboardSettings.ignoreChecklistItems) {
    filteredParas = filteredParas.filter((p) => !(p.type === 'checklist'))
    logDebug('filterByChecklistSettings', `- after filtering out checklists: ${filteredParas.length} para(s)`)
  }

  // Filter out checklists with timeblocks, if requested
  if (dashboardSettings.excludeChecklistsWithTimeblocks) {
    filteredParas = filteredParas.filter((p) => !(p.type === 'checklist' && isActiveOrFutureTimeBlockPara(p, mustContainString)))
  }

  return filteredParas
}

/**
 * Normalize calendar date input (YYYYMMDD, filename/path containing YYYYMMDD, or YYYY-MM-DD) to YYYY-MM-DD for daily notes.
 * Week/month/quarter/year keys are returned unchanged.
 * @param {string} npcStr - from getOpenItemParasForTimePeriod / DataStore APIs
 * @returns {string}
 */
function hyphenatedCalendarDayKeyFromNPDateInput(npcStr: string): string {
  const ymd = new RegExp(RE_YYYYMMDD_DATE).exec(npcStr)
  if (ymd) {
    return getISODateStringFromYYYYMMDD(ymd[0])
  }
  const iso = new RegExp(RE_ISO_DATE).exec(npcStr)
  if (iso) {
    return iso[0]
  }
  return npcStr
}

/**
 * Filter paragraphs by scheduling rules (not scheduled except for current date/today).
 * @tests in jest file
 * @param {Array<TParagraph>} paras - Paragraphs to filter
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string)
 * @param {string} latestDate - Latest date to consider (today or note date)
 * @returns {Array<TParagraph>} Filtered paragraphs
 */
export function filterBySchedulingRules(
  paras: Array<TParagraph>,
  NPCalendarFilenameStr: string,
  latestDate: string
): Array<TParagraph> {
  const todayHyphenated = getTodaysDateHyphenated()
  const theNoteDateHyphenated = hyphenatedCalendarDayKeyFromNPDateInput(NPCalendarFilenameStr)
  const isToday = theNoteDateHyphenated === todayHyphenated
  const thisNoteDateSched = `>${theNoteDateHyphenated}`

  // Keep only items not scheduled (other than >today or whatever calendar note we're on)
  let filteredParas = paras.filter((p) => isOpenNotScheduled(p) || p.content.includes(thisNoteDateSched) || (isToday && p.content.includes('>today')))
  // logTimer('filterBySchedulingRules', startTime, `- after not-scheduled-apart-from-today filter: ${filteredParas.length} paras`)

  // Filter out any future-scheduled tasks from this calendar note
  filteredParas = filteredParas.filter((p) => !includesScheduledFutureDate(p.content, latestDate))

  return filteredParas
}

/**
 * Apply all filters to open paragraphs from calendar notes.
 * @param {Array<TParagraph>} parasToUse - Paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - Dashboard settings
 * @param {boolean} alsoReturnTimeblockLines - Whether to include timeblock lines
 * @param {string} mustContainString - String that timeblocks must contain
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string)
 * @param {Date} startTime - Timer start time for logging
 * @returns {Array<TParagraph>} Filtered paragraphs
 */
function filterOpenParagraphs(
  parasToUse: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  alsoReturnTimeblockLines: boolean,
  mustContainString: string,
  NPCalendarFilenameStr: string,
  startTime: Date
): Array<TParagraph> {
  const todayHyphenated = getTodaysDateHyphenated()
  const theNoteDateHyphenated = hyphenatedCalendarDayKeyFromNPDateInput(NPCalendarFilenameStr)
  const latestDate = todayHyphenated > theNoteDateHyphenated ? todayHyphenated : theNoteDateHyphenated
  // logDebug('filterOpenParagraphs', `timeframe:${calendarPeriodName}: theNoteDateHyphenated: ${theNoteDateHyphenated}, todayHyphenated: ${todayHyphenated}, isToday: ${String(isToday)}`)

  // Keep only non-empty open tasks and checklists, and now add in other timeblock lines if wanted
  let openParas = filterToOpenParagraphs(parasToUse, alsoReturnTimeblockLines, mustContainString)
  logDebug('filterOpenParagraphs', `- ${openParas.length} paras after initial pull`)
  // clof(openParas, 'filterOpenParagraphs: openParas', ['type', 'content'])

  // Filter by checklist settings
  openParas = filterByChecklistSettings(openParas, dashboardSettings, mustContainString)

  // Filter out any blank lines
  openParas = openParas.filter((p) => p.content.trim() !== '')

  // Filter by scheduling rules
  openParas = filterBySchedulingRules(openParas, NPCalendarFilenameStr, latestDate)

  // Filter out anything from 'ignoreItemsWithTerms' setting
  openParas = filterParasByIgnoreTerms(openParas, dashboardSettings, startTime, 'filterOpenParagraphs')

  // Filter out anything not matching 'includedCalendarSections' setting, if set
  openParas = filterParasByIncludedCalendarSections(openParas, dashboardSettings, startTime, 'filterOpenParagraphs')

  // Filter out anything matching 'ignoreItemsWithTerms' setting, if set
  openParas = filterParasByExcludedCalendarSections(openParas, dashboardSettings, startTime, 'filterOpenParagraphs')

  return openParas
}

/**
 * Get and filter referenced paragraphs from other notes.
 * @param {?TNote} possTimePeriodNote - The calendar note to get references from
 * @param {TDashboardSettings} dashboardSettings - Dashboard settings
 * @param {boolean} alsoReturnTimeblockLines - Whether to include timeblock lines
 * @param {string} mustContainString - String that timeblocks must contain
 * @param {Array<string>} allowedTeamspaceIDs - Allowed teamspace IDs
 * @param {Date} startTime - Timer start time for logging
 * @returns {Array<TParagraph>} Filtered referenced paragraphs
 */
function getReferencedOpenParagraphs(
  possTimePeriodNote: ?TNote,
  dashboardSettings: TDashboardSettings,
  alsoReturnTimeblockLines: boolean,
  mustContainString: string,
  allowedTeamspaceIDs: Array<string>,
  startTime: Date
): Array<TParagraph> {
  let refOpenParas: Array<TParagraph> = []

  if (!possTimePeriodNote) {
    return refOpenParas
  }

  const note = possTimePeriodNote
  logDebug('getReferencedOpenParagraphs', `-> getting referenced paras for ${note.filename}`)
  // Note: This isn't returning referenced child paragraphs. Error noted in NPNote.js
  const refParas = getReferencedParagraphs(note, false)
  // logDebug('getReferencedOpenParagraphs', `-> found ${String(refParas.length)} referenced paras for ${note.filename}: ${refParas.map((p) => `#${p.lineIndex}: ${p.rawContent}`).join('\n')}`)
  refOpenParas = alsoReturnTimeblockLines
    ? refParas.filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
    : refParas.filter((p) => isOpen(p))
  logTimer('getReferencedOpenParagraphs', startTime, `- after initial pull of getReferencedParagraphs() ${alsoReturnTimeblockLines ? '+ timeblocks ' : ''}: ${refOpenParas.length} para(s)`)

  if (refOpenParas.length === 0) {
    return refOpenParas
  }

  // Filter by checklist settings
  refOpenParas = filterByChecklistSettings(refOpenParas, dashboardSettings, mustContainString)

  // Get list of allowed folders (using both include and exclude settings)
  const allowedFoldersInCurrentPerspective = getCurrentlyAllowedFolders(dashboardSettings)
  // $FlowIgnore[incompatible-call] - p.note almost guaranteed to exist
  logDebug('getReferencedOpenParagraphs: refOpenParas', refOpenParas.map((p) => p.note?.filename ?? '<no note>'))

  // Filter by teamspace first
  refOpenParas = refOpenParas.filter((p) => {
    const note = getNoteFromPara(p)
    if (!note) return false
    return isNoteFromAllowedTeamspace(note, allowedTeamspaceIDs)
  })
  logTimer('getReferencedOpenParagraphs', startTime, `- after teamspace filter on refOpenParas: ${refOpenParas.length} para(s)`)

  // Then filter by folders
  refOpenParas = refOpenParas.filter((p) => {
    const note = getNoteFromPara(p)
    return note ? isNoteFromAllowedFolder(note, allowedFoldersInCurrentPerspective, true) : false
  })
  logTimer('getReferencedOpenParagraphs', startTime, `- after folder filter on refOpenParas: ${refOpenParas.length} para(s)`)

  // Remove possible dupes from sync'd lines: returning the first Regular note copy found, otherwise the first copy found
  refOpenParas = eliminateDuplicateParagraphs(refOpenParas, 'first', true)
  logTimer('getReferencedOpenParagraphs', startTime, `- after 'eliminate sync dupes' filter: ${refOpenParas.length} para(s)`)

  // Filter out anything from 'ignoreItemsWithTerms' setting
  refOpenParas = filterParasByIgnoreTerms(refOpenParas, dashboardSettings, startTime, 'getOpenItemPFCTP')

  // TODO: now do any priority delta calculations if there is FM field 'note-priority-delta' set

  // Log if content contains TEST
  if (refOpenParas.some((para) => para.content.includes('TEST'))) {
    const testParas = refOpenParas.filter((p) => p.content.includes('TEST'))
    const testOutput = testParas.map((p) => `- ${String(p.lineIndex)}: ${p.rawContent}`).join('\n')
    logInfo('getReferencedOpenParagraphs', `FYI 👉 found TEST in paragraph(s):\n${testOutput}`)
  }

  return refOpenParas
}

/**
 * Combine or separate results based on dashboard settings.
 * @param {Array<TParagraph>} openParas - Open paragraphs from calendar notes
 * @param {Array<TParagraph>} refOpenParas - Referenced open paragraphs
 * @param {TDashboardSettings} dashboardSettings - Dashboard settings
 * @param {string} calendarPeriodName - Name of calendar period for logging
 * @param {Date} startTime - Timer start time for logging
 * @returns {[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>]} Tuple of dashboard paragraphs
 */
function combineOrSeparateResults(
  openParas: Array<TParagraph>,
  refOpenParas: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  calendarPeriodName: string,
  startTime: Date
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  // Decide whether to return two separate arrays, or one combined one
  // Note: sorting now happens later in useSectionSortAndFilter
  if (dashboardSettings.separateSectionForReferencedNotes) {
    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const openDashboardParas = makeDashboardParas(openParas)
    const refOpenDashboardParas = makeDashboardParas(refOpenParas)
    logTimer('combineOrSeparateResults', startTime, `- found and extended ${String(openDashboardParas.length ?? 0)}+${String(refOpenDashboardParas.length ?? 0)} referenced items for ${calendarPeriodName} (SEPARATE OUTPUT)`)

    return [openDashboardParas, refOpenDashboardParas]
  } else {
    let combinedParas = openParas.concat(refOpenParas)
    // Remove possible dupes from sync'd lines: returning the first Regular note copy found, otherwise the first copy found
    combinedParas = eliminateDuplicateParagraphs(combinedParas, 'regular-notes', true)

    // Extend TParagraph with the task's priority + start/end time from time block (if present)
    const combinedDashboardParas = makeDashboardParas(combinedParas)
    logTimer('combineOrSeparateResults', startTime, `- found and extended ${String(combinedDashboardParas.length ?? 0)} items for ${calendarPeriodName} (COMBINED OUTPUT)`)

    return [combinedDashboardParas, []]
  }
}

//-----------------------------------------------------------------
// Main functions
//-----------------------------------------------------------------

/**
 * Get open item paragraphs for a time period from calendar notes and referenced notes.
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string). Note: for daily notes this can be either YYYYMMDD or YYYY-MM-DD.
 * @param {string} calendarPeriodName - Name of calendar period for logging
 * @param {TDashboardSettings} dashboardSettings - Dashboard settings
 * @param {boolean} useEditorWherePossible - Whether to use editor paragraphs if note is open
 * @param {boolean} alsoReturnTimeblockLines - Whether to include timeblock lines
 * @returns {[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>]} Tuple of dashboard paragraphs
 */
export function getOpenItemParasForTimePeriod(
  NPCalendarFilenameStr: string,
  calendarPeriodName: string,
  dashboardSettings: TDashboardSettings,
  useEditorWherePossible: boolean = false,
  alsoReturnTimeblockLines: boolean = false,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  try {
    const NPSettings = getNotePlanSettings()
    const mustContainString = NPSettings.timeblockMustContainString
    const startTime = new Date() // for timing only

    // Get matching calendar notes (including teamspace notes)
    const { matchingNotes, possTimePeriodNote } = getMatchingCalendarNotes(NPCalendarFilenameStr)

    // Filter notes by allowed teamspaces
    const allowedTeamspaceIDs = resolveAllowedTeamspaceIDs(dashboardSettings)
    const filteredMatchingNotes = matchingNotes.filter((note) => isNoteFromAllowedTeamspace(note, allowedTeamspaceIDs))
    logDebug('getOpenItemParasForTimePeriod', `- after teamspace filter: ${filteredMatchingNotes.length} of ${matchingNotes.length} notes`)

    // Get paragraphs from calendar notes
    const parasToUse = getParagraphsFromCalendarNotes(filteredMatchingNotes, useEditorWherePossible, calendarPeriodName, startTime)

    // Note: No longer running in background thread, as I found in v1.x it more than doubled the time taken to run this section.

    // Filter open paragraphs
    const openParas = filterOpenParagraphs(
      parasToUse,
      dashboardSettings,
      alsoReturnTimeblockLines,
      mustContainString,
      NPCalendarFilenameStr,
      startTime
    )
    // logDebug('getOpenItemParasForTimePeriod', `- after 'filterOpenParagraphs' filter: ${openParas.length} paras`)

    // Get referenced paragraphs from other notes
    const refOpenParas = getReferencedOpenParagraphs(
      possTimePeriodNote,
      dashboardSettings,
      alsoReturnTimeblockLines,
      mustContainString,
      allowedTeamspaceIDs,
      startTime
    )

    // Combine or separate results based on settings
    return combineOrSeparateResults(openParas, refOpenParas, dashboardSettings, calendarPeriodName, startTime)
  } catch (err) {
    logError('getOpenItemParasForTimePeriod', `Error: ${err.message} from ${NPCalendarFilenameStr}`)
    return [[], []] // for completeness
  }
}

/**
 * Whether the master "Show Reminders" Filter toggle is on.
 * Missing showRemindersSection means ON (default); only an explicit false disables all reminder display.
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
export function isRemindersMasterEnabled(config: TDashboardSettings): boolean {
  return config.showRemindersSection !== false
}

/**
 * Whether current (day/TB) reminder injection is enabled.
 * Requires master Show Reminders ON. Missing showCurrentReminders means ON (default); only an explicit false disables it.
 * Covers Timed / Today / Yesterday / Tomorrow reminder placement.
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
export function isCurrentRemindersEnabled(config: TDashboardSettings): boolean {
  return isRemindersMasterEnabled(config) && config.showCurrentReminders !== false
}

/**
 * Whether undated REM section and overdue reminder injection are enabled.
 * Requires master Show Reminders ON. Missing showUndatedOverdueReminders means ON (default); only an explicit false disables it.
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
export function isUndatedOverdueRemindersEnabled(config: TDashboardSettings): boolean {
  return isRemindersMasterEnabled(config) && config.showUndatedOverdueReminders !== false
}

/**
 * TB (Time Blocks / Timed Items / Timed Reminders) is wanted when either Time Block or Current Reminders is enabled.
 * NotePlan timeblocks only appear when showTimeBlockSection is on; timed reminders appear when Current Reminders is on.
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
export function isTBSectionEnabled(config: TDashboardSettings): boolean {
  const timeBlockOn = Boolean(config.showTimeBlockSection)
  return timeBlockOn || isCurrentRemindersEnabled(config)
}

/**
 * Default heading for new-task form fields; empty string when setting is <<carry forward>>.
 * @param {TDashboardSettings} config
 * @returns {string}
 */
export function getDefaultHeadingForNewTask(config: TDashboardSettings): string {
  return config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
}

/**
 * Build form fields for add-task / add-checklist dialogs (task input + optional heading dropdown).
 * @param {Array<string>} headings
 * @param {TDashboardSettings} config
 * @returns {Array<TSettingItem>}
 */
export function buildAddTaskFormFields(headings: Array<string>, config: TDashboardSettings): Array<TSettingItem> {
  const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
  if (!headings.length) return formFieldsBase
  const defaultHeadingToAddTo = getDefaultHeadingForNewTask(config)
  // $FlowIgnore[incompatible-return] concat() widens to the literal's own type; the literal is a valid TSettingItem at runtime
  return formFieldsBase.concat([
    {
      type: 'dropdown-select',
      label: 'Under Heading:',
      key: 'heading',
      // Cast: TSettingItem.options (in helpers/react/DynamicDialog) is Array<TOptionObject>, but
      // dropdown-select also accepts a plain Array<string>. Arrays are invariant so this can't be widened here.
      options: (headings: any),
      noWrapOptions: true,
      value: defaultHeadingToAddTo,
    },
  ])
}

/**
 * Build addTask + addChecklist action buttons for a calendar note.
 * @param {{
 *   filename: string,
 *   formFields: Array<TSettingItem>,
 *   colorClass: string,
 *   taskTooltip: string,
 *   checklistTooltip: string,
 *   postActionRefresh?: Array<TSectionCode>,
 *   iconVariant?: 'plus' | 'arrow-right',
 * }} opts
 * @returns {Array<TActionButton>}
 */
export function buildAddTaskChecklistButtons(opts: {
  filename: string,
  formFields: Array<TSettingItem>,
  colorClass: string,
  taskTooltip: string,
  checklistTooltip: string,
  postActionRefresh?: Array<TSectionCode>,
  iconVariant?: 'plus' | 'arrow-right',
}): Array<TActionButton> {
  const iconVariant = opts.iconVariant || 'plus'
  const taskIcon = iconVariant === 'arrow-right' ? 'fa-circle-arrow-right' : 'fa-circle-plus'
  const checklistIcon = iconVariant === 'arrow-right' ? 'fa-square-arrow-right' : 'fa-square-plus'
  const taskButton: TActionButton = {
    actionName: 'addTask',
    actionPluginID: pluginID,
    tooltip: opts.taskTooltip,
    display: `<i class= "fa-regular fa-fw  ${taskIcon} ${opts.colorClass}" ></i> `,
    actionParam: opts.filename,
    formFields: opts.formFields,
    submitOnEnter: true,
    submitButtonText: 'Add & Close',
  }
  const checklistButton: TActionButton = {
    actionName: 'addChecklist',
    actionPluginID: pluginID,
    tooltip: opts.checklistTooltip,
    display: `<i class= "fa-regular fa-fw  ${checklistIcon} ${opts.colorClass}" ></i> `,
    actionParam: opts.filename,
    formFields: opts.formFields,
    submitOnEnter: true,
    submitButtonText: 'Add & Close',
  }
  if (opts.postActionRefresh) {
    taskButton.postActionRefresh = opts.postActionRefresh
    checklistButton.postActionRefresh = opts.postActionRefresh
  }
  return [taskButton, checklistButton]
}

/**
 * Get list of section codes, that are enabled in the display settings.
 * @param {TDashboardSettings} config
 * @returns {Array<TSectionCode>}
 */
export function getListOfEnabledSections(config: TDashboardSettings): Array<TSectionCode> {
  // Work out which sections to show
  // TODO(@dwertheimer): somehow make this automatically work for all new sections added in the future
  const sectionsToShow: Array<TSectionCode> = []
  // TB when Time Block and/or Current Reminders enabled (timed reminders live in TB)
  if (isTBSectionEnabled(config)) sectionsToShow.push('TB')
  // Default ON when missing so upgrades without the key still show undated Reminders
  if (isUndatedOverdueRemindersEnabled(config)) sectionsToShow.push('REM')
  if (config.showTodaySection || config.showTodaySection === undefined) sectionsToShow.push('DT')
  if (config.showYesterdaySection) sectionsToShow.push('DY')
  if (config.showTomorrowSection) sectionsToShow.push('DO')
  if (config.showLastWeekSection) sectionsToShow.push('LW')
  if (config.showWeekSection) sectionsToShow.push('W')
  if (config.showMonthSection) sectionsToShow.push('M')
  if (config.showQuarterSection) sectionsToShow.push('Q')
  if (config.showYearSection) sectionsToShow.push('Y')
  if (config.showProjectActiveSection) sectionsToShow.push('PROJACT')
  if (config.showProjectReviewSection) sectionsToShow.push('PROJREVIEW')
  if (config.tagsToShow) sectionsToShow.push('TAG')
  if (config.showOverdueSection) sectionsToShow.push('OVERDUE')
  if (config.showPrioritySection) sectionsToShow.push('PRIORITY')
  if (config.showInfoSection) sectionsToShow.push('INFO')
  sectionsToShow.push('SEARCH')
  logDebug('getListOfEnabledSections', `sectionsToShow: ${String(sectionsToShow)}`)
  return sectionsToShow
}

/**
 * Safely call Paragraph.children() when the API exposes it. Otherwise returns [].
 * @param {TParagraph} para
 * @returns {Array<TParagraph>}
 */
function getChildrenFromPara(para: TParagraph): Array<TParagraph> {
  if (typeof (para: any).children === 'function' && (para: any).children != null) {
    return (para.children(): any) ?? []
  }
  return []
}

/**
 * Read frontmatter icon / icon-color from a note (same fields as source-note icons on dashboard paras).
 * @param {TNote} note
 * @returns {TLinkedNoteIconInfo}
 */
function getLinkedNoteIconInfoFromNote(note: TNote): TLinkedNoteIconInfo {
  const info: TLinkedNoteIconInfo = { filename: note.filename }
  try {
    const FMAttributes: { [key: string]: string } = getFrontmatterAttributes(note)
    const iconValue = FMAttributes['icon']
    if (iconValue) {
      info.icon = String(iconValue)
    }
    const iconColorValue = FMAttributes['icon-color']
    if (iconColorValue) {
      info.iconColor = String(iconColorValue)
    }
  } catch (error) {
    // If frontmatter parsing fails, keep filename only
  }
  return info
}

/**
 * Resolve a wiki-link title (without #heading) to a note, if it exists.
 * @param {string} title
 * @returns {?TNote}
 */
function resolveNoteByNoteLinkTitle(title: string): ?TNote {
  if (
    isDailyDateStr(title) ||
    isWeeklyDateStr(title) ||
    isMonthlyDateStr(title) ||
    isQuarterlyDateStr(title)
  ) {
    return DataStore.calendarNoteByDateString(title) ?? null
  }
  const notes = DataStore.projectNoteByTitle(title, true, false)
  return notes && notes.length > 0 ? notes[0] : null
}

/**
 * Build a title → icon map for [[wiki links]] in content. Uses refresh-scoped cache to avoid repeat DataStore hits.
 * @param {string} content
 * @param {Map<string, TLinkedNoteIconInfo>} cache
 * @returns {{ [string]: TLinkedNoteIconInfo } | void}
 */
function buildLinkedNoteIconsForContent(
  content: string,
  cache: Map<string, TLinkedNoteIconInfo>,
): { [string]: TLinkedNoteIconInfo } | void {
  if (!content.includes('[[')) {
    return undefined
  }
  const noteLinks = findNoteLinksForDisplay(content)
  if (noteLinks.length === 0) {
    return undefined
  }
  const linkedNoteIcons: { [string]: TLinkedNoteIconInfo } = {}
  for (const noteLink of noteLinks) {
    const titleKey = noteLink.noteTitleInner.split('#')[0]
    if (!titleKey || linkedNoteIcons[titleKey]) {
      continue
    }
    const cached = cache.get(titleKey)
    if (cached) {
      linkedNoteIcons[titleKey] = cached
      continue
    }
    const linkedNote = resolveNoteByNoteLinkTitle(titleKey)
    const info: TLinkedNoteIconInfo = linkedNote
      ? getLinkedNoteIconInfoFromNote(linkedNote)
      : {}
    cache.set(titleKey, info)
    linkedNoteIcons[titleKey] = info
  }
  return Object.keys(linkedNoteIcons).length > 0 ? linkedNoteIcons : undefined
}

/**
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many).
 * Note: can range from 7-70ms/para in JGC tests.
 *
 * @param {Array<TParagraph>} origParas
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>, checkForPriorityDelta: boolean = true): Array<TParagraphForDashboard> {
  try {
    const timer = new Date()
    // Refresh-scoped cache so duplicate wiki-link titles across paras only hit DataStore once
    const linkedNoteIconCache: Map<string, TLinkedNoteIconInfo> = new Map()

    const dashboardParas: Array<TParagraphForDashboard> = origParas.reduce((acc: Array<TParagraphForDashboard>, p: TParagraph) => {
      if (!p) {
        throw new Error(`p is undefined`)
      }
      const note = p.note

      // Derive a reliable indent level from rawContent to work around Paragraph.indents API bug
      const computedIndentLevel = getIndentLevelFromRawContent(p.rawContent ?? '')
      const effectiveIndents = p.indents === 0 && computedIndentLevel > 0 ? computedIndentLevel : p.indents
      // TODO(later): remove this debugging after TEST:
      if (effectiveIndents !== p.indents) {
        logInfo('makeDashboardParas', `👉👉👉 Found .indents mismatch for line ${p.lineIndex}: API indents=${p.indents}, effectiveIndents=${effectiveIndents}, rawContent:{${p.rawContent}}`)
      }

      // Set default priorityDelta to 0
      let priorityDelta = 0
      if (note) {
        // Note: seems to be a quick operation (1ms), but leaving a timer for now to indicate if >10ms
        const anyChildren = getChildrenFromPara(p)
        const hasChild = anyChildren.length > 0
        const isAChild = isAChildPara(p, note)

        // Note: debugging why sometimes hasChild is wrong
        // TODO(later): remove this debugging
        if (hasChild && p.content.toUpperCase().includes('TEST')) {
          logDebug('makeDashboardParas', `FYI 👉 makeDashboardParas: found indented children for #${p.lineIndex}:in "${note.filename}" (indents:${effectiveIndents}) {${p.rawContent}}`)
          clo(p.contentRange, `contentRange for paragraph`)
          clof(anyChildren, `Children of paragraph`, ['lineIndex', 'indents', 'content'])
          clo(anyChildren[0].contentRange, `contentRange for child[0]`)

        }
        if (checkForPriorityDelta) {
          priorityDelta = getPriorityDeltaFromNote(note)
        }


        // Get icon and icon-color from note's frontmatter, if present.
        let noteIcon: ?string
        let noteIconColor: ?string
        try {
          const FMAttributes: { [key: string]: string } = getFrontmatterAttributes(note)
          const iconValue = FMAttributes['icon']
          if (iconValue) {
            noteIcon = String(iconValue)
          }
          const iconColorValue = FMAttributes['icon-color']
          if (iconColorValue) {
            noteIconColor = String(iconColorValue)
          }
        } catch (error) {
          // If frontmatter parsing fails, just continue without icon/icon-color
        }

        const dueDateStr = getDueDateOrStartOfCalendarDate(p)
        const startTime = getStartTimeObjFromParaContent(p.content)
        const startTimeStr = startTime ? getTimeStringFromHM(startTime.hours, startTime.mins) : 'none'
        const endTime = getEndTimeObjFromParaContent(p.content)
        const endTimeStr =
          endTime && Number.isFinite(endTime.hours) && Number.isFinite(endTime.mins) ? getTimeStringFromHM(endTime.hours, endTime.mins) : undefined
        // Get title, but don't add the 👥 icon and teamspace name for Teamspace notes. Fallback is to use the note.title, which will be ISO-8601 date for Calendar notes.
        const noteTitle = note.type === 'Notes' ? displayTitle(note, false) : note.title
        const linkedNoteIcons = buildLinkedNoteIconsForContent(p.content, linkedNoteIconCache)
        const outputPara: TParagraphForDashboard = {
          filename: p?.filename ?? '',
          noteType: p?.noteType ?? note?.type ?? 'Notes',
          title: noteTitle,
          type: p.type,
          prefix: p.rawContent.replace(p.content, ''),
          content: p.content,
          rawContent: p.rawContent,
          indents: effectiveIndents,
          lineIndex: p.lineIndex,
          priority: getNumericPriorityFromPara(p) + priorityDelta,
          startTime: startTimeStr,
          endTime: endTimeStr,
          changedDate: note?.changedDate,
          hasChild: hasChild,
          isAChild: isAChild,
          dueDate: dueDateStr,
          isTeamspace: note.isTeamspaceNote,
          icon: noteIcon,
          iconColor: noteIconColor,
          ...(linkedNoteIcons ? { linkedNoteIcons } : {}),
        }
        if (p.content.includes('TEST')) {
          logInfo('makeDashboardParas', `👉👉👉 ${JSP(outputPara)}`)
        }
        acc.push(outputPara)
      } else {
        logWarn('makeDashboardParas', `No note found for para {${p.content}} - probably an API teamspace bug?`)
      }
      return acc
    }, [])
    // $FlowIgnore[unsafe-arithmetic]
    logTimer('makeDashboardParas', timer, `- done for ${origParas.length} paras (i.e. average ${((new Date() - timer) / origParas.length).toFixed(1)}ms/para)`)
    return dashboardParas
  } catch (error) {
    logError('makeDashboardParas', error.message)
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

  const matchFound = caseInsensitiveSubstringArrayIncludes(lineContent, ignoreTermsArr)
  if (matchFound) {
    logDebug('isLineDisallowedByIgnoreTerms', `- DID find excluding term(s) [${ignoreTermsArr.toString()}] in '${String(lineContent)}'`)
  }
  return matchFound
}

/**
 * Resolve which teamspaces this config should read notes from, discarding IDs that
 * no longer exist.
 *
 * Why this exists: `includedTeamspaces` is a plain list of IDs, and 'private' has to
 * appear in it for your own notes to be read at all. So a list holding only teamspace
 * IDs silently hides every private note -- which for most users is every note they
 * have. That is survivable while the IDs are real, because it is what you asked for.
 * It is not survivable when the IDs are stale: signing out of Spaces (or leaving them)
 * leaves a list that matches nothing, the Dashboard shows no tasks at all, and the
 * settings UI reports "You are not a member of any Spaces" so there is nothing to
 * click to undo it. Seen in the wild: 6 unreachable IDs, no 'private', zero tasks.
 *
 * When nothing in the list is reachable, the only sensible reading is private notes.
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Array<string>} teamspace IDs to allow, possibly healed to ['private']
 */
export function resolveAllowedTeamspaceIDs(dashboardSettings: TDashboardSettings): Array<string> {
  const configured = dashboardSettings.includedTeamspaces
  // Absent means "private only"; an explicitly empty list means "don't filter".
  // Both are long-standing behaviour, so leave them alone.
  if (!configured) return ['private']
  if (configured.length === 0) return configured

  let existingIDs: Array<string> = []
  try {
    existingIDs = getAllTeamspaceIDsAndTitles().map((t) => t.id)
  } catch (err) {
    // No teamspace API / not signed in: treat every configured ID as unreachable
    existingIDs = []
  }
  const reachable = configured.filter((id) => id === 'private' || existingIDs.includes(id))
  if (reachable.length > 0) return reachable

  logWarn(
    'resolveAllowedTeamspaceIDs',
    `includedTeamspaces lists ${String(configured.length)} teamspace(s) but none are reachable and 'private' is not among them, so no note could ever match. Falling back to private notes. Check the "Spaces to Include" setting; you may be signed out of Spaces.`,
  )
  return ['private']
}

/**
 * Check if a note is from an allowed teamspace based on dashboard settings.
 * If no teamspaces specified, allow all (backward compatibility).
 * @param {TNote} note - note to check
 * @param {Array<string>} allowedTeamspaceIDs - array of allowed teamspace IDs (and 'private' must be specified)
 * @returns {boolean} true if note is from an allowed teamspace
 */
export function isNoteFromAllowedTeamspace(note: TNote, allowedTeamspaceIDs: Array<string>): boolean {
  if (!allowedTeamspaceIDs || allowedTeamspaceIDs.length === 0) {
    // If no teamspaces specified, allow all (backward compatibility)
    return true
  }

  if (note.isTeamspaceNote && note.teamspaceID) {
    // Teamspace note - check if its ID is in the allowed list
    return allowedTeamspaceIDs.includes(note.teamspaceID)
  } else {
    // Private note - check if 'private' is in the allowed list
    return allowedTeamspaceIDs.includes('private')
  }
}

/**
 * Filter notes to only include those from allowed teamspaces based on dashboard settings.
 * @param {Array<TNote>} notes - notes to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing teamspace filters
 * @returns {Array<TNote>} filtered notes
 */
export function filterNotesByAllowedTeamspaces(
  notes: Array<TNote>,
  dashboardSettings: TDashboardSettings
): Array<TNote> {
  const allowedTeamspaceIDs = resolveAllowedTeamspaceIDs(dashboardSettings)
  return notes.filter((note) => isNoteFromAllowedTeamspace(note, allowedTeamspaceIDs))
}

/**
 * Filter paragraphs to only include those from relevant folders based on dashboard settings.
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing folder filters
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByRelevantFolders(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  const includedFolders = dashboardSettings.includedFolders ? stringListOrArrayToArray(dashboardSettings.includedFolders, ',').map((folder) => folder.trim()) : []
  const excludedFolders = dashboardSettings.excludedFolders ? stringListOrArrayToArray(dashboardSettings.excludedFolders, ',').map((folder) => folder.trim()) : []
  const validFolders = getFoldersMatching(includedFolders, true, excludedFolders)
  const filteredParas = paras.filter((p) => validFolders.includes(getFolderFromFilename(p.filename ?? '')))
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after validFolders filter`)
  return filteredParas
}

/**
 * Filter paragraphs to only include those from allowed teamspaces based on dashboard settings.
 * @param {$ReadOnlyArray<TParagraph>} paras - paragraphs to filter (read-only, so DataStore.listOverdueTasks() results can be passed directly)
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing teamspace filters
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByAllowedTeamspaces(
  paras: $ReadOnlyArray<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  const allowedTeamspaceIDs = resolveAllowedTeamspaceIDs(dashboardSettings)
  const filteredParas = paras.filter((p) => {
    const note = getNoteFromPara(p)
    if (!note) {
      // If we can't determine the note, exclude it to be safe
      return false
    }
    return isNoteFromAllowedTeamspace(note, allowedTeamspaceIDs)
  })
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after allowedTeamspaces filter`)
  return filteredParas
}

/**
 * Filter paragraphs to exclude those containing terms from ignoreItemsWithTerms setting.
 * @tests in jest file
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
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after ignoreItemsWithTerms (${dashboardSettings.ignoreItemsWithTerms}) filter`)
  return filteredParas
}

/**
 * Filter paragraphs to only include those matching included calendar note terms.
 * Applies only to calendar notes (project notes always pass through).
 * A calendar task is kept if either:
 * - any heading in its hierarchy matches a term as a case-insensitive prefix, or
 * - its content contains a term as a case-insensitive substring (so `#acme`, `@acme`, or `acme` all work).
 * Blank / unset setting keeps all paragraphs.
 * @tests in jest file
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing included calendar sections/terms
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByIncludedCalendarSections(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  if (!dashboardSettings.includedCalendarSections) {
    return paras
  }
  const includedCalendarSections = stringListOrArrayToArray(dashboardSettings.includedCalendarSections, ',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (includedCalendarSections.length === 0) {
    return paras
  }

  // TEST: this is where TB defeat happens for headings
  const filteredParas = paras.filter((p) => {
    // only apply to calendar notes
    if (p.note?.type !== 'Calendar') return true

    // Keep if task content contains any of the filter terms (e.g. #acme, @acme, or acme)
    const contentLower = (p.content || '').toLowerCase()
    if (includedCalendarSections.some((inc) => contentLower.includes(inc.toLowerCase()))) {
      return true
    }

    // Or if any heading in the hierarchy matches as a case-insensitive prefix
    const theseHeadings = getHeadingHierarchyForThisPara(p)
    return theseHeadings.some((h) =>
      includedCalendarSections.some((inc) => caseInsensitiveStartsWith(inc, h.trim(), false))
    )
  })
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after includedCalendarSections filter`)
  return filteredParas
}

/**
 * Filter paragraphs to exclude those with disallowed terms in Calendar note section headings.
 * @tests in jest file
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing ignore terms
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByExcludedCalendarSections(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  if (!dashboardSettings.ignoreItemsWithTerms || !dashboardSettings.applyIgnoreTermsToCalendarHeadingSections) {
    return paras
  }
  const thisNote = paras[0]?.note
  // TEST: Does this work for Teamspace notes? Teamspace notes are reported as 'unknown' here
  logDebug('filterParasByExcludedCalendarSections', `Starting for note ${thisNote?.filename ?? '(unknown)'}`)

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
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after filtering out calendar headings`)
  return filteredParas
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
        const startTimeStr = normalizeTimeBlockStartToHHMM(thisTimeStr.split(/[-–~]/)[0])
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
 * Set startTime and optional endTime on a dashboard para from its content timeblock.
 * Used by demo-data paths that do not go through makeDashboardParas.
 * @param {TParagraphForDashboard} para
 * @returns {void}
 */
export function setTimeFieldsOnDashboardPara(para: TParagraphForDashboard): void {
  // Casts: the helpers take an exact `{ content: string }`, so a wider TParagraphForDashboard is
  // rejected on exactness alone even though only `content` is read.
  para.startTime = getStartTimeFromPara((para: any))
  const endTime = getEndTimeFromPara((para: any))
  if (endTime) {
    para.endTime = endTime
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
 * Validate/flatten MessageDataObject for a bridge click handler.
 * On failure returns a failure result the caller should return immediately
 * (avoids operating on sentinel filenames after validation errors).
 * @param {MessageDataObject} data
 * @param {string} logPrefix - function name for logging
 * @param {Array<TSectionCode>=} fallbackSectionCodes - section codes to refresh when item.sectionCode is missing (e.g. project handlers)
 * @returns {{ ok: true, data: ValidatedData } | { ok: false, result: TBridgeClickHandlerResult }}
 */
export function validateMessageDataForHandler(
  data: MessageDataObject,
  logPrefix: string,
  fallbackSectionCodes?: Array<TSectionCode>,
): { ok: true, data: ValidatedData } | { ok: false, result: TBridgeClickHandlerResult } {
  try {
    return { ok: true, data: validateAndFlattenMessageObject(data) }
  } catch (error) {
    logError(logPrefix, `Validation failed: ${error.message}`)
    const sectionCode = data?.item?.sectionCode
    const sectionCodes: Array<TSectionCode> | void = sectionCode
      ? [sectionCode]
      : fallbackSectionCodes && fallbackSectionCodes.length > 0
        ? fallbackSectionCodes
        : undefined
    return {
      ok: false,
      result: handlerResult(false, sectionCodes ? ['REFRESH_SECTION_IN_JSON'] : [], {
        sectionCodes,
        errorMsg: `Couldn't process this item (${error.message}).`,
        errorMessageLevel: 'ERROR',
      }),
    }
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
  if (!reactWindowData) {
    logDebug('setPluginData', 'Dashboard shared data not ready yet; skipping update')
    return
  }
  reactWindowData.pluginData = { ...(reactWindowData.pluginData || {}), ...changeObject }

  // Write synchronously so plugin-side getGlobalSharedData() (e.g. processActionOnReturn right after save)
  // sees perspectiveSettings / isModified before React finishes handling postMessage UPDATE_DATA.
  await updateGlobalSharedData(WEBVIEW_WINDOW_ID, reactWindowData, false)

  logDebug('setPluginData', `Sending changeMessage: "${changeMessage}"`)
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
 * @param {string} sectionCode - The section code of the sectionItem.
 * @param {TParagraph | TParagraphForDashboard} p - The paragraph data for the sectionItem.
 * @param {string?} theType - The type of the sectionItem (if not given, will use the para's type)
 * @returns {SectionItem} A sectionItem object.
 */
export function createSectionItemObject(
  id: string,
  sectionCode: string,
  p: TParagraph | TParagraphForDashboard,
  theType?: TItemType
): TSectionItem {
  try {
    if (!p) {
      throw new Error(`In ID ${id}, para is null`)
    } else if (!p.filename || !p.type) {
      throw new Error(`In ID ${id}, para is missing filename or type`)
    }
    const itemObj = {
      ID: id,
      sectionCode: sectionCode,
      itemType: theType ?? p.type,
      para: p,
      teamspaceTitle: '',
    }
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
    return { ID: id, sectionCode: sectionCode ?? '', itemType: theType ?? p.type ?? 'error', para: p }
  }
}

/**
 * Make a sectionItem for each open item (para) of interest.
 * Note: sometimes non-open items are included, e.g. other types of timeblocks. They need to be filtered out first.
 * @param {Array<TParagraphForDashboard>} sortedOrCombinedParas
 * @param {string} sectionCode - The section code to use for item IDs and sectionCode field (e.g., 'DT', 'M', 'TAG-0')
 * @returns {Array<TSectionItem>}
 */
export function createSectionItemsFromParas(sortedOrCombinedParas: Array<TParagraphForDashboard>, sectionCode: string): Array<TSectionItem> {
  let itemCounter = 0
  let lastIndent0ParentID = ''
  let lastIndent1ParentID = ''
  let lastIndent2ParentID = ''
  let lastIndent3ParentID = ''
  const items: Array<TSectionItem> = []
  
  for (const socp of sortedOrCombinedParas) {
    const thisID = `${sectionCode}-${itemCounter}`
    // For title paragraphs with timeblocks, set itemType to 'timeblock' for consistent display
    const itemType = ['title', 'list'].includes(socp.type) ? 'timeblock' : undefined
    const thisSectionItemObject = createSectionItemObject(thisID, sectionCode, socp, itemType)
    
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

/**
 * Copies specified fields from a provided object into the corresponding sectionItems in the sections array.
 *
 * @param {Array<SectionItemIndex>} results - An array of results from the findSectionItems function, containing section and item indices.
 * @param {Array<string>} fieldPathsToReplace - An array of field paths (maybe nested) within TSectionItem (e.g. ['itemType', 'para.filename']) to copy from the provided object.
 * @param {Object} updatedValues - The object containing the field values to be copied -- the keys are the field paths (can be strings with dots, e.g. para.filename) and the values are the values to copy.
 * @param {Array<TSection>} sections - The original sections array to be modified.
 * @returns {Array<TSection>} The modified sections array with the specified fields copied into the corresponding sectionItems.
 */
export function copyUpdatedSectionItemData(
  results: Array<{ sectionIndex: number, itemIndex: number }>,
  fieldPathsToReplace: Array<string>,
  updatedValues: { [key: string]: any },
  sections: Array<TSection>,
): Array<TSection> {
  results.forEach(({ sectionIndex, itemIndex }) => {
    const sectionItem = sections[sectionIndex].sectionItems[itemIndex]

    fieldPathsToReplace.forEach((fieldPath) => {
      // const [firstField, ...remainingPath] = fieldPath.split('.')
      const value = getNestedValue(updatedValues, fieldPath)
      if (value !== undefined) {
        setNestedValue(sectionItem, fieldPath, value)
      }
    })
    sectionItem.updated = true
  })

  return sections
}

/**
 * Test whether a TSectionItem should be treated as a Win based on the configured `winsPriorityMarker`.
 * The three user-facing markers map 1:1 to NotePlan's `paragraph.priority` values, so the check is
 * purely numeric:
 *  - `'>>'`  -> priority === 4
 *  - `'!!!'` -> priority === 3
 *  - `'!!'`  -> priority === 2
 * Falls back to the `>>` rule (priority 4) when the marker is missing or unrecognised.
 * @param {TSectionItem} item
 * @param {string} winsPriorityMarker - one of '>>', '!!!', '!!'
 * @returns {boolean}
 */
export function isWinItem(item: TSectionItem, winsPriorityMarker: string): boolean {
  const priority = item.para?.priority ?? 0
  switch (winsPriorityMarker) {
    case '!!!':
      return priority === 3
    case '!!':
      return priority === 2
    case '>>':
    default:
      return priority === 4
  }
}
