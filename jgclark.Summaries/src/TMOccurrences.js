// @flow
//-----------------------------------------------------------------------------
// TMOccurrences class and related types/functions for tracking hashtag/mention occurrences
// Extracted to avoid circular dependency with gatherOccurrencesHelpers.js
// Jonathan Clark
// Last updated 2026-02-03 for v1.1.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import {
  getAPIDateStrFromDisplayDateStr,
  getISODateStringFromYYYYMMDD,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  withinDateRange,
} from '@helpers/dateTime'
import { calcOffsetDateStr } from '@helpers/NPdateTime'
import { logDebug, logError } from '@helpers/dev'

//------------------------------------------------------------------------------
// Types

// Reduced set of the above designed to carry settings into gatherOccurrences
export type OccurrencesToLookFor = {
  GOYesNo: Array<string>,
  GOHashtagsCount: Array<string>,
  GOHashtagsAverage: Array<string>,
  GOHashtagsTotal: Array<string>,
  GOMentionsCount: Array<string>,
  GOMentionsAverage: Array<string>,
  GOMentionsTotal: Array<string>,
  GOChecklistRefNote: string,
}

//------------------------------------------------------------------------------
/**
 * Class to hold occurrence summary of Hashtags and/or Mentions ('TM') for a given time interval.
 * 
 * Tracks statistics for a single term (hashtag or mention) over a date range.
 * Each instance maintains:
 * - A map of daily values (valuesMap)
 * - Total and count statistics
 * - Methods for formatting output and generating sparklines
 * 
 * A progress term has a 'type' that determines how it's displayed:
 * - 'yesno': Simple presence/absence tracking (Yes/No indicators)
 * - 'count': Number of occurrences
 * - 'total': Sum of numeric values
 * - 'average': Average of numeric values
 * - 'all': Combined total and average display
 * 
 * @author @jgclark
 */
export class TMOccurrences {
  // the class instance properties
  term: string // mention, hashtag (with @ or #) or checklist item
  type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
  interval: string // currently only 'day' supported
  dateStr: string // typically YYYY-MM-DD, but also YYYY-Wnn
  numDays: number
  valuesMap: Map<string, number>
  total: number
  count: number

  /**
   * Create a new TMOccurrences object.
   * 
   * Initializes the valuesMap with entries for each day in the date range.
   * Sets all values to NaN (except for 'yesno' type which uses 0) so that
   * we can distinguish zero occurrences from missing data.
   * 
   * @param {string} term - The term being tracked (mention, hashtag, or checklist item) including '@' or '#'
   * @param {string} type - Type of tracking: 'yesno' | 'count' | 'total' | 'average' | 'all'
   * @param {string} fromISODateStr - Start date in YYYY-MM-DD format
   * @param {string} toISODateStr - End date in YYYY-MM-DD format
   * @param {string} interval - Time interval (currently only 'day' is fully supported). Defaults to 'day'.
   * @throws {Error} If date strings are missing or invalid
   */
  constructor(term: string, type: string, fromISODateStr: string, toISODateStr: string, interval: string = 'day') {
    try {
      if ((toISODateStr ?? '') === '' || (fromISODateStr ?? '') === '') {
        throw new Error('Both toISODateStr and fromISODateStr must be specified and non-empty')
      }

      this.term = term
      this.type = type
      this.interval = interval
      this.dateStr = fromISODateStr
      // Calc number of days to cover
      // (Moment's diff function returns a truncated number by default, not rounded, so work around that, in case we're getting 6.9 days because of timezone issues)
      const momFromDate = new moment(fromISODateStr, 'YYYY-MM-DD')
      const momToDate = new moment(toISODateStr, 'YYYY-MM-DD')
      const numDays = Math.round(momToDate.diff(momFromDate, 'days', true)) + 1
      this.numDays = numDays
      this.valuesMap = new Map < string, number > ()
      this.total = 0
      this.count = 0
      // Initialise all values to NaN, unless type 'yesno'
      for (let i = 0; i < numDays; i++) {
        const thisDateStr = calcOffsetDateStr(fromISODateStr, `${i}d`)
        // logDebug('TMOcc:constructor', `- +${i}d -> date ${thisDateStr}`)
        this.valuesMap.set(thisDateStr, (this.type === 'yesno') ? 0 : NaN)
      }
      // logDebug('TMOcc:constructor', `Constructed ${term} type ${this.type} for date ${fromISODateStr} - ${toISODateStr} -> valuesMap for ${this.valuesMap.size} / ${this.numDays} days `)
    }
    catch (error) {
      logError('TMOcc:constructor', error.message)
    }
  }

  /**
   * Add a found hashtag/mention occurrence to its instance, updating stats accordingly.
   * Note: Handles durations in `H:MM` format (e.g. `@sleep(7:42)`) as well as decimal (e.g. `@sleep(7.7)`).
   * @param {string} occurrenceStr of a found hashtag/mention
   * @param {string} dateStr format YYYYMMDD or YYYY-MM-DD
   */
  addOccurrence(occurrenceStr: string, dateStrArg: string): void {
    try {
      let isoDateStr = ''
      if (dateStrArg == null) {
        throw new Error(`Passed null date string`)
      }
      if (!(dateStrArg.match(RE_YYYYMMDD_DATE) || dateStrArg.match(RE_ISO_DATE))) {
        throw new Error(`Passed invalid date string '${dateStrArg}'`)
      }
      if (dateStrArg.match(RE_YYYYMMDD_DATE)) {
        isoDateStr = getISODateStringFromYYYYMMDD(dateStrArg)
      } else {
        isoDateStr = dateStrArg
      }
      // logDebug('TMOcc:addOccurrence', `starting for ${occurrenceStr} on ${isoDateStr}`)

      // isolate the value
      const _key = occurrenceStr
      let value = NaN
      // if this tag that finishes '/integer', then break into its two parts, ready to sum the numbers as well
      // Note: testing includes decimal part of a number, but the API .hashtags drops them
      if (occurrenceStr.match(/\/-?\d+(\.\d+)?$/)) {
        const tagParts = occurrenceStr.split('/')
        // key = tagParts[0]
        value = Number(tagParts[1])
        // logDebug('TMOcc:addOccurrence', `- found tagParts ${_key} / ${value.toString()}`)
      }
      // if this is a mention that finishes '(h:mm)' then treat as hours:minutes
      else if (occurrenceStr.match(/\(-?\d+:[0-5]?\d\)$/)) {
        const matches = occurrenceStr.match(/\((-?\d+):([0-5]?\d)\)$/)
        if (matches != null) {
          const hours = Number.parseInt(matches[1], 10)
          const minutes = Number.parseInt(matches[2], 10)
          value = hours + (minutes / 60)
          // Now round to 3 significant figures
          value = Math.round(value * 1000) / 1000
        }
        logDebug('TMOcc:addOccurrence', `- found mention duration ${_key} / ${value.toString()}`)
      }
      // if this is a mention that finishes '(float)', then break into separate parts first
      else if (occurrenceStr.match(/\(-?\d+(\.\d+)?\)$/)) {
        const mentionParts = occurrenceStr.split('(')
        // key = mentionParts[0]
        value = Number.parseFloat(mentionParts[1].slice(0, -1)) // chop off final ')' character
        // logDebug('TMOcc:addOccurrence', `- found mentionParts ${_key} / ${value.toString()}`)
      }

      // if this has a numeric value add to total, taking into account that the day may have several values.
      const prevValueRaw = this.valuesMap.get(isoDateStr)
      const prevValue: number = (prevValueRaw != null && !isNaN(prevValueRaw)) ? prevValueRaw : 0
      if (!isNaN(value)) {
        this.valuesMap.set(isoDateStr, prevValue + value)
        this.count++
        this.total += value
        // logDebug('TMOcc:addOccurrence', `- ${key} / ${value} -> ${this.total} from ${this.count} on ${isoDateStr}`)
      }
      // else just update the count
      else {
        this.valuesMap.set(isoDateStr, prevValue + 1)
        this.count++
        this.total++
        // logDebug('TMOcc:addOccurrence', `- ${key} increment -> ${this.total} from ${this.count} on ${isoDateStr}`)
      }
    }
    catch (err) {
      logError('TMOcc:addOccurrence', err.message)
    }
  }

  /**
   * Produce text summary of this TMOcc for a longer time interval.
   * Used by forCharts::weeklyStatsCSV().
   * Note: dates are inclusive and need to be in YYYY-MM-DD form.
   * @param {string} fromDateISOStr YYYY-MM-DD
   * @param {string} toDateISOStr YYYY-MM-DD
   * @param {string} interval to summarise to, e.g. 'week'
   * @param {string} style to output (currently 'CSV' or 'text')
   * @returns {string} CSV output: term, startDateStr, count, total, average
   */
  summaryTextForInterval(fromDateISOStr: string, toDateISOStr: string, interval: string, style: string): string {
    // Create new empty TMOccurrences object
    const summaryOcc = new TMOccurrences(this.term, this.type, fromDateISOStr, toDateISOStr, interval)
    const momFromDate = new moment(fromDateISOStr, 'YYYY-MM-DD')
    const momToDate = new moment(toDateISOStr, 'YYYY-MM-DD')
    this.numDays = momToDate.diff(momFromDate, 'days')
    // logDebug('summaryTextForInterval', `For ${fromDateISOStr} - ${toDateISOStr} = ${this.numDays} days`)
    // Now calculate summary from this (existing) object
    let count = 0
    let total = 0
    this.valuesMap.forEach((v, k, _m) => {
      // logDebug('summaryTextForInterval', `- k=${k}, v=${v}`)
      if (withinDateRange(getAPIDateStrFromDisplayDateStr(k), getAPIDateStrFromDisplayDateStr(fromDateISOStr), getAPIDateStrFromDisplayDateStr(toDateISOStr))) {
        // logDebug('summaryTextForInterval', `- ${k} in date range`)
        if (!isNaN(v)) {
          count++
          total += v
          // logDebug('summaryTextForInterval', `  - added ${v}`)
        }
      }
    })
    // Add this to the summaryOcc object
    summaryOcc.total = total
    summaryOcc.count = count
    // clo(summaryOcc, '', ' ')

    return summaryOcc.getSummaryForPeriod(style)
  }

  /**
   * Return the term for the current occObj, remove leading '@' or '#',
   * and optionally right-padded to a given width.
   * 
   * Used for consistent formatting in output, especially with sparklines
   * where alignment matters.
   * 
   * @param {number} paddingSize - Optional width to pad to (for alignment)
   * @returns {string} Term without leading '@' or '#', optionally padded
   */
  getTerm(paddingSize?: number): string {
    const pad = (paddingSize && paddingSize > 0) ? ' '.repeat(paddingSize - this.term.length) : ''
    return pad + this.term.slice(1) // chop off leading '@' or '#'
  }

  /**
   * Return just the values (not keys) from the valuesMap
   */
  getValues(): Array<number> {
    const outArr = []
    for (const f of this.valuesMap.values()) {
      outArr.push(f)
    }
    // logDebug('TMOcc:getValues', `for ${this.term} = ${outArr.length} items: ${outArr.toString()}`)
    return outArr
  }

  /**
   * Get the number of items in the valuesMap.
   * 
   * @returns {number} Number of entries in valuesMap
   */
  getNumberItems(): number {
    return this.valuesMap.size
  }

  /**
   * Log all the details in the main valuesMap.
   * 
   * Debug helper function to inspect the internal data structure.
   */
  logValuesMap(): void {
    logDebug('TMOcc:logValuesMap', `- valuesMap for ${this.term} with ${this.getNumberItems()} entries:`)
    this.valuesMap.forEach((v, k, _m) => {
      logDebug('TMOcc:logValuesMap', `  - ${k}: ${v}`)
    })
  }

  /**
   * Get a 'sparkline' (an inline bar or line chart) for a particular term for the current period, in a specified style.
   * Currently the only style available is 'ascii'.
   */
  getSparklineForPeriod(style: string = 'ascii', config: any): string {
    let output = ''
    switch (style) {
      case 'ascii': {
        if (this.type !== 'yesno') {
          const options = { min: 0, divider: '|', missingDataChar: '·' }
          output = makeSparkline(this.getValues(), options)
        } else {
          const options = { divider: '|', yesNoChars: config.progressYesNoChars }
          output = makeYesNoLine(this.getValues(), options)
        }
        break
      }
      default: {
        logError('TMOcc:getSparkline', `style '${style}' is not available`)
        break
      }
    }
    return output
  }

  /**
   * Get stats for a particular term, over the current period, in a specified style.
   * 
   * Formats statistics based on the term's type:
   * - 'yesno': Shows count / numDays (e.g., "5 / 7")
   * - 'count': Shows count only
   * - 'total': Shows total (from count) (e.g., "total 100 (from 10)")
   * - 'average': Shows average (from count) (e.g., "avg 5.2 (from 10)")
   * - 'all': Shows total and average (from count)
   * 
   * Available styles:
   * - 'text': Human-readable format (default)
   * - 'single': Just the numeric value
   * - 'CSV': Comma-separated format: term,startDateStr,count,total,average
   * 
   * @param {string} style - Output style: 'text' | 'single' | 'CSV'. Defaults to 'text'.
   * @returns {string} Formatted summary string
   */
  getSummaryForPeriod(style: string): string {
    let output = ''
    // logDebug('TMOcc:getStats', `starting for ${this.term} type=${this.type} style=${style} `)
    // Format count, total, and average with proper null/NaN handling
    const countStr = (!isNaN(this.count) && this.count !== '') ? this.count.toLocaleString() : `none`
    const totalStr = (!isNaN(this.total) && this.total !== '' && this.total > 0) ? `total ${this.total.toLocaleString()}` : 'total 0'
    // This is the average per item, not the average per day. In general I feel this is more useful for numeric amounts
    const itemAvgStr = (!isNaN(this.total) && this.total !== '' && this.count > 0) ? (this.total / this.count).toLocaleString([], { maximumSignificantDigits: 2 }) : ''

    switch (style) {
      case 'CSV': {
        output = `${this.term},${this.dateStr},${this.count},${this.total},${itemAvgStr}`
        break
      }
      case 'single': { // Note: not currently used
        // Single text output depends on the type
        switch (this.type) {
          case 'yesno': {
            output = countStr
            break
          }
          case 'total': {
            output = totalStr.replace('total ', '')
            break
          }
          case 'average': {
            output = itemAvgStr
            break
          }
          default: { // treat as 'count'
            output = (countStr !== 'none') ? countStr : ''
            break
          }
        }
        break
      }
      default: { // style 'text'
        // If we have no items, or simple single-unit counts, then just put count
        if (this.count === 0 || this.count === this.total) {
          output = countStr
        }
        else {
          // Otherwise the output depends on the type
          switch (this.type) {
            case 'yesno': {
              output = `${countStr} / ${this.numDays}`
              break
            }
            case 'count': {
              output = `${countStr}`
              break
            }
            case 'total': {
              output = `${totalStr} (from ${countStr})`
              break
            }
            case 'average': {
              if (itemAvgStr !== '') output += "avg " + itemAvgStr
              output += ` (from ${countStr})`
              break
            }
            default: { // 'all'
              if (totalStr !== '') output += totalStr
              if (itemAvgStr !== '') output += ", avg " + itemAvgStr
              output += ` (from ${countStr})`
              break
            }
          }
        }
        break
      }
    }
    return output
  }
}

//------------------------------------------------------------------------------
// Sparkline functions

/**
 * Calculate a 'sparkline' string for the 'data' set.
 * 
 * Creates an ASCII-art sparkline visualization using Unicode block characters.
 * - Missing data (NaN) is represented by missingDataChar (default: '.')
 * - Zero values are shown as blank space
 * - Other values are scaled from 0 to max over SPARKLINE_CHAR_COUNT block characters
 * 
 * The sparkline uses 8 different block characters (▁▂▃▄▅▆▇█) to represent
 * increasing values, providing a simple visual representation of data trends.
 * 
 * Options:
 * - min: number - Minimum value for scaling (normally 0). Defaults to Math.min(...data)
 * - max: number - Maximum value for scaling. Defaults to Math.max(...realNumberValues)
 * - divider: string - Character to use at start/end of sparkline. Defaults to '|'
 * - missingDataChar: string - Character for missing data points. Defaults to '.'
 * 
 * @author @jgclark drawing on https://github.com/zz85/ascii-graphs.js
 * @param {Array<number>} data - Array of numeric values (may include NaN for missing data)
 * @param {Object} options - Configuration options (min, max, divider, missingDataChar)
 * @returns {string} Formatted sparkline string (e.g., "|▁▂▃▄▅▆▇█|")
 */
export function makeSparkline(data: Array<number>, options: Object = {}): string {
  const spark_line_chars = "▁▂▃▄▅▆▇█".split('')
  const divider = options.divider ?? '|'
  const missingDataChar = options.missingDataChar ?? '.'

  let values = data
  const realNumberValues = values.slice().filter(x => !isNaN(x))
  const min = options.min ?? Math.min(...values)
  let max = options.max ?? Math.max(...realNumberValues)
  max -= min

  values = values.map(v => v - min)
  // const sum = realNumberValues.reduce((x, y) => x + y, 0)
  // const avg = sum / realNumberValues.length
  // clo(values, 'values to sparkline')
  // logDebug('makeSparkline', `-> ${min} - ${max} / ${sum} from ${values.length}`)

  const value_mapper = (value: number, _i: number) => {
    if (isNaN(value)) {
      return missingDataChar
    } else if (value === 0) {
      return ' '
    } else {
      let fraction = value / max
      fraction = Math.max(Math.min(1, fraction), 0) // clamp 0..1
      const index = Math.round(fraction * spark_line_chars.length) - 1
      return spark_line_chars[index > 0 ? index : 0]
    }
  }

  const chart = values.map(value_mapper).join('')
  const output = `${divider}${chart}${divider}`
  return output
}

/**
 * Calculate a 'sparkline'-like string of Yes/No indicators for the 'data' set.
 * 
 * Creates a simple visualization where:
 * - Data points > 0 are shown as yesChar (e.g., '✓')
 * - Data points 0 or NaN are shown as noChar (e.g., '·')
 * 
 * This is useful for visualizing Yes/No habit tracking over time.
 * 
 * Options:
 * - divider: string - Character to use at start/end. Defaults to '|'
 * - yesNoChars: Array<string> - Two-character array [yesChar, noChar]. Required.
 * 
 * @author @jgclark
 * @param {Array<number>} data - Array of numeric values (0 = no, >0 = yes, NaN = missing)
 * @param {Object} options - Configuration options (divider, yesNoChars)
 * @returns {string} Formatted Yes/No line (e.g., "|✓·✓✓·✓|")
 */
export function makeYesNoLine(data: Array<number>, options: Object = {}): string {
  const yesChar = options.yesNoChars?.[0] ?? '✓'
  const noChar = options.yesNoChars?.[1] ?? '·'
  const divider = options.divider ?? '|'

  const values = data
  // clo(values, 'values to yesNoLine')

  const value_mapper = (value: number, _i: number) => {
    return (value > 0) ? yesChar : noChar
  }

  const chart = values.map(value_mapper).join('')
  const output = `${divider}${chart}${divider}`
  return output
}
