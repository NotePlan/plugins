// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 2.9.2022 for v0.13.0 by @jgclark
//-----------------------------------------------------------------------------
// TODO: Add proper graphs in HTML as png or svg or interactive chart.

import pluginJson from '../plugin.json'
import {
  getDateFromUnhyphenatedDateString,
  getDateStringFromCalendarFilename,
  unhyphenateString,
  withinDateRange,
} from '@helpers/dateTime'
import { calcOffsetDateStr } from '@helpers/NPdateTime'
import { clo, logDebug, logInfo, logWarn, logError } from '@helpers/dev'
import {
  CaseInsensitiveMap,
  type headingLevelType,
} from '@helpers/general'
// import { gatherMatchingLines } from '@helpers/NPParagraph'
import {
  caseInsensitiveMatch,
  caseInsensitiveStartsWith,
  isHashtagWanted,
  isMentionWanted,
} from '@helpers/search'

//------------------------------------------------------------------------------
// Get settings

const pluginID = 'jgclark.Summaries'

export type SummariesConfig = {
  foldersToExclude: Array<string>,
  showSparklines: boolean,
  folderToStore: string,
  statsHeading: string,
  headingLevel: headingLevelType,
  hashtagCountsHeading: string,
  mentionCountsHeading: string,
  showAsHashtagOrMention: boolean,
  includedHashtags: Array<string>,
  excludedHashtags: Array<string>,
  includedMentions: Array<string>,
  excludedMentions: Array<string>,
  weeklyStatsDuration: ?number,
  progressPeriod: string,
  progressDestination: string,
  progressHeading: string,
  progressHashtags: Array<string>,
  progressMentions: Array<string>,
  progressYesNo: Array<string>,
  progressYesNoChars: string,
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
 * Class to hold occurence summary of Hashtags and/or Mentions ('TM') for a given time period.
 * A progress term has a 'type': 'daily-average', 'item-average', 'total', 'yesno', 'count'
 * These tailor the display
 */
export class TMOccurrences {
  // the class instance properties
  term: string
  type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
  period: string
  numDays: number
  valuesMap: Map<string, number>
  total: number
  count: number

  /**
   * Create a new object, initialising the main valuesMap to the required number of values, as 'NaN', so that we can distinguish zero from no occurrences.
   * (Unless type 'yesno' )
   * @param {string} term 
   * @param {string} type
   * @param {string} fromDateStr of type YYYYMMDD
   * @param {string} toDateStr of type YYYYMMDD
   */
  constructor(term: string, type: string, fromDateStr: string, toDateStr: string) {
    this.term = term
    this.type = type
    if (toDateStr && fromDateStr) {
      // $FlowFixMe(incompatible-call)
      this.numDays = Calendar.unitsBetween(getDateFromUnhyphenatedDateString(toDateStr), getDateFromUnhyphenatedDateString(fromDateStr), 'day') + 1 // inclusive
      this.valuesMap = new Map < string, number > ()
      this.total = 0
      this.count = 0
      // Initialise all values to NaN, unless type 'yesno'
      for (let i = 1; i <= this.numDays; i++) {
        let thisDateStr = unhyphenateString(calcOffsetDateStr(fromDateStr, `${i}d`))
        // logDebug('TMOccurrences:constructor', `- date ${thisDateStr}`)
        this.valuesMap.set(thisDateStr, (this.type == 'yesno') ? 0 : NaN)
      }
      // logDebug('TMOccurrences:constructor', `Constructed ${term} for date ${fromDateStr}-${toDateStr} = ${this.valuesMap.size} days`)
    } else {
      logError('TMOccurrences:constructor', `Couldn't construct as passed date(s) were empty`)
    }
  }

  /**
   * Add a found hashtag/mention occurrence to its instance, updating stats accordingly
   * @param {string} occurrenceStr 
   * @param {string} dateStr format YYYYMMDD
   */
  addOccurrence(occurrenceStr: string, dateStr: string): void {
    // logDebug('TMOccurrences:addOccurrence', `starting for ${occurrenceStr} on date = ${dateStr}`)

    // isolate the value
    let key = occurrenceStr
    let value = NaN
    // if this tag that finishes '/number', then break into its two parts, ready to sum the numbers as well
    // Note: testing includes decimal part of a number, but the API .hashtags drops them
    if (occurrenceStr.match(/\/-?\d+(\.\d+)?$/)) {
      const tagParts = occurrenceStr.split('/')
      key = tagParts[0]
      value = Number(tagParts[1])
      // logDebug('TMOccurrences:addOccurrence', `- found tagParts ${key} / ${value.toString()}`)
    }
    // if this is a mention that finishes (number), then break into separate parts first
    else if (occurrenceStr.match(/\(-?\d+(\.\d+)?\)$/)) {
      const mentionParts = occurrenceStr.split('(')
      key = mentionParts[0]
      value = Number.parseFloat(mentionParts[1].slice(0, -1)) // chop off final ')' character
      // logDebug('TMOccurrences:addOccurrence', `- found tagParts ${key} / ${value.toString()}`)
    }

    // if this has a numeric value add to total, taking into account that the
    // day may have several values.
    // $FlowFixMe
    const prevValue: number = isNaN(this.valuesMap.get(dateStr)) ? 0 : this.valuesMap.get(dateStr)
    if (!isNaN(value)) {
      this.valuesMap.set(dateStr, prevValue + value)
      this.count++
      this.total += value
      // logDebug('TMOccurrences:addOccurrence', `- ${key} / ${value} -> ${this.total} from ${this.count} on ${dateStr}`)
    } else {
      // else just update the count
      this.valuesMap.set(dateStr, prevValue + 1)
      this.count++
      this.total++
      // logDebug('TMOccurrences:addOccurrence', `- ${key} increment -> ${this.total} from ${this.count} on ${dateStr}`)
    }
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
    // logDebug('TMOccurrences:getValues', `for ${this.term} = ${outArr.toString()}`)
    return outArr
  }

  /**
   * Log all the details in the main valuesMap
   */
  logValuesMap(): void {
    logDebug('TMOccurrences:logValuesMap', `- valuesMap for ${this.term}:`)
    this.valuesMap.forEach((v, k, m) => {
      logDebug('TMOccurrences:logValuesMap', `  - ${k}: ${v}`)
    })
  }

  /**
   * Get a 'sparkline' (an inline bar or line chart) for a particular term for the current period, in a specified style.
   * Currently the only style available is 'ascii'.
   */
  getSparkline(style: string = 'ascii'): string {
    let output = ''
    switch (style) {
      case 'ascii': {
        if (this.type !== 'yesno') {
          const options = { min: 0, divider: '|', missingDataChar: '·' }
          output = makeSparkline(this.getValues(), options)
        } else {
          const options = { divider: '|', yesNoChars: '✓·' }
          output = makeYesNoLine(this.getValues(), options)
        }
        break
      }
      default: {
        logError('TMOccurrences:getSparkline', `style '${style}' is not available`)
        break
      }
    }
    return output
  }

  /**
   * Get stats for a particular term, over the current period, in a specified style.
   * Currently the only style available is 'text'.
   * It also changes depending on the 'type' of the 'term'. By default it will give all stats, but 
   */
  getStats(style: string): string {
    let output = ''
    // logDebug('TMOccurrences:getStats', `starting for ${ this.term } type ${ this.type } style ${ style } `)

    const countStr = (!isNaN(this.count)) ? this.count.toLocaleString() : `none`
    const totalStr = (!isNaN(this.total) && this.total > 0) ? `total ${this.total.toLocaleString()}` : ''
    // This is the average per item, not the average per day. In general I feel this is more useful for numeric amounts
    const itemAvgStr = (!isNaN(this.total) && this.count > 0) ? `avg ${(this.total / this.count).toLocaleString([], { maximumSignificantDigits: 2 })}` : ''
    // TODO: Decide how/when to use daily average instead of an item average
    // const dailyAvgStr = (!isNaN(this.total)) ? `dailyAvg ${(this.total / this.numDays).toLocaleString([], { maximumSignificantDigits: 2 })}` : ''

    switch (style) {
      case 'text': {
        output = countStr // always start with count
        if (this.count === this.total && this.type !== 'yesno') break // if it's a simple count, treat as such, even if that wasn't it's given type
        switch (this.type) {
          case 'yesno': {
            output += " from " + this.numDays.toLocaleString()
            break
          }
          case 'all': {
            if (totalStr !== '') output += ", " + totalStr
            if (itemAvgStr !== '') output += ", " + itemAvgStr
            // if (dailyAvgStr !== '') output += ", " + dailyAvgStr
            break
          }
          case 'total': {
            output += ": " + totalStr
            break
          }
          case 'average': {
            if (itemAvgStr !== '') output += ": " + itemAvgStr
            // if (dailyAvgStr !== '') output += ", " + dailyAvgStr
            break
          }
          default: {
            // nothing to add
          }
        }
        break
      }
      default: {
        logError('TMOccurrences:getStats', `style '${style}' is not available`)
        output = '(unsupported style)'
        break
      }
    }
    return output
  }
}

/**
 * Gather all occurrences of requested hashtags and mentions for a given period.
 * Now also looks for requested 'progressYesNo' items too.
 * Returns a list of TMOccurrences instances:
    term: string
    type: string // 'daily-average', 'item-average', 'total', 'yesno', 'count'
    period: string
    numDays: number
    valuesMap: Map<string, number> // map of <YYYYMMDD, count>
    total: number
    count: number
 *
 * @author @jgclark
 * @param {string} periodString
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @param {Array<string>} includedHashtags
 * @param {Array<string>} excludedHashtags
 * @param {Array<string>} includedMentions
 * @param {Array<string>} excludedMentions
 * @param {Array<string>} progressYesNo
 * @returns {Array<TMOccurrences>}
 */
export function gatherOccurrences(periodString: string, fromDateStr: string, toDateStr: string, includedHashtags: Array<string>, excludedHashtags: Array<string>, includedMentions: Array<string>, excludedMentions: Array<string>, progressYesNo: Array<string> | string): Array<TMOccurrences> {
  try {

    logDebug('gatherOccurrences', `starting for ${periodString} (${fromDateStr}-${toDateStr})`)
    const periodDailyNotes = DataStore.calendarNotes.filter(
      (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
    if (periodDailyNotes.length === 0) {
      logWarn('gatherOccurrences', `no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
      return [] // for completeness
    }

    // Note: in the following is a workaround to an API 'feature' in note.hashtags
    // where #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // To take account of this the tag/mention loops below go backwards to use the longest first

    let tmOccurrencesArr: Array<TMOccurrences> = [] // to hold what we find

    //------------------------------
    // Review each wanted YesNo type
    const YesNoListArr = (typeof progressYesNo === 'string') ? progressYesNo.split(',') : progressYesNo
    for (let wantedItem of YesNoListArr) {
      // initialise a new TMOccurence for this YesNo item
      const thisOcc = new TMOccurrences(wantedItem, 'yesno', fromDateStr, toDateStr)

      // For each daily note in the period
      for (const n of periodDailyNotes) {
        const thisDateStr = getDateStringFromCalendarFilename(n.filename)
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          const reMatches = tag.match(/(.*)\/-?\d+(\.\d+)?$/) ?? []
          const tagWithoutClosingNumber = (reMatches.length >= 1) ? reMatches[1] : tag
          // logDebug(pluginJson, `orig: ${tag} this:${tagWithoutClosingNumber} last:${lastTag} `)
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tagWithoutClosingNumber, lastTag)) {
            // logDebug('calcHashtagStatsPeriod', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
          }
          else {
            // check this is one of the ones we're after, then add
            if (caseInsensitiveMatch(tagWithoutClosingNumber, wantedItem)) {
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

    //------------------------------
    // Review each wanted hashtag
    // TODO: Add exclusion mechanism back in if needed. (I looked at it, and to do so breaks various things including result ordering that derives from the 'wanted' setting.)
    for (let wantedTag of includedHashtags) {
      // initialise a new TMOccurence for this mention
      const thisOcc = new TMOccurrences(wantedTag, 'all', fromDateStr, toDateStr)

      // For each daily note in the period, look at each tag in reverse order to make subset checking work
      for (const n of periodDailyNotes) {
        const thisDateStr = getDateStringFromCalendarFilename(n.filename)
        const seenTags = n.hashtags.slice().reverse()
        let lastTag = ''
        for (const tag of seenTags) {
          const reMatches = tag.match(/\/-?\d+(\.\d+)?$/) ?? []
          const tagWithoutClosingNumber = (reMatches.length >= 1) ? reMatches[1] : tag
          // logDebug(pluginJson, `orig: ${tag} this:${tagWithoutClosingNumber} last:${lastTag} `)
          // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
          if (caseInsensitiveStartsWith(tagWithoutClosingNumber, lastTag)) {
            // logDebug('calcHashtagStatsPeriod', `- Found ${tag} but ignoring as part of a longer hashtag of the same name`)
          }
          else {
            // check this is one of the ones we're after, then add
            if (caseInsensitiveMatch(tagWithoutClosingNumber, wantedTag)) {
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

    //------------------------------
    // Now repeat for @mentions
    // TODO: Add exclusions -- as section above.
    for (let wantedMention of includedMentions) {
      // initialise a new TMOccurence for this mention
      const thisOcc = new TMOccurrences(wantedMention, 'all', fromDateStr, toDateStr)

      // For each daily note in the period, look at each mention in reverse order to make subset checking work
      for (const n of periodDailyNotes) {
        const thisDateStr = getDateStringFromCalendarFilename(n.filename)
        const seenMentions = n.mentions.slice().reverse()
        let lastMention = ''
        for (const mention of seenMentions) {
          const mentionWithoutNumberPart = (mention.split('(', 1))[0]
          // logDebug('gatherOccurrences', `- reviewing ${mention} [${mentionWithoutNumberPart}] looking for ${wantedMention} on ${thisDateStr}`)
          // if this tag is starting subset of the last one, assume this is an example of the issue, so skip this tag
          if (caseInsensitiveStartsWith(mentionWithoutNumberPart, lastMention)) {
            // logDebug('gatherOccurrences', `- Found ${mention} but ignoring as part of a longer mention of the same name`)
            continue
          }
          else {
            // check this is on inclusion, or not on exclusion list, before adding
            if (caseInsensitiveMatch(mentionWithoutNumberPart, wantedMention)) {
              // logDebug('gatherOccurrences', `- Found matching occurrence ${mention} on date ${n.filename}`)
              thisOcc.addOccurrence(mention, thisDateStr)
            } else {
              // logDebug('gatherOccurrences', `- x ${mention} not wanted`)
            }
          }
          lastMention = mention
        }
      }
      tmOccurrencesArr.push(thisOcc)
    }

    logDebug('gatherOccurrences', `Finished with ${tmOccurrencesArr.length} occObjects`)
    return tmOccurrencesArr
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
    return [] // for completness
  }
}

/**
 * Generate output lines for each term, according to the specified style, starting with a heading.
 * Currently the only style available is 'markdown'.
 * @param {Array<TMOccurrences>} occObjs 
 * @param {string} periodString 
 * @param {string} fromDateStr 
 * @param {string} toDateStr 
 * @param {string} style 
 * @param {boolean} showSparklines 
 * @returns Array<string>
 */
export function generateProgressUpdate(occObjs: Array<TMOccurrences>, periodString: string, fromDateStr: string, toDateStr: string, style: string, showSparklines: boolean): Array<string> {
  try {
    logDebug('generateProgressUpdate', `starting for ${periodString} (${fromDateStr}-${toDateStr}) with ${occObjs.length} occObjs`)

    // Get length of longest progress term (to use with sparklines)
    const maxTermLen = Math.max(...occObjs.map((m) => m.term.length))

    let outputArray: Array<string> = []
    for (let occObj of occObjs) {
      // occObj.logValuesMap()
      let thisOutput = ''
      switch (style) {
        case 'markdown': {
          if (showSparklines) {
            thisOutput = "`" + occObj.getTerm(maxTermLen) + " " + occObj.getSparkline('ascii') + "`"
          } else {
            thisOutput = "**" + occObj.getTerm() + "**: "
          }
          thisOutput += " " + occObj.getStats('text')
          break
        }
        default: {
          logError('generateProgressUpdate', `style '${style}' is not available`)
          break
        }
      }
      outputArray.push(thisOutput)
    }
    return outputArray
  }
  catch (error) {
    logError('gatherOccurrences', error.message)
    return [] // for completeness
  }
}

/**
 * NOTE: THIS IS NOW DEPRECATED IN FAVOUR OF gatherOccurrences and generateProgressUpdate.
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
  const periodDailyNotes = DataStore.calendarNotes.filter(
    (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
  if (periodDailyNotes.length === 0) {
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
  for (const n of periodDailyNotes) {
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
 * NOTE: THIS IS NOW DEPRECATED IN FAVOUR OF gatherOccurrences and generateProgressUpdate.
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
  const periodDailyNotes = DataStore.calendarNotes.filter(
    (p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))

  if (periodDailyNotes.length === 0) {
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

  for (const n of periodDailyNotes) {
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
function makeSparkline(data: Array<number>, options: Object = {}): string {
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

  const value_mapper = (value, i) => {
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
function makeYesNoLine(data: Array<number>, options: Object = {}): string {
  const yesChar = options.yesNoChars[0]
  const noChar = options.yesNoChars[1]
  const divider = options.divider ?? '|'

  let values = data
  clo(values, 'values to yesNoLine')

  const value_mapper = (value, i) => {
    return (value > 0) ? yesChar : noChar
  }

  const chart = values.map(value_mapper).join('')
  let output = `${divider}${chart}${divider}`
  return output
}
