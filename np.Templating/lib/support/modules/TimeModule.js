/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import moment from 'moment/min/moment-with-locales'

export function time(format = 'h:mm A') {
  return moment(new Date()).format(format && format.length > 0 ? format : 'h:mm A')
}

export function currentTime(format = 'h:mm A') {
  return moment(new Date()).format(format && format.length > 0 ? format : 'h:mm A')
}

export default class TimeModule {
  constructor(config) {
    this.config = config

    let osLocale = 'en-US'
    if (this.config?.locale?.length > 0) {
      osLocale = this.config?.locale
    }

    moment.locale(osLocale)
  }

  convertTime12to24(userTime = '') {
    if (userTime.length === 0) {
      return ''
    }

    const time12h = userTime.replace('_AM', ' AM').replace('_PM', ' PM')
    const [time, modifier] = time12h.split(' ')

    // eslint-disable-next-line
    let [hours, minutes] = time.split(':')

    if (hours === '12') {
      hours = '00'
    }

    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12
    }

    return `${hours}:${minutes}`
  }

  format(formatInput = '', dateInput = '') {
    const effectiveFormat = formatInput !== null && formatInput !== undefined && String(formatInput).length > 0 ? String(formatInput) : this.config?.timeFormat || 'h:mm A' // Default time format

    const locale = this.config?.locale || 'en-US'

    let dateToFormat // This will be a Date object

    if (dateInput instanceof Date && isFinite(dateInput.getTime())) {
      dateToFormat = dateInput // Already a valid Date object
    } else if (typeof dateInput === 'string' && dateInput.length > 0) {
      const m = moment(dateInput) // Try parsing the string with moment
      if (m.isValid()) {
        dateToFormat = m.toDate()
      } else {
        // If string is not a valid date/time, default to now
        // console.warn(`TimeModule.format: Invalid date string '${dateInput}' received. Defaulting to now.`);
        dateToFormat = new Date()
      }
    } else {
      // Default to current date/time if dateInput is empty, null, undefined, or unexpected type
      dateToFormat = new Date()
    }

    // Ensure dateToFormat is a valid, finite Date object for Intl.DateTimeFormat
    if (!(dateToFormat instanceof Date) || !isFinite(dateToFormat.getTime())) {
      // console.warn(`TimeModule.format: dateToFormat is not a finite Date after processing input:`, dateInput, `. Defaulting to now.`);
      dateToFormat = new Date() // Final fallback
    }

    let formattedTimeString
    if (effectiveFormat === 'short' || effectiveFormat === 'medium' || effectiveFormat === 'long' || effectiveFormat === 'full') {
      // Use Intl.DateTimeFormat for standard time styles
      formattedTimeString = new Intl.DateTimeFormat(locale, { timeStyle: effectiveFormat }).format(dateToFormat)
    } else {
      // Use moment for other specific formats
      formattedTimeString = moment(dateToFormat).format(effectiveFormat)
    }
    return this.isValid(formattedTimeString) // Assuming this.isValid is for the final string
  }

  now(format = '') {
    const locale = this.config?.locale || 'en-US'
    const configFormat = this.config?.timeFormat || 'short'

    format = format.length > 0 ? format : configFormat
    let formattedTime = moment(new Date()).format(format)

    if (format === 'short' || format === 'medium' || format === 'long' || format === 'full') {
      formattedTime = new Intl.DateTimeFormat(locale, { timeStyle: format }).format(new Date())
    }

    return this.isValid(formattedTime)
  }

  currentTime(format = '') {
    return this.now(format)
  }

  isValid(timeObj = null) {
    return timeObj
    // return timeObj && moment(timeObj).isValid() ? timeObj : 'INVALID_TIME_FORMAT'
  }
}
