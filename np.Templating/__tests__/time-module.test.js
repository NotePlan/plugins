/* eslint-disable */

import colors from 'chalk'
import TimeModule from '../src/support/modules/TimeModule'
import moment from 'moment'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe(section('TimeModule'), () => {
    it(`should render .now`, async () => {
      const result = new TimeModule().now()
      expect(result).toEqual(moment(new Date()).format('hh:mm A'))
    })

    it(`should render .now using custom format`, async () => {
      const result = new TimeModule().now('hh:mm')
      expect(result).toEqual(moment(new Date()).format('hh:mm'))
    })

    it(`should render .now using configuration`, async () => {
      const testConfig = {
        defaultFormats: {
          time: 'hh:mm A',
        },
      }
      const result = new TimeModule(testConfig).now()
      expect(result).toEqual(moment(new Date()).format('hh:mm A'))
    })

    it(`should format supplied time`, async () => {
      const result = new TimeModule().format('hh:mm A', '2021-10-16 6:55 AM')

      const dateValue = new Date('2021-10-16 6:55 AM').toLocaleString()
      const assertValue = moment(new Date(dateValue)).format('hh:mm A')

      expect(result).toEqual(assertValue)
    })
  })
})
