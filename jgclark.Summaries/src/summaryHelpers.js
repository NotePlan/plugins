// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 2.3.2024 for v0.21.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  calcOffsetDateStr,
  getDateFromUnhyphenatedDateString,
  getDateStringFromCalendarFilename,
  getISODateStringFromYYYYMMDD,
  isDailyNote,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
  withinDateRange,
} from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logInfo, logWarn, logError, timer } from '@helpers/dev'
import {
  CaseInsensitiveMap,
  type headingLevelType,
} from '@helpers/general'
import {
  caseInsensitiveMatch,
  caseInsensitiveStartsWith,
  isHashtagWanted,
  isMentionWanted,
} from '@helpers/search'
import { truncateString } from '@helpers/stringTransforms'

//------------------------------------------------------------------------------
// Get settings

const pluginID = 'jgclark.Summaries'

export type SummariesConfig = {
  foldersToExclude: Array<string>,
  showSparklines: boolean,
  folderToStore: string,
  statsHeading: string,
  headingLevel: headingLevelType,
  excludeToday: boolean,
  hashtagCountsHeading: string,
  mentionCountsHeading: string,
  showAsHashtagOrMention: boolean,
  weeklyStatsItems: Array<string>,
  weeklyStatsDuration: ?number,
  weeklyStatsIncludeCurrentWeek: boolean,
  progressPeriod: string,
  progressDestination: string,
  progressHeading: string,
  progressYesNoChars: string,
  progressChecklistReferenceNote: string,
  // for progressUpdate ...
  progressHashtags: Array<string>,
  progressHashtagsAverage: Array<string>,
  progressHashtagsTotal: Array<string>,
  progressMentions: Array<string>,
  progressMentionsAverage: Array<string>,
  progressMentionsTotal: Array<string>,
  progressYesNo: Array<string>,
  periodStatsShowSparklines: boolean,
  // for todayProgress ...
  todayProgressHeading: string,
  todayProgressItems: Array<string>,
  // for periodStats ...
  periodStatsYesNo: Array<string>,
  includedHashtags: Array<string>,
  excludedHashtags: Array<string>,
  includedMentions: Array<string>,
  excludedMentions: Array<string>,
  periodStatsMentionsAverage: Array<string>,
  periodStatsMentionsTotal: Array<string>,
}

// Reduced set of the above designed to carry settings into gatherOccurrences
export type OccurrencesToLookFor = {
  GOYesNo: Array<string>,
  GOHashtagsCount: Array<string>,
  GOHashtagsAverage: Array<string>,
  GOHashtagsTotal: Array<string>,
  GOHashtagsExclude: Array<string>,
  GOMentionsCount: Array<string>,
  GOMentionsAverage: Array<string>,
  GOMentionsTotal: Array<string>,
  GOMentionsExclude: Array<string>,
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
        let thisDateStr = calcOffsetDateStr(fromISODateStr, `${i}d`)
        // logDebug('TMOcc:constructor', `- +${i}d -> date ${thisDateStr}`)
        this.valuesMap.set(thisDateStr, (this.type == 'yesno') ? 0 : NaN)
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
      let key = occurrenceStr
      let value = NaN
      // if this tag that finishes '/integer', then break into its two parts, ready to sum the numbers as well
      // Note: testing includes decimal part of a number, but the API .hashtags drops them
      if (occurrenceStr.match(/\/-?\d+(\.\d+)?$/)) {
        const tagParts = occurrenceStr.split('/')
        key = tagParts[0]
        value = Number(tagParts[1])
        // logDebug('TMOcc:addOccurrence', `- found tagParts ${key} / ${value.toString()}`)
      }
      // if this is a mention that finishes '(float)', then break into separate parts first
      else if (occurrenceStr.match(/\(-?\d+(\.\d+)?\)$/)) {
        const mentionParts = occurrenceStr.split('(')
        key = mentionParts[0]
        value = Number.parseFloat(mentionParts[1].slice(0, -1)) // chop off final ')' character
        // logDebug('TMOcc:addOccurrence', `- found mentionParts ${key} / ${value.toString()}`)
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
    let summaryOcc = new TMOccurrences(this.term, this.type, fromDateISOStr, toDateISOStr, interval)
    const momFromDate = new moment(fromDateISOStr, 'YYYY-MM-DD')
    const momToDate = new moment(toDateISOStr, 'YYYY-MM-DD')
    this.numDays = momToDate.diff(momFromDate, 'days')
    // logDebug('summaryTextForInterval', `For ${fromDateISOStr} - ${toDateISOStr} = ${this.numDays} days`)
    // Now calculate summary from this (existing) object
    let count = 0
    let total = 0
    this.valuesMap.forEach((v, k, m) => {
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

    // NOTE: tested and looks ok for @mention(...)
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
    let outArr = []
    for (let f of this.valuesMap.values()) {
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
    this.valuesMap.forEach((v, k, m) => {
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
    // logDebug('TMOcc:getStats', `starting for ${ this.term } type ${ this.type } style ${ style } `)
    // $FlowFixMe[incompatible-type] - @DW says the !== '' check is needed but flow doesn't like it
    const countStr = (!isNaN(this.count) && this.count !== '') ? this.count.toLocaleString() : `none`
    // $FlowFixMe[incompatible-type] - as above
    const totalStr = (!isNaN(this.total) && this.total !== '' && this.total > 0) ? `total ${this.total.toLocaleString()}` : 'total 0'
    // This is the average per item, not the average per day. In general I feel this is more useful for numeric amounts
    // $FlowFixMe[incompatible-type] - as above
    const itemAvgStr = (!isNaN(this.total) && this.total !== '' && this.count > 0) ? (this.total / this.count).toLocaleString([], { maximumSignificantDigits: 3 }) : ''

    switch (style) {
      case 'CSV': {
        output = `${this.term},${this.dateStr},${this.count},${this.total},${itemAvgStr}`
        break
      }
      case 'single': {
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
 * Gather all occurrences of requested hashtags and mentions for a given period, including 'progressYesNo', 'mentionTotal' and 'mentionAverage' variations.
 * It only inspects the daily calendar notes for the period.
 * Returns a list of TMOccurrences instances:
    term: string
    type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
    period: string
    numDays: number
    valuesMap: Map<string, number> // map of <YYYY-MM-DD, count>
    total: number
    count: number
 *
 * @author @jgclark
 * @param {string} periodString
 * @param {string} fromDateStr (YYYY-MM-DD)
 * @param {string} toDateStr (YYYY-MM-DD)
 * @param {OccurrencesToLookFor} occToLookFor containing the various settings of which occurrences to gather
 * @returns {Array<TMOccurrences>}
 */
export function gatherOccurrences(periodString: string, fromDateStr: string, toDateStr: string, occToLookFor: OccurrencesToLookFor): Array<TMOccurrences> {
  try {
    const calendarNotesInPeriod = DataStore.calendarNotes.filter(
      (n) =>
        isDailyNote(n) && withinDateRange(getDateStringFromCalendarFilename(n.filename), unhyphenateString(fromDateStr), unhyphenateString(toDateStr)))
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
    const YesNoListArr = (typeof occToLookFor.GOYesNo === 'string') ? occToLookFor.GOYesNo.split(',') : occToLookFor.GOYesNo // make sure this is an array first
    for (let wantedItem of YesNoListArr) {
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
        let lastMention = ''
        for (const mention of seenMentions) {
          // First need to add a check for a bug: `@repeat(1/7)` is returned as `@repeat(1/7), @repeat(1`. Skip the incomplete one.
          // Also skip where there are mis-matched brackets in this single mention e.g. `@run(12 @distance(6.5)`
          if (mention.match(/\(([^\)]+$|[^\)]+\s@.*\(.*\))/)) {
            logWarn('gatherOccurrences', `- Skipping ill-formed mention '${mention}' on date ${n.filename}`)
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
    logInfo('gatherOccurrences', `Gathered YesNoList in ${timer(startTime)}`)

    //------------------------------
    // Review each wanted hashtag
    // Note: Add exclusion mechanism back in if needed? (I looked at it, and to do so breaks various things including result ordering that derives from the 'wanted' setting.)
    startTime = new Date()

    // There are now 3 kinds of @mentions to process: make a superset of them to sort and then process in one go
    // Make sure they are arrays first.
    const allHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsCount, ',')
    const averageHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsAverage, ',')
    const totalHashtagsArr = stringListOrArrayToArray(occToLookFor.GOHashtagsTotal, ',')
    const combinedHashtags = []
    allHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'all']) })
    averageHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'average']) })
    totalHashtagsArr.forEach((m) => { combinedHashtags.push([m, 'total']) })
    combinedHashtags.sort()
    logDebug('gatherOccurrences', `sorted combinedHashtags: ${String(combinedHashtags)}`)

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
    logInfo('gatherOccurrences', `Gathered combinedHashtags in ${timer(startTime)}`)

    //------------------------------
    // Now repeat for @mentions
    // Note: Add exclusions -- as section above?
    startTime = new Date()

    // There are now 3 kinds of @mentions to process: make a superset of them to sort and then process in one go
    // Make sure they are arrays first.
    const allMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsCount, ',')
    const averageMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsAverage, ',')
    const totalMentionsArr = stringListOrArrayToArray(occToLookFor.GOMentionsTotal, ',')
    const combinedMentions = []
    allMentionsArr.forEach((m) => { combinedMentions.push([m, 'all']) })
    averageMentionsArr.forEach((m) => { combinedMentions.push([m, 'average']) })
    totalMentionsArr.forEach((m) => { combinedMentions.push([m, 'total']) })
    combinedMentions.sort()

    logDebug('gatherOccurrences', `sorted combinedMentions: ${String(combinedMentions)}`)

    // Note: I think there's a reason for nesting these two loops this way round, but I now can't remember what it was.
    for (let thisMention of combinedMentions) {
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
    logInfo('gatherOccurrences', `Gathered combinedMentions data in ${timer(startTime)}`)

    startTime = new Date()

    const CompletedChecklistItems = gatherCompletedChecklistItems(calendarNotesInPeriod, fromDateStr, toDateStr, occToLookFor)
    tmOccurrencesArr = tmOccurrencesArr.concat(CompletedChecklistItems)
    logInfo('gatherOccurrences', `Gathered CompletedChecklistItems data in ${timer(startTime)}`)

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
  * @param {OccurrencesToLookFor} occToLookFor containing the various settings of which occurrences to gather
  * @returns {Array<TMOccurrences>}
  */
function gatherCompletedChecklistItems(calendarNotesInPeriod: Array<TNote>, fromDateStr: string, toDateStr: string, occToLookFor: OccurrencesToLookFor): Array<TMOccurrences> {

  const tmOccurrencesArr: Array<TMOccurrences> = []
  const completedTypes = ['checklistDone', 'checklistScheduled']

  let referenceNote
  const foundNotes = DataStore.projectNoteByTitle(occToLookFor.GOChecklistRefNote, true, true)
  if (typeof foundNotes !== 'undefined' && Array.isArray(foundNotes)) {
    if (foundNotes.length === 1) {
      referenceNote = foundNotes[0]
    } else {
      logError('gatherCompletedChecklistItems', `Found ${foundNotes.length} notes with title ${occToLookFor.GOChecklistRefNote}`)
      return tmOccurrencesArr
    }
  }

  // Get all the checklist items from the reference note
  for (const para of referenceNote.paragraphs) {
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

/**
 * Generate output lines for each term, according to the specified style (currently only supports style 'markdown').
 * @param {Array<TMOccurrences>} occObjs
 * @param {string} periodString
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @param {string} style
 * @param {boolean} requestToShowSparklines
 * @param {boolean} sortOutput
 * @returns Array<string>
 */
export async function generateProgressUpdate(occObjs: Array<TMOccurrences>, periodString: string, fromDateStr: string, toDateStr: string, style: string, requestToShowSparklines: boolean, sortOutput: boolean): Promise<Array<string>> {
  try {
    logDebug('generateProgressUpdate', `starting for ${periodString} (${fromDateStr} - ${toDateStr}) with ${occObjs.length} occObjs and sparklines? ${String(requestToShowSparklines)}`)

    const config = await getSummariesSettings()

    const toDateMom = moment(toDateStr, "YYYY-MM-DD")
    const fromDateMom = moment(fromDateStr, "YYYY-MM-DD")
    const daysBetween = toDateMom.diff(fromDateMom, 'days')
    // Include sparklines only if this period is a month or less
    const showSparklines = (requestToShowSparklines && daysBetween <= 31)
    if (showSparklines) {
      // Truncate lines to avoid line wrapping
      occObjs.forEach((m) => m.term = truncateString(m.term, 60, 'middle'))
    }
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
 * WARNING: THIS IS NOW DEPRECATED IN FAVOUR OF gatherOccurrences and generateProgressUpdate.
 *
 * Calculate hashtag statistics for daily notes of a given time period
 * - Map of { tag, count } for all tags included or not excluded
 * - Map of { tag, total } for the subset of all tags above that finish with a /number
 * @author @jgclark
 *
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @param {$ReadOnlyArray<string>} includedTerms - array of hashtags to include (takes precedence over excluded terms)
 * @param {$ReadOnlyArraystring>} excludedTerms - array of hashtags to exclude
 * @return {[Map, Map]}
 */
export function calcHashtagStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
  includedTerms: $ReadOnlyArray<string>,
  excludedTerms: $ReadOnlyArray<string>,
): ?[CaseInsensitiveMap<number>, CaseInsensitiveMap<number>] {
// ): ?[Map<string, number>, Map<string, number>] {
  // Get all daily notes that are within this time period
  const calendarNotesInPeriod = DataStore.calendarNotes.filter(
    (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
  if (calendarNotesInPeriod.length === 0) {
    logWarn('calcHashtagStatsPeriod', `no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
    return
  }

  // Define maps to count term matches, and where there is a final /number part, the total too
  const termCounts = new CaseInsensitiveMap < number > () // key: tagname; value: count
  // const termCounts = new Map<string, number>() // key: tagname; value: count
  const termSumTotals = new CaseInsensitiveMap < number > () // key: tagname (except last part); value: total
  // const termSumTotals = new Map < string, number> () // key: tagname (except last part); value: total

  // Initialise the maps for terms that we're deliberately including
  for (let i = 0; i < includedTerms.length; i++) {
    const termKey = includedTerms[i]
    termCounts.set(termKey, 0)
    termSumTotals.set(termKey, NaN)
  }

  logDebug('calcHashtagStatsPeriod', "hCounts init:")
  for (const [key, value] of termCounts.entries()) {
    logDebug('calcHashtagStatsPeriod', `  ${key}: ${value}`)
  }

  // For each daily note review each included hashtag
  for (const n of calendarNotesInPeriod) {
    // The following is a workaround to an API 'feature' in note.hashtags where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the hashtag array, and then check
    const seenTags = n.hashtags.slice().reverse()
    let lastTag = ''
    for (const tag of seenTags) {
      if (caseInsensitiveStartsWith(tag, lastTag)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        logDebug('calcHashtagStatsPeriod', `\tFound ${tag} but ignoring as part of a longer hashtag of the same name`)
      }
      else {
        let k = tag
        let v = NaN
        // if this tag that finishes '/number', then break into its two parts, ready to sum the numbers as well
        // Note: testing includes decimal part of a number, but the API .hashtags drops them
        if (tag.match(/\/-?\d+(\.\d+)?$/)) {
          const tagParts = tag.split('/')
          k = tagParts[0] // tag
          v = Number(tagParts[1]) // number after tag
          logDebug('calcHashtagStatsPeriod', `  found tagParts ${k} / ${v.toString()}`)
        }
        // check this is on inclusion, or not on exclusion list, before adding
        if (isHashtagWanted(k, includedTerms, excludedTerms)) {
          // if this has a numeric value as well, save to both maps
          if (!isNaN(v)) {
            termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
            const prevTotal = !isNaN(termSumTotals.get(k)) ? termSumTotals.get(k) : 0
            // $FlowIgnore[unsafe-addition]
            termSumTotals.set(k, prevTotal + v)
            logDebug('calcHashtagStatsPeriod', `  ${k} add ${v} -> ${String(termSumTotals.get(k))} from ${String(termCounts.get(k))}`)
          } else {
            // else just save this to the counts map
            termCounts.set(tag, (termCounts.get(k) ?? 0) + 1)
            logDebug('calcHashtagStatsPeriod', `  ${k} increment -> ${String(termCounts.get(k))}`)
          }
        } else {
          logDebug('calcHashtagStatsPeriod', `  ${k} -> not wanted`)
        }
      }
      lastTag = tag
    }
  }

  // logDebug('calcHashtagStatsPeriod', "Hashtag Keys:")
  // for (let a of termCounts.keys()) {
  //   logDebug('calcHashtagStatsPeriod', a)
  // }
  // logDebug('calcHashtagStatsPeriod', "Values:")
  // termCounts.forEach(h => {
  //   logDebug('calcHashtagStatsPeriod', h)
  // })
  for (const [key, value] of termCounts) {
    logDebug(`${key}\t${value}`)
  }

  return [termCounts, termSumTotals]
}

/**
 * WARNING: THIS IS NOW DEPRECATED IN FAVOUR OF gatherOccurrences and generateProgressUpdate.
 *
 * Calculate mention statistics for daily notes of a given time period.
 * If an 'include' list is set, only include things from that list.
 * If not, include all, except those on an 'exclude' list (if set).
 * @author @jgclark
 *
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @param {$ReadOnlyArray<string>} includedTerms - array of hashtags to include (takes precedence over excluded terms)
 * @param {$ReadOnlyArray<string>} excludedTerms - array of hashtags to exclude
 * @return {Map, Map} maps of {tag, count}
 */
export function calcMentionStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
  includedTerms: $ReadOnlyArray<string>,
  excludedTerms: $ReadOnlyArray<string>,
  // ): ?[Map<string, number>, Map<string, number>] {
): ?[CaseInsensitiveMap<number>, CaseInsensitiveMap<number>] {
  // Get all daily notes that are within this time period
  const calendarNotesInPeriod = DataStore.calendarNotes.filter(
    (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))

  if (calendarNotesInPeriod.length === 0) {
    logWarn(pluginJson, 'no matching daily notes found between ${fromDateStr} and ${toDateStr}')
    return
  }

  // Define maps to count term matches, and where there is a final /number part, the total too
  // const termCounts = new Map < string, number> () // key: tagname; value: count
  const termCounts = new CaseInsensitiveMap < number > () // key: tagname; value: count
  // const termSumTotals = new Map < string, number> () // key: mention name (except last part); value: total
  const termSumTotals = new CaseInsensitiveMap < number > () // key: mention name (except last part); value: total

  // Initialise the maps for terms that we're deliberately including
  for (let i = 0; i < includedTerms.length; i++) {
    const k = includedTerms[i]
    termCounts.set(k, 0)
    termSumTotals.set(k, NaN) // start with NaN so we can tell if there has been nothing added
  }

  logDebug('calcMentionStatsPeriod', "mSumTotals init:")
  for (const [key, value] of termSumTotals.entries()) {
    logDebug('calcMentionStatsPeriod', `  ${key}: ${value}`)
  }

  for (const n of calendarNotesInPeriod) {
    // The following is a workaround to an API 'feature' in note.mentions where
    // @one/two/three gets reported as @one, @one/two, and @one/two/three.
    // Go backwards through the mention array, and then check
    // Note: The .mentions includes part in brackets afterwards
    const seenMentions = n.mentions.slice().reverse()
    let lastMention = ''

    for (const m of seenMentions) {
      if (caseInsensitiveStartsWith(m, lastMention)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        logDebug('calcHashtagStatsPeriod', `Found ${m} but ignoring as part of a longer mention of the same name`)
        continue
      }
      else {
        let k = m
        let v = NaN
        // if this is a mention that finishes (number), then break into separate parts first
        if (m.match(/\(-?\d+(\.\d+)?\)$/)) {
          const mentionParts = m.split('(')
          k = mentionParts[0]
          v = Number.parseFloat(mentionParts[1].slice(0, -1)) // chop off final ')' character
          logDebug('calcMentionStatsPeriod', `  found tagParts ${k} / ${v}`)
        }
        // check this is on inclusion, or not on exclusion list, before adding.
        if (isMentionWanted(k, includedTerms, excludedTerms)) {
          if (!isNaN(v)) {
            termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
            const prevTotal = !isNaN(termSumTotals.get(k)) ? termSumTotals.get(k) : 0
            // $FlowIgnore[unsafe-addition]
            termSumTotals.set(k, prevTotal + v)
            logDebug('calcMentionStatsPeriod', `  ${k} add ${v} -> ${String(termSumTotals.get(k))} from ${String(termCounts.get(k))}`)
          } else {
            // just save this to the main map
            termCounts.set(m, (termCounts.get(m) ?? 0) + 1)
            logDebug('calcMentionStatsPeriod', `  ${m} increment -> ${String(termCounts.get(m))}`)
          }
        } else {
          logDebug('calcMentionStatsPeriod', `  ${k} -> not wanted`)
        }
      }
      lastMention = m
    }
  }

  // logDebug('calcMentionStatsPeriod', "Mention Keys:")
  // for (let a of termSumTotals.keys()) {
  //   logDebug('calcMentionStatsPeriod', a)
  // }
  // logDebug('calcMentionStatsPeriod', "Values:")
  // termSumTotals.forEach(h => {
  //   logDebug('calcMentionStatsPeriod', h)
  // })
  for (const [key, value] of termCounts) {
    logDebug(`${key}\t${value}`)
  }

  return [termCounts, termSumTotals]
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
  const sum = realNumberValues.reduce((x, y) => x + y, 0)
  const avg = sum / realNumberValues.length
  // clo(values, 'values to sparkline')
  // logDebug('makeSparkline', `-> ${min} - ${max} / ${sum} from ${values.length}`)

  const value_mapper = (value: number, i: number) => {
    if (isNaN(value)) {
      return missingDataChar
    } else if (value === 0) {
      return ' '
    } else {
      let fraction = value / max
      fraction = Math.max(Math.min(1, fraction), 0); // clamp 0..1

      const index = Math.round(fraction * spark_line_chars.length) - 1
      return spark_line_chars[index > 0 ? index : 0]
    }
  }

  const chart = values.map(value_mapper).join('')
  let output = `${divider}${chart}${divider}`
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

  let values = data
  // clo(values, 'values to yesNoLine')

  const value_mapper = (value: number, i: number) => {
    return (value > 0) ? yesChar : noChar
  }

  const chart = values.map(value_mapper).join('')
  let output = `${divider}${chart}${divider}`
  return output
}
