// @flow

import moment from 'moment'

const TimeHelpers = {
  now(format: string = 'HH:mm:ss A'): string {
    return moment().format(format)
  },
}

export default TimeHelpers
