/* eslint-disable */

import colors from 'chalk'
import DateModule from '../lib/support/modules/DateModule'
import moment from 'moment-business-days'

import { currentDate, format, date8601 } from '../lib/support/modules/DateModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })
  describe(section('DateModule'), () => {
    it(`should ${method('.createDateTime')} from pivotDate`, async () => {
      const pivotDate = '2021-11-24'

      const result = new DateModule().createDateTime(pivotDate)

      const test = new Date(`${pivotDate}T00:01:00`)

      expect(result).toEqual(test)
    })

    it(`should ${method('.createDateTime')} from current date`, async () => {
      const result = new DateModule().createDateTime()
      const resultFormatted = moment(new Date(result)).format('YYYY-MM-DD')
      let testDate = moment(new Date()).format('YYYY-MM-DD')

      const test = new Date(`${testDate}T00:01:00`)

      expect(resultFormatted).toContain(testDate)
    })

    it(`should render ${method('.date8601')}`, async () => {
      const result = new DateModule().date8601()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    it(`should render ${method('.format')} default (no params)`, async () => {
      const result = new DateModule().format()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    it(`should render ${method('.format')} with format`, async () => {
      const format = 'YYYYMMDD'
      const result = new DateModule().format(format)
      expect(result).toEqual(moment(new Date()).format(format))
    })

    it(`should render ${method('.now')}`, async () => {
      const result = new DateModule().now()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    it(`should render ${method('.now')} using short format`, () => {
      const result = new DateModule().now('short')

      const test = new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'medium' format`, () => {
      const result = new DateModule().now('medium')

      const test = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'long' format`, () => {
      const result = new DateModule().now('long')

      const test = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using 'full' format`, () => {
      const result = new DateModule().now('full')

      const test = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date())

      expect(result).toEqual(test)
    })

    it(`should render ${method('.now')} using custom format`, async () => {
      const result = new DateModule().now('YYYY-MM')
      expect(result).toEqual(moment(new Date()).format('YYYY-MM'))
    })

    it(`should render ${method('.now')} using configuration`, async () => {
      const testConfig = {
        dateFormat: 'YYYY-MM',
      }
      const result = new DateModule(testConfig).now()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM'))
    })

    it(`should render ${method('.timestamp')} default (no format) as local ISO8601 string`, () => {
      const dm = new DateModule()
      const result = dm.timestamp()
      const expected = moment().format() // e.g., "2023-10-27T17:30:00-07:00"

      // Check it contains a T and a timezone offset (+/-HH:mm or Z)
      expect(result).toMatch(/T.*([+-]\d{2}:\d{2}|Z)/)

      // Parse both timestamps and check they're within 5 seconds of each other
      const resultMoment = moment(result)
      const expectedMoment = moment(expected)
      const diffInSeconds = Math.abs(resultMoment.diff(expectedMoment, 'seconds'))

      expect(diffInSeconds).toBeLessThanOrEqual(5)
    })

    it(`should render ${method('.timestamp')} with a custom format string`, () => {
      const dm = new DateModule()
      const formatStr = 'dddd, MMMM Do YYYY, h:mm:ss a'
      const result = dm.timestamp(formatStr)
      const expected = moment().format(formatStr)

      // For format strings that include time components, parse and compare with tolerance
      if (formatStr.includes('h') || formatStr.includes('m') || formatStr.includes('s') || formatStr.includes('H')) {
        // Parse both formatted strings back to moments and check they're within 5 seconds
        const resultMoment = moment(result, formatStr)
        const expectedMoment = moment(expected, formatStr)
        const diffInSeconds = Math.abs(resultMoment.diff(expectedMoment, 'seconds'))
        expect(diffInSeconds).toBeLessThanOrEqual(5)
      } else {
        // For date-only formats, exact comparison is fine
        expect(result).toEqual(expected)
      }
    })

    it(`should render ${method('.timestamp')} with 'UTC_ISO' format as UTC ISO8601 string`, () => {
      const dm = new DateModule()
      const result = dm.timestamp('UTC_ISO')
      const expected = moment.utc().format() // e.g., "2023-10-27T23:30:00Z"

      // Check that result ends with 'Z' (UTC indicator)
      expect(result.endsWith('Z')).toBe(true)

      // Parse both timestamps and check they're within 5 seconds of each other
      const resultMoment = moment.utc(result)
      const expectedMoment = moment.utc(expected)
      const diffInSeconds = Math.abs(resultMoment.diff(expectedMoment, 'seconds'))

      expect(diffInSeconds).toBeLessThanOrEqual(5)
    })

    it(`should render ${method('.timestamp')} respecting locale from config for formatted strings`, () => {
      // LLLL format is locale-sensitive, e.g. "Montag, 21. Oktober 2024 15:30"
      const dm = new DateModule({ templateLocale: 'de-DE' })
      const formatStr = 'LLLL'
      // Moment global locale is changed by dm.setLocale() inside timestamp(), so direct moment().format() will use it.
      const result = dm.timestamp(formatStr)
      // To get the expected value, we explicitly set locale for this moment instance before formatting.
      const expected = moment().locale('de-DE').format(formatStr)
      expect(result).toEqual(expected)
      // Reset locale for subsequent tests if necessary, though DateModule usually sets it per call.
      moment.locale('en') // Reset to default for other tests
    })

    it(`should render ${method('.now')} using positive offset`, async () => {
      const result = new DateModule().now('', 7)

      const assertValue = moment(new Date()).add(7, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.now')} using positive offset`, async () => {
      const result = new DateModule().now('', 10)

      const assertValue = moment(new Date()).add(10, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.now')} using negative offset`, async () => {
      const result = new DateModule().now('', -7)

      const assertValue = moment(new Date()).subtract(7, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.now')} using negative offset`, async () => {
      const result = new DateModule().now('', -45)

      const assertValue = moment(new Date()).subtract(45, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.now')} using positive shorthand`, async () => {
      const result = new DateModule().now('', '10w')

      const assertValue = moment(new Date()).add(10, 'w').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.now')} using positive shorthand`, async () => {
      const result = new DateModule().now('', '3M')

      const assertValue = moment(new Date()).add(3, 'M').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    describe(`${block('.add method')}`, () => {
      it(`should render ${method('.add')} using default shorthand (n days)`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21'

        const result = new DateModule().add(pivotDate, 7)

        const assertValue = moment(new Date(`${pivotDate}T00:00:01`))
          .add(7, 'days')
          .format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21'

        const result = new DateModule().add(pivotDate, 7, 'weeks')

        const assertValue = moment(new Date(`${pivotDate}T00:00:01`))
          .add(7, 'weeks')
          .format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21'

        const result = new DateModule().add(pivotDate, '7w')

        const assertValue = moment(new Date(`${pivotDate}T00:00:01`))
          .add(7, 'weeks')
          .format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should not render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21'

        const result = new DateModule().add(pivotDate, '7years')

        const assertValue = moment(new Date(`${pivotDate}T00:00:01`))
          .add(7, 'weeks')
          .format('YYYY-MM-DD')

        expect(result).not.toEqual(assertValue)
      })

      it(`should render ${method('.add')} using Intl format`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21'

        const result = new DateModule({ dateFormat: 'short' }).add(pivotDate, 7)

        const assertValue = moment(new Date(`${pivotDate}T00:00:01`))
          .add(7, 'days')
          .format('M/D/YY')

        expect(result).toEqual(assertValue)
      })
    })

    describe(`${block('.subtract method')}`, () => {
      it(`should render ${method('.subtract')} using default shorthand (n days)`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().subtract('2022-05-21', 7)

        const assertValue = moment(new Date(pivotDate)).subtract(7, 'days').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.subtract')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().subtract('2022-05-21', 7, 'weeks')

        const assertValue = moment(new Date(pivotDate)).subtract(7, 'weeks').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.subtract')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().subtract('2022-05-21', '7w')

        const assertValue = moment(new Date(pivotDate)).subtract(7, 'weeks').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should not render ${method('.subtract')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().subtract('2022-05-21', '7years')

        const assertValue = moment(new Date(pivotDate)).subtract(7, 'weeks').format('YYYY-MM-DD')

        expect(result).not.toEqual(assertValue)
      })
    })

    it(`should render ${method('.now')} using negative shorthand`, async () => {
      const result = new DateModule().now('', '-10w')

      const assertValue = moment(new Date()).subtract(10, 'w').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.today')}`, async () => {
      const result = new DateModule().today()

      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
    })

    it(`should render ${method('.today')} w/ custom format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).today('MM/D/YY')

      expect(result).toEqual(moment(new Date()).format('MM/D/YY'))
    })

    it(`should render ${method('.yesterday')}`, async () => {
      const result = new DateModule().yesterday()

      const assertValue = moment(new Date()).subtract(1, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.yesterday')} w/ intl format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).yesterday('MM/D/YY')

      const assertValue = moment(new Date()).subtract(1, 'days').format('MM/D/YY')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.yesterday')} w/ custom format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).yesterday('YYYY/MM/DD')

      const assertValue = moment(new Date()).subtract(1, 'days').format('YYYY/MM/DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.tomorrow')}`, async () => {
      const result = new DateModule().tomorrow()

      const assertValue = moment(new Date()).add(1, 'days').format('YYYY-MM-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.tomorrow')} w/ intl format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).tomorrow('MM/D/YY')

      const assertValue = moment(new Date()).add(1, 'days').format('MM/D/YY')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.tomorrow')} w/ custom format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).tomorrow('YYYY/MM/DD')

      const assertValue = moment(new Date()).add(1, 'days').format('YYYY/MM/DD')

      expect(result).toEqual(assertValue)
    })

    describe(`${block('.weekday method (business days)')}`, () => {
      const dateModule = new DateModule()
      // Test against a known Wednesday
      const wednesday = '2021-12-15' // Wednesday
      const friday = '2021-12-17'
      const monday = '2021-12-13'
      const nextMonday = '2021-12-20'
      const saturday = '2021-12-18'

      it('should add 2 business days to a Wednesday (default format)', () => {
        const result = dateModule.weekday('', 2, wednesday)
        expect(result).toEqual(friday)
      })

      it('should add 0 business days to a Wednesday', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 0, wednesday)
        expect(result).toEqual(wednesday)
      })

      it('should add 1 business day to a Wednesday', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 1, wednesday)
        expect(result).toEqual('2021-12-16') // Thursday
      })

      it('should subtract 1 business day from a Wednesday', () => {
        const result = dateModule.weekday('YYYY-MM-DD', -1, wednesday)
        expect(result).toEqual('2021-12-14') // Tuesday
      })

      it('should subtract 2 business days from a Wednesday', () => {
        const result = dateModule.weekday('YYYY-MM-DD', -2, wednesday)
        expect(result).toEqual(monday)
      })

      it('should add 3 business days to a Wednesday (over weekend)', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 3, wednesday)
        expect(result).toEqual(nextMonday)
      })

      it('should subtract 3 business days from a Wednesday (over weekend)', () => {
        const result = dateModule.weekday('YYYY-MM-DD', -3, wednesday)
        expect(result).toEqual('2021-12-10') // Previous Friday
      })

      it('should add 0 business days to a Saturday (returns same day as per moment-business-days logic)', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 0, saturday)
        // momentBusiness(saturday).businessAdd(0) results in saturday
        expect(result).toEqual(saturday)
      })

      it('should add 1 business day to a Saturday (returns next Monday)', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 1, saturday)
        expect(result).toEqual(nextMonday)
      })

      it('should handle current date if pivotDate is empty', () => {
        // This test is a bit harder to make deterministic without knowing current date
        // We check if it returns a valid date string
        const result = dateModule.weekday('YYYY-MM-DD', 1)
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('should use dateFormat from config if format is empty', () => {
        const dmWithConfig = new DateModule({ dateFormat: 'MM/DD/YYYY' })
        const result = dmWithConfig.weekday('', 2, wednesday)
        expect(result).toEqual('12/17/2021')
      })

      it('should handle invalid offset (e.g. string) by formatting pivotDate or today', () => {
        const result = dateModule.weekday('YYYY-MM-DD', 'invalid', wednesday)
        expect(result).toEqual(wednesday) // Should format wednesday
        const todayFormatted = moment().format('YYYY-MM-DD')
        const resultToday = dateModule.weekday('YYYY-MM-DD', 'invalid', '')
        expect(resultToday).toEqual(todayFormatted) // Should format today
      })
    })

    it(`should render true if ${method('.isWeekend')}`, async () => {
      const result = new DateModule().isWeekend('2021-10-16') // saturday
      expect(result).toEqual(true)
    })

    it(`should render false if not ${method('.isWeekend')}`, async () => {
      const result = new DateModule().isWeekend('2021-10-15') // friday

      expect(result).toEqual(false)
    })

    describe('isWeekend full week test', () => {
      it(`should render false if not ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-25') // friday

        expect(result).toEqual(false)
      })

      it(`should render false if not ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-26') // friday

        expect(result).toEqual(false)
      })

      it(`should render false if not ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-27') // friday

        expect(result).toEqual(false)
      })

      it(`should render false if not ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-28') // friday

        expect(result).toEqual(false)
      })

      it(`should render false if not ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-29') // friday

        expect(result).toEqual(false)
      })

      it(`should render true if ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-30') // sunday

        expect(result).toEqual(true)
      })

      it(`should render true if ${method('.isWeekend')}`, async () => {
        const result = new DateModule().isWeekend('2021-10-31') // sunday

        expect(result).toEqual(true)
      })
    })

    it(`should render false if not ${method('.isWeekend')}`, async () => {
      const result = new DateModule().isWeekend('2021-10-29') // friday

      expect(result).toEqual(false)
    })

    it(`should render true if ${method('.isWeekday')}`, async () => {
      const result = new DateModule().isWeekday('10-15-2021')

      expect(result).toEqual(true)
    })

    it(`should ${method('.format')} supplied date`, async () => {
      const result = new DateModule().format('YYYY-MM', '2021-10-16')

      const assertValue = moment('2021-10-16').format('YYYY-MM')

      expect(result).toEqual(assertValue)
    })

    it(`should return ${method('.dayNumber')} of given date`, () => {
      const result = new DateModule().dayNumber('2021-12-15')

      expect(result).toEqual(3)
    })

    it(`should return ${method('.dayNumber')} of given date for all locales`, () => {
      const result = new DateModule().dayNumber('2022-12-04')

      expect(result).toEqual(0)
    })

    it(`should return ${method('.dayNumber')} of given date for all locales`, () => {
      const result = new DateModule().dayNumber('2022-12-03')

      expect(result).toEqual(6)
    })

    it(`should return ${method('.dayNumber')} of given date`, () => {
      const result = new DateModule().dayNumber('2022-11-20')

      expect(result).toEqual(0)
    })

    it(`should return ${method('.weekNumber')} of given date`, () => {
      const result = new DateModule().weekNumber('2021-12-15')

      expect(result).toEqual(50)
    })

    describe(`${block('.weekOf method')}`, () => {
      const dateModule = new DateModule()
      const YYYYMMDD = 'YYYY-MM-DD'

      it('should calculate weekOf based on current date (default Sunday start)', () => {
        const today = moment().format(YYYYMMDD)
        const expectedStartDate = dateModule.startOfWeek(YYYYMMDD, today, 0)
        const expectedEndDate = dateModule.endOfWeek(YYYYMMDD, today, 0)
        const expectedWeekNumber = dateModule.weekNumber(today)
        const result = dateModule.weekOf()
        expect(result).toEqual(`W${expectedWeekNumber} (${expectedStartDate}..${expectedEndDate})`)
      })

      it('should calculate weekOf for a pivotDate (Wednesday), default Sunday start', () => {
        const pivotDate = '2021-11-03' // Wednesday
        const expectedStartDate = '2021-10-31' // Sunday of that week
        const expectedEndDate = '2021-11-06' // Saturday of that week
        // weekNumber for 2021-11-03: moment('2021-11-03').format('W') is '44'. dayNumber is 3, so no increment.
        const expectedWeekNumber = dateModule.weekNumber(pivotDate)
        const result = dateModule.weekOf(pivotDate)
        expect(result).toEqual(`W${expectedWeekNumber} (${expectedStartDate}..${expectedEndDate})`)
      })

      it('should calculate weekOf for a pivotDate with explicit Sunday start (startDayOpt = 0)', () => {
        const pivotDate = '2021-11-03' // Wednesday
        const expectedStartDate = '2021-10-31'
        const expectedEndDate = '2021-11-06'
        const expectedWeekNumber = dateModule.weekNumber(pivotDate)
        const result = dateModule.weekOf(0, 6, pivotDate) // Explicitly startDay 0, endDay 6 (endDay is ignored by new logic)
        expect(result).toEqual(`W${expectedWeekNumber} (${expectedStartDate}..${expectedEndDate})`)
      })

      it('should calculate weekOf for a pivotDate with explicit Monday start (startDayOpt = 1)', () => {
        const pivotDate = '2021-11-03' // Wednesday
        // Assuming startOfWeek with firstDayOfWeek=1 correctly gives Monday
        const expectedStartDate = dateModule.startOfWeek(YYYYMMDD, pivotDate, 1) // Monday of that week (2021-11-01)
        const expectedEndDate = dateModule.endOfWeek(YYYYMMDD, pivotDate, 1) // Sunday of that week (2021-11-07)
        // The weekNumber calculation might be tricky here if it doesn't align with a Monday start.
        // For consistency, one might argue weekNumber should also take firstDayOfWeek.
        // moment('2021-11-01').isoWeek() is 44. moment('2021-11-01').week() is 45.
        const expectedWeekNumber = dateModule.weekNumber(pivotDate) // CORRECTED: Use the module's own logic for pivotDate
        const result = dateModule.weekOf(1, null, pivotDate)
        expect(result).toEqual(`W${expectedWeekNumber} (${expectedStartDate}..${expectedEndDate})`)
      })

      it('should calculate weekOf for a pivotDate that IS Sunday, default Sunday start', () => {
        const pivotDate = '2021-12-19' // Is a Sunday
        const expectedStartDate = '2021-12-19'
        const expectedEndDate = '2021-12-25'
        // moment('2021-12-19').format('W') is '51'. dayNumber is 0, so weekNumber() returns 52.
        const dm = new DateModule()
        const resultWeekNumber = dm.weekNumber(pivotDate)
        const result = dm.weekOf(pivotDate)
        // This assertion depends HEAVILY on the exact behavior of startOfWeek, endOfWeek, and weekNumber with their current implementations.
        // If startOfWeek(..., 0) for a Sunday returns that Sunday, and endOfWeek(..., 0) returns the following Saturday.
        expect(result).toEqual(`W${resultWeekNumber} (${expectedStartDate}..${expectedEndDate})`)
      })
    })

    it(`should return ${method('.startOfWeek')} using today`, async () => {
      let startOfWeek = new DateModule().startOfWeek(null, '2022-03-05')
      expect(startOfWeek).toEqual('2022-02-27')
    })

    it(`should return ${method('.startOfWeek')} using pivot date`, async () => {
      let startOfWeek = new DateModule().startOfWeek(null, '2021-12-01')
      expect(startOfWeek).toEqual('2021-11-28')
    })

    it(`should return ${method('.startOfWeek')} using fixed date with offset`, async () => {
      let startOfWeek = new DateModule().startOfWeek(null, '2022-03-05', 1)
      expect(startOfWeek).toEqual('2022-02-28')
    })

    it(`should return ${method('.startOfWeek')} using Intl format`, async () => {
      const pivotDate = '2022-05-21'

      const startOfWeek = new DateModule({ dateFormat: 'short' }).startOfWeek('', pivotDate)

      const assertValue = moment(new Date(pivotDate)).startOf('week').format('M/D/YY')

      expect(startOfWeek).toEqual('5/15/22')
    })

    it(`should return ${method('.endOfWeek')} using today`, async () => {
      let endOfWeek = new DateModule().endOfWeek(null, '2022-03-05')
      expect(endOfWeek).toEqual('2022-03-05')
    })

    it(`should return ${method('.startOfMonth')} using today`, async () => {
      let startOfMonth = new DateModule().startOfMonth(null, '2022-05-29')
      expect(startOfMonth).toEqual('2022-05-01')
    })

    it(`should return ${method('.startOfMonth')} using supplied date`, async () => {
      let startOfMonth = new DateModule().startOfMonth(null, '2021-12-01')
      expect(startOfMonth).toEqual('2021-12-01')
    })

    it(`should return ${method('.startOfMonth')} using Intl format`, async () => {
      const result = new DateModule({ dateFormat: 'short' }).yesterday('MM/D/YY')

      const assertValue = moment(new Date()).subtract(1, 'days').format('MM/D/YY')

      let startOfMonth = new DateModule({ dateFormat: 'short' }).startOfMonth(null, '2021-12-01')

      expect(startOfMonth).toEqual('12/1/21')
    })

    it(`should return ${method('.endOfMonth')} using today`, async () => {
      let endOfMonth = new DateModule().endOfMonth(null, '2022-05-29')
      expect(endOfMonth).toEqual('2022-05-31')
    })

    it(`should return ${method('.endOfMonth')} using Intl format`, async () => {
      let endOfMonth = new DateModule({ dateFormat: 'short' }).endOfMonth(null, '2022-05-29')

      expect(endOfMonth).toEqual('5/31/22')
    })

    it(`should return ${method('.daysInMonth')} using today`, async () => {
      let days = new DateModule().daysInMonth('2022-05-29')
      expect(days).toEqual(31)
    })

    it(`should return ${method('.daysInMonth')} using today`, async () => {
      let days = new DateModule().daysInMonth('2022-02-28')
      expect(days).toEqual(28)
    })

    it(`should return ${method('.fromNow')} using today`, async () => {
      let fromNow = new DateModule().fromNow('2022-03-05')
      expect(fromNow).toEqual('INCOMPLETE')
    })

    it(`should return ${method('.endOfWeek')} using fixed date with offset`, async () => {
      let endOfWeek = new DateModule().endOfWeek(null, '2022-03-05', 1)
      expect(endOfWeek).toEqual('2022-03-06')
    })

    describe(`${block('business days')}`, () => {
      it(`should ${method('.businessAdd')} using supplied current date`, async () => {
        const result = new DateModule().businessAdd(3)

        const test = new DateModule().isWeekday(result)

        expect(test).toEqual(true)
      })

      it(`should ${method('.businessAdd')} using supplied pivotDate`, async () => {
        const pivotDate = '2021-11-24'

        const result = new DateModule().businessAdd(3, pivotDate)

        expect(result).toEqual('2021-11-29')
      })

      it(`should ${method('.businessAdd')} using supplied pivotDate using custom format`, async () => {
        const pivotDate = '2021-11-24'

        const result = new DateModule().businessAdd(3, pivotDate, 'MM/DD/YYYY')

        expect(result).toEqual('11/29/2021')
      })

      it(`should ${method('.businessSubtract')} using supplied current date`, async () => {
        const result = new DateModule().businessSubtract(3)

        const test = new DateModule().isWeekday(result)

        expect(test).toEqual(true)
      })

      it(`should ${method('.businessSubtract')} using supplied pivotDate`, async () => {
        const pivotDate = '2021-11-22'

        const result = new DateModule().businessSubtract(3, pivotDate)

        expect(result).toEqual('2021-11-17')
      })

      it(`should ${method('.businessSubtract')} using supplied pivotDate with custom format`, async () => {
        const pivotDate = '2021-11-22'

        const result = new DateModule().businessSubtract(3, pivotDate, 'MM/DD/YYYY')

        expect(result).toEqual('11/17/2021')
      })

      it(`should ${method('.nextBusinessDay')} from current date`, async () => {
        const result = new DateModule().nextBusinessDay()

        let test = new DateModule().isWeekday(result)

        expect(test).toEqual(true)
      })

      it(`should ${method('.nextBusinessDay')} from pivotDate`, async () => {
        const result = new DateModule().nextBusinessDay('2021-11-30')

        expect(result).toEqual('2021-12-01')
      })

      it(`should ${method('.nextBusinessDay')} from pivotDate with custom format`, async () => {
        const result = new DateModule().nextBusinessDay('2021-11-30', 'MM/DD/YYYY')

        expect(result).toEqual('12/01/2021')
      })

      it(`should ${method('.previousBusinessDay')} from current date`, async () => {
        const result = new DateModule().previousBusinessDay()

        let test = new DateModule().isWeekday(result)

        expect(test).toEqual(true)
      })

      it(`should ${method('.previousBusinessDay')} from pivotDate`, async () => {
        const result = new DateModule().previousBusinessDay('2021-12-01')

        expect(result).toEqual('2021-11-30')
      })

      it(`should ${method('.previousBusinessDay')} from pivotDate with custom format`, async () => {
        const result = new DateModule().previousBusinessDay('2021-12-01', 'MM/DD/YYYY')

        expect(result).toEqual('11/30/2021')
      })
    })

    describe(`${block('helpers')}`, () => {
      it(`should use ${method('format')} helper with default format`, async () => {
        const result = format(null, '2021-10-16')
        const assertValue = moment('2021-10-16').format('YYYY-MM-DD')
        expect(result).toEqual(assertValue)
      })

      it(`should use ${method('format')} helper with custom format`, async () => {
        const result = format('YYYY-MM', '2021-10-16')
        const assertValue = moment('2021-10-16').format('YYYY-MM')
        expect(result).toEqual(assertValue)
      })

      it(`should use ${method('date8601')} helper correctly`, async () => {
        const instanceResult = new DateModule().date8601()
        const helperResult = date8601() // This calls the modified helper
        expect(helperResult).toEqual(instanceResult)
        expect(helperResult).toEqual(moment(new Date()).format('YYYY-MM-DD'))
      })

      it(`should render ${method('currentDate')} helper using default format`, async () => {
        const result = currentDate()
        expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
      })
    })

    describe(`${block('reference')}`, () => {
      it(`should return date reference`, async () => {
        const now = new DateModule().ref(new Date())

        // console.log(now.format('YYYY-MM-DD'))
      })
    })

    describe(`${block('.daysUntil method')}`, () => {
      let dateModule
      beforeEach(() => {
        dateModule = new DateModule()
      })

      it('should return negative number for a past date', () => {
        const pastDate = moment().subtract(1, 'days').format('YYYY-MM-DD')
        expect(dateModule.daysUntil(pastDate)).toBe(-1)
        expect(dateModule.daysUntil(pastDate, true)).toBe(0) // -1 + 1 = 0 (including today makes it 0 days ago)
      })

      it('should return 0 for today if includeToday is false', () => {
        const today = moment().format('YYYY-MM-DD')
        expect(dateModule.daysUntil(today, false)).toBe(0)
      })

      it('should return 1 for today if includeToday is true', () => {
        const today = moment().format('YYYY-MM-DD')
        expect(dateModule.daysUntil(today, true)).toBe(1)
      })

      it('should return 1 for tomorrow if includeToday is false', () => {
        const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
        expect(dateModule.daysUntil(tomorrow, false)).toBe(1)
      })

      it('should return 2 for tomorrow if includeToday is true', () => {
        const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
        expect(dateModule.daysUntil(tomorrow, true)).toBe(2)
      })

      it('should return 7 for a date 7 days in the future if includeToday is false', () => {
        const futureDate = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(dateModule.daysUntil(futureDate, false)).toBe(7)
      })

      it('should return 8 for a date 7 days in the future if includeToday is true', () => {
        const futureDate = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(dateModule.daysUntil(futureDate, true)).toBe(8)
      })

      it('should return error message for an invalid date string', () => {
        expect(dateModule.daysUntil('invalid-date')).toBe('days until: invalid date')
      })

      it('should return error message for a malformed date string', () => {
        expect(dateModule.daysUntil('2023-13-01')).toBe('days until: invalid date') // Invalid month
      })

      it('should return error message if no date string is provided', () => {
        expect(dateModule.daysUntil(null)).toBe('days until: invalid date')
        expect(dateModule.daysUntil(undefined)).toBe('days until: invalid date')
        expect(dateModule.daysUntil('')).toBe('days until: invalid date')
      })
    })

    // Start of new comprehensive tests for DateModule.prototype.now()
    describe(`${method('.now() class method with offsets and Intl formats')}`, () => {
      it("should respect numeric offset with 'short' Intl format", () => {
        const dm = new DateModule()
        const offsetDate = moment().add(7, 'days').toDate()
        const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(offsetDate)
        expect(dm.now('short', 7)).toEqual(expected)
      })

      it("should respect negative shorthand offset with 'medium' Intl format", () => {
        const dm = new DateModule()
        const offsetDate = moment().subtract(1, 'week').toDate()
        const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(offsetDate)
        expect(dm.now('medium', '-1w')).toEqual(expected)
      })

      it("should respect shorthand offset with 'long' Intl format and custom locale from config", () => {
        const dm = new DateModule({ templateLocale: 'de-DE' })
        const offsetDate = moment().add(2, 'months').toDate()
        const expected = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(offsetDate)
        expect(dm.now('long', '+2M')).toEqual(expected)
      })

      it('should use config.dateFormat with a positive numerical offset', () => {
        const dm = new DateModule({ dateFormat: 'MM/DD/YY' })
        const expected = moment().add(5, 'days').format('MM/DD/YY')
        expect(dm.now('', 5)).toEqual(expected)
      })

      it('should handle positive day shorthand with custom format', () => {
        const dm = new DateModule()
        const expected = moment().add(3, 'days').format('YYYY/MM/DD')
        expect(dm.now('YYYY/MM/DD', '+3d')).toEqual(expected)
      })

      it('should handle negative year shorthand with default format', () => {
        const dm = new DateModule()
        const expected = moment().subtract(1, 'year').format('YYYY-MM-DD')
        expect(dm.now('', '-1y')).toEqual(expected)
      })

      it('should handle zero offset correctly with Intl format', () => {
        const dm = new DateModule()
        const expected = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(moment().toDate())
        expect(dm.now('full', 0)).toEqual(expected)
      })

      it('should handle empty string offset as no offset with custom format', () => {
        const dm = new DateModule()
        const expected = moment().format('ddd, MMM D, YYYY')
        expect(dm.now('ddd, MMM D, YYYY', '')).toEqual(expected)
      })
    })
    // End of new comprehensive tests
  })

  describe(`${block('Mixed Format Testing with NotePlan Week Numbers')}`, () => {
    let dateModule
    beforeEach(() => {
      dateModule = new DateModule()

      // Mock Calendar.weekNumber for consistent test results
      global.Calendar = {
        weekNumber: jest.fn((date) => {
          // For test dates, return predictable week numbers
          if (date.getFullYear() === 2023) {
            if (date.getMonth() === 5 && date.getDate() === 15) return 25 // June 15, 2023 (Thursday)
            if (date.getMonth() === 0 && date.getDate() === 1) return 1 // Jan 1, 2023 (Sunday)
            if (date.getMonth() === 11 && date.getDate() === 31) return 53 // Dec 31, 2023 (Sunday)
          }
          return 42 // Default fallback
        }),
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
      delete global.Calendar
    })

    describe(`${method('NotePlan week tokens (w/ww) vs ISO week tokens (W/WW)')}`, () => {
      it('should use NotePlan week number for lowercase "w" token', () => {
        const result = dateModule.format('w', '2023-06-15')
        expect(result).toBe('25')
        expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
      })

      it('should use NotePlan week number for zero-padded "ww" token', () => {
        const result = dateModule.format('ww', '2023-01-01')
        expect(result).toBe('01')
        expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
      })

      it('should use ISO week number for uppercase "W" token', () => {
        const result = dateModule.format('W', '2023-06-15')
        // ISO week should be different from NotePlan week (24 vs 25)
        expect(result).toBe('24')
        expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
      })

      it('should use ISO week number for zero-padded "WW" token', () => {
        const result = dateModule.format('WW', '2023-06-15')
        expect(result).toBe('24')
        expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
      })

      it('should handle mixed NotePlan and ISO weeks in same format', () => {
        const result = dateModule.format('w-W', '2023-06-15')
        expect(result).toBe('25-24') // NotePlan week 25, ISO week 24
        expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
      })
    })

    describe(`${method('Complex mixed format strings')}`, () => {
      it('should handle year + NotePlan week + month format', () => {
        const result = dateModule.format('YYYY-[W]ww-MM', '2023-06-15')
        expect(result).toBe('2023-W25-06')
        expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
      })

      it('should handle date with both week types and weekday', () => {
        const result = dateModule.format('YYYY-MM-DD ([W]w/W) www', '2023-06-15')
        expect(result).toBe('2023-06-15 (W25/24) Thu')
        expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
      })

      it('should handle quarter and week combination', () => {
        const result = dateModule.format('[Q]Q [W]ww [of] YYYY', '2023-06-15')
        expect(result).toBe('Q2 W25 of 2023')
      })

      it('should handle time with NotePlan week', () => {
        const result = dateModule.format('YYYY-[W]ww HH:mm:ss', '2023-06-15T14:30:45')
        expect(result).toBe('2023-W25 14:30:45')
      })
    })

    describe(`${method('Weekday name tokens (www/wwww)')}`, () => {
      it('should convert "www" to weekday abbreviation without calling Calendar', () => {
        const result = dateModule.format('www', '2023-06-15') // Thursday
        expect(result).toBe('Thu')
        expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
      })

      it('should convert "wwww" to full weekday name without calling Calendar', () => {
        const result = dateModule.format('wwww', '2023-06-15') // Thursday
        expect(result).toBe('Thursday')
        expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
      })

      it('should handle mixed weekday and week number tokens', () => {
        const result = dateModule.format('wwww [week] w', '2023-06-15')
        expect(result).toBe('Thursday week 25')
        expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
      })
    })

    describe(`${method('Ordinal and special week tokens')}`, () => {
      it('should handle "wo" (ordinal week) without modification', () => {
        const result = dateModule.format('wo', '2023-06-15')
        expect(result).toMatch(/^\d+(st|nd|rd|th)$/) // Should be like "24th"
        expect(global.Calendar.weekNumber).not.toHaveBeenCalled()
      })

      it('should handle complex ordinal format', () => {
        const result = dateModule.format('wo [week of] YYYY', '2023-06-15')
        expect(result).toMatch(/^\d+(st|nd|rd|th) week of 2023$/)
      })
    })

    describe(`${method('Edge cases and literal blocks')}`, () => {
      it('should not replace tokens inside literal blocks', () => {
        const result = dateModule.format('[Week w and ww] w', '2023-06-15')
        expect(result).toBe('Week w and ww 25')
        expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
      })

      it('should handle nested brackets correctly', () => {
        const result = dateModule.format('[NotePlan W]w[ vs ISO W]W', '2023-06-15')
        expect(result).toBe('NotePlan W25 vs ISO W24')
      })

      it('should handle multiple NotePlan week tokens efficiently', () => {
        const result = dateModule.format('w-ww-w', '2023-06-15')
        expect(result).toBe('25-25-25')
        // Should only call Calendar.weekNumber once for efficiency
        expect(global.Calendar.weekNumber).toHaveBeenCalledTimes(1)
      })
    })

    describe(`${method('Integration with other DateModule methods')}`, () => {
      it('should work with .now() method using NotePlan weeks', () => {
        const result = dateModule.now('YYYY-[W]ww')
        expect(result).toMatch(/^\d{4}-W\d{2}$/)
      })

      it('should work with .today() method using mixed format', () => {
        const result = dateModule.today('www, [W]w [of] YYYY')
        expect(result).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), W\d{1,2} of \d{4}$/)
      })

      it('should work with .add() method preserving week formatting', () => {
        const result = dateModule.add('2023-06-15', 7, 'days', 'YYYY-[W]ww')
        expect(result).toMatch(/^\d{4}-W\d{2}$/)
      })

      it('should work with business day methods', () => {
        const result = dateModule.businessAdd(5, '2023-06-15', '[W]ww/YYYY')
        expect(result).toMatch(/^W\d{2}\/\d{4}$/)
      })
    })

    describe(`${method('Week calculation edge cases')}`, () => {
      it('should handle year boundary dates correctly', () => {
        const result = dateModule.format('YYYY-[W]ww', '2023-12-31') // Sunday, end of year
        expect(result).toBe('2023-W53')
        expect(global.Calendar.weekNumber).toHaveBeenCalledWith(expect.any(Date))
      })

      it('should handle year start dates correctly', () => {
        const result = dateModule.format('YYYY-[W]ww', '2023-01-01') // Sunday, start of year
        expect(result).toBe('2023-W01')
      })

      it('should compare NotePlan vs ISO week differences at year boundaries', () => {
        const npWeek = dateModule.format('w', '2023-01-01')
        const isoWeek = dateModule.format('W', '2023-01-01')
        expect(npWeek).toBe('1') // NotePlan week
        expect(isoWeek).toBe('52') // ISO week (belongs to previous year)
      })
    })

    describe(`${method('Fallback behavior when Calendar not available')}`, () => {
      beforeEach(() => {
        delete global.Calendar // Remove Calendar to test fallback
      })

      it('should fall back to ISO week calculation for Sunday dates', () => {
        const result = dateModule.format('w', '2023-01-01') // Sunday
        const isoWeek = parseInt(moment('2023-01-01').format('W'))
        expect(result).toBe((isoWeek + 1).toString()) // ISO + 1 for Sunday
      })

      it('should fall back to ISO week calculation for non-Sunday dates', () => {
        const result = dateModule.format('w', '2023-06-15') // Thursday
        const isoWeek = moment('2023-06-15').format('W')
        expect(result).toBe(isoWeek) // Same as ISO for non-Sunday
      })

      it('should handle zero-padded fallback correctly', () => {
        const result = dateModule.format('ww', '2023-01-02') // Monday, week 1
        expect(result).toBe('01')
      })
    })
  })
})
