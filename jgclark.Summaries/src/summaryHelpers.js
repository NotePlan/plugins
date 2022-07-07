// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 30.6.2022 for v0.10.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getDateStringFromCalendarFilename,
  withinDateRange,
} from '@helpers/dateTime'
import { log, logWarn, logError } from '@helpers/dev'
import {
  CaseInsensitiveMap,
  type headingLevelType,
} from '@helpers/general'
// import { gatherMatchingLines } from '@helpers/NPParagraph'
import {
  caseInsensitiveStartsWith,
  isHashtagWanted,
  isMentionWanted,
} from '@helpers/search'
// import { chooseOption, getInput } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Get settings

const configKey = 'summaries'

export type SummariesConfig = {
  folderToStore: string,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  hashtagCountsHeading: string,
  mentionCountsHeading: string,
  showAsHashtagOrMention: boolean,
  includeHashtags: Array<string>,
  excludeHashtags: Array<string>,
  includeMentions: Array<string>,
  excludeMentions: Array<string>,
  weeklyStatsDuration: ?number,
  progressDestination: string,
  progressHeading: string,
  progressHashtags: Array<string>,
  progressMentions: Array<string>,
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 *
 * @return {SummariesConfig} object with configuration
 */
export async function getSummariesSettings(): Promise<any> {
  // log(pluginJson, `Start of getSummariesSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: SummariesConfig = await DataStore.loadJSON('../jgclark.Summaries/settings.json')
    // clo(v2Config, `${configKey} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${configKey}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

/**
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
    logWarn(pluginJson, `no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
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

  // console.log("hCounts init:")
  // for (const [key, value] of termCounts.entries()) {
  //   console.log(`  ${key}: ${value}`)
  // }

  // For each daily note review each included hashtag
  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.hashtags where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the hashtag array, and then check
    const seenTags = n.hashtags.slice().reverse()
    let lastTag = ''
    for (const tag of seenTags) {
      if (caseInsensitiveStartsWith(tag, lastTag)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        // log('calcHashtagStatsPeriod', `\tFound ${tag} but ignoring as part of a longer hashtag of the same name`)
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
          // log(pluginJson, `  found tagParts ${k} / ${v.toString()}`)
        }
        // check this is on inclusion, or not on exclusion list, before adding
        if (isHashtagWanted(k, includedTerms, excludedTerms)) {
          // if this has a numeric value as well, save to both maps
          if (!isNaN(v)) {
            termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
            const prevTotal = !isNaN(termSumTotals.get(k)) ? termSumTotals.get(k) : 0
            // $FlowIgnore[unsafe-addition]
            termSumTotals.set(k, prevTotal + v)
            // log(pluginJson, `  ${k} add ${v} -> ${String(termSumTotals.get(k))} from ${String(termCounts.get(k))}`)
          } else {
            // else just save this to the counts map
            termCounts.set(tag, (termCounts.get(k) ?? 0) + 1)
            // log(pluginJson, `  ${k} increment -> ${String(termCounts.get(k))}`)
          }
        } else {
          // log(pluginJson, `  ${k} -> not wanted`)
        }
      }
      lastTag = tag
    }
  }

  // console.log("Hashtag Keys:")
  // for (let a of termCounts.keys()) {
  //   console.log(a)
  // }
  // console.log("Values:")
  // termCounts.forEach(h => {
  //   console.log(h)
  // })
  // for (const [key, value] of termCounts) {
  //   console.log(`${key}\t${value}`)
  // }

  return [termCounts, termSumTotals]
}

/**
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

  // console.log("mSumTotals init:")
  // for (const [key, value] of termSumTotals.entries()) {
  //   console.log(`  ${key}: ${value}`)
  // }

  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.mentions where
    // @one/two/three gets reported as @one, @one/two, and @one/two/three.
    // Go backwards through the mention array, and then check
    // Note: The .mentions includes part in brackets afterwards
    const seenMentions = n.mentions.slice().reverse()
    let lastMention = ''

    for (const m of seenMentions) {
      if (caseInsensitiveStartsWith(m, lastMention)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        log('calcHashtagStatsPeriod', `Found ${m} but ignoring as part of a longer mention of the same name`)
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
          // log(pluginJson, `  found tagParts ${k} / ${v}`)
        }
        // check this is on inclusion, or not on exclusion list, before adding.
        if (isMentionWanted(k, includedTerms, excludedTerms)) {
          if (!isNaN(v)) {
            termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
            const prevTotal = !isNaN(termSumTotals.get(k)) ? termSumTotals.get(k) : 0
            // $FlowIgnore[unsafe-addition]
            termSumTotals.set(k, prevTotal + v)
            // log(pluginJson, `  ${k} add ${v} -> ${String(termSumTotals.get(k))} from ${String(termCounts.get(k))}`)
          } else {
            // just save this to the main map
            termCounts.set(m, (termCounts.get(m) ?? 0) + 1)
            // log(pluginJson, `  ${m} increment -> ${String(termCounts.get(m))}`)
          }
        } else {
          // log(pluginJson, `  ${k} -> not wanted`)
        }
      }
      lastMention = m
    }
  }

  // console.log("Mention Keys:")
  // for (let a of termSumTotals.keys()) {
  //   console.log(a)
  // }
  // console.log("Values:")
  // termSumTotals.forEach(h => {
  //   console.log(h)
  // })
  // for (const [key, value] of termCounts) {
  //   console.log(`${key}\t${value}`)
  // }

  return [termCounts, termSumTotals]
}
