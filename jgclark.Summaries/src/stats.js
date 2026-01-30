/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 2026-01-30 for v1.0.3 by @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import type { SummariesConfig } from './settings'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesToLookFor,
  type TMOccurrences,
} from './summaryHelpers'
import { RE_DATE } from '@helpers/dateTime'
import { validateDateRangeAndConvertToISODateStrings } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, timer } from '@helpers/dev'
import { createPrettyRunPluginLink } from '@helpers/general'
import { replaceSection, setIconForNote } from '@helpers/note'
import { getPeriodStartEndDates, getPeriodStartEndDatesFromPeriodCode } from '@helpers/NPdateTime'
import type { TPeriodCode } from '@helpers/NPdateTime'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { usersVersionHas } from '@helpers/NPVersions'
import { noteOpenInEditor, openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
import { chooseDecoratedOptionWithModifiers, chooseOption, showMessage } from '@helpers/userInput'

//-------------------------------------------------------------------------------
// Main function

/**
 * There are 2 ways to invoke statsPeriod:
 * 1. "/statsPeriod" command -- uses settings, and writes to current note
 * 2. callback to statsPeriod&arg0=... -- can give params to override settings if wanted; writes to current note
 */

/**
 * Ask user which period to cover, call main stats function accordingly, and present results.
 * Generates statistics for hashtags and mentions over a specified time period.
 * @author @jgclark
 * @param {TPeriodCode|''} periodCodeArg - Period code: 'all' | 'week' | 'month' | 'quarter' | 'year' | 'today' | YYYY-MM-DD. If empty, user will be asked.
 * @param {number} periodNumberArg - Period number within the calendar type (e.g., week 5, month 12). Defaults to NaN.
 * @param {number} yearArg - Year number (e.g., 2025). Defaults to NaN.
 * @param {string} specificGOSettingsStr - Optional JSON string containing settings to override default GOSettings
 * @returns {Promise<void>}
 * @throws {Error} If period calculation fails, date range is invalid, or output operations fail
 */
export async function statsPeriod(
  periodCodeArg: TPeriodCode | '' = '',
  periodNumberArg: number = NaN,
  yearArg: number = NaN,
  specificGOSettingsStr: string = '' // JSON string
): Promise<void> {
  try {
    // Get config from settings
    const config = await getSummariesSettings()

    // 1. Validate parameters and calculate period
    logDebug(pluginJson, `statsPeriod: starting with params '${periodCodeArg}', '${periodNumberArg}', '${yearArg}'`)
    const periodData = await validateAndCalculatePeriod(periodCodeArg, periodNumberArg, yearArg, config)

    // 2. Gather statistics data
    const statsData: Array<TMOccurrences> = await gatherStatsData(periodData.periodString, periodData.fromDateStr, periodData.toDateStr, config, specificGOSettingsStr)

    // 3. Generate output
    const output: string = await generateStatsOutput(statsData, periodData.periodString, periodData.fromDateStr, periodData.toDateStr, config)

    // 4. Determine output destination
    const destination = await selectOutputDestination(periodData.isRunningFromXCallback, config, periodData.calendarTimeframe, periodData.periodString)

    // 5. Handle output
    await handleOutputDestination(destination, output, periodData, config, specificGOSettingsStr)

  } catch (error) {
    const errorMsg = `Failed to generate period stats: ${error.message}`
    logError('statsPeriod', errorMsg)
    await showMessage(errorMsg)
  }
}

//-----------------------------------------------------------------------------
// Helper functions for statsPeriod refactoring

/**
 * Validates parameters and calculates period data
 * @param {TPeriodCode|''} periodCodeArg - Period code: 'week' | 'month' | 'quarter' | 'year' | 'YYYY-MM-DD' | 'all' | 'today'
 * @param {number} periodNumberArg - Period number within calendar type (ignored for 'all', 'today', YYYY-MM-DD)
 * @param {number} yearArg - Year number (ignored for 'all', 'today', YYYY-MM-DD)
 * @param {any} config - Configuration object
 * @returns {Promise<any>} Period data object with dates, strings, and metadata
 * @throws {Error} If date calculation fails or date range is invalid
 */
async function validateAndCalculatePeriod(
  periodCodeArg: TPeriodCode | '',
  periodNumberArg: number,
  yearArg: number,
  config: any
): Promise<any> {
  let fromDate, toDate, periodString, periodShortCode, periodAndPartStr = ''
  let periodNumber = periodNumberArg
  let year = yearArg
  let calendarTimeframe = ''

  let isRunningFromXCallback = false
  if (periodCodeArg && periodCodeArg !== '' && ((!isNaN(yearArg) && !isNaN(periodNumberArg)) || periodCodeArg === 'today' || periodCodeArg === 'all' || new RegExp(`^${RE_DATE}$`).test(periodCodeArg))) {
    isRunningFromXCallback = true
    logInfo('statsPeriod/validateAndCalculatePeriod', `running from xCallback with params '${periodCodeArg}', '${periodNumberArg}', '${yearArg}'`)
    periodShortCode = periodCodeArg
  }

  // Get time period of interest ...
  if (isRunningFromXCallback) {
    // from periodCodeArg/periodShortCode (arg0)
    // Note: periodShortCode can be week | month | quarter | year | YYYY-MM-DD | all
    // $FlowIgnore[incompatible-call]
    [fromDate, toDate, periodShortCode, periodString, periodAndPartStr] = getPeriodStartEndDatesFromPeriodCode(periodShortCode, periodNumber, year, config.excludeToday) // note no await
  } else {
    // or by asking user
    [fromDate, toDate, periodShortCode, periodString, periodAndPartStr, periodNumber] = await getPeriodStartEndDates('Create stats for which period?', config.excludeToday) // note await needed
    year = fromDate.getFullYear()

    // TODO: Sort out the two different sets of constants/type here for periodShortCode
    calendarTimeframe =
      (periodShortCode === 'userwtd' || periodShortCode === 'wtd' || periodShortCode === 'lw' || periodShortCode === 'ow') ? 'week'
        : (periodShortCode === 'mtd' || periodShortCode === 'lm' || periodShortCode === 'om') ? 'month'
          : (periodShortCode === 'qtd' || periodShortCode === 'lq' || periodShortCode === 'oq') ? 'quarter'
            : (periodShortCode === 'ytd' || periodShortCode === 'ly' || periodShortCode === 'oy') ? 'year'
              : 'other'
    periodShortCode = calendarTimeframe
  }

  // Validate date range
  const { fromDateStr, toDateStr } = validateDateRangeAndConvertToISODateStrings(fromDate, toDate, 'period stats')
  logInfo(pluginJson, `statsPeriod: starting with ${periodCodeArg} for ${periodString} (${fromDateStr} - ${toDateStr})`)

  return {
    fromDate,
    toDate,
    fromDateStr,
    toDateStr,
    periodString,
    periodShortCode,
    periodAndPartStr,
    periodNumber,
    year,
    calendarTimeframe,
    isRunningFromXCallback
  }
}

/**
 * Determines callback parameters for refresh functionality
 * Creates a refresh button link with appropriate parameters
 * @param {string} periodShortCode - Short period code (e.g., 'week', 'month')
 * @param {number} periodNumber - Period number within calendar type
 * @param {number} year - Year number
 * @param {string} overrideGOSettingsStr - Optional JSON string containing settings to override in settingsForGO
 * @returns {string} Callback markdown string for refresh button
 */
function determineCallbackParameters(periodShortCode: string, periodNumber: number, year: number, overrideGOSettingsStr: string): string {
  let xCallbackMD = ''
  const yearStr = String(year)
  const periodNumberStr = String(periodNumber)
  logDebug('periodStats', `Forming refresh callback with params ${periodShortCode}, ${periodNumberStr}, ${yearStr}`)
  xCallbackMD = (overrideGOSettingsStr !== '')
    ? createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'periodStats', [periodShortCode, periodNumberStr, yearStr, overrideGOSettingsStr])
    : createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'periodStats', [periodShortCode, periodNumberStr, yearStr])
  return xCallbackMD
}

/**
 * Gathers statistics data for the specified period
 * Collects occurrences of hashtags and mentions from calendar notes
 * @param {string} periodString - Human-readable period string (e.g., "January 2025")
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {SummariesConfig} config - Configuration object with settings
 * @param {string} overrideGOSettingsStr - Optional JSON string containing settings to override default GOSettings
 * @returns {Promise<Array<TMOccurrences>>} Array of TMOccurrences objects containing statistics
 */
async function gatherStatsData(
  periodString: string,
  fromDateStr: string,
  toDateStr: string,
  config: SummariesConfig,
  overrideGOSettingsStr: string
): Promise<Array<TMOccurrences>> {
  const startTime = new Date()
  CommandBar.showLoading(true, `Gathering Data from Calendar notes`)
  await CommandBar.onAsyncThread()

  // Main work: calculate the occurrences, using config settings and the time period info
  let settingsForGO: OccurrencesToLookFor
  if (overrideGOSettingsStr === '') {
    settingsForGO = {
      GOYesNo: config.PSYesNo,
      GOHashtagsCount: config.PSHashtagsCount,
      GOHashtagsAverage: config.PSHashtagsAverage,
      GOHashtagsTotal: config.PSHashtagsTotal,
      GOMentionsCount: config.PSMentionsCount,
      GOMentionsAverage: config.PSMentionsAverage,
      GOMentionsTotal: config.PSMentionsTotal,
      GOChecklistRefNote: config.progressChecklistReferenceNote,
    }
  } else {
    const overrideSettings = JSON.parse(overrideGOSettingsStr)
    settingsForGO = {
      GOYesNo: overrideSettings.PSYesNo ?? [],
      GOHashtagsCount: overrideSettings.PSHashtagsCount ?? [],
      GOHashtagsAverage: overrideSettings.PSHashtagsAverage ?? [],
      GOHashtagsTotal: overrideSettings.PSHashtagsTotal ?? [],
      GOMentionsCount: overrideSettings.PSMentionsCount ?? [],
      GOMentionsAverage: overrideSettings.PSMentionsAverage ?? [],
      GOMentionsTotal: overrideSettings.PSMentionsTotal ?? [],
      GOChecklistRefNote: overrideSettings.progressChecklistReferenceNote ?? '',
    }
  }
  const tmOccurrencesArray: Array<TMOccurrences> = await gatherOccurrences(periodString,
    fromDateStr,
    toDateStr,
    settingsForGO)
  logInfo('statsPeriod', `Gathered all occurrences in ${timer(startTime)}`)

  return tmOccurrencesArray
}

/**
 * Generates the final statistics output in markdown format
 * @param {Array<TMOccurrences>} tmOccurrencesArray - Array of occurrence objects
 * @param {string} periodString - Human-readable period string
 * @param {string} fromDateStr - Start date in YYYY-MM-DD format
 * @param {string} toDateStr - End date in YYYY-MM-DD format
 * @param {SummariesConfig} config - Configuration object
 * @returns {Promise<string>} Generated markdown output string
 */
async function generateStatsOutput(
  tmOccurrencesArray: Array<TMOccurrences>,
  periodString: string,
  fromDateStr: string,
  toDateStr: string,
  config: SummariesConfig
): Promise<string> {
  CommandBar.showLoading(true, `Creating Period Stats`)
  const startTime = new Date()
  const output = (await generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.PSShowSparklines, true)).join('\n')
  CommandBar.showLoading(false)
  await CommandBar.onMainThread()
  logInfo('statsPeriod', `Created period stats in ${timer(startTime)}`)
  return output
}

/**
 * Selects output destination based on context and user choice
 * Prompts user to choose where to save statistics if not running from callback
 * @param {boolean} isRunningFromXCallback - Whether running from x-callback (auto-selects 'current')
 * @param {SummariesConfig} config - Configuration object
 * @param {string} calendarTimeframe - Calendar timeframe ('week', 'month', 'quarter', 'year', 'other')
 * @param {string} periodString - Human-readable period string for display
 * @returns {Promise<string>} Selected destination: 'calendar' | 'current' | 'note' | 'log' | 'cancel'
 */
async function selectOutputDestination(
  isRunningFromXCallback: boolean,
  config: SummariesConfig,
  calendarTimeframe: string,
  periodString: string
): Promise<string> {
  if (isRunningFromXCallback) {
    return 'current'
  }
  let result = ''
  if (usersVersionHas('decoratedCommandBar')) {
    // Start by tailoring the set of options to present
    const decoratedOutputOptions: Array<TCommandBarOptionObject> = [
      { text: `Add/Update the ${calendarTimeframe}ly calendar note '${periodString}'`, icon: 'calendar-days', color: 'gray-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
      { text: 'Update/append to the open note', icon: 'pen-to-square', color: 'gray-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
      { text: 'Write to plugin console log', icon: 'terminal', color: 'gray-500', shortDescription: ``, alpha: 0.6, darkAlpha: 0.6 },
      { text: 'Cancel', icon: 'cancel', color: 'red-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
    ]
    const optionValues = ['calendar', 'current', 'log', 'cancel']
    if ((config.folderToStore ?? '') !== '') {
      decoratedOutputOptions.unshift({ text: `Create/update a note in folder '${config.folderToStore}'`, icon: 'file-import', color: 'gray-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 })
      optionValues.unshift('note')
    }
    // Note: if there was a chooseDecoratedOption() we'd use that instead
    const chosenOption = await chooseDecoratedOptionWithModifiers(`Where to save the summary for ${periodString}?`, decoratedOutputOptions)
    result = optionValues[chosenOption.index]
  }
  else {
    // Start by tailoring the set of options to present
    const simpleOutputOptions: Array<{ label: string, value: string }> = [
      { label: `📅 Add/Update the ${calendarTimeframe}ly calendar note '${periodString}'`, value: 'calendar' },
      { label: '🖊 Update/append to the open note', value: 'current' },
      { label: '📋 Write to plugin console log', value: 'log' },
      { label: '❌ Cancel', value: 'cancel' },
    ]
    if ((config.folderToStore ?? '') !== '') {
      simpleOutputOptions.unshift({ label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' })
    }
    const chosenOption = await chooseOption(`Where to save the summary for ${periodString}?`, simpleOutputOptions, 'note')
    result = chosenOption
  }
  logDebug('statsPeriod', `selectOutputDestination() -> ${result}`)
  return result
}

/**
 * Handles output to current note
 * @param {string} output - Output content
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} xCallbackMD - Callback markdown
 * @param {SummariesConfig} config - Configuration object
 */
function handleCurrentNoteOutput(
  output: string,
  periodAndPartStr: string,
  xCallbackMD: string,
  config: SummariesConfig
): void {
  const currentNote = Editor.note
  if (currentNote == null) {
    logError('statsPeriod', `Cannot write period stats: no note is currently open in the Editor. Please open a note and try again.`)
  } else {
    // Replace or add output section
    replaceSection(currentNote, config.PSStatsHeading, `${config.PSStatsHeading} ${periodAndPartStr} ${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Updated results in note section '${config.PSStatsHeading}' for ${periodAndPartStr}`)

    // Add icon to note, if a regular note
    if (currentNote.type === 'Notes') {
      setIconForNote(currentNote, "square-poll-horizontal")
    }
  }
}

/**
 * Handles output to a new (regular) note
 * @param {string} output - Output content
 * @param {string} periodString - Period string
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} xCallbackMD - Callback markdown
 * @param {SummariesConfig} config - Configuration object
 * @throws {Error} If note cannot be created or retrieved
 */
async function handleNoteOutput(
  output: string,
  periodString: string,
  periodAndPartStr: string,
  xCallbackMD: string,
  config: SummariesConfig
): Promise<void> {
  // Summaries note
  const note = await getOrMakeRegularNoteInFolder(periodString, config.folderToStore)
  if (note == null) {
    const errorMsg = `Cannot create or retrieve note '${periodString}' in folder '${config.folderToStore ?? 'default'}'. Please check folder permissions and try again.`
    logError('statsPeriod', errorMsg)
    await showMessage(errorMsg)
    throw new Error(errorMsg)
  } else {
    // Replace or add output section
    replaceSection(note, config.PSStatsHeading, `${config.PSStatsHeading} ${periodAndPartStr} ${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Written results to note '${periodString}'`)
    // Add icon to note
    setIconForNote(note, "square-poll-horizontal")

    // Open the results note in a new split window, unless we already have this note open
    const _res = await openNoteInNewSplitIfNeeded(note.filename)
  }
}

/**
 * Handles output to calendar note
 * @param {string} output - Output content
 * @param {string} periodString - Period string
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} xCallbackMD - Callback markdown
 * @param {any} config - Configuration object
 * @param {Date} fromDate - From date
 * @param {string} periodShortCode - Period short code
 * @param {string} calendarTimeframe - Calendar timeframe
 * @throws {Error} If calendar note cannot be retrieved or opened
 */
async function handleCalendarOutput(
  output: string,
  periodString: string,
  periodAndPartStr: string,
  xCallbackMD: string,
  config: any,
  fromDate: Date,
  periodShortCode: string,
  calendarTimeframe: string
): Promise<void> {
// Weekly note (from v3.6) and Monthly / Quarterly / Yearly (from v3.7.2)
  const calNoteAtFromDate = DataStore.calendarNoteByDate(fromDate, periodShortCode)
  if (calNoteAtFromDate == null) {
    throw new Error(`Cannot retrieve calendar note for ${periodString} (${calendarTimeframe} starting ${fromDate.toISOString()}). Please check your calendar settings.`)
  }
  let note: TNote = calNoteAtFromDate
  let filenameForCalDate = note.filename
  if (!noteOpenInEditor(filenameForCalDate)) {
    logDebug('statsPeriod', `- opening ${calendarTimeframe} note ${filenameForCalDate ?? '<error>'}`)
    const res = await Editor.openNoteByDate(fromDate, false, 0, 0, true, calendarTimeframe)
    if (res) {
      note = res
      filenameForCalDate = note.filename
    }
  } else {
    logDebug('statsPeriod', `- ${calendarTimeframe} note ${filenameForCalDate} already open`)
  }
  if (note == null) {
    throw new Error(`Cannot open calendar note '${filenameForCalDate ?? 'unknown'}' for writing. Please check your calendar settings and try again.`)
  } else {
    // Replace or add output section
    replaceSection(note, config.PSStatsHeading, `${config.PSStatsHeading} ${periodAndPartStr} ${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Written results to note '${periodString}' (filename=${note.filename})`)
    logDebug(pluginJson, `- Editor.note.filename=${note.filename})`)
  }
}

/**
 * Handles output to log
 * Writes statistics output to plugin console log
 * @param {string} output - Output content
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} periodString - Period string
 * @param {any} config - Configuration object
 */
function handleLogOutput(
  output: string, periodAndPartStr: string, periodString: string, config: any
): void {
  logInfo(pluginJson, `${config.PSStatsHeading} for ${periodAndPartStr ? periodAndPartStr : periodString}`)
  logInfo(pluginJson, output)
}

/**
 * Handles output destination routing
 * Routes statistics output to the appropriate destination based on user choice
 * @param {string} destination - Output destination: 'calendar' | 'current' | 'note' | 'log' | 'cancel'
 * @param {string} output - Output content (markdown string)
 * @param {any} periodData - Period data object containing dates, strings, and metadata
 * @param {any} config - Configuration object
 * @param {string} overrideGOSettingsStr - Optional JSON string containing settings to override in settingsForGO
 * @throws {Error} If destination is invalid or output operations fail
 */
async function handleOutputDestination(
  destination: string, output: string, periodData: any, config: any, overrideGOSettingsStr: string
): Promise<void> {
  const { periodString, periodAndPartStr, fromDate, periodShortCode, calendarTimeframe } = periodData
  const xCallbackMD = determineCallbackParameters(periodShortCode, periodData.periodNumber, periodData.year, overrideGOSettingsStr)

  switch (destination) {
    case 'current': {
      handleCurrentNoteOutput(output, periodAndPartStr, xCallbackMD, config)
      break
    }

    case 'note': {
      await handleNoteOutput(output, periodString, periodAndPartStr, xCallbackMD, config)
      break
    }

    case 'calendar': {
      await handleCalendarOutput(output, periodString, periodAndPartStr, xCallbackMD, config, fromDate, periodShortCode, calendarTimeframe)
      break
    }

    case 'log': {
      handleLogOutput(output, periodAndPartStr, periodString, config)
      break
    }

    case 'cancel': {
      break
    }

    default: {
      throw new Error(`Invalid save destination '${destination}'. Valid options are: 'calendar', 'current', 'note', 'log', or 'cancel'.`)
    }
  }
}
