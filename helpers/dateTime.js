// @flow
/* eslint-disable prefer-template */
//-------------------------------------------------------------------------------
// Date functions, that don't rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import moment from 'moment/min/moment-with-locales'
import { default as momentBusiness } from 'moment-business-days'
import { formatISO9075, eachDayOfInterval, eachWeekendOfInterval, format, add } from 'date-fns'
import { clo, logDebug, logError, logInfo, logWarn } from './dev'
import { parseTeamspaceFilename } from './teamspace'

//-----------------------------------------------------------
// CONSTANTS
export const MOMENT_FORMAT_NP_ISO = 'YYYY-MM-DD'
export const MOMENT_FORMAT_NP_DAY = 'YYYYMMDD'
export const MOMENT_FORMAT_NP_WEEK = 'YYYY-[W]WW'
export const MOMENT_FORMAT_NP_MONTH = 'YYYY-MM'
export const MOMENT_FORMAT_NP_QUARTER = 'YYYY-[Q]Q'
export const MOMENT_FORMAT_NP_YEAR = 'YYYY'

//-----------------------------------------------------------
// REGEXES (and strings that help make regexes)
// WARNING: Most of the RE_* below aren't actually regex objects but strings

// Basic date/time regex strings
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE = '\\d{4}-[01]\\d-[0123]\\d' // find ISO dates of form YYYY-MM-DD (stricter than before)
export const RE_YYYYMMDD_DATE = '\\d{4}[01]\\d[0123]\\d' // version of above that finds dates of form YYYYMMDD
export const RE_DATE_CAPTURE = `(\\d{4}[01]\\d{1}\\d{2})` // capture date of form YYYYMMDD
export const RE_ISO_DATE = RE_DATE // now earlier RE_DATE made the same as this stricter one
export const RE_ISO_DATE_ALL = new RegExp(RE_ISO_DATE, "g")
export const RE_PLUS_DATE_G: RegExp = />(\d{4}-\d{2}-\d{2})(\+)*/g
export const RE_PLUS_DATE: RegExp = />(\d{4}-\d{2}-\d{2})(\+)*/
export const RE_SCHEDULED_ISO_DATE = '>\\d{4}-[01]\\d-[0123]\\d' // find scheduled dates of form >YYYY-MM-DD
export const RE_DATE_TIME = `${RE_DATE} ${RE_TIME}` // YYYY-MM-DD HH:MM[AM|PM]
export const RE_BARE_DATE = `[^\d(<\/-]${RE_DATE}` // an ISO date without a digit or ( or < or / or - before it. Note: > is allowed.
export const RE_BARE_DATE_CAPTURE = `[^\d(<\/-](${RE_DATE})` // capturing date in above
export const RE_FILE_EXTENSIONS_GROUP = `\\.(md|txt)$` // and tie to end of string
export const RE_NP_DAY_SPEC = RE_YYYYMMDD_DATE
export const RE_DAILY_NOTE_FILENAME = `(^|\\/)${RE_YYYYMMDD_DATE}${RE_FILE_EXTENSIONS_GROUP}`
export const RE_SCHEDULED_DAILY_NOTE_LINK: RegExp = />\d{4}-[01]\d-[0123]\d/ // Note: finds '>RE_DATE'

// Week regex strings
export const RE_NP_WEEK_SPEC = '\\d{4}\\-W[0-5]\\d' // find dates of form YYYY-Wnn
export const RE_NP_WEEK_ALL = new RegExp(RE_NP_WEEK_SPEC, "g")
export const WEEK_NOTE_LINK = `[\<\>]${RE_NP_WEEK_SPEC}`
export const SCHEDULED_WEEK_NOTE_LINK = '\\s+>\\d{4}\\-W[0-5]\\d'
export const RE_SCHEDULED_WEEK_NOTE_LINK: RegExp = />\d{4}\-W[0-5]\d/ // Note: finds '>RE_NP_WEEK_SPEC'
export const RE_WEEKLY_NOTE_FILENAME = `(^|\\/)${RE_NP_WEEK_SPEC}${RE_FILE_EXTENSIONS_GROUP}`
export const RE_BARE_WEEKLY_DATE = `[^\d(<\/-]${RE_NP_WEEK_SPEC}` // a YYYY-Www date without a digit or ( or < or / or - before it. Note: > is allowed.
export const RE_BARE_WEEKLY_DATE_CAPTURE = `[^\d(<\/-](${RE_NP_WEEK_SPEC})` // capturing date in above

// Months
// Note: to avoid matching YYYY-MM-DD as well, these check they aren't followed by a digit or -
export const RE_NP_MONTH_SPEC = '\\d{4}-[01]\\d(?![\\d-])' // fails if we use negative start or negative lookbehinds
export const RE_NP_MONTH_ALL = new RegExp(RE_NP_MONTH_SPEC, "g")
export const MONTH_NOTE_LINK = `[\<\>]${RE_NP_MONTH_SPEC}`
export const SCHEDULED_MONTH_NOTE_LINK = `>${RE_NP_MONTH_SPEC}`
export const RE_SCHEDULED_MONTH_NOTE_LINK: RegExp = new RegExp(`>${RE_NP_MONTH_SPEC}`)
export const RE_MONTHLY_NOTE_FILENAME = `(^|\\/)${RE_NP_MONTH_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// Quarters
export const RE_NP_QUARTER_SPEC = '\\d{4}\\-Q[1-4](?!\\d)' // find dates of form YYYY-Qn not followed by digit
export const RE_NP_QUARTER_ALL = new RegExp(RE_NP_QUARTER_SPEC, "g")
export const QUARTER_NOTE_LINK = `[\<\>]${RE_NP_QUARTER_SPEC}`
export const SCHEDULED_QUARTERLY_NOTE_LINK = `>${RE_NP_QUARTER_SPEC}`
export const RE_SCHEDULED_QUARTERLY_NOTE_LINK: RegExp = new RegExp(`>${RE_NP_QUARTER_SPEC}`)
export const RE_QUARTERLY_NOTE_FILENAME = `(^|\\/)${RE_NP_QUARTER_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// Half-Years -- Note: not supported by NotePlan, but used by @jgclark in some places
export const RE_NP_HALFYEAR_SPEC = '\\d{4}\\H[1-2](?!\\d)' // find dates of form YYYYHn not followed by digit

// Years
export const RE_NP_YEAR_SPEC = '\\d{4}(?![\\d-])' // find years of form YYYY without leading or trailing - or digit [fails if I add negative start or negative lookbehinds]
export const RE_BARE_YEAR_SPEC = '^\\d{4}$' // find years of form YYYY without anything leading or trailing
export const RE_NP_YEAR_ALL = new RegExp(RE_NP_YEAR_SPEC, "g")
export const YEAR_NOTE_LINK = `[\<\>]${RE_NP_YEAR_SPEC}`
export const SCHEDULED_YEARLY_NOTE_LINK = `>${RE_NP_YEAR_SPEC}`
export const RE_SCHEDULED_YEARLY_NOTE_LINK: RegExp = new RegExp(`>${RE_NP_YEAR_SPEC}`)
export const RE_YEARLY_NOTE_FILENAME = `(^|\\/)${RE_NP_YEAR_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// Tests for all NP-supported scheduled date types
export const RE_ANY_DUE_DATE_TYPE: RegExp = new RegExp(`\\s+>(${RE_DATE}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC})`)
export const RE_IS_SCHEDULED: RegExp = new RegExp(`>(${RE_DATE}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC}|today)`)
export const RE_SCHEDULED_DATES_G: RegExp = new RegExp(`>(${RE_DATE}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC}|today)`, 'g')
export const RE_IS_SCHEDULED_CAPTURES: RegExp = new RegExp(`>((${RE_DATE}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC}|today))`, 'g')

// @done(...)
export const RE_DONE_DATE_TIME: RegExp = new RegExp(`@done\\(${RE_DATE_TIME}\\)`) // find @done(DATE TIME)
export const RE_DONE_DATE_TIME_CAPTURES: RegExp = new RegExp(`@done\\((${RE_DATE})( ${RE_TIME})\\)`) // find @done(DATE TIME) and return date-time part
export const RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE: RegExp = new RegExp(`@done\\((${RE_DATE})( ${RE_TIME})?\\)`) // find @done(DATE TIME) and return date-time part
export const RE_DONE_DATE_OPT_TIME: RegExp = new RegExp(`@done\\(${RE_ISO_DATE}( ${RE_TIME})?\\)`)

// Intervals
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[BbDdWwMmQqHhYy]` // Note: includes @jgclark extension
export const RE_OFFSET_DATE = `{\\^?${RE_DATE_INTERVAL}}`
export const RE_OFFSET_DATE_CAPTURE = `{(\\^?${RE_DATE_INTERVAL})}`

/**
 * Get today's date.
 * This uses local time, so shouldn't get TZ problems.
 * WARNING: Deprecated in favour of clearer named function 'todaysDateISOString' below.
 * @author @jgclark
 * @returns {string} YYYY-MM-DD
 */
export function getTodaysDateHyphenated(): string {
  return moment().format('YYYY-MM-DD')
}
/**
 * Constant version of getTodaysDateHyphenated()
 * This uses local time, so shouldn't get TZ problems.
 * @author @jgclark
 */
export const todaysDateISOString: string = moment().format('YYYY-MM-DD')

/**
 * Returns today's date as a date of form 'YYYY-MM-DD'.
 * This uses local time, so shouldn't get TZ problems.
 * @return {string} the Arrow Date representation of today's date.
 */
export function getTodaysDateAsArrowDate(): string {
  return `>${getTodaysDateHyphenated()}`
}

/**
 * Get today's date in form YYYYMMDD
 * This uses local time, so shouldn't get TZ problems.
 * @author @jgclark
 * @returns {string} YYYY-MM-DD
 */
export function getTodaysDateUnhyphenated(): string {
  return moment().format('YYYYMMDD')
}

/**
 * Returns the start of today as a JS Date object.
 * @return {Date} start of todayobject.
 */
export function getJSDateStartOfToday(): Date {
  return moment().startOf('day').toDate()
}

// Note: there are others in NPdateTime.js that use locale settings

// Get current time in various ways
export const getFormattedTime = (format: string = '%Y-%m-%d %I:%M:%S %P'): string => strftime(format)

// Note: there are others in NPdateTime.js that use locale settings

// return datetime in UTC ISO format
export const nowUTCShortDateTimeISOString: string = moment().toISOString().replace('T', ' ').slice(0, 16)

// Note: See getNoteType in note.js to get the type of a note
export function isDailyNote(note: CoreNoteFields): boolean {
  const { filename } = parseTeamspaceFilename(note.filename)
  return new RegExp(RE_DAILY_NOTE_FILENAME).test(filename)
}

export function isWeeklyNote(note: CoreNoteFields): boolean {
  const { filename } = parseTeamspaceFilename(note.filename)
  return new RegExp(RE_WEEKLY_NOTE_FILENAME).test(filename)
}

export function isMonthlyNote(note: CoreNoteFields): boolean {
  const { filename } = parseTeamspaceFilename(note.filename)
  return new RegExp(RE_MONTHLY_NOTE_FILENAME).test(filename)
}

export function isQuarterlyNote(note: CoreNoteFields): boolean {
  const { filename } = parseTeamspaceFilename(note.filename)
  return new RegExp(RE_QUARTERLY_NOTE_FILENAME).test(filename)
}

export function isYearlyNote(note: CoreNoteFields): boolean {
  const { filename } = parseTeamspaceFilename(note.filename)
  return new RegExp(RE_YEARLY_NOTE_FILENAME).test(filename)
}

/**
 * Return timeframe of calendar notes (or false for project notes).
 * Note: also see getNoteType in note.js to get the type of a note in a more conversational way (e.g. -> 'Monthly')
 * @author @jgclark
 * @param {TNote} note - the note to look at
 * @returns false | 'day' | 'week' | 'month' | 'quarter' | 'year'
 */
export function getCalendarNoteTimeframe(note: TNote): false | 'day' | 'week' | 'month' | 'quarter' | 'year' {
  if (note.type === 'Calendar') {
    return (
      (isDailyNote(note) && 'day') || (isWeeklyNote(note) && 'week') || (isMonthlyNote(note) && 'month') || (isQuarterlyNote(note) && 'quarter') || (isYearlyNote(note) && 'year')
    )
  }
  return false // all other cases
}

export const isDailyDateStr = (dateStr: string): boolean => (new RegExp(RE_DATE).test(dateStr) || new RegExp(RE_NP_DAY_SPEC).test(dateStr))

export const isWeeklyDateStr = (dateStr: string): boolean => new RegExp(RE_NP_WEEK_SPEC).test(dateStr)

export const isMonthlyDateStr = (dateStr: string): boolean => new RegExp(RE_NP_MONTH_SPEC).test(dateStr)

export const isQuarterlyDateStr = (dateStr: string): boolean => new RegExp(RE_NP_QUARTER_SPEC).test(dateStr)

// Note: now stricter than before: only matches YYYY without anything else. So a looser function defined as well.
export const containsYearlyDateStr = (dateStr: string): boolean => new RegExp(RE_NP_YEAR_SPEC).test(dateStr)
export const isYearlyDateStr = (dateStr: string): boolean => new RegExp(RE_BARE_YEAR_SPEC).test(dateStr)

/**
 * Test if a string has a date (e.g. was scheduled for a specific date/week or has a >today tag). There are two different names to suit different contexts.
 * @author @dwertheimer
 * @param {string} content
 * @returns {boolean} true if the content contains a date in the form YYYY-MM-DD or a >today or weekly note
 * @tests in jest file (for isScheduled)
 */
export const isScheduled = (content: string): boolean => new RegExp(RE_IS_SCHEDULED).test(content)
export const containsScheduledDate = (content: string): boolean => new RegExp(RE_IS_SCHEDULED).test(content)

/**
 * Find occurrence(s) of dates scheduled for a specific date (or has a >today tag) in a string.
 * @author @jgclark
 * @param {string} content
 * @returns {Array<string>} array of NP dates, without leading '>' (e.g. ['2022-01-01', '2022-01-02'])
 */
export function findScheduledDates(content: string): Array<string> {
  const matches = content.matchAll(RE_IS_SCHEDULED_CAPTURES)
  const dates = []
  for (const match of matches) {
    dates.push(match[1])
  }
  return dates
}

/**
 * Determines whether a line is overdue or not. A line with multiple dates is only overdue if all dates are overdue.
 * Finds ISO8601 dates in a string and returns an array of the dates found if all dates are overdue (or an empty array)
 * Note: moved from note.js
 * @param {string} line
 * @returns foundDates - array of dates found
 */
export function findOverdueDatesInString(line: string): Array<string> {
  const todayHyphenated = hyphenatedDateString(moment().toDate())
  const dates = line.match(RE_PLUS_DATE_G)
  if (dates) {
    const overdue = dates.filter((d) => d.slice(1) < todayHyphenated)
    return overdue.length === dates.length ? overdue.sort() : [] // if all dates are overdue, return them sorted
  }
  return []
}

/**
 * Remove all >date or >today occurrences in a string and add (>today's-date by default) or the supplied string to the end.
 * Note: this does not automatically add the '>' on the front of the replaceWith string.
 * @param {string} inString - the string to start with
 * @param {?string | null} replaceWith - the string to add to the end (if nothing sent, will use >todaysDate)
 * @returns {string} string with the replacements made, and trimmed
 * @author @dwertheimer
 * @tests in jest file
 */
export function replaceArrowDatesInString(inString: string, replaceWith: string | null = null): string {
  let str = inString
  let repl = replaceWith
  if (replaceWith == null) {
    // if no replacement string, use today's date (e.g. replace >today with todays date instead)
    repl = getTodaysDateAsArrowDate()
  }
  // logDebug(`replaceArrowDatesInString: BEFORE inString=${inString}, replaceWith=${replaceWith ? replaceWith : 'null'}, repl=${repl ? repl : 'null'}`)
  while (str && isScheduled(str)) {
    str = str
      .replace(RE_SCHEDULED_DATES_G, '')
      .replace(/ {2,}/g, ' ')
      .trim()
  }
  // logDebug(`replaceArrowDatesInString: AFTER will return ${repl && repl.length > 0 ? `${str} ${repl}` : str}`)
  return repl && repl.length > 0 ? `${str} ${repl}` : str
}

//-------------------------------------------------------------------------------

/**
 * Get Y, M, D parts.
 * Note: This works on local time, so can ignore TZ effects.
 * @author @nmn
 * @param {Date} dateObj
 * @returns {{year: number, month: number, date: number}}
 */
export function getYearMonthDate(dateObj: Date): $ReadOnly<{
  year: number,
  month: number,
  date: number,
}> {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() + 1
  const date = dateObj.getDate()
  return {
    year,
    month,
    date,
  }
}

export type HourMinObj = { h: number, m: number }

/**
 * Change YYYY-MM-DD to YYYYMMDD, if needed. Leave the rest of the string (which is expected to be a filename) unchanged.
 * Note: updated in Apr 2025 to cope with Teamspace Calendar notes (with leading %%NotePlanCloud%%/UUID/) as well as private daily notes.
 * @param {string} dailyNoteFilename
 * @returns {string} with YYYYMMDD in place of YYYY-MM-DD where found. 
 */
export function convertISODateFilenameToNPDayFilename(dailyNoteFilename: string): string {
  const matches = dailyNoteFilename.match(RE_ISO_DATE)
  if (matches) {
    const npDayString = matches[0].replace(/-/g, '')
    return dailyNoteFilename.replace(matches[0], npDayString)
  } else {
    return dailyNoteFilename
  }
}

// Note: ? This does not work to get reliable date string from note.date for daily notes
export function toISODateString(dateObj: Date): string {
  // logDebug('dateTime / toISODateString', `${dateObj.toISOString()} // ${toLocaleDateTimeString(dateObj)}`)
  return dateObj.toISOString().slice(0, 10)
}

// As ISODateString() doesn't work reliably across date boundaries except at GMT,
// this version creates YYYY-MM-DD format using the slight cheat of the sv-SE locale,
// which happens to be identical.
export function hyphenatedDate(date: Date): string {
  if (date != null) {
    // logDebug('dateTime / hyphenatedDate', `${toLocaleDateTimeString(date)} -> ${toLocaleDateString(date, 'sv-SE')}`)
    return toLocaleDateString(date, 'sv-SE')
  } else {
    return 'hyphenatedDate: error: not a valid JS Date'
  }
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj !== undefined ? dateObj.toISOString().slice(0, 16) : 'undefined'
}

export function toLocaleDateTimeString(dateObj: Date, locale: string | Array<string> = [], options: Intl$DateTimeFormatOptions = {}): string {
  return dateObj.toLocaleString(locale, options)
}

export function toLocaleDateString(dateObj: Date, locale: string | Array<string> = [], options: Intl$DateTimeFormatOptions = {}): string {
  return dateObj.toLocaleDateString(locale, options)
}

export function toLocaleTime(dateObj: Date, locale: string | Array<string> = [], options: Intl$DateTimeFormatOptions = {}): string {
  return dateObj.toLocaleTimeString(locale, options)
}

export function printDateRange(dr: DateRange) {
  logInfo('dateTime / printDateRange', `<${toISOShortDateTimeString(dr.start)} - ${toISOShortDateTimeString(dr.end)}>`)
}

/**
 * Get YYYYMMDD for supplied date.
 * Note: This works on local time, so can ignore TZ effects.
 * @author @nmn
 * @param {Date} dateObj
 * @returns {string}
 */
export function YYYYMMDDDateStringFromDate(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

/**
 * Alias for YYYYMMDDDateStringFromDate()
 * Note: This works on local time, so can ignore TZ effects.
 * @author @nmn
 * @param {Date} dateObj
 * @returns {string}
 */
export function filenameDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

/**
 * Get YYYY-MM-DD for supplied date.
 * Note: This works on local time, so can ignore TZ effects.
 * @author @nmn
 * @param {Date} dateObj
 * @returns {string}
 */
export function hyphenatedDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`
}

/**
 * Return calendar date in a variety of NP markup styles:
 * - 'at': '@date'
 * - 'date': locale version of date
 * - 'scheduled': '>date'
 * - default: '[[date]]'
 * @author @jgclark
 * @param {Date} inputDate
 * @param {string} style to return
 * @return {string}
 */
export function formatNoteDate(inputDate: Date, style: string): string {
  let output = ''
  switch (style) {
    case 'at': {
      output = `@${hyphenatedDateString(inputDate)}`
      break
    }
    case 'date': {
      // note this will vary depending on tester's locale
      output = `${toLocaleDateString(inputDate)}`
      break
    }
    case 'scheduled': {
      output = `>${hyphenatedDateString(inputDate)}`
      break
    }
    default: {
      // link or links
      output = `[[${hyphenatedDateString(inputDate)}]]`
      break
    }
  }
  return output
}

/**
 * Return the time as a string in the format "HH:MM"
 * @author @dwertheimer
 *
 * @param {Date} date object
 * @returns {string} - the time string in the format "HH:MM"
 */
export function getTimeStringFromDate(date: Date): string {
  // original version using an odd library:
  return formatISO9075(date).split(' ')[1].slice(0, -3)
  // TODO(@dwertheimer): please assess this newer version that just uses newer JS:
  // return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getTimeStringFromHM(hours: number, minutes: number): string {
  return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`
}

/**
 * Take a date string from calendar note filename, and convert to NP display string. In practice this leaves week, month, quarter, year dates alone, but changes YYYYMMDD to YYYY-MM-DD.
 * Note: this is the reverse of getFilenameDateStrFromDisplayDateStr().
 * @param {string} dateStrIn from filename
 * @returns {string}
 */
export function getDisplayDateStrFromFilenameDateStr(dateStrIn: string): string {
  if (dateStrIn.match(RE_YYYYMMDD_DATE)) {
    return getISODateStringFromYYYYMMDD(dateStrIn)
  } else {
    return dateStrIn
  }
}

/**
 * Take a displayed date string and convert to the main part of the filename used in calendar notes (i.e. minus extension). In practice this leaves week, month, quarter, year dates alone, but changes YYYY-MM-DD to YYYYMMDD.
 * Note: this is the reverse of getDisplayDateStrFromFilenameDateStr().
 * @param {string} dateStrIn from filename
 * @returns {string}
 */
export function getFilenameDateStrFromDisplayDateStr(dateStrIn: string): string {
  if (dateStrIn.match(RE_ISO_DATE)) {
    return convertISODateFilenameToNPDayFilename(dateStrIn)
  } else {
    return dateStrIn
  }
}

/**
 * Take a NP display date string and convert to one to use in API calls. In practice this leaves week, month, quarter, year dates alone, but changes YYYY-MM-DD to YYYYMMDD.
 * @param {string} dateStrIn from filename
 * @returns {string}
 */
export function getAPIDateStrFromDisplayDateStr(dateStrIn: string): string {
  if (dateStrIn.match(RE_ISO_DATE)) {
    return convertISODateFilenameToNPDayFilename(dateStrIn)
  } else {
    return dateStrIn
  }
}

/**
 * Returns the NP string representation of a Calendar note's date, from its filename. Covers daily to yearly notes.
 * Extended in Apr 2025 to cover teamspace notes, which are prefixed with '[%%Supabase%%|%%NotePlanCloud%%]/<teamspaceID>/'
 * e.g. %%Supabase%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md
 * Note: see related getDateStrForStartofPeriodFromCalendarFilename().
 * @param {string} filenameIn
 * @param {boolean} returnISODate - returns ISO daily note YYYY-MM-DD not actual filename YYYYMMDD
 * @returns {string} YYYYMMDD or YYYY-MM-DD depending on 2nd parameter / YYYY-Wnn / YYYY-mm / YYYY-Qn / YYYY date (some only from NP v3.7.2)
 * @tests in jest file
 */
export function getDateStringFromCalendarFilename(filenameIn: string, returnISODate: boolean = false): string {
  try {
    // logDebug('gDSFCF', `for ${filenameIn} ...`)
    const parsedDetails = parseTeamspaceFilename(filenameIn)
    const filenameWithoutTeamspaceID = parsedDetails.filename
    // logDebug('gDSFCF', `filenameWithoutTeamspaceID = ${filenameWithoutTeamspaceID}`)

    // Check for daily notes
    if (filenameWithoutTeamspaceID.match(RE_DAILY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `= daily`)
      if (returnISODate) {
        return getISODateStringFromYYYYMMDD(filenameWithoutTeamspaceID)
      } else {
        return filenameWithoutTeamspaceID.slice(0, 8)
      }
    } else if (filenameWithoutTeamspaceID.match(RE_WEEKLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filenameWithoutTeamspaceID} = weekly`)
      return filenameWithoutTeamspaceID.slice(0, 8)
    } else if (filenameWithoutTeamspaceID.match(RE_MONTHLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filenameWithoutTeamspaceID} = monthly`)
      return filenameWithoutTeamspaceID.slice(0, 7)
    } else if (filenameWithoutTeamspaceID.match(RE_QUARTERLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filenameWithoutTeamspaceID} = quarterly`)
      return filenameWithoutTeamspaceID.slice(0, 7)
    } else if (filenameWithoutTeamspaceID.match(RE_YEARLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filenameWithoutTeamspaceID} = yearly`)
      return filenameWithoutTeamspaceID.slice(0, 4)
    } else {
      throw new Error(`Invalid calendar filename: ${filenameIn}`)
    }
  } catch (err) {
    logError('dateTime / getDateStringFromCalendarFilename', err.message)
    return '(invalid date)' // for completeness
  }
}

/**
 * Returns a YYYYMMDD string representation of a Calendar note's first date that it covers, from its filename (e.g. '2022-Q4.md' -> '20221001').
 * Note: see related getDateStringFromCalendarFilename().
 * FIXME: Relies on DataStore -- really shouldn't be in this file.
 * WARNING: Probably not reliable as it relies on the Calendar note existing, I think.
 * @param {string} filename
 * @returns {string} YYYYMMDD for first date in period
 */
export function getDateStrForStartofPeriodFromCalendarFilename(filename: string): string {
  try {
    // Trying a shortcut way first: seems to work
    // logDebug('dateTime / gDSFSOPFCF', `for ${filename} ...`)
    const thisNote = DataStore.noteByFilename(filename, 'Calendar')
    if (thisNote && thisNote.date) {
      const dateOut = YYYYMMDDDateStringFromDate(thisNote.date) ?? '(error)'
      // logDebug('gDSFSOPFCF', `-> ${dateOut}`)
      return dateOut
    } else {
      throw new Error(`Error in getting note.date from ${filename}`)
    }
  } catch (err) {
    logError('dateTime / gDSFSOPFCF', err.message)
    return '(invalid date)' // for completeness
  }
}

/**
 * Change a YYYYMMDD date string to YYYY-MM-DD
 * @param {string} dateStr without hyphens
 * @returns {string} ISO hyphenated string
 */
export function getISODateStringFromYYYYMMDD(filename: string): string {
  if (filename.match(/^\d{8}/)) {
    return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}`
  } else {
    return '(not a YYYYMMDD date)'
  }
}

/**
 * Remove >date and <date from a string.
 * Note: now lives in stringTransforms.js, but left here for now.
 * @author @nmn
 * @param {string} input
 * @returns {string} output
 */
export function removeDateTags(content: string): string {
  return content
    .replace(/<\d{4}-\d{2}-\d{2}/g, '')
    .replace(/>\d{4}-\d{2}-\d{2}/g, '')
    .trimEnd()
}

/**
 * Remove all >date -related things from a line (and optionally >week, >month, >quarter etc. ones also)
 * Note: now lives in stringTransforms.js, but left here for now.
 * @author @dwertheimer
 * @param {string} tag - the incoming text
 * @param {boolean} removeAllSpecialNoteLinks - if true remove >week, >month, >quarter, >year references too
 * @returns
 */
export function removeDateTagsAndToday(tag: string, removeAllSpecialNoteLinks: boolean = false): string {
  let newString = tag,
    lastPass = tag
  do {
    lastPass = newString
    newString = removeDateTags(tag)
      .replace(removeAllSpecialNoteLinks ? new RegExp(WEEK_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(MONTH_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(QUARTER_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(YEAR_NOTE_LINK, 'g') : '', '')
      .replace(/>today/, '')
      .replace(/\s{2,}/g, ' ')
      .trimEnd()
  } while (newString !== lastPass)
  return newString
}

/**
 * Remove repeats from a string (e.g. @repeat(1/3) or @repeat(2/3) or @repeat(3/3) or @repeat(1/1) or @repeat(2/2) etc.)
 * Because NP complains when you try to rewrite them (delete them).
 * Note: now lives in stringTransforms.js, but left here for now.
 * @param {string} content
 * @returns {string} content with repeats removed
 */
export function removeRepeats(content: string): string {
  return content
    .replace(/\@repeat\(\d{1,}\/\d{1,}\)/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/**
 * Return difference between start and end dates (by default ignoring any time components)
 * if returnFractionalDays is true, then use time components and return a fractional number of days (e.g. 1.5 for 36 hours)
 * Note: It is highly recommended that if you have an ISO string (e.g. '2022-01-01') you send the string
 * rather than trying to convert it to a Date object, as the Date object may be converted to local time, which may not be what you want.
 * Note: v2 uses a.moment(b).diff(moment().startOf('day'), 'days') instead
 * @author @jgclark
 * @tests in jest file
 * @param {string|Date} startDate - if string, must be in ISO format (e.g. '2022-01-01')
 * @param {string|Date} endDate - if string, must be in ISO format (e.g. '2022-01-01')
 * @param {boolean} returnFractionalDays (default: false) - if true, return a fractional number of days (e.g. 1.5 for 36 hours)
 * otherwise, it truncates the decimal part (e.g. 1 for 36 hours)
 * @return {number} - number of days between startDate and endDate (truncated to integer if returnFractionalDays is false)
 */
export function daysBetween(startDate: string | Date, endDate: string | Date, returnFractionalDays: boolean = false): number {
  const reISODATE = new RegExp(RE_DATE)
  if ((typeof startDate === 'string' && !startDate.match(reISODATE)) || (typeof endDate === 'string' && !endDate.match(reISODATE))) {
    throw new Error('Invalid date format')
  }
  // v1 method:
  // const res = Math.round((endDate - startDate) / 1000 / 60 / 60 / 24) // i.e. milliseconds -> days
  // return (res === -0) ? 0 : res // handle weird edge case

  // v2 method:
  // moment's a.diff(b, 'days') gives the different in days between a and b, with the answer truncated (not rounded)
  if (returnFractionalDays) {
    return moment(endDate).diff(moment(startDate), 'days', returnFractionalDays)
  } else {
    return moment(endDate).startOf('day').diff(moment(startDate).startOf('day'), 'days', returnFractionalDays)
  }
}

/**
 * Test if a date is within two start and end dates (inclusive)
 * @author @jgclark
 *
 * @param {string} testDate - date to look for (YYYYMMDD without hyphens)
 * @param {string} fromDate - start Date (YYYYMMDD without hyphens)
 * @param {string} endDate - end Date (YYYYMMDD without hyphens)
 * @return {boolean}
 */
export function withinDateRange(testDate: string, fromDate: string, toDate: string): boolean {
  return testDate >= fromDate && testDate <= toDate
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * Note: there is a newer locale-aware version of this function, using moment library at NPdateTime::localeRelativeDateFromNumber
 * @author @jgclark
 * @param {number} diffIn - number of days difference (positive or negative)
 * @param {boolean?} shortStyle?
 * @returns {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number, useShortStyle: boolean = false): string {
  let output = ''
  let diff = diffIn
  if (diffIn == null || diffIn === undefined || isNaN(diffIn)) {
    logWarn('dateTime / relativeDateFromNumber', `diffIn param is undefined`)
    return 'unknown date'
  }
  let isPast = false
  // logDebug('dateTime / relativeDateFromNumber', `original diff = ${diff}`)
  if (diff < 0) {
    diff = Math.abs(diff)
    isPast = true
  }
  if (useShortStyle) {
    if (diff === 1) {
      output = `${diff}d` // day
    } else if (diff < 9) {
      output = `${diff}d` // days
    } else if (diff < 12) {
      output = `${Math.round(diff / 7.0)}w` // wk
    } else if (diff < 29) {
      output = `${Math.round(diff / 7.0)}w` // wks
    } else if (diff < 550) {
      output = `${Math.round(diff / 30.4)}m` // mon
    } else {
      output = `${Math.round(diff / 365.0)}y` // yrs
    }
  } else {
    if (diff === 1) {
      output = `${diff} day`
    } else if (diff < 9) {
      output = `${diff} days`
    } else if (diff < 12) {
      output = `${Math.round(diff / 7.0)} wk`
    } else if (diff < 29) {
      output = `${Math.round(diff / 7.0)} wks`
    } else if (diff < 550) {
      output = `${Math.round(diff / 30.4)} mon`
    } else {
      output = `${Math.round(diff / 365.0)} yrs`
    }
  }
  if (diff === 0) {
    output = `today`
  } else if (isPast) {
    output += ` ago`
  } else {
    output = `in ${output}`
  }
  // logDebug('dateTime / relativeDateFromNumber', `--> ${output}`)
  return output
}

/**
 * Turn a string that includes YYYY-MM-DD into a JS Date.
 * The first found date is used; if no dates found a warning is written to the log.
 * @author @jgclark
 *
 * @param {string} - string that contains a date e.g. @due(2021-03-04)
 * @return {?Date} - JS Date version, if valid date found
 * @test - available in jest file
 */
export function getDateObjFromDateString(mention: string): ?Date {
  const RE_DATE_CAPTURE = `(${RE_DATE})` // capture date of form YYYY-MM-DD

  // logDebug('dateTime / getDateObjFromDateString', `for ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    // logDebug('dateTime / getDateObjFromDateString', `- ${res[1]}`)
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // logDebug('dateTime / getDateObjFromDateString', `- ${toISOShortDateTimeString(date)}`)
    return date
  } else {
    logDebug('dateTime / getDateObjFromDateString', `- no valid date found in '${mention}'`)
    return
  }
}

/**
 * Take in an "YYYY-MM-DD HH:MM time" string and return a Date object for that time
 * Note: there needs to be a space separating the date and time strings
 * Time string can include seconds, e.g. "2020-01-01 12:00:00"
 * Most of the code in this function is a workaround to make sure we get the right date for all OS versions
 * @author @dwertheimer
 *
 * @param {string} dateTimeString - in form "YYYY-MM-DD HH:MM"
 * @returns {Date} - the date object
 * @throws {Error} - if the dateTimeString is not in the correct format
 * @test - available in jest file
 */
export const getDateObjFromDateTimeString = (dateTimeString: string): Date => {
  // eslint-disable-next-line prefer-const -- using let so we can use destructuring
  let [dateString, timeString] = dateTimeString.split(' ')
  if (!timeString) {
    timeString = '00:00'
  }
  if (timeString.split(':').length === 2) timeString = `${timeString}:00`
  const timePartsStr = timeString.split(':')
  const datePartsStr = dateString.split('-')
  if (timePartsStr.length !== 3 || datePartsStr.length !== 3) {
    throw `dateTimeString "${dateTimeString}" is not in expected format`
  }
  const timeParts = timePartsStr.map((t) => parseInt(t))
  const dateParts = datePartsStr.map((d) => parseInt(d))
  dateParts[1] = dateParts[1] - 1 // Months is an index from 0-11
  const date = new Date(...dateParts, ...timeParts)
  if (date.toString() === 'Invalid Date') {
    throw `New Date("${dateTimeString}") returns an Invalid Date`
  }
  // Double-check for Catalina and previous JS versions dates (which do GMT conversion on the way in)
  if (!date.toTimeString().startsWith(timeString)) {
    throw `Date mismatch (Catalina date hell). Incoming time:${dateTimeString} !== generated:${date.toTimeString()}`
  }
  return date
}

/**
 * Turn a YYYYMMDD string into a JS Date. If no valid date found, then warning written to the log.
 * @param {string} - YYYYMMDD string
 * @return {?Date} - JS Date version the first found YYYYMMDD string
 */
export function getDateFromYYYYMMDDString(inputString: string): ?Date {
  // logDebug('dateTime / getDateFromYYYYMMDDString', inputString)
  const res = inputString.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(4, 6)) - 1, // only needed for months!
      Number(res[1].slice(6, 8)),
      0,
      0,
      0,
      0, // HH:MM:SS:mmm
    )
    // logDebug('dateTime / getDateFromYYYYMMDDString', toLocaleDateTimeString(date))
    return date
  } else {
    logWarn('dateTime / getDateFromYYYYMMDDString', `  no valid date found in '${inputString}'`)
    return
  }
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * TODO: Shift to moment library or move to NPdateTime.js
 * @param {Date} date - calculate difference between this date and today
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromDate(date: Date): string {
  // Wrapper to relativeDateFromNumber(), accepting JS date instead of number
  const diff = Calendar.unitsBetween(date, new Date(), 'day')
  return relativeDateFromNumber(diff)
}

/**
 * Get week number for supplied date, using the ISO 8601 definition for week:
 * 01 is the week with the first Thursday of the Gregorian year (i.e. of January) in it.
 * The following definitions based on properties of this week
 * are mutually equivalent, since the ISO week starts with Monday:
 * - It is the first week with a majority (4 or more) of its days in January.
 * - Its first day is the Monday nearest to 1 January.
 * - It has 4 January in it
 * - It has the year's first working day in it, if Saturdays, Sundays and 1 January are not working days.
 * E.g. 2022-01-01 is in week 52 of 2021, not week 1 of 2022.
 * @author @jgclark
 *
 * @param {Date} inDate - the JS Date object of interest
 * @return {number} - the standardised week number
 * @test - available in jest file
 */
export function getWeek(inDate: Date): number {
  // New method using 'moment' library, with Monday first day of week
  const dateMoment = moment(inDate)
  return Number(dateMoment.format('W'))

  // Older method with help from https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php?noredirect=1&lq=1
  // and with Sunday first day of week
  // const date = inDate instanceof Date ? new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate()) : new Date()

  // // ISO week date weeks start on Monday, so correct the day number
  // // const nDay = (date.getDay() + 6) % 7
  // // Get week date start on Sunday
  // const nDay = date.getDay()

  // // ISO 8601 states that week 1 is the week with the first Thursday of that year
  // // Set the target date to the Thursday in the target week
  // date.setDate(date.getDate() - nDay + 3)

  // // Store the millisecond value of the target date
  // const n1stThursday = date.valueOf()

  // // Set the target to the first Thursday of the year
  // // First, set the target to January 1st
  // date.setMonth(0, 1)

  // // Not a Thursday? Correct the date to the next Thursday
  // if (date.getDay() !== 4) {
  //   date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7))
  // }

  // // The week number is the number of weeks between the first Thursday of the year
  // // and the Thursday in the target week (604800000 = 7 * 24 * 3600 * 1000)
  // return 1 + Math.ceil((n1stThursday - date) / 604800000)
}

/**
 * WARNING: Only for use where Monday is the user's first day of the week. See NPdateTime::getNPWeekData() for use with other days of the week.
 * @param {Date} inDate
 * @returns {string}
 */
export function getNPWeekStr(inDate: Date): string {
  // Using 'moment' library, with Monday first day of week
  const dateMoment = moment(inDate)
  return dateMoment.format(MOMENT_FORMAT_NP_WEEK)
}

/**
 * @param {Date} inDate
 * @returns {string}
 */
export function getNPMonthStr(inDate: Date): string {
  // Using 'moment' library instead of NP calls
  const dateMoment = moment(inDate)
  return dateMoment.format(MOMENT_FORMAT_NP_MONTH)
}

/**
 * @param {Date} inDate
 * @returns {string}
 */
export function getNPQuarterStr(inDate: Date): string {
  // Using 'moment' library instead of NP calls
  const dateMoment = moment(inDate)
  return dateMoment.format(MOMENT_FORMAT_NP_QUARTER)
}

/**
 * @param {Date} inDate
 * @returns {string}
 */
export function getNPYearStr(inDate: Date): string {
  // Using 'moment' library instead of NP calls
  const dateMoment = moment(inDate)
  return dateMoment.format(MOMENT_FORMAT_NP_YEAR)
}

/**
 * Return start and end dates for a given week number.
 * Note: Uses ISO 8601 definition of week, so may differ from NP week definitions, depending which first day of the week the user has.
 * V2 now uses Moment library
 * @author @jgclark
 *
 * @param {number} week - week number in year (1-53)
 * @param {number} year - year (4-digits)
 * @return {[Date, Date]}} - start and end dates (as JS Dates)
 * @test - defined in Jest, but won't work until Calendar.addUnitToDate can be stubbed out
 */
export function isoWeekStartEndDates(week: number, year: number): [Date, Date] {
  if (week > 53 || week < 1) {
    logWarn('helpers/isoWeekStartEndDates', `Invalid week number ${week} given, but will still calculate correctly, relative to year ${year}.`)
  }

  // the .milliseconds in the following shouldn't really be needed, but it seems to
  const startDate = moment().year(year).isoWeeks(week).startOf('isoWeek').milliseconds(0).toDate()
  const endDate = moment().year(year).isoWeeks(week).endOf('isoWeek').milliseconds(0).toDate()
  return [startDate, endDate]
}

/**
 * Return start YYYYMMDD date for a given YYYY-Wnn week number.
 * @author @jgclark
 *
 * @param {string} inStr (format YYYY-Wnn)
 * @returns {string} YYYYMMDD
 * @tests in Jest file
 */
export function weekStartDateStr(inStr: string): string {
  try {
    if (inStr.match(RE_NP_WEEK_SPEC)) {
      const parts = inStr.split('-W') // Split YYYY-Wnn string into parts
      const year = Number(parts[0])
      const week = Number(parts[1])
      const m = moment().year(year).isoWeeks(week).startOf('isoWeek')
      return m.format('YYYYMMDD')
    } else {
      throw new Error(`Invalid date ${inStr}`)
    }
  } catch (err) {
    logError('dateTime / weekStartDateStr', err.message)
    return '(error)'
  }
}

/**
 * From the current week number/year pair calculate a different week number/year pair by adding a given week range (which can be negative)
 * NOTE: we have to be careful about assumptions at end of year:
 *   for example 2022-01-01 is in week 52 of 2021.
 * A year goes into 53 weeks if 1 January is on a Thursday on a non-leap year,
 * or on a Wednesday or a Thursday on a leap year.
 * @author @jgclark
 *
 * @param {integer} endWeek
 * @param {integer} endYear
 * @param {integer} offset
 * @returns {{number, number}}
 * @test - available in jest file
 */
export function calcWeekOffset(startWeek: number, startYear: number, offset: number): { week: number, year: number } {
  let year: number = startYear
  let week: number = startWeek + offset
  // Add the offset, coping with offsets greater than 1 year
  while (week < 1) {
    week += 52
    year -= 1
  }
  while (week > 52) {
    week -= 52
    year += 1
  }
  // logDebug('dateTime / calcWeekOffset', `${startYear}W${startWeek} - ${year}W${week}`)
  return { week, year }
}

/**
 * Method: take the Quarter date and divide by 2.
 * So: H11->Q1, H2->Q3.
 * Note: Written as moment library doesn't support half-years
 * @param {string} inDateStr 
 * @returns {string}
 */
export function convertHalfYearDateToQuarterDate(inDateStr: string): string {
  let outDateStr = ''
  if (inDateStr.endsWith('H1')) {
    outDateStr = inDateStr.slice(0, inDateStr.length - 3) + '-Q1'
  } else if (inDateStr.endsWith('H2')) {
    outDateStr = inDateStr.slice(0, inDateStr.length - 3) + '-Q3'
  } else {
    logError('dateTime / convertHalfYearDateToQuarterDate', `'${inDateStr}' is not a valid HalfYear date`)
    return '(error)'
  }
  logDebug('dateTime / convertHalfYearDateToQuarterDate', `converted ${inDateStr} -> ${outDateStr}`)
  return outDateStr
}

/**
 * Method: take the Quarter date and divide by 2.
 * So: Q1->H1, Q2->H1, Q3->H2, Q4->H2.
 * Note: Written as moment library doesn't support half-years
 * @param {string} inDateStr 
 * @returns {string}
 */
export function convertQuarterDateToHalfYearDate(inDateStr: string): string {
  let outDateStr = ''
  if (inDateStr.endsWith('-Q1') || inDateStr.endsWith('-Q2')) {
    outDateStr = inDateStr.slice(0, inDateStr.length - 3) + 'H1'
  } else if (inDateStr.endsWith('-Q3') || inDateStr.endsWith('-Q4')) {
    outDateStr = inDateStr.slice(0, inDateStr.length - 3) + 'H2'
  } else {
    logError('dateTime / convertQuarterDateToHalfYearDate', `'${inDateStr}' is not a valid Quarter date`)
    return '(error)'
  }
  logDebug('dateTime / convertQuarterDateToHalfYearDate', `converted ${inDateStr} -> ${outDateStr}`)
  return outDateStr
}

/**
 * Get start/end ISO dates for a given Half-Year date string (YYYY-H[1|2])
 * Note: Written as moment library doesn't support half-years.
 * @tests done manually by JGC
 * @param {string} inDateStr 
 * @returns {[string, string]}
 */
export function getHalfYearRangeDate(inDateStr: string): [string, string] {
  logDebug('dateTime / getHalfYearRangeDate', `Starting for ${inDateStr}`)
  let startDateStr = ''
  let endDateStr = ''
  const year = Number(inDateStr.slice(0, 4))
  if (isNaN(year)) {
    logError('dateTime / getHalfYearRangeDate', `Invalid year in ${inDateStr}`)
    return ['(error)', '(error)']
  }
  if (inDateStr.endsWith('H1')) {
    startDateStr = `${year}-01-01`
    endDateStr = `${year}-06-30`
  } else if (inDateStr.endsWith('H2')) {
    startDateStr = `${year}-07-01`
    endDateStr = `${year}-12-31`
  } else {
    logError('dateTime / getHalfYearRangeDate', `'${inDateStr}' is not a valid Halfyear date`)
    return ['(error)', '(error)']
  }
  logDebug('dateTime / getHalfYearRangeDate', `-> [${startDateStr}, ${endDateStr}]`)
  return [startDateStr, endDateStr]
}

/**
 * Get moment format unit [bdwMQy] equivalent to my offset unit [bdwmqy]
 * @param {string} unit
 * @returns {string} momentUnitFormat
 */
function convertOffsetUnitToMomentUnit(unit: string): string {
  let unitForMoment = ''
  switch (unit) {
    case 'm':
      unitForMoment = 'M'
      break
    case 'q':
      unitForMoment = 'Q'
      break
    case 'h':
      unitForMoment = 'y' // Note: this isn't fully accurate, and needs to be corrected for later.
      break
    default:
      unitForMoment = unit
      break
  }
  return unitForMoment
}

/**
 * Get moment date format for calendar note filenames for offset unit [bdwmqy]
 * @param {string} unit
 * @returns {string} momentDateFormat
 */
export function getNPDateFormatForFilenameFromOffsetUnit(unit: string): string {
  const momentDateFormat =
    unit === 'd' || unit === 'b'
      ? MOMENT_FORMAT_NP_DAY // = YYYYMMDD not display format
      : unit === 'w'
        ? MOMENT_FORMAT_NP_WEEK
        : unit === 'm'
          ? MOMENT_FORMAT_NP_MONTH
          : unit === 'q'
            ? MOMENT_FORMAT_NP_QUARTER
            : unit === 'y'
              ? MOMENT_FORMAT_NP_WEEK
              : ''
  return momentDateFormat
}

/**
 * Get moment date format for calendar note filenames for offset unit [bdwmqy]
 * @param {string} unit
 * @returns {string} momentDateFormat
 * @test - available through calcOffsetDateStrUsingCalendarType() jest tests
 */
function getNPDateFormatForDisplayFromOffsetUnit(unit: string): string {
  const momentDateFormat =
    unit === 'd' || unit === 'b'
      ? MOMENT_FORMAT_NP_ISO // = YYYY-MM-DD not filename format
      : unit === 'w'
        ? MOMENT_FORMAT_NP_WEEK
        : unit === 'm'
          ? MOMENT_FORMAT_NP_MONTH
          : unit === 'q'
            ? MOMENT_FORMAT_NP_QUARTER
            : unit === 'y'
              ? MOMENT_FORMAT_NP_YEAR
              : ''
  return momentDateFormat
}

/**
 * Get the period of a given NP date string
 * @param {string} dateStr
 * @returns {string} period: 'day', 'week', 'month', 'quarter', 'year'
 */
export function getPeriodOfNPDateStr(dateStr: string): string {
  try {
    if (dateStr.match(RE_ISO_DATE) || dateStr.match(RE_YYYYMMDD_DATE)) {
      return 'day'
    } else if (dateStr.match(RE_NP_WEEK_SPEC)) {
      return 'week'
    } else if (dateStr.match(RE_NP_MONTH_SPEC)) {
      return 'month'
    } else if (dateStr.match(RE_NP_QUARTER_SPEC)) {
      return 'quarter'
    } else if (dateStr.match(RE_NP_YEAR_SPEC)) {
      return 'year'
    } else {
      throw new Error(`Invalid date string: ${dateStr}`)
    }
  } catch (err) {
    logError('dateTime / getPeriodOfNPDateStr', err.message)
    return '(error)'
  }
}

/**
 * Calculate an offset date of a NP Daily/Weekly/Monthly/Quarterly/Yearly date string, and return as a JS Date.
 * v5 method, using 'moment' library to avoid using NP calls, now extended to allow for strings as well. Docs: https://momentjs.com/docs/#/get-set/
 * @author @jgclark
 *
 * @param {string} baseDateStrIn is type ISO Date (i.e. YYYY-MM-DD), NP's filename format YYYYMMDD, or NP Weekly/Monthly/Quarterly/Yearly date strings, or (for @jgc) Half-Years (i.e. YYYYHn).
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @returns {Date} new date
 * @test - available in jest file
 */
export function calcOffsetDate(baseDateStrIn: string, interval: string): Date | null {
  try {
    if (!interval.match(RE_DATE_INTERVAL)) {
      logError('dateTime / cOD', `Invalid date interval '${interval}'`)
      return null
    }
    let unit = interval.charAt(interval.length - 1) // get last character
    let num = Number(interval.substr(0, interval.length - 1)) // return all but last character
    // Note: splitIntervalToParts(interval) has a different output!

    // Note: Annoyingly, Moment doesn't cope with half-years, so we need to convert to quarters and back again TODO: finish this here and in calcOffsetDateStr()
    if (unit === 'h') {
      unit = 'q'
      num = Math.floor(num * 2)
      logDebug('dateTime / cOD', `special case: converted half-year interval ${interval} -> ${num} / ${unit}`)
    }

    // Note: the short codes in moment library aren't quite the same as mine
    const unitForMoment = convertOffsetUnitToMomentUnit(unit)

    let momentDateFormat = ''
    let baseDateStr = baseDateStrIn
    if (baseDateStrIn.match(RE_ISO_DATE)) {
      momentDateFormat = 'YYYY-MM-DD'
    } else if (baseDateStrIn.match(RE_YYYYMMDD_DATE)) {
      momentDateFormat = MOMENT_FORMAT_NP_DAY
    } else if (baseDateStrIn.match(RE_NP_WEEK_SPEC)) {
      momentDateFormat = MOMENT_FORMAT_NP_WEEK
    } else if (baseDateStrIn.match(RE_NP_MONTH_SPEC)) {
      // NB: test has to go after ISO check
      momentDateFormat = MOMENT_FORMAT_NP_MONTH
    } else if (baseDateStrIn.match(RE_NP_QUARTER_SPEC)) {
      momentDateFormat = MOMENT_FORMAT_NP_QUARTER
    } else if (baseDateStrIn.match(RE_NP_HALFYEAR_SPEC)) {
      momentDateFormat = MOMENT_FORMAT_NP_QUARTER
      const h = parseInt(baseDateStrIn.charAt(baseDateStrIn.length - 1))
      const q = Math.floor(h * 2)
      baseDateStr = baseDateStrIn.slice(0, 4) + '-Q' + String(q)
      logDebug('dateTime / cOD', `special case: baseDatrStrIn ${baseDateStrIn} converted -> ${baseDateStr}`)
    } else if (baseDateStrIn.match(RE_NP_YEAR_SPEC)) {
      // NB: test has to go at end as it will match all longer formats
      momentDateFormat = MOMENT_FORMAT_NP_YEAR
    } else {
      throw new Error('Invalid date string')
    }

    // calc offset (Note: library functions cope with negative nums, so just always use 'add' function)
    const baseDateMoment = moment(baseDateStr, momentDateFormat)
    const newDate = unit !== 'b' ? baseDateMoment.add(num, unitForMoment) : momentBusiness(baseDateMoment).businessAdd(num).toDate()

    // logDebug('dateTime / cOD', `for '${baseDateStr}' interval ${num} / ${unitForMoment} -> ${String(newDate)}`)
    return newDate
  } catch (e) {
    logError('dateTime / cOD', `${e.message} for '${baseDateStrIn}' interval '${interval}'`)
    return null
  }
}

/**
 * Split an interval (e.g. '-3m') into number (e.g. -3) and type ('month') parts
 * If interval arrives with {...} around the terms, remove them first
 * @param {string} intervalStr (e.g. '-3m' or '{-3m}')
 * @returns {{number, string}} parts of interval
 * @tests in jest file
 */
export function splitIntervalToParts(intervalStr: string): { number: number, type: string } {
  const interval = intervalStr.replace(/[{}]/g, '')
  const intervalNumber = Number(interval.slice(0, interval.length - 1))
  const intervalChar = interval.charAt(interval.length - 1)
  const intervalType =
    intervalChar === 'd' ? 'day'
      : intervalChar === 'w' ? 'week'
        : intervalChar === 'm' ? 'month'
          : intervalChar === 'q' ? 'quarter'
            : intervalChar === 'h' ? 'half-year'
              : intervalChar === 'y' ? 'year'
                : 'error'
  const intervalParts = { number: intervalNumber, type: intervalType }
  return intervalParts
}

/**
 * Calculate an offset date of any date interval NP supports, and return _in whichever format was supplied_.
 * v5 method, using 'moment' library to avoid using NP calls, now extended to allow for Weekly, Monthly etc. strings as well.
 * WARNING: don't use when you want the output to be in week format, as the moment library doesn't understand different start-of-weeks. Use NPdateTime::getNPWeekData() instead.
 * Moment docs: https://momentjs.com/docs/#/get-set/
 * - 'baseDateIn' the base date as a string in any of the formats that NP supports: YYYY-MM-DD, YYYYMMDD (filename format), YYYY-Wnn, YYYY-MM, YYYY-Qn, YYYY (plus 'half-year' YYYY-Hn)
 * - 'offsetInterval' of form +nn[bdwmqhy] or -nn[bdwmqhy], where 'b' is weekday (i.e. Monday - Friday in Europe and Americas)
 * - 'adaptOutputInterval' (optional). Options: 'shorter', 'longer', 'offset', 'base', 'day', 'week', 'month', 'quarter', 'year'
 * TODO: finish adding half-year support
 * @author @jgclark
 * @param {string} baseDateIn the base date as a string in any of the formats that NP supports: YYYY-MM-DD, YYYYMMDD (filename format), YYYY-Wnn, YYYY-MM, YYYY-Qn, YYYY, plus YYYYHn for @jgc
 * @param {string} offsetInterval of form +nn[bdwmqhy] or -nn[bdwmqhy], where 'b' is weekday (i.e. Monday - Friday in Europe and Americas), and 'h' is @jgc addition for half-year
 * @param {string?} adaptOutputInterval. Options: 'shorter', 'longer', 'offset', 'base', 'day', 'week', 'month', 'quarter', 'year'
 * - 'shorter': keep the shorter of the two calendar types. E.g. a daily date + 1w -> daily date. Or '2023-07' + '2w' -> '2023-W28'.
 * - 'longer': use the longer of the two calendar types. E.g. a daily date + 1w -> weekly date.
 * - 'offset': keep type of the offsetInterval.
 * - 'base': (default)  keep the type of the base date.
 * - 'day', 'week', 'month', 'quarter', 'year': lock to that calendar type.
 * @returns {string} new date in the requested format
 * @tests - available in jest file (though not for the most recent adaptOutputInterval options).
 */
export function calcOffsetDateStr(baseDateIn: string, offsetInterval: string, adaptOutputInterval: string = 'base'): string {
  try {
    if (baseDateIn === '') {
      throw new Error('Empty baseDateIn string')
    }
    if (offsetInterval === '') {
      throw new Error('Empty offsetInterval string')
    }
    const offsetUnit = offsetInterval.charAt(offsetInterval.length - 1) // get last character
    logDebug('dateTime / cODS', `Starting with adapt type '${adaptOutputInterval}' for ${baseDateIn} + ${offsetInterval}`)

    // Decide how to format the new date.
    // Start with using baseDateIn's format
    const calendarTypeOrder = 'dbwmqhy'
    let newDateStr = ''
    let baseDateMomentFormat = ''
    let baseDateUnit = ''
    let baseDate = baseDateIn
    if (baseDateIn.match(RE_ISO_DATE)) {
      baseDateMomentFormat = MOMENT_FORMAT_NP_ISO
      baseDateUnit = 'd'
    } else if (baseDateIn.match(RE_YYYYMMDD_DATE)) {
      baseDateMomentFormat = MOMENT_FORMAT_NP_DAY
      baseDateUnit = 'd'
    } else if (baseDateIn.match(RE_NP_WEEK_SPEC)) {
      baseDateMomentFormat = MOMENT_FORMAT_NP_WEEK
      baseDateUnit = 'w'
    } else if (baseDateIn.match(RE_NP_MONTH_SPEC)) {
      // NB: test has to go after ISO check
      baseDateMomentFormat = MOMENT_FORMAT_NP_MONTH
      baseDateUnit = 'm'
    } else if (baseDateIn.match(RE_NP_QUARTER_SPEC)) {
      baseDateMomentFormat = MOMENT_FORMAT_NP_QUARTER
      baseDateUnit = 'q'
    } else if (baseDateIn.match(RE_NP_HALFYEAR_SPEC)) {
      baseDateMomentFormat = MOMENT_FORMAT_NP_QUARTER // Note: this is a workaround as Moment won't support half-years
      baseDate = convertHalfYearDateToQuarterDate(baseDateIn)
      baseDateUnit = 'h'
    } else if (baseDateIn.match(RE_NP_YEAR_SPEC)) {
      // NB: test has to go at end as it will match all longer formats
      baseDateMomentFormat = MOMENT_FORMAT_NP_YEAR
      baseDateUnit = 'y'
    } else {
      throw new Error('Invalid date string')
    }

    // calc offset date
    // (Note: library functions cope with negative nums, so just always use 'add' function)
    const offsetDate = calcOffsetDate(baseDate, offsetInterval)
    if (!offsetDate) {
      throw new Error('Invalid return from calcOffsetDate()')
    }

    const newDateStrFromBaseDateType = moment(offsetDate).format(baseDateMomentFormat)
    newDateStr = newDateStrFromBaseDateType

    // // Deal with special half-year case: take the Quarter number and divide by 2
    // if (baseDateUnit === 'h') {
    //   newDateStr = convertQuarterDateToHalfYearDate(newDateStr)
    // }

    // Also calculate offset's output format
    const offsetMomentFormat = (offsetUnit === 'd') && baseDate.match(RE_YYYYMMDD_DATE)
      ? MOMENT_FORMAT_NP_DAY
      : getNPDateFormatForDisplayFromOffsetUnit(offsetUnit)
    const newDateStrFromOffsetDateType = moment(offsetDate).format(offsetMomentFormat)

    if (offsetUnit === 'w') {
      logInfo(
        'dateTime / cODS',
        `- This output will only be accurate if your week start is a Monday. More details in DEBUG-level log.`,
      )
      logDebug(
        'dateTime / cODS',
        `  Details: ${adaptOutputInterval} adapt for ${baseDate} / ${baseDateUnit} / ${baseDateMomentFormat} / ${offsetMomentFormat} / ${offsetInterval} / ${newDateStrFromOffsetDateType}`,
      )
    }

    // adapt the output format if required
    switch (adaptOutputInterval) {
      case 'offset': {
        newDateStr = newDateStrFromOffsetDateType
        logDebug('dateTime / cODS', `- 'offset' output: -> ${newDateStrFromOffsetDateType}`)
        // Note: As Moment doesn't cope with half-years, we need to convert back from quarters FIXME: full date-string, not NP-style here
        if (offsetUnit === 'h') {
          newDateStr = convertQuarterDateToHalfYearDate(newDateStr)
        }
        break
      }
      case 'shorter': {
        if (calendarTypeOrder.indexOf(offsetUnit) < calendarTypeOrder.indexOf(baseDateUnit)) {
          newDateStr = newDateStrFromOffsetDateType
          logDebug('dateTime / cODS', `- 'shorter' output: changed format to ${offsetMomentFormat}`)
        }
        break
      }
      case 'longer': {
        if (calendarTypeOrder.indexOf(offsetUnit) > calendarTypeOrder.indexOf(baseDateUnit)) {
          newDateStr = newDateStrFromOffsetDateType
          logDebug('dateTime / cODS', `- 'longer' output: changed format to ${offsetMomentFormat}`)
        } else {
          logDebug('dateTime / cODS', `- 'longer' output: NO change to format`)
        }
        break
      }
      case 'day': {
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('d')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'day' output: changed format to ${offsetMomentFormat}`)
        break
      }
      case 'week': {
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('w')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'week' output: changed format to ${offsetMomentFormat}`)
        break
      }
      case 'month': {
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('m')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'month' output: changed format to ${offsetMomentFormat}`)
        break
      }
      case 'quarter': {
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('q')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'quarter' output: changed format to ${offsetMomentFormat}`)
        break
      }
      case 'halfyear': {
        // Note the workaround of keeping as quarters
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('q')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'halfyear' output: temporarily changed format to ${offsetMomentFormat}`)
        break
      }
      case 'year': {
        const offsetMomentFormat = getNPDateFormatForDisplayFromOffsetUnit('y')
        newDateStr = moment(offsetDate).format(offsetMomentFormat)
        logDebug('dateTime / cODS', `- 'year' output: changed format to ${offsetMomentFormat}`)
        break
      }
      default: {
        // i.e. 'base'
        newDateStr = newDateStrFromBaseDateType
        break
      }
    }

    // Finally, deal with special half-year case: take the Quarter number and divide by 2
    // FIXME: not always being applied
    if (baseDateUnit === 'h') {
      newDateStr = convertQuarterDateToHalfYearDate(newDateStr)
    }

    // logDebug('dateTime / cODS', `for '${baseDateIn}' date, offsetInterval ${offsetInterval} using type ${adaptOutputInterval} -> '${newDateStr}'`)
    return newDateStr
  } catch (e) {
    logError('dateTime / cODS', `${e.message} for '${baseDateIn}' date, offsetInterval '${offsetInterval}'`)
    return '(error)'
  }
}

/**
 * Calculate an offset date of a NP daily date (ISO format YYYY-MM-DD), and return _in whichever of the NotePlan date string formats were supplied in 'offsetInterval' (YYYY-MM-DD / YYYY-Wnn / YYYY-MM / YYYY-Qn / YYYY)_.
 * If the date to offset isn't supplied, today's date will be used.
 * (Uses 'moment' library to avoid using NP calls. Docs: https://momentjs.com/docs/#/get-set/)
 * @author @jgclark
 * @param {string} offsetInterval of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @param {string?} baseISODateStr is type ISO Date (i.e. YYYY-MM-DD) - NB: not JavaScript's Date type. If not given then today's date is used.
 * @returns {string} new date in the same format that was supplied
 * @test - available in jest file
 */
export function calcOffsetDateStrUsingCalendarType(offsetInterval: string, baseISODateStr: string = ''): string {
  try {
    // Check offsetInterval is valid
    if (offsetInterval === '') {
      throw new Error('Empty offsetInterval string')
    }
    if (!offsetInterval.match(RE_DATE_INTERVAL)) {
      throw new Error(`Invalid date offsetInterval '${offsetInterval}'`)
    }
    const unit = offsetInterval.charAt(offsetInterval.length - 1) // get last character

    // Check baseISODateStr is valid
    if (baseISODateStr !== '' && !baseISODateStr.match(RE_ISO_DATE)) {
      throw new Error(`Invalid ISO input date '${baseISODateStr}'`)
    }
    // If no baseISODateStr, use today's date
    const baseDateISO = baseISODateStr !== '' ? baseISODateStr : new moment().startOf('day').format('YYYY-MM-DD')

    // calc offset (Note: library functions cope with negative nums, so just always use 'add' function)
    const offsetDate = calcOffsetDate(baseDateISO, offsetInterval)
    if (!offsetDate) {
      throw new Error('Invalid return from calcOffsetDate()')
    }
    // Use the offsetInterval's unit to also set the output format
    const momentDateFormat = getNPDateFormatForDisplayFromOffsetUnit(unit)
    if (momentDateFormat === '') {
      throw new Error('Invalid date offsetInterval')
    }

    const newDateStr = moment(offsetDate).format(momentDateFormat)
    // logDebug('dateTime / cODSUCT', `for '${offsetInterval}'  (unit=${unit}) from ${baseDateISO}' -> ${newDateStr} using type ${momentDateFormat}`)
    return newDateStr
  } catch (e) {
    logError('dateTime / cODSUCT', `${e.message} for '${baseISODateStr}' offsetInterval '${offsetInterval}'`)
    return '(error)'
  }
}

/**
 * Does this line include a scheduled date in the future?
 * (Should work even with >date in brackets or with non-white-space before it.)
 * Works for future-scheduled daily, weekly, monthly, quarterly and yearly dates.
 * @author @jgclark
 *
 * @param {string} line to search in
 * @param {string?} fromDateStr - optional date to compare against (defaults to today's date) -- format 8601 (YYYY-MM-DD)
 * @return {boolean}
 * @test - available in jest file
 */
export function includesScheduledFutureDate(line: string, fromDateStr?: string): boolean {
  // Test for days
  let m = line.match(RE_SCHEDULED_ISO_DATE) ?? []
  if (m.length > 0) {
    const ISODateFromMatch = m[0].slice(1) // need to remove leading '>'
    // logDebug(`includesScheduledFutureDate / ISODateFromMatch > todaysDateISOString : ${ISODateFromMatch} > ${todaysDateISOString}`)
    return ISODateFromMatch > (fromDateStr ?? todaysDateISOString)
  }
  // Test for weeks
  m = line.match(RE_SCHEDULED_WEEK_NOTE_LINK) ?? []
  if (m.length > 0) {
    const weekDateFromMatch = m[0].slice(1) // need to remove leading '>'
    return weekDateFromMatch > getNPWeekStr(fromDateStr ? new Date(fromDateStr) : new Date())
  }
  // Test for months
  m = line.match(RE_SCHEDULED_MONTH_NOTE_LINK) ?? []
  if (m.length > 0) {
    const monthDateFromMatch = m[0].slice(1) // need to remove leading '>'
    return monthDateFromMatch > getNPMonthStr(fromDateStr ? new Date(fromDateStr) : new Date())
  }
  // Test for quarters
  m = line.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK) ?? []
  if (m.length > 0) {
    const quarterDateFromMatch = m[0].slice(1) // need to remove leading '>'
    return quarterDateFromMatch > getNPQuarterStr(fromDateStr ? new Date(fromDateStr) : new Date())
  }
  // Test for years
  m = line.match(RE_SCHEDULED_YEARLY_NOTE_LINK) ?? []
  if (m.length > 0) {
    const yearDateFromMatch = m[0].slice(1) // need to remove leading '>'
    return yearDateFromMatch > getNPYearStr(fromDateStr ? new Date(fromDateStr) : new Date())
  }
  return false
}

/**
 * Does this line include a scheduled date more than or equal to 'futureStartsInDays' days into the future?
 * (Should work even with >date in brackets or with non-white-space before it.)
 * Only works on lines with scheduled dates (>YYYY-MM-DD).
 * Tested manually.
 * @author @jgclark
 *
 * @param {string} line to search in
 * @param {number} futureStartsInDays - number of days into the future to regard as being 'the future'. If set to 0, then no future items are ignored.
 * @return {boolean}
 */
export function includesScheduledFurtherFutureDate(line: string, futureStartsInDays: number): boolean {
  if (futureStartsInDays < 0) {
    return false
  }
  // Test for days
  const m = line.match(RE_SCHEDULED_ISO_DATE) ?? []
  if (m.length > 0) {
    const futureMoment = moment().add(futureStartsInDays, 'days')
    const futureMomentStr = futureMoment.format('YYYY-MM-DD')
    const ISODateFromMatch = m[0].slice(1) // need to remove leading '>'
    // logDebug(`includesScheduledFurtherFutureDate`, `match: ${ISODateFromMatch} >= futureStart:${futureMomentStr} = ${String(ISODateFromMatch >= futureMomentStr)}`)
    return ISODateFromMatch >= futureMomentStr
  }
  return false
}

/**
 * Checks if the given filename is in a future note.
 *
 * @param {string} filename - The filename to check.
 * @param {string} [fromYYYYMMDDDateStringFromDate=getTodaysDateUnhyphenated()] - The date to compare against, in unhyphenated format (YYYYMMDD).
 * @returns {boolean} - Returns true if the filename is scheduled in a future note.
 */
export function filenameIsInFuture(filename: string, fromYYYYMMDDDateStringFromDate: string = getTodaysDateUnhyphenated()): boolean {
  const today = new Date(
    parseInt(fromYYYYMMDDDateStringFromDate.slice(0, 4)), parseInt(fromYYYYMMDDDateStringFromDate.slice(4, 6), 10) - 1, parseInt(fromYYYYMMDDDateStringFromDate.slice(6, 8), 10)
  )

  // Test for daily notes
  if (filename.match(RE_DAILY_NOTE_FILENAME)) {
    const dateMatch = filename.match(RE_DAILY_NOTE_FILENAME)
    if (dateMatch) {
      const dailyDate = dateMatch[0].match(/\d{8}/)?.[0] ?? ''
      return dailyDate > fromYYYYMMDDDateStringFromDate
    }
  }

  // Test for weekly notes
  if (filename.match(RE_WEEKLY_NOTE_FILENAME)) {
    const weekDateMatch = filename.match(RE_WEEKLY_NOTE_FILENAME)
    if (weekDateMatch) {
      const weeklyDate = weekDateMatch[0].match(/\d{4}-W\d{2}/)?.[0] ?? ''
      return weeklyDate > getNPWeekStr(today)
    }
  }

  // Test for monthly notes
  if (filename.match(RE_MONTHLY_NOTE_FILENAME)) {
    const monthDateMatch = filename.match(RE_MONTHLY_NOTE_FILENAME)
    if (monthDateMatch) {
      const monthlyDate = monthDateMatch[0].match(/\d{4}-\d{2}/)?.[0] ?? ''
      return monthlyDate > getNPMonthStr(today)
    }
  }

  // Test for quarterly notes
  if (filename.match(RE_QUARTERLY_NOTE_FILENAME)) {
    const quarterDateMatch = filename.match(RE_QUARTERLY_NOTE_FILENAME)
    if (quarterDateMatch) {
      const quarterlyDate = quarterDateMatch[0].match(/\d{4}-Q\d/)?.[0] ?? ''
      return quarterlyDate > getNPQuarterStr(today)
    }
  }

  // Test for yearly notes
  if (filename.match(RE_YEARLY_NOTE_FILENAME)) {
    const yearDateMatch = filename.match(RE_YEARLY_NOTE_FILENAME)
    if (yearDateMatch) {
      const yearlyDate = yearDateMatch[0].match(/\d{4}/)?.[0] ?? ''
      return yearlyDate > getNPYearStr(today)
    }
  }

  return false
}

/**
 * WARNING: DO NOT USE THESE FOR NOTEPLAN WEEK CALCULATIONS BECAUSE NOTEPLAN DOES NOT ACTUALLY USE ISO WEEKS (IT'S OFFSET DUE TO USER PREFS START-WEEK-ON)
 * Get the week number string for a given date string or Date object.
 * @param {string} date - date string in format YYYY-MM-DD OR a Date object
 * @param {number} offsetIncrement - number of days|weeks|month to add (or negative=subtract) to date (default: 0)
 * @param {string} offsetType - 'day'|'week'|'month'|'year' (default: 'week')
 * @returns {string} - week number string in format 'YYYY-Www'
 * @author @dwertheimer
 * @test - available in jest file
 */
export function getISOWeekString(date: string | Date, offsetIncrement: number = 0, offsetType: string = 'week'): string {
  const theDate = typeof date === 'string' ? date : hyphenatedDate(date)
  const newMom = moment(theDate, 'YYYY-MM-DD').add(offsetIncrement, offsetType)
  return newMom.format('GGGG-[W]WW')
}

/**
 * WARNING: DO NOT USE THESE FOR NOTEPLAN WEEK CALCULATIONS BECAUSE NOTEPLAN DOES NOT ACTUALLY USE ISO WEEKS (IT'S OFFSET DUE TO USER PREFS START-WEEK-ON)
 * Get the year and week number for a given date string or Date object
 * @param {string} date - date string in format YYYY-MM-DD OR a Date object
 * @param {number} offsetIncrement - number of days|weeks|month to add (or negative=subtract) to date (default: 0)
 * @param {string} offsetType - 'day'|'week'|'month'|'year' (default: 'week')
 * @returns { {year: number, week: number} } - year and week number
 * @author @dwertheimer
 * @test - available in jest file
 */
export function getISOWeekAndYear(date: string | Date, offsetIncrement: number = 0, offsetType: string = 'week'): { week: number, year: number } {
  const theDate = typeof date === 'string' ? date : hyphenatedDate(date)
  const newMom = moment(theDate, 'YYYY-MM-DD').add(offsetIncrement, offsetType)
  return { year: Number(newMom.format('GGGG')), week: Number(newMom.format('WW')) }
}

/**
 * Determine if a parseDateText return object is meant to be an all-day calendar item
 * For using with DataStore.parseDateText() results
 * Chrono returns 12:00 (midday) for any day you give it without a time,
 * (e.g. "Jan 19" comes back with a date of Jan 19 at 12:00:00 GMT)
 * so we need to disambiguate noon-ish text which will look the same in
 * parseDateText()'s return. For example:
 *   - on Friday
 *   - on Friday at 12
 * (two very different things which will look the same in parseDateText's return)
 * Here will assume that this is an all-day thing
 * unless we have a noon or something like midday or "@ 12"
 * @example usage:
 * if (!isAllDay(range) && range.start === range.end) {
    // if it's not an all day event, and the start and end are the same, then it's probably "at 12" or something, so we add time to the end to make it an event
    range.end = addMinutes(range.start, config.eventLength || '30')
  }
 * @param {DateRange} parseDateReturnObj - one DateRange object returned by parseDateText()
  @return {boolean} true if this is likely meant to be an all day event; false if it was probably an "at noon" event
 */
export const isReallyAllDay = (parseDateReturnObj: any): boolean => {
  return (
    parseDateReturnObj.start.getMinutes() === 0 &&
    parseDateReturnObj.start.getHours() === 12 &&
    parseDateReturnObj.end.getMinutes() === 0 &&
    parseDateReturnObj.end.getHours() === 12 &&
    !/noon|at 12|@12|@ 12|midday/.test(parseDateReturnObj.text)
  )
}

/**
 * Validate if a string could be used to pull up any calendar note (of all NP allowed calendar note durations)
 * Note: This is just a regex test: it doesn't test if such a note actually exists.
 * @param {string} text
 * @returns {boolean} whether it passes the @jgclark RegEx texts for day (note YYY-MM-DD not YYYYMMDD), week, month, quarter or year.
 */
export function isValidCalendarNoteTitleStr(text: string): boolean {
  const combinedRE = new RegExp(`^(${RE_ISO_DATE}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC})$`)
  return combinedRE.test(text)
}

/**
 * Validate if a filename could be used to pull up any calendar note (of all NP allowed calendar note durations)
 * Note: This is just a regex test: it doesn't test if such a note actually exists.
 * @param {string} text
 * @returns {boolean} whether it passes the @jgclark RegEx texts for day (note YYYYMMDD not ISO), week, month, quarter or year.
 */
export function isValidCalendarNoteFilename(text: string): boolean {
  const combinedRE = new RegExp(`^(${RE_NP_DAY_SPEC}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC})\.(md|txt)$`)
  return combinedRE.test(text)
}

/**
 * Validate if a filename could be used to pull up any calendar note (of all NP allowed calendar note durations)
 * Note: This is just a regex test: it doesn't test if such a note actually exists.
 * @param {string} text
 * @returns {boolean} whether it passes the @jgclark RegEx texts for day (note YYYYMMDD not ISO), week, month, quarter or year.
 */
export function isValidCalendarNoteFilenameWithoutExtension(text: string): boolean {
  const combinedRE = new RegExp(`^(${RE_NP_DAY_SPEC}|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC})$`)
  return combinedRE.test(text)
}

/**
 * Given a number of seconds, send back a human-readable version (e.g. 1 year 2 months 3 seconds)
 * @author @dwertheimer
 * @param {number} seconds
 * @returns {string} formatted string
 */
export function TimeFormatted(seconds: number): string {
  const y = Math.floor(seconds / 31536000)
  const mo = Math.floor((seconds % 31536000) / 2628000)
  const d = Math.floor(((seconds % 31536000) % 2628000) / 86400)
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const yDisplay = y > 0 ? y + (y === 1 ? ' year, ' : ' years, ') : ''
  const moDisplay = mo > 0 ? mo + (mo === 1 ? ' month, ' : ' months, ') : ''
  const dDisplay = d > 0 ? d + (d === 1 ? ' day, ' : ' days, ') : ''
  const hDisplay = h > 0 ? h + (h === 1 ? ' hour, ' : ' hours, ') : ''
  const mDisplay = m > 0 ? m + (m === 1 ? ' minute ' : ' minutes, ') : ''
  const sDisplay = s > 0 ? s + (s === 1 ? ' second' : ' seconds ') : ''
  return yDisplay + moDisplay + dDisplay + hDisplay + mDisplay + sDisplay
}

/**
 * Get upcoming date string options for use in chooseOption
 * Note: there is a weeks version of this in ./NPdateTime (relies on Calendar)
 * uses date-fns:
 * - formats: https://date-fns.org/v2.29.2/docs/format
 * - add:https://date-fns.org/v2.29.2/docs/add
 * @author: @dwertheimer
 */
export function getDateOptions(): $ReadOnlyArray<{ label: string, value: string }> {
  // const result = formatISO(new Date(2019, 8, 18, 19, 0, 52), { representation: 'date' })
  // d: dateObj, l: label, f: format, v: value
  const now = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const formats = {
    withDay: ' (EEE, yyyy-MM-dd)',
    parensNoDay: ' (yyyy-MM-dd)',
    noDay: 'yyyy-MM-dd',
    arrowDay: '>yyyy-MM-dd',
    arrowISOWeek: '>yyyy[W]II',
  }
  const weekends = eachWeekendOfInterval({ start: now, end: add(now, { months: 1 }) }).filter((d) => d > now)
  const next7days = eachDayOfInterval({ start: add(now, { days: 1 }), end: add(now, { days: 7 }) })
  let inputs = [
    { l: `Today`, d: now, lf: 'withDay', vf: 'arrowDay' },
    { l: `Tomorrow`, d: add(now, { days: 1 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `Next weekend`, d: weekends[0], lf: 'withDay', vf: 'arrowDay' },
    { l: `Following weekend`, d: weekends[2], lf: 'withDay', vf: 'arrowDay' },
    { l: `in 2 days`, d: add(now, { days: 2 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 3 days`, d: add(now, { days: 3 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 4 days`, d: add(now, { days: 4 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 5 days`, d: add(now, { days: 5 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 6 days`, d: add(now, { days: 6 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 1 week`, d: add(now, { weeks: 1 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 2 weeks`, d: add(now, { weeks: 2 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 3 weeks`, d: add(now, { weeks: 3 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 1 month`, d: add(now, { months: 1 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 2 months`, d: add(now, { months: 2 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 3 months`, d: add(now, { months: 3 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 4 months`, d: add(now, { months: 4 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 5 months`, d: add(now, { months: 5 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 6 months`, d: add(now, { months: 6 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 9 months`, d: add(now, { months: 9 }), lf: 'withDay', vf: 'arrowDay' },
    { l: `in 1 year`, d: add(now, { years: 1 }), lf: 'withDay', vf: 'arrowDay' },
  ]
  inputs = [...inputs, ...next7days.map((day) => ({ l: format(day, 'eeee'), d: day, lf: 'parensNoDay', vf: 'arrowDay' }))]

  const options = inputs.map((i) => ({
    label: `${i['l']} ${format(i['d'], formats[i['lf']])}`,
    // $FlowIgnore
    value: format(i['d'], formats[i['vf']]),
  }))
  return options
}

/**
 * Calculates how long ago a given timestamp occurred.
 * @param {Date} pastDate - date of the past time to evaluate.
 * @returns {string} - A human-readable string indicating time elapsed.
 */
export function getTimeAgoString(pastDate: Date): string {
  const pastDateTimestamp: number = new Date(pastDate).getTime()
  const nowTimestamp: number = Date.now()
  const diff: number = Math.round((nowTimestamp - pastDateTimestamp) / 1000) / 60 // Convert to minutes

  let output = ''
  if (diff <= 0.1) {
    output = 'just now'
  } else if (diff <= 1) {
    output = '<1 min ago'
  } else if (diff < 1.5) {
    output = '1 min ago'
  } else if (diff <= 90) {
    output = `${Math.round(diff)} mins ago`
  } else if (diff <= 1440) {
    output = `${Math.round(diff / 60)} hours ago`
  } else if (diff <= 43776) {
    output = `${Math.round(diff / 1440)} days ago`
  } else if (diff <= 525312) {
    output = `${Math.round(diff / 43800)} mon ago`
  } else {
    output = `${Math.round(diff / 525600)} yrs ago`
  }

  return output
}

/**
 * Converts an ISO 8601 date string (YYYY-MM-DD) to NotePlan format (YYYYMMDD)
 * Only converts if it's a valid ISO date format
 * @author @dwertheimer
 * @param {string} dateStr - date string to convert
 * @returns {string} - converted date or original string if not a valid ISO date
 */
export function convertISOToYYYYMMDD(dateStr: string): string {
  const isoDateRegex = new RegExp(`^${RE_ISO_DATE}$`)
  if (isoDateRegex.test(dateStr)) {
    return dateStr.replace(/-/g, '')
  }
  return dateStr
}
