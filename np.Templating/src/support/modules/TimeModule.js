import moment from 'moment/min/moment-with-locales'
import { getUserLocale } from 'get-user-locale'

export default class TimeModule {
  constructor(config) {
    this.config = config

    let osLocale = getUserLocale()
    if (this.config?.locale.length > 0) {
      osLocale = this.config?.locale
    }

    moment.locale(osLocale)
  }

  now(format = '', offset = '') {
    const configFormat = this.config?.defaultFormats?.time || 'HH:mm:ss A'
    format = format.length > 0 ? format : configFormat
    const formattedTime = moment(new Date()).format(format)

    return this.isValid(formattedTime)
  }
}
