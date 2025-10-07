/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 2025-10-07 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getISODateStringFromYYYYMMDD,
  isDailyNote,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  convertISODateFilenameToNPDayFilename,
  withinDateRange,
} from '@helpers/dateTime'
import type { TPeriodCode } from '@helpers/NPdateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import {
  // CaseInsensitiveMap,
  type headingLevelType,
} from '@helpers/general'
import {
  caseInsensitiveMatch, caseInsensitiveStartsWith,
  // isHashtagWanted, isMentionWanted
} from '@helpers/search'

//------------------------------------------------------------------------------
// Plotly info -- from v2.32.0
// Documentation: https://plotly.com/javascript/

// ES6 module: import Plotly from 'plotly.js-dist-min'

// HTML Script element:
// <head>
//     <script src="https://cdn.plot.ly/plotly-2.32.0.min.js" charset="utf-8"></script>
// </head>
// <body>
//     <div id="gd"></div>
// 
//     <script>
//         Plotly.newPlot("gd", /* JSON object */ {
//             "data": [{ "y": [1, 2, 3] }],
//             "layout": { "width": 600, "height": 400}
//         })
//     </script>
// </body>

// or Native ES6 import:
// <script type="module">
//   import "https://cdn.plot.ly/plotly-2.32.0.min.js"
//   Plotly.newPlot("gd", [{y: [1, 2, 3] }])
// </script>

//------------------------------------------------------------------------------
// Get settings

const pluginID = 'jgclark.Summaries'

export type SummariesConfig = {
  // Common settings ...
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  progressYesNoChars: string,
  excludeToday: boolean,
  // for appendProgressUpdate ...
  progressPeriod: TPeriodCode,
  progressDestination: string,
  progressHeading: string,
  showSparklines: boolean,
  progressYesNo: Array<string>,
  progressHashtags: Array<string>,
  progressHashtags: Array<string>,
  progressHashtagsAverage: Array<string>,
  progressHashtagsTotal: Array<string>,
  progressMentions: Array<string>,
  progressMentionsAverage: Array<string>,
  progressMentionsTotal: Array<string>,
  progressChecklistReferenceNote: string,
  // for periodStats ...
  folderToStore: string,
  PSStatsHeading: string, // was "statsHeading"
  PSShowSparklines: boolean, // was "periodStatsShowSparklines"
  PSHowAsHashtagOrMention: boolean, // was "showAsHashtagOrMention"
  PSYesNo: Array<string>, // both hashtags and mentions. Was "periodStatsYesNo"
  PSHashtagsCount: Array<string>, // was "includedHashtags"
  PSHashtagsAverage: Array<string>, // was "periodStatsHashtagsAverage"
  PSHashtagsTotal: Array<string>, // was "periodStatsHashtagsTotal"
  // PSHashtagsToExclude: Array<string>, // was "excludeHashtags"
  PSMentionsCount: Array<string>, // was "periodStatsMentions"
  PSMentionsAverage: Array<string>, // was "periodStatsMentionsAverage"
  PSMentionsTotal: Array<string>, // was "periodStatsMentionsTotal"
  // PSMentionsToExclude: Array<string>, // was "excludeMentions"
  // for todayProgress ...
  todayProgressHeading: string,
  todayProgressItems: Array<string>,
  // for charts ...
  weeklyStatsItems: Array<string>,
  weeklyStatsDuration: ?number,
  weeklyStatsIncludeCurrentWeek: boolean,
}

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

/**
 * Get config settings using Config V2 system.
 * @return {SummariesConfig} object with configuration
 */
export async function getSummariesSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getSummariesSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: SummariesConfig = await DataStore.loadJSON('../jgclark.Summaries/settings.json')
    // clo(v2Config, `${pluginID} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }

    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

//------------------------------------------------------------------------------
/**
 * Class to hold occurence summary of Hashtags and/or Mentions ('TM') for a given time interval.
 * A progress term has a 'type': 'daily-average', 'item-average', 'total', 'yesno', 'count'
 * These tailor the display.
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
   * Create a new object, initialising the main valuesMap to the required number of daily date. Sets all values to 'NaN', so that we can distinguish zero from no occurrences.
   * (Unless type 'yesno')
   * @param {string} term: mention, hashtag or checklist item
   * @param {string} type: 'daily-average', 'item-average', 'total', 'yesno', 'count'
   * @param {string} fromISODateStr of type YYYY-MM-DD
   * @param {string} toISODateStr of type YYYY-MM-DD
   * @param {string} interval?: 'day' is currently the only one fully supported
   */
  constructor(term: string, type: string, fromISODateStr: string, toISODateStr: string, interval: string = 'day') {
    try {
      if (!toISODateStr || !fromISODateStr) {
        throw new Error('toISODateStr and fromISODateStr must both be specified')
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
   * Add a found hashtag/mention occurrence to its instance, updating stats accordingly
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
        throw new Error(`Passed invalid date string '${isoDateStr}'`)
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
      // if this is a mention that finishes '(float)', then break into separate parts first
      else if (occurrenceStr.match(/\(-?\d+(\.\d+)?\)$/)) {
        const mentionParts = occurrenceStr.split('(')
        // key = mentionParts[0]
        value = Number.parseFloat(mentionParts[1].slice(0, -1)) // chop off final ')' character
        // logDebug('TMOcc:addOccurrence', `- found mentionParts ${_key} / ${value.toString()}`)
      }

      // if this has a numeric value add to total, taking into account that the day may have several values.
      // $FlowFixMe[incompatible-type]
      const prevValue: number = isNaN(this.valuesMap.get(isoDateStr)) ? 0 : this.valuesMap.get(isoDateStr)
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
      if (withinDateRange(k, fromDateISOStr, toDateISOStr)) {
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
   * @param {number?} paddingSize
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

  getNumberItems(): number {
    return this.valuesMap.size
  }

  /**
   * Log all the details in the main valuesMap
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
   * Currently the only available styles are:
   * - 'text' => varies depending on the 'type' of the 'term'
   * - 'single' => varies depending on the 'type' of the 'term'
   * - 'CSV' => term, startDateStr, count, total, average
   * Currently the only available interval is 'day'.
   */
  getSummaryForPeriod(style: string): string {
    let output = ''
    // logDebug('TMOcc:getStats', `starting for ${this.term} type=${this.type} style=${style} `)
    // $FlowIgnore[incompatible-type] - @DW says the !== '' check is needed but flow doesn't like it
    const countStr = (!isNaN(this.count) && this.count !== '') ? this.count.toLocaleString() : `none`
    // $FlowIgnore[incompatible-type] - as above
    const totalStr = (!isNaN(this.total) && this.total !== '' && this.total > 0) ? `total ${this.total.toLocaleString()}` : 'total 0'
    // This is the average per item, not the average per day. In general I feel this is more useful for numeric amounts
    // $FlowIgnore[incompatible-type] - as above
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

/**
 * Gather all occurrences of requested hashtags and mentions from daily notes for a given period, including 'YesNo', 'Count', 'Total' and 'Average' for the items.
 * Note: Completed Checklist items are also gathered if a Reference note is set (added by @aaronpoweruser).
 * Note: This will look at Teamspace notes, but this has not been tested.
 * Returns a list of TMOccurrences instances:
    term: string
    type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
    period: string
    numDays: number
    valuesMap: Map<string, number> // map of <YYYY-MM-DD, count>
    total: number
    count: number
 *
 * @author @jgclark, with addition by @aaronpoweruser
 * @param {string} periodString
 * @param {string} fromDateStr (YYYY-MM-DD)
 * @param {string} toDateStr (YYYY-MM-DD)
 * @param {OccurrencesToLookFor} occToLookFor containing the various settings of which occurrences to gather
 * @returns {Array<TMOccurrences>}
 */
export function gatherOccurrences(
  periodString: string,
  fromDateStr: string,
  toDateStr: string,
  occToLookFor: OccurrencesToLookFor
): Array<TMOccurrences> {
  try {
    const calendarNotesInPeriod = DataStore.calendarNotes.filter(
      (n) =>
        isDailyNote(n) &&
        withinDateRange(getDateStringFromCalendarFilename(n.filename), convertISODateFilenameToNPDayFilename(fromDateStr), convertISODateFilenameToNPDayFilename(toDateStr)))
    if (calendarNotesInPeriod.length === 0) {
      logWarn('gatherOccurrences', `- no matching calendar notes found between ${fromDateStr} and ${toDateStr}`)
      return [] // for completeness
    }

    logInfo('gatherOccurrences', `starting with ${calendarNotesInPeriod.length} calendar notes (including week/month notes) for '${periodString}' (${fromDateStr} - ${toDateStr})`)
    let tmOccurrencesArr: Array<TMOccurrences> = [] // to hold what we find

    // Note: in the following is a workaround to an API 'feature' in note.hashtags
    // where #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // To take account of this the tag/mention loops below go backwards to use the longest first

    //------------------------------
    // Review each wanted YesNo type
    let startTime = new Date()
    // make sure this is an array first
    const YesNoListArr = (typeof occToLookFor.GOYesNo === 'string')
      // $FlowIgnore[incompatible-type]
      ? (occToLookFor.GOYesNo !== "")
        ? occToLookFor.GOYesNo.split(',')
        : []
      : occToLookFor.GOYesNo
    logDebug('gatherOccurrences', `GOYesNo = <${String(occToLookFor.GOYesNo)}> type ${typeof occToLookFor.GOYesNo}`)

    for (const wantedItem of YesNoListArr) {
      // initialise a new TMOccurence for this YesNo item
      const thisOcc = new TMOccurrences(wantedItem, 'yesno', fromDateStr, toDateStr)

      // For each daily note in the period
      for (const n of calendarNotesInPeriod) {
        const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))

        // Look at hashtags first ...
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tag, lastTag)) {
            // logDebug('gatherOccurrences', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
          }
          else {
            // check this is one of the ones we're after, then add
            if (caseInsensitiveMatch(tag, wantedItem)) {
              // logDebug('gatherOccurrences', `- Found matching occurrence ${tag} on date ${n.filename}`)
              thisOcc.addOccurrence(tag, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${tag} not wanted`)
            }
          }
          lastTag = tag
        }

        // Then mentions ...
        const seenMentions = n.mentions.slice().reverse()
        // const lastMention = ''
        for (const mention of seenMentions) {
          // First need to add a check for a bug: `@repeat(1/7)` is returned as `@repeat(1/7), @repeat(1`. Skip the incomplete one.
          if (mention.match(/^@repeat\(\d+$/)) { // e.g. @repeat(4/ 
            continue // skip this mention
          }
          // Also skip where there are mis-matched brackets in this single mention e.g. `@run(12 @distance(6.5)`
          if (mention.match(/\(([^\)]+$|[^\)]+\s@.*\(.*\))/)) {
            logInfo('gatherOccurrences', `- Skipping ill-formed mention '${mention}' on date ${n.filename}`)
            continue // skip this mention
          }

          // check this is one of the ones we're after, then add
          if (caseInsensitiveMatch(mention, wantedItem)) {
            logDebug('gatherOccurrences', `- Found matching occurrence ${mention} on date ${n.filename}`)
            thisOcc.addOccurrence(mention, thisDateStr)
          } else {
            // logDebug('gatherOccurrences', `- x ${mention} not wanted`)
          }
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }
    logTimer('gatherOccurrences', startTime, `Gathered YesNoList`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    // Now compute Completed Checklist items, if Reference note is set
    // Note: this was added by @aaronpoweruser. TODO: it would make more sense to refactor this to have the GO...Setting be the checklist array, not the note name.
    if (occToLookFor.GOChecklistRefNote !== '') {
      startTime = new Date()
      const CompletedChecklistItems = gatherCompletedChecklistItems(calendarNotesInPeriod, fromDateStr, toDateStr, occToLookFor)
      tmOccurrencesArr = tmOccurrencesArr.concat(CompletedChecklistItems)
      logTimer('gatherOccurrences', startTime, `Gathered CompletedChecklistItems data`)
    }

    //------------------------------
    // Review each wanted hashtag
    startTime = new Date()

    // There are now 3 kinds of @mentions to process: make a superset of them to sort and then process in one go
    // Make sure they are arrays first.
    const countHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsCount, ',')
    const averageHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsAverage, ',')
    const totalHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsTotal, ',')
    const combinedHashtags = []
    countHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'count']) })
    averageHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'average']) })
    totalHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'total']) })
    combinedHashtags.sort()
    logDebug('gatherOccurrences', `${String(combinedHashtags.length)} sorted combinedHashtags: <${String(combinedHashtags)}>`)

    // If the sorted combinedHashtags array contains a repeated term as both 'average' and 'total', then remove the second occurence, and change the type of the first to  'all'
    for (let i = 1; i < combinedHashtags.length; i++) {
      if (combinedHashtags[i - 1][0] === combinedHashtags[i][0] && combinedHashtags[i - 1][1] === 'average' && combinedHashtags[i][1] === 'total') {
        // logDebug('gatherOccurrences', ` - found ones to combine: <${String(combinedHashtags[i])}> and <${String(combinedHashtags[i - 1])}>`)
        combinedHashtags[i - 1][1] = 'all'
        combinedHashtags.splice(i, 1)
        i++
      }
    }

    // Note: I think there's a reason for nesting these two loops this way round, but I now can't remember what it was.
    for (const thisTag of combinedHashtags) {
      // initialise a new TMOccurence for this mention
      const [thisName, thisType] = thisTag
      const thisOcc = new TMOccurrences(thisName, thisType, fromDateStr, toDateStr)
      // logDebug('gatherOccurrences', `thisTag=${thisName} / ${thisType}`)

      // For each daily note in the period, look at each tag in reverse order to make subset checking work
      for (const n of calendarNotesInPeriod) {
        const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          // logDebug('gatherOccurrences', `orig: ${tag} ...`)
          const RE_HASHTAG_CAPTURE_TERMINAL_SLASH_AND_FLOAT = /\/(-?\d+(\.\d+)?)$/
          const tagWithoutClosingNumber = tag.replace(RE_HASHTAG_CAPTURE_TERMINAL_SLASH_AND_FLOAT, '')
          // logDebug('gatherOccurrences', `  ... this:${tagWithoutClosingNumber} last:${lastTag} `)
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tag, lastTag)) {
            // logDebug('calcHashtagStatsPeriod', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
            continue // skip this tag
          }
          else {
            // check this is one of the ones we're after, then add
            if (caseInsensitiveMatch(tagWithoutClosingNumber, thisName)) {
              // logDebug('gatherOccurrences', `- Found matching occurrence ${tag} on date ${n.filename}`)
              thisOcc.addOccurrence(tag, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${tag} not wanted`)
            }
          }
          lastTag = tag
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }
    logTimer('gatherOccurrences', startTime, `Gathered ${String(combinedHashtags.length)} combinedHashtags`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    //------------------------------
    // Now repeat for @mentions
    startTime = new Date()

    // There are now 3 kinds of @mentions to process: make a superset of them to sort and then process in one go
    // Make sure they are arrays first.
    const countMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsCount, ',')
    const averageMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsAverage, ',')
    const totalMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsTotal, ',')
    const combinedMentions = []
    countMentionsArr.forEach((m) => { combinedMentions.push([m, 'count']) })
    averageMentionsArr.forEach((m) => { combinedMentions.push([m, 'average']) })
    totalMentionsArr.forEach((m) => { combinedMentions.push([m, 'total']) })
    combinedMentions.sort()
    logDebug('gatherOccurrences', `sorted combinedMentions: <${String(combinedMentions)}>`)

    // If the sorted combinedMentions array contains a repeated term as both 'average' and 'total', then remove the second occurence, and change the type of the first to  'all'
    for (let i = 1; i < combinedMentions.length; i++) {
      if (combinedMentions[i - 1][0] === combinedMentions[i][0] && combinedMentions[i - 1][1] === 'average' && combinedMentions[i][1] === 'total') {
        // logDebug('gatherOccurrences', ` - found ones to combine: <${String(combinedMentions[i])}> and <${String(combinedMentions[i - 1])}>`)
        combinedMentions[i - 1][1] = 'all'
        combinedMentions.splice(i, 1)
        i++
      }
    }

    // Note: I think there's a reason for nesting these two loops this way round, but I now can't remember what it was.
    for (const thisMention of combinedMentions) {
      // initialise a new TMOccurence for this mention
      const [thisName, thisType] = thisMention
      const thisOcc = new TMOccurrences(thisName, thisType, fromDateStr, toDateStr)

      // For each daily note in the period, look at each mention in reverse order to make subset checking work
      for (const n of calendarNotesInPeriod) {
        const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(n.filename))
        const seenMentions = n.mentions.slice().reverse()
        let lastMention = ''
        for (const mention of seenMentions) {
          // First need to add a check for an API bug: '@repeat(1/7)' is returned as [@repeat(1/7), @repeat(1]. Skip the incomplete one.
          if (mention.match(/\([^\)]+$/)) { // opening bracket not followed by closing bracket
            continue // skip this mention
          }

          const mentionWithoutNumberPart = (mention.split('(', 1))[0]
          // logDebug('gatherOccurrences', `- reviewing ${mention} [${mentionWithoutNumberPart}] looking for ${thisName} on ${thisDateStr}`)
          // if this tag is starting subset of the last one, assume this is an example of the issue, so skip this mention
          if (caseInsensitiveStartsWith(mentionWithoutNumberPart, lastMention)) {
            // logDebug('gatherOccurrences', `- Found ${mention} but ignoring as part of a longer mention of the same name`)
            continue // skip this mention
          }
          else {
            // check this is on inclusion, or not on exclusion list, before adding
            if (caseInsensitiveMatch(mentionWithoutNumberPart, thisName)) {
              // logDebug('gatherOccurrences', `- Found matching occurrence ${mention} on date ${n.filename}`)
              thisOcc.addOccurrence(mention, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${mention} not wanted`)
            }
          }
          lastMention = thisName
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }
    logTimer('gatherOccurrences', startTime, `Gathered ${String(combinedMentions.length)} combinedMentions`)
    logDebug('gatherOccurrences', `Now ${tmOccurrencesArr.length} occObjects`)

    logDebug('gatherOccurrences', `Finished with ${tmOccurrencesArr.length} occObjects`)
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
    return [] // for completness
  }
}

/**
 * Gather all occurrences of requested checklist items for a given period.
 * It only inspects the daily calendar notes for the period.
 * Returns a list of TMOccurrences instances:
    term: string
    type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
    period: string
    numDays: number
    valuesMap: Map<string, number> // map of <YYYY-MM-DD, count>
    total: number
    count: number
  * @author @aaronpoweruser
  * @param {string} calendarNotesInPeriod containing the daily notes for the period
  * @param {string} fromDateStr (YYYY-MM-DD)
  * @param {string} toDateStr (YYYY-MM-DD)
  * @param {OccurrencesToLookFor} occToLookFor containing the various settings of which occurrences to gather. Needs to include .GOChecklistRefNote (from setting 'progressChecklistReferenceNote')
  * @returns {Array<TMOccurrences>}
  */
function gatherCompletedChecklistItems(calendarNotesInPeriod: Array<TNote>, fromDateStr: string, toDateStr: string, occToLookFor: OccurrencesToLookFor): Array<TMOccurrences> {
  try {
    if (occToLookFor.GOChecklistRefNote === '') throw new Error("Reference note for checklists is not set -- please check setting 'Name of reference note for checklist items'. Stopping.")

    const tmOccurrencesArr: Array<TMOccurrences> = []
    const completedTypes = ['checklistDone', 'checklistScheduled']

    let referenceNote: TNote
    const foundNotes = DataStore.projectNoteByTitle(occToLookFor.GOChecklistRefNote, true, true)
    if (foundNotes && foundNotes.length > 0) {
      referenceNote = foundNotes[0]
    } else {
      throw new Error(`Couldn't find note with title '${occToLookFor.GOChecklistRefNote}'. Stopping.`)
    }

    // Get all the checklist items from the reference note
    const refNoteParas = referenceNote?.paragraphs ?? []
    for (const para of refNoteParas) {
      if (para.type === 'checklist') {
        logDebug('gatherCompletedChecklistItems', `Found checklist in reference note ${para.content}`)
        // pad the term with a space to fix emojis being clobered by sparklines
        const thisOcc = new TMOccurrences(` ${para.content}`, 'yesno', fromDateStr, toDateStr)
        tmOccurrencesArr.push(thisOcc)
      }
    }

    // For each daily note in the period check for occurrences of the checklist items
    for (const currentNote of calendarNotesInPeriod) {
      const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(currentNote.filename))
      for (const para of currentNote.paragraphs) {
        if (completedTypes.includes(para.type)) {
          for (const checklistTMO of tmOccurrencesArr) {
            // pad the term with a space to fix emojis being clobered
            if (checklistTMO.term === ` ${para.content}`) {
              logDebug('gatherCompletedChecklistItems', `Found matching occurrence ${para.content} in note ${currentNote.filename}`)
              checklistTMO.addOccurrence(checklistTMO.term, thisDateStr)
            }
          }
        }
      }
    }
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherCompletedChecklistItems', error.message)
    return []
  }
}

/**
 * Generate output lines for each term, according to the specified style (currently only supports style 'markdown').
 * @param {Array<TMOccurrences>} occObjs
 * @param {string} periodString
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @param {string} style (currently only supports 'markdown')
 * @param {boolean} requestToShowSparklines
 * @param {boolean} sortOutput
 * @returns Array<string>
 */
export async function generateProgressUpdate(
  occObjs: Array<TMOccurrences>, periodString: string, fromDateStr: string, toDateStr: string, style: string, requestToShowSparklines: boolean, sortOutput: boolean
): Promise<Array<string>> {
  try {
    logDebug('generateProgressUpdate', `starting for ${periodString} (${fromDateStr} - ${toDateStr}) with ${occObjs.length} occObjs and sparklines? ${String(requestToShowSparklines)}`)

    const config = await getSummariesSettings()

    const toDateMom = moment(toDateStr, "YYYY-MM-DD")
    const fromDateMom = moment(fromDateStr, "YYYY-MM-DD")
    const daysBetween = toDateMom.diff(fromDateMom, 'days')
    // Include sparklines only if this period is a month or less
    const showSparklines = (requestToShowSparklines && daysBetween <= 31)
    // Get length of longest progress term (to use with sparklines)
    const maxTermLen = Math.max(...occObjs.map((m) => m.term.length))

    const outputArray: Array<string> = []
    for (const occObj of occObjs) {
      // occObj.logValuesMap()
      let thisOutput = ''
      switch (style) {
        case 'markdown': {
          if (showSparklines) {
            thisOutput = "`" + occObj.getTerm(maxTermLen) + " " + occObj.getSparklineForPeriod('ascii', config) + "`"
          } else {
            thisOutput = "**" + occObj.getTerm() + "**: "
          }
          thisOutput += " " + occObj.getSummaryForPeriod('text')
          break
        }
        default: {
          logError('generateProgressUpdate', `style '${style}' is not available`)
          break
        }
      }
      outputArray.push(thisOutput)
      if (sortOutput) {
        if (showSparklines) {
          // sort using locale-aware sorting (having trimmed off non-text at start of line)
          outputArray.sort((a, b) => a.slice(1).trim().localeCompare(b.slice(1).trim()))

        } else {
          // sort using locale-aware sorting
          outputArray.sort((a, b) => a.localeCompare(b))
        }
      }
    }
    return outputArray
  }
  catch (error) {
    logError('generateProgressUpdate', error.message)
    return [] // for completeness
  }
}

/**
 * Calculate a 'sparkline' string for the 'data' set.
 * - where a data point is 'NaN', output a different 'missingDataChar'
 * - if the data point is 0, output a blank space
 * - otherwise scale from 0 to max over the 8 available block characters increasing in size
 * Options:
 * - min: number: the minimum value to use for this sparkline (normally 0)
 * - divider: string
 * - missingDataChar: single-char string
 * -
 * @author @jgclark drawing on https://github.com/zz85/ascii-graphs.js
 * @param {Array<number>} data
 * @param {Object} options
 * @returns {string} output
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
 * Calculate a 'sparkline'-like string of Yes/No for the 'data' set.
 * - if the data point is >0, output yesChar
 * - where a data point is 0 or 'NaN', output noChar
 * Options:
 * - divider: string
 * - noChar: single-char string
 * - yesChar: single-char string
 * @author @jgclark
 * @param {Array<number>} data
 * @param {Object} options
 * @returns {string} output
 */
export function makeYesNoLine(data: Array<number>, options: Object = {}): string {
  const yesChar = options.yesNoChars[0]
  const noChar = options.yesNoChars[1]
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
