/* eslint-disable */

import colors from 'chalk'
import TimeModule from '../src/support/modules/TimeModule'
import moment from 'moment'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe(section('TimeModule'), () => {
    it(`should render .now`, async () => {
      const result = new TimeModule().now('h:mm A')
      expect(result).toEqual(moment(new Date()).format('h:mm A'))
    })

    it(`should render .now using 'short' format`, () => {
      const result = new TimeModule().now('short')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render .now using 'medium' format`, () => {
      const result = new TimeModule().now('medium')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render .now using 'long' format`, () => {
      const result = new TimeModule().now('long')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'long' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render .now using 'full' format`, () => {
      const result = new TimeModule().now('full')

      const test = new Intl.DateTimeFormat('en-US', { timeStyle: 'full' }).format(new Date())

      expect(result).toEqual(test)
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
