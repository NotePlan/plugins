/* eslint-disable */

import colors from 'chalk'
import DateModule from '../lib/support/modules/DateModule'
import moment from 'moment-business-days'
import { currentDate, now, format, timestamp, date8601 } from '../lib/support/modules/DateModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const block = colors.magenta.green
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
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

    it(`should render ${method('.timestamp')} using configuration with timestampFormat defined`, async () => {
      const testConfig = {
        timestampFormat: 'YYYY-MM-DD h:mm A',
      }
      const result = new DateModule(testConfig).timestamp()
      expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD h:mm A'))
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
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().add(pivotDate, 7)

        const assertValue = moment(new Date(pivotDate)).add(7, 'days').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().add(pivotDate, 7, 'weeks')

        const assertValue = moment(new Date(pivotDate)).add(7, 'weeks').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().add(pivotDate, '7w')

        const assertValue = moment(new Date(pivotDate)).add(7, 'weeks').format('YYYY-MM-DD')

        expect(result).toEqual(assertValue)
      })

      it(`should not render ${method('.add')} using shorthand weeks`, async () => {
        // this is how it will look inside date functions using `.createDateTime`
        const pivotDate = '2022-05-21T00:00:01'

        const result = new DateModule().add(pivotDate, '7years')

        const assertValue = moment(new Date(pivotDate)).add(7, 'weeks').format('YYYY-MM-DD')

        expect(result).not.toEqual(assertValue)
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

    it(`should render ${method('.weekday')} (this monday)`, async () => {
      const result = new DateModule().weekday('YYYY-M-DD', 0)

      const assertValue = moment(new Date()).weekday(0).format('YYYY-M-DD')

      expect(result).toEqual(assertValue)
    })

    it(`should render ${method('.weekday')} (this monday) using pivotDate`, async () => {
      const result = new DateModule().weekday('', 0, '2021-11-03')

      expect(result).toEqual('2021-10-31')
    })

    it(`should render true if ${method('.isWeekend')}`, async () => {
      const result = new DateModule().isWeekend('2021-10-16')
      expect(result).toEqual(true)
    })

    it(`should render false if not ${method('.isWeekend')}`, async () => {
      const result = new DateModule().isWeekend('2021-10-15')

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

    it(`should return ${method('.weekNumber')} of given date`, () => {
      const result = new DateModule().weekNumber('2021-12-15')

      expect(result).toEqual(50)
    })

    it(`should calculate ${method('.weekOf')} based on current date`, async () => {
      let result = new DateModule().weekOf()

      const pivotDate = moment(new Date()).format('YYYY-MM-DD')
      const startDate = new DateModule().weekday('YYYY-MM-DD', 0)
      const endDate = new DateModule().weekday('YYYY-MM-DD', 6)
      const weekNumber = new DateModule().weekNumber(pivotDate)

      const assertValue = `W${weekNumber} (${startDate}..${endDate})`

      expect(result).toEqual(assertValue)
    })

    it(`should calculate ${method('.weekOf')} based on pivotDate`, async () => {
      const pivotDate = '2021-11-03'
      let result = new DateModule().weekOf(null, null, pivotDate)
      const startDate = new DateModule().weekday('YYYY-MM-DD', 0, pivotDate)
      const endDate = new DateModule().weekday('YYYY-MM-DD', 6, pivotDate)
      const weekNumber = new DateModule().weekNumber(pivotDate)

      // W44 (2021-10-31..11/06)
      const assertValue = `W${weekNumber} (${startDate}..${endDate})`

      expect(result).toEqual(assertValue)
    })

    it(`should calculate ${method('.weekOf')} based on pivotDate only`, async () => {
      const pivotDate = '2021-11-03'
      let result = new DateModule().weekOf(pivotDate)

      const startDate = new DateModule().weekday('YYYY-MM-DD', 0, pivotDate)
      const endDate = new DateModule().weekday('YYYY-MM-DD', 6, pivotDate)
      const weekNumber = new DateModule().weekNumber(pivotDate)

      const assertValue = `W${weekNumber} (${startDate}..${endDate})`

      expect(result).toEqual(assertValue)
    })

    it(`should calculate ${method('.weekOf')} based on pivotDate starting on Sunday`, async () => {
      const result = new DateModule().weekOf('2021-12-19')

      const assertValue = `W51 (2021-12-19..2021-12-25)`

      expect(result).toEqual(assertValue)
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

    it(`should return ${method('.endOfMonth')} using today`, async () => {
      let endOfMonth = new DateModule().endOfMonth(null, '2022-05-29')
      expect(endOfMonth).toEqual('2022-05-31')
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
      it(`should render ${method('now')} helper using default format`, async () => {
        const result = now()

        expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
      })

      it(`should render ${method('now')} helper using custom format`, async () => {
        const result = now('YYYY-MM')

        expect(result).toEqual(moment(new Date()).format('YYYY-MM'))
      })

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

      it(`should use ${method('timestamp')} helper`, async () => {
        const result = new DateModule().timestamp()

        const assertValue = timestamp()

        expect(result).toEqual(assertValue)
      })

      it(`should use ${method('timestamp')} helper with custom format`, async () => {
        const result = new DateModule({ timestampFormat: 'YYYY MM DD hh:mm:ss' }).timestamp()

        const assertValue = timestamp('YYYY MM DD hh:mm:ss')

        expect(result).toEqual(assertValue)
      })

      it(`should use ${method('date8601')} helper`, async () => {
        const result = new DateModule().date8601()

        const assertValue = date8601()

        expect(result).toEqual(assertValue)
      })

      it(`should render ${method('currentDate')} helper using default format`, async () => {
        const result = currentDate()

        expect(result).toEqual(moment(new Date()).format('YYYY-MM-DD'))
      })
    })
  })
})
