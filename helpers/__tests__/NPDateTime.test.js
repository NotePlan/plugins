/* global describe, test, expect, beforeAll, it */
import moment from 'moment/min/moment-with-locales'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../NPdateTime'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

// const PLUGIN_NAME = `helpers`
const FILENAME = `NPDateTime`

function isValidDate(date) {
  return date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date)
}

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
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
   * relativeDateFromDateString()
   */
  describe('relativeDateFromDateString', () => {
    const toDateStr = moment([2023, 8, 6, 0, 0, 0]).format('YYYY-MM-DD') // = 2023-09-06
    describe('invalid inputs should fail', () => {
      test('fail on 2023-09-0 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-09-0', toDateStr)).toEqual(['(error)', '(error)'])
      })
      test('fail on 2023-09-06 to 20230910', () => {
        expect(f.relativeDateFromDateString('2023-09-06', '20230910')).toEqual(['(error)', '(error)'])
      })
    })
    describe('valid inputs should work', () => {
      test('2023-09-06 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-09-06', toDateStr)).toEqual(['0d', 'today'])
      })
      test('2023-09-05 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-09-05', toDateStr)).toEqual(['-1d', 'yesterday'])
      })
      test('2023-09-07 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-09-07', toDateStr)).toEqual(['1d', 'tomorrow'])
      })
      test('2023-W36 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-W36', toDateStr)).toEqual(['0w', 'this week'])
      })
      test('2023-W34 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-W34', toDateStr)).toEqual(['-2w', '-2 weeks'])
      })
      test('2023-W38 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-W38', toDateStr)).toEqual(['2w', '2 weeks'])
      })
      test('2023-09 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-09', toDateStr)).toEqual(['0m', 'this month'])
      })
      test('2023-Q3 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-Q3', toDateStr)).toEqual(['0q', 'this quarter'])
      })
      test('2023-Q1 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-Q1', toDateStr)).toEqual(['-2q', '-2 quarters'])
      })
      test('2023-Q4 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023-Q4', toDateStr)).toEqual(['1q', 'next quarter'])
      })
      test('2023 to 2023-09-06', () => {
        expect(f.relativeDateFromDateString('2023', toDateStr)).toEqual(['0y', 'this year'])
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
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('year', 3, 2021, false)
        expect(ps).toEqual('2021')
        expect(paps).toEqual('2021')
      })
    })
    describe('quarters', () => {
      it('oq / 3 / 2021 / false', () => {
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('quarter', 3, 2021, false)
        expect(ps).toEqual('2021 Q3 (Jul-Sep)')
        expect(paps).toEqual('2021 Q3 (Jul-Sep)')
      })
    })
    describe('months', () => {
      it('om / 3 / 2021 / false', () => {
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('month', 3, 2021, false)
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
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('week', 51, 2023, false)
        expect(ps).toEqual('2023-W51')
        expect(paps).toEqual('2023-W51')
        expect(fd).toEqual(new Date(2023, 11, 18, 0, 0, 0)) // 18.12.2023
        expect(td).toEqual(new Date(2023, 11, 24, 23, 59, 59, 999)) // 24.12.2023
      })
    })
    describe('days', () => {
      // Skip this as it calls helper function setMomentLocaleFromEnvironment that isn't mocked (yet)
      it.skip('today / 3 / 2021 / false', () => {
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('today', 3, 2021, false)
        expect(ps).toEqual('today')
        expect(paps).toEqual('Today')
      })
      // Is specific to today, so needs updating to test.
      // This was correct on 2023-12-27
      it.skip('2023-12-01 / 3 / 2021 / false', () => {
        const [fd, td, psc, ps, paps] = f.getPeriodStartEndDatesFromPeriodCode('2023-12-01', 3, 2021, false)
        expect(ps).toEqual('since 2023-12-01')
        expect(paps).toEqual('26 days since 2023-12-01')
      })
    })
  })
})
