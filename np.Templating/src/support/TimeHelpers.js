import moment from 'moment/min/moment-with-locales'
import { getUserLocale } from 'get-user-locale'

const TimeHelpers = {
  now(format = 'HH:mm:ss A') {
    return moment().format(format)
  },

  isValid(timeObj = null) {
    return timeObj
  },
}

export default TimeHelpers
