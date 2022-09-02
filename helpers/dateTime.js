// @flow
//-------------------------------------------------------------------------------
// Date functions, that don't rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import moment from 'moment/min/moment-with-locales'
import { default as momentBusiness } from 'moment-business-days'
import { formatISO9075 } from 'date-fns'
import { log, logDebug, logError, logWarn } from './dev'

export const RE_DATE = '\\d{4}-[01]\\d-\\d{2}' // find ISO dates of form YYYY-MM-DD
export const RE_ISO_DATE = '\\d{4}-[01]\\d-[0123]\\d' // find ISO dates of form YYYY-MM-DD (stricter)
export const RE_SCHEDULED_ISO_DATE = '>\\d{4}-[01]\\d-[0123]\\d' // find scheduled dates of form >YYYY-MM-DD
export const RE_YYYYMMDD_DATE = '\\d{4}[01]\\d[0123]\\d' // find dates of form YYYYMMDD
export const RE_YYYY_Wnn_DATE = '\\d{4}\\-W[0-5]\\d' // find dates of form YYYY-Wnn
export const RE_DAILY_NOTE_FILENAME = '\\/?\\d{4}[0-1]\\d[0-3]\\d\\.'
export const RE_WEEKLY_NOTE_FILENAME = '\\/?\\d{4}-W[0-5]\\d\\.'
export const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?' // find '12:23' with optional '[ ][AM|PM|am|pm]'
export const RE_DATE_INTERVAL = `[+\\-]?\\d+[bdwmqy]`
export const RE_OFFSET_DATE = `{\\^?${RE_DATE_INTERVAL}}`
export const RE_OFFSET_DATE_CAPTURE = `{(\\^?${RE_DATE_INTERVAL})}`
export const RE_BARE_DATE = `[^\d(<\/-]${RE_DATE}` // an ISO date without a digit or ( or < or / or - before it
export const RE_BARE_DATE_CAPTURE = `[^\d(<\/-](${RE_DATE})` // capturing date in above

export const todaysDateISOString: string = new Date().toISOString().slice(0, 10)
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
  // logDebug('dateTime/toISODateString', `${dateObj.toISOString()} // ${toLocaleDateTimeString(dateObj)}`)
  return dateObj.toISOString().slice(0, 10)
}

// As ISODateString() doesn't work reliably across date boundaries except at GMT,
// this version creates YYYY-MM-DD format using the slight cheat of the sv-SE locale,
// which happens to be identical.
export function hyphenatedDate(date: Date): string {
  if (date != null) {
    // logDebug('dateTime/hyphenatedDate', `${toLocaleDateTimeString(date)} -> ${toLocaleDateString(date, 'sv-SE')}`)
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
  log('dateTime/printDateRange', `<${toISOShortDateTimeString(dr.start)} - ${toISOShortDateTimeString(dr.end)}>`)
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
 * TODO: support Weekly notes, when Eduard does through links
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
 * Return 
 * @param {string} filename 
 * @returns string YYYYMMDD date
 * @tests in jest file
 */
export function getDateStringFromCalendarFilename(filename: string): string {
  try {
    if (filename.match(RE_DAILY_NOTE_FILENAME)) {
      return filename.slice(0, 8)
    }
    else if (filename.match(RE_WEEKLY_NOTE_FILENAME)) {
      return weekStartDateStr(filename.slice(0, 8))
    }
    else {
      throw new Error(`Invalid calendar filename: ${filename}`)
    }
  } catch (err) {
    logError('dateTime / getDateStringFromCalendarFilename', err.message)
    return '(invalid date)' // for completeness
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
 * @return {string} - relative date string (e.g. today, 3w ago, 2m, 4y ago.)
 */
export function relativeDateFromNumber(diffIn: number): string {
  let output = ''
  let diff = diffIn
  let isPast = false
  // logDebug('dateTime/relativeDateFromNumber', `original diff = ${diff}`)
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
  // logDebug('dateTime/relativeDateFromNumber', `--> ${output}`)
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

  // logDebug('dateTime/getDateObjFromDateString', `for ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // logDebug('dateTime/getDateObjFromDateString', toISOShortDateTimeString(date))
    return date
  } else {
    logWarn('dateTime/getDateObjFromDateString', `getDateFromString: no valid date found in '${mention}'`)
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
 * @return {?Date} - JS Date version
 */
export function getDateFromUnhyphenatedDateString(inputString: string): ?Date {
  const RE_DATE_CAPTURE = `(\\d{4}[01]\\d{1}\\d{2})` // capture date of form YYYYMMDD

  // logDebug('dateTime/getDateFromUnhyphenatedDateString', inputString)
  const res = inputString.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1]?.length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(4, 6)) - 1, // only needed for months!
      Number(res[1].slice(6, 8)),
    )
    // logDebug('dateTime/getDateFromUnhyphenatedDateString', toISOShortDateTimeString(date))
    return date
  } else {
    logWarn('dateTime/getDateFromUnhyphenatedDateString', `  no valid date found in '${inputString}'`)
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
 * @param {string} startDate
 * @returns {string} YYYYMMDD
 * @tests in Jest file
*/
export function weekStartDateStr(inStr: string): string {
  try {
    if (inStr.match(RE_YYYY_Wnn_DATE)) {
      const parts = inStr.split('-W') // Split YYYY-Wnn string into parts
      const year = Number(parts[0])
      const week = Number(parts[1])
      const m = moment().year(year).isoWeeks(week).startOf('isoWeek')
      return m.format("YYYYMMDD")
    } else {
      throw new Error(`Invalid date ${inStr}`)
    }
  } catch (err) {
    logError('dateTime/weekStartDateStr', err.message)
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
  // logDebug('dateTime/calcWeekOffset', `${startYear}W${startWeek} - ${year}W${week}`)
  return { week, year }
}

/**
 * Calculate an offset date, as ISO Strings.
 * v4 method, using 'moment' library to avoid using NP calls
 * @author @jgclark
 *
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {string} new date in ISO Date format
 * @test - available in jest file
 */
export function calcOffsetDateStr(baseDateISO: string, interval: string): string {
  try {
    if (!interval.match(RE_DATE_INTERVAL)) {
      logError('dateTime/cODS', `Invalid date interval '${interval}'`)
      return '(error)'
    }

    const baseDateMoment = moment(baseDateISO, 'YYYY-MM-DD')
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
    // calc offset (Note: library functions cope with negative nums, so just always use 'add' function)
    const newDate = unit !== 'b' ? baseDateMoment.add(num, unitForMoment) : momentBusiness(baseDateMoment).businessAdd(num)
    const newDateISO = newDate.format('YYYY-MM-DD')
    // logDebug('dateTime/cODS', `for '${baseDateISO}' interval ${num} / ${unitForMoment} -> '${newDateISO}'`)
    return newDateISO
  } catch (e) {
    logError('dateTime/cODS', `${e.message} for '${baseDateISO}' interval '${interval}'`)
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
export const isValidCalendarNoteTitle = (text: string): boolean => (new RegExp("(([0-9]{4})-((0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])|W0[1-9]|W[1-4]\\d|W5[0-3]))").test(text))

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

  const yDisplay = y > 0 ? y + (y === 1 ? " year, " : " years, ") : ""
  const moDisplay = mo > 0 ? mo + (mo === 1 ? " month, " : " months, ") : ""
  const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : ""
  const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : ""
  const mDisplay = m > 0 ? m + (m === 1 ? " minute " : " minutes, ") : ""
  const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds ") : ""
  return yDisplay + moDisplay + dDisplay + hDisplay + mDisplay + sDisplay
}