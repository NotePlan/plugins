// @flow
//-------------------------------------------------------------------------------
// Date functions, that don't rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import {
  formatISO9075,
} from 'date-fns'

export const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[bdwmqy]`

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
//export const nowShortDateTime: string = new Date().toISOString().slice(0, 16) // Note: Now deprecated, as better to use a locale version
export const nowLocaleDateTime: string = new Date().toLocaleString()
export const getFormattedTime = (format: string = '%Y-%m-%d %I:%M:%S %P'): string => strftime(format)

export function getTodaysDateHyphenated(): string {
  return hyphenatedDate(new Date())
}

export function getTodaysDateUnhyphenated(): string {
  return strftime(`%Y%m%d`)
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

// NB: This does not work to get reliable date string from note.date for daily notes
// Instead use hyphenatedDateFromNote()
export function toISODateString(dateObj: Date): string {
  // console.log(`toISODateString: ${dateObj.toISOString()} // ${toLocaleDateTimeString(dateObj)}`) 
  return dateObj.toISOString().slice(0, 10)
}

// As ISODateString() doesn't work reliably across date boundaries except at GMT,
// this version creates YYYY-MM-DD format using the slight cheat of the sv-SE locale,
// which happens to be identical.
export function hyphenatedDate(date: Date): string {
  if (date != null) {
    // console.log(`hyphenatedDateFromNote: ${toLocaleDateTimeString(date)} -> ${toLocaleDateString(date, 'sv-SE')}`)
    return toLocaleDateString(date, 'sv-SE')
  } else {
    return 'hyphenatedDate: error: not a valid JS Date'
  }
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 16)
}

export function toLocaleDateTimeString(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  return dateObj.toLocaleString(locale, options)
}

export function toLocaleDateString(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  return dateObj.toLocaleDateString(locale, options)
}

export function toLocaleTime(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  return dateObj.toLocaleTimeString(locale, options)
}

export function printDateRange(dr: DateRange) {
  console.log(`DateRange <${toISOShortDateTimeString(dr.start)} - ${toISOShortDateTimeString(dr.end)}>`)
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
 * Return the time as a string in the format "HH:MM"
 * @author @dwertheimer
 * 
 * @param {Date} date object
 * @returns {string} - the time string in the format "HH:MM"
 */
export function getTimeStringFromDate(date: Date): string {
  return formatISO9075(date).split(' ')[1].slice(0, -3)
}

export function getDateStringFromCalendarFilename(filename: string): string {
  return filename.slice(0, 8)
}

export function getISODateStringFromCalendarFilename(filename: string): string {
  return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}`
}

// @nmn
export function removeDateTags(content: string): string {
  return content
    .replace(/<\d{4}-\d{2}-\d{2}/g, '')
    .replace(/>\d{4}-\d{2}-\d{2}/g, '')
    .trimEnd()
}

// @dwertheimer
export function removeDateTagsAndToday(tag: string): string {
  return removeDateTags(tag)
    .replace(/>today/, '')
    .replace(/ {2,}/gm, ' ')
    .trimEnd()
}

export const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const monthsAbbrev = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthNameAbbrev(m: number): string {
  return monthsAbbrev[m - 1]
}

/* Return difference between start and end dates
 * TODO: look at using date-fn's differenceInCalendarDays instead
 * @author @jgclark
 *
 * @param {Date} d1 - start Date
 * @param {Date} d2 - end Date
 * @return {number} - number of days between d1 and d2 (rounded to nearest integer)
 */
export function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2 - d1) / 1000 / 60 / 60 / 24) // i.e. milliseconds -> days
}

/* Test if a date is within two start and end dates (inclusive)
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
 * @param {number} diffIn - number of days difference (positive or negative)
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number): string {
  let output = ''
  let diff = diffIn
  let isPast = false
  // console.log(`original diff = ${diff}`)
  if (diff < 0) {
    diff = Math.abs(diff)
    isPast = true
  }
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
  if (diff === 0) {
    output = `today`
  } else if (isPast) {
    output += ` ago`
  } else {
    output = `in ${output}`
  }
  // console.log(`--> ${output}`)
  return output
}

/* Turn a string that includes YYYY-MM-DD into a JS Date
 * @author @jgclark

 * @param {string} - string that contains a date e.g. @due(2021-03-04)
 * @return {?Date} - JS Date version, if valid date found
 * @test - available in jest file
 */
export function getDateObjFromDateString(mention: string): ?Date {
  const RE_DATE_CAPTURE = `(${RE_DATE})` // capture date of form YYYY-MM-DD

  // console.log(`\tgetDateFromString: ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // console.log(toISOShortDateTimeString(date))
    return date
  } else {
    console.log(`\t\tgetDateFromString: no valid date found in '${mention}'`)
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

/* Turn a YYYYMMDD string into a JS Date
 * @param {string} - YYYYMMDD string
 * @return {?Date} - JS Date version
 */
export function getDateFromUnhyphenatedDateString(inputString: string): ?Date {
  const RE_DATE_CAPTURE = `(\\d{4}[01]\\d{1}\\d{2})` // capture date of form YYYYMMDD

  // console.log(`\tgetDateFromUnhyphenatedDateString: ${inputString}`)
  const res = inputString.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(4, 6)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(6, 8))
    )
    // console.log(toISOShortDateTimeString(date))
    return date
  } else {
    console.log(`\t\tgetDateFromUnhyphenatedDateString: no valid date found in '${inputString}'`)
    return
  }
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * @param {Date} date - calculate difference between this date and today
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromDate(date: Date): string {
  // Wrapper to relativeDateFromNumber(), accepting JS date instead of number
  const diff = Calendar.unitsBetween(date, new Date(), 'day')
  return relativeDateFromNumber(diff)
}

// TODO: Finish moving references to this file -> NPdateTime.js
/**
 * Get week number for supplied date.
 * Uses ISO 8601 definition of week, except that week start is Sunday not Monday.
 * TODO: Use locale-specific first day of week (e.g. Mon for USA)
 * 
 * The ISO 8601 definition for week 01 is the week with the first Thursday of the Gregorian
 * year (i.e. of January) in it.  The following definitions based on properties of this week 
 * are mutually equivalent, since the ISO week starts with Monday:
 * - It is the first week with a majority (4 or more) of its days in January.
 * - Its first day is the Monday nearest to 1 January.
 * - It has 4 January in it
 * Code from https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php?noredirect=1&lq=1
 * Still, we need to be careful about assumptions at year boundary, as
 * for example 2022-01-01 is in week 52 of 2021.
 * @author @jgclark
 * 
 * @param {Date} inDate - the JS Date object of interest
 * @return {number} - the standardised week number
 */ 
export function getWeek(inDate: Date): number {
  const date = inDate instanceof Date
    ? new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate())
    : new Date()

  // ISO week date weeks start on Monday, so correct the day number
  // const nDay = (date.getDay() + 6) % 7
  // Get week date start on Sunday
  const nDay = date.getDay()

  // ISO 8601 states that week 1 is the week with the first Thursday of that year
  // Set the target date to the Thursday in the target week
  date.setDate(date.getDate() - nDay + 3)

  // Store the millisecond value of the target date
  const n1stThursday = date.valueOf()

  // Set the target to the first Thursday of the year
  // First, set the target to January 1st
  date.setMonth(0, 1)

  // Not a Thursday? Correct the date to the next Thursday
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7)
  }

  // The week number is the number of weeks between the first Thursday of the year
  // and the Thursday in the target week (604800000 = 7 * 24 * 3600 * 1000)
  return 1 + Math.ceil((n1stThursday - date) / 604800000)
}

// TODO: Finish moving references to this file -> NPdateTime.js
/**
 * Return start and end dates for a given week number. 
 * Uses ISO 8601 definition of week, except that week start is Sunday not Monday.
 * TODO: Use locale-specific first day of week (e.g. Mon for USA)
 * @author @jgclark
 * 
 * @param {number} week - week number in year (1-53)
 * @param {number} year - year (4-digits)
 * @return {[Date, Date]}} - start and end dates (as JS Dates)
 * @test - defined in Jest, but won't work until Calendar.addUnitToDate can be stubbed out
 */
export function weekStartEnd(week: number, year: number): [Date, Date] {
  if (week > 53 || week < 1) {
    console.log(`warning: invalid week number ${week} given, but will still calculate correctly, relative to year ${year}.`)
  }

  let firstDay = 0
  let testWeek = 0
  do {
    firstDay++
    testWeek = getWeek(new Date(year,0,firstDay))
  } while (testWeek !== 1)

  const startDate: Date = Calendar.addUnitToDate(new Date(year,0,firstDay), 'day', (week-1)*7)
  const endDate: Date = Calendar.addUnitToDate(startDate, 'day', 6)
  // console.log(`  -> ${toLocaleTime(startDate)} - ${toLocaleTime(endDate)}`)
  return [ startDate, endDate ]
}

// TODO: Finish moving references to this file -> NPdateTime.js
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
 */
export function calcWeekOffset(
  startWeek: number,
  startYear: number,
  offset: number): {week: number, year: number}
{
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
  // console.log(`${startYear}W${startWeek} - ${year}W${week}`)
  return { week, year }
}
