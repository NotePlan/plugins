/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------
 * NOTE: Updated to intercept .format() calls and replaces 'w', 'ww', 'W', 'WW' tokens
 * with Calendar.weekNumber() calls instead of moment's ISO week calculations.
 * @author @dwertheimer
 * -----------------------------------------------------------------------------------------*/

/* eslint-disable */

import moment from 'moment/min/moment-with-locales'
import { formatWithNotePlanWeeks } from '@helpers/notePlanWeekFormatter'
import { default as momentBusiness } from 'moment-business-days'

// Suppress deprecation warnings for better test output and cleaner logs
moment.suppressDeprecationWarnings = true

export const DAY_NUMBER_SUNDAY = 0
export const DAY_NUMBER_MONDAY = 1
export const DAY_NUMBER_TUESDAY = 2
export const DAY_NUMBER_WEDNESDAY = 3
export const DAY_NUMBER_THURSDAY = 4
export const DAY_NUMBER_FRIDAY = 5
export const DAY_NUMBER_SATURDAY = 6

export function createDateTime(userDateString = '') {
  return userDateString.length === 10 ? new moment(userDateString).toDate() : new moment().toDate()
}

export function format(format: string = 'YYYY-MM-DD', dateString: string = '') {
  const dt = dateString ? moment(dateString).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')
  return formatWithNotePlanWeeks(moment(createDateTime(dt)), format && format.length > 0 ? format : 'YYYY-MM-DD')
}

export function currentDate(format: string = 'YYYY-MM-DD') {
  return formatWithNotePlanWeeks(moment(new Date()), format && format.length > 0 ? format : 'YYYY-MM-DD')
}

export function date8601() {
  return moment().format('YYYY-MM-DD')
}

export default class DateModule {
  constructor(config = {}) {
    this.config = config

    // setup date/time local, using configuration locale if exists, otherwise fallback to system locale
    const osLocale = this.config?.templateLocale?.length > 0 ? this.config?.templateLocale : 'en-US'
    moment.locale(osLocale)

    // module constants
    this.DAY_NUMBER_SUNDAY = DAY_NUMBER_SUNDAY
    this.DAY_NUMBER_MONDAY = DAY_NUMBER_MONDAY
    this.DAY_NUMBER_TUESDAY = DAY_NUMBER_TUESDAY
    this.DAY_NUMBER_WEDNESDAY = DAY_NUMBER_WEDNESDAY
    this.DAY_NUMBER_THURSDAY = DAY_NUMBER_THURSDAY
    this.DAY_NUMBER_FRIDAY = DAY_NUMBER_FRIDAY
    this.DAY_NUMBER_SATURDAY = DAY_NUMBER_SATURDAY
  }

  setLocale() {
    const osLocale = this.config?.templateLocale?.length > 0 ? this.config?.templateLocale : 'en-US'
    moment.locale(osLocale)
  }

  ref(value = '') {
    return moment(value)
  }

  // Provide direct access to moment.js formatting without NotePlan week intervention
  get moment() {
    return moment
  }

  // convert supplied date value into something that NotePlan can actually handle
  // requiring YYYY-MM-DDThh:mm:ss format
  createDateTime(userDateString = '') {
    return userDateString.length === 10 ? new Date(`${userDateString}T00:01:00`) : new Date()
  }

  timestamp(format = '') {
    this.setLocale() // Ensure locale is set for moment
    const formatStr = String(format).trim()

    if (formatStr.length > 0) {
      if (formatStr === 'UTC_ISO') {
        return moment.utc().format() // Returns standard UTC ISO8601 string (e.g., YYYY-MM-DDTHH:mm:ssZ)
      }
      // Use formatWithNotePlanWeeks for NotePlan-compatible week numbering
      return formatWithNotePlanWeeks(moment(), formatStr)
    } else {
      // Default: local time, full ISO 8601 like timestamp with timezone offset
      return moment().format() // e.g., "2023-10-27T17:30:00-07:00"
    }
  }

  format(formatInput = '', dateInput = '') {
    const effectiveFormat = formatInput !== null && formatInput !== undefined && String(formatInput).length > 0 ? String(formatInput) : this.config?.dateFormat || 'YYYY-MM-DD'
    const locale = this.config?.templateLocale || 'en-US'
    this.setLocale()

    let dateToFormat // This will be a Date object

    if (dateInput instanceof moment) {
      dateToFormat = dateInput.toDate() // Convert moment object to Date
    } else if (typeof dateInput === 'string' && dateInput.length > 0) {
      const m = moment(dateInput) // Moment is robust for parsing various string formats
      if (m.isValid()) {
        dateToFormat = m.toDate()
      } else {
        // console.warn(`DateModule.format: Invalid date string '${dateInput}' received. Defaulting to now.`);
        dateToFormat = new Date() // Fallback
      }
    } else if (dateInput instanceof Date && isFinite(dateInput.getTime())) {
      dateToFormat = dateInput // Already a valid Date object
    } else {
      // Default to current date if dateInput is empty, invalid, or unexpected type
      // Use moment() to get current date consistently with timezone handling
      dateToFormat = moment().toDate()
    }

    // Ensure dateToFormat is a valid, finite Date object for Intl.DateTimeFormat
    if (!(dateToFormat instanceof Date) || !isFinite(dateToFormat.getTime())) {
      // console.warn(`DateModule.format: dateToFormat is not a finite Date after processing input:`, dateInput, `. Defaulting to now.`);
      dateToFormat = moment().toDate() // Final fallback - use moment for consistent timezone handling
    }

    let formattedDateString
    if (effectiveFormat === 'short' || effectiveFormat === 'medium' || effectiveFormat === 'long' || effectiveFormat === 'full') {
      formattedDateString = new Intl.DateTimeFormat(locale, { dateStyle: effectiveFormat }).format(dateToFormat)
    } else {
      // Use formatWithNotePlanWeeks for NotePlan-compatible week numbering
      // Convert Date object to moment instance for compatibility
      formattedDateString = formatWithNotePlanWeeks(moment(dateToFormat), effectiveFormat)
    }
    return formattedDateString
  }

  now(format = '', dateOrOffset = '') {
    const locale = this.config?.templateLocale || 'en-US'
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const effectiveFormat = typeof format === 'string' && format.length > 0 ? format : configFormat

    this.setLocale()
    let momentToProcess

    // Handle different types of second parameter
    if (dateOrOffset !== null && dateOrOffset !== undefined && dateOrOffset !== '') {
      if (typeof dateOrOffset === 'number') {
        // Numeric offset - treat as days
        const dateValue = moment().toDate()
        momentToProcess = moment(dateValue).add(dateOrOffset, 'days')
      } else if (typeof dateOrOffset === 'string' && dateOrOffset.trim().length > 0) {
        const dateStr = dateOrOffset.trim()
        
        // Check if it looks like a date string (contains dashes, slashes, or is a full date)
        const looksLikeDate = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr) || 
                             /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(dateStr) ||
                             /^[A-Za-z]+\s+\d{1,2},?\s+\d{4}/.test(dateStr) ||
                             /^\d{4}-\d{2}-\d{2}T/.test(dateStr)
        
        if (looksLikeDate) {
          // Try to parse as a date first
          const parsedDate = moment(dateStr)
          if (parsedDate.isValid()) {
            // It's a valid date, use it
            momentToProcess = parsedDate
          } else {
            // Not a valid date, treat as offset
            const dateValue = moment().toDate()
            momentToProcess = moment(dateValue)
            this._applyOffset(momentToProcess, dateStr)
          }
        } else {
          // Doesn't look like a date, treat as offset
          const dateValue = moment().toDate()
          momentToProcess = moment(dateValue)
          this._applyOffset(momentToProcess, dateStr)
        }
      } else {
        // Unexpected type, use current date
        const dateValue = moment().toDate()
        momentToProcess = moment(dateValue)
      }
    } else {
      // No second parameter, use current date
      const dateValue = moment().toDate()
      momentToProcess = moment(dateValue)
    }

    let formattedDate
    if (effectiveFormat === 'short' || effectiveFormat === 'medium' || effectiveFormat === 'long' || effectiveFormat === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: effectiveFormat }).format(momentToProcess.toDate())
    } else {
      // Use formatWithNotePlanWeeks for NotePlan-compatible week numbering
      formattedDate = formatWithNotePlanWeeks(momentToProcess, effectiveFormat)
    }

    return this.isValid(formattedDate)
  }

  _applyOffset(momentToProcess, offsetStr) {
    let successfullyAppliedOffset = false

    // Try to parse as shorthand first (e.g., "1w", "-2m", "+7d")
    // Regex: optional sign, numbers (with optional decimal), then letters
    const shorthandMatch = offsetStr.match(/^([+-]?[0-9\.]+)([a-zA-Z]+)$/)
    if (shorthandMatch) {
      const value = parseFloat(shorthandMatch[1])
      const unit = shorthandMatch[2]
      if (!isNaN(value) && unit.length > 0) {
        // Moment's add/subtract take positive magnitude for subtract
        if (value < 0) {
          momentToProcess.subtract(Math.abs(value), unit)
        } else {
          momentToProcess.add(value, unit)
        }
        successfullyAppliedOffset = true
      }
    }

    if (!successfullyAppliedOffset) {
      // If not parsed as shorthand, try as a plain number (for days)
      const numDays = parseFloat(offsetStr)
      if (!isNaN(numDays)) {
        momentToProcess.add(numDays, 'days')
        successfullyAppliedOffset = true
      }
    }

    // If offset was provided but couldn't be parsed, momentToProcess remains unchanged
    // which means no offset is applied
  }

  date8601() {
    return moment().format('YYYY-MM-DD')
  }

  today(format = '') {
    this.setLocale()

    return this.format(format, moment().toDate())
  }

  tomorrow(format = '') {
    this.setLocale()

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment().add(1, 'days')

    return this.format(format, dateValue)
  }

  yesterday(format = '') {
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment().subtract(1, 'days')

    return this.format(format, dateValue)
  }

  /**
   * Returns a date by adding or subtracting a number of business days from a pivot date.
   *
   * @param {string} [format=''] - Desired date format. Uses config.dateFormat or 'YYYY-MM-DD' if empty.
   * @param {number} [offset=1] - Number of business days to add (positive) or subtract (negative).
   * @param {string} [pivotDate=''] - The starting date in 'YYYY-MM-DD' format. Defaults to the current date.
   * @returns {string} Formatted date string.
   */
  weekday(format = '', offset = 1, pivotDate = '') {
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const finalFormat = format !== null && format !== undefined && String(format).length > 0 ? String(format) : configFormat

    const numBusinessDays = typeof offset === 'number' ? offset : parseInt(offset, 10)

    if (isNaN(numBusinessDays)) {
      // console.error("DateModule.weekday: Invalid offset provided. Expected a number.");
      // Fallback or throw error? For now, let's try to format the pivotDate or today if offset is invalid.
      const baseDateForInvalidOffset = pivotDate && pivotDate.length === 10 ? this.createDateTime(pivotDate) : new Date()
      return this.format(finalFormat, baseDateForInvalidOffset)
    }

    const baseDate =
      pivotDate && pivotDate.length === 10
        ? this.createDateTime(pivotDate) // Returns a Date object
        : new Date() // Defaults to now, local time (Date object)

    // Wrap with momentBusiness to get access to businessAdd/businessSubtract
    const baseMomentBusinessDate = momentBusiness(baseDate)

    let targetMomentDate
    if (numBusinessDays >= 0) {
      targetMomentDate = baseMomentBusinessDate.businessAdd(numBusinessDays).toDate() // Convert back to Date for consistency with this.format
    } else {
      // businessSubtract expects a positive number, so take the absolute value
      targetMomentDate = baseMomentBusinessDate.businessSubtract(Math.abs(numBusinessDays)).toDate() // Convert back to Date
    }

    return this.format(finalFormat, targetMomentDate) // this.format expects a Date or string
  }

  weekNumber(pivotDate = '') {
    this.setLocale()

    const dateValue = pivotDate.length === 10 ? pivotDate : new Date()

    // Use Calendar.weekNumber directly instead of moment's ISO week calculation
    let dateToCheck
    if (typeof dateValue === 'string') {
      dateToCheck = moment(dateValue).toDate()
    } else {
      dateToCheck = dateValue
    }

    // $FlowFixMe[prop-missing] Calendar will exist inside NotePlan
    // For test environment, fall back to utility function for NotePlan week calculation
    if (typeof Calendar !== 'undefined' && Calendar.weekNumber) {
      return Calendar.weekNumber(dateToCheck)
    } else {
      // Fallback for test environment: use formatWithNotePlanWeeks utility
      const momentInstance = moment(dateToCheck)
      const weekStr = formatWithNotePlanWeeks(momentInstance, 'w')
      return parseInt(weekStr)
    }
  }

  dayNumber(pivotDate = '') {
    this.setLocale()

    let localeDate = new moment().toLocaleString()
    if (pivotDate.length > 0 && pivotDate.length === 10) {
      localeDate = this.createDateTime(pivotDate)
    }

    let dayNumber = new moment(localeDate).day()
    if (isNaN(dayNumber)) {
      dayNumber = new moment().day()
    }
    return dayNumber
  }

  isWeekend(pivotDate = '') {
    let localeDate = new moment().toLocaleString()
    if (pivotDate.length > 0 && pivotDate.length === 10) {
      // coerce date format to YYYY-MM-DD (might come in as MM/DD/YYYY)
      const formattedDate = moment(pivotDate).format('YYYY-MM-DD')
      localeDate = this.createDateTime(formattedDate)
    }

    const day = new moment(localeDate).day()

    return day === 6 || day === 0
  }

  isWeekday(pivotDate = '') {
    return !this.isWeekend(pivotDate)
  }

  weekOf(startDayOpt = 0, endDayOpt = 6, userPivotDate = '') {
    // Determine pivotDate and the first day of the week to use
    let firstDayOfWeekToUse = 0
    let pivotDateToUse = ''

    if (typeof startDayOpt === 'string') {
      // This occurs when pivotDate is passed as the first parameter, e.g., date.weekOf('2023-01-01')
      pivotDateToUse = startDayOpt
      // firstDayOfWeekToUse remains 0 (default for Sunday start, assuming startOfWeek/endOfWeek handle this)
    } else {
      firstDayOfWeekToUse = startDayOpt !== null && startDayOpt !== undefined ? startDayOpt : 0
      pivotDateToUse = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD') // Default to today if no pivotDate
    }

    // Get the start and end of the week using the class's own methods
    // Pass 'YYYY-MM-DD' for internal calculations, final formatting is via this.format inside those methods
    const startDate = this.startOfWeek('YYYY-MM-DD', pivotDateToUse, firstDayOfWeekToUse)
    const endDate = this.endOfWeek('YYYY-MM-DD', pivotDateToUse, firstDayOfWeekToUse)

    // weekNumber calculation might need revisiting for full consistency with firstDayOfWeekToUse
    // For now, using the existing weekNumber method.
    const weekNum = this.weekNumber(pivotDateToUse)

    return `W${weekNum} (${startDate}..${endDate})`
  }

  startOfWeek(format = '', userPivotDate = '', firstDayOfWeek = 0) {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    // Convert to Date object for Calendar.startOfWeek
    let dateToProcess
    if (typeof pivotDate === 'string') {
      dateToProcess = moment(pivotDate).toDate()
    } else {
      dateToProcess = this.createDateTime(pivotDate)
    }

    let result
    // $FlowFixMe[prop-missing] Calendar will exist inside NotePlan
    if (typeof Calendar !== 'undefined' && Calendar.startOfWeek) {
      // Use NotePlan's native startOfWeek which respects user's week start preference
      result = Calendar.startOfWeek(dateToProcess)

      // Apply additional firstDayOfWeek offset if specified (for backward compatibility)
      if (firstDayOfWeek > 0) {
        result = moment(result).add(firstDayOfWeek, 'days').toDate()
      }
    } else {
      // Fallback to moment's behavior for test environments
      result = moment(dateToProcess).startOf('week')
      if (firstDayOfWeek > 0) {
        result = moment(dateToProcess).startOf('week').add(firstDayOfWeek, 'days')
      }
      result = result.toDate()
    }

    return this.format(format, result)
  }

  endOfWeek(format = '', userPivotDate = '', firstDayOfWeek = 0) {
    format = format ? format : '' // coerce if user passed null
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    // Convert to Date object for Calendar.endOfWeek
    let dateToProcess
    if (typeof pivotDate === 'string') {
      dateToProcess = moment(pivotDate).toDate()
    } else {
      dateToProcess = this.createDateTime(pivotDate)
    }

    let result
    // $FlowFixMe[prop-missing] Calendar will exist inside NotePlan
    if (typeof Calendar !== 'undefined' && Calendar.endOfWeek) {
      // Use NotePlan's native endOfWeek which respects user's week start preference
      result = Calendar.endOfWeek(dateToProcess)

      // Apply additional firstDayOfWeek offset if specified (for backward compatibility)
      if (firstDayOfWeek > 0) {
        result = moment(result).add(firstDayOfWeek, 'days').toDate()
      }
    } else {
      // Fallback to moment's behavior for test environments
      result = moment(dateToProcess).endOf('week')
      if (firstDayOfWeek > 0) {
        result = moment(dateToProcess).endOf('week').add(firstDayOfWeek, 'days')
      }
      result = result.toDate()
    }

    return this.format(format, result)
  }

  startOfMonth(format = '', userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let firstOfMonth = moment(pivotDate).startOf('month')

    return this.format(format, firstOfMonth)
  }

  endOfMonth(format = '', userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let firstOfMonth = moment(pivotDate).endOf('month')

    return this.format(format, firstOfMonth)
  }

  daysInMonth(userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    return moment(pivotDate).daysInMonth()
  }

  daysBetween(startDate = '', endDate = '') {
    if (startDate.length !== 10) {
      return 'Invalid Start Date'
    }

    if (endDate.length !== 10) {
      return 'Invalid End Date'
    }

    return moment(new Date(endDate)).diff(moment(new Date(startDate)), 'days')
  }

  add(userPivotDate = '', value = '', shorthand = 'days', format = '') {
    const locale = this.config?.templateLocale || 'en-US'
    const pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    // DateModule `pivotDate` will be formatted YYYY-MM-DD, need to add the time part
    const dt = this.createDateTime(pivotDate)

    const shorthandKeys = ['y', 'Q', 'M', 'w', 'd', 'h', 'm', 's', 'ms']
    if (typeof value === 'string') {
      const match = shorthandKeys.filter((item) => value.indexOf(item) !== -1)
      if (match.length > 0) {
        shorthand = match[0] // take the first matching value
        value = value.replace(/\D/g, '') // get number portion
      }
    }

    let result = moment(new Date(dt)).add(value, shorthand)

    return this.format(format, result)
  }

  subtract(userPivotDate = '', value = '', shorthand = 'days', format = '') {
    const pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    // DateModule `pivotDate` will be formatted YYYY-MM-DD, need to add the time part
    const dt = this.createDateTime(pivotDate)

    const shorthandKeys = ['y', 'Q', 'M', 'w', 'd', 'h', 'm', 's', 'ms']
    if (typeof value === 'string') {
      const match = shorthandKeys.filter((item) => value.indexOf(item) !== -1)
      if (match.length > 0) {
        shorthand = match[0] // take the first matching value
        value = value.replace(/\D/g, '') // get number portion
      }
    }

    value = Math.abs(value) // just in case the user passsed a negative value

    let result = moment(new Date(dt)).subtract(value, shorthand)

    return this.format(format, result)
  }

  businessAdd(numDays = 1, pivotDate = '', format = '') {
    const locale = this.config?.templateLocale || 'en-US'
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat

    const dt = pivotDate.length === 10 ? new Date(`${pivotDate}T00:01:00`) : new Date()
    let result = momentBusiness(dt).businessAdd(numDays)

    let formattedDate = formatWithNotePlanWeeks(result, dtFormat)
    if (dtFormat === 'short' || dtFormat === 'medium' || dtFormat === 'long' || dtFormat === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: dtFormat }).format(result)
    }

    return formattedDate
  }

  businessSubtract(numDays = 1, pivotDate = '', format = '') {
    const locale = this.config?.templateLocale || 'en-US'
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat

    const dt = pivotDate.length === 10 ? new Date(`${pivotDate}T00:01:00`) : new Date()
    let result = momentBusiness(dt).businessSubtract(numDays)

    let formattedDate = formatWithNotePlanWeeks(result, dtFormat)
    if (dtFormat === 'short' || dtFormat === 'medium' || dtFormat === 'long' || dtFormat === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: dtFormat }).format(result)
    }

    return formattedDate
  }

  nextBusinessDay(pivotDate = '', format = '') {
    return this.businessAdd(1, pivotDate, format)
  }

  previousBusinessDay(pivotDate = '', format = '') {
    return this.businessSubtract(1, pivotDate, format)
  }

  fromNow(pivotDate = '', offset = '') {
    return 'INCOMPLETE'
  }

  /**
   * Calculates the number of days from today until the target date.
   * Uses local time for calculations.
   *
   * @param {string} targetDateString - The target date in 'YYYY-MM-DD' format.
   * @param {boolean} [includeToday=false] - Whether to include today in the count.
   *   When true, adds 1 to the result to include today in the span.
   * @returns {number} The number of days until the target date.
   *   Positive for future dates, negative for past dates.
   */
  daysUntil(targetDateString, includeToday = false) {
    this.setLocale() // Ensure locale is set

    if (!targetDateString || typeof targetDateString !== 'string' || targetDateString.length !== 10) {
      // console.error("DateModule.daysUntil: Invalid targetDateString provided. Expected 'YYYY-MM-DD'.");
      return 'days until: invalid date'
    }

    const targetMoment = moment(targetDateString, 'YYYY-MM-DD').startOf('day')
    const todayMoment = moment().startOf('day')

    if (!targetMoment.isValid()) {
      // console.error("DateModule.daysUntil: targetDateString is not a valid date.");
      return 'days until: invalid date'
    }

    let diff = targetMoment.diff(todayMoment, 'days')

    if (includeToday) {
      // Add 1 to include today in the span calculation
      // For future dates: includes today in the countdown (3 days -> 4 days)
      // For past dates: includes today in elapsed time (-3 days -> -2 days)
      diff += 1
    }

    return diff
  }

  isValid(dateObj = null) {
    return dateObj
    // return dateObj && moment(dateObj).isValid() ? dateObj : 'INVALID_DATE_FORMAT'
  }
}
