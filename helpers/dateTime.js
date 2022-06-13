// @flow
//-------------------------------------------------------------------------------
// Date functions, that don't rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import { Duration, DateTime } from 'luxon' // having done 'npm install --save luxon'
import { formatISO9075 } from 'date-fns'
import { log, logError } from './dev'

export const RE_DATE = '\\d{4}-[01]\\d-\\d{2}' // find ISO dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d-[012]\\d' // find ISO dates of form YYYY-MM-DD (slightly stricter)
export const RE_YYYYMMDD_DATE = '\\d{4}[01]\\d[012]\\d' // find dates of form YYYYMMDD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[bdwmqy]`
export const RE_OFFSET_DATE = `{\\^?${RE_DATE_INTERVAL}}`
export const RE_OFFSET_DATE_CAPTURE = `{(\\^?${RE_DATE_INTERVAL})}`
export const RE_BARE_DATE = `[^\d(<\/-]${RE_DATE}` // an ISO date without a digit or ( or < or / or - before it
export const RE_BARE_DATE_CAPTURE = `[^\d(<\/-](${RE_DATE})` // capturing date in above

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
  // log('toISODateString', `${dateObj.toISOString()} // ${toLocaleDateTimeString(dateObj)}`)
  return dateObj.toISOString().slice(0, 10)
}

// As ISODateString() doesn't work reliably across date boundaries except at GMT,
// this version creates YYYY-MM-DD format using the slight cheat of the sv-SE locale,
// which happens to be identical.
export function hyphenatedDate(date: Date): string {
  if (date != null) {
    // log('hyphenatedDate', `${toLocaleDateTimeString(date)} -> ${toLocaleDateString(date, 'sv-SE')}`)
    return toLocaleDateString(date, 'sv-SE')
  } else {
    return 'hyphenatedDate: error: not a valid JS Date'
  }
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 16)
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
  log('helpers/printDateRange', `<${toISOShortDateTimeString(dr.start)} - ${toISOShortDateTimeString(dr.end)}>`)
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
  // TODO: @jgclark wonders if this could be replaced by:
  // date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
}

export function getDateStringFromCalendarFilename(filename: string): string {
  if (filename.match(/^\d{8}\.(md|txt)$/)) {
    return filename.slice(0, 8)
  } else {
    return '(invalid date)'
  }
}

/**
 * Change a YYYYMMDD date string to YYYY-MM-DD
 * @param {*} dateStr without hyphens
 * @returns {string} ISO hyphenated string
 */
export function getISODateStringFromYYYYMMDD(filename: string): string {
  if (filename.match(/^\d{8}/)) {
    return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}`
  } else {
    return '(invalid date)'
  }
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
    .replace(/\s{2,}/g, ' ')
    .trimEnd()
}

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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
 * TODO: Look at the Luxon library's DateTime.toRelative({ unit: "hours" }) instead (-> '46 hours ago'.)
 * @param {number} diffIn - number of days difference (positive or negative)
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number): string {
  let output = ''
  let diff = diffIn
  let isPast = false
  // log('helpers/relativeDateFromNumber', `original diff = ${diff}`)
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
  // log('relativeDateFromNumber', `--> ${output}`)
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

  // log('getDateObjFromDateString', `  ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // log('getDateObjFromDateString', toISOShortDateTimeString(date))
    return date
  } else {
    log('getDateObjFromDateString', `  getDateFromString: no valid date found in '${mention}'`)
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

  // log('getDateFromUnhyphenatedDateString', inputString)
  const res = inputString.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(4, 6)) - 1, // only needed for months!
      Number(res[1].slice(6, 8)),
    )
    // log('getDateFromUnhyphenatedDateString', toISOShortDateTimeString(date))
    return date
  } else {
    log('getDateFromUnhyphenatedDateString', `  no valid date found in '${inputString}'`)
    return
  }
}

/**
 * Return rough relative string version of difference between date and today.
 * Don't return all the detail, but just the most significant unit (year, month, week, day)
 * If date is in the past then adds 'ago'.
 * TODO: Look at the Luxon library's DateTime.toRelative({ unit: "hours" }) instead (-> '46 hours ago'.)
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
  const date = inDate instanceof Date ? new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate()) : new Date()

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
    date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7))
  }

  // The week number is the number of weeks between the first Thursday of the year
  // and the Thursday in the target week (604800000 = 7 * 24 * 3600 * 1000)
  return 1 + Math.ceil((n1stThursday - date) / 604800000)
}

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
    log('helpers/weekStartEnd', `warning: invalid week number ${week} given, but will still calculate correctly, relative to year ${year}.`)
  }

  let firstDay = 0
  let testWeek = 0
  do {
    firstDay++
    testWeek = getWeek(new Date(year, 0, firstDay))
  } while (testWeek !== 1)

  const startDate: Date = Calendar.addUnitToDate(new Date(year, 0, firstDay), 'day', (week - 1) * 7)
  const endDate: Date = Calendar.addUnitToDate(startDate, 'day', 6)
  // log('helpers/weekStartEnd', `  -> ${toLocaleTime(startDate)} - ${toLocaleTime(endDate)}`)
  return [startDate, endDate]
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
  // log('helpers/calcWeekOffset', `${startYear}W${startWeek} - ${year}W${week}`)
  return { week, year }
}

/**
 * Calculate an offset date, as ISO Strings.
 * v3 method, using Luxon library to avoid using NP calls
 * NB: doesn't actually use NP functions, but to avoid a circular dependency it needs to be in this file.
 * @tests available in __tests__
 * @author @jgclark
 *
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {string} new date in ISO Date format
 */
export function calcOffsetDateStr(baseDateISO: string, interval: string): string {
  try {
    if (!interval.match(RE_DATE_INTERVAL)) {
      logError('helpers/cODSL', `Invalid date interval '${interval}'`)
      return '(error)'
    }

    const baseDate = DateTime.fromISO(baseDateISO)
    let daysToAdd = 0
    let monthsToAdd = 0
    let yearsToAdd = 0
    const unit = interval.charAt(interval.length - 1) // get last character
    let num = Number(interval.substr(0, interval.length - 1)) // return all but last character
    log('helpers/cODSL', `for ${baseDateISO} interval: ${num} / ${unit}`)

    switch (unit) {
      case 'b': {
        // Previously used a method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
        // Now using a pre-build library:
        // But need to turn off automatic public holidays, as these are US-specific
        baseDate.setupBusiness({ holidayMatchers: [] })
        daysToAdd = num
        break
      }
      case 'd':
        daysToAdd = num
        break
      case 'w':
        daysToAdd = num * 7
        break
      case 'm':
        monthsToAdd = num
        break
      case 'q':
        monthsToAdd = num * 3
        break
      case 'y':
        yearsToAdd = num
        break
      default:
        break
    }
    const duration = Duration.fromObject({ days: daysToAdd, months: monthsToAdd, years: yearsToAdd })
    // log('helpers/cODSL', duration.toString()) // Gets represented as P10D, P3M, P-2Y etc.
    const newDate =
      unit !== 'b'
        ? baseDate.plus(duration) // duration can be negative, so always add
        : baseDate.plusBusiness(duration) // use business days
    const newDateISO = newDate.toISODate()
    // log('helpers/cODSL', `-> '${newDateISO}'`)
    return newDateISO
  } catch (e) {
    logError('helpers/cODSL', `${e.message} for baseDateISO '${baseDateISO}' interval ${interval}`)
    return '(error)'
  }
}
