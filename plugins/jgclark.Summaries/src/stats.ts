/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 4.6.2024 for v0.22.0
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

// import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesToLookFor,
} from './summaryHelpers'
import {
  // getJSDateStartOfToday,
  // getWeek,
  hyphenatedDate,
  RE_DATE,
  // unhyphenatedDate,
} from '@np/helpers/dateTime'
import { getPeriodStartEndDates, getPeriodStartEndDatesFromPeriodCode } from '@np/helpers/NPdateTime'
import { noteOpenInEditor } from '@np/helpers/NPWindows'
import { logDebug, logError, logInfo, timer } from '@np/helpers/dev'
import {
  // CaseInsensitiveMap, displayTitle,
  createPrettyRunPluginLink,
  // createRunPluginCallbackUrl
} from '@np/helpers/general'
import { getOrMakeNote, replaceSection } from '@np/helpers/note'
// import { caseInsensitiveCompare } from '@np/helpers/sorting'
import { chooseOption, showMessage } from '@np/helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
 * @param {string?} periodCodeArg (optional) lm | mtd | om | YYYY-MM-DD | today etc. If not provided user will be asked.
 * @param {number?} periodNumberArg (optional)
 * @param {number?} yearArg (optional)
 */
export async function statsPeriod(periodCodeArg: string = '', periodNumberArg: number = NaN, yearArg: number = NaN): Promise<void> {
  try {
    // Get config from settings
    const config = await getSummariesSettings()
    let fromDate, toDate, periodString, periodShortCode, periodAndPartStr = ''
    let periodNumber = periodNumberArg
    let year = yearArg
    let calendarTimeframe = ''

    let isRunningFromXCallback = false
    if (periodCodeArg && periodCodeArg !== '' && ((!isNaN(year) && !isNaN(periodNumberArg)) || periodCodeArg === 'today' || new RegExp(`^${RE_DATE}$`).test(periodCodeArg))) {
      isRunningFromXCallback = true
      periodShortCode = periodCodeArg
      logDebug(pluginJson, `statsPeriod: starting with params ${periodShortCode}, ${periodNumber}, ${year}`)
    }

    // Get time period of interest ...
    if (isRunningFromXCallback) {
      // from periodCodeArg
      // TODO: check periodShortCode = week | month | quarter | year | YYYY-MM-DD
      // @ts-ignore
      [fromDate, toDate, periodShortCode, periodString, periodAndPartStr] = getPeriodStartEndDatesFromPeriodCode(periodShortCode, periodNumber, year, config.excludeToday) // note no await
    } else {
      // or by asking user
      [fromDate, toDate, periodShortCode, periodString, periodAndPartStr, periodNumber] = await getPeriodStartEndDates('Create stats for which period?', config.excludeToday, '') // note await needed
      year = fromDate.getFullYear()

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

    let startTime = new Date()
    CommandBar.showLoading(true, `Gathering Data from Calendar notes`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the occurrences, using config settings and the time period info
    const settingsForGO: OccurrencesToLookFor = {
      GOYesNo: config.periodStatsYesNo,
      GOHashtagsCount: config.includeHashtags,
      GOHashtagsExclude: [],
      GOHashtagsAverage: config.periodStatsHashtagsAverage,
      GOHashtagsTotal: config.periodStatsHashtagsTotal,
      GOMentionsCount: config.periodStatsMentions,
      GOMentionsExclude: [],
      GOMentionsAverage: config.periodStatsMentionsAverage,
      GOMentionsTotal: config.periodStatsMentionsTotal,
      GOChecklistRefNote: config.progressChecklistReferenceNote,
    }
    const tmOccurrencesArray = await gatherOccurrences(periodString,
      fromDateStr,
      toDateStr,
      settingsForGO)
    logInfo('statsPeriod', `Gathered all occurrences in ${timer(startTime)}`)

    CommandBar.showLoading(true, `Creating Period Stats`)
    startTime = new Date()
    const output = (await generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.periodStatsShowSparklines, true)).join('\n')
    CommandBar.showLoading(false)
    await CommandBar.onMainThread()
    logInfo('statsPeriod', `Created period stats in ${timer(startTime)}`)

    // Work out a refresh callback string if possible
    // (namely: if periodNumber known, or a year code, or 'today' or a specific date)
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

    // --------------------------------------------------------------------------
    // Ask where to save this summary to, unless isRunningFromXCallback
    let destination = ''
    if (isRunningFromXCallback) {
      destination = 'current'
    } else {
      // Start by tailoring the set of options to present
      const outputOptions = [
        { label: '🖊 Update/append to the open note', value: 'current' },
        { label: '📋 Write to plugin console log', value: 'log' },
        { label: '❌ Cancel', value: 'cancel' },
      ]
      if (config.folderToStore && config.folderToStore !== '') {
        outputOptions.unshift({ label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' })
      }
      if (NotePlan.environment.buildVersion >= 917) { // = 3.7.2 beta
        outputOptions.unshift({ label: `📅 Add/Update the ${calendarTimeframe}ly calendar note '${periodString}'`, value: 'calendar' })
      }
      destination = await chooseOption(`Where to save the summary for ${periodString}?`, outputOptions, 'note')
    }

    // Output the results to the selected place
    switch (destination) {
      case 'current': {
        const currentNote = Editor.note
        if (currentNote == null) {
          logError('statsPeriod', `No note is open in the Editor, so I can't write to it.`)
        } else {
          // Replace or add output section
          replaceSection(currentNote, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}${xCallbackMD}`, config.headingLevel, output)
          logDebug('statsPeriod', `Updated results in note note '${periodString}' section '${config.statsHeading}' for ${periodAndPartStr}`)
        }
        break
      }

      case 'note': {
        // Summaries note
        const note = await getOrMakeNote(periodString, config.folderToStore)
        if (note == null) {
          logError('statsPeriod', `Cannot get new note`)
          await showMessage('There was an error getting the new note ready to write')
        } else {
          // logDebug('statsPeriod', `- about to update section '${config.statsHeading}' in note '${note.filename}' for ${periodAndPartStr}`)

          // add a refresh button if it can work with just a single extra parameter
          // if (periodShortCode.endsWith('td')) {
          // const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Summaries', 'periodStats', periodShortCode)
          // output = `[🔄 Refresh](${refreshXCallbackURL})\n${output}`
          // }

          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}${xCallbackMD}`, config.headingLevel, output)
          logDebug('statsPeriod', `Written results to note '${periodString}'`)

          // Open the results note in a new split window, unless we already have this note open
          if (Editor.note?.filename !== note.filename) {
            // Open the results note in a new split window, unless we can tell we already have this note open. Only works for active Editor, though.
            await Editor.openNoteByFilename(note.filename, false, 0, 0, true)
          }
        }
        break
      }

      case 'calendar': {
        // Weekly note (from v3.6) and Monthly / Quarterly / Yearly (from v3.7.2)
        // const todaysDate = getJSDateStartOfToday()
        // TODO: when API makes this possible, make it only open a new window if not already open.
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
        break
      }

      case 'log': {
        logInfo(pluginJson, `${config.statsHeading} for ${periodAndPartStr ? periodAndPartStr : periodString}`)
        logInfo(pluginJson, output)
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
  catch (error) {
    logError('statsPeriod', error.message)
    await showMessage(error.message)
  }
}
