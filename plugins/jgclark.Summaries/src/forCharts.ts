// @flow
//-----------------------------------------------------------------------------
// Create heatmap chart to use with NP HTML, and before then
// weekly stats for a number of weeks, and format ready to use by gnuplot.
// Jonathan Clark, @jgclark
// Last updated 16.2.2024 for v0.21.0+, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  // calcHashtagStatsPeriod,
  // calcMentionStatsPeriod,
  gatherOccurrences,
  // generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesToLookFor,
  TMOccurrences,
  // type SummariesConfig
} from './summaryHelpers'
import {
  // calcWeekOffset,
  // getDateObjFromDateString,
  // getDateStringFromCalendarFilename,
  // getJSDateStartOfToday,
  getTodaysDateHyphenated,
  // getWeek,
  // hyphenatedDate,
  hyphenatedDateString,
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  todaysDateISOString, // const
  toISODateString,
  // unhyphenatedDate,
  // isoWeekStartEndDates,
  withinDateRange,
} from '@np/helpers/dateTime'
import {
  getNPWeekData,
  getUsersFirstDayOfWeekUTC,
  pad,
  // type NotePlanWeekInfo,
} from '@np/helpers/NPdateTime'
import { clo, clof, logDebug, logError, logInfo, logWarn, timer } from '@np/helpers/dev'
// import { displayTitle } from '@np/helpers/general'
// import { showHTMLV2 } from '@np/helpers/HTMLView'
import {
  // clearNote, getOrMakeNote,
  projectNotesFromFilteredFolders
} from '@np/helpers/note'
// import { getLocale } from '@np/helpers/NPConfiguration'
// import { chooseOption, getInput, showMessage } from '@np/helpers/userInput'

//-----------------------------------------------------------------------------

// const pluginID = 'jgclark.Summaries'

/**
 * Print to log the output of a generateTaskCompletionStats() call, covering year to date.
 * @author @jgclark
 */
export async function testTaskGenStats(): Promise<void> {
  logDebug('testTaskGenStats()', "Starting ...")
  const config = await getSummariesSettings()
  const fromDate = moment().startOf('year')
  const fromDateStr = fromDate.format('YYYY-MM-DD')
  // const todayDate = moment().startOf('day')
  // const todayDateStr = todayDate.format('YYYY-MM-DD')

  const statsMap = await generateTaskCompletionStats(config.foldersToExclude, 'day', fromDateStr) // year to date
  logDebug('testTaskGenStats()', "Output:")
  for (const entry of statsMap) {
    console.log(entry)
  }
}

/**
 * Calculate first day at start of week 'numWeeksToGoBack' ago.
 * If includeCurrentWeek, then one of the weeks will be the current (probably incomplete) week.
 * Note: this uses the user's start-of-week setting.
 * @param {number} numWeeksToGoBack
 * @param {boolean} includeCurrentWeek?
 * @returns {[string, number]} YYYY-MM-DD, numWeeks
 */
export function getFirstDateForWeeklyStats(numWeeksToGoBack: number, includeCurrentWeek: boolean): [string, number] {
  try {
    const numWeeks = numWeeksToGoBack
    const mom = moment().subtract(numWeeks - (includeCurrentWeek ? 1 : 0), 'week')

    // Now get the start of that previous week, using NP week information
    const weekInfo = getNPWeekData(mom.toDate())
    if (!weekInfo) throw new Error(`Invalid startWeek based on ${mom.toDate()}, so can't continue`)
    const fromDateStr = hyphenatedDateString(weekInfo.startDate)

    logDebug('getFirstDateForWeeklyStats', `Will go back ${numWeeks} weeks, starting w/c ${fromDateStr}`)
    return [fromDateStr, numWeeks]
  } catch (e) {
    logError('getFirstDateForWeeklyStats', `Error: ${e.message}`)
    return ['', 0]
  }
}

/**
 * Generate stats of number of completed tasks (not done checklist items) between two dates, for a intervalType (currently only 'day' is supported).
 * @author @jgclark
 * @param {Array<string>} foldersToExclude which may be just []
 * @param {string} intervalType - array of CSV strings
 * @param {string} fromDateStr - ISO date to start
 * @param {string?} toDateStr - ISO date to end; if missing then today
 * @returns {Map<string, mixed>} Map of [isoDateString, number]
 */
/* eslint-disable-next-line */
export async function generateTaskCompletionStats(foldersToExclude: Array<string>, intervalType: string, fromDateStr: string, toDateStr: string = getTodaysDateHyphenated()): Promise<Map<string, number>> {
  try {
    // Initialise a Map to hold count of completed dates
    // v1.  Start with a simple empty Map
    const dateCounterMap = new Map < string, number> ()
    // Set up a function that sums occurences(in value) of key(date).
    // const addToObj = key => {
    //   // @ts-ignore
    //   dateCounterMap.set(key, (dateCounterMap.has(key) ? (dateCounterMap.get(key)) + 1 : 1))
    // }

    // v2. Initialise a Map for all dates of interest, with NaN values (to distinguish from zero).
    // const fromDateMoment = moment(fromDateStr, 'YYYY-MM-DD')
    const toDateMoment = moment(toDateStr, 'YYYY-MM-DD')
    const daysInInterval = toDateMoment.diff(fromDateStr, 'day')
    // logDebug('generateTaskCompletionStats', `- daysInInterval = ${daysInInterval}`)
    for (let i = 0; i < daysInInterval; i++) {
      const thisDate = moment(fromDateStr, 'YYYY-MM-DD').add(i, 'days').format('YYYY-MM-DD')
      dateCounterMap.set(thisDate, NaN)
      // logDebug('', `- init dateCounterMap(${thisDate}) = ${String(dateCounterMap.get(thisDate))}`)
    }

    // Function that sums occurences(in value) of key(date).
    // $FlowFixMe[missing-local-annot]
    const addToObj = key => {
      // @ts-ignore
      dateCounterMap.set(key, (dateCounterMap.has(key) && !isNaN(dateCounterMap.get(key)) ? (dateCounterMap.get(key)) + 1 : 1))
      // logDebug('', `\tupdated ${key} to ${String(dateCounterMap.get(key))}`)
    }

    // start a timer and spinner
    CommandBar.showLoading(true, `Generating Task Completion stats ...`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()

    // do completed task (not checklist) counts from all Project Notes
    const projNotes = projectNotesFromFilteredFolders(foldersToExclude, true)
    logDebug('generateTaskCompletionStats', `Summarising for ${projNotes.length} project notes`)
    for (const n of projNotes) {
      const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
      for (const dp of doneParas) {
        let doneDate = null
        if (dp.content.match(RE_DONE_DATE_OPT_TIME)) {
          // get completed date from @done(date [time])
          const reReturnArray = dp.content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
          doneDate = reReturnArray[1]
        }
        // If we've found a task done in the right period, save
        if (doneDate && withinDateRange(doneDate, fromDateStr, toDateStr)) {
          addToObj(doneDate)
        }
      }
    }
    // let projectDataArray = Object.entries(dateCounterObj)
    let totalProjectDone = 0
    for (const item of dateCounterMap) {
      if (!isNaN(item[1]) && item[1] !== '') {
        totalProjectDone += Number(item[1])
      }
    }
    logDebug('generateTaskCompletionStats', `-> ${totalProjectDone} done tasks from all Project notes`)

    // Do completed task (not checklist) counts from all Calendar Notes from that period
    // @ts-ignore
    const periodCalendarNotes = DataStore.calendarNotes.filter((n) => withinDateRange(toISODateString(n.date), fromDateStr, toDateStr))
    if (periodCalendarNotes.length > 0) {
      for (const n of periodCalendarNotes) {
        const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
        for (const dp of doneParas) {
          let doneDate = null
          if (dp.content.match(RE_DONE_DATE_OPT_TIME)) {
            // get completed date (and ignore time)
            const reReturnArray = dp.content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
            doneDate = reReturnArray[1] // date part
          }
          else {
            // We have a completed task but not a done date
            doneDate = moment(n.date).format('YYYY-MM-DD') // the note's date
          }
          // If we've found a task done in the right period, save
          // @ts-ignore
          if (doneDate && withinDateRange(doneDate, fromDateStr, toDateStr)) {
            addToObj(doneDate)
          }
        }
      }

      // As tasks can be completed on dates later than the daily note it resides in, we need to look at calendar notes from (say) the previous 6 months of daily and weekly notes.
      // This time, only get proper '@done(...)' dates.
      const earlierFromDateStr = moment(fromDateStr, 'YYYY-MM-DD').subtract(6, 'months').format('YYYY-MM-DD')
      const earlierToDateStr = moment(fromDateStr, 'YYYY-MM-DD').subtract(1, 'days').format('YYYY-MM-DD')
      // @ts-ignore
      const beforePeriodCalendarNotes = DataStore.calendarNotes.filter((n) => withinDateRange(toISODateString(n.date), earlierFromDateStr, earlierToDateStr))
      logDebug('generateTaskCompletionStats', `Summarising for ${beforePeriodCalendarNotes.length} calendar notes (looking 6 months before given fromDate)`)

      for (const n of beforePeriodCalendarNotes) {
        const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
        for (const dp of doneParas) {
          let doneDate = null
          if (dp.content.match(RE_DONE_DATE_OPT_TIME)) {
            // get completed date (and ignore time)
            const reReturnArray = dp.content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
            doneDate = reReturnArray[1] // date part
          }
          // If we've found a task done in the right period, save
          if (doneDate && withinDateRange(doneDate, fromDateStr, toDateStr)) {
            addToObj(doneDate)
          }
        }
      }
    } else {
      logWarn(pluginJson, `No matching Calendar notes found between ${fromDateStr} and ${toDateStr}`)
    }
    // end timer & spinner
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('generateTaskCompletionStats', `Duration: ${timer(startTime)}`)

    // Object manipulation details for this version from https://javascript.info/keys-values-entries
    let totalCalendarDone = 0
    let interimTotal = 0
    for (const item of dateCounterMap) {
      if (!isNaN(item[1]) && item[1] !== '') {
        interimTotal += Number(item[1])
      }
    }
    totalCalendarDone = interimTotal - totalProjectDone
    logDebug('generateTaskCompletionStats', `-> ${totalCalendarDone} done tasks from ${periodCalendarNotes.length} Calendar notes`)

    // Next, we need to add some entries on the front to fill up the first few days of the week that occur before the start of the period we've selected (if any)
    // (This needs to come before the sort)
    // e.g. 1.1.22 = a Saturday = fromDateDayOfWeek = 6
    const fromDateDayOfWeek = moment(fromDateStr, 'YYYY-MM-DD').format('d') // 1(Mon)-7(Sun) ??
    const usersFirstDayOfWeek = getUsersFirstDayOfWeekUTC() // 0(Sun)-6(Sat); deals with undefined case
    logDebug('generateTaskCompletionStats', `- fromDateDayOfWeek = ${fromDateDayOfWeek}`)
    logDebug('generateTaskCompletionStats', `- usersFirstDayOfWeek = ${usersFirstDayOfWeek}`)
    const numBlanksToAdd = (fromDateDayOfWeek - 1) // Note: Haven't fully tested other start-day-of-week options
    logDebug('generateTaskCompletionStats', `- numBlanksToAdd = ${numBlanksToAdd}`)
    if (numBlanksToAdd > 0) {
      for (let i = numBlanksToAdd; i > 0; i--) {
        const thisDate = moment(fromDateStr, 'YYYY-MM-DD').subtract(i, 'days').format('YYYY-MM-DD')
        dateCounterMap.set(thisDate, NaN) // or NaN or something to indicate this is a placeholder
        logDebug('generateTaskCompletionStats', `- added blank entry for ${thisDate}`)
      }
    }

    // Copying the existing object, which is the easiest way to re-order by date
    const outputMap = new Map([...dateCounterMap].sort())
    // let total = 0
    // for (let item of outputMap) {
    //   const isoDate = item[0]
    //   if (withinDateRange(isoDate, fromDateStr, toDateStr)) {
    //     // this test ignores any blanks on the front (though they will be 0 anyway)
    //     total += item[1] // the count
    //   }
    // }
    logInfo('generateTaskCompletionStats', `-> ${outputMap.size} statsMap items.`)

    return outputMap
  }
  catch (error) {
    logError(pluginJson, error.message)
    const emptyMap = new Map < string, number > ()
    return emptyMap
  }
}

/**
 * Transform CSV format into a CSV ready to be charted using gnuplot
 *
 * Input Format:
 *   tag/mention name,YYYY-MM-DD,count[,total][,average]
 *
 * Output Format:
 *   tag/mention name                [with leading @ suitably escaped]
 *   YYYY-MM-DD,count,total,average
 *   <2 blank lines>
 *   <repeat>
 *
 * Should add single blank line to notate missing data point(s)
 * @author @jgclark
 *
 * @param {[string]} inArray - array of CSV strings
 * @return {[string]} - output array ready for gnuplot
 */
function formatForGnuplotCSV(inArray: Array<string>): Array<string> {
  const outArray = []
  let lastKey = ''
  let thisKey = ''
  let firstKey = true
  for (const line of inArray) {
    const lineParts = line.split(',')
    thisKey = lineParts[0].replace('@', '\\\\@') // in gnuplot '@' is a special character that needs to be double-escaped
    const CSV = lineParts.slice(1).join(',') // all the other items, rejoined with commas
    if (thisKey !== lastKey) {
      if (!firstKey) {
        // if not the first time, write out two blank lines that mark a new 'index' dataset to gnuplot
        outArray.push('')
        outArray.push('')
      } else {
        firstKey = false
      }
      outArray.push(thisKey)
    }
    outArray.push(CSV)
    lastKey = thisKey
  }
  return outArray
}

/**
 * Transform CSV format into a simplified CSV ready for charting
 *
 * Input Format:
 *   tag/mention name,YYYY-MM-DD,count[,total][,average]
 *
 * Output Format:
 *   tag/mention name
 *   YYYY-MM-DD,count,total,average
 *   <1 blank lines>
 *   <repeat>
 *
 * @author @jgclark
 * @param {[string]} inArray - array of CSV strings
 * @return {[string]} - output array ready for gnuplot
 */
function formatForSimpleCSV(inArray: Array<string>): Array<string> {
  const outArray = []
  let lastKey = ''
  let thisKey = ''
  let firstKey = true
  for (const line of inArray) {
    const lineParts = line.split(',')
    thisKey = lineParts[0]
    const CSV = lineParts.slice(1).join(',') // all the other items, rejoined with commas
    if (thisKey !== lastKey) {
      if (!firstKey) {
        // if not the first time, write out two blank lines that mark a new dataset
        outArray.push('')
      } else {
        firstKey = false
      }
      outArray.push(thisKey)
    }
    outArray.push(CSV)
    lastKey = thisKey
  }
  return outArray
}

/**
 * Generate stats for the specified mentions and hashtags over a period of consecutive
 * weeks, and write as a CSV table:
 *   term, startDateStr, count, total, average
 * Only the specifically 'included' hashtags or mentions are included, as given by those settings.
 * V2 that uses gatherOccurrences()
 * @author @jgclark
 */
export async function weeklyStatsCSV(): Promise<void> {
  try {
    // const daysInterval = 7 // in days
    const config = await getSummariesSettings()

    // Calculate week range, asking for date offset _before_ current week.
    // Note: This is horribly complicated given the mismatch between NP and moment, and translation from JS dates needs care re TZs.
    // Note: toISODateString() isn't helpful as doesn't use local time. Instead use hyphenatedDateString().
    // const todaysDate = new Date()
    // let thisYear = todaysDate.getFullYear() // JS uses local time
    // const todayStartMom = moment().startOf('day')

    // V2: use Moment for all calcs. Problem: different week defintions.
    // V3: use NP's API for week calculations
    // V4: use DW helper function 'getNPWeekData()'
    const [fromDateStr, numWeeks] = getFirstDateForWeeklyStats(config.weeklyStatsDuration, config.weeklyStatsIncludeCurrentWeek)
    const startWeekInfo = getNPWeekData(fromDateStr)
    logDebug('weeklyStatsCSV', `starting for ${String(numWeeks)} weeks, with startWeekInfo = ${JSON.stringify(startWeekInfo)} / fromDateStr = ${fromDateStr} / includeCurrentWeek = ${String(config.weeklyStatsIncludeCurrentWeek)}`)
    if (!startWeekInfo) throw new Error(`Invalid startWeek based on ${fromDateStr}, so can't continue`)
    const endWeekInfo = getNPWeekData(fromDateStr, numWeeks - 1, 'week')
    if (!endWeekInfo) throw new Error(`Invalid startWeek based on ${todaysDateISOString}, so can't continue`)
    const toDateStr = hyphenatedDateString(endWeekInfo.endDate)
    // let numWeeks = endWeekInfo.weekNumber - startWeekInfo.weekNumber
    // if (numWeeks < 0) numWeeks += 52

    // Prepare config for gatherOccurrences() call
    const hashtagItems = config.weeklyStatsItems.filter((a) => a.startsWith('#'))
    const mentionItems = config.weeklyStatsItems.filter((a) => a.startsWith('@'))
    const occConfig: OccurrencesToLookFor = {
      GOYesNo: [],
      GOHashtagsCount: [],
      GOHashtagsAverage: [],
      GOHashtagsTotal: hashtagItems,
      GOHashtagsExclude: [], // no exclusions used here
      GOMentionsCount: [],
      GOMentionsAverage: [],
      GOMentionsTotal: mentionItems,
      GOMentionsExclude: [], // no exclusions used here
      GOChecklistRefNote: "",
    }

    // Pop up UI wait dialog as this can be a long-running process
    CommandBar.showLoading(true, `Preparing weekly stats over ${numWeeks} weeks`)
    await CommandBar.onAsyncThread()

    // Gather all the appropriate occurrences of the wanted terms
    CommandBar.showLoading(true, `Gathering relevant #hashtags and @mentions`)
    const occs: Array<TMOccurrences> = await gatherOccurrences(
      'period',
      fromDateStr, toDateStr, // YYYY-MM-DD
      occConfig)

    // For every week of interest calculate stats and add to the output array
    const outputArray = []
    let i = 0
    if (occs.length > 0) {
      for (const occ of occs) {
        i++
        // Update UI wait dialog
        CommandBar.showLoading(true, `Calculating stats for ${occs.length} terms of interest`, i / occs.length)

        for (let counter = 0; counter < numWeeks; counter++) {
          // Get the date info for the week of interest (counting up)
          const weekInfo = getNPWeekData(todaysDateISOString, counter - numWeeks, 'week')
          if (!weekInfo) throw new Error(`Invalid startWeek based on ${fromDateStr}, so can't continue`)
          const weekStartDate = weekInfo.startDate
          const weekEndDate = weekInfo.endDate
          const weekStartDateStr = hyphenatedDateString(weekStartDate)
          const weekEndDateStr = hyphenatedDateString(weekEndDate)
          logDebug('weeklyStatsCSV', `-> -> ${String(counter)}: ${weekStartDateStr} -  ${weekEndDateStr}`)
          const weekSummaryCSV = occ.summaryTextForInterval(weekStartDateStr, weekEndDateStr, 'week', 'CSV')
          outputArray.push(weekSummaryCSV)
        }
      }
    } else {
      logInfo('weeklyStatsCSV', `no data found in weekly summaries`)
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Write out to fixed note in plugin data directory
    const filename = 'weekly_stats.csv'
    DataStore.saveData(outputArray.join('\n'), filename, true)
    logInfo(pluginJson, `  written results to data file '${filename}'`)
  }
  catch (err) {
    logError(pluginJson, `weeklyStatsCSV: ${err.message}`)
  }
}

/**
 * Generate stats for the specified mentions and hashtags over a period of consecutive weeks,
 * and write to a file suitable for Mermaid charting:
 *   chart_title
 *   x-axis: [week labels, ...]
 *   y_series_name1: [data points, ...]
 *   y_series_name2: [data points, ...]
 *   ...
 * Only the specifically 'included' hashtags or mentions are included, as given by those settings.
 * The file is written to the plugin data directory.
 * @author @jgclark
 */
export async function weeklyStatsMermaid(): Promise<void> {
  try {
    const filename = 'weekly_stats_for_mermaid.txt'
    const config = await getSummariesSettings()

    // Calculate week range, asking for date offset _before_ current week.
    // Note: This is horribly complicated given the mismatch between NP and moment, and translation from JS dates needs care re TZs. 
    // See longer notes in weeklyStatsCSV function definition above.
    // const todaysDate = new Date()
    // let thisYear = todaysDate.getFullYear() // JS uses local time
    // const todayStartMom = moment().startOf('day')
    const [fromDateStr, numWeeks] = getFirstDateForWeeklyStats(config.weeklyStatsDuration, config.weeklyStatsIncludeCurrentWeek)
    const startWeekInfo = getNPWeekData(fromDateStr)
    logDebug('weeklyStatsMermaid', `starting for ${String(numWeeks)} weeks, with startWeekInfo = ${JSON.stringify(startWeekInfo)} / fromDateStr = ${fromDateStr} / includeCurrentWeek = ${String(config.weeklyStatsIncludeCurrentWeek)}`)
    if (!startWeekInfo) throw new Error(`Invalid startWeek based on ${fromDateStr}, so can't continue`)
    const endWeekInfo = getNPWeekData(fromDateStr, numWeeks - 1, 'week')
    if (!endWeekInfo) throw new Error(`Invalid startWeek based on ${todaysDateISOString}, so can't continue`)
    const toDateStr = hyphenatedDateString(endWeekInfo.endDate)
    logDebug('weeklyStatsMermaid', `fromDateStr = ${fromDateStr} / toDateStr = ${toDateStr}`)
    const chartTitle = `Weekly stats for the last ${numWeeks} weeks`

    // Prepare config for gatherOccurrences() call
    const hashtagItems = config.weeklyStatsItems.filter((a) => a.startsWith('#'))
    const mentionItems = config.weeklyStatsItems.filter((a) => a.startsWith('@'))
    const occConfig: OccurrencesToLookFor = {
      GOYesNo: [],
      GOHashtagsCount: [],
      GOHashtagsAverage: [],
      GOHashtagsTotal: hashtagItems,
      GOHashtagsExclude: [], // no exclusions used here
      GOMentionsCount: [],
      GOMentionsAverage: [],
      GOMentionsTotal: mentionItems,
      GOMentionsExclude: [], // no exclusions used here
      GOChecklistRefNote: "",
    }

    // Pop up UI wait dialog as this can be a long-running process
    CommandBar.showLoading(true, `Preparing weekly stats over ${numWeeks} weeks`)
    await CommandBar.onAsyncThread()

    // Gather all the appropriate occurrences of the wanted terms
    CommandBar.showLoading(true, `Gathering relevant #hashtags and @mentions`)
    const occs: Array<TMOccurrences> = await gatherOccurrences(
      'period',
      fromDateStr, toDateStr, // YYYY-MM-DD
      occConfig)

    // For every week of interest calculate stats and add to the output array
    const outputArray = []
    outputArray.push("xychart-beta")
    outputArray.push(`\ttitle "${chartTitle}"`)
    const intervalLabelArr = []
    for (let i = 0; i < numWeeks; i++) {
      const weekInfo = getNPWeekData(fromDateStr, i, 'week')
      if (!weekInfo?.weekNumber) throw new Error(`Invalid startWeek based on ${fromDateStr}, so can't continue`)
      const weekNum = weekInfo.weekNumber
      const weekLabel = (weekNum !== 1) ? `W${pad(weekNum)}` : String(startWeekInfo.weekYear)
      intervalLabelArr.push(weekLabel)
    }
    outputArray.push(`\tx-axis "for ${hashtagItems.join(', ')} and ${mentionItems.join(', ')}" [${intervalLabelArr.join(', ')}]`)

    let i = 0
    if (occs.length > 0) {
      for (const occ of occs) {
        i++
        const thisOccValueArr = []
        // Update UI wait dialog
        CommandBar.showLoading(true, `Calculating stats for ${occs.length} terms of interest`, i / occs.length)

        for (let counter = 0; counter < numWeeks; counter++) {
          // Get the date info for the week of interest (counting up)
          const thisWeekInfo = getNPWeekData(fromDateStr, counter, 'week') ?? {}
          if (!thisWeekInfo.startDate || !thisWeekInfo.endDate) throw new Error(`Invalid start/endDate based on ${todaysDateISOString} + ${counter} - ${numWeeks}, so can't continue`)
          const weekStartDate = thisWeekInfo.startDate
          const weekEndDate = thisWeekInfo.endDate
          const weekStartDateStr = hyphenatedDateString(weekStartDate)
          const weekEndDateStr = hyphenatedDateString(weekEndDate)
          logDebug('weeklyStatsMermaid', `-> ${String(counter)}: ${weekStartDateStr} -  ${weekEndDateStr}`)
          const thisWeekValue = occ.summaryTextForInterval(weekStartDateStr, weekEndDateStr, 'week', 'single')
          thisOccValueArr.push(thisWeekValue)
        }
        outputArray.push(`\tline "${occ.term}" [${thisOccValueArr.join(', ')}]`)
      }

      // Write out to fixed note in plugin data directory
      DataStore.saveData(outputArray.join('\n'), filename, true)
      logInfo('weeklyStatsMermaid', `Written results to data file '${filename}'`)
      logDebug('weeklyStatsMermaid', `Output:\n${outputArray.join('\n')}`)
    } else {
      logInfo(pluginJson, `No relevant data found in time range ${fromDateStr} - ${toDateStr}. No output file written.`)
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

  }
  catch (err) {
    logError(pluginJson, `weeklyStatsMermaid: ${err.message}`)
  }
}
