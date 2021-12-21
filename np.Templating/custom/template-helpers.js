/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import moment from 'moment'

module.exports = () => {
  return {
    date: {
      now: function (format = 'YYYY-MM-DD', offset = '') {
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
      },

      tomorrow: function (format = 'YYYY-MM-DD') {
        return this.isValid(moment(new Date()).add(1, 'days')).format(format)
      },

      yesterday: function (format = 'YYYY-MM-DD') {
        return moment(new Date()).subtract(1, 'days').format(format)
      },

      weekday: function (format = 'YYYY-MM-DD', offset = 1) {
        let offsetValue = typeof offset === 'number' ? offset : parseInt(offset)

        return moment(new Date())
          .weekday(++offsetValue)
          .format(format)
      },

      isValid: function (dateObj = null) {
        return dateObj
        // return dateObj && moment(dateObj).isValid() ? dateObj : 'INVALID_DATE_FORMAT'
      },
    },
    time: {},
  }
}
