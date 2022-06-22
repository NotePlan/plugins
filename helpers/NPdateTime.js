// @flow
//-------------------------------------------------------------------------------
// Date functions that rely on NotePlan functions/types
// @jgclark except where shown

import moment from 'moment'
import { getWeek, toISODateString, toISOShortDateTimeString } from './dateTime'
import { logError } from './dev'

// TODO: Finish moving references to this file from dateTime.js
export function toLocaleDateTimeString(dateObj: Date, locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {}): string {
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
export function toLocaleDateString(dateObj: Date, locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {}): string {
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
export function toLocaleTime(dateObj: Date, locale: string | Array<string> = [],
  options: Intl$DateTimeFormatOptions = {}): string {
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
 * DEPRECATED: Calculate an offset date, as a JS Date.
 * **Now use version in helpers/dateTime.js which doesn't rely on NP APIs, and has tests!**
 * v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
 * @author @jgclark
 *
 * @param {string} baseDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
 * @param {interval} string of form +nn[bdwmq] or -nn[bdwmq], where 'b' is weekday (i.e. Monday - Friday in English)
 * @return {Date} new date as a JS Date
 */
export function calcOffsetDate(baseDateISO: string, interval: string): Date {
  try {
    const momentDate = moment(baseDateISO) // use moment() to work in the local timezone [says @dwertheimer]
    // const baseDate = new Date(baseDateISO)
    const baseDate = new Date(momentDate.format()) // ditto
    // log('calcOffsetDate()', `baseDateISO:${baseDateISO} momentDate:${momentDate} baseDate:${baseDate.toString()}`)
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
  } catch (e) {
    logError('helpers/calcOffsetDate', `${e.message} for baseDateISO '${baseDateISO}'`)
    // $FlowIgnore
    return
  }
}

/**
 * DEPRECATED: Calculate an offset date, as ISO Strings.
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

/**
 * Return quarter start and end dates for a given quarter
  // TODO: date arithmetic in moment library and move to dateTime.js
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
 * Return start and end dates for a given week number.
 * Uses ISO 8601 definition of week, except that week start is Sunday not Monday.
 * TODO: Use moment library to do date math, and move to dateTime.js
 * - moment().isoWeek(n).year(n)?
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
    testWeek = getWeek(new Date(year, 0, firstDay))
  } while (testWeek !== 1)

  const startDate: Date = Calendar.addUnitToDate(new Date(year, 0, firstDay), 'day', (week - 1) * 7)
  const endDate: Date = Calendar.addUnitToDate(startDate, 'day', 6)
  // log('helpers/weekStartEnd', `  -> ${toLocaleTime(startDate)} - ${toLocaleTime(endDate)}`)
  return [startDate, endDate]
}

/**
 * Returns the user's chosen day of the week in the specified date according to UTC, where 0 represents Sunday.
 * @author @jgclark
 * @return {number}
 */
export function getUsersFirstDayOfWeekUTC(): number {
  // Get user preference for start of week.
  // In NP this is Sunday = 1 ...Sat = 6.  Can also be undefined -> 1.
  return (typeof DataStore.preference("firstDayOfWeek") === 'number') ? Number(DataStore.preference("firstDayOfWeek")) - 1 : 1
}
