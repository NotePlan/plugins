// @flow
/** 
 * Habit & Summary Charts
 * Displays charts showing numeric values from tags and yes/no habit completion
 *
 * Tracks:
 *   - Numeric habits: e.g. @sleep(7.23), @sleep_deep(5.2), @rps(10), @alcohol(2), @bedtime(23:30)
 *   - Yes/No habits: e.g. [x] Exercise, [x] In bed 11pm, [x] 10 min reading, #pray, #stretches
 *
 * Note: 
 * - First now taken from .chartTimeTags and .chartTotalTags, but could be taken from .progressMentions, .progressHashtags, .progressHashtagsAverage, .progressHashtagsTotal, .progressMentionsAverage, .progressMentionsTotal
 * - Second now not from .chartYesNoHabits, but could from earlier .progressYesNo
 *
 * Last updated: 2026-02-01 for v1.1.0 by @jgclark
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
import { getSummariesSettings } from './summaryHelpers.js'
import type { SummariesConfig } from './summarySettings.js'
import { colorToModernSpecWithOpacity } from '@helpers/colors'
import { convertISOToYYYYMMDD } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { showHTMLV2, type HtmlWindowOptions } from '@helpers/HTMLView'
import { getLocale } from '@helpers/NPConfiguration'
import { COMPLETED_TASK_TYPES } from '@helpers/utils'

// =====================================================================
// CONSTANTS
// =====================================================================

// Chart.js: CDN and local path
const chartJsCdnUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
const chartJsLocalPath = './chart.umd.min.js'

/** Divider/grid colors matching NPThemeToCSS (light #CDCFD0, dark #52535B). Used for chart axes and grid so canvas gets a real hex, as it can't use CSS variables. */
const CHART_GRID_COLOR_LIGHT_MODE = '#33333344'
const CHART_GRID_COLOR_DARK_MODE = '#CCCCCC55'
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

// Regex to detect time/duration form value: [H]H:MM only (e.g. 23:30, 9:05)
const TIME_DURATION_PATTERN = /^[0-9]{1,2}:[0-9]{2}$/

// =====================================================================
// HELPER FUNCTIONS
// TODO: Go through Cursor's summary of helper comparison
// =====================================================================

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
// =============================================================

/**
 * Main function to show the habit charter
 * @param {number} [daysBack] - Number of days to look back (default from settings)
 */
export async function chartSummaryStats(daysBack?: number): Promise<void> {
  try {
    const config = await getSummariesSettings()
    const daysToShow = daysBack ?? config.chartDefaultDaysBack ?? 30
    // eslint-disable-next-line max-len
    const tags = [...config.progressMentions, ...config.progressHashtags, ...config.progressHashtagsAverage, ...config.progressHashtagsTotal, ...config.progressMentionsAverage, ...config.progressMentionsTotal]
    // clo(tags, 'tags')

    const yesNoHabits = config.progressYesNo ?? []
    const tagData = await collectTagData(tags, daysToShow)
    const yesNoData = await collectYesNoData(yesNoHabits, daysToShow)
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

// ============================================================================
// DATE UTILITIES
// ============================================================================

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
// TAG VALUE EXTRACTION
// ==================================================================

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

/**
 * Parse a single time value string ([H]H:MM) to decimal hours with midnight wraparound.
 * @param {string} valueStr - Trimmed value (e.g. "23:30", "9:05")
 * @returns {number} Decimal hours (00:00-05:59 add 24)
 */
function parseTimeValueToDecimalHours(valueStr: string): number {
  const parts = valueStr.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10) || 0
  let decimalHours = hours + (minutes / 60)
  // Previously dealt with midnight wraparound, but now we're just using the raw value, as it can be a duration, not just a time.
  // if (hours >= 0 && hours < 6) {
  //   decimalHours += 24
  // }
  // Round to 3 significant figures
  decimalHours = Math.round(decimalHours * 10000) / 10000
  return decimalHours
}

/**
 * Extract tag value from note content.
 * Time/Duration vs decimal is detected from the value: [H]H:MM → time (average); other numeric values → decimal (sum).
 * If a tag has both time- and decimal-form values in the same note, time wins (only time values are aggregated).
 * @param {string} tag - Tag name
 * @param {string} content - Note content
 * @returns {{ value: number, hadTimeValues: boolean }} Extracted value and whether any [H]H:MM values were found
 */
function extractTagValue(tag: string, content: string): { value: number, hadTimeValues: boolean } {
  const escapedTag = tag.replace('@', '\\@').replace('#', '\\#')
  const valueRegex = new RegExp(`${escapedTag}\\s*\\(\\s*([^)]+)\\s*\\)`, 'gi')
  const timeValues: Array<number> = []
  let decimalSum = 0
  let match

  while ((match = valueRegex.exec(content)) !== null) {
    if (!match[1]) continue
    const valueStr = match[1].trim()
    if (TIME_DURATION_PATTERN.test(valueStr)) {
      timeValues.push(parseTimeValueToDecimalHours(valueStr))
    } else {
      const num = parseFloat(valueStr)
      if (!isNaN(num)) {
        decimalSum += num
      }
    }
  }

  if (timeValues.length > 0) {
    const avg = timeValues.reduce((a, b) => a + b, 0) / timeValues.length
    return { value: avg, hadTimeValues: true }
  }
  return { value: decimalSum, hadTimeValues: false }
}

/**
 * Extract yes/no habit value from a note.
 * - the habit as a completed task or checklist item (no regex).
 * - For hashtag or @mention: counts how many times the tag appears in any line;
 *   returns that count (0, 1, 2, ...).
 * @param {string} habit - Habit name (e.g. "Exercise") or tag (e.g. "#pray", "@done")
 * @param {TNote|null} note - NotePlan note object
 * @returns {number} 1 if completed task/checklist matches (plain habit), 0 if not;
 *   or count of tag occurrences (hashtag/mention)
 */
function extractYesNoValue(habit: string, note: TNote | null): number {
  if (!note || !note.content) {
    return 0
  }

  const isHashtag = habit.startsWith('#')
  const isMention = habit.startsWith('@')

  if (isHashtag) {
    const hashtags = note.hashtags ?? []
    const count = hashtags.filter((t) => t === habit).length
    if (count > 0) {
      // logDebug('extractYesNoValue', `  ✓ Found "${habit}" ${count} time(s) in note.hashtags`)
    }
    return count
  }

  if (isMention) {
    const mentions = note.mentions ?? []
    const count = mentions.filter((m) => m === habit).length
    if (count > 0) {
      // logDebug('extractYesNoValue', `  ✓ Found "${habit}" ${count} time(s) in note.mentions`)
    }
    return count
  }

  // Plain habit: look for it in completed task/checklist paragraphs via helpers
  if (!note.paragraphs || note.paragraphs.length === 0) {
    return 0
  }

  const habitLower = habit.trim().toLowerCase()
  for (let i = 0; i < note.paragraphs.length; i++) {
    const para = note.paragraphs[i]
    // TODO: Change to use ~ isCompletedItem() helper function
    if (COMPLETED_TASK_TYPES.indexOf(para.type) >= 0 && para.content) {
      const contentLower = para.content.trim().toLowerCase()
      if (contentLower.indexOf(habitLower) >= 0) {
        // logDebug('extractYesNoValue', `  ✓ Found "${habit}" as completed task/checklist (type: ${para.type})`)
        return 1
      }
    }
  }

  return 0
}

// ===================================================================
// DATA COLLECTION
// ===================================================================

/**
 * Initialize empty data map for all dates and tags
 * @param {Array<string>} dates - Array of date strings
 * @param {Array<string>} tags - Array of tag names
 * @returns {Object} Map of dates to tag values (all initialized to 0)
 */
function initializeDataMap(dates: Array<string>, tags: Array<string>): Object {
  const dateMap = {}

  dates.forEach(dateStr => {
    dateMap[dateStr] = {}
    tags.forEach(tag => {
      dateMap[dateStr][tag] = 0
    })
  })

  return dateMap
}

/**
 * Get calendar note for a specific date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Object|null} Note object or null if not found
 */
function getCalendarNote(dateStr: string): ?TNote {
  try {
    if (typeof DataStore.calendarNoteByDateString === 'function') {
      const noteDateStr = convertISOToYYYYMMDD(dateStr)
      return DataStore.calendarNoteByDateString(noteDateStr)
    }
  } catch (error) {
    logError('getCalendarNote', error.message)
  }
  return null
}

/**
 * Extract all tag values from a single note.
 * Supports both time and decimal values. Also returns which tags had time-based values in this note.
 * @param {TNote} note - NotePlan note object
 * @param {Array<string>} tags - Array of tags to extract
 * @returns {{ values: Object, timeTagsInNote: Array<string> }} Map of tag names to values, and tags that had [H]H:MM values
 */
function extractTagValuesFromNote(note: TNote, tags: Array<string>): { values: { [string]: number }, timeTagsInNote: Array<string> } {
  const values: { [string]: number } = {}
  const timeTagsInNote: Array<string> = []

  if (note && note.content) {
    const content = note.content ?? ''
    tags.forEach(tag => {
      const { value, hadTimeValues } = extractTagValue(tag, content)
      values[tag] = value
      if (hadTimeValues) {
        timeTagsInNote.push(tag)
      }
    })
  } else {
    // No note found, return zeros
    tags.forEach(tag => {
      values[tag] = 0
    })
  }

  return { values, timeTagsInNote }
}

/**
 * Transform date map into Chart.js format
 * @param {Object} dateMap - Map of dates to tag values
 * @param {Array<string>} tags - Array of tag names
 * @returns {Object} Data formatted for Chart.js
 */
function transformToChartFormat(dateMap: Object, tags: Array<string>): Object {
  const sortedDates = Object.keys(dateMap).sort()
  const counts = {}

  tags.forEach(tag => {
    counts[tag] = sortedDates.map(date => dateMap[date][tag])
  })

  const displayDates = sortedDates.map(formatDateForDisplay)

  return {
    dates: displayDates,
    counts,
    rawDates: sortedDates
  }
}

/**
 * Collect tag numeric values from calendar notes.
 * Extracts values from tags like @sleep(7.23), @rps(10), @bedtime(23:30); time vs decimal is detected from the value.
 * Tracks which tags include any time-based ([H]H:MM) values so the UI can display sums/averages in time format.
 * @param {Array<string>} tags - Array of tags to track (e.g., ['@sleep', '@rps'])
 * @param {number} daysBack - Number of days to look back
 * @returns {Object} Data formatted for Chart.js plus timeTags array (tags that had at least one time value)
 */
function collectTagData(tags: Array<string>, daysBack: number): Object {
  try {
    const dates = generateDateRange(daysBack)
    const dateMap = initializeDataMap(dates, tags)
    const timeTagSet = new Set<string>()

    // Get calendar notes for each date in the range
    for (const dateStr of dates) {
      const note = getCalendarNote(dateStr)
      if (!note) {
        throw new Error(`No note found for date ${dateStr}`)
      }

      const { values, timeTagsInNote } = extractTagValuesFromNote(note, tags)
      timeTagsInNote.forEach(t => timeTagSet.add(t))

      // Store values in dateMap
      logDebug('collectTagData', `adding values=${JSON.stringify(values)} to dateMap for date ${dateStr}`)
      Object.assign(dateMap[dateStr], values)
    }

    const chartData = transformToChartFormat(dateMap, tags)
    return {
      ...chartData,
      timeTags: Array.from(timeTagSet)
    }
  } catch (error) {
    logError('collectTagData', error.message)
    // Return empty data structure so plugin still loads
    return {
      dates: [],
      counts: tags.reduce((acc, tag) => ({ ...acc, [tag]: [] }), {}),
      rawDates: [],
      timeTags: []
    }
  }
}

/**
 * Extract all yes/no habit values from a single note
 * @param {TNote} note - NotePlan note object
 * @param {Array<string>} habits - Array of habit names to extract
 * @returns {Object} Map of habit names to values (1 or 0)
 */
function extractYesNoValuesFromNote(note: TNote, habits: Array<string>): Object {
  const values = {}

  if (note && note.content) {
    habits.forEach(habit => {
      values[habit] = extractYesNoValue(habit, note)
    })
  } else {
    logDebug('extractYesNoValuesFromNote', 'Invalid or empty note passed, so returning zeros')
    // No note found, return zeros
    habits.forEach(habit => {
      values[habit] = 0
    })
  }

  return values
}

/**
 * Collect yes/no habit data from calendar notes.
 * Looks for [x] completed checkboxes followed by habit names.
 * @param {Array<string>} habits - Array of habit names to track
 * @param {number} daysBack - Number of days to look back
 * @returns {Object} Data formatted for Chart.js
 */
function collectYesNoData(habits: Array<string>, daysBack: number): Object {
  try {
    const dates = generateDateRange(daysBack)
    const dateMap = initializeDataMap(dates, habits)

    // Debug: Log what we're searching for
    logDebug('collectYesNoData', `Searching for yes/no habits [${String(habits)}] over ${dates.length} days`)

    // Get calendar notes for each date in the range
    for (const dateStr of dates) {
      const note = getCalendarNote(dateStr)

      if (note && note.content) {
        const values = extractYesNoValuesFromNote(note, habits)
        // Store values in dateMap
        Object.assign(dateMap[dateStr], values)

        // Debug: Log found values for recent dates
        const isRecent = dates.indexOf(dateStr) > dates.length - 4
        if (isRecent) {
          clo(values, `collectYesNoData :: extracted values for ${dateStr}`)
        }
      }
    }

    const result = transformToChartFormat(dateMap, habits)

    // Debug: Log summary
    logDebug('collectYesNoData', '\nYes/No Data Summary:')
    habits.forEach(habit => {
      const total = result.counts[habit].reduce((sum, val) => sum + val, 0)
      logDebug('collectYesNoData', `  ${habit}: ${total} completions out of ${daysBack} days`)
    })

    // clo(result, 'collectYesNoData::result')
    return result
  } catch (error) {
    logError('collectYesNoData', error.message)
    // Return empty data structure so plugin still loads
    return {
      dates: [],
      counts: habits.reduce((acc, habit) => ({ ...acc, [habit]: [] }), {}),
      rawDates: []
    }
  }
}

// ============================================================================
// HTML TEMPLATE GENERATION
// ============================================================================

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
 * Generate tag selectors for totals section
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with totalTags (from settings)
 * @returns {string} HTML string for selectors
 */
function generateTotalSelectors(tags: Array<string>, config: SummariesConfig): string {
  const totalTags = config.chartTotalTags ?? []
  return tags.map((tag, i) => `
        <div class="tag-selector">
          <input type="checkbox" id="total-select-${i}" class="total-selector" ${totalTags.includes(tag) ? 'checked' : ''}>
          <label for="total-select-${i}">${tag}</label>
        </div>
`).join('\n')
}

/**
 * Generate summary statistics HTML for averages
 * @param {Array<string>} tags - Array of tag names
 * @returns {string} HTML string for stats
 */
function generateAverageStats(tags: Array<string>): string {
  return tags.map((tag, i) => `
        <div class="stat" id="avg-stat-${i}">
          <div class="stat-value" id="avg-value-${i}">0</div>
          <div class="stat-label">${tag}</div>
        </div>
`).join('\n')
}

/**
 * Generate summary statistics HTML for totals
 * @param {Array<string>} tags - Array of tag names
 * @param {SummariesConfig} config - Config with totalTags (from settings)
 * @returns {string} HTML string for stats
 */
function generateTotalStats(tags: Array<string>, config: SummariesConfig): string {
  const totalTags = config.chartTotalTags ?? []
  return tags.map((tag, i) => `
        <div class="stat" id="total-stat-${i}" style="display: ${totalTags.includes(tag) ? 'block' : 'none'}">
          <div class="stat-value" id="total-value-${i}">0</div>
          <div class="stat-label">${tag}</div>
        </div>
`).join('\n')
}

/**
 * Generate chart container HTML
 * @param {Array<string>} tags - Array of tag names
 * @returns {string} HTML string for chart containers
 */
function generateChartContainers(tags: Array<string>): string {
  return tags.map((tag, i) => `
        <div class="chart-wrapper" id="wrapper${i}">
          <div class="chart-header">
            <div class="chart-title">${tag}</div>
            <div class="chart-avg" id="avg${i}">7-day avg: 0</div>
          </div>
          <div class="chart-container">
            <canvas id="chart${i}"></canvas>
          </div>
        </div>
`).join('\n')
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

  // ========================================================================
  // DISPLAY STATISTICS
  // ========================================================================

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
  const avgStatsHTML = generateAverageStats(tags)
  const totalStatsHTML = generateTotalStats(tags, config)
  const chartsHTML = generateChartContainers(tags)
  const yesNoCheckboxesHTML = generateYesNoFilterCheckboxes(yesNoHabits)
  const yesNoCombinedHTML = generateYesNoCombinedContainer()
  const chartStyleVars = generateChartStyleVars(config)

  // The JS-in-HTML scripts expects to have a config object with .colors, .timeTags, .totalTags, .nonZeroTags, .significantFigures, .averageType, .chartGridColor
  // timeTags: tags that had at least one [H]H:MM value (sums/averages display in time format); fall back to user setting
  const configForWindowScripts = {
    colors,
    // Combine tagData.timeTags and config.chartTimeTags, de-dupe, and use as the timeTags list
    timeTags: Array.from(new Set([
      ...(Array.isArray(tagData.timeTags) ? tagData.timeTags : []),
      ...(Array.isArray(config.chartTimeTags) ? config.chartTimeTags : [])
    ])),
    totalTags: config.chartTotalTags ?? [],
    nonZeroTags: parseChartNonZeroTags(config.chartNonZeroTags ?? '{}'),
    significantFigures: config.chartSignificantFigures ?? 3,
    averageType: config.chartAverageType ?? 'moving',
    chartGridColor: getChartGridColor(),
    chartAxisTextColor: getChartAxisTextColor(),
    // Use same theme-mode detection as NPThemeToCSS (via Editor.currentTheme.mode)
    currentThemeMode: Editor.currentTheme?.mode ?? 'light'
  }
  const script = generateClientScript(tagData, yesNoData, tags, yesNoHabits, configForWindowScripts)

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
