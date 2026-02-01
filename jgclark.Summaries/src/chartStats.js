// @flow
/** 
 * Habit & Summary Charting
 * Displays charts showing numeric values from tags and yes/no habit completion
 *
 * Tracks:
 *   - Numeric habits: @sleep(7.23), @sleep_deep(5.2), @rps(10), @alcohol(2), @bedtime(23:30)
 *   - Yes/No habits: [x] Exercise, [x] In bed 11pm, [x] 10 min reading
 *
 * Usage:
 *   /chartSummaryStats - Shows last 30 days (default)
 *   /chartSummaryStats 30 - Shows last 30 days
 *   /chartSummaryStats 180 - Shows last 6 months
 *   /chartSummaryStats 365 - Shows last year
 * 
 * Last updated: 2026-01-31 for v1.1.0 by @jgclark
 */

import pluginJson from '../plugin.json'
import { logAvailableSharedResources, logProvidedSharedResources } from '../../np.Shared/src/index.js'
import { getSummariesSettings } from './summaryHelpers.js'
import type { SummariesConfig } from './summarySettings.js'
import { checkString } from '@helpers/checkType'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { showHTMLV2, type HtmlWindowOptions } from '@helpers/HTMLView'
import { COMPLETED_TASK_TYPES } from '@helpers/utils'
import moment from 'moment/min/moment-with-locales'

// =====================================================================
// CONSTANTS
// =====================================================================

// Chart.js: CDN and local path
const chartJsCdnUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
const chartJsLocalPath = './chart.umd.min.js'

// =====================================================================
// CONFIGURATION CONSTANTS
// TODO: Shift to plugin.json
// TODO: Remove timeline toggle
// =====================================================================

/**
 * Default configuration for the Habit Charter
 * Customize these values to match your tracking needs */
// const CONFIG = {
//   // Tags to track (add or remove as needed)
//   // Note: Now taken from .progressMentions, .progressHashtags, .progressHashtagsAverage, .progressHashtagsTotal, .progressMentionsAverage, .progressMentionsTotal
//   // tags: ['@sleep', '@work', '@run', '@tv','#meeting'],

//   // Yes/No habits tracked with [x] completed checkboxes (add or remove as needed)
//   // Format in daily notes: [x] Exercise or - [x] Exercise
//   // TODO: If not tag/mention then treat this way; otherwise take from .progressYesNo
//   yesNoHabits: [
//     '#pray',
//     '#stretches',
//     '#waterlitre',
//     '#bedOnTime',
//     '#readbook'
//   ],

//   // Default number of days to display
//   defaultDaysBack: 30,

//   // Chart height in pixels
//   chartHeight: 180,

//   // Chart height for yes/no habits (smaller since they're binary)
//   yesNoChartHeight: 120,

//   // Default visualization type for yes/no habits: 'timeline' or 'heatmap'
//   // yesNoVisualization: 'heatmap',

//   // Color palette for charts - loaded from settings
//   colors: loadCustomColors(),

//   // Tags that use HH:MM time format instead of decimals
//   timeTags: ['@bedtime'],

//   // Tags that should show totals instead of averages in summary
//   totalTags: ['@work', '@run'],

//   // Tags that should not begin at zero on Y-axis
//   nonZeroTags: {
//     '@bedtime': { min: 20, max: 24 },
//     '@sleep': { min: 5, max: 10 },
//     '@sleep_deep': { min: 0, max: 10 }
//   },

//   // Number of significant figures for summary statistics
//   significantFigures: 3
// }

// =====================================================================
// HELPER FUNCTIONS
// TODO: Go through Cursor's summary of helper comparison
// =====================================================================

/**
 * Convert any CSS color to rgba with specified opacity
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, named colors (red, blue), hsl(), rgb(), rgba()
 * @param {string} color - CSS color value
 * @param {number} opacity - Opacity value between 0 and 1 (default: 0.3)
 * @returns {string} RGBA color string
 */
function colorToRgba(colorIn: string, opacity: number = 0.3): string {
  const color = colorIn.trim()

  // If already rgba() or rgb() or hsl(), add opacity if needed
  if (color.startsWith('rgb(') || color.startsWith('hsl(')) {
    // Convert rgb() or hsl() to rgba() or hsla() with opacity
    return color
      .replace('rgb(', `rgba(`)
      .replace(')', `, ${opacity})`)
      .replace('hsl(', `hsla(`)
      .replace(')', `, ${opacity})`)
  }

  // If already rgba() or hsla(), return as-is
  if (color.startsWith('rgba(') || color.startsWith('hsla(')) {
    return color
  }

  // TODO: Tailwind

  // Handle hex colors (#RGB, #RRGGBB, #RRGGBBAA)
  if (color.startsWith('#')) {
    let hex = color.substring(1)

    // Expand shorthand #RGB to #RRGGBB
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    // Check if alpha channel is present (#RRGGBBAA)
    if (hex.length === 8) {
      const a = parseInt(hex.substring(6, 8), 16) / 255
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }

    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // For named colors (red, blue, etc.), wrap in rgba with opacity
  // This works because CSS will interpret it correctly
  return `rgba(${color}, ${opacity})`
}

/**
 * Normalize color input - add # to hex if missing, or return as-is for other formats
 * @param {string} color - Color input from user
 * @returns {string} Normalized color
 */
// function normalizeColor(color: string): string {
//   color = color.trim()
//   // If it looks like hex without #, add it
//   if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$|^[0-9A-Fa-f]{8}$/.test(color)) {
//     return '#' + color
//   }
//   // Return as-is for named colors, rgb(), hsl(), etc.
//   return color
// }

/**
 * Load custom colors from plugin settings (single chartColors key, comma-separated).
 * @returns {Array} Array of color objects with border, bg, and name properties
 */
async function loadCustomColors(): Promise<Array<{ border: string, bg: string, name: string }>> {
  const config = await getSummariesSettings()

  const defaultColors = [
    '#0a84ff',  // blue
    '#bf5af2',  // purple
    '#32d74b',  // green
    '#ff453a',  // red
    '#ffd60a',  // yellow
    '#ff9f0a',  // orange
    '#64d2ff',  // cyan
    '#ff375f',  // pink
    '#30d158',  // mint
    '#ac8e68',  // brown
    '#5856d6',  // indigo
    '#ff2d55'   // rose
  ]

  const chartColorsStr = config.chartColors
  let colorStrings = (chartColorsStr && typeof chartColorsStr === 'string' && chartColorsStr.trim() !== '')
    ? chartColorsStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    : defaultColors

  if (colorStrings.length === 0) {
    colorStrings = defaultColors
  }

  const colors = colorStrings.map(userColor => {
    const normalizedColor = userColor.toLowerCase()
    return {
      border: normalizedColor,
      bg: colorToRgba(userColor, 0.4),
      name: normalizedColor
    }
  })
  // clo(colors, 'loadCustomColors :: colors')
  return colors
}
// ============================================================================
// MAIN FUNCTION
// ============================================================================

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
    clo(tags, 'tags')

    const yesNoHabits = config.chartYesNoHabits ?? []
    // const colors = await loadCustomColors()
    // const config = {
    //   defaultDaysBack: config.chartDefaultDaysBack ?? 30,
    //   yesNoHabits,
    //   chartHeight: config.chartHeight ?? 180,
    //   yesNoChartHeight: config.chartYesNoChartHeight ?? 120,
    //   timeTags: config.chartTimeTags ?? [],
    //   totalTags: config.chartTotalTags ?? [],
    //   nonZeroTags: parseChartNonZeroTags(config.chartNonZeroTags ?? '{}'),
    //   significantFigures: config.chartSignificantFigures ?? 3,
    //   colors
    // }
    const tagData = await collectTagData(tags, daysToShow, config.chartTimeTags ?? [])
    const yesNoData = await collectYesNoData(yesNoHabits, daysToShow)
    const html = await makeChartSummaryHTML(tagData, yesNoData, tags, yesNoHabits, daysToShow, config)

    // V1
    // HTMLView.showInMainWindow(html, "Habit Charts", {
    //   splitView: false,
    //   icon: "chart-line",
    //   iconColor: "blue-500",
    //   customId: "tag-tracker-view",
    // })
    // V2
    const windowOptions: HtmlWindowOptions = {
      customId: "habit-summary-charts",
      windowTitle: "Habit & Summary Charts",
      autoTopPadding: true,
      showReloadButton: false,
      splitView: false,
      icon: "chart-line",
      iconColor: "blue-500",
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
 * Convert YYYY-MM-DD to YYYYMMDD format for NotePlan API
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Date in YYYYMMDD format
 */
function toNotePlanDateFormat(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

/**
 * Format date for display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Formatted date (e.g., "Jan 15")
 */
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// TAG VALUE EXTRACTION
// ============================================================================

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
 * Extract time value from tag (HH:MM format)
 * @param {string} tag - Tag name (e.g., "@bedtime")
 * @param {string} content - Note content to search
 * @returns {number} Average time value in decimal hours, or 0 if not found
 */
function extractTimeValue(tag: string, content: string): number {
  const escapedTag = tag.replace('@', '\\@')
  // Match HH:MM format like @bedtime(23:30) - more flexible regex
  const timeRegex = new RegExp(escapedTag + '\\s*\\(\\s*([0-9]{1,2})[:.]([0-9]{2})\\s*\\)', 'gi')
  let total = 0
  let count = 0
  let match

  while ((match = timeRegex.exec(content)) !== null) {
    const hours = parseInt(match[1])
    const minutes = parseInt(match[2])

    // Convert to decimal hours
    let decimalHours = hours + (minutes / 60)

    // Handle midnight wraparound: times 00:00-05:59 treated as next day (add 24)
    if (hours >= 0 && hours < 6) {
      decimalHours += 24
    }

    total += decimalHours
    count++
  }

  // Return average if we found any
  return count > 0 ? total / count : 0
}

/**
 * Extract numeric value from tag (decimal format)
 * @param {string} tag - Tag name (e.g., "@sleep")
 * @param {string} content - Note content to search
 * @returns {number} Sum of all values found, or 0 if not found
 */
function extractNumericValue(tag: string, content: string): number {
  const escapedTag = tag.replace('@', '\\@')
  const regex = new RegExp(escapedTag + '\\(([0-9.]+)\\)', 'gi')
  let total = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    const value = parseFloat(match[1])
    if (!isNaN(value)) {
      total += value
    }
  }

  return total
}

/**
 * Extract tag value from note content
 * @param {string} tag - Tag name
 * @param {string} content - Note content
 * @param {Array<string>} timeTags - Tags that use HH:MM format (from settings)
 * @returns {number} Extracted value (time or numeric)
 */
function extractTagValue(tag: string, content: string, timeTags: Array<string>): number {
  if (timeTags.includes(tag)) {
    return extractTimeValue(tag, content)
  } else {
    return extractNumericValue(tag, content)
  }
}

/**
 * Extract yes/no habit value from a note.
 * - For plain habit names: uses note paragraphs and COMPLETED_TASK_TYPES to detect
 *   the habit as a completed task or checklist item (no regex).
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

// ============================================================================
// DATA COLLECTION
// ============================================================================

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
function getCalendarNote(dateStr: string): TNote | null {
  try {
    if (typeof DataStore.calendarNoteByDateString === 'function') {
      const noteDateStr = toNotePlanDateFormat(dateStr)
      return DataStore.calendarNoteByDateString(noteDateStr)
    }
  } catch (error) {
    logError('getCalendarNote', error.message)
  }
  return null
}

/**
 * Extract all tag values from a single note
 * @param {TNote} note - NotePlan note object
 * @param {Array<string>} tags - Array of tags to extract
 * @param {Array<string>} timeTags - Tags that use HH:MM format (from settings)
 * @returns {Object} Map of tag names to values
 */
function extractTagValuesFromNote(note: TNote, tags: Array<string>, timeTags: Array<string>): { [string]: number } {
  const values: { [string]: number } = {}

  if (note && note.content) {
    tags.forEach(tag => {
      values[tag] = extractTagValue(tag, note.content, timeTags)
    })
  } else {
    // No note found, return zeros
    tags.forEach(tag => {
      values[tag] = 0
    })
  }

  return values
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
 * Collect tag numeric values from calendar notes
 * Extracts and sums values from tags like @sleep(7.23) or @rps(10)
 * @param {Array<string>} tags - Array of tags to track (e.g., ['@sleep', '@rps'])
 * @param {number} daysBack - Number of days to look back
 * @param {Array<string>} timeTags - Tags that use HH:MM format (from settings)
 * @returns {Object} Data formatted for Chart.js
 */
function collectTagData(tags: Array<string>, daysBack: number, timeTags: Array<string>): Object {
  try {
    const dates = generateDateRange(daysBack)
    const dateMap = initializeDataMap(dates, tags)

    // Get calendar notes for each date in the range
    for (const dateStr of dates) {
      const note = getCalendarNote(dateStr)
      if (!note) {
        throw new Error(`No note found for date ${dateStr}`)
      }

      const values = extractTagValuesFromNote(note, tags, timeTags)

      // Store values in dateMap
      logDebug('collectTagData', `adding values=${JSON.stringify(values)} to dateMap for date ${dateStr}`)
      Object.assign(dateMap[dateStr], values)  
    }

    return transformToChartFormat(dateMap, tags)
  } catch (error) {
    logError('collectTagData', error.message)
    // Return empty data structure so plugin still loads
    return {
      dates: [],
      counts: tags.reduce((acc, tag) => ({ ...acc, [tag]: [] }), {}),
      rawDates: []
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
          <input type="checkbox" id="tag${i}" class="tag-checkbox" checked>
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
      <input type="checkbox" id="yesno${i}" class="yesno-checkbox" checked>
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
    <div class="chart-wrapper yesno-combined-wrapper">
      <div class="viz-display" id="yesno-combined-heatmap"></div>
    </div>
`
}

/**
 * Generate inline CSS variables for chart heights (from settings).
 * Main styles live in requiredFiles/chartStats.css and are loaded via link tag.
 * @param {SummariesConfig} config - Config with chartHeight, yesNoChartHeight (from settings)
 * @returns {string} Inline style string for :root
 */
function generateChartStyleVars(config: SummariesConfig): string {
  const chartHeight = config.chartHeight ?? 180
  const yesNoChartHeight = config.chartYesNoChartHeight ?? 120
  return `:root { --chart-height: ${chartHeight}px; --yesno-chart-height: ${yesNoChartHeight}px; }`
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

  // Use colors from config
  const colors = config.colors;

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Format a number to significant figures with locale formatting
   * @param {number} num - Number to format
   * @param {number} sigFigs - Number of significant figures (default 3)
   * @returns {string} Formatted number
   */
  function formatToSigFigs(num, sigFigs = config.significantFigures) {
    if (num === 0) return '0';

    // Calculate the number of decimal places needed
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const decimals = Math.max(0, sigFigs - magnitude - 1);

    // Round to significant figures
    const roundedNum = Number(num.toFixed(decimals));

    // Format with locale (adds commas for thousands, etc.)
    return roundedNum.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Convert decimal hours to HH:MM format
   */
  function formatTime(decimalHours) {
    // Handle wraparound (values >= 24 are early morning times)
    let hours = Math.floor(decimalHours) % 24;
    const minutes = Math.round((decimalHours % 1) * 60);

    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }

  /**
   * Check if tag uses time format
   */
  function isTimeTag(tag) {
    return config.timeTags.includes(tag);
  }

  /**
   * Check if tag should show total instead of average
   */
  function isTotalTag(tag) {
    return config.totalTags.includes(tag);
  }

  /**
   * Toggle between light and dark theme
   */
/*  function toggleTheme() {
    document.body.classList.toggle('light-theme');
    // Save preference to localStorage
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    // Update chart colors
    updateChartThemes();
  }
*/

  /**
   * Toggle habit filters visibility
   */
  window.toggleFilters = function() {
    const content = document.getElementById('habit-filters');
    const icon = document.getElementById('filter-toggle-icon');

    content.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');

    // Save preference to localStorage
    const isCollapsed = content.classList.contains('collapsed');
    localStorage.setItem('filtersCollapsed', isCollapsed ? 'true' : 'false');
  };

  /**
   * Update chart themes when switching between light/dark
   */
  function updateChartThemes() {
    const isLight = document.body.classList.contains('light-theme');
    const gridColor = isLight ? '#d1d1d6' : '#3a3a3c';
    const textColor = isLight ? '#6e6e73' : '#98989d';

    charts.forEach(chart => {
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.y.grid.color = gridColor;
      chart.options.scales.y.ticks.color = textColor;
      chart.update('none'); // Update without animation
    });

    // Update yes/no charts too
    if (typeof yesNoCharts !== 'undefined') {
      yesNoCharts.forEach(chart => {
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
        chart.update('none');
      });
    }
  }

  /**
   * Update days and reload plugin using x-callback-url
   */
  function updateDays() {
    const daysInput = document.getElementById('days-input');

    if (!daysInput) {
      alert('Error: Could not find days input field');
      return;
    }

    const days = parseInt(daysInput.value, 10);

    if (!isNaN(days) && days > 0 && days <= 365) {
      // Use x-callback-url to call the plugin with the new days parameter
      const pluginID = 'jgclark.Summaries';
      const command = 'chartSummaryStats';
      const url = 'noteplan://x-callback-url/runPlugin?pluginID=' + encodeURIComponent(pluginID) + '&command=' + encodeURIComponent(command) + '&arg0=' + days;

      // Create a temporary link element and click it
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(function() {
        document.body.removeChild(link);
      }, 100);
    } else {
      alert('Please enter a valid number of days between 1 and 365');
    }
  }
  // Export the function to the window object so it can be called from the client
  window.updateDays = updateDays;

  // Initialize theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  // Initialize filters collapsed state from localStorage
  const filtersCollapsed = localStorage.getItem('filtersCollapsed');
  if (filtersCollapsed === 'true') {
    const content = document.getElementById('habit-filters');
    const icon = document.getElementById('filter-toggle-icon');
    content.classList.add('collapsed');
    icon.classList.add('collapsed');
  }

  // Calculate 7-day moving average
  function calculateMovingAverage(data, windowSize = 7) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < windowSize - 1) {
        result.push(null); // Not enough data points yet
      } else {
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
          sum += data[i - j];
        }
        result.push(sum / windowSize);
      }
    }
    return result;
  }

  // Calculate overall average for last 7 days
  function getRecentAverage(data, days = 7) {
    const recentData = data.slice(-days).filter(val => val > 0);
    if (recentData.length === 0) return 0;
    const sum = recentData.reduce((acc, val) => acc + val, 0);
    return sum / recentData.length;
  }

  // ========================================================================
  // DISPLAY STATISTICS
  // ========================================================================

  // Calculate totals and averages
  const totals = tags.map((tag, i) =>
    tagData.counts[tag].reduce((sum, val) => sum + val, 0)
  );

  tags.forEach((tag, i) => {
    const validData = tagData.counts[tag].filter(val => val > 0);

    // === AVERAGES SECTION ===
    if (isTimeTag(tag)) {
      // Show average formatted as time
      if (validData.length > 0) {
        const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length;
        document.getElementById('avg-value-' + i).textContent = formatTime(avgValue);
      } else {
        document.getElementById('avg-value-' + i).textContent = '--:--';
      }
    } else {
      // Show average with sig figs and locale formatting
      if (validData.length > 0) {
        const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length;
        document.getElementById('avg-value-' + i).textContent = formatToSigFigs(avgValue);
      } else {
        document.getElementById('avg-value-' + i).textContent = '0';
      }
    }

    // === TOTALS SECTION ===
    const total = totals[i];
    document.getElementById('total-value-' + i).textContent = formatToSigFigs(total);

    // Display 7-day average in charts
    let avg;

    if (isTotalTag(tag)) {
      // For total tags (like alcohol, steps), calculate average per day (including zero days)
      const recentData = tagData.counts[tag].slice(-7);
      const sum = recentData.reduce((acc, val) => acc + val, 0);
      avg = sum / 7; // Always divide by 7, not by non-zero days
    } else {
      // For other tags, use average of non-zero days
      avg = getRecentAverage(tagData.counts[tag]);
    }

    if (isTimeTag(tag)) {
      document.getElementById('avg' + i).textContent = '7-day avg: ' + formatTime(avg);
    } else {
      // Show 1 decimal place for 7-day averages
      document.getElementById('avg' + i).textContent = '7-day avg: ' + avg.toFixed(1);
    }
  });

  // Create individual charts for each tag
  const charts = [];

  // ========================================================================
  // CREATE CHARTS
  // ========================================================================

  tags.forEach((tag, index) => {
    const ctx = document.getElementById('chart' + index).getContext('2d');
    const data = tagData.counts[tag];
    const movingAvg = calculateMovingAverage(data);

    // Get Y-axis settings from config
    const nonZeroConfig = config.nonZeroTags[tag];
    const yAxisConfig = {
      beginAtZero: !nonZeroConfig,
      suggestedMin: nonZeroConfig ? nonZeroConfig.min : undefined,
      suggestedMax: nonZeroConfig ? nonZeroConfig.max : undefined
    };

    // Get color (cycle if more tags than colors)
    const colorIndex = index % colors.length;
    const color = colors[colorIndex];

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: tagData.dates,
        datasets: [
          {
            type: 'bar',
            label: tag,
            data: data,
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 1,
            barPercentage: 0.9,
            categoryPercentage: 0.95,
            order: 2
          },
          {
            type: 'line',
            label: '7-day avg',
            data: movingAvg,
            borderColor: color.border,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(28, 28, 30, 0.95)',
            titleColor: '#f5f5f7',
            bodyColor: '#f5f5f7',
            borderColor: '#3a3a3c',
            borderWidth: 1,
            padding: 12,
            titleFont: {
              size: 13,
              weight: '600'
            },
            bodyFont: {
              size: 12
            },
            callbacks: {
              label: function(context) {
                const value = context.parsed.y;

                if (context.datasetIndex === 0) {
                  // Bar chart value
                  if (isTimeTag(tag) && value > 0) {
                    return tag + ': ' + formatTime(value);
                  } else {
                    return tag + ': ' + value.toFixed(1);
                  }
                } else if (value !== null) {
                  // Moving average line
                  if (isTimeTag(tag)) {
                    return '7-day avg: ' + formatTime(value);
                  } else {
                    return '7-day avg: ' + value.toFixed(1);
                  }
                }
                return null;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              color: '#3a3a3c'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: {
                size: 10
              },
              color: '#98989d'
            }
          },
          y: {
            ...yAxisConfig,
            ticks: {
              font: {
                size: 10
              },
              color: '#98989d',
              callback: function(value) {
                // Format time tags as HH:MM
                if (isTimeTag(tag) && value > 0) {
                  return formatTime(value);
                }
                return value;
              }
            },
            grid: {
              color: '#3a3a3c'
            }
          }
        }
      }
    });

    charts.push(chart);
  });

  // Handle chart visibility toggling (also affects averages and totals)
  document.querySelectorAll('.tag-checkbox').forEach((checkbox, index) => {
    checkbox.addEventListener('change', (e) => {
      const wrapper = document.getElementById('wrapper' + index);
      const avgStat = document.getElementById('avg-stat-' + index);
      const totalStat = document.getElementById('total-stat-' + index);
      const avgSelector = document.getElementById('avg-select-' + index);
      const totalSelector = document.getElementById('total-select-' + index);

      if (e.target.checked) {
        // Show chart
        wrapper.style.display = 'block';

        // Show average stat if checkbox is checked
        if (avgSelector.checked) {
          avgStat.style.display = 'block';
        }

        // Show total stat if checkbox is checked
        if (totalSelector.checked) {
          totalStat.style.display = 'block';
        }
      } else {
        // Hide everything for this tag
        wrapper.style.display = 'none';
        avgStat.style.display = 'none';
        totalStat.style.display = 'none';
      }
    });
  });

  // Handle averages selector toggling
  document.querySelectorAll('.avg-selector').forEach((checkbox, index) => {
    checkbox.addEventListener('change', (e) => {
      const stat = document.getElementById('avg-stat-' + index);
      const tagCheckbox = document.getElementById('tag' + index);

      // Only show if both the tag is enabled AND the average selector is checked
      if (e.target.checked && tagCheckbox.checked) {
        stat.style.display = 'block';
      } else {
        stat.style.display = 'none';
      }
    });
  });

  // Handle totals selector toggling
  document.querySelectorAll('.total-selector').forEach((checkbox, index) => {
    checkbox.addEventListener('change', (e) => {
      const stat = document.getElementById('total-stat-' + index);
      const tagCheckbox = document.getElementById('tag' + index);

      // Only show if both the tag is enabled AND the total selector is checked
      if (e.target.checked && tagCheckbox.checked) {
        stat.style.display = 'block';
      } else {
        stat.style.display = 'none';
      }
    });
  });

  // ========================================================================
  // YES/NO HABIT UTILITIES
  // ========================================================================

  /**
   * Calculate completion percentage
   */
  function calculateCompletionRate(data) {
    const total = data.length;
    const completed = data.filter(val => val === 1).length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  /**
   * Calculate current streak (excluding today)
   */
  function calculateStreak(data) {
    let streak = 0;
    // Count from the second-to-last day (excluding today) backwards
    for (let i = data.length - 2; i >= 0; i--) {
      if (data[i] === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // ========================================================================
  // CREATE YES/NO HABIT VISUALIZATIONS (COMBINED)
  // ========================================================================

  /**
   * Create combined timeline visualization
   */
  function createCombinedTimeline() {
    const container = document.getElementById('yesno-combined-timeline');
    container.innerHTML = '';

    yesNoHabits.forEach((habit, index) => {
      const data = yesNoData.counts[habit];
      const dates = yesNoData.dates;

      // Use green color for all yes/no habits
      const greenColor = '#32d74b';

      // Calculate stats
      const completionRate = calculateCompletionRate(data);
      const streak = calculateStreak(data);

      // Create row
      const row = document.createElement('div');
      row.className = 'yesno-habit-row';
      row.id = 'yesno-row-' + index;
      row.style.display = 'flex';

      // Label
      const label = document.createElement('div');
      label.className = 'yesno-habit-label';
      label.textContent = habit;
      row.appendChild(label);

      // Visualization
      const vizContainer = document.createElement('div');
      vizContainer.className = 'yesno-habit-viz';

      const timelineRow = document.createElement('div');
      timelineRow.className = 'timeline-row';

      // Exclude today (last item) from visualization
      const dataToShow = data.slice(0, -1);
      const datesToShow = dates.slice(0, -1);

      dataToShow.forEach((value, i) => {
        const day = document.createElement('span');
        day.className = 'timeline-day ' + (value === 1 ? 'completed' : 'incomplete');
        day.innerHTML = value === 1 ? '✓' : '○';
        day.title = datesToShow[i] + ': ' + (value === 1 ? 'Completed' : 'Not completed');

        if (value === 1) {
          day.style.color = greenColor;
        }

        timelineRow.appendChild(day);
      });

      vizContainer.appendChild(timelineRow);
      row.appendChild(vizContainer);

      // Stats
      const stats = document.createElement('div');
      stats.className = 'yesno-habit-stats';
      stats.innerHTML = '<span>' + completionRate + '%</span><span>Streak: ' + streak + '</span>';
      row.appendChild(stats);

      container.appendChild(row);
    });
  }

  /**
   * Create combined heatmap visualization
   */
  function createCombinedHeatmap() {
    const container = document.getElementById('yesno-combined-heatmap');
    container.innerHTML = '';

    yesNoHabits.forEach((habit, index) => {
      const data = yesNoData.counts[habit];
      const dates = yesNoData.dates;

      // Use a light green color for all yes
      // TODO: change for CSS
      const yesColor = '#32d74b';
      const noColor = '#992e2e';

      // Calculate stats
      const completionRate = calculateCompletionRate(data);
      const streak = calculateStreak(data);

      // Create row
      const row = document.createElement('div');
      row.className = 'yesno-habit-row';
      row.id = 'yesno-row-' + index;
      row.style.display = 'flex';

      // Label
      const label = document.createElement('div');
      label.className = 'yesno-habit-label';
      label.textContent = habit;
      row.appendChild(label);

      // Visualization
      const vizContainer = document.createElement('div');
      vizContainer.className = 'yesno-habit-viz';

      const grid = document.createElement('div');
      grid.className = 'heatmap-grid';

      // Exclude today (last item) from visualization
      const dataToShow = data.slice(0, -1);
      const datesToShow = dates.slice(0, -1);

      dataToShow.forEach((value, i) => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell ' + (value === 1 ? 'completed' : 'incomplete');
        cell.title = datesToShow[i] + ': ' + (value === 1 ? 'Completed' : 'Not completed');

        if (value === 1) {
          cell.style.background = yesColor;
          cell.style.borderColor = yesColor;
        } else {
          cell.style.background = noColor;
          cell.style.borderColor = noColor;
        }

        grid.appendChild(cell);
      });

      vizContainer.appendChild(grid);
      row.appendChild(vizContainer);

      // Stats
      const stats = document.createElement('div');
      stats.className = 'yesno-habit-stats';
      stats.innerHTML = '<span>' + completionRate + '%</span><span>Streak: ' + streak + '</span>';
      row.appendChild(stats);

      container.appendChild(row);
    });
  }

  // Initialize heatmap visualization
  createCombinedHeatmap();
`
}

/**
 * Generate HTML for the habit charting view
 * @param {Object} tagData - Data from collectTagData
 * @param {Object} yesNoData - Data from collectYesNoData
 * @param {Array<string>} tags - Array of tags being tracked
 * @param {Array<string>} yesNoHabits - Array of yes/no habits being tracked
 * @param {number} daysBack - Number of days being displayed
 * @param {SummariesConfig} config - Config for client (must include resolved colors array, not Promise)
 * @returns {string} HTML string
 */
async function makeChartSummaryHTML(
  tagData: Object, yesNoData: Object, tags: Array<string>, yesNoHabits: Array<string>, daysBack: number, config: SummariesConfig
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
  // The JS-in-HTML scripts expects to have a config object with .colors, .timeTags, .totalTags, .nonZeroTags, .significantFigures
  const configForWindowScripts = {
    colors,
    timeTags: config.chartTimeTags ?? [],
    totalTags: config.chartTotalTags ?? [],
    nonZeroTags: parseChartNonZeroTags(config.chartNonZeroTags ?? '{}'),
    significantFigures: config.chartSignificantFigures ?? 3
  }
  const script = generateClientScript(tagData, yesNoData, tags, yesNoHabits, configForWindowScripts)

  // Chart.js: try CDN first, fall back to local bundled copy (requiredFiles/chart.umd.min.js)
  const chartJsLoaderScript = `
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
`
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>${chartJsLoaderScript}</script>
    <!-- for NotePlan to use -->
    <link rel="stylesheet" href="./chartStats.css">
    <!-- for local development to use -->
    <link rel="stylesheet" href="../../jgclark.Summaries/chartStats.css">
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
          <!--
          <button class="theme-toggle" onclick="toggleTheme()">Toggle Theme</button>
          -->

          <div class="days-input-group">
            <label for="days-input">Days to show:</label>
            <input type="number" id="days-input" class="days-input" value="${daysBack}" min="1" max="365" onkeypress="if(event.key==='Enter')updateDays()">
            <button class="update-btn" onclick="updateDays()">Update</button>
          </div>

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
      </div>

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

    <div class="section-header h2">
      <span>Yes/No Habits</span>
      <span class="habit-type-badge">Completion Tracking</span>
    </div>

    <div class="charts-container">
${yesNoCombinedHTML}
    </div>

    <div class="section-divider"></div>

    <div class="section-header h2">
      <span>Numeric Habits</span>
      <span class="habit-type-badge">Value Tracking</span>
    </div>

    <div class="charts-container">
${chartsHTML}
    </div>

    <script>(function runWhenChartReady(){if(typeof window.Chart!=="undefined"){${script}}else{setTimeout(runWhenChartReady,20);}})();</script>
  </body>
</html>`
}
