// @flow
//-------------------------------------------------------------------------------
// Date functions
// @jgclark except where shown

import strftime from 'strftime'

export const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `\\+?\\d+[bdwmqy]`

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
export const nowShortDateTime: string = new Date().toISOString().slice(0, 16)
export const nowLocaleDateTime: string = new Date().toLocaleString()
export const getFormattedTime = (format: string = '%Y-%m-%d %I:%M:%S %P'): string => strftime(format)

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

export function toISODateString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 10)
}

export function toLocaleDateString(dateObj: Date): string {
  return dateObj.toLocaleString().slice(0, 10) // TODO: won't always have this length
}

export function toISOShortDateTimeString(dateObj: Date): string {
  return dateObj.toISOString().slice(0, 16)
}

// DEPRECATING THIS in favour of Locale version
// export function toISOShortTime(dateObj: Date): string {
//   return dateObj.toISOString().slice(11, 16)
// }

export function toLocaleShortTime(
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

export function withinDateRange(testDate: string, fromDate: string, toDate: string): boolean {
  return testDate >= fromDate && testDate <= toDate
}

// Tests for the above
// console.log(withinDateRange(unhyphenateDate('2021-04-24'), '20210501', '20210531')) // false
// console.log(withinDateRange(unhyphenateDate('2021-05-01'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-24'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-05-31'), '20210501', '20210531')) // true
// console.log(withinDateRange(unhyphenateDate('2021-06-24'), '20210501', '20210531')) // false

// Calculate an offset date, returning ISO datestring
export function calcOffsetDateStr(oldDateISO: string, interval: string): string {
  // Calculate an offset date, assuming:
  // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
  // - interval is string of form nn[bdwmq], and could be negative
  // - where 'b' is weekday (i.e. Monday - Friday in English)
  // Return new date also in ISO Date format
  // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'

  const newDate = calcOffsetDate(oldDateISO, interval)
  return toISODateString(newDate)
}

// Calculate an offset date, returning Date object
export function calcOffsetDate(oldDateISO: string, interval: string): Date {
  // Calculate an offset date, assuming:
  // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
  // - interval is string of form nn[bdwmq], and could be negative
  // - where 'b' is weekday (i.e. Monday - Friday in English)
  // Return new date as a JS Date
  // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'

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

  const newDate =
    daysToAdd > 0
      ? Calendar.addUnitToDate(oldDate, 'day', daysToAdd)
      : monthsToAdd > 0
      ? Calendar.addUnitToDate(oldDate, 'month', monthsToAdd)
      : yearsToAdd > 0
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
