// @flow
//-------------------------------------------------------------------------------
// Date functions, that don't rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import moment from 'moment/min/moment-with-locales'
import { default as momentBusiness } from 'moment-business-days'
import { formatISO9075, eachDayOfInterval, eachWeekendOfInterval, format, add } from 'date-fns'
import { logDebug, logError, logInfo, logWarn, clo } from './dev'

// Basic date/time regexes
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE = '\\d{4}-[01]\\d-[0123]\\d' // find ISO dates of form YYYY-MM-DD (stricter than before)
export const RE_YYYYMMDD_DATE = '\\d{4}[01]\\d[0123]\\d' // version of above that finds dates of form YYYYMMDD
export const RE_DATE_CAPTURE = `(\\d{4}[01]\\d{1}\\d{2})` // capture date of form YYYYMMDD
export const RE_ISO_DATE = RE_DATE // now earlier RE_DATE made the same as this stricter one
export const RE_PLUS_DATE_G: RegExp = />(\d{4}-\d{2}-\d{2})(\+)*/g
export const RE_PLUS_DATE: RegExp = />(\d{4}-\d{2}-\d{2})(\+)*/
export const RE_SCHEDULED_ISO_DATE = '>\\d{4}-[01]\\d-[0123]\\d' // find scheduled dates of form >YYYY-MM-DD
export const RE_DATE_TIME = `${RE_DATE} ${RE_TIME}` // YYYY-MM-DD HH:MM[AM|PM]
export const RE_BARE_DATE = `[^\d(<\/-]${RE_DATE}` // an ISO date without a digit or ( or < or / or - before it. Note: > is allowed.
export const RE_BARE_DATE_CAPTURE = `[^\d(<\/-](${RE_DATE})` // capturing date in above
export const RE_FILE_EXTENSIONS_GROUP = `\\.(md|txt)$` // and tie to end of string
export const RE_NP_DAY_SPEC = RE_ISO_DATE
export const RE_DAILY_NOTE_FILENAME = `(^|\\/)${RE_YYYYMMDD_DATE}${RE_FILE_EXTENSIONS_GROUP}`

// Week regexes
export const RE_NP_WEEK_SPEC = '\\d{4}\\-W[0-5]\\d' // find dates of form YYYY-Wnn
export const WEEK_NOTE_LINK = `[\<\>]${RE_NP_WEEK_SPEC}`
export const RE_WEEKLY_NOTE_FILENAME = `(^|\\/)${RE_NP_WEEK_SPEC}${RE_FILE_EXTENSIONS_GROUP}`
export const RE_BARE_WEEKLY_DATE = `[^\d(<\/-]${RE_NP_WEEK_SPEC}` // a YYYY-Www date without a digit or ( or < or / or - before it. Note: > is allowed.
export const RE_BARE_WEEKLY_DATE_CAPTURE = `[^\d(<\/-](${RE_NP_WEEK_SPEC})` // capturing date in above

// Months
// export const RE_NP_MONTH_SPEC = '(?<![\\d-])\\d{4}-[01]\\d(?![\\d-])' // find dates of form YYYY-mm not following or followed by digit or - [doesn't work because it has a lookbehind]
export const RE_NP_MONTH_SPEC = '\\d{4}-[01]\\d(?![\\d-])' // find dates of form YYYY-mm not followed by digit or - [fails if I add negative start or negative lookbehinds]
export const MONTH_NOTE_LINK = `[\<\>]${RE_NP_MONTH_SPEC}`
export const RE_MONTHLY_NOTE_FILENAME = `(^|\\/)${RE_NP_MONTH_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// Quarters
export const RE_NP_QUARTER_SPEC = '\\d{4}\\-Q[1-4](?!\\d)' // find dates of form YYYY-Qn not followed by digit
export const QUARTER_NOTE_LINK = `[\<\>]${RE_NP_QUARTER_SPEC}`
export const RE_QUARTERLY_NOTE_FILENAME = `(^|\\/)${RE_NP_QUARTER_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// Years
// export const RE_NP_YEAR_SPEC = '(?<!\\d)\\d{4}(?![\\d-])' // find years of form YYYY without leading or trailing digit or - [doesn't work because it has a lookbehind]
export const RE_NP_YEAR_SPEC = '\\d{4}(?![\\d-])' // find years of form YYYY without trailing - or digit [fails if I add negative start or negative lookbehinds]
export const YEAR_NOTE_LINK = `[\<\>]${RE_NP_YEAR_SPEC}`
export const RE_YEARLY_NOTE_FILENAME = `(^|\\/)${RE_NP_YEAR_SPEC}${RE_FILE_EXTENSIONS_GROUP}`

// @done(...)
export const RE_DONE_DATE_TIME = `@done\\(${RE_DATE_TIME}\\)` // find @done(DATE TIME)
export const RE_DONE_DATE_TIME_CAPTURES = `@done\\((${RE_DATE})( ${RE_TIME})\\)` // find @done(DATE TIME) and return date-time part
export const RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE = `@done\\((${RE_DATE})( ${RE_TIME})?\\)` // find @done(DATE TIME) and return date-time part
export const RE_DONE_DATE_OPT_TIME = `@done\\(${RE_ISO_DATE}( ${RE_TIME})?\\)`

// Intervals
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[bdwmqy]`
export const RE_OFFSET_DATE = `{\\^?${RE_DATE_INTERVAL}}`
export const RE_OFFSET_DATE_CAPTURE = `{(\\^?${RE_DATE_INTERVAL})}`

export const todaysDateISOString: string = moment().toISOString().slice(0, 10)
export const nowLocaleDateTime: string = moment().toDate().toLocaleString()
export const getFormattedTime = (format: string = '%Y-%m-%d %I:%M:%S %P'): string => strftime(format)

export function getTodaysDateHyphenated(): string {
  return hyphenatedDate(moment().toDate())
}

export function getTodaysDateAsArrowDate(): string {
  return `>${getTodaysDateHyphenated()}`
}

export function getTodaysDateUnhyphenated(): string {
  return strftime(`%Y%m%d`)
}

export const isDailyNote = (note: CoreNoteFields): boolean => new RegExp(RE_DAILY_NOTE_FILENAME).test(note.filename)

export const isWeeklyNote = (note: CoreNoteFields): boolean => new RegExp(RE_WEEKLY_NOTE_FILENAME).test(note.filename)

export const isMonthlyNote = (note: CoreNoteFields): boolean => new RegExp(RE_MONTHLY_NOTE_FILENAME).test(note.filename)

export const isQuarterlyNote = (note: CoreNoteFields): boolean => new RegExp(RE_QUARTERLY_NOTE_FILENAME).test(note.filename)

export const isYearlyNote = (note: CoreNoteFields): boolean => new RegExp(RE_YEARLY_NOTE_FILENAME).test(note.filename)

/**
 * Test if a string has a date (e.g. was scheduled for a specific date/week or has a >today tag)
 * @author @dwertheimer
 * @param {string} content
 * @returns {boolean} true if the content contains a date in the form YYYY-MM-DD or a >today or weekly note
 */
export const isScheduled = (content: string): boolean => RE_PLUS_DATE.test(content) || />today/.test(content) || new RegExp(RE_NP_WEEK_SPEC).test(content)

/**
 * Remove all >date or >today occurrences in a string and add (>today's-date by default) or the supplied string to the end
 * @param {string} inString - the string to start with
 * @param {?string | null} replaceWith - the string to add to the end (if nothing sent, will use >todaysDate)
 * @returns {string} string with the replacements made
 * @author @dwertheimer
 */
export function replaceArrowDatesInString(inString: string, replaceWith: string | null = null): string {
  let str = inString
  let repl = replaceWith
  if (replaceWith === null) {
    // if no replacement string, use today's date (e.g. replace >today with todays date instead)
    repl = getTodaysDateAsArrowDate()
  }
  // $FlowIgnore[incompatible-type]
  logDebug(`replaceArrowDatesInString: BEFORE inString=${inString}, replaceWith=${replaceWith}, repl=${repl}`)
  while (isScheduled(str)) {
    str = str.replace(RE_PLUS_DATE, '').replace('>today', '').replace(new RegExp(WEEK_NOTE_LINK), '').replace(/ {2,}/g, ' ').trim()
  }
  // $FlowIgnore[incompatible-type]
  logDebug(`replaceArrowDatesInString: AFTER str=${str}, replaceWith=${replaceWith}, repl=${repl}`)
  return repl && repl.length > 0 ? `${str} ${repl}` : str
}

//-------------------------------------------------------------------------------

// @nmn
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

export function unhyphenateString(dateString: string): string {
  return dateString.replace(/-/g, '')
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

export function unhyphenatedDate(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

// @nmn
export function hyphenatedDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`
}

// @nmn
export function filenameDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj)
  return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`
}

/**
 * Return note of calendar date in a variety of styles
 * @author @jgclark
 * @param {string} style to return
 * @param {Date} inputDate
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

/**
 * Returns a string representation of a Calendar note's date, from its filename
 * @param {string} filename
 * @returns {string} YYYYMMDD / YYYY-Wnn / YYYY-mm / YYYY-Qn / YYYY date (some only from NP v3.7.2)
 * @tests in jest file
 */
export function getDateStringFromCalendarFilename(filename: string): string {
  try {
    // logDebug('gDSFCF', `for ${filename} ...`)
    if (filename.match(RE_DAILY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `= daily`)
      return filename.slice(0, 8)
    } else if (filename.match(RE_WEEKLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filename} = weekly`)
      return weekStartDateStr(filename.slice(0, 8))
    } else if (filename.match(RE_MONTHLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filename} = monthly`)
      return filename.slice(0, 7)
    } else if (filename.match(RE_QUARTERLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filename} = quarterly`)
      return filename.slice(0, 7)
    } else if (filename.match(RE_YEARLY_NOTE_FILENAME)) {
      // logDebug('gDSFCF', `${filename} = yearly`)
      return filename.slice(0, 4)
    } else {
      throw new Error(`Invalid calendar filename: ${filename}`)
    }
  } catch (err) {
    logError('dateTime / getDateStringFromCalendarFilename', err.message)
    return '(invalid date)' // for completeness
  }
}

/**
 * Returns a YYYYMMDD string representation of a Calendar note's first date, from its filename. (e.g. '2022-Q4.md' -> '20221001')
 * @param {string} filename
 * @returns {string} YYYYMMDD for first date in period
 */
export function getDateStrForStartofPeriodFromCalendarFilename(filename: string): string {
  try {
    // Trying a shortcut way first: seems to work
    // logDebug('dateTime / gDSFSOPFCF', `for ${filename} ...`)
    const thisNote = DataStore.noteByFilename(filename, 'Calendar')
    if (thisNote && thisNote.date) {
      const dateOut = unhyphenatedDate(thisNote.date) ?? '(error)'
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
    return '(invalid date)'
  }
}

/**
 * Remove >date and <date from a string
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
 * Remove all >date -related things from a line (and optionally >week ones also)
 * @author @dwertheimer
 * @param {*} tag
 * @param {*} weeklyAlso
 * @returns
 */
export function removeDateTagsAndToday(tag: string, weeklyAlso: boolean = false): string {
  let newString = tag,
    lastPass = tag
  do {
    lastPass = newString
    newString = removeDateTags(tag)
      .replace(weeklyAlso ? new RegExp(WEEK_NOTE_LINK, 'g') : '', '')
      .replace(/>today/, '')
      .replace(/\s{2,}/g, ' ')
      .trimEnd()
  } while (newString !== lastPass)
  return newString
}

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthsAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// TODO: Could use moment instead ... might be more locale aware too
export function monthNameAbbrev(m: number): string {
  return monthsAbbrev[m - 1]
}

/**
 * Return difference between start and end dates
 * @author @jgclark
 *
 * @param {Date} d1 - start Date
 * @param {Date} d2 - end Date
 * @return {number} - number of days between d1 and d2 (rounded to nearest integer)
 */
export function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2 - d1) / 1000 / 60 / 60 / 24) // i.e. milliseconds -> days
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
 * This is v2, now using moment library instead, but tweaking slightly to produce exactly the output as my v1 did.
 * @author @jgclark
 *
 * @param {number} diffIn - number of days difference (positive or negative)
 * @param {boolean?} shortStyle?
 * @returns {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number, useShortStyle: boolean = false): string {
  let output = ''
  let diff = diffIn
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
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // logDebug('dateTime / getDateObjFromDateString', toISOShortDateTimeString(date))
    return date
  } else {
    logWarn('dateTime / getDateObjFromDateString', `getDateFromString: no valid date found in '${mention}'`)
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
  let timeParts = timeString.split(':')
  let dateParts = dateString.split('-')
  if (timeParts.length !== 3 || dateParts.length !== 3) {
    throw `dateTimeString "${dateTimeString}" is not in expected format`
  }
  timeParts = timeParts.map((t) => Number(t))
  dateParts = dateParts.map((d) => Number(d))
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
 * @return {?Date} - JS Date version of
 */
export function getDateFromUnhyphenatedDateString(inputString: string): ?Date {
  // logDebug('dateTime / getDateFromUnhyphenatedDateString', inputString)
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
    // logDebug('dateTime / getDateFromUnhyphenatedDateString', toLocaleDateTimeString(date))
    return date
  } else {
    logWarn('dateTime / getDateFromUnhyphenatedDateString', `  no valid date found in '${inputString}'`)
    return
  }
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * TODO: Shift to moment library
 * @param {Date} date - calculate difference between this date and today
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromDate(date: Date): string {
  // Wrapper to relativeDateFromNumber(), accepting JS date instead of number
  const diff = Calendar.unitsBetween(date, new Date(), 'day')
  return relativeDateFromNumber(diff)
}

/**
 * Get week number for supplied date.
 * Uses the ISO 8601 definition for week: 01 is the week with the first Thursday of the Gregorian
 * year (i.e. of January) in it.  The following definitions based on properties of this week
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
 * Return start and end dates for a given week number.
 * Uses ISO 8601 definition of week.
 * V2 now uses Moment library
 * @author @jgclark
 *
 * @param {number} week - week number in year (1-53)
 * @param {number} year - year (4-digits)
 * @return {[Date, Date]}} - start and end dates (as JS Dates)
 * @test - defined in Jest, but won't work until Calendar.addUnitToDate can be stubbed out
 */
export function weekStartEnd(week: number, year: number): [Date, Date] {
  if (week > 53 || week < 1) {
    logWarn('helpers/weekStartEnd', `Invalid week number ${week} given, but will still calculate correctly, relative to year ${year}.`)
  }

  // the .milliseconds in the following shouldn't really be needed, but it seems to
  const startDate = moment().year(year).isoWeeks(week).startOf('isoWeek').milliseconds(0).toDate()
  // const endDate = start.add(6, 'days').hours(23).minutes(59).seconds(59).toDate()
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
 * Calculate an offset date of either a NP daily or weekly date, and return _in whichever of the two ISO formats were supplied (YYYY-MM-DD or YYYY-Wnn)_.
 * v5 method, using 'moment' library to avoid using NP calls, now extended to allow for Weekly strings as well.
 * Moment docs: https://momentjs.com/docs/#/get-set/
 * @author @jgclark
 *
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {string} new date in the same format that was supplied
 * @test - available in jest file
 */
export function calcOffsetDateStr(baseDateISO: string, interval: string): string {
  try {
    if (!interval.match(RE_DATE_INTERVAL)) {
      logError('dateTime / cODS', `Invalid date interval '${interval}'`)
      return '(error)'
    }
    const unit = interval.charAt(interval.length - 1) // get last character
    const num = Number(interval.substr(0, interval.length - 1)) // return all but last character

    // short codes in moment library aren't quite the same as mine
    let unitForMoment = ''
    switch (unit) {
      case 'm':
        unitForMoment = 'M'
        break
      case 'q':
        unitForMoment = 'Q'
        break
      default:
        unitForMoment = unit
        break
    }

    let momentDateFormat = ''
    if (baseDateISO.match(RE_ISO_DATE)) {
      momentDateFormat = 'YYYY-MM-DD'
    } else if (baseDateISO.match(RE_NP_WEEK_SPEC)) {
      momentDateFormat = 'YYYY-[W]WW'
    } else {
      throw new Error('Invalid date string')
    }
    const baseDateMoment = moment(baseDateISO, momentDateFormat)
    const newDate = unit !== 'b' ? baseDateMoment.add(num, unitForMoment) : momentBusiness(baseDateMoment).businessAdd(num)
    const newDateStr = newDate.format(momentDateFormat)

    // calc offset (Note: library functions cope with negative nums, so just always use 'add' function)
    // logDebug('dateTime / cODS', `for '${baseDateISO}' interval ${num} / ${unitForMoment} -> '${newDateISO}'`)
    return newDateStr
  } catch (e) {
    logError('dateTime / cODS', `${e.message} for '${baseDateISO}' interval '${interval}'`)
    return '(error)'
  }
}

/**
 * Does this line include a scheduled date in the future?
 * (Should work even with >date in brackets or with non-white-space before it.)
 * @author @jgclark
 *
 * @param {string} line to search in
 * @return {boolean}
 * @test - available in jest file
 */
export function includesScheduledFutureDate(line: string): boolean {
  const m = line.match(RE_SCHEDULED_ISO_DATE) ?? []
  return m.length > 0 && m[0] > todaysDateISOString
}

/**
 * WARNING: DO NOT USE THESE FOR NOTEPLAN WEEK CALCULATIONS BECAUSE NOTEPLAN DOES NOT ACTUALLY USE ISO WEEKS (IT'S OFFSET DUE TO USER PREFS START-WEEK-ON)
 * Get the week number string for a given date string or Date object.
 * @param {string} date - date string in format YYYY-MM-DD OR a Date object
 * @param {number} offsetIncrement - number of days|weeks|month to add (or negative=subtract) to date (default: 0)
 * @param {string} offsetType - 'day'|'week'|'month'|'year' (default: 'week')
 * @returns {string} - week number string in format 'YYYYWww'
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
 * Validate if a string can be used to pull up a calendar note (2020-01-01 or 2020-W01 and hopefully month, year in the future)
 * @param {string} text
 * @returns {boolean} whether it passes the @jgclark RegEx texts for date and week
 */
// export const isValidCalendarNoteTitle = (text: string): boolean => (new RegExp(`${RE_ISO_DATE}|${RE_WEEK_DATE}`).test(text))
export const isValidCalendarNoteTitle = (text: string): boolean => new RegExp('(([0-9]{4})-((0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])|W0[1-9]|W[1-4]\\d|W5[0-3]))').test(text)

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
