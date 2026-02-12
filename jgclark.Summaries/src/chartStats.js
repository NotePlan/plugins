// @flow
/** 
 * Habit & Summary Charts
 * Displays charts showing numeric values from tags and yes/no habit completion. e.g. 
 *   - Numeric habits: e.g. @sleep(7.23), @sleep_deep(5.2), @rps(10), @alcohol(2), @bedtime(23:30)
 *   - Yes/No habits: e.g. [x] Exercise, [x] In bed 11pm, [x] 10 min reading, #pray, #stretches
 *
 * Note: definitions of tags, habits, etc. are now taken from the settings for Progress Updates command.
 *
 * Last updated: 2026-02-12 for v1.1.0 by @jgclark
 */

// =====================================================================
// Ideas

/**
 * Chart.js doesn’t ship a dedicated “sparkline” type, but you can get sparkline-style charts in two ways:

1. Line (or radar) chart as a sparkline
Use a normal line (or radar) chart and make it look like a sparkline by:
Turning off or hiding axes (display: false on scales),
Hiding the legend,
Using a small canvas size,
Optionally using fill: true and tension for a smooth, minimal line.

2. Plugin: chartjs-chart-sparkline
For a ready-made sparkline type (and sometimes extra options), you can use the chartjs-chart-sparkline plugin, which adds a sparkline chart type and related options on top of Chart.js.
In short: Chart.js doesn’t have a built-in “sparkline” type, but you can create sparklines with a line chart and the right options, or use the sparkline plugin.
 */

// =====================================================================

// import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import { gatherOccurrences, getSummariesSettings } from './summaryHelpers.js'
import type { SummariesConfig } from './summarySettings.js'
import type { OccurrencesToLookFor, TMOccurrences } from './TMOccurrences.js'
import { colorToModernSpecWithOpacity } from '@helpers/colors'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { showHTMLV2, type HtmlWindowOptions } from '@helpers/HTMLView'
import { getLocale } from '@helpers/NPConfiguration'

// =====================================================================
// CONSTANTS
// =====================================================================

// Chart.js: CDN and local path
const chartJsCdnUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
const chartJsLocalPath = './chart.umd.min.js'

/** Divider/grid colors matching NPThemeToCSS (light #CDCFD0, dark #52535B). Used for chart axes and grid so canvas gets a real hex, as it can't use CSS variables. */
const CHART_GRID_COLOR_LIGHT_MODE = '#33333322'
const CHART_GRID_COLOR_DARK_MODE = '#CCCCCC22'
/** Ditto for axis text color */
const CHART_AXIS_TEXT_COLOR_LIGHT_MODE = '#333333'
const CHART_AXIS_TEXT_COLOR_DARK_MODE = '#CCCCCC'

/**
 * Get the chart grid/axis color from the current theme mode so Chart.js (canvas) receives a real hex.
 * @returns {string} Hex color for grid and axis text
 */
function getChartGridColor(): string {
  const mode = Editor.currentTheme?.mode
  return mode === 'light' ? CHART_GRID_COLOR_LIGHT_MODE : CHART_GRID_COLOR_DARK_MODE
}

function getChartAxisTextColor(): string {
  const mode = Editor.currentTheme?.mode
  return mode === 'light' ? CHART_AXIS_TEXT_COLOR_LIGHT_MODE : CHART_AXIS_TEXT_COLOR_DARK_MODE
}

// =====================================================================
// HELPER FUNCTIONS

/**
 * Load custom colors from plugin settings (single chartColors key, comma-separated). 
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, named CSS colors (e.g. red, blue), tailwind colors (amber-200, blue-500, etc.), hsl(), rgb(), rgba()
 * @returns {Array} Array of color objects with border, bg, and name properties
 */
async function loadCustomColors(): Promise<Array<{ border: string, bg: string, name: string }>> {
  const config = await getSummariesSettings()

  const defaultColors = [
    '#0a84ff',  // blue
    '#bf5af2',  // purple
    '#ffd60a',  // yellow
    '#32d74b',  // green
    '#ff453a',  // red
    '#ff9f0a',  // orange
    '#64d2ff',  // cyan
    '#ff375f',  // pink
    '#ac8e68',  // brown
    '#5856d6',  // indigo
    '#ff2d55',  // rose
    '#8e8e93',  // grey
  ]

  const chartColorsStr = config.chartColors
  let colorStrings = (chartColorsStr && typeof chartColorsStr === 'string' && chartColorsStr.trim() !== '')
    ? chartColorsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    : defaultColors

  if (colorStrings.length === 0) {
    colorStrings = defaultColors
  }

  const colors = colorStrings.map(userColor => {
    return {
      border: colorToModernSpecWithOpacity(userColor),
      bg: colorToModernSpecWithOpacity(userColor, 0.4),
      name: userColor
    }
  })
  // clo(colors, 'loadCustomColors :: colors', 2)
  return colors
}

// =============================================================
// MAIN FUNCTION

/**
 * Main function to show the habit charter
 * @param {number} [daysBack] - Number of days to look back (default from settings)
 */
export async function chartSummaryStats(daysBack?: number): Promise<void> {
  try {
    const config = await getSummariesSettings()
    const daysToShow = daysBack ?? config.chartDefaultDaysBack ?? 30
    // Combine all tag settings and deduplicate (same tag in multiple settings would otherwise appear twice in Totals/charts)
    const tagsRaw = [
      ...(config.progressMentions ?? []),
      ...(config.progressHashtags ?? []),
      ...(config.progressHashtagsAverage ?? []),
      ...(config.progressHashtagsTotal ?? []),
      ...(config.progressMentionsAverage ?? []),
      ...(config.progressMentionsTotal ?? [])
    ]
    const tags = Array.from(new Set(tagsRaw))
    // clo(tags, 'tags')

    const rawDates = generateDateRange(daysToShow)
    const fromDateStr = rawDates.length > 0 ? rawDates[0] : ''
    const toDateStr = rawDates.length > 0 ? rawDates[rawDates.length - 1] : ''
    const occToLookFor = buildOccurrencesToLookForFromChartConfig(config)
    const periodString = `${daysToShow} days`
    const occs = gatherOccurrences(periodString, fromDateStr, toDateStr, occToLookFor)

    let tagData: Object
    let yesNoData: Object
    let yesNoHabits: Array<string>

    if (occs.length === 0 || rawDates.length === 0) {
      tagData = {
        dates: [],
        counts: tags.reduce((acc, tag) => ({ ...acc, [tag]: [] }), {}),
        rawDates: [],
        timeTags: Array.isArray(config.chartTimeTags) ? config.chartTimeTags : []
      }
      yesNoHabits = stringListOrArrayToArray(config.progressYesNo ?? [], ',')
      yesNoData = {
        dates: [],
        counts: yesNoHabits.reduce((acc, habit) => ({ ...acc, [habit]: [] }), {}),
        rawDates: []
      }
    } else {
      const yesNoOccs = occs.filter((occ) => occ.type === 'yesno')
      const numericOccs = occs.filter((occ) => occ.type !== 'yesno')
      tagData = buildTagDataFromOccurrences(numericOccs, tags, rawDates, config)
      const built = buildYesNoDataFromOccurrences(yesNoOccs, rawDates)
      yesNoData = built.yesNoData
      yesNoHabits = built.yesNoHabits
    }

    const html = await makeChartSummaryHTML(tagData, yesNoData, tags, yesNoHabits, daysToShow, config)

    const windowOptions: HtmlWindowOptions = {
      customId: "jgclark.Summaries.chartSummaryStats",
      windowTitle: "Habit & Summary Charts",
      showInMainWindow: true,
      splitView: false,
      icon: "chart-line",
      iconColor: "amber-500",
      autoTopPadding: true,
      showReloadButton: true,
      reloadCommandName: 'chartSummaryStats',
      reloadPluginID: 'jgclark.Summaries',
      savedFilename: "habit-summary-charts.html",
      reuseUsersWindowRect: true,
      shouldFocus: false,
    }
    const _res = await showHTMLV2(html, windowOptions)
  } catch (error) {
    logError('chartSummaryStats', error.message)
  }
}

// ===================================================================
// DATE UTILITIES

/**
 * Generate an array of date strings for the specified range using moment.
 * @param {number} daysBack - Number of days to look back
 * @returns {Array<string>} Array of date strings in YYYY-MM-DD format, sorted ascending
 */
function generateDateRange(daysBack: number): Array<string> {
  const dates = []
  for (let i = 0; i < daysBack; i++) {
    const dateStr = moment().subtract(i, 'days').format('YYYY-MM-DD')
    dates.push(dateStr)
  }
  return dates.sort()
}

/**
 * Format date for display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "Jan 15")
 */
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const locale = getLocale({})
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

// ==================================================================
// OCCURRENCES TO LOOK FOR (for gatherOccurrences)

/**
 * Build OccurrencesToLookFor from chart/progress config so gatherOccurrences uses the same progress settings.
 * @param {SummariesConfig} config - Plugin config
 * @returns {OccurrencesToLookFor} Config shape expected by gatherOccurrences
 */
function buildOccurrencesToLookForFromChartConfig(config: SummariesConfig): OccurrencesToLookFor {
  return {
    GOYesNo: stringListOrArrayToArray(config.progressYesNo ?? [], ','),
    GOHashtagsCount: stringListOrArrayToArray(config.progressHashtags ?? [], ','),
    GOHashtagsAverage: stringListOrArrayToArray(config.progressHashtagsAverage ?? [], ','),
    GOHashtagsTotal: stringListOrArrayToArray(config.progressHashtagsTotal ?? [], ','),
    GOMentionsCount: stringListOrArrayToArray(config.progressMentions ?? [], ','),
    GOMentionsAverage: stringListOrArrayToArray(config.progressMentionsAverage ?? [], ','),
    GOMentionsTotal: stringListOrArrayToArray(config.progressMentionsTotal ?? [], ','),
    GOChecklistRefNote: config.progressChecklistReferenceNote ?? ''
  }
}

/**
 * Get numeric value for a date from a TMOccurrences; treat missing/NaN as 0 for chart client.
 * @param {TMOccurrences} occ - TMOccurrences instance
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {number} Value to use in chart series
 */
function valueForDate(occ: TMOccurrences, dateStr: string): number {
  const v = occ.valuesMap.get(dateStr)
  if (v == null || Number.isNaN(v)) return 0
  return Number(v)
}

/**
 * Build tagData (numeric habits) from gatherOccurrences result for chart payload.
 * Preserves contract: { dates, counts, rawDates, timeTags }. timeTags from config (TMOccurrences does not store hadTimeValues).
 * @param {Array<TMOccurrences>} occs - All occurrences (numeric and yes/no)
 * @param {Array<string>} tags - Tag list in display order (with @ or #)
 * @param {Array<string>} rawDates - Sorted date strings in range
 * @param {SummariesConfig} config - For chartTimeTags
 * @returns {Object} tagData for makeChartSummaryHTML
 */
function buildTagDataFromOccurrences(
  occs: Array<TMOccurrences>,
  tags: Array<string>,
  rawDates: Array<string>,
  config: SummariesConfig
): Object {
  const counts = {}
  const occByTerm = new Map()
  occs.forEach((occ) => {
    if (occ.type !== 'yesno') {
      occByTerm.set(occ.term, occ)
    }
  })
  tags.forEach((tag) => {
    const occ = occByTerm.get(tag)
    counts[tag] = rawDates.map((d) => (occ ? valueForDate(occ, d) : 0))
  })
  const dates = rawDates.map(formatDateForDisplay)
  // timeTags: from config only (TMOccurrences does not store hadTimeValues; future detection could be added)
  const timeTags = Array.isArray(config.chartTimeTags) ? config.chartTimeTags : []
  return {
    dates,
    counts,
    rawDates,
    timeTags
  }
}

/**
 * Build yesNoData and yesNoHabits from gatherOccurrences yes/no results.
 * yesNoHabits order matches gatherOccurrences: GOYesNo first, then checklist items (occ.term may have leading space).
 * @param {Array<TMOccurrences>} yesNoOccs - Occurrences with type === 'yesno'
 * @param {Array<string>} rawDates - Sorted date strings in range
 * @returns {{ yesNoData: Object, yesNoHabits: Array<string> }}
 */
function buildYesNoDataFromOccurrences(
  yesNoOccs: Array<TMOccurrences>,
  rawDates: Array<string>
): { yesNoData: Object, yesNoHabits: Array<string> } {
  const yesNoHabits = yesNoOccs.map((occ) => occ.term.trim())
  const counts = {}
  yesNoOccs.forEach((occ, i) => {
    const habit = yesNoHabits[i]
    counts[habit] = rawDates.map((d) => valueForDate(occ, d))
  })
  const dates = rawDates.map(formatDateForDisplay)
  const yesNoData = {
    dates,
    counts,
    rawDates
  }
  return { yesNoData, yesNoHabits }
}

// ==================================================================
// CHART CONFIG HELPERS

/**
 * Parse chartNonZeroTags JSON string from settings into an object.
 * @param {string} jsonStr - JSON string (e.g. from settings)
 * @returns {Object} Map of tag name to { min, max }
 */
function parseChartNonZeroTags(jsonStr: string): { [string]: { min: number, max: number } } {
  if (!jsonStr || typeof jsonStr !== 'string' || jsonStr.trim() === '') {
    return {}
  }
  try {
    const parsed = JSON.parse(jsonStr)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (_e) {
    return {}
  }
}

// ===================================================================
// HTML TEMPLATE GENERATION

/**
 * Generate checkbox HTML for tag filters
 * @param {Array<string>} tags - Array of tag names
 * @returns {string} HTML string for checkboxes
 */
function generateTagFilterCheckboxes(tags: Array<string>): string {
  return tags.map((tag, i) => `
        <div class="tag-filter">
          <input type="checkbox" id="tag${i}" class="filter-checkbox" checked>
          <label for="tag${i}">${tag}</label>
        </div>
`).join('\n')
}

/**
 * Generate tag selectors for averages section
 * @param {Array<string>} tags - Array of tag names
 * @returns {string} HTML string for selectors
 */
function generateAverageSelectors(tags: Array<string>): string {
  return tags.map((tag, i) => `
        <div class="tag-selector">
          <input type="checkbox" id="avg-select-${i}" class="avg-selector" checked>
          <label for="avg-select-${i}">${tag}</label>
        </div>
`).join('\n')
}

/**
 * Tags that should show Total (union of progressHashtagsTotal and progressMentionsTotal).
 */
function getTotalDisplayTags(config: SummariesConfig): Array<string> {
  return Array.from(new Set([
    ...(config.progressHashtagsTotal ?? []),
    ...(config.progressMentionsTotal ?? [])
  ]))
}

/**
 * Tags that are "count" type (hashtags-as-counts, mentions-as-counts): union of progressHashtags and progressMentions.
 * These get a "days: N" stat above the chart (N = number of days with at least one occurrence).
 */
function getCountDisplayTags(config: SummariesConfig): Array<string> {
  return Array.from(new Set([
    ...(config.progressHashtags ?? []),
    ...(config.progressMentions ?? [])
  ]))
}

/**
 * Tags that should show Average (union of progressHashtagsAverage and progressMentionsAverage).
 */
function getAverageDisplayTags(config: SummariesConfig): Array<string> {
  return Array.from(new Set([
    ...(config.progressHashtagsAverage ?? []),
    ...(config.progressMentionsAverage ?? [])
  ]))
}

/**
 * Generate tag selectors for totals section
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with totalTags (from settings)
 * @returns {string} HTML string for selectors
 */
function generateTotalSelectors(tags: Array<string>, config: SummariesConfig): string {
  const totalTags = getTotalDisplayTags(config)
  return tags.map((tag, i) => `
        <div class="tag-selector">
          <input type="checkbox" id="total-select-${i}" class="total-selector" ${totalTags.includes(tag) ? 'checked' : ''}>
          <label for="total-select-${i}">${tag}</label>
        </div>
`).join('\n')
}

/**
 * Generate summary statistics HTML for averages (only shown for tags in progressHashtagsAverage or progressMentionsAverage).
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with progressHashtagsAverage, progressMentionsAverage
 * @returns {string} HTML string for stats
 */
function generateAverageStats(tags: Array<string>, config: SummariesConfig): string {
  const averageTags = getAverageDisplayTags(config)
  return tags.map((tag, i) => `
        <div class="stat" id="avg-stat-${i}" style="display: ${averageTags.includes(tag) ? 'block' : 'none'}">
          <div class="stat-value" id="avg-value-${i}">0</div>
          <div class="stat-label">${tag}</div>
        </div>
`).join('\n')
}

/**
 * Generate summary statistics HTML for totals (only shown for tags in progressHashtagsTotal or progressMentionsTotal).
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with progressHashtagsTotal, progressMentionsTotal
 * @returns {string} HTML string for stats
 */
function generateTotalStats(tags: Array<string>, config: SummariesConfig): string {
  const totalTags = getTotalDisplayTags(config)
  return tags.map((tag, i) => `
        <div class="stat" id="total-stat-${i}" style="display: ${totalTags.includes(tag) ? 'block' : 'none'}">
          <div class="stat-value" id="total-value-${i}">0</div>
          <div class="stat-label">${tag}</div>
        </div>
`).join('\n')
}

/**
 * Generate chart container HTML.
 * Average stat only shown for tags in progressHashtagsAverage or progressMentionsAverage.
 * Total stat only shown for tags in progressHashtagsTotal or progressMentionsTotal.
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with progress*Average and progress*Total arrays
 * @returns {string} HTML string for chart containers
 */
function generateChartContainers(tags: Array<string>, config: SummariesConfig): string {
  const averageTags = getAverageDisplayTags(config)
  const totalTags = getTotalDisplayTags(config)
  const countTags = getCountDisplayTags(config)
  return tags.map((tag, i) => {
    const showDays = countTags.includes(tag)
    const showAvg = averageTags.includes(tag)
    const showTotal = totalTags.includes(tag)
    const metricsParts = []
    if (showDays) {
      metricsParts.push(`<span class="stat-label">days:</span><span class="stat-value chart-header-days-value" id="chart-header-days-value-${i}"></span>`)
    }
    if (showAvg) {
      metricsParts.push(`<span class="stat-label ${showDays ? 'padleft' : ''}">avg:</span><span class="stat-value chart-header-avg-value" id="chart-header-avg-value-${i}"></span>`)
    }
    if (showTotal) {
      metricsParts.push(`<span class="stat-label ${showDays || showAvg ? 'padleft' : ''}">total:</span><span class="stat-value chart-header-total-value" id="chart-header-total-value-${i}"></span>`)
    }
    const metricsHTML = metricsParts.length > 0 ? metricsParts.join('') : ''
    return `
        <div class="chart-wrapper" id="wrapper${i}">
          <div class="chart-header">
            <div class="chart-title">${tag}</div>
            <div class="chart-header-metrics">${metricsHTML}</div>
          </div>
          <div class="chart-container">
            <canvas id="chart${i}"></canvas>
          </div>
        </div>
`
  }).join('\n')
}

/**
 * Generate checkbox HTML for yes/no habit filters
 * @param {Array<string>} habits - Array of habit names
 * @returns {string} HTML string for checkboxes
 */
function generateYesNoFilterCheckboxes(habits: Array<string>): string {
  return habits.map((habit, i) => `
    <div class="tag-filter">
      <input type="checkbox" id="yesno${i}" class="filter-checkbox" checked>
      <label for="yesno${i}">${habit}</label>
    </div>
`).join('\n')
}

/**
 * Generate combined yes/no habits container
 * @param {Array<string>} habits - Array of habit names
 * @returns {string} HTML string for combined container
 */
function generateYesNoCombinedContainer(): string {
  return `
    <div class="chart-wrapper">
      <div class="chart-title">Yes/No Habits</div>
      <div class="viz-display yesno-heatmap-section" id="yesno-heatmap-section"></div>
    </div>
`
}

/**
 * Generate inline CSS variables for chart heights (from settings).
 * Main styles live in requiredFiles/chartStats.css and are loaded via link tag.
 * @param {SummariesConfig} config - Config with chartHeight (from settings)
 * @returns {string} Inline style string for :root
 */
function generateChartStyleVars(config: SummariesConfig): string {
  const chartHeight = config.chartHeight ?? 180
  // const yesNoChartHeight = config.chartYesNoChartHeight ?? 120
  // return `:root { --chart-height: ${chartHeight}px; --yesno-chart-height: ${yesNoChartHeight}px; }`
  return `:root { --chart-height: ${chartHeight}px; }`
}

/**
 * Generate client-side JavaScript.
 * This passes data as JSON to the client-side JavaScript for the charting.
 * 
 * @author @AI
 * @param {Object} tagData - Chart data for numeric tags
 * @param {Object} yesNoData - Chart data for yes/no habits.
 * @param {Array<string>} tags - Array of tag names
 * @param {Array<string>} yesNoHabits - Array of yes/no habit names
 * @param {SummariesConfig} config - Config for client (must include resolved colors array)
 * @returns {string} JavaScript code string
 */
function generateClientScript(tagData: Object, yesNoData: Object, tags: Array<string>, yesNoHabits: Array<string>, config: Object): string {
  return `
  const tagData = ${JSON.stringify(tagData)};
  const yesNoData = ${JSON.stringify(yesNoData)};
  const tags = ${JSON.stringify(tags)};
  const yesNoHabits = ${JSON.stringify(yesNoHabits)};
  const config = ${JSON.stringify(config)};
  if (typeof window.initChartStats === 'function') {
    window.initChartStats(tagData, yesNoData, tags, yesNoHabits, config);
  } else {
    console.error('Chart Stats: initChartStats not loaded (chartStatsScripts.js)');
  }
`
}

  // ================================================================
  // DISPLAY STATISTICS

/**
 * Generate HTML for the habit charting view
 * @param {Object} tagData - Data from collectTagData
 * @param {Object} yesNoData - Data from collectYesNoData
 * @param {Array<string>} tags - Array of tags being tracked
 * @param {Array<string>} yesNoHabits - Array of yes/no habits being tracked
 * @param {number} daysBack - Number of days being displayed
 * @param {SummariesConfig} config - other config options
 * @returns {string} HTML string
 */
async function makeChartSummaryHTML(
  tagData: Object,
  yesNoData: Object,
  tags: Array<string>,
  yesNoHabits: Array<string>,
  daysBack: number,
  config: SummariesConfig
): Promise<string> {
  const colors = await loadCustomColors()
  const checkboxesHTML = generateTagFilterCheckboxes(tags)
  const avgSelectorsHTML = generateAverageSelectors(tags)
  const totalSelectorsHTML = generateTotalSelectors(tags, config)
  const avgStatsHTML = generateAverageStats(tags, config)
  const totalStatsHTML = generateTotalStats(tags, config)
  const chartsHTML = generateChartContainers(tags, config)
  const yesNoCheckboxesHTML = generateYesNoFilterCheckboxes(yesNoHabits)
  const yesNoCombinedHTML = generateYesNoCombinedContainer()
  const chartStyleVars = generateChartStyleVars(config)

  // Tooltip titles: full localised date (e.g. "Sun, 8 Feb 2026") for each point, using moment + user locale
  const rawDates = tagData.rawDates ?? []
  const locale = getLocale({})
  const tooltipTitles = rawDates.map((dateStr) => moment(dateStr).locale(locale).format('ddd, D MMM YYYY'))
  const tagDataWithTooltips = { ...tagData, tooltipTitles }

  // The JS-in-HTML scripts expects to have a config object with .colors, .timeTags, .totalTags, .nonZeroTags, .significantFigures, .averageType, .chartGridColor, .averageTags, .countTags
  // timeTags: tags that had at least one [H]H:MM value (sums/averages display in time format); fall back to user setting
  // averageTags: tags that get the average line (moving/weekly) and avg stat; from progressHashtagsAverage + progressMentionsAverage
  // countTags: hashtags-as-counts and mentions-as-counts; get "days: N" stat above chart
  // totalTags: same as getTotalDisplayTags so client total display and average-line behaviour match the visible Totals stats
  const configForWindowScripts = {
    colors,
    // Combine tagData.timeTags and config.chartTimeTags, de-dupe, and use as the timeTags list
    timeTags: Array.from(new Set([
      ...(Array.isArray(tagData.timeTags) ? tagData.timeTags : []),
      ...(Array.isArray(config.chartTimeTags) ? config.chartTimeTags : [])
    ])),
    totalTags: getTotalDisplayTags(config),
    averageTags: getAverageDisplayTags(config),
    countTags: getCountDisplayTags(config),
    nonZeroTags: parseChartNonZeroTags(config.chartNonZeroTags ?? '{}'),
    significantFigures: config.chartSignificantFigures ?? 3,
    averageType: config.chartAverageType ?? 'moving',
    chartGridColor: getChartGridColor(),
    chartAxisTextColor: getChartAxisTextColor(),
    // Use same theme-mode detection as NPThemeToCSS (via Editor.currentTheme.mode)
    currentThemeMode: Editor.currentTheme?.mode ?? 'light'
  }
  const script = generateClientScript(tagDataWithTooltips, yesNoData, tags, yesNoHabits, configForWindowScripts)

  // Chart.js: try CDN first, fall back to local bundled copy (requiredFiles/chart.umd.min.js)
  const chartJsLoaderScript = `
<script type="text/javascript">
(function() {
  function loadChart(src, onError) {
    var s = document.createElement('script');
    s.src = src;
    s.onerror = onError;
    s.onload = function() { window.__chartJsLoaded = true; };
    document.head.appendChild(s);
  }
  loadChart('${chartJsCdnUrl}', function() {
    loadChart('${chartJsLocalPath}', function() { console.error('Chart.js: CDN and local load failed'); });
  });
})();
</script>
`

  const body = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${chartJsLoaderScript}
    <!-- for NotePlan to use -->
    <link rel="stylesheet" href="chartStats.css">
    <script type="text/javascript" src="chartStatsScripts.js"></script>
    
    <!-- for local development to use -->
    <link rel="stylesheet" href="../../jgclark.Summaries/chartStats.css">
    <script type="text/javascript" src="../../jgclark.Summaries/chartStatsScripts.js"></script>
    <style>${chartStyleVars}</style>
  </head>

  <body>
    <!-- <div class="header">
       <h1>Habit Charting</h1>
     </div> -->

    <div class="controls-wrapper">
      <div class="config-section">
        <div class="section-title">Configuration</div>
        <div class="config-controls">

          <div class="days-input-group">
            <label for="days-input">Days to show:</label>
            <input type="number" id="days-input" class="days-input" value="${daysBack}" min="1" max="365" onkeypress="if(event.key==='Enter')updateDays()">
            <button class="update-btn" onclick="updateDays()">Update</button>
          </div>
        </div>

          <!--
          <button class="collapsible-toggle" onclick="toggleFilters()">
            <span id="filter-toggle-icon">▼</span> Habit Filters
          </button>
        </div>

        <div class="collapsible-content" id="habit-filters">
          <div class="filter-group">
            <div class="filter-group-title">Numeric Habits</div>
            <div class="tag-filters">
${checkboxesHTML}
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-group-title">Yes/No Habits</div>
            <div class="tag-filters">
${yesNoCheckboxesHTML}
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-group-title">Show in Averages</div>
            <div class="tag-selectors-compact">
${avgSelectorsHTML}
            </div>
          </div>

          <div class="filter-group">
            <div class="filter-group-title">Show in Totals</div>
            <div class="tag-selectors-compact">
${totalSelectorsHTML}
            </div>
          </div>
        </div>
          -->
      </div>
    </div>

    <div class="charts-container">
${yesNoCombinedHTML}
    </div>

    <!-- <div class="section-divider"></div> -->

    <div class="stats-wrapper">
      <div class="stats-section">
        <div class="section-title">Averages</div>
        <div class="stats">
${avgStatsHTML}
        </div>
      </div>

      <div class="stats-section">
        <div class="section-title">Totals</div>
        <div class="stats">
${totalStatsHTML}
        </div>
      </div>
    </div>

<!--
     <div class="section-header h2">
      <span>Numeric Habits</span>
      <span class="habit-type-badge">Value Tracking</span> 
    </div>
-->

    <div class="charts-container">
${chartsHTML}
    </div>

    <script>(function runWhenChartReady(){if(typeof window.Chart!=="undefined"){${script}}else{setTimeout(runWhenChartReady,20);}})();</script>
  </body>
</html>`
  
  return body
}
