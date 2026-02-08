// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 2026-02-08 for v2.4.0.b20, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID, allSectionDetails } from './constants'
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
import { getNestedValue, setNestedValue, stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getTimeStringFromHM, getTodaysDateHyphenated, includesScheduledFutureDate } from '@helpers/dateTime'
import { clo, clof, clvt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFoldersMatching, getFolderFromFilename } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { sendToHTMLWindow, getGlobalSharedData } from '@helpers/HTMLView'
import { isNoteFromAllowedFolder } from '@helpers/note'
import { saveSettings } from '@helpers/NPConfiguration'
import { getDueDateOrStartOfCalendarDate } from '@helpers/NPdateTime'
import { getFrontmatterAttributes } from '@helpers/NPFrontMatter'
import { getNoteFromFilename, getReferencedParagraphs } from '@helpers/NPnote'
import { usersVersionHas } from '@helpers/NPVersions'
import { isAChildPara } from '@helpers/parentsAndChildren'
import { caseInsensitiveSubstringArrayIncludes } from '@helpers/search'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { eliminateDuplicateParagraphs } from '@helpers/syncedCopies'
import { getAllTeamspaceIDsAndTitles, getTeamspaceTitleFromNote } from '@helpers/NPTeamspace'
import { getStartTimeObjFromParaContent, getTimeBlockString, isActiveOrFutureTimeBlockPara } from '@helpers/timeblocks'
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
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(pluginSettings, `getDashboardSettings (older lookup): pluginSettings loaded from settings.json`)
    // }
    if (!pluginSettings.dashboardSettings) {
      clo(pluginSettings,
        `getDashboardSettings (older lookup): dashboardSettings not found this way either; should be there by default. here's the full settings for ${
          pluginSettings.pluginID || ''
        } plugin: `)
    }

    let parsedDashboardSettings: any = parseSettings(pluginSettings.dashboardSettings)

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
      const defaults = getDashboardSettingsDefaults()
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

    // $FlowFixMe[prop-missing] showSearchSection is included in defaults and merged above
    return parsedDashboardSettings
  } catch (err) {
    logError('getDashboardSettings', `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return]
    return
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
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    pluginSettings.dashboardSettings = settings

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

  // Add section show settings from allSectionDetails
  // Most sections default to true, except INFO which defaults to false,
  // and TAG sections are handled specially (one for each tag a user wants to see).
  const sectionDefaults = allSectionDetails.reduce((acc, section) => {
    if (section.showSettingName && section.showSettingName !== '') {
      // $FlowIgnore[prop-missing]
      acc[section.showSettingName] = section.sectionCode !== 'INFO'
    }
    return acc
  }, {})

  // Add showSearchSection (SEARCH section doesn't have showSettingName in allSectionDetails)
  // $FlowIgnore[prop-missing]
  sectionDefaults.showSearchSection = true

  // clo(dashboardSettingsDefaults, `dashboardSettingsDefaults:`)
  // $FlowIgnore[prop-missing]
  // $FlowIgnore[cannot-spread-indexer]
  return { ...dashboardSettingsDefaults, ...sectionDefaults }
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
// Helper functions for these main functions
// Note: some of these are exported, but only to allow jest testing
//-----------------------------------------------------------------

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
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string)
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
  if (parasToUse.some((para) => para.content.includes('TEST'))) {
    const testParas = parasToUse.filter((p) => p.content.includes('TEST'))
    console.log(`getParagraphsFromCalendarNotes: FYI 👉 found TEST in paragraph(s):\n${JSP(testParas, 2)}`)
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
  const theNoteDateHyphenated = NPCalendarFilenameStr
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
  const theNoteDateHyphenated = NPCalendarFilenameStr
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
  openParas = filterParasByCalendarHeadingSections(openParas, dashboardSettings, startTime, 'filterOpenParagraphs')

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
  logDebug('getReferencedOpenParagraphs', `- getting referenced paras for ${note.filename}`)
  refOpenParas = alsoReturnTimeblockLines
    ? getReferencedParagraphs(note, false).filter((p) => isOpen(p) || isActiveOrFutureTimeBlockPara(p, mustContainString))
    : getReferencedParagraphs(note, false).filter((p) => isOpen(p))
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
    console.log(`getReferencedOpenParagraphs: FYI 👉 found TEST in paragraph(s):\n${JSP(testParas, 2)}`)
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
 * @param {string} NPCalendarFilenameStr - Calendar note filename (date string)
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
    const allowedTeamspaceIDs = dashboardSettings.includedTeamspaces ?? ['private']
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
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many).
 * Note: can range from 7-70ms/para in JGC tests.
 *
 * @param {Array<TParagraph>} origParas
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>, checkForPriorityDelta: boolean = true): Array<TParagraphForDashboard> {
  try {
    const timer = new Date()

    const dashboardParas: Array<TParagraphForDashboard> = origParas.reduce((acc: Array<TParagraphForDashboard>, p: TParagraph) => {
      if (!p) {
        throw new Error(`p is undefined`)
      }
      const note = p.note

      // Set default priorityDelta to 0
      let priorityDelta = 0
      if (note) {
        // Note: seems to be a quick operation (1ms), but leaving a timer for now to indicate if >10ms
        // Changed: Check if p.children exists before calling
        // $FlowIgnore[method-unbinding]
        const anyChildren = (typeof p.children === 'function' && p.children != null) ? (p.children() ?? []) : []
        const hasChild = anyChildren.length > 0
        const isAChild = isAChildPara(p, note)

        // Note: debugging why sometimes hasChild is wrong
        // TODO(later): remove this debugging
        if (hasChild) {
          const pp = note.paragraphs || []
          const nextLineIndex = p.lineIndex + 1
          clo(
            p,
            `FYI 👉 makeDashboardParas: found indented children for ${p.lineIndex} "${p.content}" (indents:${p.indents}) in "${note.filename}" paras[p.lineIndex+1]= {${pp[nextLineIndex]?.type
            }} (${pp[nextLineIndex]?.indents || ''} indents), content: "${pp[nextLineIndex]?.content}".`,
          )
          // clo(p.contentRange, `contentRange for paragraph`)
          clof(anyChildren, `Children of paragraph`, ['lineIndex', 'indents', 'content'])
          // clo(anyChildren[0].contentRange, `contentRange for child[0]`)

        }
        if (checkForPriorityDelta) {
          priorityDelta = getPriorityDeltaFromNote(note)
        }

        // Note: debugging why sometimes indents is wrong - often 0 not 1
        // TODO(later): remove this debugging
        if (p.indents === 0 && (p.rawContent.startsWith(' ') || p.rawContent.startsWith('\t'))) {
          logWarn('makeDashboardParas', `FYI 👉 for line ${p.lineIndex} found indents:0 rawContent: {${p.rawContent}}`)
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
        // Get title, but don't add the 👥 icon and teamspace name for Teamspace notes. Fallback is to use the note.title, which will be ISO-8601 date for Calendar notes.
        const noteTitle = note.type === 'Notes' ? displayTitle(note, false) : note.title
        const outputPara: TParagraphForDashboard = {
          filename: p?.filename ?? '',
          noteType: p?.noteType ?? note?.type ?? 'Notes',
          title: noteTitle,
          type: p.type,
          prefix: p.rawContent.replace(p.content, ''),
          content: p.content,
          rawContent: p.rawContent,
          indents: p.indents, // TEST: not returning correct indents at times? Certainly lands up being 0 when it should be 1.
          lineIndex: p.lineIndex,
          priority: getNumericPriorityFromPara(p) + priorityDelta,
          startTime: startTimeStr,
          changedDate: note?.changedDate,
          hasChild: hasChild,
          isAChild: isAChild,
          dueDate: dueDateStr,
          isTeamspace: note.isTeamspaceNote,
          icon: noteIcon,
          iconColor: noteIconColor,
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
  const allowedTeamspaceIDs = dashboardSettings.includedTeamspaces ?? ['private']
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
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing teamspace filters
 * @param {Date} startTime - timer start time for logging
 * @param {string} functionName - name of calling function for logging
 * @returns {Array<TParagraph>} filtered paragraphs
 */
export function filterParasByAllowedTeamspaces(
  paras: Array<TParagraph>,
  dashboardSettings: TDashboardSettings,
  startTime: Date,
  functionName: string
): Array<TParagraph> {
  const allowedTeamspaceIDs = dashboardSettings.includedTeamspaces ?? ['private']
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
 * Filter paragraphs to only include those from included calendar sections. It uses an exact match on headings, not partial matches.
 * @tests in jest file
 * @param {Array<TParagraph>} paras - paragraphs to filter
 * @param {TDashboardSettings} dashboardSettings - dashboard settings containing included calendar sections
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

  // TEST: this is where TB defeat happens for headings
  const filteredParas = paras.filter((p) => {
    // only apply to calendar notes
    if (p.note?.type !== 'Calendar') return true
    // Apply to all H4/H3/H2 headings in the hierarchy for this para
    const theseHeadings = getHeadingHierarchyForThisPara(p)
    return theseHeadings.some((h) => includedCalendarSections.includes(h))
  })
  logTimer(functionName, startTime, `- ${filteredParas.length} paras after filtering out calendar headings`)
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
export function filterParasByCalendarHeadingSections(
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
  logDebug('filterParasByCalendarHeadingSections', `Starting for note ${thisNote?.filename ?? '(unknown)'}`)

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
        let startTimeStr = thisTimeStr.split('-')[0]
        if (startTimeStr.length > 0 && startTimeStr.length < 2) {
          // Handle single digit hour (e.g., "9:00")
          startTimeStr = `0${startTimeStr}`
        } else if (startTimeStr.length > 1 && startTimeStr[1] === ':') {
          startTimeStr = `0${startTimeStr}`
        }
        if (startTimeStr.endsWith('AM')) {
          startTimeStr = startTimeStr.slice(0, 5)
        }
        if (startTimeStr.endsWith('PM')) {
          const hour = Number(startTimeStr.slice(0, 2))
          // 12:00 PM should stay as 12:00, not become 24:00
          const adjustedHour = hour === 12 ? 12 : hour + 12
          startTimeStr = String(adjustedHour).padStart(2, '0') + startTimeStr.slice(2, 5)
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
      if (startTimeStr.length > 0 && startTimeStr.length < 2) {
        // Handle single digit hour (e.g., "9:00")
        startTimeStr = `0${startTimeStr}`
      } else if (startTimeStr.length > 1 && startTimeStr[1] === ':') {
        startTimeStr = `0${startTimeStr}`
      }
      if (startTimeStr.endsWith('AM')) {
        startTimeStr = startTimeStr.slice(0, 5)
      }
      if (startTimeStr.endsWith('PM')) {
        const hour = Number(startTimeStr.slice(0, 2))
        // 12:00 PM should stay as 12:00, not become 24:00
        const adjustedHour = hour === 12 ? 12 : hour + 12
        startTimeStr = String(adjustedHour).padStart(2, '0') + startTimeStr.slice(2, 5)
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
  
  logInfo('setPluginData', `Sending changeMessage: "${changeMessage}"`)
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
