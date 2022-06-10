// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 9.6.2022 for v0.8.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getDateStringFromCalendarFilename,
  getWeek,
  monthNameAbbrev,
  todaysDateISOString,
  toISODateString,
  toLocaleDateString,
  toLocaleDateTimeString,
  weekStartEnd,
  withinDateRange,
} from '@helpers/dateTime'
import { clo, log, logWarn, logError } from '@helpers/dev'
import { calcOffsetDate, quarterStartEnd } from '@helpers/NPdateTime'
import { castBooleanFromMixed, castHeadingLevelFromMixed, castNumberFromMixed, castStringArrayFromMixed, castStringFromMixed, trimAnyQuotes } from '@helpers/dataManipulation'
import { displayTitle } from '@helpers/general'
import {
  gatherMatchingLines,
} from '@helpers/NPparagraph'
import {
  termInURL,
} from '@helpers/paragraph'
import { chooseOption, getInput } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Get settings

const configKey = 'summaries'

export type headingLevelType = 1 | 2 | 3 | 4 | 5
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
  defaultOccurrences: Array<string>,
  occurrencesHeading: string,
  resultPrefix: string,
  highlightOccurrences: boolean,
  showEmptyOccurrences: boolean,
  dateStyle: string,
  weeklyStatsDuration: ?number,
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

export async function getPeriodStartEndDates(question: string = 'Create stats for which period?', periodToUse?: string): Promise<[Date, Date, string, string]> {
  let period: string
  // If we're passed the period, then use that, otherwise ask user
  if (periodToUse) {
    // It may come with surrounding quotes, so remove those
    period = trimAnyQuotes(periodToUse)
  } else {
    // Ask user what date interval to do tag counts for
    period = await chooseOption(
      question,
      [
        {
          label: 'Last Week',
          value: 'lw',
        },
        {
          label: 'This week so far',
          value: 'wtd',
        },
        {
          label: 'Other Week',
          value: 'ow',
        },
        {
          label: 'Last Month',
          value: 'lm',
        },
        {
          label: 'This Month (to date)',
          value: 'mtd',
        },
        {
          label: 'Other Month',
          value: 'om',
        },
        {
          label: 'Last Quarter',
          value: 'lq',
        },
        {
          label: 'This Quarter (to date)',
          value: 'qtd',
        },
        {
          label: 'Other Quarter',
          value: 'oq',
        },
        {
          label: 'Last Year',
          value: 'ly',
        },
        {
          label: 'Year to date',
          value: 'ytd',
        },
        {
          label: 'Other Year',
          value: 'oy',
        },
      ],
      'mtd',
    )
  }
  let fromDate: Date = new Date()
  let toDate: Date = new Date()
  let periodString = ''
  let periodPartStr = ''

  const todaysDate = new Date()
  // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??
  const y = todaysDate.getFullYear()
  const m = todaysDate.getMonth() + 1 // counting from 1
  const d = todaysDate.getDate()

  // We appear to need to take timezone offset into account in order to avoid landing
  // up crossing date boundaries.
  // I.e. when in BST (=UTC+0100) it's calculating dates which are often 1 too early.
  // Get TZOffset in minutes. If positive then behind UTC; if negative then ahead.
  // TODO: see whether moment library can make this easier
  const TZOffset = new Date().getTimezoneOffset()
  // log(pluginJson, `getPeriodStartEndDates: period = ${period}, TZOffset = ${TZOffset}.`)

  switch (period) {
    case 'lm': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, 1, 0, 0, 0), 'minute', -TZOffset) // go to start of this month
      fromDate = Calendar.addUnitToDate(fromDate, 'month', -1) // -1 month
      toDate = Calendar.addUnitToDate(fromDate, 'month', 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(fromDate.getMonth() + 1)} ${y}`
      break
    }
    case 'mtd': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, 1, 0, 0, 0), 'minute', -TZOffset) // start of this month
      toDate = Calendar.dateFrom(y, m, d, 0, 0, 0)
      periodString = `${monthNameAbbrev(m)} ${y}`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'om': {
      const theY = Number(await getInput(`Choose year, e.g. ${y}`, 'OK'))
      const theM = Number(await getInput('Choose month, (1-12)', 'OK'))
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(theY, theM, 1, 0, 0, 0), 'minute', -TZOffset) // start of this month
      toDate = Calendar.addUnitToDate(fromDate, 'month', 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(theM)} ${theY}`
      break
    }

    case 'lq': {
      const thisQ = Math.floor((m - 1) / 3) + 1 // quarter 1-4
      const lastQ = thisQ > 0 ? thisQ - 1 : 4 // last quarter
      const lastY = lastQ === 4 ? y - 1 : y // change the year if we want Q4
      const [f, t] = quarterStartEnd(lastQ, lastY)
      fromDate = f
      toDate = t
      const lastQStartMonth = (lastQ - 1) * 3 + 1
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${lastY} Q${lastQ} (${monthNameAbbrev(lastQStartMonth)}-${monthNameAbbrev(lastQStartMonth + 2)})`
      break
    }
    case 'qtd': {
      const thisQ = Math.floor((m - 1) / 3) + 1
      const thisQStartMonth = (thisQ - 1) * 3 + 1
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, thisQStartMonth, 1, 0, 0, 0), 'minute', -TZOffset) // start of this quarter
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, d, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${y} Q${thisQ} (${monthNameAbbrev(thisQStartMonth)}-${monthNameAbbrev(thisQStartMonth + 2)})`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'oq': {
      const theY = Number(await getInput(`Choose year, e.g. ${y}`, 'OK'))
      const theQ = Number(await getInput('Choose quarter, (1-4)', 'OK'))
      const theQStartMonth = (theQ - 1) * 3 + 1
      const [f, t] = quarterStartEnd(theQ, theY)
      fromDate = f
      toDate = t
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${theY} Q${theQ} (${monthNameAbbrev(theQStartMonth)}-${monthNameAbbrev(theQStartMonth + 2)})`
      break
    }

    case 'lw': {
      // last week
      let theY = y
      const currentWeekNum = getWeek(todaysDate)
      // First deal with edge case: after start of ordinal year but before first week starts
      if (currentWeekNum === 52 && m == 1) {
        theY -= 1
      }
      let lastWeekNum = 0
      if (currentWeekNum === 1) {
        lastWeekNum = 52
        theY--
      } else {
        lastWeekNum = currentWeekNum - 1
      }
      ;[fromDate, toDate] = weekStartEnd(lastWeekNum, theY)
      periodString = `W${lastWeekNum} ${theY}`
      break
    }
    case 'wtd': {
      // week to date
      let theY = y
      const currentWeekNum = getWeek(todaysDate)
      // First deal with edge case: after start of ordinal year but before first week starts
      if (currentWeekNum === 52 && m == 1) {
        theY -= 1
      }
      // I don't know why the [from, to] construct doesn't work here, but using tempObj instead
      const tempObj = weekStartEnd(currentWeekNum, theY)
      fromDate = tempObj[0]
      toDate = tempObj[1]
      periodString = `W${currentWeekNum} ${theY}`
      break
    }
    case 'ow': {
      // other week
      const theYear = Number(await getInput(`Choose year, e.g. ${y}`, 'OK'))
      const weekNum = Number(await getInput('Choose week number, 1-53', 'OK'))
      // I don't know why the [from, to] form doesn't work here, but using tempObj instead
      const tempObj = weekStartEnd(weekNum, theYear)
      fromDate = tempObj[0]
      toDate = tempObj[1]
      periodString = `W${weekNum} ${theYear}`
      break
    }

    case 'ly': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y - 1, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of last year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y - 1, 12, 31, 0, 0, 0), 'minute', -TZOffset) // end of last year
      periodString = `${y - 1}`
      break
    }
    case 'ytd': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of this year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, d, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${y}`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'oy': {
      const theYear = Number(await getInput(`Choose year, e.g. ${y}`, 'OK'))
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of this year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 12, 31, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${theYear}`
      break
    }
    default: {
      periodString = `<Error: couldn't parse interval type '${period}'>`
    }
  }
  log(pluginJson, `-> ${fromDate.toString()}, ${toDate.toString()}, ${periodString}, ${periodPartStr}`)
  return [fromDate, toDate, periodString, periodPartStr]
}

/**
 * Calculate hashtag statistics for daily notes of a given time period
 * - Map of { tag, count } for all tags included or not excluded
 * - Map of { tag, total } for the subset of all tags above that finish with a /number
 * @author @jgclark
 *
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @param {[string]} includedTerms - array of hashtags to include (takes precedence over excluded terms)
 * @param {[string]} excludedTerms - array of hashtags to exclude
 * @return {[Map, Map]}
 */
export async function calcHashtagStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
  includedTerms: $ReadOnlyArray<string>,
  excludedTerms: $ReadOnlyArray<string>,
): Promise<?[Map<string, number>, Map<string, number>]> {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))
  if (periodDailyNotes.length === 0) {
    logWarn(pluginJson, `no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
    return
  }

  // work out what set of mentions to look for (or ignore)
  const hashtagsToLookFor = includedTerms.length > 0 ? includedTerms : []
  const hashtagsToIgnore = excludedTerms.length > 0 ? excludedTerms : []

  // For each matching date, find and store the tags in Map
  const termCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const termSumTotals = new Map<string, number>() // key: tagname (except last part); value: total

  // Initialise the maps for terms that we're deliberately including
  for (let i = 0; i < includedTerms.length; i++) {
    const k = includedTerms[i]
    termCounts.set(k, 0)
    // termSumTotals.set(k, 0) // TODO: Work out what to do about these
  }

  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.hashtags where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the hashtag array, and then check
    const seenTags = n.hashtags.slice().reverse()
    let lastTag = ''

    for (const t of seenTags) {
      if (lastTag.startsWith(t)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        continue
      }
      // check this is on inclusion, or not on exclusion list, before adding
      if (hashtagsToLookFor.length > 0 && hashtagsToLookFor.filter((a) => t.startsWith(a)).length === 0) {
        // log(pluginJson, `\tIgnoring '${t}' as not on inclusion list`)
      } else if (hashtagsToIgnore.filter((a) => t.startsWith(a)).length > 0) {
        // log(pluginJson, `\tIgnoring '${t}' as on exclusion list`)
      } else {
        // if this is tag that finishes '/number', then sum the numbers as well
        if (t.match(/\/-?\d+(\.\d+)?$/)) {
          const tagParts = t.split('/')
          const k = tagParts[0] // tag
          const v = Number(tagParts[1]) // number after tag
          // log(pluginJson, `found tagParts ${k} / ${v}`)
          termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
          termSumTotals.set(k, (termSumTotals.get(k) ?? 0) + v)
          // $FlowIgnore[incompatible-type]
          // log(pluginJson, `  ${k} -> ${termSumTotals.get(k)} from ${termCounts.get(k)}`)
        } else {
          // just save this to the main map
          termCounts.set(t, (termCounts.get(t) ?? 0) + 1)
          // $FlowIgnore[incompatible-type]
          // log(pluginJson, `  ${t} -> ${termCounts.get(t)}`)
        }
      }
      lastTag = t
    }
  }

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
export async function calcMentionStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
  includedTerms: $ReadOnlyArray<string>,
  excludedTerms: $ReadOnlyArray<string>,
): Promise<?[Map<string, number>, Map<string, number>]> {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) => withinDateRange(getDateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr))

  if (periodDailyNotes.length === 0) {
    logWarn(pluginJson, 'no matching daily notes found')
    return
  }

  // work out what set of mentions to look for (or ignore)
  const mentionsToLookFor = includedTerms.length > 0 ? includedTerms : []
  const mentionsToIgnore = excludedTerms.length > 0 ? excludedTerms : []

  // For each matching date, find and store the mentions in Map TODO: consider using Objects not Maps
  const termCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const termSumTotals = new Map<string, number>() // key: mention name (except last part); value: total

  // Initialise the maps for terms that we're deliberately including
  // TODO(me): In time will want more flexibility here
  for (let i = 0; i < includedTerms.length; i++) {
    const k = includedTerms[i]
    termCounts.set(k, 0)
    termSumTotals.set(k, 0)
  }

  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.mentions where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the mention array, and then check
    const seenMentions = n.mentions.slice().reverse()
    let lastMention = ''

    for (const m of seenMentions) {
      if (lastMention.startsWith(m)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        continue
      }
      // check this is on inclusion, or not on exclusion list, before adding
      if (mentionsToLookFor.length > 0 && mentionsToLookFor.filter((a) => m.startsWith(a)).length === 0) {
        // log(pluginJson, `\tIgnoring '${m}' as not on inclusion list`)
      } else if (mentionsToIgnore.filter((a) => m.startsWith(a)).length > 0) {
        // log(pluginJson, `\tIgnoring '${m} as on exclusion list`)
      } else {
        // if this is menion that finishes (number), then
        if (m.match(/\(-?\d+(\.\d+)?\)$/)) {
          const mentionParts = m.split('(')
          const k = mentionParts[0]
          const v = Number(mentionParts[1].slice(0, -1)) // chop off final ')' character
          termCounts.set(k, (termCounts.get(k) ?? 0) + 1)
          termSumTotals.set(k, (termSumTotals.get(k) ?? 0) + v)
          // $FlowIgnore[incompatible-type]
          // log(pluginJson, `found mentionParts ${k} / ${v} in ${displayTitle(n)} -> ${String(termSumTotals.get(k))} from ${String(termCounts.get(k))}`)
        } else {
          // just save this to the main map
          termCounts.set(m, (termCounts.get(m) ?? 0) + 1)
          // $FlowIgnore[incompatible-type]
          // log(pluginJson, `  -> ${m} = ${String(termCounts.get(m))}`)
        }
      }
      lastMention = m
    }
  }

  return [termCounts, termSumTotals]
}
