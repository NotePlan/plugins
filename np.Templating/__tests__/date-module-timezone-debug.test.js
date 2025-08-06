/* eslint-disable */

import colors from 'chalk'
import DateModule from '../lib/support/modules/DateModule'
import moment from 'moment-business-days'

import { currentDate, format, date8601, createDateTime } from '../lib/support/modules/DateModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating - Timezone Debug Tests')}`
const section = colors.blue
const method = colors.magenta.bold

describe(`${PLUGIN_NAME}`, () => {
  let originalTimezone

  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }

    // Mock Calendar methods for consistent testing
    global.Calendar = {
      weekNumber: jest.fn((date) => {
        // Default to moment's ISO week + 1 for Sunday adjustment (mimicking typical NotePlan behavior)
        const momentWeek = parseInt(moment(date).format('W'))
        return moment(date).day() === 0 ? momentWeek + 1 : momentWeek
      }),
      startOfWeek: jest.fn((date) => {
        // Default to Sunday start (moment's default with adjustment)
        return moment(date).startOf('week').toDate()
      }),
      endOfWeek: jest.fn((date) => {
        // Default to Saturday end (moment's default with adjustment)
        return moment(date).endOf('week').toDate()
      }),
    }

    // Store original timezone
    originalTimezone = process.env.TZ
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.Calendar

    // Restore original timezone
    if (originalTimezone) {
      process.env.TZ = originalTimezone
    } else {
      delete process.env.TZ
    }
  })

  describe(section('Debug Timezone Issues'), () => {
    describe(method('format function with mocked dates'), () => {
      it('should debug the format function behavior', () => {
        process.env.TZ = 'America/Los_Angeles'

        // Mock current time to be 12:01 AM on 2024-01-16
        const mockDate = new Date('2024-01-16T00:01:00-08:00')
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

        console.log('Mocked date:', mockDate)
        console.log('Mocked date ISO string:', mockDate.toISOString())
        console.log('Mocked date local string:', mockDate.toString())

        // Test the standalone format function
        const formatResult = format('YYYY-MM-DD')
        console.log('format() result:', formatResult)

        // Test the DateModule class format method
        const dateModule = new DateModule()
        const classResult = dateModule.format('YYYY-MM-DD')
        console.log('DateModule.format() result:', classResult)

        // Test what moment() returns
        const momentNow = moment()
        console.log('moment() format YYYY-MM-DD:', momentNow.format('YYYY-MM-DD'))
        console.log('moment() toDate():', momentNow.toDate())

        // Test what new Date() returns
        const newDate = new Date()
        console.log('new Date():', newDate)
        console.log('new Date() toISOString():', newDate.toISOString())

        expect(formatResult).toBe('2024-01-16')
        expect(classResult).toBe('2024-01-16')

        jest.restoreAllMocks()
      })

      it('should debug createDateTime function', () => {
        process.env.TZ = 'America/Los_Angeles'

        const testDate = '2024-01-15'
        console.log('Testing createDateTime with:', testDate)

        const result = createDateTime(testDate)
        console.log('createDateTime result:', result)
        console.log('createDateTime result type:', typeof result)
        console.log('createDateTime result instanceof Date:', result instanceof Date)

        const momentResult = moment(result)
        console.log('moment(createDateTime result).format(YYYY-MM-DD):', momentResult.format('YYYY-MM-DD'))

        expect(result).toBeInstanceOf(Date)
        expect(moment(result).format('YYYY-MM-DD')).toBe('2024-01-15')
      })

      it('should debug the format function flow', () => {
        process.env.TZ = 'America/Los_Angeles'

        const testDate = '2024-01-15'
        console.log('Testing format function with dateString:', testDate)

        // Step 1: Check what moment(dateString) returns
        const momentFromString = moment(testDate)
        console.log('moment(dateString).format(YYYY-MM-DD):', momentFromString.format('YYYY-MM-DD'))

        // Step 2: Check what moment().format('YYYY-MM-DD') returns
        const momentNow = moment()
        console.log('moment().format(YYYY-MM-DD):', momentNow.format('YYYY-MM-DD'))

        // Step 3: Check the dt variable in format function
        const dt = testDate ? moment(testDate).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD')
        console.log('dt variable:', dt)

        // Step 4: Check what createDateTime(dt) returns
        const createDateTimeResult = createDateTime(dt)
        console.log('createDateTime(dt):', createDateTimeResult)

        // Step 5: Check what moment(createDateTime(dt)) returns
        const momentFromCreateDateTime = moment(createDateTimeResult)
        console.log('moment(createDateTime(dt)).format(YYYY-MM-DD):', momentFromCreateDateTime.format('YYYY-MM-DD'))

        // Step 6: Final result
        const finalResult = format('YYYY-MM-DD', testDate)
        console.log('Final format result:', finalResult)

        expect(finalResult).toBe('2024-01-15')
      })
    })
  })
})
