import moment from 'moment-business-days'
// import moment from 'moment/min/moment-with-locales'
import { getUserLocale } from 'get-user-locale'
import dayjs from 'dayjs'

export default class DateModule {
  constructor(config) {
    this.config = config

    let osLocale = getUserLocale()
    if (this.config?.locale?.length > 0) {
      osLocale = this.config?.locale
    }

    moment.locale(osLocale)
  }

  // convert supplied date value into something that NotePlan can actually handle
  // requiring YYYY-MM-DDThh:mm:ss format
  createDateTime(userDateString = '') {
    let dt = new Date().toLocaleString()
    if (userDateString.length === 10) {
      dt = new Date(`${userDateString}T00:01:00`).toLocaleString()
    }

    return dt
  }

  format(format = '', date = '') {
    let dateValue = date.length > 0 ? new Date(date) : new Date()
    if (date.length === 10) {
      const tempDate = moment(date).format('YYYY-MM-DD')
      // dateValue = this.createDateTime(tempDate)
      dateValue = tempDate
    }
    if (date instanceof moment) {
      dateValue = new Date(date)
    }

    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const locale = this.config?.locale || 'en-US'
    format = format.length > 0 ? format : configFormat

    let formattedDate = moment(date).format(format)

    if (format === 'short' || format === 'medium' || format === 'long' || format === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: format }).format(dateValue)
    }

    return formattedDate
  }

  now(format = '', offset = '') {
    const locale = this.config?.locale || 'en-US'

    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    const dateValue = new Date()
    let formattedDate = moment(dateValue).format(format)
    if (offset) {
      offset = `${offset}` // convert to string for further processing and usage below
      let newDate = ''
      if (offset.match(/^-?d*.?d*$/)) {
        newDate = offset.includes('-')
          ? moment(dateValue).subtract(offset.replace('-', ''), 'days')
          : moment(dateValue).add(offset, 'days')
      } else {
        newDate = offset.includes('-')
          ? moment(dateValue).subtract(offset.replace('-', ''))
          : moment(dateValue).add(offset)
      }

      formattedDate = moment(newDate).format(format)
    }

    if (format === 'short' || format === 'medium' || format === 'long' || format === 'full') {
      formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: format }).format(new Date())
    }

    return this.isValid(formattedDate)
  }

  today(format = '') {
    return this.format(format, new Date())
  }

  tomorrow(format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment(new Date()).add(1, 'days')

    const formattedValue = this.format(format, dateValue)

    return formattedValue
  }

  yesterday(format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    const dateValue = moment(new Date()).subtract(1, 'days')

    const formattedValue = this.format(format, dateValue)

    return formattedValue
  }

  weekday(format = '', offset = 1, pivotDate = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    const offsetValue = typeof offset === 'number' ? offset : parseInt(offset)

    const dateValue = pivotDate.length === 0 ? new Date() : new Date(pivotDate)

    return moment(dateValue).weekday(offsetValue).format(format)
  }

  weeknumber(pivotDate = '') {
    const dateValue = pivotDate.length === new Date() ? pivotDate : new Date(pivotDate)

    const dateStr = moment(dateValue).format('YYYY-MM-DD')

    return this.format('W', dateStr)
  }

  isWeekend(pivotDate = '') {
    let localeDate = new Date().toLocaleString()
    if (pivotDate.length > 0 && pivotDate.length === 10) {
      localeDate = new Date(pivotDate + ' 12:00 AM')
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
      pivotDate = userPivotDate
    }

    const startDate = this.weekday('YYYY-MM-DD', startDayNumber, pivotDate)
    const endDate = this.weekday('YYYY-MM-DD', endDayNumber, pivotDate)

    const weekNumber = moment(pivotDate).format('W')

    return `W${weekNumber} (${startDate}..${endDate})`
  }

  businessAdd(numDays = 1, pivotDate = '', format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat
    const localeDate = this.createDateTime(pivotDate)

    const result = moment(new Date(localeDate), dtFormat).businessAdd(numDays)

    return result.format(dtFormat)
  }

  businessSubtract(numDays = 1, pivotDate = '', format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat
    const localeDate = this.createDateTime(pivotDate)

    const result = moment(new Date(localeDate), dtFormat).businessSubtract(numDays)

    return result.format(dtFormat)
  }

  nextBusinessDay(pivotDate = '', format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat
    const localeDate = this.createDateTime(pivotDate)

    const nextBusinessDay = moment(new Date(localeDate), dtFormat).nextBusinessDay()

    const result = new Date(nextBusinessDay)

    return moment(result).format(dtFormat)
  }

  previousBusinessDay(pivotDate = '', format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const dtFormat = format.length > 0 ? format : configFormat
    const localeDate = this.createDateTime(pivotDate)

    const nextBusinessDay = moment(new Date(localeDate), dtFormat).prevBusinessDay()

    const result = new Date(nextBusinessDay)

    return moment(result).format(dtFormat)
  }

  isValid(dateObj = null) {
    return dateObj
    // return dateObj && moment(dateObj).isValid() ? dateObj : 'INVALID_DATE_FORMAT'
  }
}
