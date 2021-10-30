import moment from 'moment/min/moment-with-locales'
import { getUserLocale } from 'get-user-locale'

export default class DateModule {
  constructor(config) {
    this.config = config

    let osLocale = getUserLocale()
    if (this.config?.locale?.length > 0) {
      osLocale = this.config?.locale
    }

    moment.locale(osLocale)
  }

  format(format = '', date = '') {
    let dateValue = date.length > 0 ? new Date(date) : new Date()
    if (date instanceof moment) {
      dateValue = new Date(date)
    }

    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    const locale = this.config?.locale || 'en-US'
    format = format.length > 0 ? format : configFormat

    let formattedDate = moment(dateValue).format(format)
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

  weekday(format = '', offset = 1) {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    let offsetValue = typeof offset === 'number' ? offset : parseInt(offset)

    return moment(new Date())
      .weekday(++offsetValue)
      .format(format)
  }

  isWeekend(date = '') {
    const localeDate = date.length > 0 ? new Date(`${date} 1:00 AM`).toLocaleString() : new Date().toLocaleString()
    return new Date(localeDate).getDay() % 6 === 0
  }

  isWeekday(date = '') {
    return !this.isWeekend(date)
  }

  isValid(dateObj = null) {
    return dateObj
    // return dateObj && moment(dateObj).isValid() ? dateObj : 'INVALID_DATE_FORMAT'
  }
}
