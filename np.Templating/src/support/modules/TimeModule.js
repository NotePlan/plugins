import moment from 'moment/min/moment-with-locales'
import { getUserLocale } from 'get-user-locale'
import { debug } from '../../../../helpers/general'

export default class TimeModule {
  constructor(config) {
    this.config = config

    let osLocale = getUserLocale()
    if (this.config?.locale.length > 0) {
      osLocale = this.config?.locale
    }

    moment.locale(osLocale)
  }
  format(format = '', date = '') {
    const dateValue = date.length > 0 ? date : new Date()
    const configFormat = this.config?.defaultFormats?.time || 'HH:mm A'
    format = format.length > 0 ? format : configFormat

    if (date instanceof Date) {
      return moment(date).format(format)
    } else {
      return moment(new Date(dateValue)).format(format)
    }
  }

  now(format = '', offset = '') {
    const configFormat = this.config?.defaultFormats?.time || 'HH:mm A'
    format = format.length > 0 ? format : configFormat
    const formattedTime = moment(new Date()).format(format)

    return this.isValid(formattedTime)
  }

  isValid(timeObj = null) {
    return timeObj
    // return timeObj && moment(timeObj).isValid() ? timeObj : 'INVALID_TIME_FORMAT'
  }
}
