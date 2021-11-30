// @flow
//-------------------------------------------------------------------------------
// Date functions
// @jgclark except where shown

import strftime from 'strftime'

export const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[bdwmqy]`

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
export const nowShortDateTime: string = new Date().toISOString().slice(0, 16) // TODO: Deprecate for a locale version?
export const nowLocaleDateTime: string = new Date().toLocaleString()
export const getFormattedTime = (format: string = '%Y-%m-%d %I:%M:%S %P'): string => strftime(format)

export function getTodaysDateHyphenated(): string {
  return hyphenatedDate(new Date())
}

export function getTodaysDateUnhyphenated(): string {
  return strftime(`%Y%m%d`)
}


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

export function dateStringFromCalendarFilename(filename: string): string {
  return filename.slice(0, 8)
}

export function isoDateStringFromCalendarFilename(filename: string): string {
  return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}`
}

// @nmn
export function removeDateTags(content: string): string {
  return content
    .replace(/<\d{4}-\d{2}-\d{2}/g, '')
    .replace(/>\d{4}-\d{2}-\d{2}/g, '')
    .trim()
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
// Tests for the above
// console.log(withinDateRange(unhyphenateDate('2021-04-24'), '20210501', '20210531')) // false
// console.log(withinDateRange(unhyphenateDate('2021-05-01'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-24'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-31'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-06-24'), '20210501', '20210531')) // false

// Calculate an offset date, returning ISO datestring. Assumes:
// - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
// - interval is string of form +nn[bdwmq] or -nn[bdwmq]
// - where 'b' is weekday (i.e. Monday - Friday in English)
// Return new date also in ISO Date format
// v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
export function calcOffsetDateStr(oldDateISO: string, interval: string): string {
  const newDate = calcOffsetDate(oldDateISO, interval)
  return toISODateString(newDate)
}

// Calculate an offset date, as a JS Date. Assumes:
// - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
// - interval is string of form +nn[bdwmq] or -nn[bdwmq]
// - where 'b' is weekday (i.e. Monday - Friday in English)
// Return new date as a JS Date
// v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
export function calcOffsetDate(oldDateISO: string, interval: string): Date {
  const oldDate = new Date(oldDateISO)
  let daysToAdd = 0
  let monthsToAdd = 0
  let yearsToAdd = 0
  const unit = interval.charAt(interval.length - 1) // get last character
  let num = Number(interval.substr(0, interval.length - 1)) // return all but last character
  // console.log("    c_o_d: old = " + oldDate + " / "  + num + " / " + unit)

  switch (unit) {
    case 'b': {
      // week days
      // Method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
      // Avoids looping, and copes with negative intervals too
      const currentDayOfWeek = oldDate.getUTCDay() // = day of week with Sunday = 0, ..Saturday = 6
      let dayOfWeek
      if (num < 0) {
        dayOfWeek = (currentDayOfWeek - 12) % 7
      } else {
        dayOfWeek = (currentDayOfWeek + 6) % 7 // % = modulo operator in JSON
      }
      if (dayOfWeek === 6) {
        num--
      }
      if (dayOfWeek === -6) {
        num++
      }
      // console.log("    c_o_d b: " + currentDayOfWeek + " / " + num + " / " + dayOfWeek)
      const numWeekends = Math.trunc((num + dayOfWeek) / 5)
      daysToAdd = num + numWeekends * 2
      break
    }
    case 'd':
      daysToAdd = num // need *1 otherwise treated as a string for some reason
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
      console.log(`\tInvalid date interval: '${interval}'`)
      break
  }

  // Now add (or subtract) the number, using NP's built-in helper
  const newDate =
    Math.abs(daysToAdd) > 0
      ? Calendar.addUnitToDate(oldDate, 'day', daysToAdd)
      : Math.abs(monthsToAdd) > 0
      ? Calendar.addUnitToDate(oldDate, 'month', monthsToAdd)
      : Math.abs(yearsToAdd) > 0
      ? Calendar.addUnitToDate(oldDate, 'year', yearsToAdd)
      : oldDate // if nothing else, leave date the same

  return newDate
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
 * @param {string} - string that contains a date e.g. @due(2021-03-04)
 * @return {?Date} - JS Date version, if valid date found
 */
export function getDateFromString(mention: string): ?Date {
  const RE_DATE_CAPTURE = `(${RE_DATE})` // capture date of form YYYY-MM-DD

  if (mention === '') {
    // console.log(`\tgetDateFromString: empty string`)
    return // no text, so return nothing
  }
  // console.log(`\tgetDateFromString: ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1].length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // console.log(toISOShortDateTimeString(date))
    return date
  } else {
    // console.log(`\tgetDateFromString: no date found`)
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

/**
 * Return quarter start and end dates for a given quarter
 * @param {number} qtr - quarter number in year (1-4)
 * @param {number} year - year (4-digits)
 * @return {[Date, Date]}} - start and end dates (as JS Dates)
 */
export function quarterStartEnd(qtr: number, year: number): [Date, Date] {
  // Default values are needed to account for the
  // default case of the switch statement below.
  // Otherwise, these variables will never get initialized before
  // being used.
  let startDate: Date = new Date()
  let endDate: Date = new Date()

  // Because this seems to use ISO dates, we appear to need to take timezone
  // offset into account in order to avoid landing up crossing date boundaries.
  // I.e. when in BST (=UTC+0100) it's calculating dates which are often 1 too early.
  // Get TZOffset in minutes. If positive then behind UTC; if negative then ahead.
  const TZOffset = new Date().getTimezoneOffset()

  switch (qtr) {
    case 1: {
      startDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 1, 1, 0, 0, 0), 'minute', -TZOffset)
      endDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 3, 31, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 2: {
      startDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 4, 1, 0, 0, 0), 'minute', -TZOffset)
      endDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 6, 30, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 3: {
      startDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 7, 1, 0, 0, 0), 'minute', -TZOffset)
      endDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 9, 30, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 4: {
      startDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 10, 1, 0, 0, 0), 'minute', -TZOffset)
      endDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 12, 31, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    default: {
      console.log(`error: invalid quarter given: ${qtr}`)
      break
    }
  }
  return [startDate, endDate]
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

/**
 * Return start and end dates for a given week number. 
 * Uses ISO 8601 definition of week, except that week start is Sunday not Monday.
 * TODO: Use locale-specific first day of week (e.g. Mon for USA)
 * @param {number} week - week number in year (1-53)
 * @param {number} year - year (4-digits)
 * @return {[Date, Date]}} - start and end dates (as JS Dates)
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
  console.log(`  -> ${toLocaleTime(startDate)} - ${toLocaleTime(endDate)}`)
  return [ startDate, endDate ]
}
