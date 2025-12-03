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

    const osLocale = this._getLocale()
    moment.locale(osLocale)
  }

  /**
   * Get the locale to use for date/time formatting
   * If templateLocale is set to '<system>' or is empty, get from NotePlan environment
   * Otherwise use the configured value
   * @returns {string} locale string (e.g., 'en-US', 'fr-FR')
   * @private
   */
  _getLocale() {
    // Check both templateLocale (newer) and locale (legacy) for backwards compatibility
    const configLocale = this.config?.templateLocale || this.config?.locale

    // If no locale specified or set to '<system>', get from NotePlan environment
    if (!configLocale || configLocale === '' || configLocale === '<system>') {
      // $FlowFixMe[prop-missing] NotePlan.environment exists at runtime
      const envRegion = typeof NotePlan !== 'undefined' && NotePlan?.environment?.regionCode ? NotePlan.environment.regionCode : ''
      // $FlowFixMe[prop-missing] NotePlan.environment exists at runtime
      const envLanguage = typeof NotePlan !== 'undefined' && NotePlan?.environment?.languageCode ? NotePlan.environment.languageCode : ''

      if (envRegion !== '' && envLanguage !== '') {
        return `${envLanguage}-${envRegion}`
      }

      // Fallback to en-US if environment not available
      return 'en-US'
    }

    // Use the configured locale
    return configLocale
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

    const locale = this._getLocale()

    let momentToFormat // This will be a moment object

    if (dateInput instanceof Date && isFinite(dateInput.getTime())) {
      momentToFormat = moment(dateInput) // Convert Date to moment
    } else if (typeof dateInput === 'string' && dateInput.length > 0) {
      const m = moment(dateInput) // Try parsing the string with moment
      if (m.isValid()) {
        // If the input has a timezone offset, use UTC interpretation for consistency
        if (dateInput.includes('T') && (dateInput.includes('+') || dateInput.includes('-') || dateInput.includes('Z'))) {
          const hasTimezoneOffset = /[+-]\d{2}:\d{2}$/.test(dateInput) || dateInput.endsWith('Z')
          if (hasTimezoneOffset) {
            momentToFormat = m.utc() // Use UTC interpretation for timezone-aware inputs
          } else {
            momentToFormat = m // Keep as moment object
          }
        } else {
          momentToFormat = m // Keep as moment object
        }
      } else {
        // If string is not a valid date/time, default to now
        // console.warn(`TimeModule.format: Invalid date string '${dateInput}' received. Defaulting to now.`);
        momentToFormat = moment()
      }
    } else {
      // Default to current date/time if dateInput is empty, null, undefined, or unexpected type
      momentToFormat = moment()
    }

    // Ensure momentToFormat is a valid moment object
    if (!momentToFormat || !momentToFormat.isValid()) {
      // console.warn(`TimeModule.format: momentToFormat is not a valid moment after processing input:`, dateInput, `. Defaulting to now.`);
      momentToFormat = moment() // Final fallback
    }

    let formattedTimeString
    if (effectiveFormat === 'short' || effectiveFormat === 'medium' || effectiveFormat === 'long' || effectiveFormat === 'full') {
      // Use Intl.DateTimeFormat for standard time styles
      formattedTimeString = new Intl.DateTimeFormat(locale, { timeStyle: effectiveFormat }).format(momentToFormat.toDate())
    } else {
      // Use moment for other specific formats
      formattedTimeString = momentToFormat.format(effectiveFormat)
    }
    return this.isValid(formattedTimeString) // Assuming this.isValid is for the final string
  }

  now(format = '') {
    const locale = this._getLocale()
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
