/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import moment from 'moment/min/moment-with-locales'
import { clo } from '../../../../helpers/dev'

export function time(format: string = 'h:mm A') {
  return moment(new Date()).format(format && format.length > 0 ? format : 'h:mm A')
}

export function currentTime(format: string = 'h:mm A') {
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

    let [hours, minutes] = time.split(':')

    if (hours === '12') {
      hours = '00'
    }

    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12
    }

    return `${hours}:${minutes}`
  }

  format(format = '', date = '') {
    let dateValue = date.length > 0 ? date : new Date()
    const configFormat = this.config?.timeFormat || 'HH:mm A'
    format = format.length > 0 ? format : configFormat

    if (date instanceof Date) {
      return moment(date).format(format)
    } else {
      dateValue = new Date(date).toLocaleString()
      return moment(new Date(dateValue)).format(format)
    }
  }

  now(format = '', offset = '') {
    const locale = this.config?.locale || 'en-US'
    const configFormat = this.config?.timeFormat || 'short'

    format = format.length > 0 ? format : configFormat
    let formattedTime = moment(new Date()).format(format)

    // TODO: Implement offset for time

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
