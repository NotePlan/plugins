// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 14.1.2022 for v0.4.0
//-----------------------------------------------------------------------------

import {
  dateStringFromCalendarFilename,
  getWeek,
  hyphenatedDate,
  monthNameAbbrev,
  todaysDateISOString,
  toISODateString,
  toLocaleDateString,
  toLocaleDateTimeString,
  weekStartEnd,
  withinDateRange,
} from '../../helpers/dateTime'
import {
  calcOffsetDate,
  quarterStartEnd,
} from '../../helpers/NPdateTime'
import { trimAnyQuotes } from '../../helpers/dataManipulation'
import { displayTitle } from '../../helpers/general'
import {
  chooseOption,
  getInput
} from '../../helpers/userInput'
import {
  castStringArrayFromMixed,
  castStringFromMixed
} from '../../m1well.Expenses/src/expensesHelper'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

export const DEFAULT_SUMMARIES_CONFIG = `  summaries: {
    folderToStore: 'Summaries', // folder to store any output files in
    foldersToIgnore: ['📋 Templates', 'Summaries'], // list of folders to exlude in these commands. Note that @Trash and @Archive are always excluded
    headingLevel: 2, // use level 1-5 headings when writing output to notes
    // settings for '/countsInPeriod':
    hashtagCountsHeading: '#hashtag counts',
    mentionCountsHeading: '@mention counts',
    showAsHashtagOrMention: true, // or false to hide # and @ characters
    // In the following the includes (if specified) takes precedence over excludes ...
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@words']
    excludeMentions: ['@done', '@repeat'],
    // settings for '/occurrencesInPeriod':
    occurrencesHeading: 'Occurrences',
    defaultOccurrences: ['idea', '@review', '#question'],
    highlightOccurrences: false, // use ==highlight== of matched occurrences in output
    showEmptyOccurrences: false, // if no occurrences found of this string to match, make this clear
    dateStyle: 'link', // where the context for an occurrence is a date, does it get appended as a 'date' using your locale, or as a NP date 'link' ('>date') or 'at' ('@date') or 'none'
    // setting for '/weeklyStats':
    weeklyStatsDuration: 14, // number of weeks to look back
  },
`
export type headingLevelType = 1 | 2 | 3 | 4 | 5
export type SummariesConfig = {
  folderToStore: string,
  foldersToIgnore: string[],
  headingLevel: headingLevelType,
  hashtagCountsHeading: string,
  mentionCountsHeading: string,
  showAsHashtagOrMention: boolean,
  includeHashtags: string[],
  excludeHashtags: string[],
  includeMentions: string[],
  excludeMentions: string[],
  occurrencesHeading: string,
  defaultOccurrences: string[],
  highlightOccurrences: boolean,
  showEmptyOccurrences: boolean,
  dateStyle: string,
  weeklyStatsDuration: ?number,
}

/**
 * Cast boolean from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {boolean} cast value
 */
const castBooleanFromMixed = (val: { [string]: ?mixed }, key: string): boolean => {
  return val.hasOwnProperty(key) ? ((val[key]: any): boolean) : false
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */
const castNumberFromMixed = (val: { [string]: ?mixed }, key: string): number => {
  return val.hasOwnProperty(key) ? ((val[key]: any): number) : NaN
}

/**
 * Cast number from the config mixed. Based on @m1well's config system.
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {number} cast value
 */
const castHeadingLevelFromMixed = (val: { [string]: ?mixed }, key: string): headingLevelType => {
  return val.hasOwnProperty(key) ? ((val[key]: any): headingLevelType) : 2
}

// const CONFIG_KEYS = {
//   folderToStore: 'folderToStore',
//   foldersToIgnore: 'foldersToIgnore',
//   headingLevel: 'headingLevel',
//   hashtagCountsHeading: 'hashtagCountsHeading',
//   mentionCountsHeading: 'mentionCountsHeading',
//   showAsHashtagOrMention: 'showAsHashtagOrMention',
//   includeHashtags: 'includeHashtags',
//   excludeHashtags: 'excludeHashtags',
//   includeMentions: 'includeMentions',
//   excludeMentions: 'excludeMentions',
//   occurrencesHeading: 'occurrencesHeading',
//   defaultOccurrences: 'defaultOccurrences',
//   highlightOccurrences: 'highlightOccurrences',
//   showEmptyOccurrences: 'showEmptyOccurrences',
//   dateStyle: 'dateStyle',
//   weeklyStatsDuration: 'weeklyStatsDuration',
// }

// const config: SummariesConfig = {
//   folderToStore: castStringFromMixed(result, CONFIG_KEYS.folderToStore),
//   headingLevel: castNumberFromMixed(result, CONFIG_KEYS.headingLevel),
//   hashtagCountsHeading: castStringFromMixed(result, CONFIG_KEYS.hashtagCountsHeading),
//   mentionCountsHeading: castStringFromMixed(result, CONFIG_KEYS.mentionCountsHeading),
//   showAsHashtagOrMention: castBooleanFromMixed(result, CONFIG_KEYS.showAsHashtagOrMention),
//   includeHashtags: castStringArrayFromMixed(result, CONFIG_KEYS.includeHashtags),
//   excludeHashtags: castStringArrayFromMixed(result, CONFIG_KEYS.excludeHashtags),
//   includeMentions: castStringArrayFromMixed(result, CONFIG_KEYS.includeMentions),
//   excludeMentions: castStringArrayFromMixed(result, CONFIG_KEYS.excludeMentions),
// }

/**
 * Provide config from _configuration and cast content to real objects. (Borrowing approach from @m1well)
 *
 * @private
 * @return {SummariesConfig} object with configuration
 */
export const getConfigSettings = (): Promise<SummariesConfig> => {
  return getOrMakeConfigurationSection(
    'summaries',
    DEFAULT_SUMMARIES_CONFIG
  )
  .then(result => {
    if (result == null || Object.keys(result).length === 0) {
      console.log(`error: expected config could not be found in the _configuration file`)
      return {
        folderToStore: 'Summaries',
        foldersToIgnore: ['📋 Templates', 'Summaries'],
        headingLevel: 2,
        hashtagCountsHeading: '#hashtag counts',
        mentionCountsHeading: '@mention counts',
        showAsHashtagOrMention: false,
        includeHashtags: [],
        excludeHashtags: [],
        includeMentions: [],
        excludeMentions: ['@done', '@repeat'],
        occurrencesHeading: 'Occurrences',
        defaultOccurrences: ['idea', '@review', '#question'],
        highlightOccurrences: false,
        showEmptyOccurrences: false,
        dateStyle: 'link',
        weeklyStatsDuration: undefined,
      }
    } else {
      const config: SummariesConfig = {
        folderToStore: castStringFromMixed(result, 'folderToStore'),
        foldersToIgnore: castStringArrayFromMixed(result, 'foldersToIgnore'),
        headingLevel: castHeadingLevelFromMixed(result, 'headingLevel'),
        hashtagCountsHeading: castStringFromMixed(result, 'hashtagCountsHeading'),
        mentionCountsHeading: castStringFromMixed(result, 'mentionCountsHeading'),
        showAsHashtagOrMention: castBooleanFromMixed(result, 'showAsHashtagOrMention'),
        includeHashtags: castStringArrayFromMixed(result, 'includeHashtags'),
        excludeHashtags: castStringArrayFromMixed(result, 'excludeHashtags'),
        includeMentions: castStringArrayFromMixed(result, 'includeMentions'),
        excludeMentions: castStringArrayFromMixed(result, 'excludeMentions'),
        occurrencesHeading: castStringFromMixed(result, 'occurrencesHeading'),
        defaultOccurrences: castStringArrayFromMixed(result, 'defaultOccurrences'),
        highlightOccurrences: castBooleanFromMixed(result, 'highlightOccurrences'),
        showEmptyOccurrences: castBooleanFromMixed(result, 'showEmptyOccurrences'),
        dateStyle: castStringFromMixed(result, 'dateStyle'),
        weeklyStatsDuration: castNumberFromMixed(result, 'weeklyStatsDuration'),
      }
      // console.log(`loaded config OK`)
      // console.log(`config = ${JSON.stringify(result)}\n`)
      return config
    }
  })
}

export async function getPeriodStartEndDates(
  question: string = 'Create stats for which period?',
  periodToUse?: string,
): Promise<[Date, Date, string, string]> {
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
  const m = todaysDate.getMonth() + 1
  const d = todaysDate.getDate()

  // We appear to need to take timezone offset into account in order to avoid landing
  // up crossing date boundaries.
  // I.e. when in BST (=UTC+0100) it's calculating dates which are often 1 too early.
  // Get TZOffset in minutes. If positive then behind UTC; if negative then ahead.
  const TZOffset = new Date().getTimezoneOffset()
  // console.log(`\tgetPeriodStartEndDates: period = ${period}, TZOffset = ${TZOffset}.`)

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
      const theY = Number(await getInput('Choose year, e.g. 2021', 'OK'))
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
      periodString = `${lastY} Q${lastQ} (${monthNameAbbrev(
        lastQStartMonth,
      )}-${monthNameAbbrev(lastQStartMonth + 2)})`
      break
    }
    case 'qtd': {
      const thisQ = Math.floor((m - 1) / 3) + 1
      const thisQStartMonth = (thisQ - 1) * 3 + 1
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, thisQStartMonth, 1, 0, 0, 0), 'minute', -TZOffset) // start of this quarter
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, d, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${y} Q${thisQ} (${monthNameAbbrev(
        thisQStartMonth,
      )}-${monthNameAbbrev(thisQStartMonth + 2)})`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'oq': {
      const theY = Number(await getInput('Choose year, e.g. 2021', 'OK'))
      const theQ = Number(await getInput('Choose quarter, (1-4)', 'OK'))
      const theQStartMonth = (theQ - 1) * 3 + 1
      const [f, t] = quarterStartEnd(theQ, theY)
      fromDate = f
      toDate = t
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${theY} Q${theQ} (${monthNameAbbrev(
        theQStartMonth,
      )}-${monthNameAbbrev(theQStartMonth + 2)})`
      break
    }
    
    case 'lw': { // last week
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
      [ fromDate, toDate ] = weekStartEnd(lastWeekNum, theY)
      periodString = `W${lastWeekNum} ${theY}`
      break
    }
    case 'wtd': { // week to date
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
    case 'ow': { // other week
      const theYear = Number(await getInput('Choose year, e.g. 2021', 'OK'))
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
      const theYear = Number(await getInput('Choose year, e.g. 2021', 'OK'))
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of this year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 12, 31, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${theYear}`
      break
    }
    default: {
      periodString = `<Error: couldn't parse interval type '${period}'>`
    }
  }
  // console.log(`-> ${fromDate.toString()}, ${toDate.toString()}, ${periodString}, ${periodPartStr}`)
  return [fromDate, toDate, periodString, periodPartStr]
}

//------------------------------------------------------------------------------
// Remove all paragraphs in a section, given:
// - Note to use
// - Section heading line to look for (needs to match from start of line but not necessarily the end)
// A section is defined (here at least) as all the lines between the heading,
// and the next heading of that same or higher level, or the end of the file 
// if that's sooner.
//
// Returns the lineIndex of the found heading, or if not found the last line of the note
export function removeSection(note: TNote, heading: string): number {
  const ps = note.paragraphs
  let existingHeadingIndex = ps.length // start at end of file
  let sectionHeadingLevel = 2
  console.log(
    `\tremoveSection: '${heading}' from note '${note.title ?? ''}' with ${ps.length} paras:`,
  )

  for (const p of ps) {
    if (p.type === 'title' && p.content.startsWith(heading)) {
      existingHeadingIndex = p.lineIndex
      sectionHeadingLevel = p.headingLevel
    }
  }
  // console.log(`\t    heading level ${sectionHeadingLevel} at line ${existingHeadingIndex}`)

  if (existingHeadingIndex !== undefined && existingHeadingIndex < ps.length) {
    // Work out the set of paragraphs to remove
    const psToRemove = []
    note.removeParagraph(ps[existingHeadingIndex])
    for (let i = existingHeadingIndex + 1; i < ps.length; i++) {
      // stop removing when we reach heading of same or higher level
      // if (ps[i].type === 'title' || ps[i].content === '') {
      if (ps[i].type === 'title' && ps[i].headingLevel <= sectionHeadingLevel) {
        break
      }
      psToRemove.push(ps[i])
    }

    // Delete the saved set of paragraphs
    note.removeParagraphs(psToRemove)
    console.log(`\t  -> removed ${psToRemove.length} paragraphs`)
    return existingHeadingIndex
  } else {
    return ps.length
  }
}

/** -------------------------------------------------------------------------------
 * Return list of lines matching the specified string in the specified project or daily notes.
 * @param {array} notes - array of Notes to look over
 * @param {string} stringToLookFor - string to look for
 * @param {boolean} highlightOccurrences - whether to enclose found string in ==marks==
 * @param {string} dateStyle - where the context for an occurrence is a date, does it get appended as a 'date' using your locale, or as a NP date 'link' (`>date`) or 'none'
 * @return [Array, Array] - array of lines with matching term, and array of 
 *   contexts for those lines (dates for daily notes; title for project notes).
 */
export async function gatherMatchingLines(
  notes: Array<TNote>,
  stringToLookFor: string,
  highlightOccurrences: boolean = true,
  dateStyle: string = 'link',
): Promise<[Array<string>, Array<string>]> {

  console.log(`Looking for '${stringToLookFor}' in ${notes.length} notes`)
  CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`)
  await CommandBar.onAsyncThread()

  const matches: Array<string> = []
  const noteContexts: Array<string> = []
  let i = 0
  for (const n of notes) {
    i += 1
    const noteContext = (n.date == null)
      ? `[[${n.title ?? ''}]]`
      : (dateStyle.startsWith('link')) // to deal with earlier typo where default was set to 'links'
        // $FlowIgnore(incompatible-call)
        ? ` >${hyphenatedDate(n.date)}`
        : (dateStyle === 'date')
          // $FlowIgnore(incompatible-call)
          ? ` (${toLocaleDateTimeString(n.date)})`
          : (dateStyle === 'at')
            // $FlowIgnore(incompatible-call)
            ? ` @${hyphenatedDate(n.date)}`
            : ''
    // find any matches
    const matchingParas = n.paragraphs.filter((q) => q.content.includes(stringToLookFor))
    for (const p of matchingParas) {
      let matchLine = p.content
      // If the stringToLookFor is in the form of an 'attribute::' and found at the start of a line,
      // then remove it from the output line
      if (stringToLookFor.endsWith('::') && matchLine.startsWith(stringToLookFor)) {
        matchLine = matchLine.replace(stringToLookFor, '') // NB: only removes first instance
        // console.log(`    -> ${matchLine}`)
      }
      // highlight matches if requested
      if (highlightOccurrences) {
        matchLine = matchLine.replace(stringToLookFor, `==${stringToLookFor}==`)
      }
      // console.log(`    -> ${matchLine}`)
      matches.push(matchLine.trim())
      // $FlowFixMe[incompatible-call]
      noteContexts.push(noteContext)
    }
    if (i % 10 === 0) {
      CommandBar.showLoading(true, `Searching in ${notes.length} notes ...`, (i / notes.length))
    }
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)
  return [matches, noteContexts]
}


/** -------------------------------------------------------------------------------
 * Calculate hashtag statistics for daily notes of a given time period
 * - Map of { tag, count } for all tags included or not excluded
 * - Map of { tag, total } for the subset of all tags above that finish with a /number
 * @author @jgclark
 * 
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @return {[Map, Map]}
*/
export async function calcHashtagStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
): Promise<?[Map<string, number>, Map<string, number>]> {
  let config = await getConfigSettings()

  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange( dateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr )
  )

  if (periodDailyNotes.length === 0) {
    console.log(`  warning: no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
    return
  }

  // work out what set of mentions to look for (or ignore)
  const hashtagsToLookFor = config.includeHashtags.length > 0 ? config.includeHashtags : []
  const hashtagsToIgnore = config.excludeHashtags.length > 0 ? config.excludeHashtags : []

  // For each matching date, find and store the tags in Map
  const tagCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const tagSumTotals = new Map<string, number>() // key: tagname (except last part); value: total
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
      if (
        hashtagsToLookFor.length > 0 &&
        hashtagsToLookFor.filter((a) => t.startsWith(a)).length === 0
      ) {
        // console.log(`\tIgnoring '${t}' as not on inclusion list`)
      } else if (hashtagsToIgnore.filter((a) => t.startsWith(a)).length > 0) {
        // console.log(`\tIgnoring '${t}' as on exclusion list`)
      } else {
        // if this is tag that finishes '/number', then sum the numbers as well as count
        if (t.match(/\/\d+(\.\d+)?$/)) {
          const tagParts = t.split('/')
          const k = tagParts[0]
          const v = Number(tagParts[1])
          // console.log(`found tagParts ${k} / ${v}`)
          tagCounts.set(k, (tagCounts.get(k) ?? 0) + 1)
          tagSumTotals.set(k, (tagSumTotals.get(k) ?? 0) + v)
          // console.log(`  ${k} -> ${tagSumTotals.get(k)} from ${tagCounts.get(k)}`)
        } else {
          // just save this to the main map
          tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
          // console.log(`  ${t} -> ${tagCounts.get(t)}`)
        }
      }
      lastTag = t
    }
  }

  return [tagCounts, tagSumTotals]
}

/** -------------------------------------------------------------------------------
 * Calculate mention statistics for daily notes of a given time period.
 * If an 'include' list is set, only include things from that list.
 * If not, include all, except those on an 'exclude' list (if set).
 *
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @return {Map, Map} maps of {tag, count}
*/
export async function calcMentionStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
): Promise<?[Map<string, number>, Map<string, number>]> {
  let config = await getConfigSettings()

  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange( dateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr )
  )

  if (periodDailyNotes.length === 0) {
    console.log('  warning: no matching daily notes found')
    return
  }

  // work out what set of mentions to look for (or ignore)
  const mentionsToLookFor = config.includeMentions.length > 0 ? config.includeMentions : []
  const mentionsToIgnore = config.excludeMentions.length > 0 ? config.excludeMentions : []

  // TODO: Work out whether we want to know about zero totals, occurrences, and/or no valid data
  // Tricky ...
  // Yes: @run, @work, 
  // No: @fruitveg

  // For each matching date, find and store the mentions in Map
  const mentionCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const mentionSumTotals = new Map<string, number>() // key: mention name (except last part); value: total

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
      if (
        mentionsToLookFor.length > 0 &&
        mentionsToLookFor.filter((a) => m.startsWith(a)).length === 0
      ) {
        // console.log(`\tIgnoring '${m}' as not on inclusion list`)
      } else if (mentionsToIgnore.filter((a) => m.startsWith(a)).length > 0) {
        // console.log(`\tIgnoring '${m} as on exclusion list`)
      } else {
        // if this is menion that finishes (number), then
        if (m.match(/\(\d+(\.\d+)?\)$/)) {
          const mentionParts = m.split('(')
          const k = mentionParts[0]
          const v = Number(mentionParts[1].slice(0, -1)) // chop off final ')' character
          mentionCounts.set(k, (mentionCounts.get(k) ?? 0) + 1)
          mentionSumTotals.set(k, (mentionSumTotals.get(k) ?? 0) + v)
          // console.log(`found mentionParts ${k} / ${v} in ${displayTitle(n)} -> ${String(mentionSumTotals.get(k))} from ${String(mentionCounts.get(k))}`)
        } else {
          // just save this to the main map
          mentionCounts.set(m, (mentionCounts.get(m) ?? 0) + 1)
          // FIXME: issue here when stray @words appear, which get counted here, upsetting their stats
          // console.log(`  -> ${m} = ${String(mentionCounts.get(m))}`)
        }
      }
      lastMention = m
    }
  }

  return [mentionCounts, mentionSumTotals]
}
