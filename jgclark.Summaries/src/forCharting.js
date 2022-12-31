// @flow
//-----------------------------------------------------------------------------
// Create heatmap chart to use with NP HTML, and before then
// weekly stats for a number of weeks, and format ready to use by gnuplot.
// Jonathan Clark, @jgclark
// Last updated 6.11.2022 for v0.15.1, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type SummariesConfig
} from './summaryHelpers'
import {
  calcWeekOffset,
  getDateObjFromDateString,
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  getWeek,
  hyphenatedDate,
  hyphenatedDateString,
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  RE_DONE_DATE_TIME_CAPTURES,
  toISODateString,
  unhyphenatedDate,
  weekStartEnd,
  withinDateRange,
} from '@helpers/dateTime'
import { getUsersFirstDayOfWeekUTC } from '@helpers/NPdateTime'
import { logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'
import { clearNote, getOrMakeNote } from '@helpers/note'
import { projectNotesFromFilteredFolders } from '@helpers/NPnote'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Print to log the output of a generateTaskCompletionStats() call
 * @author @jgclark
 */
export async function testGenStats(): Promise<void> {
  const config = await getSummariesSettings()
  const fromDate = moment().startOf('year')
  const fromDateStr = fromDate.format('YYYY-MM-DD')
  const todayDate = moment().startOf('day')
  const todayDateStr = todayDate.format('YYYY-MM-DD')

  const statsMap = await generateTaskCompletionStats(config.foldersToExclude, 'day', fromDateStr) // year to date
  logDebug('generateTaskCompletionStats()', "Output:")
  for (let entry of statsMap) {
    console.log(entry)
  }
}

/**
 * Create heatmap of task completion for last config.weeklyStatsDuration weeks (or if not specified, a sensible period between 6 and 12 months).
 * @author @jgclark
 */
export async function showTaskCompletionHeatmap(): Promise<void> {
  const config = await getSummariesSettings()

  // Work out time interval to use
  const toDateStr = moment().startOf('day').format('YYYY-MM-DD')
  let fromDateStr = ''
  if (config.weeklyStatsDuration !== null && config.weeklyStatsDuration > 0) {
    // Look back the specified number of weeks
    fromDateStr = moment().subtract(config.weeklyStatsDuration, 'week').format('YYYY-MM-DD')
  }
  else {
    // If not specified, then up to 12 months ago ...
    const dayOfYear = moment().format('DDD')
    if (dayOfYear > 182) {
      fromDateStr = moment().startOf('year').format('YYYY-MM-DD')
    } else {
      fromDateStr = moment().subtract(6, 'month').format('YYYY-MM-DD')
    }
  }
  logDebug('generateHeatMap', `Generating heatmap for ${fromDateStr} to ${toDateStr} from c.WSD ${config.weeklyStatsDuration}...`)

  const statsMap = await generateTaskCompletionStats(config.foldersToExclude, 'day', fromDateStr) // to today

  // Calc total completed in period
  let total = 0
  for (let item of statsMap) {
    const isoDate = item[0]
    const value = item[1]
    if (withinDateRange(isoDate, fromDateStr, toDateStr)) {
      // this test ignores any blanks on the front (though they will be 0 anyway)
      total += (!isNaN(value)) ? value : 0
    }
  }

  await generateHeatMap(
    'NotePlan Task Completion Heatmap',
    `Task Completion Heatmap (${total.toLocaleString()} since ${moment(fromDateStr, 'YYYY-MM-DD').format('L')})`, // i.e. locale date (according to moment)
    config.foldersToExclude,
    statsMap,
    '["#F4FFF4", "#10B010"]',
    'day',
    fromDateStr,
    toDateStr,
    "task-completion-heatmap.html"
  )
}

/**
 * Create a heatmap for the specified time period, using data returned from the specified function. Covers all notes, other than in @special folders and any in foldersToExclude.
 * Incorporating heatmap charting from AnyChart demo (details at https://www.anychart.com/blog/2020/02/26/heat-map-chart-create-javascript/) with addition of
 * - horizontal scroller (https://docs.anychart.com/Common_Settings/Scroller) 
 * - and tooltips (https://docs.anychart.com/Basic_Charts/Heat_Map_Chart#formatting_functions).
 * Note: Using trial (and watermarked) version of Anychart. I need to find a different solution for the longer term.
 * Note: This AnyChart code isn't designed for time series, so doesn't really cope with missing data points, particularly if at the start of the (throws off Y axis) or a whole week (throws off X axis).
 * @author @jgclark
 * @param {string} windowTitle
 * @param {string} chartTitle
 * @param {Array<string>} foldersToExclude which may be empty
 * @param {Map<string, number>} statsMap input data in a Map<isoDateString, number>
 * @param {string} colorScaleRange - defaults to white -> Pakistan Green
 * @param {string} intervalType - currently only supports 'day'
 * @param {string} fromDateStr - ISO date to start
 * @param {string} toDateStr - ISO date to end
 * @param {string} filenameToSave - if given save HTML output as a file as well
 */
export async function generateHeatMap(
  windowTitle: string,
  chartTitle: string,
  foldersToExclude: Array<string>,
  statsMap: Map<string, number>,
  colorScaleRange: string = '["#FFFFFF", "#03B003"]',
  intervalType: string,
  fromDateStr: string,
  toDateStr: string,
  filenameToSave: string
): Promise<void> {
  try {
    // const title = 'NotePlan Task Completion Heatmap'
    // const config = await getSummariesSettings()
    let fromDateStr = ''
    logDebug('generateHeatMap', `Generating heatmap for ${fromDateStr} to ${toDateStr} with ${statsMap.size} statsMap elements...`)

    /**
     * Munge data into the form needed:
        x = column name
        y = row name
        heat = value (including possibly NaN)
        isoDate = isoDate, for use in tooltips
     */
    const dataToPass = []
    for (let item of statsMap) {
      const isoDate = item[0]
      const value = item[1]
      // logDebug('', `- ${isoDate}: ${value}`)
      const mom = moment(isoDate, 'YYYY-MM-DD')
      const weekNum = Number(mom.format('WW'))
      // Get string for heatmap column title: week number, or year number if week 1
      const weekTitle = (weekNum !== 1) ? mom.format('[W]WW') : mom.format('YYYY') // with this library the value needs to be identical all week
      const dayAbbrev = mom.format('ddd') // day of week (0-6) is 'd'
      let dataPointObj = { x: weekTitle, y: dayAbbrev, heat: value, isoDate: isoDate }
      if (!withinDateRange(isoDate, fromDateStr, toDateStr)) {
        // one of the data points added on the start to get the layour right ... don't pass the date      
        dataPointObj.isoDate = ''
      }
      dataToPass.push(dataPointObj)
    }

    const dataToPassAsString = JSON.stringify(dataToPass)
    // logDebug('generateHeatMap', dataToPassAsString)

    const heatmapCSS = `html, body, #container {
    width: 100%;
    height: 270px; //100%
    margin: 0px;
    padding: 0px;
  }
  `
    const preScript = `<script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-core.min.js"></script>
  <script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-heatmap.min.js"></script>
`
    const body = `
  <div id="container"></div>
  <script>
    anychart.onDocumentReady(function () {
      // create the chart and set the data
      chart = anychart.heatMap(${dataToPassAsString});
      
      // set the chart title
      chart.title("${chartTitle}");
      
      // create and configure the color scale.
      var customColorScale = anychart.scales.linearColor();
      customColorScale.colors(${colorScaleRange});
      
      // set the color scale as the color scale of the chart
      chart.colorScale(customColorScale);
      
      // set the container id
      chart.container("container");
      
      // set the labels off
      chart.labels().enabled(false);

      // set the tooltip to the value
      var tooltip = chart.tooltip();
      tooltip.titleFormat('');
      tooltip.padding().left(20);
      tooltip.separator(false);
      tooltip.format(function () {
        if (this.heat != null && this.heat !== '' && !isNaN(this.heat)) {
          return this.heat + '\\nDate: ' + this.getData("isoDate");
        } else {
          return 'No data';
        }
      });
      
      chart.xScroller().enabled(true);
      chart.xZoom().setToPointsCount(36);

      // Add a legend and then draw
      chart.legend(true);
      chart.draw();
    });
</script>
`
    showHTML(windowTitle,
      '',
      body,
      '', // generate CSS from theme
      heatmapCSS,
      false, // not modal
      preScript,
      '',
      filenameToSave, // can be empty
      600, 260
    )

    logDebug('generateTaskCompletionStats', `Shown window '${chartTitle}'`)

  }
  catch (error) {
    logError(pluginJson, error.message)
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
export async function generateTaskCompletionStats(foldersToExclude: Array<string>, intervalType: string, fromDateStr: string, toDateStr: string = getTodaysDateHyphenated()): Promise<Map<string, number>> {
  try {

    // Initialise a Map to hold count of completed dates
    // v1.  Start with a simple empty Map
    const dateCounterMap = new Map < string, number> ()
    // Set up a function that sums occurences(in value) of key(date).
    // const addToObj = key => {
    //   // $FlowIgnore[unsafe-addition]
    //   dateCounterMap.set(key, (dateCounterMap.has(key) ? (dateCounterMap.get(key)) + 1 : 1))
    // }

    // v2. Initialise a Map for all dates of interest, with NaN values (to distinguish from zero).
    const fromDateMoment = moment(fromDateStr, 'YYYY-MM-DD')
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
      // $FlowIgnore[unsafe-addition]
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
    for (let n of projNotes) {
      const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
      for (let dp of doneParas) {
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
    for (let item of dateCounterMap) {
      if (!isNaN(item[1]) && item[1] !== '') {
        totalProjectDone += Number(item[1])
      }
    }
    logDebug('generateTaskCompletionStats', `-> ${totalProjectDone} done tasks from all Project notes`)

    // Do completed task (not checklist) counts from all Calendar Notes from that period
    // $FlowIgnore[incompatible-call]
    const periodCalendarNotes = DataStore.calendarNotes.filter((n) => withinDateRange(toISODateString(n.date), fromDateStr, toDateStr))
    if (periodCalendarNotes.length > 0) {
      for (let n of periodCalendarNotes) {
        const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
        for (let dp of doneParas) {
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
          // $FlowIgnore[incompatible-call]
          if (doneDate && withinDateRange(doneDate, fromDateStr, toDateStr)) {
            addToObj(doneDate)
          }
        }
      }

      // As tasks can be completed on dates later than the daily note it resides in, we need to look at calendar notes from (say) the previous 6 months of daily and weekly notes.
      // This time, only get proper '@done(...)' dates.
      const earlierFromDateStr = moment(fromDateStr, 'YYYY-MM-DD').subtract(6, 'months').format('YYYY-MM-DD')
      const earlierToDateStr = moment(fromDateStr, 'YYYY-MM-DD').subtract(1, 'days').format('YYYY-MM-DD')
      // $FlowIgnore[incompatible-call]
      const beforePeriodCalendarNotes = DataStore.calendarNotes.filter((n) => withinDateRange(toISODateString(n.date), earlierFromDateStr, earlierToDateStr))
      logDebug('generateTaskCompletionStats', `Summarising for ${beforePeriodCalendarNotes.length} calendar notes (looking 6 months before given fromDate)`)

      for (let n of beforePeriodCalendarNotes) {
        const doneParas = n.paragraphs.filter((p) => p.type.includes('done'))
        for (let dp of doneParas) {
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
    for (let item of dateCounterMap) {
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
    const numBlanksToAdd = (fromDateDayOfWeek - 1) // TODO: test other start-day-of-week options
    logDebug('generateTaskCompletionStats', `- numBlanksToAdd = ${numBlanksToAdd}`)
    if (numBlanksToAdd > 0) {
      for (let i = numBlanksToAdd; i > 0; i--) {
        const thisDate = moment(fromDateStr, 'YYYY-MM-DD').subtract(i, 'days').format('YYYY-MM-DD')
        dateCounterMap.set(thisDate, NaN) // or NaN or something to indicate this is a placeholder
        logDebug('generateTaskCompletionStats', `- added blank entry for ${thisDate}`)
      }
    }

    // Copying the existing object, which is the easiest way to re-order by date
    let outputMap = new Map([...dateCounterMap].sort())
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
 * TODO: also add single blank line to notate missing data point(s)
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
 * weeks, and write as a CSV table, ready for charting by gnuplot.
 * Only the specifically 'included' hashtags or mentions are included, as given by those settings.
 * @author @jgclark
 */
export async function weeklyStats(): Promise<void> {
  try {
    let config = await getSummariesSettings()

    let period: number
    let startWeek: number
    let startYear: number
    let endWeek: number
    let endYear: number
    const todaysDate = new Date()
    const thisWeek = getWeek(todaysDate)
    let thisYear = todaysDate.getFullYear()

    // If preference for weekly stats duration is not given,
    // ask user what time interval to do tag counts for
    if (config.weeklyStatsDuration === null) {
      period = await chooseOption < number > (
        'Select which time period to cover',
        [
          {
            label: 'This week so far',
            value: 0,
          },
          {
            label: 'Last Week to now',
            value: 1,
          },
          {
            label: 'Last Month',
            value: 4,
          },
          {
            label: 'Last 3 Months',
            value: 13,
          },
          {
            label: 'Last 6 Months',
            value: 26,
          },
          {
            label: 'Last 12 Months',
            value: 52,
          },
          {
            label: 'Other Interval',
            value: NaN,
          },
        ],
        52,
    )
    } else {
      // but use pref if given
      period = config.weeklyStatsDuration ?? 23 // should never need this fallback
    }
    endYear = thisYear
    if (period === NaN) {
      // Ask for more detailed week range, and calculate start/end dates
      startYear = Number(await getInput('Choose starting year, e.g. 2021', 'OK'))
      startWeek = Number(await getInput('Choose starting week number, 1-53', 'OK'))
      endYear = Number(await getInput('Choose ending year, e.g. 2021', 'OK'))
      endWeek = Number(await getInput('Choose ending week number, 1-53', 'OK'))
      period = (endYear - startYear) * 52 + (endWeek - startWeek) // in weeks
    } else {
      // Calculate week range from answer, asking for date offset _before_ current week
      const currentWeekNum = getWeek(todaysDate)
      // First deal with edge case: after start of ordinal year but before first week starts
      if (
        currentWeekNum === 52 && // i.e. last week of the year AND
        todaysDate.getMonth() == 0
      ) {
        // i.e. first month of the year (counting from 0)
        thisYear -= 1
      }
      let answer = calcWeekOffset(thisWeek, thisYear, Number(-period))
      startYear = answer.year
      startWeek = answer.week
      endYear = thisYear
      endWeek = thisWeek
    }
    const periodString = `${startYear}W${startWeek} - ${endYear}W${endWeek}`
    logInfo(pluginJson, `weeklyStats: calculating for ${periodString} (${period} weeks)`)

    // Pop up UI wait dialog as this can be a long-running process
    CommandBar.showLoading(true, `Calculating weekly stats over ${period} weeks`)
    await CommandBar.onAsyncThread()

    let hResultsArray = []
    let mResultsArray = []
    let hOccs = []
    let mOccs = []

    // For every week of interest calculate stats and add to the two output arrays
    let w = startWeek
    let y = startYear
    let counter = 0
    while (counter < period) {
      // increment which week/year we're looking at, and get the actual dates to use
      let answer = calcWeekOffset(w, y, +1)
      w = answer.week
      y = answer.year
      counter++
      logDebug(pluginJson, `${counter}: w ${w} y ${y}`)
      const [weekStartDate, weekEndDate] = weekStartEnd(w, y)

      // Calc hashtags stats (returns two maps)
      let weekResults = await calcHashtagStatsPeriod(unhyphenatedDate(weekStartDate), unhyphenatedDate(weekEndDate), config.includeHashtags, [])

      const hCounts = weekResults?.[0]
      const hSumTotals = weekResults?.[1]
      if (hSumTotals == null || hCounts == null) {
        logWarn(pluginJson, 'no hSumTotals / hCounts values')
        continue
      }

      // First process more complex 'SumTotals', calculating appropriately
      for (const [key, value] of hSumTotals) {
        // .entries() implied
        const hashtagString = key
        const count = hCounts.get(key)
        if (count != null) {
          const total: string = value.toFixed(0)
          const average: string = (value / count).toFixed(1)
          hResultsArray.push(`${hashtagString},${hyphenatedDateString(weekStartDate)},${average},${count},${total}`)
          hCounts.delete(key) // remove the entry from the next map, as not longer needed
        }
      }
      // Then process simpler 'Counts'
      for (const [key, value] of hCounts) {
        // .entries() implied
        const hashtagString = key
        hResultsArray.push(`${hashtagString},${hyphenatedDateString(weekStartDate)},${value}`)
      }

      // ------------------------------------------------------------------
      // Calc mentions stats (returns two maps)
      weekResults = await calcMentionStatsPeriod(
        unhyphenatedDate(weekStartDate),
        unhyphenatedDate(weekEndDate),
        // $FlowIgnore[invalid-tuple-arity]
        config.includeMentions,
        [],
      )
      const mCounts = weekResults?.[0]
      const mSumTotals = weekResults?.[1]
      if (mCounts == null || mSumTotals == null) {
        continue
      }
      // First process more complex 'SumTotals', calculating appropriately
      for (const [key, value] of mSumTotals) {
        // .entries() implied
        const mentionString = key
        const count = mCounts.get(key)
        if (count != null) {
          const total = value.toFixed(0)
          const average = (value / count).toFixed(1)
          mResultsArray.push(`${mentionString},${hyphenatedDateString(weekStartDate)},${average},${count},${total}`)
          mCounts.delete(key) // remove the entry from the next map, as not longer needed
        }
      }
      // Then process simpler 'Counts'
      for (const [key, value] of mCounts) {
        const mentionString = key
        mResultsArray.push(`${mentionString},${hyphenatedDateString(weekStartDate)},${value}`)
      }

      // Update UI wait dialog
      CommandBar.showLoading(true, `Calculating weekly stats over ${period} weeks`, counter / period)
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    let hOutputArray: Array<string> = []
    // If there are no Hashtags results, log warning, otherwise process ready for output
    if (hResultsArray.length > 0) {
      hResultsArray.sort()
      // Reformat array to group into separate datasets (in the same file)
      hOutputArray = formatForSimpleCSV(hResultsArray)
    } else {
      logInfo(pluginJson, `no Hashtags found in weekly summaries`)
    }

    let mOutputArray: Array<string> = []
    // If there are no Mentions results, log warning, otherwise process ready for output
    if (mResultsArray.length > 0) {
      mResultsArray.sort()
      // Reformat array to group into separate datasets (in the same file)
      mOutputArray = formatForSimpleCSV(mResultsArray)
    }
    else {
      logInfo(pluginJson, `no Mentions found in weekly summaries`)
    }

    // Get note to write out to
    const thisTitle = `Weekly stats ${periodString}`
    const noteTitle = 'weekly_stats'
    const note = await getOrMakeNote(noteTitle, config.folderToStore)
    if (note == null) {
      logError(pluginJson, `Can't get new note`)
      await showMessage('There was an error getting the new note ready to write')
      return
    }

    // Unlike other Summary-type commands, just empty any previous note contents
    clearNote(note)
    const insertionLineIndex = 1
    note.insertParagraph(mOutputArray.join('\n'), 1, 'text')
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}

/**
 * Generate stats for the specified mentions and hashtags over a period of consecutive
 * weeks, and write as a CSV table, ready for plotting (not gnuplot this time).
 * Only the specifically 'included' hashtags or mentions are included, as given by those settings.
 * @author @jgclark
 */
export async function weeklyStats2(): Promise<void> {
  try {
    let config = await getSummariesSettings()

    // Get number of weeks to look back over
    let weeks = config.weeklyStatsDuration ?? 23 // should never need this fallback
    // Calc range of dates this implies
    const todayMom = moment()
    // const endOfLastWeekMom = startOfThisWeekMom.subtract(1, 'days')
    const toDateStr = todayMom.toISOString(true)
    const toWeekStr = todayMom.format('YYYY-[W]WW')
    let toWeek = todayMom.isoWeek()
    let toYear = todayMom.year()

    // FIXME: decide whether to include current part-week or not (currently not it seems)
    // FIXME: add separate setting for which ones to include

    const startOfThisWeekMom = todayMom.startOf('week')
    const startOfPeriodMom = startOfThisWeekMom.subtract(weeks, 'weeks')
    const fromDateStr = startOfPeriodMom.toISOString(true)
    const fromWeekStr = startOfPeriodMom.format('YYYY-[W]WW')
    let fromWeek = startOfPeriodMom.isoWeek()
    let fromYear = startOfPeriodMom.year()
    // const todaysDate = new Date()
    // const thisWeek = getWeek(todaysDate)
    // let thisYear = todaysDate.getFullYear()


    // Calculate week range from answer, asking for date offset _before_ current week
    // endYear = thisYear
    // const currentWeekNum = getWeek(todaysDate)
    // First deal with edge case: after start of ordinal year but before first week starts
    // if (
    //   currentWeekNum === 52 && // i.e. last week of the year AND
    //   todaysDate.getMonth() == 0
    // ) {
    //   // i.e. first month of the year (counting from 0)
    //   thisYear -= 1
    // }
    // let answer = calcWeekOffset(thisWeek, thisYear, Number(-period))
    // fromYear = answer.year
    // fromWeek = answer.week
    // toYear = thisYear
    // toWeek = thisWeek

    const periodString = `${fromYear}W${fromWeek} - ${toYear}W${toWeek}`
    logDebug(pluginJson, `weeklyStats: calculating for ${periodString} (${weeks} weeks)`)
    logDebug(pluginJson, `${fromDateStr} - ${toDateStr}`)

    // Pop up UI wait dialog as this can be a long-running process
    CommandBar.showLoading(true, `Preparing weekly stats over ${weeks} weeks`)
    await CommandBar.onAsyncThread()

    // Gather all the appropriate occurrences of the wanted terms
    CommandBar.showLoading(true, `Gathering relevant #hashtags and @mentions`)
    // FIXME: need to specify three different items here to pick out total/count/average.
    let occs = await gatherOccurrences(
      'period',
      fromDateStr, toDateStr, // YYYY-MM-DD
      [], [],
      [], [],
      [], config.weeklyStatsItems, [], [])

    // For every week of interest calculate stats and add to the two output arrays
    let outputArray = []
    let i = 0
    if (occs.length > 0) {
      for (let occ of occs) {
        // Update UI wait dialog
        i++
        CommandBar.showLoading(true, `Calculating stats for ${occs.length} terms of interest`, i / occs.length)
        let w = fromWeek
        let y = fromYear
        let counter = 0
        while (counter < weeks) {
          // increment which week/year we're looking at, and get the actual dates to use      
          let answer = calcWeekOffset(w, y, +1)
          w = answer.week
          y = answer.year
          counter++
          logDebug(pluginJson, `${counter}: w ${w} y ${y}`)
          const [weekStartDate, weekEndDate] = weekStartEnd(w, y)
          const weekSummaryCSV = occ.summariseToInterval(toISODateString(weekStartDate), toISODateString(weekEndDate), 'week')
          outputArray.push(weekSummaryCSV)
        }
      }
    } else {
      logInfo(pluginJson, `no data found in weekly summaries`)
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Write out to fixed note in plugin data directory
    const filename = 'weekly_stats.csv'
    DataStore.saveData(outputArray.join('\n'), filename, true)
    logInfo(pluginJson, `  written results to data file '${filename}'`)
  }
  catch (err) {
    logError(pluginJson, err.message)
  }
}
