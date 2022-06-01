/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import moment from 'moment/min/moment-with-locales'
import { default as momentBusiness } from 'moment-business-days'

export const DAY_NUMBER_SUNDAY = 0
export const DAY_NUMBER_MONDAY = 1
export const DAY_NUMBER_TUESDAY = 2
export const DAY_NUMBER_WEDNESDAY = 3
export const DAY_NUMBER_THURSDAY = 4
export const DAY_NUMBER_FRIDAY = 5
export const DAY_NUMBER_SATURDAY = 6

export function createDateTime(userDateString = '') {
  return userDateString.length === 10 ? new Date(`${userDateString}T00:01:00`) : new Date()
}

export function format(format: string = 'YYYY-MM-DD', dateString: string = '') {
  const dt = moment(dateString).format('YYYY-MM-DD')
  return moment(createDateTime(dt)).format(format && format.length > 0 ? format : 'YYYY-MM-DD')
}

export function now(format: string = 'YYYY-MM-DD') {
  return moment(new Date()).format(format && format.length > 0 ? format : 'YYYY-MM-DD')
}

export function currentDate(format: string = 'YYYY-MM-DD') {
  return moment(new Date()).format(format && format.length > 0 ? format : 'YYYY-MM-DD')
}

export function date8601() {
  return now()
}

export function timestamp(format: string = '') {
  const nowFormat = format.length > 0 ? format : 'YYYY-MM-DD h:mm A'

  return now(nowFormat)
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

  // convert supplied date value into something that NotePlan can actually handle
  // requiring YYYY-MM-DDThh:mm:ss format
  createDateTime(userDateString = '') {
    return userDateString.length === 10 ? new Date(`${userDateString}T00:01:00`) : new Date()
  }

  timestamp(format = '') {
    this.setLocale()

    const nowFormat = this.config?.timestampFormat || 'YYYY-MM-DD h:mm A'

    return this.now(nowFormat)
  }

  format(format = '', date = '') {
    this.setLocale()

    let dateValue = date.length > 0 ? new Date(date) : new Date()
    if (date.length === 10) {
      dateValue = moment(date).format('YYYY-MM-DD')
    }

    if (date instanceof moment) {
      dateValue = new Date(date)
    }

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const locale = this.config?.templateLocale || 'en-US'
    format = format.length > 0 ? format : configFormat

    let formattedDate = moment(date).format(format)

    if (format === 'short' || format === 'medium' || format === 'long' || format === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: format }).format(dateValue)
    }

    return formattedDate
  }

  now(format = '', offset = '') {
    const locale = this.config?.templateLocale || 'en-US'

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    const dateValue = new Date()

    this.setLocale()
    let formattedDate = moment(dateValue).format(format)
    if (offset) {
      offset = `${offset}` // convert to string for further processing and usage below

      let newDate = ''
      // supplied positive/negative number
      if (offset.match(/^[+-]?([0-9]*\.?[0-9]+|[0-9]+\.?[0-9]*)([eE][+-]?[0-9]+)?$/)) {
        newDate = offset.includes('-') ? moment(dateValue).subtract(Math.abs(offset), 'days') : moment(dateValue).add(offset, 'days')
      } else {
        const shorthand = offset[offset.length - 1]
        const value = offset.replace(shorthand, '')

        newDate = offset.includes('-') ? moment(dateValue).subtract(Math.abs(value), shorthand) : moment(dateValue).add(value, shorthand)
      }

      formattedDate = moment(newDate).format(format)
    }

    if (format === 'short' || format === 'medium' || format === 'long' || format === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: format }).format(new Date())
    }

    return this.isValid(formattedDate)
  }

  date8601() {
    return this.now()
  }

  today(format = '') {
    this.setLocale()

    return this.format(format, new Date())
  }

  tomorrow(format = '') {
    this.setLocale()

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment(new Date()).add(1, 'days')

    return this.format(format, dateValue)
  }

  yesterday(format = '') {
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment(new Date()).subtract(1, 'days')

    return this.format(format, dateValue)
  }

  weekday(format = '', offset = 1, pivotDate = '') {
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    const offsetValue = typeof offset === 'number' ? offset : parseInt(offset)

    const dateValue = pivotDate.length === 0 ? new Date() : new Date(this.createDateTime(pivotDate))

    return moment(dateValue).weekday(offsetValue).format(format)
  }

  weekNumber(pivotDate = '') {
    this.setLocale()

    const dateValue = pivotDate.length === 10 ? pivotDate : new Date()
    const dateStr = moment(dateValue).format('YYYY-MM-DD')
    let weekNumber = parseInt(this.format('W', dateStr))

    if (this.dayNumber(pivotDate) === 0) {
      weekNumber++
    }

    return weekNumber
  }

  dayNumber(pivotDate = '') {
    this.setLocale()

    let localeDate = new Date().toLocaleString()
    if (pivotDate.length > 0 && pivotDate.length === 10) {
      localeDate = this.createDateTime(pivotDate)
    }

    let dayNumber = new Date(new Date(localeDate).toLocaleString()).getDay()
    if (isNaN(dayNumber)) {
      dayNumber = new Date().getDay()
    }
    return dayNumber
  }

  isWeekend(pivotDate = '') {
    let localeDate = new Date().toLocaleString()
    if (pivotDate.length > 0 && pivotDate.length === 10) {
      // coerce date format to YYYY-MM-DD (might come in as MM/DD/YYYY)
      const formattedDate = moment(pivotDate).format('YYYY-MM-DD')
      localeDate = this.createDateTime(formattedDate)
    }

    const day = new Date(new Date(localeDate).toLocaleString()).getDay()

    return day === 6 || day === 0
  }

  isWeekday(pivotDate = '') {
    return !this.isWeekend(pivotDate)
  }

  weekOf(startDay = 0, endDay = 6, userPivotDate = '') {
    // if only pivotDate supplied, apply defaults
    let startDayNumber = 0
    let endDayNumber = 6
    let pivotDate = ''
    if (typeof startDay === 'string') {
      // this will occur when pivotDate passed as first parameter
      pivotDate = startDay
    } else {
      startDayNumber = startDay ? startDay : 0
      endDayNumber = endDay ? endDay : 6
      pivotDate = userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')
    }

    const startDate = this.weekday('YYYY-MM-DD', startDayNumber, pivotDate)
    const endDate = this.weekday('YYYY-MM-DD', endDayNumber, pivotDate)
    const weekNumber = this.weekNumber(pivotDate)

    return `W${weekNumber} (${startDate}..${endDate})`
  }

  startOfWeek(format = '', userPivotDate = '', firstDayOfWeek = 0) {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let firstOfWeekDate = moment(pivotDate).startOf('week').format(format)
    if (firstDayOfWeek > 0) {
      firstOfWeekDate = moment(pivotDate).startOf('week').add(firstDayOfWeek, 'days').format(format)
    }

    return firstOfWeekDate
  }

  endOfWeek(format = '', userPivotDate = '', firstDayOfWeek = 0) {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let endOfWeek = moment(pivotDate).endOf('week').format(format)
    if (firstDayOfWeek > 0) {
      endOfWeek = moment(pivotDate).endOf('week').add(firstDayOfWeek, 'days').format(format)
    }

    return endOfWeek
  }

  startOfMonth(format = '', userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let firstOfMonth = moment(pivotDate).startOf('month').format(format)
    console.log({ pivotDate, firstOfMonth })
    return firstOfMonth
  }

  endOfMonth(format = '', userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format && format.length > 0 ? format : configFormat

    let firstOfMonth = moment(pivotDate).endOf('month').format(format)

    return firstOfMonth
  }

  daysInMonth(userPivotDate = '') {
    let pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')

    return moment(pivotDate).daysInMonth()
  }

  add(userPivotDate = '', value = '', shorthand = 'days', format = '') {
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

    return moment(new Date(pivotDate)).add(value, shorthand).format(format)
  }

  subtract(userPivotDate = '', value = '', shorthand = 'days', format = '') {
    const pivotDate = userPivotDate && userPivotDate.length > 0 ? userPivotDate : moment(new Date()).format('YYYY-MM-DD')
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    // DateModule `pivotDate` will be formatted YYYY-MM-DD, need to add the time part
    const dt = this.createDateTime(userPivotDate)

    const shorthandKeys = ['y', 'Q', 'M', 'w', 'd', 'h', 'm', 's', 'ms']
    if (typeof value === 'string') {
      const match = shorthandKeys.filter((item) => value.indexOf(item) !== -1)
      if (match.length > 0) {
        shorthand = match[0] // take the first matching value
        value = value.replace(/\D/g, '') // get number portion
      }
    }

    value = Math.abs(value) // just in case the user passsed a negative value
    return moment(new Date(dt)).subtract(value, shorthand).format(format)
  }

  businessAdd(numDays = 1, pivotDate = '', format = '') {
    const locale = this.config?.templateLocale || 'en-US'
    const configFormat = this.config?.dateFormat || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat

    const dt = pivotDate.length === 10 ? new Date(`${pivotDate}T00:01:00`) : new Date()
    let result = momentBusiness(dt).businessAdd(numDays)

    let formattedDate = result.format(dtFormat)
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

    let formattedDate = result.format(dtFormat)
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

  isValid(dateObj = null) {
    return dateObj
    // return dateObj && moment(dateObj).isValid() ? dateObj : 'INVALID_DATE_FORMAT'
  }
}
