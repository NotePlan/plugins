/* global describe, test, expect, beforeAll, it, beforeEach, afterEach, jest */
import moment from 'moment/min/moment-with-locales'
import { CustomConsole } from '@jest/console' // see note below
import * as dt from '../dateTime'
import * as f from '../NPdateTime'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

// const PLUGIN_NAME = `helpers`
const FILENAME = `NPDateTime`

function isValidDate(date) {
  return date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date)
}

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  // Configure Calendar mock to use ISO weeks (Monday-start) by default for backward compatibility
  const momentLib = require('moment/min/moment-with-locales')
  global.Calendar = {
    ...Calendar,
    weekNumber: (date) => momentLib(date).isoWeek(),
    startOfWeek: (date) => momentLib(date).startOf('isoWeek').toDate(),
    endOfWeek: (date) => momentLib(date).endOf('isoWeek').toDate(),
  }
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

describe(`${FILENAME}`, () => {
  /*
   * getMonthData()
   */
  describe('getMonthData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getMonthData()
      expect(typeof result.monthIndex).toEqual('number')
      expect(typeof result.monthString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed in ISO format', () => {
      const result = f.getMonthData('2020-01-01')
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getMonthData('20200101')
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
    test('should work for date obj passed', () => {
      const result = f.getMonthData(new Date('2020-01-15'))
      expect(result.monthIndex).toEqual(0)
      expect(result.monthString).toEqual('2020-01')
    })
  })

  /*
   * getYearData()
   */
  describe('getYearData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getYearData()
      expect(typeof result.yearString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed full ISO', () => {
      const result = f.getYearData('2020-01-01')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for string passed just month', () => {
      const result = f.getYearData('2020-01')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getYearData('20200101')
      expect(result.yearString).toEqual('2020')
    })
    test('should work for date obj passed', () => {
      const result = f.getYearData(new Date('2020-01-15'))
      expect(result.yearString).toEqual('2020')
    })
  })

  /*
   * getQuarterData()
   */
  describe('getQuarterData()' /* function */, () => {
    test('should return today info with no params', () => {
      const result = f.getQuarterData()
      expect(result.quarterIndex).toBeGreaterThanOrEqual(1)
      expect(result.quarterIndex).toBeLessThanOrEqual(4)
      expect(typeof result.quarterString).toEqual('string')
      expect(isValidDate(result.startDate)).toEqual(true)
      expect(isValidDate(result.endDate)).toEqual(true)
    })
    test('should work for string passed full ISO', () => {
      const result = f.getQuarterData('2020-01-01')
      expect(result).not.toBeNull()
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('2024-04-01 basic details', () => {
      const result = f.getQuarterData('2024-04-01')
      expect(result.quarterIndex).toEqual(2)
      expect(result.quarterString).toEqual('2024-Q2')
      expect(dt.hyphenatedDateString(result.startDate)).toEqual('2024-04-01')
      expect(dt.hyphenatedDateString(result.endDate)).toEqual('2024-06-30')
    })
    test('2024-12-22 basic details', () => {
      const result = f.getQuarterData('2024-12-22')
      expect(result.quarterIndex).toEqual(4)
      expect(result.quarterString).toEqual('2024-Q4')
      expect(dt.hyphenatedDateString(result.startDate)).toEqual('2024-10-01')
      expect(dt.hyphenatedDateString(result.endDate)).toEqual('2024-12-31')
    })
    test('should work for string passed just quarter', () => {
      const result = f.getQuarterData('2020-Q1')
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('should work for string passed in NP format', () => {
      const result = f.getQuarterData('20200101')
      expect(result.quarterString).toEqual('2020-Q1')
    })
    test('should work for date obj passed', () => {
      const result = f.getQuarterData(new Date('2020-01-15'))
      expect(result.quarterString).toEqual('2020-Q1')
    })
  })


  /**
   * getRelativeDates()
   */
  describe('getRelativeDates', () => {
    describe('very limited test without NP API', () => {
      test('should return empty as no DataStore calls are available', () => {
        const result = f.getRelativeDates()
        expect(result).toEqual([{}])
      })
    })
  })

  /**
   * getShortOffsetDateFromDateString()
   */
  describe('getShortOffsetDateFromDateString', () => {
    const toDateStr = moment([2023, 8, 6, 0, 0, 0]).format('YYYY-MM-DD') // = 2023-09-06
    describe('invalid inputs should fail', () => {
      test('fail on 2023-09-0 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09-0', toDateStr)).toEqual(['(error)', '(error)'])
      })
      test('fail on 2023-09-06 to 20230910', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09-06', '20230910')).toEqual(['-4d', '-4 days'])
      })
    })
    describe('valid inputs should work', () => {
      test('2023-09-06 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09-06', toDateStr)).toEqual(['0d', 'today'])
      })
      test('2023-09-05 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09-05', toDateStr)).toEqual(['-1d', 'yesterday'])
      })
      test('2023-09-07 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09-07', toDateStr)).toEqual(['1d', 'tomorrow'])
      })
      test('2023-W36 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-W36', toDateStr)).toEqual(['0w', 'this week'])
      })
      test('2023-W34 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-W34', toDateStr)).toEqual(['-2w', '-2 weeks'])
      })
      test('2023-W38 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-W38', toDateStr)).toEqual(['2w', '2 weeks'])
      })
      test('2023-09 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-09', toDateStr)).toEqual(['0m', 'this month'])
      })
      test('2023-Q3 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-Q3', toDateStr)).toEqual(['0q', 'this quarter'])
      })
      test('2023-Q1 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-Q1', toDateStr)).toEqual(['-2q', '-2 quarters'])
      })
      test('2023-Q4 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023-Q4', toDateStr)).toEqual(['1q', 'next quarter'])
      })
      test('2023 to 2023-09-06', () => {
        expect(f.getShortOffsetDateFromDateString('2023', toDateStr)).toEqual(['0y', 'this year'])
      })
    })
  })

  /**
   * getPeriodStartEndDatesFromPeriodCode()
   * Note: not testing for the "... (to date)" variant of periodAndPartStr as that will only happen on certain dates.
   */
  describe('getPeriodStartEndDatesFromPeriodCode', () => {
    describe('years', () => {
      it('oy / 3 / 2021 / false', () => {
        const [_fd, _td, _psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('year', 3, 2021, false)
        expect(ps).toEqual('2021')
        expect(paps).toEqual('2021')
      })
    })
    describe('quarters', () => {
      it('oq / 3 / 2021 / false', () => {
        const [_fd, _td, _psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('quarter', 3, 2021, false)
        expect(ps).toEqual('2021 Q3 (Jul-Sep)')
        expect(paps).toEqual('2021 Q3 (Jul-Sep)')
      })
    })
    describe('months', () => {
      it('om / 3 / 2021 / false', () => {
        const [_fd, _td, _psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('month', 3, 2021, false)
        expect(ps).toEqual('Mar 2021')
        expect(paps).toEqual('Mar 2021')
      })
    })
    // Skip this as it calls helper function setMomentLocaleFromEnvironment that isn't mocked (yet)
    describe('weeks', () => {
      it.skip('ow / 51 / 2023 / false', () => {
        // Forcing to GB locale, to enable the test to be written by JGC
        moment.locale('gb', {
          week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // Used to determine first week of the year.
          },
        })
        const [fd, td, _psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('week', 51, 2023, false)
        expect(ps).toEqual('2023-W51')
        expect(paps).toEqual('2023-W51')
        expect(fd).toEqual(new Date(2023, 11, 18, 0, 0, 0)) // 18.12.2023
        expect(td).toEqual(new Date(2023, 11, 24, 23, 59, 59, 999)) // 24.12.2023
      })
    })
    describe('days', () => {
      // Skip this as it calls helper function setMomentLocaleFromEnvironment that isn't mocked (yet)
      it.skip('today / 3 / 2021 / false', () => {
        const [_fd, _td, _sc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('today', 3, 2021, false)
        expect(ps).toEqual('today')
        expect(paps).toEqual('Today')
      })
      // Is specific to today, so needs updating to test.
      // This was correct on 2023-12-27
      it.skip('2023-12-01 / 3 / 2021 / false', () => {
        const [_fd, _td, _sc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('2023-12-01', 3, 2021, false)
        expect(ps).toEqual('since 2023-12-01')
        expect(paps).toEqual('26 days since 2023-12-01')
      })
    })
  })

  /**
   * getFirstDateInPeriod()
   */
  describe('getFirstDateInPeriod', () => {
    it('should return the first date of the period', () => {
      expect(f.getFirstDateInPeriod('2024')).toEqual('2024-01-01')
      expect(f.getFirstDateInPeriod('2024-Q2')).toEqual('2024-04-01')
      expect(f.getFirstDateInPeriod('2024-12')).toEqual('2024-12-01')
      expect(f.getFirstDateInPeriod('20241222')).toEqual('20241222')
      expect(f.getFirstDateInPeriod('2024-12-22')).toEqual('2024-12-22')
    })
    // Don't know why this is returning one day out
    it.skip('should return the first date of the week', () => {
      expect(f.getFirstDateInPeriod('2024-W52')).toEqual('2024-12-23')
    })
    it('should return \'(error)\' from invalid date string', () => {
      expect(f.getFirstDateInPeriod('')).toEqual('(error)')
      expect(f.getFirstDateInPeriod('bob')).toEqual('(error)')
      expect(f.getFirstDateInPeriod('24')).toEqual('(error)')
    })
  })

  /**
   * calcOffsetDateStr()
   */
  describe('calcOffsetDateStr with NotePlan weeks', () => {
    describe('NotePlan week handling with mocked Calendar API', () => {
      const moment = require('moment/min/moment-with-locales')

      // Mock Calendar API for Sunday start week (NotePlan default for some locales)
      const mockCalendarSundayStart = {
        weekNumber: jest.fn((date) => {
          // Calculate week number with Sunday start
          return moment(date).locale('en').week()
        }),
        startOfWeek: jest.fn((date) => {
          return moment(date).locale('en').startOf('week').toDate()
        }),
        endOfWeek: jest.fn((date) => {
          return moment(date).locale('en').endOf('week').toDate()
        }),
      }

      // Mock Calendar API for Monday start week (ISO standard)
      const mockCalendarMondayStart = {
        weekNumber: jest.fn((date) => {
          return moment(date).isoWeek()
        }),
        startOfWeek: jest.fn((date) => {
          return moment(date).startOf('isoWeek').toDate()
        }),
        endOfWeek: jest.fn((date) => {
          return moment(date).endOf('isoWeek').toDate()
        }),
      }

      describe('Week offsets with Sunday start (US style)', () => {
        let originalCalendar
        beforeEach(() => {
          originalCalendar = global.Calendar
          global.Calendar = mockCalendarSundayStart
          mockCalendarSundayStart.weekNumber.mockClear()
          mockCalendarSundayStart.startOfWeek.mockClear()
          mockCalendarSundayStart.endOfWeek.mockClear()
        })

        afterEach(() => {
          global.Calendar = originalCalendar
        })

        test('2024-11-06 (Wed) +1w -> 2024-W46 (Sunday start)', () => {
          const result = f.calcOffsetDateStr('2024-11-06', '1w', 'week')
          // Nov 6, 2024 is a Wednesday in week 45 (Sunday start)
          // Adding 1 week should give us week 46
          expect(result).toEqual('2024-W46')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +1w -> 2024-W45 (Sunday start)', () => {
          const result = f.calcOffsetDateStr('2024-W44', '1w')
          expect(result).toEqual('2024-W45')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +0w -> 2024-W44 (no change)', () => {
          const result = f.calcOffsetDateStr('2024-W44', '0w')
          expect(result).toEqual('2024-W44')
        })

        test('2024-W52 +1w -> 2025-W01 (crosses year boundary, Sunday start)', () => {
          // Week 52 of 2024 (Sunday start) + 1 week = Week 1 of 2025
          const result = f.calcOffsetDateStr('2024-W52', '1w')
          expect(result).toEqual('2025-W01')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2025-W01 -1w -> 2024-W52 (crosses year boundary backwards, Sunday start)', () => {
          // Week 1 of 2025 (Sunday start) - 1 week = Week 52 of 2024
          const result = f.calcOffsetDateStr('2025-W01', '-1w')
          expect(result).toEqual('2024-W52')
        })

        test('2024-01-15 (Mon) +2w -> 2024-W05 (converts date to week with Sunday start)', () => {
          // Jan 15, 2024 is in week 3 (Sunday start), adding 2 weeks = week 5
          const result = f.calcOffsetDateStr('2024-01-15', '2w', 'week')
          expect(result).toEqual('2024-W05')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })
      })

      describe('Week offsets with Monday start (ISO/European style)', () => {
        let originalCalendar
        beforeEach(() => {
          originalCalendar = global.Calendar
          global.Calendar = mockCalendarMondayStart
          mockCalendarMondayStart.weekNumber.mockClear()
          mockCalendarMondayStart.startOfWeek.mockClear()
          mockCalendarMondayStart.endOfWeek.mockClear()
        })

        afterEach(() => {
          global.Calendar = originalCalendar
        })

        test('2024-11-06 (Wed) +1w -> 2024-W46 (Monday start)', () => {
          const result = f.calcOffsetDateStr('2024-11-06', '1w', 'week')
          // Nov 6, 2024 is in ISO week 45, adding 1 week = week 46
          expect(result).toEqual('2024-W46')
          expect(mockCalendarMondayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +1w -> 2024-W45 (Monday start)', () => {
          const result = f.calcOffsetDateStr('2024-W44', '1w')
          expect(result).toEqual('2024-W45')
          expect(mockCalendarMondayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W52 +1w -> 2025-W01 (crosses year boundary, Monday start)', () => {
          // ISO week 52 of 2024 + 1 week = ISO week 1 of 2025
          const result = f.calcOffsetDateStr('2024-W52', '1w')
          expect(result).toEqual('2025-W01')
        })

        test('2023-W52 +1w -> 2024-W01 (year boundary)', () => {
          const result = f.calcOffsetDateStr('2023-W52', '1w')
          expect(result).toEqual('2024-W01')
        })

        test('2024-W01 -1w -> 2023-W52 (crosses year boundary backwards)', () => {
          const result = f.calcOffsetDateStr('2024-W01', '-1w')
          expect(result).toEqual('2023-W52')
        })

        test('2024-01-15 (Mon) +2w -> 2024-W05 (converts date to week with Monday start)', () => {
          // Jan 15, 2024 is in ISO week 3, adding 2 weeks = week 5
          const result = f.calcOffsetDateStr('2024-01-15', '2w', 'week')
          expect(result).toEqual('2024-W05')
          expect(mockCalendarMondayStart.weekNumber).toHaveBeenCalled()
        })
      })

      describe('Edge cases: week 53 handling', () => {
        let originalCalendar
        beforeEach(() => {
          originalCalendar = global.Calendar
          global.Calendar = mockCalendarMondayStart
          mockCalendarMondayStart.weekNumber.mockClear()
          mockCalendarMondayStart.startOfWeek.mockClear()
          mockCalendarMondayStart.endOfWeek.mockClear()
        })

        afterEach(() => {
          global.Calendar = originalCalendar
        })

        test('2020-W53 +0w -> 2020-W53 (ISO year 2020 has 53 weeks)', () => {
          // 2020 is a leap year and has 53 ISO weeks
          const result = f.calcOffsetDateStr('2020-W53', '0w')
          expect(result).toEqual('2020-W53')
        })

        test('2020-W53 +1w -> 2021-W01 (from last week of 2020 to first week of 2021)', () => {
          const result = f.calcOffsetDateStr('2020-W53', '1w')
          expect(result).toEqual('2021-W01')
        })

        test('2021-W01 -1w -> 2020-W53 (back to last week of 2020)', () => {
          // Going back from first week of 2021 should give us week 53 of 2020
          const result = f.calcOffsetDateStr('2021-W01', '-1w')
          expect(result).toEqual('2020-W53')
        })

        test('2015-W53 exists (Thursday starts the year)', () => {
          // 2015 also has 53 weeks (Jan 1, 2015 was Thursday)
          const result = f.calcOffsetDateStr('2015-W53', '0w')
          expect(result).toEqual('2015-W53')
        })
      })

      describe('Multiple week offsets', () => {
        let originalCalendar
        beforeEach(() => {
          originalCalendar = global.Calendar
          global.Calendar = mockCalendarMondayStart
          mockCalendarMondayStart.weekNumber.mockClear()
          mockCalendarMondayStart.startOfWeek.mockClear()
          mockCalendarMondayStart.endOfWeek.mockClear()
        })

        afterEach(() => {
          global.Calendar = originalCalendar
        })

        test('2024-W01 +10w -> 2024-W11 (10 weeks forward)', () => {
          const result = f.calcOffsetDateStr('2024-W01', '10w')
          expect(result).toEqual('2024-W11')
        })

        test('2024-W50 +10w -> 2025-W08 (crosses into next year)', () => {
          // Week 50 + 10 weeks = week 60, which is week 8 of next year
          const result = f.calcOffsetDateStr('2024-W50', '10w')
          expect(result).toEqual('2025-W08')
        })

        test('2024-W10 -20w -> 2023-W42 (crosses into previous year)', () => {
          // Week 10 - 20 weeks crosses back to previous year
          // 2023 has 52 weeks, so week 10-20 = week -10, which is 52-10 = week 42 of 2023
          const result = f.calcOffsetDateStr('2024-W10', '-20w')
          expect(result).toEqual('2023-W42')
        })

        test('2024-W26 +26w -> 2024-W52 (exactly half year forward)', () => {
          // Mid-year (week 26) + 26 weeks = week 52 (end of year)
          const result = f.calcOffsetDateStr('2024-W26', '26w')
          expect(result).toEqual('2024-W52')
        })
      })

      describe('Week format with adaptOutputInterval', () => {
        let originalCalendar
        beforeEach(() => {
          originalCalendar = global.Calendar
          global.Calendar = mockCalendarMondayStart
          mockCalendarMondayStart.weekNumber.mockClear()
          mockCalendarMondayStart.startOfWeek.mockClear()
          mockCalendarMondayStart.endOfWeek.mockClear()
        })

        afterEach(() => {
          global.Calendar = originalCalendar
        })

        test("'base' format preserves week when input is week", () => {
          const result = f.calcOffsetDateStr('2024-W20', '1w', 'base')
          expect(result).toEqual('2024-W21')
        })

        test("'offset' format uses week when offset is week", () => {
          // Start with a day, offset by weeks, output as week (based on offset unit)
          const result = f.calcOffsetDateStr('2024-01-15', '2w', 'offset')
          expect(result).toEqual('2024-W05')
        })

        test("'week' format converts date to week", () => {
          // Start with a day, no offset, but output as week
          const result = f.calcOffsetDateStr('2024-01-15', '0d', 'week')
          expect(result).toEqual('2024-W03')
        })

        test("'longer' format converts day to week when offset is weeks", () => {
          // Day + week offset with 'longer' should output as week (longer than day)
          const result = f.calcOffsetDateStr('2024-01-15', '2w', 'longer')
          expect(result).toEqual('2024-W05')
        })

        test("'shorter' format keeps day when offset is day", () => {
          // Week + day offset with 'shorter' should output as day (shorter than week)
          const result = f.calcOffsetDateStr('2024-W20', '5d', 'shorter')
          expect(result).toEqual('2024-05-18')
        })

        test("'longer' format keeps week when offset is day", () => {
          // Week + day offset with 'longer' should keep week format (longer than day)
          const result = f.calcOffsetDateStr('2024-W20', '5d', 'longer')
          expect(result).toEqual('2024-W20')
        })
      })
    })

    describe('should pass', () => {
      test('20220101 +1d', () => {
        expect(f.calcOffsetDateStr('20220101', '1d')).toEqual('20220102')
      })
      test('20220101 +364d', () => {
        expect(f.calcOffsetDateStr('20220101', '364d')).toEqual('20221231')
      })
      test('20220101 +4m', () => {
        expect(f.calcOffsetDateStr('20220101', '4m')).toEqual('20220501')
      })
      test('2022-01-01 +1d', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '1d')).toEqual('2022-01-02')
      })
      test('2022-01-01 +364d', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '364d')).toEqual('2022-12-31')
      })
      test('2022-01-01 +4m', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '4m')).toEqual('2022-05-01')
      })
      test('2022-01-01 +3q', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '3q')).toEqual('2022-10-01')
      })
      test('2022-01-01 +2y', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '2y')).toEqual('2024-01-01')
      })
      test('2022-01-01 0d', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '0d')).toEqual('2022-01-01')
      })
      test('2022-01-01 -1d', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '-1d')).toEqual('2021-12-31')
      })
      test('2022-01-01 -2w', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '-2w')).toEqual('2021-12-18')
      })
      test('2022-01-01 -4m', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '-4m')).toEqual('2021-09-01')
      })
      test('2022-01-01 -3q', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '-3q')).toEqual('2021-04-01')
      })
      test('2022-01-01 -2y', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '-2y')).toEqual('2020-01-01')
      })
      test('2022-01-01 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '1b')).toEqual('2022-01-03')
      })
      test('2022-01-01 +2b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '2b')).toEqual('2022-01-04')
      })
      test('2022-01-01 +3b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '3b')).toEqual('2022-01-05')
      })
      test('2022-01-01 +4b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '4b')).toEqual('2022-01-06')
      })
      test('2022-01-01 +5b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '5b')).toEqual('2022-01-07')
      })
      test('2022-01-01 +6b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '6b')).toEqual('2022-01-10')
      })
      test('2022-01-01 +7b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '7b')).toEqual('2022-01-11')
      })
      test('2022-01-01 +8b', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '8b')).toEqual('2022-01-12')
      })
      test('2022-01-02 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-02', '1b')).toEqual('2022-01-03')
      })
      test('2022-01-03 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-03', '1b')).toEqual('2022-01-04')
      })
      test('2022-01-04 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-04', '1b')).toEqual('2022-01-05')
      })
      test('2022-01-05 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-05', '1b')).toEqual('2022-01-06')
      })
      test('2022-01-06 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-06', '1b')).toEqual('2022-01-07')
      })
      test('2022-01-07 +1b', () => {
        expect(f.calcOffsetDateStr('2022-01-07', '1b')).toEqual('2022-01-10')
      })
      test('2022-W23 +1w', () => {
        expect(f.calcOffsetDateStr('2022-W23', '1w')).toEqual('2022-W24')
      })
      test('2022-W52 +1w', () => {
        expect(f.calcOffsetDateStr('2022-W52', '1w')).toEqual('2023-W01')
      })
      test('2022-01-01 +2w', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '2w')).toEqual('2022-01-15')
      })
      test('2023-07-24 +0w', () => {
        expect(f.calcOffsetDateStr('2023-07-24', '0w')).toEqual('2023-07-24')
      })
      test('2022-W23 +2w', () => {
        expect(f.calcOffsetDateStr('2022-W23', '2w')).toEqual('2022-W25')
      })
      test('2022-W23 +3m', () => {
        expect(f.calcOffsetDateStr('2022-W23', '3m')).toEqual('2022-W36')
      })
      test('2022-W23 -2w', () => {
        expect(f.calcOffsetDateStr('2022-W23', '-2w')).toEqual('2022-W21')
      })
      test('2022-02 +3m', () => {
        expect(f.calcOffsetDateStr('2022-02', '3m')).toEqual('2022-05')
      })
      test('2022-02 -3m', () => {
        expect(f.calcOffsetDateStr('2022-02', '-3m')).toEqual('2021-11')
      })
      test('2022-Q2 +2q', () => {
        expect(f.calcOffsetDateStr('2022-Q2', '2q')).toEqual('2022-Q4')
      })
      test('2022-Q2 -2q', () => {
        expect(f.calcOffsetDateStr('2022-Q2', '-2q')).toEqual('2021-Q4')
      })
      test('2022 +2y', () => {
        expect(f.calcOffsetDateStr('2022', '2y')).toEqual('2024')
      })
      test('2022 -2y', () => {
        expect(f.calcOffsetDateStr('2022', '-2y')).toEqual('2020')
      })
    })
    describe('adapting output to week timeframe', () => {
      beforeAll(() => {
        // DataStore.settings['_logLevel'] = "DEBUG"
      })
      test('2024-11-02 +1w -> 2024-W45', () => {
        expect(f.calcOffsetDateStr('2024-11-02', '+1w', 'week')).toEqual('2024-W45')
      })
      test('2024-11-02 1w -> 2024-W45', () => {
        expect(f.calcOffsetDateStr('2024-11-02', '1w', 'week')).toEqual('2024-W45')
      })
      test('2024-W44 +1w -> 2024-W45', () => {
        expect(f.calcOffsetDateStr('2024-W44', '+1w', 'week')).toEqual('2024-W45')
      })
      test('2024-W44 1w -> 2024-W45', () => {
        expect(f.calcOffsetDateStr('2024-W44', '1w', 'week')).toEqual('2024-W45')
      })
    })
    describe('adapting output to offset durations', () => {
      beforeAll(() => {
        // DataStore.settings['_logLevel'] = "DEBUG"
      })
      test('20230101 +1d -> 20230102', () => {
        expect(f.calcOffsetDateStr('20230101', '1d', 'offset')).toEqual('20230102')
      })
      test('2023-07 +14d -> 2023-07-15', () => {
        expect(f.calcOffsetDateStr('2023-07', '14d', 'offset')).toEqual('2023-07-15')
      })
      test('2023-07 +10b -> 2023-07-14', () => {
        expect(f.calcOffsetDateStr('2023-07', '10b', 'offset')).toEqual('2023-07-14')
      })
      test('2023-W30 0d -> 2023-07-24', () => {
        expect(f.calcOffsetDateStr('2023-W30', '0d', 'offset')).toEqual('2023-07-24')
      })
      test('2023-Q3 +6w -> 2023-W32', () => {
        expect(f.calcOffsetDateStr('2023-Q3', '6w', 'offset')).toEqual('2023-W32')
      })
      test('2023 +3q -> 2023-Q4', () => {
        expect(f.calcOffsetDateStr('2023', '3q', 'offset')).toEqual('2023-Q4')
      })
    })
    describe('adapting output to shorter durations than base', () => {
      test('20230101 +1d -> 20230102', () => {
        expect(f.calcOffsetDateStr('20230101', '1d', 'shorter')).toEqual('20230102')
      })
      test('2023-07 +14d -> 2023-07-15', () => {
        expect(f.calcOffsetDateStr('2023-07', '14d', 'shorter')).toEqual('2023-07-15')
      })
      test('2023-07 +2w -> 2023-W28', () => {
        expect(f.calcOffsetDateStr('2023-07', '2w', 'shorter')).toEqual('2023-W28')
      })
      test('2023-Q3 +6w -> 2023-W32', () => {
        expect(f.calcOffsetDateStr('2023-Q3', '6w', 'shorter')).toEqual('2023-W32')
      })
      test('2023 +3q -> 2023-Q4', () => {
        expect(f.calcOffsetDateStr('2023', '3q', 'shorter')).toEqual('2023-Q4')
      })
    })
    describe('adapting output to longer durations than base', () => {
      test('20230101 +1d -> 20230102', () => {
        expect(f.calcOffsetDateStr('20230101', '1d', 'longer')).toEqual('20230102')
      })
      test('2023-07-24 +0w -> 2023-W30', () => {
        expect(f.calcOffsetDateStr('2023-07-24', '0w', 'longer')).toEqual('2023-W30')
      })
      test('2023-07+24 +2w -> 2023-W32', () => {
        expect(f.calcOffsetDateStr('2023-07-24', '2w', 'longer')).toEqual('2023-W32')
      })
      test('2023-W30 +1m -> 2023-W32', () => {
        expect(f.calcOffsetDateStr('2023-W30', '1m', 'longer')).toEqual('2023-08')
      })
      test('2023-02 +2q -> 2023-Q3', () => {
        expect(f.calcOffsetDateStr('2023-02', '2q', 'longer')).toEqual('2023-Q3')
      })
    })
    describe('should return errors', () => {
      test('2022-01 (invalid date)', () => {
        expect(f.calcOffsetDateStr('2022-01', '')).toEqual('(error)')
      })
      test('2022-01-01 (blank interval)', () => {
        expect(f.calcOffsetDateStr('2022-01-01', '')).toEqual('(error)')
      })
      test("2022-01-01 (invalid interval) 'v'", () => {
        expect(f.calcOffsetDateStr('2022-01-01', 'v')).toEqual('(error)')
      })
      test("2022-01-01 (invalid interval) '23'", () => {
        expect(f.calcOffsetDateStr('2022-01-01', '23')).toEqual('(error)')
      })
    })
  })
})
