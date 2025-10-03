/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 2025-09-30 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesToLookFor,
  type SummariesConfig,
  type TMOccurrences,
} from './summaryHelpers'
import { hyphenatedDate, RE_DATE } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { getPeriodStartEndDates, getPeriodStartEndDatesFromPeriodCode } from '@helpers/NPdateTime'
import type { TPeriodCode } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { createPrettyRunPluginLink } from '@helpers/general'
import { replaceSection } from '@helpers/note'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { chooseDecoratedOptionWithModifiers, chooseOption, showMessage } from '@helpers/userInput'

//-------------------------------------------------------------------------------
// Main function

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
 * @param {TPeriodCode?} periodCodeArg (optional) all | week | lm | mtd | om | YYYY-MM-DD | today etc. If not provided user will be asked.
 * @param {number?} periodNumberArg (optional)
 * @param {number?} yearArg (optional)
 * @param {string?} specificGOSettings (optional) JSON string of specific GOSettings to use
 */
export async function statsPeriod(
  periodCodeArg: TPeriodCode | '',
  periodNumberArg: number = NaN,
  yearArg: number = NaN,
  specificGOSettingsStr: string = '' // JSON string
): Promise<void> {
  try {
    // Get config from settings
    let config = await getSummariesSettings()

    if (specificGOSettingsStr !== '') {
      const specificGOSettings = JSON.parse(specificGOSettingsStr)
      logDebug('statsPeriod', `- overriding config with specific GOSettings '${specificGOSettingsStr}'`)
      clo(specificGOSettings, `- specific GOSettings object:`)
      config = overrideSettingsWithEncodedTypedArgs(config, specificGOSettingsStr)
      clo(config, `- config after overriding with specific GOSettings '${specificGOSettingsStr}':`)
    }

    // 1. Validate parameters and calculate period
    logDebug(pluginJson, `statsPeriod: starting with params '${periodCodeArg}', '${periodNumberArg}', '${yearArg}'`)
    const periodData = await validateAndCalculatePeriod(periodCodeArg, periodNumberArg, yearArg, config)

    // 2. Gather statistics data
    const statsData: Array<TMOccurrences> = await gatherStatsData(periodData.periodString, periodData.fromDateStr, periodData.toDateStr, config)

    // 3. Generate output
    const output: string = await generateStatsOutput(statsData, periodData.periodString, periodData.fromDateStr, periodData.toDateStr, config)

    // 4. Determine output destination
    const destination = await selectOutputDestination(periodData.isRunningFromXCallback, config, periodData.calendarTimeframe, periodData.periodString)

    // 5. Handle output
    await handleOutputDestination(destination, output, periodData, config)

  } catch (error) {
    logError('statsPeriod', error.message)
    await showMessage(error.message)
  }
}

//-----------------------------------------------------------------------------
// Helper functions for statsPeriod refactoring

/**
 * Validates parameters and calculates period data
 * @param {string} periodCodeArg - Period code argument: week | month | quarter | year | YYYY-MM-DD | all
 * @param {number} periodNumberArg - Period number argument
 * @param {number} yearArg - Year argument
 * @param {Object} config - Configuration object
 * @returns {Object} Period data object
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
  if (periodCodeArg && periodCodeArg !== '' && ((!isNaN(year) && !isNaN(periodNumberArg)) || periodCodeArg === 'today' || periodCodeArg === 'all' || new RegExp(`^${RE_DATE}$`).test(periodCodeArg))) {
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

  if (fromDate == null || toDate == null) {
    throw new Error(`Error: failed to calculate dates`)
  }
  if (fromDate > toDate) {
    throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
  }

  const fromDateStr = hyphenatedDate(fromDate)
  const toDateStr = hyphenatedDate(toDate)
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
 * @param {string} periodShortCode - Short period code
 * @param {number} periodNumber - Period number
 * @param {number} year - Year
 * @returns {string} Callback markdown string
 */
function determineCallbackParameters(periodShortCode: string, periodNumber: number, year: number): string {
  let xCallbackMD = ''
  if (!isNaN(periodNumber) || periodShortCode === 'today' || new RegExp(`^${RE_DATE}$`).test(periodShortCode) || periodShortCode === 'year') {
    const yearStr = String(year)
    const periodNumberStr = String(periodNumber)
    logDebug('periodStats', `Forming refresh callback with params ${periodShortCode}, ${periodNumberStr}, ${yearStr}`)
    xCallbackMD =
      ' ' + createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Summaries', 'periodStats', [periodShortCode, periodNumberStr, yearStr])
  } else {
    logDebug('periodStats', `NOT Forming refresh callback from params ${periodShortCode}, ${periodNumber}, ${year}`)
  }
  return xCallbackMD
}

/**
 * Gathers statistics data for the specified period
 * @param {string} periodString - Period string
 * @param {string} fromDateStr - From date string
 * @param {string} toDateStr - To date string
 * @param {Object} config - Configuration object
 * @returns {Array<TMOccurrences>} Occurrences array
 */
async function gatherStatsData(
  periodString: string,
  fromDateStr: string,
  toDateStr: string,
  config: SummariesConfig
): Promise<Array<TMOccurrences>> {
  const startTime = new Date()
  CommandBar.showLoading(true, `Gathering Data from Calendar notes`)
  await CommandBar.onAsyncThread()

  // Main work: calculate the occurrences, using config settings and the time period info
  const settingsForGO: OccurrencesToLookFor = {
    GOYesNo: config.periodStatsYesNo,
    GOHashtagsCount: config.includedHashtags,
    GOHashtagsExclude: [],
    // FIXME: tidy up here and in Settings and plugin.json
    GOHashtagsAverage: config.includedHashtagsAverage,
    GOHashtagsTotal: config.includedHashtagsTotal,
    GOMentionsCount: config.includedMentions,
    GOMentionsExclude: [],
    GOMentionsAverage: config.periodStatsMentionsAverage,
    GOMentionsTotal: config.periodStatsMentionsTotal,
    GOChecklistRefNote: config.progressChecklistReferenceNote,
  }
  const tmOccurrencesArray: Array<TMOccurrences> = await gatherOccurrences(periodString,
    fromDateStr,
    toDateStr,
    settingsForGO)
  logInfo('statsPeriod', `Gathered all occurrences in ${timer(startTime)}`)

  return tmOccurrencesArray
}

/**
 * Generates the final statistics output
 * @param {Array} tmOccurrencesArray - Occurrences array
 * @param {string} periodString - Period string
 * @param {string} fromDateStr - From date string
 * @param {string} toDateStr - To date string
 * @param {Object} config - Configuration object
 * @returns {string} Generated output
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
  const output = (await generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.periodStatsShowSparklines, true)).join('\n')
  CommandBar.showLoading(false)
  await CommandBar.onMainThread()
  logInfo('statsPeriod', `Created period stats in ${timer(startTime)}`)
  return output
}

/**
 * Selects output destination based on context and user choice
 * @param {boolean} isRunningFromXCallback - Whether running from callback
 * @param {Object} config - Configuration object
 * @param {string} calendarTimeframe - Calendar timeframe
 * @param {string} periodString - Period string
 * @returns {string} Selected destination
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
  if (NotePlan.environment.buildVersion >= 1413) { // = 3.18.0
    // Start by tailoring the set of options to present
    const decoratedOutputOptions: Array<TCommandBarOptionObject> = [
      { text: `Add/Update the ${calendarTimeframe}ly calendar note '${periodString}'`, icon: 'calendar-days', color: 'gray-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
      { text: 'Update/append to the open note', icon: 'pen-to-square', color: 'gray-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
      { text: 'Write to plugin console log', icon: 'terminal', color: 'gray-500', shortDescription: ``, alpha: 0.6, darkAlpha: 0.6 },
      { text: 'Cancel', icon: 'cancel', color: 'red-500', shortDescription: ``, alpha: 0.8, darkAlpha: 0.8 },
    ]
    const optionValues = ['calendar', 'current', 'log', 'cancel']
    if (config.folderToStore && config.folderToStore !== '') {
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
    if (config.folderToStore && config.folderToStore !== '') {
      simpleOutputOptions.unshift({ label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' })
    }
    const chosenOption = await chooseOption(`Where to save the summary for ${periodString}?`, simpleOutputOptions, 'note')
    result = chosenOption.value
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
    logError('statsPeriod', `No note is open in the Editor, so I can't write to it.`)
  } else {
    // Replace or add output section
    replaceSection(currentNote, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Updated results in note section '${config.statsHeading}' for ${periodAndPartStr}`)
  }
}

/**
 * Handles output to a new note
 * @param {string} output - Output content
 * @param {string} periodString - Period string
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} xCallbackMD - Callback markdown
 * @param {SummariesConfig} config - Configuration object
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
    logError('statsPeriod', `Cannot get new note`)
    await showMessage('There was an error getting the new note ready to write')
  } else {
    // Replace or add output section
    replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Written results to note '${periodString}'`)

    // Open the results note in a new split window, unless we already have this note open
    if (Editor.note?.filename !== note.filename) {
      // Open the results note in a new split window, unless we can tell we already have this note open. Only works for active Editor, though.
      await Editor.openNoteByFilename(note.filename, false, 0, 0, true)
    }
  }
}

/**
 * Handles output to calendar note
 * @param {string} output - Output content
 * @param {string} periodString - Period string
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} xCallbackMD - Callback markdown
 * @param {Object} config - Configuration object
 * @param {Date} fromDate - From date
 * @param {string} periodShortCode - Period short code
 * @param {string} calendarTimeframe - Calendar timeframe
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
  if (!calNoteAtFromDate) {
    throw new Error(`Couldn't get calendar note for ${periodString}`)
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
    throw new Error(`cannot get Calendar note for ${filenameForCalDate} ready to write. Stopping.`)
  } else {
    // Replace or add output section
    replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}${xCallbackMD}`, config.headingLevel, output)
    logDebug('statsPeriod', `Written results to note '${periodString}' (filename=${note.filename})`)
    logDebug(pluginJson, `- Editor.note.filename=${note.filename})`)
  }
}

/**
 * Handles output to log
 * @param {string} output - Output content
 * @param {string} periodAndPartStr - Period and part string
 * @param {string} periodString - Period string
 * @param {Object} config - Configuration object
 */
function handleLogOutput(output: string, periodAndPartStr: string, periodString: string, config: any): void {
  logInfo(pluginJson, `${config.statsHeading} for ${periodAndPartStr ? periodAndPartStr : periodString}`)
  logInfo(pluginJson, output)
}

/**
 * Handles output destination routing
 * @param {string} destination - Output destination
 * @param {string} output - Output content
 * @param {Object} periodData - Period data object
 * @param {Object} config - Configuration object
 */
async function handleOutputDestination(destination: string, output: string, periodData: any, config: any): Promise<void> {
  const { periodString, periodAndPartStr, fromDate, periodShortCode, calendarTimeframe } = periodData
  const xCallbackMD = determineCallbackParameters(periodShortCode, periodData.periodNumber, periodData.year)

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
      throw new Error(`Invalid save destination '${destination}'`)
    }
  }
}
