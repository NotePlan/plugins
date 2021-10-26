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
    const dateValue = date.length > 0 ? date : new Date()
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat

    return moment(dateValue).format(format)
  }

  now(format = '', offset = '') {
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

    return this.isValid(formattedDate)
  }

  today(format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    return moment().format(format)
  }

  tomorrow(format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    return this.isValid(moment(new Date()).add(1, 'days')).format(format)
  }

  yesterday(format = '') {
    const configFormat = this.config?.defaultFormats?.date || 'YYYY-MM-DD'
    format = format.length > 0 ? format : configFormat
    return moment(new Date()).subtract(1, 'days').format(format)
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
