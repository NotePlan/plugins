/* eslint-disable */

import colors from 'chalk'
import DateModule from '../lib/support/modules/DateModule'
import moment from 'moment-business-days'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating - Now Method Fix Test')}`
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

  describe(section('Now Method Fix Tests'), () => {
    describe(method('now() with date parameter'), () => {
      it('should format a specific date correctly', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()
        const result = dateModule.now('YYYY - dddd', '2025-08-06')

        expect(result).toBe('2025 - Wednesday')
      })

      it('should handle different date formats', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Test various date formats
        expect(dateModule.now('YYYY-MM-DD', '2025-08-06')).toBe('2025-08-06')
        expect(dateModule.now('MM/DD/YYYY', '2025-08-06')).toBe('08/06/2025')
        expect(dateModule.now('MMMM Do, YYYY', '2025-08-06')).toBe('August 6th, 2025')
        expect(dateModule.now('dddd, MMMM Do', '2025-08-06')).toBe('Wednesday, August 6th')
      })

      it('should handle different timezones consistently', () => {
        const testDate = '2025-08-06'
        const timezones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo']

        timezones.forEach((timezone) => {
          process.env.TZ = timezone
          const dateModule = new DateModule()
          const result = dateModule.now('YYYY - dddd', testDate)
          expect(result).toBe('2025 - Wednesday')
        })
      })

      it('should still work with offset parameters', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Test offset functionality still works
        const tomorrow = dateModule.now('YYYY-MM-DD', '1d')
        const expectedTomorrow = moment().add(1, 'day').format('YYYY-MM-DD')
        expect(tomorrow).toBe(expectedTomorrow)

        const yesterday = dateModule.now('YYYY-MM-DD', '-1d')
        const expectedYesterday = moment().subtract(1, 'day').format('YYYY-MM-DD')
        expect(yesterday).toBe(expectedYesterday)
      })

      it('should handle invalid date strings gracefully', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Invalid date should fall back to current date
        const result = dateModule.now('YYYY-MM-DD', 'invalid-date')
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })

      it('should handle empty date parameter', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Empty parameter should use current date
        const result = dateModule.now('YYYY-MM-DD', '')
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })

      it('should handle null date parameter', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Null parameter should use current date
        const result = dateModule.now('YYYY-MM-DD', null)
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })
    })

    describe(method('Numeric offset compatibility'), () => {
      it('should handle positive numeric offsets', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Test numeric offsets (the main fix)
        const result7 = dateModule.now('YYYY-MM-DD', 7)
        const expected7 = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(result7).toBe(expected7)

        const result10 = dateModule.now('YYYY-MM-DD', 10)
        const expected10 = moment().add(10, 'days').format('YYYY-MM-DD')
        expect(result10).toBe(expected10)
      })

      it('should handle negative numeric offsets', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result7 = dateModule.now('YYYY-MM-DD', -7)
        const expected7 = moment().subtract(7, 'days').format('YYYY-MM-DD')
        expect(result7).toBe(expected7)

        const result45 = dateModule.now('YYYY-MM-DD', -45)
        const expected45 = moment().subtract(45, 'days').format('YYYY-MM-DD')
        expect(result45).toBe(expected45)
      })

      it('should handle zero numeric offset', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', 0)
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })
    })

    describe(method('String offset compatibility'), () => {
      it('should handle shorthand string offsets', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Test shorthand offsets still work
        const result10w = dateModule.now('YYYY-MM-DD', '10w')
        const expected10w = moment().add(10, 'w').format('YYYY-MM-DD')
        expect(result10w).toBe(expected10w)

        const result3M = dateModule.now('YYYY-MM-DD', '3M')
        const expected3M = moment().add(3, 'M').format('YYYY-MM-DD')
        expect(result3M).toBe(expected3M)

        const result1y = dateModule.now('YYYY-MM-DD', '1y')
        const expected1y = moment().add(1, 'y').format('YYYY-MM-DD')
        expect(result1y).toBe(expected1y)
      })

      it('should handle negative shorthand string offsets', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result10w = dateModule.now('YYYY-MM-DD', '-10w')
        const expected10w = moment().subtract(10, 'w').format('YYYY-MM-DD')
        expect(result10w).toBe(expected10w)

        const result3M = dateModule.now('YYYY-MM-DD', '-3M')
        const expected3M = moment().subtract(3, 'M').format('YYYY-MM-DD')
        expect(result3M).toBe(expected3M)
      })

      it('should handle numeric string offsets', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // String numbers should be treated as day offsets
        const result7 = dateModule.now('YYYY-MM-DD', '7')
        const expected7 = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(result7).toBe(expected7)

        const resultNeg7 = dateModule.now('YYYY-MM-DD', '-7')
        const expectedNeg7 = moment().subtract(7, 'days').format('YYYY-MM-DD')
        expect(resultNeg7).toBe(expectedNeg7)
      })
    })

    describe(method('Date string detection'), () => {
      it('should detect YYYY-MM-DD format as date', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '2025-08-06')
        expect(result).toBe('2025-08-06')
      })

      it('should detect MM/DD/YYYY format as date', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '08/06/2025')
        expect(result).toBe('2025-08-06')
      })

      it('should detect DD/MM/YYYY format as date', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '06/08/2025')
        expect(result).toBe('2025-08-06')
      })

      it('should detect month name format as date', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', 'August 6, 2025')
        expect(result).toBe('2025-08-06')
      })

      it('should detect ISO datetime format as date', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '2025-08-06T14:30:00')
        expect(result).toBe('2025-08-06')
      })

      it('should treat single digits as offsets, not dates', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Single digits should be treated as day offsets
        const result = dateModule.now('YYYY-MM-DD', '7')
        const expected = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })

      it('should treat shorthand offsets as offsets, not dates', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Shorthand should be treated as offsets
        const result = dateModule.now('YYYY-MM-DD', '1d')
        const expected = moment().add(1, 'day').format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })
    })

    describe(method('Edge cases'), () => {
      it('should handle dates with time information', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        expect(dateModule.now('YYYY-MM-DD', '2025-08-06T14:30:00')).toBe('2025-08-06')
        expect(dateModule.now('YYYY-MM-DD', '2025-08-06T14:30:00-08:00')).toBe('2025-08-06')
      })

      it('should handle various date string formats', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        expect(dateModule.now('YYYY-MM-DD', '2025/08/06')).toBe('2025-08-06')
        expect(dateModule.now('YYYY-MM-DD', 'August 6, 2025')).toBe('2025-08-06')
        expect(dateModule.now('YYYY-MM-DD', 'Aug 6, 2025')).toBe('2025-08-06')
      })

      it('should handle undefined and null parameters', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const resultUndefined = dateModule.now('YYYY-MM-DD', undefined)
        const expected = moment().format('YYYY-MM-DD')
        expect(resultUndefined).toBe(expected)

        const resultNull = dateModule.now('YYYY-MM-DD', null)
        expect(resultNull).toBe(expected)
      })

      it('should handle empty string parameters', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '')
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })

      it('should handle whitespace-only parameters', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('YYYY-MM-DD', '   ')
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })
    })

    describe(method('Backwards compatibility'), () => {
      it('should maintain existing behavior for no parameters', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now()
        const expected = moment().format('YYYY-MM-DD')
        expect(result).toBe(expected)
      })

      it('should maintain existing behavior for format-only parameter', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        const result = dateModule.now('MM/DD/YYYY')
        const expected = moment().format('MM/DD/YYYY')
        expect(result).toBe(expected)
      })

      it('should maintain existing behavior for all existing offset patterns', () => {
        process.env.TZ = 'America/Los_Angeles'

        const dateModule = new DateModule()

        // Test all the patterns from the original failing tests
        const result7 = dateModule.now('', 7)
        const expected7 = moment().add(7, 'days').format('YYYY-MM-DD')
        expect(result7).toBe(expected7)

        const result10 = dateModule.now('', 10)
        const expected10 = moment().add(10, 'days').format('YYYY-MM-DD')
        expect(result10).toBe(expected10)

        const resultNeg7 = dateModule.now('', -7)
        const expectedNeg7 = moment().subtract(7, 'days').format('YYYY-MM-DD')
        expect(resultNeg7).toBe(expectedNeg7)

        const resultNeg45 = dateModule.now('', -45)
        const expectedNeg45 = moment().subtract(45, 'days').format('YYYY-MM-DD')
        expect(resultNeg45).toBe(expectedNeg45)

        const result10w = dateModule.now('', '10w')
        const expected10w = moment().add(10, 'w').format('YYYY-MM-DD')
        expect(result10w).toBe(expected10w)

        const result3M = dateModule.now('', '3M')
        const expected3M = moment().add(3, 'M').format('YYYY-MM-DD')
        expect(result3M).toBe(expected3M)
      })
    })
  })
})
