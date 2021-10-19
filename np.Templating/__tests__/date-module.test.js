/* eslint-disable */

import colors from 'chalk'
import DateModule from '../src/support/modules/DateModule'
import moment from 'moment'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe(section('DateModule'), () => {
    test(`should render .now`, async () => {
      const result = new DateModule().now()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    test(`should render .now using custom format`, async () => {
      const result = new DateModule().now('YYYY-MM')
      expect(result).toEqual(moment(new Date()).format('YYYY-MM'))
    })

    test(`should render .now using configuration`, async () => {
      const testConfig = {
        defaultFormats: {
          date: 'YYYY-MM',
        },
      }
      const result = new DateModule(testConfig).now()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM'))
    })

    test(`should render .now using positive offset`, async () => {
      const result = new DateModule().now('', 7)

      const assertValue = moment(new Date()).add(7, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    test(`should render .now using negative offset`, async () => {
      const result = new DateModule().now('', -7)

      const assertValue = moment(new Date()).subtract(7, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    test(`should render today`, async () => {
      const result = new DateModule().today()

      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    test(`should render yesterday`, async () => {
      const result = new DateModule().yesterday()

      const assertValue = moment(new Date()).subtract(1, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    test(`should render tomorrow`, async () => {
      const result = new DateModule().tomorrow()

      const assertValue = moment(new Date()).add(1, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    test(`should render weekday (this monday)`, async () => {
      const result = new DateModule().weekday('', 0)

      const assertValue = moment(new Date()).weekday(1).format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    test(`should render true if weekend`, async () => {
      const result = new DateModule().isWeekend('10-16-2021')

      expect(result).toEqual(true)
    })

    test(`should render false if not weekend`, async () => {
      const result = new DateModule().isWeekend('10-15-2021')

      expect(result).toEqual(false)
    })

    test(`should render true if weekday`, async () => {
      const result = new DateModule().isWeekday('10-15-2021')

      expect(result).toEqual(true)
    })

    test(`should render false if not weekday`, async () => {
      const result = new DateModule().isWeekday('2021-10-16')

      expect(result).toEqual(false)
    })

    test(`should format supplied date`, async () => {
      const result = new DateModule().format('YYYY-MM', '2021-10-16')

      const assertValue = moment('2021-10-16').format('YYYY-MM')

      expect(result).toEqual(assertValue)
    })
  })
})
