// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 30.12.2023 for v0.20.2
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  TMOccurrences
} from './summaryHelpers'
import {
  getJSDateStartOfToday,
  getWeek, hyphenatedDate, unhyphenatedDate,
  RE_DATE
} from '@helpers/dateTime'
import { getPeriodStartEndDates, getPeriodStartEndDatesFromPeriodCode } from '@helpers/NPDateTime'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { logDebug, logError, logInfo, timer } from '@helpers/dev'
import { CaseInsensitiveMap, displayTitle, createRunPluginCallbackUrl } from '@helpers/general'
import { getOrMakeNote, printNote, replaceSection } from '@helpers/note'
import { caseInsensitiveCompare } from '@helpers/sorting'
import { chooseOption, showMessage } from '@helpers/userInput'
import type { OccurrencesConfig } from "./summaryHelpers";

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
 * @param {string?} periodCodeArg (optional) lm | mtd | om etc. If not provided user will be asked
 * @param {number?} calNumber (optional)
 * @param {number?} year (optional)
 */
export async function statsPeriod(periodCodeArg: string = '', calNumber: number = NaN, year: number = NaN): Promise<void> {
  try {
    // Get config from settings
    let config = await getSummariesSettings()
    let fromDate, toDate, periodString, periodShortCode, periodAndPartStr = ''

    let isRunningFromXCallback = false
    if (periodCodeArg && periodCodeArg !== '' && (!isNaN(year) || periodCodeArg === 'today' || new RegExp(`^${RE_DATE}$`).test(periodCodeArg))) {
      isRunningFromXCallback = true
      periodShortCode = periodCodeArg
    }

    // Get time period of interest ...
    if (isRunningFromXCallback) {
      // from periodCodeArg
      // TODO: check periodShortCode = week | month | quarter | year | YYYY-MM-DD
      // $FlowIgnore[incompatible-call]
      [fromDate, toDate, periodShortCode, periodString, periodAndPartStr] = getPeriodStartEndDatesFromPeriodCode(periodShortCode, calNumber, year, config.excludeToday) // note no await
    } else {
      // or by asking user
      [fromDate, toDate, periodShortCode, periodString, periodAndPartStr] = await getPeriodStartEndDates('Create stats for which period?', config.excludeToday, '') // note await needed
    }

    if (fromDate == null || toDate == null) {
      throw new Error(`Error: failed to calculate dates`)
    }
    if (fromDate > toDate) {
      throw new Error(`Error: requested fromDate ${String(fromDate)} is after toDate ${String(toDate)}`)
    }

    const fromDateStr = hyphenatedDate(fromDate)
    const toDateStr = hyphenatedDate(toDate)
    logInfo(pluginJson, `statsPeriod: starting for ${periodString} (${fromDateStr} - ${toDateStr})`)
    const calendarTimeframe =
      (periodShortCode === 'userwtd' || periodShortCode === 'wtd' || periodShortCode === 'lw' || periodShortCode === 'ow') ? 'week'
        : (periodShortCode === 'mtd' || periodShortCode === 'lm' || periodShortCode === 'om') ? 'month'
          : (periodShortCode === 'qtd' || periodShortCode === 'lq' || periodShortCode === 'oq') ? 'quarter'
            : (periodShortCode === 'ytd' || periodShortCode === 'ly' || periodShortCode === 'oy') ? 'year'
              : 'other'

    let startTime = new Date()
    CommandBar.showLoading(true, `Gathering Data from Calendar notes`)
    await CommandBar.onAsyncThread()

    // Main work: calculate the occurrences, using config settings and the time period info
    const settingsForGO: OccurrencesConfig = {
      GOYesNo: config.periodStatsYesNo,
      GOHashtagsCount: config.includeHashtags,
      GOHashtagsExclude: [],
      GOHashtagsAverage: config.periodStatsHashtagsAverage,
      GOHashtagsTotal: config.periodStatsHashtagsTotal,
      GOMentionsCount: config.periodStatsMentions,
      GOMentionsExclude: [],
      GOMentionsAverage: config.periodStatsMentionsAverage,
      GOMentionsTotal: config.periodStatsMentionsTotal,
    }
    const tmOccurrencesArray = await gatherOccurrences(periodString,
      fromDateStr,
      toDateStr,
      settingsForGO)
    logInfo('statsPeriod', `Gathered all occurrences in ${timer(startTime)}`)

    CommandBar.showLoading(true, `Creating Period Stats`)
    startTime = new Date()
    let output = generateProgressUpdate(tmOccurrencesArray, periodString, fromDateStr, toDateStr, 'markdown', config.periodStatsShowSparklines, true).join('\n')

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logInfo('statsPeriod', `Created period stats in ${timer(startTime)}`)

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
          // logDebug('statsPeriod', `- about to update section '${config.statsHeading}' in weekly note '${currentNote.filename}' for ${periodAndPartStr}`)
          // add a refresh button if it can work with just a single extra parameter
          if (periodShortCode.endsWith('td')) {
            const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Summaries', 'periodStats', periodShortCode)
            output = `[🔄 Refresh](${refreshXCallbackURL})\n${output}`
          }
          // Replace or add output section
          replaceSection(currentNote, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
          logDebug('statsPeriod', `Written results to note '${periodString}'`)
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
          if (periodShortCode.endsWith('td')) {
            const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Summaries', 'periodStats', periodShortCode)
            output = `[🔄 Refresh](${refreshXCallbackURL})\n${output}`
          }

          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
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
        // Weekly note (from v3.6) or Monthly / Quarterly / Yearly (from v3.7.2)
        const todaysDate = getJSDateStartOfToday()
        // TODO(later): when API makes this possible, make it only open a new window if not already open.
        const calNoteAtFromDate = DataStore.calendarNoteByDate(fromDate, periodShortCode)
        if (!calNoteAtFromDate) {
          throw new Error(`Couldn't get calendar note for ${periodString}`)
        }
        let note: TNote = calNoteAtFromDate
        let filenameForCalDate = calNoteAtFromDate?.filename
        if (!filenameForCalDate || !noteOpenInEditor(filenameForCalDate)) {
          logDebug('statsPeriod', `- opening ${calendarTimeframe} note ${filenameForCalDate ?? '<error>'}`)
          const res = await Editor.openNoteByDate(fromDate, false, 0, 0, true, calendarTimeframe)
          if (res) {
            note = res
            filenameForCalDate = note.filename
          }
        } else {
          logDebug('statsPeriod', `- ${calendarTimeframe} note ${filenameForCalDate} already open`)
          note = calNoteAtFromDate
        }
        if (note == null) {
          logError('statsPeriod', `cannot get Calendar note for ${filenameForCalDate}`)
          await showMessage(`There was an error getting the Calendar note ${filenameForCalDate} ready to write`)
        } else {
          // add a refresh button if it can work with just a single extra parameter
          if (periodShortCode.endsWith('td')) {
            const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Summaries', 'periodStats', periodShortCode)
            output = `[🔄 Refresh](${refreshXCallbackURL})\n${output}`
          }

          // Replace or add output section
          replaceSection(note, config.statsHeading, `${config.statsHeading} ${periodAndPartStr}`, config.headingLevel, output)
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
  }
}
