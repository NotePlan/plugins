/* eslint-disable */

import colors from 'chalk'
import DateModule from '../lib/support/modules/DateModule'
import moment from 'moment-business-days'

import { currentDate, format, date8601, createDateTime } from '../lib/support/modules/DateModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating - Working Timezone Tests')}`
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

  describe(section('Working Timezone Tests'), () => {
    describe(method('Basic timezone consistency'), () => {
      it('should return consistent dates across timezones when given a specific date', () => {
        const testDate = '2024-01-15'
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.format('YYYY-MM-DD', testDate)
          expect(result).toBe('2024-01-15')
        })
      })

      it('should handle date strings with time information consistently', () => {
        const testCases = [
          { input: '2024-01-15T14:30:00', expected: '2024-01-15' },
          { input: '2024-01-15T14:30:00-08:00', expected: '2024-01-15' },
          { input: '2024-01-15T14:30:00-05:00', expected: '2024-01-15' },
          { input: '2024-01-15T00:00:00', expected: '2024-01-15' },
          { input: '2024-01-15T23:59:59', expected: '2024-01-15' },
        ]

        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          testCases.forEach(({ input, expected }) => {
            const result = dateModule.format('YYYY-MM-DD', input)
            expect(result).toBe(expected)
          })
        })
      })

      it('should handle various date string formats consistently', () => {
        const testCases = [
          { input: '2024-01-15', expected: '2024-01-15' },
          { input: '2024/01/15', expected: '2024-01-15' },
          { input: 'January 15, 2024', expected: '2024-01-15' },
          { input: 'Jan 15, 2024', expected: '2024-01-15' },
          { input: '15 Jan 2024', expected: '2024-01-15' },
        ]

        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          testCases.forEach(({ input, expected }) => {
            const result = dateModule.format('YYYY-MM-DD', input)
            expect(result).toBe(expected)
          })
        })
      })
    })

    describe(method('Current date methods timezone handling'), () => {
      it('should handle today() consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.today('YYYY-MM-DD')
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle tomorrow() consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.tomorrow('YYYY-MM-DD')
          const expected = moment().add(1, 'day').format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle yesterday() consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.yesterday('YYYY-MM-DD')
          const expected = moment().subtract(1, 'day').format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle now() consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.now('YYYY-MM-DD')
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle now() with offsets consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          // Test +1 day offset
          const tomorrow = dateModule.now('YYYY-MM-DD', '1d')
          const expectedTomorrow = moment().add(1, 'day').format('YYYY-MM-DD')
          expect(tomorrow).toBe(expectedTomorrow)

          // Test -1 day offset
          const yesterday = dateModule.now('YYYY-MM-DD', '-1d')
          const expectedYesterday = moment().subtract(1, 'day').format('YYYY-MM-DD')
          expect(yesterday).toBe(expectedYesterday)
        })
      })
    })

    describe(method('Standalone function timezone handling'), () => {
      it('should handle format() function consistently across timezones', () => {
        const testDate = '2024-01-15'
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const result = format('YYYY-MM-DD', testDate)
          expect(result).toBe('2024-01-15')
        })
      })

      it('should handle currentDate() function consistently across timezones', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const result = currentDate('YYYY-MM-DD')
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle createDateTime() function consistently across timezones', () => {
        const testDate = '2024-01-15'
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const result = createDateTime(testDate)
          expect(result).toBeInstanceOf(Date)
          expect(moment(result).format('YYYY-MM-DD')).toBe('2024-01-15')
        })
      })
    })

    describe(method('Edge cases'), () => {
      it('should handle empty date input consistently', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.format('YYYY-MM-DD', '')
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle null date input consistently', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.format('YYYY-MM-DD', null)
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle undefined date input consistently', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.format('YYYY-MM-DD', undefined)
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })

      it('should handle invalid date strings gracefully', () => {
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.format('YYYY-MM-DD', 'invalid-date')
          const expected = moment().format('YYYY-MM-DD')
          expect(result).toBe(expected)
        })
      })
    })

    describe(method('Timezone-specific edge cases'), () => {
      it('should handle DST transition dates consistently', () => {
        // Test dates around DST transitions
        const testCases = [
          { date: '2024-03-10', description: 'Spring forward in PST' },
          { date: '2024-11-03', description: 'Fall back in PST' },
          { date: '2024-03-10', description: 'Spring forward in EST' },
          { date: '2024-11-03', description: 'Fall back in EST' },
        ]

        const timezones = ['America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          testCases.forEach(({ date, description }) => {
            const result = dateModule.format('YYYY-MM-DD', date)
            expect(result).toBe(date)
          })
        })
      })

      it('should handle year boundary dates consistently', () => {
        // Test dates around year boundaries
        const testCases = [
          { date: '2024-12-31', description: 'December 31st' },
          { date: '2025-01-01', description: 'January 1st' },
          { date: '2024-12-31T23:59:59', description: 'December 31st with time' },
          { date: '2025-01-01T00:00:00', description: 'January 1st with time' },
        ]

        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          testCases.forEach(({ date, description }) => {
            const result = dateModule.format('YYYY-MM-DD', date)
            const expected = moment(date).format('YYYY-MM-DD')
            expect(result).toBe(expected)
          })
        })
      })

      it('should handle midnight edge cases consistently', () => {
        // Test dates around midnight
        const testCases = [
          { date: '2024-01-15T23:59:59', expected: '2024-01-15' },
          { date: '2024-01-16T00:00:00', expected: '2024-01-16' },
          { date: '2024-01-15T23:59:59-08:00', expected: '2024-01-15' },
          { date: '2024-01-16T00:00:00-08:00', expected: '2024-01-16' },
        ]

        const timezones = ['America/Los_Angeles', 'America/New_York']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()

          testCases.forEach(({ date, expected }) => {
            const result = dateModule.format('YYYY-MM-DD', date)
            expect(result).toBe(expected)
          })
        })
      })
    })
  })
})
