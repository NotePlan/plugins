// @flow
//-----------------------------------------------------------------------------
// Tests for Heatmap Generation stats + HTML
// Jonathan Clark, @jgclark
// Last updated 30.9.2022
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { getSummariesSettings } from './summaryHelpers'
import {
  getDateObjFromDateString,
  getWeek,
  withinDateRange
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { showHTML } from '@helpers/HTMLView'
import { generateTaskCompletionStats } from './forCharting'

//-----------------------------------------------------------------------------

/**
 * Test 1: use example data in a single block of HTML to call
 * From https://www.anychart.com/blog/2020/02/26/heat-map-chart-create-javascript/
 * Using trial (and watermarked) version of Anychart
 */
export function testHeatMapGeneration1(): void {
  const title = 'Heatmap Test 1'
  const chartTitle = 'Human Development Index by region (2011-2018)'
  const dataAsStr = `const data = [
    { x: "2011", y: "Arab States", heat: 0.681 },
    { x: "2011", y: "East Asia and the Pacific", heat: 0.700 },
    { x: "2011", y: "Europe and Central Asia", heat: 0.744 },
    { x: "2011", y: "Latin America and the Caribbean", heat: 0.737 },
    { x: "2011", y: "South Asia", heat: 0.593 },
    { x: "2011", y: "Sub-Saharan Africa", heat: 0.505 },
    { x: "2012", y: "Arab States", heat: 0.687 },
    { x: "2012", y: "East Asia and the Pacific", heat: 0.707 },
    { x: "2012", y: "Europe and Central Asia", heat: 0.750 },
    { x: "2012", y: "Latin America and the Caribbean", heat: 0.740 },
    { x: "2012", y: "South Asia", heat: 0.601 },
    { x: "2012", y: "Sub-Saharan Africa", heat: 0.512 },
    { x: "2013", y: "Arab States", heat: 0.688 },
    { x: "2013", y: "East Asia and the Pacific", heat: 0.714 },
    { x: "2013", y: "Europe and Central Asia", heat: 0.759 },
    { x: "2013", y: "Latin America and the Caribbean", heat: 0.748 },
    { x: "2013", y: "South Asia", heat: 0.607 },
    { x: "2013", y: "Sub-Saharan Africa", heat: 0.521 },
    { x: "2014", y: "Arab States", heat: 0.691 },
    { x: "2014", y: "East Asia and the Pacific", heat: 0.721 },
    { x: "2014", y: "Europe and Central Asia", heat: 0.766 },
    { x: "2014", y: "Latin America and the Caribbean", heat: 0.752 },
    { x: "2014", y: "South Asia", heat: 0.617 },
    { x: "2014", y: "Sub-Saharan Africa", heat: 0.527 },
    { x: "2015", y: "Arab States", heat: 0.695 },
    { x: "2015", y: "East Asia and the Pacific", heat: 0.727 },
    { x: "2015", y: "Europe and Central Asia", heat: 0.770 },
    { x: "2015", y: "Latin America and the Caribbean", heat: 0.754 },
    { x: "2015", y: "South Asia", heat: 0.624 },
    { x: "2015", y: "Sub-Saharan Africa", heat: 0.532 },
    { x: "2016", y: "Arab States", heat: 0.699 },
    { x: "2016", y: "East Asia and the Pacific", heat: 0.733 },
    { x: "2016", y: "Europe and Central Asia", heat: 0.772 },
    { x: "2016", y: "Latin America and the Caribbean", heat: 0.756 },
    { x: "2016", y: "South Asia", heat: 0.634 },
    { x: "2016", y: "Sub-Saharan Africa", heat: 0.535 },
    { x: "2017", y: "Arab States", heat: 0.699 },
    { x: "2017", y: "East Asia and the Pacific", heat: 0.733 },
    { x: "2017", y: "Europe and Central Asia", heat: 0.771 },
    { x: "2017", y: "Latin America and the Caribbean", heat: 0.758 },
    { x: "2017", y: "South Asia", heat: 0.638 },
    { x: "2017", y: "Sub-Saharan Africa", heat: 0.537 },
    { x: "2018", y: "Arab States", heat: 0.703 },
    { x: "2018", y: "East Asia and the Pacific", heat: 0.741 },
    { x: "2018", y: "Europe and Central Asia", heat: 0.779 },
    { x: "2018", y: "Latin America and the Caribbean", heat: 0.759 },
    { x: "2018", y: "South Asia", heat: 0.642 },
    { x: "2018", y: "Sub-Saharan Africa", heat: 0.541 },
  ];`

  const HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Basic JavaScript Heat Map Chart</title>
    <script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-core.min.js"></script>
    <script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-heatmap.min.js"></script>
    <style>
      html, body, #container {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="container"></div>
    <script>
      anychart.onDocumentReady(function () {
        ${dataAsStr}

        // create the chart and set the data
        chart = anychart.heatMap(data);

        // set the chart title
        chart.title("${chartTitle}");

        // create and configure the color scale.
        var customColorScale = anychart.scales.linearColor();
        customColorScale.colors(["#FFF0FF", "#20F220"]);

        // set the color scale as the color scale of the chart
        chart.colorScale(customColorScale);

        // set the container id
        chart.container("container");

        // Add a legend and then draw
        chart.legend(true);
        chart.draw();
      });
    </script>
  </body>
</html>
`
  HTMLView.showWindow(HTML, title)
  logDebug('generateTaskCompletionStats', `Shown window ${title}`)
}

/**
 * Test 2: use some real data in a single HTML code block
 * From https://www.anychart.com/blog/2020/02/26/heat-map-chart-create-javascript/
 * Using trial (and watermarked) version of Anychart.
 * Moment formatting: https://momentjs.com/docs/#/displaying/
 */
export async function testHeatMapGeneration2(): Promise<void> {
  const title = 'Heatmap Test 2'
  // Get daily data
  const config = await getSummariesSettings()
  const dayOfYear = moment().format('DDD')
  const dailyStatsMap = await generateTaskCompletionStats(config.foldersToExclude, 'day', moment().subtract(1, 'year').format('YYYY-MM-DD'))
  /**
   * Munge data into the form needed:
      x, where column names are set,
      y, where row names are set, and
      val, where values are set.
   */
  const dataToPass = []
  for (let item of dailyStatsMap) {
    const isoDate = item[0]
    const count = item[1]
    // logDebug('', `- ${isoDate}: ${count}`) // OK
    const mom = moment(isoDate, 'YYYY-MM-DD')
    const dayMonthAbbrev = mom.format('[W]WW') // wanted mom.format('D MMM') but in this library the value needs to be identical all week
    const dayAbbrev = mom.format('ddd') // day of week (0-6) is 'd'
    const dataPointObj = { x: dayMonthAbbrev, y: dayAbbrev, value: count }
    dataToPass.push(dataPointObj)
  }
  const dataToPassAsString = JSON.stringify(dataToPass)
  logDebug('', dataToPassAsString)
  const chartTitle = `Task Completion Stats (${title})`
  const HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-core.min.js"></script>
    <script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-heatmap.min.js"></script>
    <style>
      html, body, #container {
        width: 100%;
        height: 210px; //100%
        margin: 0px;
        padding: 0px;
      }
    </style>
  </head>
  <body>
    <div id="container"></div>
    <script>
      anychart.onDocumentReady(function () {
        // create the chart and set the data
        chart = anychart.heatMap(${dataToPassAsString});

        // set the chart title
        // chart.title("${chartTitle}");

        // create and configure the color scale.
        var customColorScale = anychart.scales.linearColor();
        customColorScale.colors(["#F4FFF4", "#00E400"]);

        // set the color scale as the color scale of the chart
        chart.colorScale(customColorScale);

        // set the container id
        chart.container("container");

        // set the label off
        chart.labels().enabled(false);

        // Add a legend and then draw
        chart.legend(true);
        chart.draw();
      });
    </script>
  </body>
</html>
`
  HTMLView.showWindow(HTML, title)
  logDebug('generateTaskCompletionStats', `Shown window ${title}`)
}

/**
 * Test 3: use some real data, and now using my showHTML() helper
 * From https://www.anychart.com/blog/2020/02/26/heat-map-chart-create-javascript/.
 * Now adds a horizontal scroller (https://docs.anychart.com/Common_Settings/Scroller) and tooltips (https://docs.anychart.com/Basic_Charts/Heat_Map_Chart#formatting_functions).
 * Using trial (and watermarked) version of Anychart.
 */
export async function testHeatMapGeneration3(): Promise<void> {
  const title = 'Heatmap Test 3'
  const config = await getSummariesSettings()
  // const dayOfYear = moment().format('DDD')
  const fromDateStr = moment().subtract(12, 'month').format('YYYY-MM-DD')
  const toDateStr = moment().startOf('day').format('YYYY-MM-DD')
  logDebug('testHeatMapGeneration3', `Generating heatmap for ${fromDateStr} to ${toDateStr} ...`)
  const dailyStatsMap = await generateTaskCompletionStats(config.foldersToExclude, 'day', fromDateStr)

  /**
   * Munge data into the form needed:
      x, where column names are set,
      y, where row names are set, and
      val, where values are set.
   */
  const dataToPass = []
  let total = 0
  for (let item of dailyStatsMap) {
    const isoDate = item[0]
    const count = item[1]
    // logDebug('', `- ${isoDate}: ${count}`) // OK
    const mom = moment(isoDate, 'YYYY-MM-DD')
    const weekNum = Number(mom.format('WW'))
    // Get string for heatmap column title: week number, or year number if week 1
    const weekTitle = (weekNum !== 1) ? mom.format('[W]WW') : mom.format('YYYY') // with this library the value needs to be identical all week
    const dayAbbrev = mom.format('ddd') // day of week (0-6) is 'd'
    let dataPointObj = { x: weekTitle, y: dayAbbrev, heat: count, isoDate: isoDate }
    if (withinDateRange(isoDate, fromDateStr, toDateStr)) {
      // this test ignores any blanks on the front (though they will be 0 anyway)
      total += item[1] // the count
    } else {
      dataPointObj.isoDate = null
    }
    dataToPass.push(dataPointObj)
  }

  const dataToPassAsString = JSON.stringify(dataToPass)
  // logDebug('', dataToPassAsString)
  const chartTitle = `Task Completion Stats (${total} from ${fromDateStr})`

  const heatmapCSS = `html, body, #container {
    width: 100%;
    height: 260px; //100%
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
      customColorScale.colors(["#F4FFF4", "#00E400"]);

      // set the color scale as the color scale of the chart
      chart.colorScale(customColorScale);

      // set the container id
      chart.container("container");

      // set the labels off
      chart.labels().enabled(false);

      // set the tooltip to the value // TODO: For some reason this breaks it
      var tooltip = chart.tooltip();
      tooltip.titleFormat('');
      tooltip.padding().left(20);
      tooltip.separator(false);
      tooltip.format(function () {
        return this.heat + '\\nDate: ' + this.getData("isoDate");
      });

      chart.xScroller().enabled(true);
      chart.xZoom().setToPointsCount(36);

      // Add a legend and then draw
      chart.legend(true);
      chart.draw();
    });
</script>
`
  showHTML(title,
    '',
    body,
    ' ', // generate CSS from theme
    heatmapCSS,
    false, // not modal
    preScript,
    '',
    "test-heatmap-gen-3.html",
    600, 260
  )

  logDebug('generateTaskCompletionStats', `Shown window ${title}`)
}
