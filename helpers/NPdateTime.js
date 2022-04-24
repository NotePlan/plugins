// @flow
//-------------------------------------------------------------------------------
// Date functions that rely on NotePlan functions/types
// @jgclark except where shown

import strftime from 'strftime'
import {
  toISODateString,
  toISOShortDateTimeString
} from './dateTime'
import { log, logError } from './dev'

// TODO: Finish moving references to this file from dateTime.js
export function toLocaleDateTimeString(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  /**
   * TODO: use details from NotePlan.environment...
   *  "languageCode": "en",
   *   "regionCode": "GB",
   *   "is12hFormat": 0,
   *   "preferredLanguages": [
   *     "en-GB"
   *   ],
  */
  return dateObj.toLocaleString(locale, options)
}

// TODO: Finish moving references to this file from dateTime.js
export function toLocaleDateString(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  /**
   * TODO: use details from NotePlan.environment...
   *  "languageCode": "en",
   *   "regionCode": "GB",
   *   "preferredLanguages": [
   *     "en-GB"
   *   ],
  */
  return dateObj.toLocaleDateString(locale, options)
}

// TODO: Finish moving references to this file from dateTime.js
export function toLocaleTime(
  dateObj: Date,
  locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {},
): string {
  /**
   * TODO: use details from NotePlan.environment...
   *  "languageCode": "en",
   *   "regionCode": "GB",
   *   "is12hFormat": 0,
   *   "preferredLanguages": [
   *     "en-GB"
   *   ],
  */
  return dateObj.toLocaleTimeString(locale, options)
}

export function printDateRange(dr: DateRange) {
  console.log(`DateRange <${toISOShortDateTimeString(dr.start)} - ${toISOShortDateTimeString(dr.end)}>`)
}

/**
 * Calculate an offset date, as a JS Date.
 * v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
 * @author @jgclark
 * 
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {Date} new date as a JS Date
 */
export function calcOffsetDate(baseDateISO: string, interval: string): Date {
  try {
    const baseDate = new Date(baseDateISO)
    let daysToAdd = 0
    let monthsToAdd = 0
    let yearsToAdd = 0
    const unit = interval.charAt(interval.length - 1) // get last character
    let num = Number(interval.substr(0, interval.length - 1)) // return all but last character
    // log('helpers/calcOffsetDate', `base: ${toISODateString(baseDate)} / ${num} / ${unit}`)

    switch (unit) {
      case 'b': {
        // week days
        // Method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
        // Avoids looping, and copes with negative intervals too
        const currentDayOfWeek = baseDate.getUTCDay() // = day of week with Sunday = 0, ..Saturday = 6
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
        logError('helpers/calcOffsetDate', `Invalid date interval: '${interval}'`)
        break
    }

    // Now add (or subtract) the number, using NP's built-in helper
    const newDate =
      Math.abs(daysToAdd) > 0
        ? Calendar.addUnitToDate(baseDate, 'day', daysToAdd)
        : Math.abs(monthsToAdd) > 0
          ? Calendar.addUnitToDate(baseDate, 'month', monthsToAdd)
          : Math.abs(yearsToAdd) > 0
            ? Calendar.addUnitToDate(baseDate, 'year', yearsToAdd)
            : baseDate // if nothing else, leave date the same

    return newDate
  }
  catch (e) {
    logError('helpers/calcOffsetDate', `${e.message} for baseDateISO '${baseDateISO}'`)
  }
}

/**
 * Calculate an offset date, as a JS Date.
 * v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
 * NB: doesn't actually use NP functions, but to avoid a circular dependency it needs to be in this file.
 * @author @jgclark
 * 
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {string} new date in ISO Date format
 */
export function calcOffsetDateStr(baseDateISO: string, interval: string): string {
  const newDate = calcOffsetDate(baseDateISO, interval)
  return toISODateString(newDate)
}

// Expected output for various tests of this function
// console.log(`2022-01-01 +0d  -> ${calcOffsetDateStr('2022-01-01', '+0d')}`) // 2022-01-01
// console.log(`2022-01-01 +10d -> ${calcOffsetDateStr('2022-01-01', '+10d')}`) // 2022-01-11
// console.log(`2022-01-01 -1d  -> ${calcOffsetDateStr('2022-01-01', '-1d')}`) // 2021-12-31
// console.log(`2022-01-01 +2w  -> ${calcOffsetDateStr('2022-01-01', '+2w')}`) // 2022-01-15


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

// TODO: Finish moving references to this file from dateTime.js
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
