// @flow
//-----------------------------------------------------------------------------
// Create heatmap charts to use through NP HTML window.
// Jonathan Clark, @jgclark
// Last updated 6.10.2023 for v0.20.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  gatherOccurrences,
  generateProgressUpdate,
  getSummariesSettings,
  type OccurrencesConfig,
  TMOccurrences,
  type SummariesConfig
} from './summaryHelpers'
import {
  generateTaskCompletionStats,
  getFirstDateForWeeklyStats
} from './forCharts'
import {
  calcWeekOffset,
  getDateObjFromDateString,
  getDateStringFromCalendarFilename,
  getISODateStringFromYYYYMMDD,
  getJSDateStartOfToday,
  getTodaysDateHyphenated,
  getWeek,
  hyphenatedDate,
  hyphenatedDateString,
  RE_ISO_DATE,
  todaysDateISOString, // const
  toISODateString,
  unhyphenatedDate,
  isoWeekStartEndDates,
  withinDateRange,
} from '@helpers/dateTime'
import { getNPWeekData, localeDateStr, pad, setMomentLocaleFromEnvironment } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { showHTMLV2 } from '@helpers/HTMLView'
import { getLocale } from '@helpers/NPConfiguration'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------
const pluginID = 'jgclark.Summaries'

type HeatmapDefinition =
  {
    tagName: string,
    intervalType: string,
    colorScaleRange: string, // JSON string
    fromDateStr: string,
    toDateStr: string,
    numberIntervals: number,
  }

export async function testJGCHeatmaps(): Promise<void> {
  try {
    logDebug(pluginJson, `testJGCHeatmaps: starting`)
    const config = await getSummariesSettings()

    // Get date range to use
    const toDateStr = todaysDateISOString
    let [fromDateStr, numWeeks] = getFirstDateForWeeklyStats(config.weeklyStatsDuration)

    const heatmapDefinitions: Array<HeatmapDefinition> = [
      {
        tagName: '@sleep',
        intervalType: 'day',
        colorScaleRange: '["#FFFFFF", "#23A023"]',
        numberIntervals: 20,
        fromDateStr: fromDateStr,
        toDateStr: toDateStr
      },
      {
        tagName: '@work',
        intervalType: 'day',
        colorScaleRange: '["#FFFFFF", "#932093" ]',
        numberIntervals: 20,
        fromDateStr: fromDateStr,
        toDateStr: toDateStr
      }
    ]

    for (const thisHM of heatmapDefinitions) {
      logDebug(pluginJson, `Calling showTagHeatmap(${thisHM.tagName}):`)
      await showTagHeatmap(thisHM)
    }
  } catch (e) {
    logError(pluginJson, `testJGCHeatmaps: ${e.message}`)
  }
}

/**
 * Create and display a heatmap for a given tag/mention.
 * Can pass a {HeatmapDefinition} object, or a stringified version of one. If none given, it will prompt for a tag/mention name to use, and other defaults will be used.
 * @param {HeatmapDefinition | string} heatmapDefArg (optional) either a definition object, or a stringified version of one
 * @returns
 */
export async function showTagHeatmap(heatmapDefArg: HeatmapDefinition | string = ''): Promise<void> {
  try {
    const config = await getSummariesSettings()

    // Set some default values
    const [fromDateStrDefault, numWeeksDefault] = getFirstDateForWeeklyStats(config.weeklyStatsDuration)
    const toDateStrDefault = todaysDateISOString
    const numberIntervalsDefault = 180

    // Set up heatmap definition, from passed parameter, or from asking user and setting defaults
    // Note: parameter can come as string (from callback) or object (from other functions)
    let heatmapDef: HeatmapDefinition
    let tagName = ''
    if (typeof heatmapDefArg === "string" && heatmapDefArg !== '') {
      const unencodedHeatmapDefInStr = decodeURIComponent(heatmapDefArg)
      heatmapDef = JSON.parse(unencodedHeatmapDefInStr) ?? null
      tagName = heatmapDef.tagName
    } else if (typeof heatmapDefArg === "object" && heatmapDefArg !== null) {
      heatmapDef = heatmapDefArg
      tagName = heatmapDefArg.tagName
    } else {
      // no heatmapDefArg given, so ask user for tagName
      tagName = await getInput('tagName')
      if (tagName === null || typeof tagName !== 'string') {
        logInfo('showTagHeatmap', 'User cancelled, or no tag name entered.')
        return
      }
      heatmapDef = {
        tagName: tagName,
        intervalType: 'day',
        colorScaleRange: '["#FFFFFF", "#2323A0"]',
        numberIntervals: numberIntervalsDefault,
        fromDateStr: fromDateStrDefault,
        toDateStr: toDateStrDefault,
      }
    }
    const numWeeks = (heatmapDef.intervalType === 'week')
      ? heatmapDef.numberIntervals
      : heatmapDef.numberIntervals / 7.0

    logDebug('showTagHeatmap', `- starting for ${tagName} for (${heatmapDef.fromDateStr} to ${heatmapDef.toDateStr}) ...`)
    clo(heatmapDef, 'heatmapDef')

    // Gather data for the tagName of interest
    // start a timer and spinner
    CommandBar.showLoading(true, `Generating ${tagName} stats ...`)
    const startTime = new Date()
    await CommandBar.onAsyncThread()

    // Gather data for the tagName of interest
    const occConfig: OccurrencesConfig = {
      GOYesNo: [],
      GOHashtagsCount: [],
      GOHashtagsAverage: [],
      GOHashtagsTotal: tagName.startsWith('#') ? [tagName] : [],
      GOHashtagsExclude: [],
      GOMentionsCount: [],
      GOMentionsAverage: [],
      GOMentionsTotal: tagName.startsWith('@') ? [tagName] : [],
      GOMentionsExclude: [],
    }
    const tagOccurrences: Array<TMOccurrences> = gatherOccurrences(`${heatmapDef.numberIntervals} days`, heatmapDef.fromDateStr, heatmapDef.toDateStr, occConfig)

    if (tagOccurrences.length === 0) {
      logError('showTagHeatmap', 'No tagOccurrence object returned from gatherOccurrences() with ...')
      clo(occConfig, 'occConfig')
      return
    }
    const thisTagOcc = tagOccurrences[0]
    // clo(thisTagOcc, `thisTagOcc`)
    // thisTagOcc.logValuesMap()

    // end timer & spinner
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('showTagHeatmap', `Duration: ${timer(startTime)}`)

    const thisStatsMap = new Map([...thisTagOcc.valuesMap].sort())
    logInfo('showTagHeatmap', `-> ${thisTagOcc.getNumberItems()} statsMap items.`)

    // Calc total from the period
    let total = 0
    let count = 0
    for (let item of thisStatsMap) {
      const isoDate = item[0]
      const value = item[1]
      if (!isNaN(value)) {
        total += value
        count++
      }
    }

    const dailyAverage = total / count
    const weeklyAverage = total / (thisTagOcc.getNumberItems() / 7) // not as simple as count/7

    const locale = getLocale({})
    const IntlOpts = { maximumFractionDigits: 1, minimumSignificantDigits: 2, maximumSignificantDigits: 3 }
    const fromDateLocale = moment(heatmapDef.fromDateStr, 'YYYY-MM-DD').format('L') ?? '?' // uses moment's locale info
    logDebug('showTagHeatmap', `fromDateLocale: ${fromDateLocale}`)
    const statsStr = `total: ${total.toLocaleString(locale, IntlOpts)}, count: ${count.toLocaleString(locale, IntlOpts)}, daily ave: ${dailyAverage.toLocaleString(locale, IntlOpts)}, weekly ave: ${weeklyAverage.toLocaleString(locale, IntlOpts)}`
    logDebug('showTagHeatmap', statsStr)

    // Generate the heatmap
    await generateHeatMap(
      `${tagName} heatmap`,
      `${tagName} from ${fromDateLocale}\\n(${statsStr})`, // can't include a \n character here
      thisStatsMap,
      heatmapDef.colorScaleRange,
      heatmapDef.intervalType,
      heatmapDef.fromDateStr,
      heatmapDef.toDateStr,
      `${heatmapDef.tagName}-heatmap.htnl`,
      `${pluginID}.${heatmapDef.tagName}-heatmap`
    )
  } catch (e) {
    logError(pluginJson, `showTagHeatmap: ${e.name}: ${e.message}`)
  }
}

/**
 * Get Map of data for tagName (hashtags or mentions) from daily notes over given date range.
 * @author @jgclark
 * @param {string} tagName
 * @param {'day' | 'week'} intervalType
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @return {Map<string, number>>}
 */
export async function calcTagStatsMap(
  tagName: string,
  intervalType: 'day' | 'week',
  fromDateStr: string,
  toDateStr: string
): Promise<Map<string, number>> {
  try {
    logDebug(pluginJson, `calcTagStatsMap: starting for '${tagName}' for interval ${intervalType} ...`)

    if (intervalType === 'day') {
      const fromDateMoment = moment(fromDateStr, 'YYYY-MM-DD')
      const toDateMoment = moment(toDateStr, 'YYYY-MM-DD')
      const daysInInterval = toDateMoment.diff(fromDateStr, 'day')

      // start a timer and spinner
      CommandBar.showLoading(true, `Generating ${tagName} stats ...`)
      const startTime = new Date()
      await CommandBar.onAsyncThread()

      // Gather data for the tagName of interest
      // dateCounterMap.set(key, value)
      const occConfig: OccurrencesConfig = {
        GOYesNo: [],
        GOHashtagsCount: [],
        GOHashtagsAverage: [],
        GOHashtagsTotal: tagName.startsWith('#') ? [tagName] : [],
        GOHashtagsExclude: [],
        GOMentionsCount: [],
        GOMentionsAverage: [],
        GOMentionsTotal: tagName.startsWith('@') ? [tagName] : [],
        GOMentionsExclude: [],
      }
      const tagOccurrences: Array<TMOccurrences> = gatherOccurrences('day ?', fromDateStr, toDateStr, occConfig)
      const thisTagOcc = tagOccurrences[0]

      // end timer & spinner
      await CommandBar.onMainThread()
      CommandBar.showLoading(false)
      logDebug('generateTaskCompletionStats', `Duration: ${timer(startTime)}`)
      // thisTagOcc.logValuesMap()

      // Copying the existing object, which is the easiest way to re-order by date
      let outputMap = new Map([...thisTagOcc.valuesMap].sort())
      logInfo('calcTagStatsMap', `-> ${outputMap.size} statsMap items.`)

      return outputMap
    } else {
      throw new Error('Unsupported interval type: ' + intervalType)
    }

    // // Calc total completed in period
    // let total = 0
    // for (let item of statsMap) {
    //   const isoDate = item[0]
    //   const value = item[1]
    //   if (withinDateRange(isoDate, fromDateStr, toDateStr)) {
    //     // this test ignores any blanks on the front (though they will be 0 anyway)
    //     total += (!isNaN(value)) ? value : 0
    //   }
    // }

  } catch (err) {
    logError(pluginJson, `calcTagStatsMap: ${err.name}: ${err.message}`)
    return new Map()
  }
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
  statsMap: Map<string, number>,
  colorScaleRange: string = '["#FFFFFF", "#03B003"]',
  intervalType: string,
  fromDateStr: string,
  toDateStr: string,
  filenameToSave: string,
  windowID: string,
): Promise<void> {
  try {
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
      const tempDate = item[0]
      const isoDate = (tempDate.match(RE_ISO_DATE)) ? tempDate : getISODateStringFromYYYYMMDD(tempDate)
      const value = item[1]
      // logDebug('', `- ${isoDate}: ${value}`)
      const mom = moment(isoDate, 'YYYY-MM-DD')
      // const weekNum = Number(mom.format('WW')) // moment week number
      const weekInfo = getNPWeekData(mom.toDate()) ?? {}
      const weekNum = weekInfo.weekNumber // NP week number
      // Get string for heatmap column title: week number, or year number if week 1
      const weekTitle = (weekNum !== 1) ? 'W' + pad(weekNum) : mom.format('YYYY') // with this library the value needs to be identical all week
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
    height: 100%;
    margin: 0px;
    padding: 0px;
    color: var(--fg-main-color); /* doesn't do anything */
    background-color: var(--bg-main-color); /* doesn't do anything */
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

      // create and configure the color scale. Requires array of 2 RGB colour values
      var customColorScale = anychart.scales.linearColor();
      customColorScale.colors(${colorScaleRange});

      // set the color scale as the color scale of the chart
      chart.colorScale(customColorScale);

      // set the container id
      chart.container("container");

      // turn the labels off
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
    const winOpts = {
      windowTitle: windowTitle,
      width: 600,
      height: 304,
      generalCSSIn: '', // i.e. generate from theme
      specificCSS: heatmapCSS,
      preBodyScript: preScript,
      postBodyScript: '',
      customId: windowID,
      savedFilename: filenameToSave,
      makeModal: false,
      reuseUsersWindowRect: true,
      shouldFocus: true
    }
    const res = await showHTMLV2(body, winOpts)

    logInfo('generateHeatmap', `Shown window titled '${chartTitle}'`)

  }
  catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Create heatmap of task completion for last config.weeklyStatsDuration weeks (or if not specified, a sensible period between 6 and 12 months).
 * @author @jgclark
 */
export async function showTaskCompletionHeatmap(): Promise<void> {
  const config = await getSummariesSettings()

  // Work out time interval to use
  const toDateStr = todaysDateISOString
  let [fromDateStr, numWeeks] = getFirstDateForWeeklyStats(config.weeklyStatsDuration)
  logDebug('generateHeatMap', `generateHeatMap: starting for ${String(numWeeks)} weeks (${fromDateStr} to ${toDateStr}) ...`)

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

  setMomentLocaleFromEnvironment() // not sure why this is needed as it is in the next function.
  const fromDateLocale = localeDateStr(moment(fromDateStr, 'YYYY-MM-DD')) // uses moment's locale info
  await generateHeatMap(
    'NotePlan Task Completion Heatmap',
    `Task Completion Heatmap (${total.toLocaleString()} since ${fromDateLocale})`,
    statsMap,
    '["#F4FFF4", "#10B010"]',
    'day',
    fromDateStr,
    toDateStr,
    "task-completion-heatmap.html",
    `${pluginID}.task-completion-heatmap`
  )
}
