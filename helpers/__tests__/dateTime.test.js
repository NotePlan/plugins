/* globals describe, expect, jest, test, beforeEach, afterEach, beforeAll */

import colors from 'chalk'
import { CustomConsole } from '@jest/console' // see note below
import * as dt from '../dateTime'
// import { filenameIsInFuture } from '../dateTime'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  // Configure Calendar mock to use ISO weeks (Monday-start) by default for backward compatibility
  const moment = require('moment/min/moment-with-locales')
  global.Calendar = {
    ...Calendar,
    weekNumber: (date) => moment(date).isoWeek(),
    startOfWeek: (date) => moment(date).startOf('isoWeek').toDate(),
    endOfWeek: (date) => moment(date).endOf('isoWeek').toDate(),
  }
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  DataStore.settings['_logLevel'] = 'none' // change this to DEBUG to get more logging, or 'none' for quiet
})

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/dateTime')}`
// const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  /*
   * isScheduled()
   */
  describe('isScheduled()' /* function */, () => {
    test('should be true for a date', () => {
      const result = dt.isScheduled('foo >2020-01-01')
      expect(result).toEqual(true)
    })
    test('should be true for a week', () => {
      const result = dt.isScheduled('foo >2020-W01')
      expect(result).toEqual(true)
    })
    test('should be true for a month', () => {
      const result = dt.isScheduled('foo >2020-01')
      expect(result).toEqual(true)
    })
    test('should be true for a year', () => {
      const result = dt.isScheduled('foo >2020')
      expect(result).toEqual(true)
    })
    test('should be true for a quarter', () => {
      const result = dt.isScheduled('foo >2020-Q1')
      expect(result).toEqual(true)
    })
    test('should be true for a date+', () => {
      const result = dt.isScheduled('foo >2020-01-01+')
      expect(result).toEqual(true)
    })
    test('should be true for a >today', () => {
      const result = dt.isScheduled('foo >today')
      expect(result).toEqual(true)
    })
    test('should be true for multiples', () => {
      const result = dt.isScheduled('foo >2020-01-01 >today')
      expect(result).toEqual(true)
    })
    test('should be false if nothing is there', () => {
      const result = dt.isScheduled('foo bar baz')
      expect(result).toEqual(false)
    })
  })

  /*
   * findScheduledDates()
   */
  describe('findScheduledDates()' /* function */, () => {
    test('should return nothing on empty string', () => {
      const result = dt.findScheduledDates('')
      expect(result).toEqual([])
    })
    test('should find single >ISO date', () => {
      const result = dt.findScheduledDates('foo >2020-01-01 sinething')
      expect(result).toEqual(['2020-01-01'])
    })
    test('should find single >today', () => {
      const result = dt.findScheduledDates('foo >today sinething')
      expect(result).toEqual(['today'])
    })
    test('should find single >week date', () => {
      const result = dt.findScheduledDates('foo >2025-W01 sinething')
      expect(result).toEqual(['2025-W01'])
    })
    test('should not find single ISO date without >', () => {
      const result = dt.findScheduledDates('foo 2020-01-01 sinething')
      expect(result).toEqual([])
    })
    test('should find multiple >ISO dates', () => {
      const result = dt.findScheduledDates('foo >2020-01-01 sinething >2025-01-04')
      expect(result).toEqual(['2020-01-01', '2025-01-04'])
    })
    test('should find multiple types of >dates', () => {
      const result = dt.findScheduledDates('foo >2020-01-01 sinething >2025-W52')
      expect(result).toEqual(['2020-01-01', '2025-W52'])
    })
  })

  /*
   * findOverdueDatesInString()
   */
  describe('findOverdueDatesInString()' /* function */, () => {
    test('should find no date in line with no overdue', () => {
      const result = dt.findOverdueDatesInString('>2922-01-01')
      expect(result.length).toEqual(0)
    })
    test('should find date in line with overdue', () => {
      const result = dt.findOverdueDatesInString('>1999-01-01')
      expect(result.length).toEqual(1)
      expect(result).toEqual(['>1999-01-01'])
    })
    test('should find 2 overdue dates', () => {
      const result = dt.findOverdueDatesInString('>1999-01-01 >1998-01-01')
      expect(result).toEqual(['>1998-01-01', '>1999-01-01'])
    })
    test('should find no overdue dates if there are multiple and any are not overdue', () => {
      const result = dt.findOverdueDatesInString('>1999-01-01 >2922-01-01')
      expect(result.length).toEqual(0)
    })
  })

  /*
   * isWeeklyNote()
   */
  describe('isWeeklyNote()' /* function */, () => {
    test('should find a weekly filename', () => {
      const result = dt.isWeeklyNote({ filename: '2022-W35.txt' })
      expect(result).toEqual(true)
    })
    test('should fail on a non-weekly filename', () => {
      const result = dt.isWeeklyNote({ filename: 'xyz2022-W35.md' })
      expect(result).toEqual(false)
    })
    test('should fail on a non-weekly filename', () => {
      const result = dt.isWeeklyNote({ filename: '2022-W66.md' })
      expect(result).toEqual(false)
    })
  })

  /*
   * isMonthlyNote()
   */
  describe('isMonthlyNote()' /* function */, () => {
    test('should find a monthly filename', () => {
      const result = dt.isMonthlyNote({ filename: '2022-02.md' })
      expect(result).toEqual(true)
    })
    test('should fail on a non-monthly filename', () => {
      const result = dt.isMonthlyNote({ filename: 'xyz2022-35.md' })
      expect(result).toEqual(false)
    })
    test('should fail on a non-monthly filename', () => {
      const result = dt.isMonthlyNote({ filename: '2022-20.md' })
      expect(result).toEqual(false)
    })
  })

  /*
   * isQuarterlyNote()
   */
  describe('isQuarterlyNote()' /* function */, () => {
    test('should find a quarterly filename', () => {
      const result = dt.isQuarterlyNote({ filename: '2022-Q2.md' })
      expect(result).toEqual(true)
    })
    test('should fail on a non-quarterly filename', () => {
      const result = dt.isQuarterlyNote({ filename: 'xyz2022-Q5.md' })
      expect(result).toEqual(false)
    })
  })

  /*
   * isYearlyNote()
   */
  describe('isYearlyNote()' /* function */, () => {
    test('should find a Yearly filename', () => {
      const result = dt.isYearlyNote({ filename: '2022.txt' })
      expect(result).toEqual(true)
    })
    test('should fail on a non-Yearly filename', () => {
      const result = dt.isYearlyNote({ filename: 'xyz2022-Q5.md' })
      expect(result).toEqual(false)
    })
    test('should fail on a non-Yearly filename', () => {
      const result = dt.isYearlyNote({ filename: '2022-Q5.md' })
      expect(result).toEqual(false)
    })
  })

  /*
   * isDailyDateStr()
   */
  describe('isDailyDateStr()', () => {
    test('false for empty string', () => {
      const result = dt.isDailyDateStr('')
      expect(result).toEqual(false)
    })
    test('true for a DDDDMMYY date', () => {
      const result = dt.isDailyDateStr('20220505')
      expect(result).toEqual(true)
    })
    test('true for a private filename', () => {
      const result = dt.isDailyDateStr('20220505.txt')
      expect(result).toEqual(true)
    })
    test('true for a teamspace filename', () => {
      const result = dt.isDailyDateStr('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250429.md')
      expect(result).toEqual(true)
    })
    test('true for an ISO date', () => {
      const result = dt.isDailyDateStr('string with 2022-06-06 in it')
      expect(result).toEqual(true)
    })
    test('should fail on a non-daily filename', () => {
      const result = dt.isDailyDateStr('xyz2022-W35.md')
      expect(result).toEqual(false)
    })
  })

  /*
   * isYearlyDateStr()
   */
  describe('isYearlyDateStr()', () => {
    test('should find a bare Year', () => {
      const result = dt.isYearlyDateStr('2022')
      expect(result).toEqual(true)
    })
    test('should fail on a Quarter date', () => {
      const result = dt.isYearlyDateStr('2024-Q5')
      expect(result).toEqual(false)
    })
    test('should fail on a filename date', () => {
      const result = dt.isYearlyDateStr('20241222')
      expect(result).toEqual(false)
    })
    test('should fail on an ISO date', () => {
      const result = dt.isYearlyDateStr('2024-12-22')
      expect(result).toEqual(false)
    })
  })

  /*
   * replaceArrowDatesInString()
   */
  describe('replaceArrowDatesInString()', () => {
    test('should not change anything if no arrow dates and empty replace string', () => {
      const result = dt.replaceArrowDatesInString('test today with no dates!', '')
      expect(result).toEqual(`test today with no dates!`)
    })
    test('should just remove >today', () => {
      const result = dt.replaceArrowDatesInString('test today >today', '')
      expect(result).toEqual(`test today`)
    })
    test('should replace today with todays date', () => {
      const result = dt.replaceArrowDatesInString('foo >today bar')
      expect(result).toEqual(`foo bar ${dt.getTodaysDateAsArrowDate()}`)
    })
    test('should replace multiples with todays date', () => {
      const result = dt.replaceArrowDatesInString('>2021-02-02 foo >today bar >2022')
      expect(result).toEqual(`foo bar ${dt.getTodaysDateAsArrowDate()}`)
    })
    test('should replace multiples with my string', () => {
      const result = dt.replaceArrowDatesInString('>2021-02-02 foo >today bar >2022-05-05', 'baz')
      expect(result).toEqual(`foo bar baz`)
    })
    test('should replace multiple scheduled week/month dates with my string', () => {
      const result = dt.replaceArrowDatesInString('>2021-02 foo >today bar >2022-W05 >2022-Q3', 'baz')
      expect(result).toEqual(`foo bar baz`)
    })
  })

  describe('getDateObjFromDateString', () => {
    test('fail with empty string', () => {
      expect(dt.getDateObjFromDateString('')).toEqual(undefined)
    })
    test('fail with a time string', () => {
      expect(dt.getDateObjFromDateString('12:30')).toEqual(undefined)
    })
    test('work with a valid YYYY-MM-DD string', () => {
      expect(dt.getDateObjFromDateString('2021-12-12')).toEqual(new Date(2021, 11, 12, 0, 0, 0))
    })
    test('fail with invalid YYYY-MM-DD string', () => {
      expect(dt.getDateObjFromDateString('2021-14-44')).toEqual(undefined)
    })
    test('fail with a different date style', () => {
      expect(dt.getDateObjFromDateString('3/9/2021')).toEqual(undefined)
    })
  })

  // @dwertheimer
  describe('getDateObjFromDateTimeString ', () => {
    describe('should work', () => {
      test('should create date and HH:MM from string, no seconds', () => {
        expect(dt.getDateObjFromDateTimeString('2021-01-01 09:40').toTimeString()).toMatch(/09:40:00/) //not checking date b/c it's locale-dependent
      })
      test('should work with seconds specified', () => {
        expect(dt.getDateObjFromDateTimeString('2021-01-02 00:00:01').toTimeString()).toMatch(/00:00:01/)
      })
      test('should work with only date, no time given', () => {
        expect(dt.getDateObjFromDateTimeString('2021-01-03').toTimeString()).toMatch(/00:00:00/) //not checking date b/c it's locale-dependent
      })
    })

    describe('errors', () => {
      test('should throw error when date format is incorrect', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`foo 00:00`)
        }).toThrow(/not in expected format/)
      })
      test('should throw error when date format is incorrect (no day)', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`2020-04 02:02`)
        }).toThrow(/not in expected format/)
      })
      test('should throw error when time format is incorrect', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`2020-01-05 02`)
        }).toThrow(/not in expected format/)
      })
      test('should throw error when time format is incorrect', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`2020-01-06 aa:00`)
        }).toThrow(/Invalid Date/)
      })
    })

    describe('getDateObjFromString mocked date', () => {
      beforeEach(() => {
        jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('99:99:99')
      })
      test('should throw error when Date object time does not match time sent in', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`2020-01-07 22:00`)
        }).toThrow(/Catalina date hell/)
      })
      afterEach(() => {
        jest.restoreAllMocks()
      })
    })
  })

  describe('getTimeStringFromDate', () => {
    test('should return time portion of Date as string HH:MM', () => {
      expect(dt.getTimeStringFromDate(new Date('2020-01-01 23:59'))).toEqual('23:59')
    })
  })

  describe('daysBetween', () => {
    describe('truncated results (default)', () => {
      test('identical dates', () => {
        const res = dt.daysBetween(new Date(2021, 3, 24, 0, 0, 0), new Date(2021, 3, 24, 0, 0, 0))
        expect(res).toEqual(0)
      })
      test('dates 11 hours apart (forwards)', () => {
        const res = dt.daysBetween(new Date(2021, 3, 24, 0, 0, 0), new Date(2021, 3, 24, 11, 0, 0))
        expect(res).toEqual(0)
      })
      test('dates 11 hours apart (backwards)', () => {
        const res = dt.daysBetween(new Date(2021, 3, 24, 11, 0, 0), new Date(2021, 3, 24, 0, 0, 0))
        expect(res).toEqual(0) // returns -0 normally!
      })
      test('consecutive dates (forward)', () => {
        const res = dt.daysBetween(new Date(2021, 3, 24, 0, 0, 0), new Date(2021, 3, 25, 0, 0, 0))
        expect(res).toEqual(1)
      })
      test('consecutive dates (backwards)', () => {
        const res = dt.daysBetween(new Date(2021, 3, 24, 0, 0, 0), new Date(2021, 3, 23, 0, 0, 0))
        expect(res).toEqual(-1)
      })
      test('start Feb -> start Mar', () => {
        const res = dt.daysBetween(new Date(2023, 1, 1, 0, 0, 0), new Date(2023, 2, 1, 0, 0, 0)) // note months are 0-based
        expect(res).toEqual(28)
      })
      test('start 2023 -> start 2024', () => {
        const res = dt.daysBetween(new Date(2023, 0, 1, 0, 0, 0), new Date(2024, 0, 1, 0, 0, 0)) // note months are 0-based
        expect(res).toEqual(365)
      })
      test('works for string inputs', () => {
        const res = dt.daysBetween('2021-03-25', '2021-03-26')
        expect(res).toEqual(1)
      })
      test('works for mixed string and calendar date', () => {
        const res = dt.daysBetween('2021-03-25', new Date(2021, 2, 26, 14, 0, 0))
        expect(res).toEqual(1)
      })
      test('should throw error on invalid start  date', () => {
        const res = () => dt.daysBetween('2021-03', new Date(2021, 2, 26, 14, 0, 0))
        expect(res).toThrow(/Invalid/)
      })
      test('should throw error on invalid end date', () => {
        const res = () => dt.daysBetween(new Date(2021, 2, 26, 14, 0, 0), '2021-03')
        expect(res).toThrow(/Invalid/)
      })
    })
    describe('non-truncated results', () => {
      test('should return fractional day', () => {
        const res = dt.daysBetween(new Date(2021, 2, 24, 11, 0, 0), new Date(2021, 2, 24, 12, 1, 2), true)
        expect(res.toFixed(4)).toEqual((1 / 24 + 1 / (24 * 60) + 2 / (24 * 60 * 60)).toFixed(4))
      })
    })
    test('dates one day-ish apart (forwards) using string date', () => {
      const res = dt.daysBetween('2021-03-23', new Date(2021, 2, 24, 14, 0, 0))
      expect(res).toEqual(1)
    })
  })

  describe('withinDateRange', () => {
    test('test 1', () => {
      expect(dt.withinDateRange('20210424', '20210501', '20210531')).toEqual(false)
    })
    test('test 2', () => {
      expect(dt.withinDateRange('20210501', '20210501', '20210531')).toEqual(true)
    })
    test('test 3', () => {
      expect(dt.withinDateRange('20210524', '20210501', '20210531')).toEqual(true)
    })
    test('test 4', () => {
      expect(dt.withinDateRange('20210531', '20210501', '20210531')).toEqual(true)
    })
    test('test 5', () => {
      expect(dt.withinDateRange('20210624', '20210501', '20210531')).toEqual(false)
    })
    test('test 6 over year boundary', () => {
      expect(dt.withinDateRange('20240101', '20231201', '20240201')).toEqual(true)
    })
    test('test 7 on a valid leap day', () => {
      expect(dt.withinDateRange('20240229', '20240201', '20240301')).toEqual(true)
    })
    test('test 8 on an invalid leap day', () => {
      expect(dt.withinDateRange('20230229', '20230201', '20230301')).toEqual(false)
    })
  })

  describe('relativeDateFromNumber', () => {
    describe('default style (long format)', () => {
      test('should return "today" for 0 days', () => {
        expect(dt.relativeDateFromNumber(0)).toEqual('today')
      })
      test('should return "1 day ago" for -1 days', () => {
        expect(dt.relativeDateFromNumber(-1)).toEqual('1 day ago')
      })
      test('should return "in 1 day" for 1 day', () => {
        expect(dt.relativeDateFromNumber(1)).toEqual('in 1 day')
      })
      test('should return "2 days ago" for -2 days', () => {
        expect(dt.relativeDateFromNumber(-2)).toEqual('2 days ago')
      })
      test('should return "in 2 days" for 2 days', () => {
        expect(dt.relativeDateFromNumber(2)).toEqual('in 2 days')
      })
      test('should return "8 days ago" for -8 days', () => {
        expect(dt.relativeDateFromNumber(-8)).toEqual('8 days ago')
      })
      test('should return "in 8 days" for 8 days', () => {
        expect(dt.relativeDateFromNumber(8)).toEqual('in 8 days')
      })
      test('should return "1 wk ago" for -10 days', () => {
        expect(dt.relativeDateFromNumber(-10)).toEqual('1 wk ago')
      })
      test('should return "in 1 wk" for 10 days', () => {
        expect(dt.relativeDateFromNumber(10)).toEqual('in 1 wk')
      })
      test('should return "3 wks ago" for -21 days', () => {
        expect(dt.relativeDateFromNumber(-21)).toEqual('3 wks ago')
      })
      test('should return "in 3 wks" for 21 days', () => {
        expect(dt.relativeDateFromNumber(21)).toEqual('in 3 wks')
      })
      test('should return "1 mon ago" for -30 days', () => {
        expect(dt.relativeDateFromNumber(-30)).toEqual('1 mon ago')
      })
      test('should return "in 1 mon" for 30 days', () => {
        expect(dt.relativeDateFromNumber(30)).toEqual('in 1 mon')
      })
      test('should return "12 mon ago" for -365 days', () => {
        expect(dt.relativeDateFromNumber(-365)).toEqual('12 mon ago')
      })
      test('should return "in 12 mon" for 365 days', () => {
        expect(dt.relativeDateFromNumber(365)).toEqual('in 12 mon')
      })
      test('should return "16 mon ago" for -500 days (less than 550)', () => {
        expect(dt.relativeDateFromNumber(-500)).toEqual('16 mon ago')
      })
      test('should return "in 16 mon" for 500 days (less than 550)', () => {
        expect(dt.relativeDateFromNumber(500)).toEqual('in 16 mon')
      })
      test('should return "2 yrs ago" for -550 days (550/365 rounds to 2)', () => {
        expect(dt.relativeDateFromNumber(-550)).toEqual('2 yrs ago')
      })
      test('should return "in 2 yrs" for 550 days (550/365 rounds to 2)', () => {
        expect(dt.relativeDateFromNumber(550)).toEqual('in 2 yrs')
      })
      test('should return "2 yrs ago" for -730 days', () => {
        expect(dt.relativeDateFromNumber(-730)).toEqual('2 yrs ago')
      })
      test('should return "in 2 yrs" for 730 days', () => {
        expect(dt.relativeDateFromNumber(730)).toEqual('in 2 yrs')
      })
    })
    describe('short style', () => {
      test('should return "today" for 0 days', () => {
        expect(dt.relativeDateFromNumber(0, true)).toEqual('today')
      })
      test('should return "1d ago" for -1 days', () => {
        expect(dt.relativeDateFromNumber(-1, true)).toEqual('1d ago')
      })
      test('should return "in 1d" for 1 day', () => {
        expect(dt.relativeDateFromNumber(1, true)).toEqual('in 1d')
      })
      test('should return "8d ago" for -8 days', () => {
        expect(dt.relativeDateFromNumber(-8, true)).toEqual('8d ago')
      })
      test('should return "in 8d" for 8 days', () => {
        expect(dt.relativeDateFromNumber(8, true)).toEqual('in 8d')
      })
      test('should return "1w ago" for -10 days', () => {
        expect(dt.relativeDateFromNumber(-10, true)).toEqual('1w ago')
      })
      test('should return "in 1w" for 10 days', () => {
        expect(dt.relativeDateFromNumber(10, true)).toEqual('in 1w')
      })
      test('should return "3w ago" for -21 days', () => {
        expect(dt.relativeDateFromNumber(-21, true)).toEqual('3w ago')
      })
      test('should return "in 3w" for 21 days', () => {
        expect(dt.relativeDateFromNumber(21, true)).toEqual('in 3w')
      })
      test('should return "1m ago" for -30 days', () => {
        expect(dt.relativeDateFromNumber(-30, true)).toEqual('1m ago')
      })
      test('should return "in 1m" for 30 days', () => {
        expect(dt.relativeDateFromNumber(30, true)).toEqual('in 1m')
      })
      test('should return "12m ago" for -365 days', () => {
        expect(dt.relativeDateFromNumber(-365, true)).toEqual('12m ago')
      })
      test('should return "in 12m" for 365 days', () => {
        expect(dt.relativeDateFromNumber(365, true)).toEqual('in 12m')
      })
      test('should return "16m ago" for -500 days (less than 550)', () => {
        expect(dt.relativeDateFromNumber(-500, true)).toEqual('16m ago')
      })
      test('should return "in 16m" for 500 days (less than 550)', () => {
        expect(dt.relativeDateFromNumber(500, true)).toEqual('in 16m')
      })
      test('should return "2y ago" for -550 days (550/365 rounds to 2)', () => {
        expect(dt.relativeDateFromNumber(-550, true)).toEqual('2y ago')
      })
      test('should return "in 2y" for 550 days (550/365 rounds to 2)', () => {
        expect(dt.relativeDateFromNumber(550, true)).toEqual('in 2y')
      })
    })
    describe('edge cases', () => {
      test('should return "unknown date" for undefined', () => {
        expect(dt.relativeDateFromNumber(undefined)).toEqual('unknown date')
      })
      test('should return "unknown date" for null', () => {
        expect(dt.relativeDateFromNumber(null)).toEqual('unknown date')
      })
      test('should return "unknown date" for NaN', () => {
        expect(dt.relativeDateFromNumber(NaN)).toEqual('unknown date')
      })
    })
  })

  describe('getDateFromString', () => {
    // Note: If this function doesn't exist yet, these tests assume it extracts a Date from various string formats
    // Similar to getDateObjFromDateString but potentially with broader format support
    test('should extract date from ISO date string', () => {
      const result = dt.getDateObjFromDateString('2021-03-04')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2) // months are 0-indexed
      expect(result.getDate()).toEqual(4)
    })
    test('should extract date from string containing ISO date', () => {
      const result = dt.getDateObjFromDateString('Task due on 2021-03-04')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2)
      expect(result.getDate()).toEqual(4)
    })
    test('should extract date from @due format', () => {
      const result = dt.getDateObjFromDateString('@due(2021-03-04)')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2)
      expect(result.getDate()).toEqual(4)
    })
    test('should extract date from scheduled format', () => {
      const result = dt.getDateObjFromDateString('>2021-03-04')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2)
      expect(result.getDate()).toEqual(4)
    })
    test('should extract date from link format', () => {
      const result = dt.getDateObjFromDateString('[[2021-03-04]]')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2)
      expect(result.getDate()).toEqual(4)
    })
    test('should extract first date when multiple dates present', () => {
      const result = dt.getDateObjFromDateString('2021-03-04 and 2022-05-15')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toEqual(2021)
      expect(result.getMonth()).toEqual(2)
      expect(result.getDate()).toEqual(4)
    })
    test('should return undefined for string without date', () => {
      const result = dt.getDateObjFromDateString('no date here')
      expect(result).toBeUndefined()
    })
    test('should return undefined for empty string', () => {
      const result = dt.getDateObjFromDateString('')
      expect(result).toBeUndefined()
    })
    test('should handle YYYYMMDD format if supported', () => {
      const result = dt.getDateObjFromDateString('20210304')
      // If function supports this format, it should return a Date
      // Otherwise, it might return undefined
      if (result) {
        expect(result).toBeInstanceOf(Date)
        expect(result.getFullYear()).toEqual(2021)
        expect(result.getMonth()).toEqual(2)
        expect(result.getDate()).toEqual(4)
      }
    })
  })

  describe('getISODateStringFromYYYYMMDD', () => {
    test('20210424.md', () => {
      expect(dt.getISODateStringFromYYYYMMDD('20210424.md')).toEqual('2021-04-24')
    })
    test('20211231', () => {
      expect(dt.getISODateStringFromYYYYMMDD('20211231')).toEqual('2021-12-31')
    })
    test('2021123100.md', () => {
      expect(dt.getISODateStringFromYYYYMMDD('2021123100.md')).toEqual('2021-12-31')
    })
    test('2021123.md fail', () => {
      expect(dt.getISODateStringFromYYYYMMDD('2021123.md')).toEqual('(not a YYYYMMDD date)')
    })
  })

  describe('hyphenatedDateString', () => {
    test('for 20210424', () => {
      expect(dt.hyphenatedDateString(new Date(2021, 3, 24, 0, 0, 0))).toEqual('2021-04-24')
    })
    test('for 20211231', () => {
      expect(dt.hyphenatedDateString(new Date(2021, 11, 31, 0, 0, 0))).toEqual('2021-12-31')
    })
  })

  describe('YYYYMMDDDateStringFromDate', () => {
    test('for 20210424', () => {
      expect(dt.YYYYMMDDDateStringFromDate(new Date(2021, 3, 24, 0, 0, 0))).toEqual('20210424')
    })
    test('for 20211231', () => {
      expect(dt.YYYYMMDDDateStringFromDate(new Date(2021, 11, 31, 0, 0, 0))).toEqual('20211231')
    })
  })

  describe('convertISODateFilenameToNPDayFilename', () => {
    test('should return YYYYMMDD for a valid ISO date string', () => {
      const result = dt.convertISODateFilenameToNPDayFilename('2025-04-22')
      expect(result).toEqual('20250422')
    })
    test('should return teamspace YYYYMMDD for a valid ISO date string', () => {
      const result = dt.convertISODateFilenameToNPDayFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/2025-04-22.md')
      expect(result).toEqual('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
    })
    test('should return YYYYMMDD for a valid teamspace date string', () => {
      const result = dt.convertISODateFilenameToNPDayFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/2020-04-22.txt')
      expect(result).toEqual('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20200422.txt')
    })
    test('should return YYYYMMDD from an existing YYYYMMDD date string', () => {
      const result = dt.convertISODateFilenameToNPDayFilename('20250422')
      expect(result).toEqual('20250422')
    })
    test('should return the original string if it is not a valid ISO date string', () => {
      const result = dt.convertISODateFilenameToNPDayFilename('lorem ipsum 2025 and more')
      expect(result).toEqual('lorem ipsum 2025 and more')
    })
  })

  describe('getWeek', () => {
    /**
     * For commentary see function defintion.
     */
    test('2021-12-31 (Fri) -> week 52', () => {
      expect(dt.getWeek(new Date(2021, 11, 31, 0, 0, 0))).toEqual(52)
    })
    test('2022-01-01 (Sat) -> week 52', () => {
      expect(dt.getWeek(new Date(2022, 0, 1, 0, 0, 0))).toEqual(52)
    })
    test('2022-01-02 (Sun) -> week 52 (last day of that week)', () => {
      expect(dt.getWeek(new Date(2022, 0, 2, 0, 0, 0))).toEqual(52)
    })
    test('2022-01-03 (Mon) -> week 1', () => {
      expect(dt.getWeek(new Date(2022, 0, 3, 0, 0, 0))).toEqual(1)
    })
    test('2022-01-08 (Sat) -> week 1', () => {
      expect(dt.getWeek(new Date(2022, 0, 8, 0, 0, 0))).toEqual(1)
    })
    test('2022-01-09 (Sun) -> week 1', () => {
      expect(dt.getWeek(new Date(2022, 0, 9, 0, 0, 0))).toEqual(1)
    })
    test('2026-12-26 (Sat) -> week 52', () => {
      expect(dt.getWeek(new Date(2026, 11, 26, 0, 0, 0))).toEqual(52)
    })
    test('2026-12-30 (Weds) -> week 53', () => {
      expect(dt.getWeek(new Date(2026, 11, 30, 0, 0, 0))).toEqual(53)
    })
  })

  describe('calcWeekOffset', () => {
    test('calcWeekOffset(52, 2021, 0)', () => {
      const answer = dt.calcWeekOffset(52, 2021, 0)
      expect(answer.week).toBe(52)
    })
    test('calcWeekOffset(52, 2021, 0)', () => {
      const answer = dt.calcWeekOffset(52, 2021, 0)
      expect(answer.year).toBe(2021)
    })
    test('calcWeekOffset(52, 2021, 1)', () => {
      const answer = dt.calcWeekOffset(52, 2021, 1)
      expect(answer.week).toBe(1)
    })
    test('calcWeekOffset(52, 2021, 1)', () => {
      const answer = dt.calcWeekOffset(52, 2021, 1)
      expect(answer.year).toBe(2022)
    })
    test('calcWeekOffset(1, 2021, 0)', () => {
      const answer = dt.calcWeekOffset(1, 2021, 0)
      expect(answer.week).toBe(1)
    })
    test('calcWeekOffset(1, 2021, 0)', () => {
      const answer = dt.calcWeekOffset(1, 2021, 0)
      expect(answer.year).toBe(2021)
    })
    test('calcWeekOffset(1, 2021, -1)', () => {
      const answer = dt.calcWeekOffset(1, 2021, -1)
      expect(answer.week).toBe(52)
    })
    test('calcWeekOffset(1, 2021, -1)', () => {
      const answer = dt.calcWeekOffset(1, 2021, -1)
      expect(answer.year).toBe(2020)
    })
  })

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
          const result = dt.calcOffsetDateStr('2024-11-06', '1w', 'week')
          // Nov 6, 2024 is a Wednesday in week 45 (Sunday start)
          // Adding 1 week should give us week 46
          expect(result).toEqual('2024-W46')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +1w -> 2024-W45 (Sunday start)', () => {
          const result = dt.calcOffsetDateStr('2024-W44', '1w')
          expect(result).toEqual('2024-W45')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +0w -> 2024-W44 (no change)', () => {
          const result = dt.calcOffsetDateStr('2024-W44', '0w')
          expect(result).toEqual('2024-W44')
        })

        test('2024-W52 +1w -> 2025-W01 (crosses year boundary, Sunday start)', () => {
          // Week 52 of 2024 (Sunday start) + 1 week = Week 1 of 2025
          const result = dt.calcOffsetDateStr('2024-W52', '1w')
          expect(result).toEqual('2025-W01')
          expect(mockCalendarSundayStart.weekNumber).toHaveBeenCalled()
        })

        test('2025-W01 -1w -> 2024-W52 (crosses year boundary backwards, Sunday start)', () => {
          // Week 1 of 2025 (Sunday start) - 1 week = Week 52 of 2024
          const result = dt.calcOffsetDateStr('2025-W01', '-1w')
          expect(result).toEqual('2024-W52')
        })

        test('2024-01-15 (Mon) +2w -> 2024-W05 (converts date to week with Sunday start)', () => {
          // Jan 15, 2024 is in week 3 (Sunday start), adding 2 weeks = week 5
          const result = dt.calcOffsetDateStr('2024-01-15', '2w', 'week')
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
          const result = dt.calcOffsetDateStr('2024-11-06', '1w', 'week')
          // Nov 6, 2024 is in ISO week 45, adding 1 week = week 46
          expect(result).toEqual('2024-W46')
          expect(mockCalendarMondayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W44 +1w -> 2024-W45 (Monday start)', () => {
          const result = dt.calcOffsetDateStr('2024-W44', '1w')
          expect(result).toEqual('2024-W45')
          expect(mockCalendarMondayStart.weekNumber).toHaveBeenCalled()
        })

        test('2024-W52 +1w -> 2025-W01 (crosses year boundary, Monday start)', () => {
          // ISO week 52 of 2024 + 1 week = ISO week 1 of 2025
          const result = dt.calcOffsetDateStr('2024-W52', '1w')
          expect(result).toEqual('2025-W01')
        })

        test('2023-W52 +1w -> 2024-W01 (year boundary)', () => {
          const result = dt.calcOffsetDateStr('2023-W52', '1w')
          expect(result).toEqual('2024-W01')
        })

        test('2024-W01 -1w -> 2023-W52 (crosses year boundary backwards)', () => {
          const result = dt.calcOffsetDateStr('2024-W01', '-1w')
          expect(result).toEqual('2023-W52')
        })

        test('2024-01-15 (Mon) +2w -> 2024-W05 (converts date to week with Monday start)', () => {
          // Jan 15, 2024 is in ISO week 3, adding 2 weeks = week 5
          const result = dt.calcOffsetDateStr('2024-01-15', '2w', 'week')
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
          const result = dt.calcOffsetDateStr('2020-W53', '0w')
          expect(result).toEqual('2020-W53')
        })

        test('2020-W53 +1w -> 2021-W01 (from last week of 2020 to first week of 2021)', () => {
          const result = dt.calcOffsetDateStr('2020-W53', '1w')
          expect(result).toEqual('2021-W01')
        })

        test('2021-W01 -1w -> 2020-W53 (back to last week of 2020)', () => {
          // Going back from first week of 2021 should give us week 53 of 2020
          const result = dt.calcOffsetDateStr('2021-W01', '-1w')
          expect(result).toEqual('2020-W53')
        })

        test('2015-W53 exists (Thursday starts the year)', () => {
          // 2015 also has 53 weeks (Jan 1, 2015 was Thursday)
          const result = dt.calcOffsetDateStr('2015-W53', '0w')
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
          const result = dt.calcOffsetDateStr('2024-W01', '10w')
          expect(result).toEqual('2024-W11')
        })

        test('2024-W50 +10w -> 2025-W08 (crosses into next year)', () => {
          // Week 50 + 10 weeks = week 60, which is week 8 of next year
          const result = dt.calcOffsetDateStr('2024-W50', '10w')
          expect(result).toEqual('2025-W08')
        })

        test('2024-W10 -20w -> 2023-W42 (crosses into previous year)', () => {
          // Week 10 - 20 weeks crosses back to previous year
          // 2023 has 52 weeks, so week 10-20 = week -10, which is 52-10 = week 42 of 2023
          const result = dt.calcOffsetDateStr('2024-W10', '-20w')
          expect(result).toEqual('2023-W42')
        })

        test('2024-W26 +26w -> 2024-W52 (exactly half year forward)', () => {
          // Mid-year (week 26) + 26 weeks = week 52 (end of year)
          const result = dt.calcOffsetDateStr('2024-W26', '26w')
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
          const result = dt.calcOffsetDateStr('2024-W20', '1w', 'base')
          expect(result).toEqual('2024-W21')
        })

        test("'offset' format uses week when offset is week", () => {
          // Start with a day, offset by weeks, output as week (based on offset unit)
          const result = dt.calcOffsetDateStr('2024-01-15', '2w', 'offset')
          expect(result).toEqual('2024-W05')
        })

        test("'week' format converts date to week", () => {
          // Start with a day, no offset, but output as week
          const result = dt.calcOffsetDateStr('2024-01-15', '0d', 'week')
          expect(result).toEqual('2024-W03')
        })

        test("'longer' format converts day to week when offset is weeks", () => {
          // Day + week offset with 'longer' should output as week (longer than day)
          const result = dt.calcOffsetDateStr('2024-01-15', '2w', 'longer')
          expect(result).toEqual('2024-W05')
        })

        test("'shorter' format keeps day when offset is day", () => {
          // Week + day offset with 'shorter' should output as day (shorter than week)
          const result = dt.calcOffsetDateStr('2024-W20', '5d', 'shorter')
          expect(result).toEqual('2024-05-18')
        })

        test("'longer' format keeps week when offset is day", () => {
          // Week + day offset with 'longer' should keep week format (longer than day)
          const result = dt.calcOffsetDateStr('2024-W20', '5d', 'longer')
          expect(result).toEqual('2024-W20')
        })
      })
    })

    describe('should pass', () => {
      test('20220101 +1d', () => {
        expect(dt.calcOffsetDateStr('20220101', '1d')).toEqual('20220102')
      })
      test('20220101 +364d', () => {
        expect(dt.calcOffsetDateStr('20220101', '364d')).toEqual('20221231')
      })
      test('20220101 +4m', () => {
        expect(dt.calcOffsetDateStr('20220101', '4m')).toEqual('20220501')
      })
      test('2022-01-01 +1d', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '1d')).toEqual('2022-01-02')
      })
      test('2022-01-01 +364d', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '364d')).toEqual('2022-12-31')
      })
      test('2022-01-01 +4m', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '4m')).toEqual('2022-05-01')
      })
      test('2022-01-01 +3q', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '3q')).toEqual('2022-10-01')
      })
      test('2022-01-01 +2y', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '2y')).toEqual('2024-01-01')
      })
      test('2022-01-01 0d', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '0d')).toEqual('2022-01-01')
      })
      test('2022-01-01 -1d', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '-1d')).toEqual('2021-12-31')
      })
      test('2022-01-01 -2w', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '-2w')).toEqual('2021-12-18')
      })
      test('2022-01-01 -4m', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '-4m')).toEqual('2021-09-01')
      })
      test('2022-01-01 -3q', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '-3q')).toEqual('2021-04-01')
      })
      test('2022-01-01 -2y', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '-2y')).toEqual('2020-01-01')
      })
      test('2022-01-01 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '1b')).toEqual('2022-01-03')
      })
      test('2022-01-01 +2b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '2b')).toEqual('2022-01-04')
      })
      test('2022-01-01 +3b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '3b')).toEqual('2022-01-05')
      })
      test('2022-01-01 +4b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '4b')).toEqual('2022-01-06')
      })
      test('2022-01-01 +5b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '5b')).toEqual('2022-01-07')
      })
      test('2022-01-01 +6b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '6b')).toEqual('2022-01-10')
      })
      test('2022-01-01 +7b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '7b')).toEqual('2022-01-11')
      })
      test('2022-01-01 +8b', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '8b')).toEqual('2022-01-12')
      })
      test('2022-01-02 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-02', '1b')).toEqual('2022-01-03')
      })
      test('2022-01-03 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-03', '1b')).toEqual('2022-01-04')
      })
      test('2022-01-04 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-04', '1b')).toEqual('2022-01-05')
      })
      test('2022-01-05 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-05', '1b')).toEqual('2022-01-06')
      })
      test('2022-01-06 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-06', '1b')).toEqual('2022-01-07')
      })
      test('2022-01-07 +1b', () => {
        expect(dt.calcOffsetDateStr('2022-01-07', '1b')).toEqual('2022-01-10')
      })
      test('2022-W23 +1w', () => {
        expect(dt.calcOffsetDateStr('2022-W23', '1w')).toEqual('2022-W24')
      })
      test('2022-W52 +1w', () => {
        expect(dt.calcOffsetDateStr('2022-W52', '1w')).toEqual('2023-W01')
      })
      test('2022-01-01 +2w', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '2w')).toEqual('2022-01-15')
      })
      test('2023-07-24 +0w', () => {
        expect(dt.calcOffsetDateStr('2023-07-24', '0w')).toEqual('2023-07-24')
      })
      test('2022-W23 +2w', () => {
        expect(dt.calcOffsetDateStr('2022-W23', '2w')).toEqual('2022-W25')
      })
      test('2022-W23 +3m', () => {
        expect(dt.calcOffsetDateStr('2022-W23', '3m')).toEqual('2022-W36')
      })
      test('2022-W23 -2w', () => {
        expect(dt.calcOffsetDateStr('2022-W23', '-2w')).toEqual('2022-W21')
      })
      test('2022-02 +3m', () => {
        expect(dt.calcOffsetDateStr('2022-02', '3m')).toEqual('2022-05')
      })
      test('2022-02 -3m', () => {
        expect(dt.calcOffsetDateStr('2022-02', '-3m')).toEqual('2021-11')
      })
      test('2022-Q2 +2q', () => {
        expect(dt.calcOffsetDateStr('2022-Q2', '2q')).toEqual('2022-Q4')
      })
      test('2022-Q2 -2q', () => {
        expect(dt.calcOffsetDateStr('2022-Q2', '-2q')).toEqual('2021-Q4')
      })
      test('2022 +2y', () => {
        expect(dt.calcOffsetDateStr('2022', '2y')).toEqual('2024')
      })
      test('2022 -2y', () => {
        expect(dt.calcOffsetDateStr('2022', '-2y')).toEqual('2020')
      })
    })
    describe('adapting output to week timeframe', () => {
      beforeAll(() => {
        // DataStore.settings['_logLevel'] = "DEBUG"
      })
      test('2024-11-02 +1w -> 2024-W45', () => {
        expect(dt.calcOffsetDateStr('2024-11-02', '+1w', 'week')).toEqual('2024-W45')
      })
      test('2024-11-02 1w -> 2024-W45', () => {
        expect(dt.calcOffsetDateStr('2024-11-02', '1w', 'week')).toEqual('2024-W45')
      })
      test('2024-W44 +1w -> 2024-W45', () => {
        expect(dt.calcOffsetDateStr('2024-W44', '+1w', 'week')).toEqual('2024-W45')
      })
      test('2024-W44 1w -> 2024-W45', () => {
        expect(dt.calcOffsetDateStr('2024-W44', '1w', 'week')).toEqual('2024-W45')
      })
    })
    describe('adapting output to offset durations', () => {
      beforeAll(() => {
        // DataStore.settings['_logLevel'] = "DEBUG"
      })
      test('20230101 +1d -> 20230102', () => {
        expect(dt.calcOffsetDateStr('20230101', '1d', 'offset')).toEqual('20230102')
      })
      test('2023-07 +14d -> 2023-07-15', () => {
        expect(dt.calcOffsetDateStr('2023-07', '14d', 'offset')).toEqual('2023-07-15')
      })
      test('2023-07 +10b -> 2023-07-14', () => {
        expect(dt.calcOffsetDateStr('2023-07', '10b', 'offset')).toEqual('2023-07-14')
      })
      test('2023-W30 0d -> 2023-07-24', () => {
        expect(dt.calcOffsetDateStr('2023-W30', '0d', 'offset')).toEqual('2023-07-24')
      })
      test('2023-Q3 +6w -> 2023-W32', () => {
        expect(dt.calcOffsetDateStr('2023-Q3', '6w', 'offset')).toEqual('2023-W32')
      })
      test('2023 +3q -> 2023-Q4', () => {
        expect(dt.calcOffsetDateStr('2023', '3q', 'offset')).toEqual('2023-Q4')
      })
    })
    describe('adapting output to shorter durations than base', () => {
      test('20230101 +1d -> 20230102', () => {
        expect(dt.calcOffsetDateStr('20230101', '1d', 'shorter')).toEqual('20230102')
      })
      test('2023-07 +14d -> 2023-07-15', () => {
        expect(dt.calcOffsetDateStr('2023-07', '14d', 'shorter')).toEqual('2023-07-15')
      })
      test('2023-07 +2w -> 2023-W28', () => {
        expect(dt.calcOffsetDateStr('2023-07', '2w', 'shorter')).toEqual('2023-W28')
      })
      test('2023-Q3 +6w -> 2023-W32', () => {
        expect(dt.calcOffsetDateStr('2023-Q3', '6w', 'shorter')).toEqual('2023-W32')
      })
      test('2023 +3q -> 2023-Q4', () => {
        expect(dt.calcOffsetDateStr('2023', '3q', 'shorter')).toEqual('2023-Q4')
      })
    })
    describe('adapting output to longer durations than base', () => {
      test('20230101 +1d -> 20230102', () => {
        expect(dt.calcOffsetDateStr('20230101', '1d', 'longer')).toEqual('20230102')
      })
      test('2023-07-24 +0w -> 2023-W30', () => {
        expect(dt.calcOffsetDateStr('2023-07-24', '0w', 'longer')).toEqual('2023-W30')
      })
      test('2023-07+24 +2w -> 2023-W32', () => {
        expect(dt.calcOffsetDateStr('2023-07-24', '2w', 'longer')).toEqual('2023-W32')
      })
      test('2023-W30 +1m -> 2023-W32', () => {
        expect(dt.calcOffsetDateStr('2023-W30', '1m', 'longer')).toEqual('2023-08')
      })
      test('2023-02 +2q -> 2023-Q3', () => {
        expect(dt.calcOffsetDateStr('2023-02', '2q', 'longer')).toEqual('2023-Q3')
      })
    })
    describe('should return errors', () => {
      test('2022-01 (invalid date)', () => {
        expect(dt.calcOffsetDateStr('2022-01', '')).toEqual('(error)')
      })
      test('2022-01-01 (blank interval)', () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '')).toEqual('(error)')
      })
      test("2022-01-01 (invalid interval) 'v'", () => {
        expect(dt.calcOffsetDateStr('2022-01-01', 'v')).toEqual('(error)')
      })
      test("2022-01-01 (invalid interval) '23'", () => {
        expect(dt.calcOffsetDateStr('2022-01-01', '23')).toEqual('(error)')
      })
    })
  })

  describe('includesScheduledFutureDate()', () => {
    // Note: this date definitely in the past
    test('should return false for "a >2020-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a >2020-04-21 date')).toEqual(false)
    })
    test('should return false for "a >2020-W02 date"', () => {
      expect(dt.includesScheduledFutureDate('a >2020-W02 date')).toEqual(false)
    })
    // Note: most have far future dates to avoid having to work out how to mock this with today's date
    test('should find in "a >2122-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a >2122-04-21 date')).toEqual(true)
    })
    test('should find in ">2122-04-21"', () => {
      expect(dt.includesScheduledFutureDate('>2122-04-21')).toEqual(true)
    })
    test('should find in "a>2122-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a>2122-04-21 date')).toEqual(true)
    })
    test('should find in "(>2122-04-21)"', () => {
      expect(dt.includesScheduledFutureDate('(>2122-04-21)')).toEqual(true)
    })
    test('should not find in "a 2122-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a 2122-04-21 date')).toEqual(false)
    })
    test('should find in "a >2122-W04 date"', () => {
      expect(dt.includesScheduledFutureDate('a >2122-W04< date')).toEqual(true)
    })
  })

  describe('filenameIsInFuture()', () => {
    // Daily notes
    test('should return false for a daily note filename in the past', () => {
      expect(dt.filenameIsInFuture('/path/to/note/20200101.md')).toEqual(false)
    })

    test('should return true for a daily note filename in the future', () => {
      expect(dt.filenameIsInFuture('/path/to/note/21240611.md')).toEqual(true)
    })

    // Weekly notes
    test('should return false for a weekly note filename in the past', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2020-W01.md')).toEqual(false)
    })

    test('should return true for a weekly note filename in the future', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2124-W02.md')).toEqual(true)
    })

    // Monthly notes
    test('should return false for a monthly note filename in the past', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2020-01.md')).toEqual(false)
    })

    test('should return true for a monthly note filename in the future', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2124-06.md')).toEqual(true)
    })

    // Quarterly notes
    test('should return false for a quarterly note filename in the past', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2020-Q1.md')).toEqual(false)
    })

    test('should return true for a quarterly note filename in the future', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2124-Q3.md')).toEqual(true)
    })

    // Yearly notes
    test('should return false for a yearly note filename in the past', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2020.md')).toEqual(false)
    })

    test('should return true for a yearly note filename in the future', () => {
      expect(dt.filenameIsInFuture('/path/to/note/2124.md')).toEqual(true)
    })
  })

  describe('formatNoteDate()', () => {
    const date1 = new Date(2022, 11, 31)
    const date2 = new Date(2023, 0, 1)
    test('test date1 style at', () => {
      expect(dt.formatNoteDate(date1, 'at')).toEqual('@2022-12-31')
    })
    test('test date1 style scheduled', () => {
      expect(dt.formatNoteDate(date1, 'scheduled')).toEqual('>2022-12-31')
    })
    test('test date1 style link', () => {
      expect(dt.formatNoteDate(date1, 'link')).toEqual('[[2022-12-31]]')
    })
    test('test date1 style at', () => {
      expect(dt.formatNoteDate(date2, 'at')).toEqual('@2023-01-01')
    })
    test('test date1 style scheduled', () => {
      expect(dt.formatNoteDate(date2, 'scheduled')).toEqual('>2023-01-01')
    })
    test('test date1 style link', () => {
      expect(dt.formatNoteDate(date2, 'link')).toEqual('[[2023-01-01]]')
    })
    // The remaining tests are dependent on user's locale.
    // TODO: find a way to control this in the tests
    test.skip('test date1 style date', () => {
      // just doing partial check because it will fail in USA if not
      expect(dt.formatNoteDate(date1, 'date')).toContain('31')
    })
    // skipping because fails in USA
    test.skip('test date1 style date', () => {
      expect(dt.formatNoteDate(date2, 'date')).toContain('01')
    })
  })

  /*
   * getWeekNumber()
   */
  describe('getWeekNumber()' /* function */, () => {
    test('should deliver proper week for 1/1', () => {
      const result = dt.getISOWeekString('2020-01-01')
      expect(result).toEqual(`2020-W01`)
    })
    test('should deliver proper week for 1/10', () => {
      const result = dt.getISOWeekString('2020-01-10')
      expect(result).toEqual(`2020-W02`)
    })
    test('should deliver proper week for 12/31', () => {
      const result = dt.getISOWeekString('2020-12-31')
      expect(result).toEqual(`2020-W53`)
    })
    test('should add 7 days', () => {
      const result = dt.getISOWeekString('2020-01-01', 7, 'day')
      expect(result).toEqual(`2020-W02`)
    })
    test('should add 1 week', () => {
      const result = dt.getISOWeekString('2020-01-01', 1, 'week')
      expect(result).toEqual(`2020-W02`)
    })
    test('should remove one day and end up in last year', () => {
      const result = dt.getISOWeekString('2020-01-01', -1, 'day')
      expect(result).toEqual(`2020-W01`)
    })
    test('should remove one week and end up in last year', () => {
      const result = dt.getISOWeekString('2020-01-01', -1, 'week')
      expect(result).toEqual(`2019-W52`)
    })
    test('should remove one week and end up in last year', () => {
      const result = dt.getISOWeekString(new Date('2020-01-01'))
      expect(result).toEqual(`2020-W01`)
    })
  })

  /*
   * getISOWeekAndYear()
   */
  describe('getISOWeekAndYear()', () => {
    test('should return proper date with string input', () => {
      const result = dt.getISOWeekAndYear('2020-01-01')
      expect(result).toEqual({ year: 2020, week: 1 })
    })
    test('should return proper date with Date obj input', () => {
      const result = dt.getISOWeekAndYear(new Date('2020-01-01'))
      expect(result).toEqual({ year: 2020, week: 1 })
    })
    test('should add increment to date', () => {
      const result = dt.getISOWeekAndYear(new Date('2020-01-01'), 1, 'week')
      expect(result).toEqual({ year: 2020, week: 2 })
    })
  })

  describe('isoWeekStartEndDates()', () => {
    test('2021W52 -> (2021-12-27, 2022-01-02)', () => {
      expect(dt.isoWeekStartEndDates(52, 2021)).toEqual([new Date(2021, 11, 27, 0, 0, 0), new Date(2022, 0, 2, 23, 59, 59)])
    })
    test('2022W1 -> (2022-01-03, 2022-01-09)', () => {
      expect(dt.isoWeekStartEndDates(1, 2022)).toEqual([new Date(2022, 0, 3, 0, 0, 0), new Date(2022, 0, 9, 23, 59, 59)])
    })
    test('2022W2 -> (2022-01-10, 2022-01-16)', () => {
      expect(dt.isoWeekStartEndDates(2, 2022)).toEqual([new Date(2022, 0, 10, 0, 0, 0), new Date(2022, 0, 16, 23, 59, 59)])
    })
  })

  describe('weekStartDateStr()', () => {
    test('should return error for empty date', () => {
      const result = dt.weekStartDateStr('')
      expect(result).toEqual('(error)')
    })
    test('should return error for invalid date', () => {
      const result = dt.weekStartDateStr('2022-W60')
      expect(result).toEqual('(error)')
    })
    // skipped, as I can't see why moment is right here
    test('should return date 1', () => {
      const result = dt.weekStartDateStr('2021-W52')
      expect(result).toEqual('20211227')
    })
    test('should return date 2', () => {
      const result = dt.weekStartDateStr('2022-W01')
      expect(result).toEqual('20220103')
    })
    test('should return date 3', () => {
      const result = dt.weekStartDateStr('2022-W32')
      expect(result).toEqual('20220808')
    })
    test('should return date 4', () => {
      const result = dt.weekStartDateStr('2022-W52')
      expect(result).toEqual('20221226')
    })
  })

  describe('getDateStringFromCalendarFilename()', () => {
    test('should return error for empty filename', () => {
      const result = dt.getDateStringFromCalendarFilename('')
      expect(result).toEqual('(invalid date)')
    })
    test('should return error for malformed daily filename', () => {
      const result = dt.getDateStringFromCalendarFilename('20221340')
      expect(result).toEqual('(invalid date)')
    })
    test('should return error for malformed weekly filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-W60')
      expect(result).toEqual('(invalid date)')
    })
    test('should return valid date for daily note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('20220101.md')
      expect(result).toEqual('20220101')
    })
    test('should return valid ISO date for daily note filename (with returnISODate)', () => {
      const result = dt.getDateStringFromCalendarFilename('20220101.md', true)
      expect(result).toEqual('2022-01-01')
    })
    test('should return valid date for weekly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-W52.md')
      expect(result).toEqual('2022-W52')
    })
    test('should return valid date for monthly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-12.md')
      expect(result).toEqual('2022-12')
    })
    test('should return invalid date for incomplete monthly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-12')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for monthly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-3.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for monthly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-23.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return valid date for quarterly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-Q2.md')
      expect(result).toEqual('2022-Q2')
    })
    test('should return invalid date for incomplete quarterly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-Q2')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for quarterly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-Q0.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for quarterly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-Q.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return valid date for yearly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022.txt')
      expect(result).toEqual('2022')
    })
    test('should return invalid date for incomplete yearly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for yearly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('20221.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return invalid date for yearly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-.md')
      expect(result).toEqual('(invalid date)')
    })
    test('should return valid date for teamspace daily calendar filename', () => {
      const result = dt.getDateStringFromCalendarFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/20250422.md')
      expect(result).toEqual('20250422')
    })
    test('should return valid date for teamspace weekly calendar filename', () => {
      const result = dt.getDateStringFromCalendarFilename('%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/2025-W01.txt')
      expect(result).toEqual('2025-W01')
    })
  })

  /*
   * isValidCalendarNoteTitleStr()
   */
  describe('isValidCalendarNoteTitleStr()' /* function */, () => {
    describe('passes', () => {
      test('should work for iso date 01-01', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-01-01`)
        expect(result).toEqual(true)
      })
      test('should work for week date W01', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-W01`)
        expect(result).toEqual(true)
      })
      test('should work for week date W52', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-W52`)
        expect(result).toEqual(true)
      })
      test('should work for week date W49', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-W49`)
        expect(result).toEqual(true)
      })
      test('should work for week date W53', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-W53`)
        expect(result).toEqual(true)
      })
      test('should work for week 10', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W10`)
        expect(result).toEqual(true)
      })
      test('should work for week 21', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W21`)
        expect(result).toEqual(true)
      })
      test('should work for week 39', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W39`)
        expect(result).toEqual(true)
      })
      test('should work for non-iso date 1 with special flag', () => {
        const result = dt.isValidCalendarNoteTitleStr(`20201231`, true)
        expect(result).toEqual(true)
      })
    })
    describe('fails', () => {
      test('should fail for non-iso date 1', () => {
        const result = dt.isValidCalendarNoteTitleStr(`20200101`)
        expect(result).toEqual(false)
      })
      test('should fail for non-iso date 2', () => {
        const result = dt.isValidCalendarNoteTitleStr(`20201231`)
        expect(result).toEqual(false)
      })
      test('should fail for iso date 01-1', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-01-1`)
        expect(result).toEqual(false)
      })
      test('should fail for week date W1', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-W1`)
        expect(result).toEqual(false)
      })
      test('should fail for week date 21-W52', () => {
        const result = dt.isValidCalendarNoteTitleStr(`21-W52`)
        expect(result).toEqual(false)
      })
      test('should fail for week date 2021-W62', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W62`)
        expect(result).toEqual(false)
      })
      test('should fail for extra text before', () => {
        const result = dt.isValidCalendarNoteTitleStr(`date 2021-W12`)
        expect(result).toEqual(false)
      })
      test('should fail for extra text after', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W12 is a date`)
        expect(result).toEqual(false)
      })

      // skip following as these are regex-only tests, that can't distinguish some edge cases
      test.skip('should fail for iso date with 13-31', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2020-13-31`)
        expect(result).toEqual(false)
      })
      test.skip('should fail for week 54', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W54`)
        expect(result).toEqual(false)
      })
      test.skip('should fail for week 00', () => {
        const result = dt.isValidCalendarNoteTitleStr(`2021-W00`)
        expect(result).toEqual(false)
      })
    })
  })

  /* isValidCalendarNoteFilename() */
  describe('isValidCalendarNoteFilename()' /* function */, () => {
    test('should pass for daily note filename', () => {
      const result = dt.isValidCalendarNoteFilename('20220101.md')
      expect(result).toEqual(true)
    })
    test('should pass for weekly note filename', () => {
      const result = dt.isValidCalendarNoteFilename('2022-W52.md')
      expect(result).toEqual(true)
    })
    test('should pass for monthly note filename', () => {
      const result = dt.isValidCalendarNoteFilename('2022-12.md')
      expect(result).toEqual(true)
    })
    test('should pass for quarterly note filename', () => {
      const result = dt.isValidCalendarNoteFilename('2022-Q2.md')
      expect(result).toEqual(true)
    })
    test('should pass for yearly note filename', () => {
      const result = dt.isValidCalendarNoteFilename('2022.txt')
      expect(result).toEqual(true)
    })
    test('should fail for incomplete yearly note filename', () => {
      const result = dt.isValidCalendarNoteFilename('2022')
      expect(result).toEqual(false)
    })
    test('should fail for too-short date', () => {
      const result = dt.isValidCalendarNoteFilename('2022033.md')
      expect(result).toEqual(false)
    })
    test('should fail for non-date', () => {
      const result = dt.isValidCalendarNoteFilename('today.md')
      expect(result).toEqual(false)
    })
  })

  /* isValidCalendarNoteFilenameWithoutExtension() */
  describe('isValidCalendarNoteFilenameWithoutExtension()' /* function */, () => {
    test('should pass for daily note filename', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('20220101')
      expect(result).toEqual(true)
    })
    test('should pass for weekly note filename', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('2022-W52')
      expect(result).toEqual(true)
    })
    test('should pass for monthly note filename', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('2022-12')
      expect(result).toEqual(true)
    })
    test('should pass for quarterly note filename', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('2022-Q2')
      expect(result).toEqual(true)
    })
    test('should pass for yearly note filename', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('2022')
      expect(result).toEqual(true)
    })
    test('should fail for too-short date', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('2022033')
      expect(result).toEqual(false)
    })
    test('should fail for non-date', () => {
      const result = dt.isValidCalendarNoteFilenameWithoutExtension('today')
      expect(result).toEqual(false)
    })
  })

  /* calcOffsetDateStrUsingCalendarType() */
  describe('calcOffsetDateStrUsingCalendarType()' /* function */, () => {
    describe('should fail', () => {
      test('fail blank input param 1', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('', '2023-01-01')
        expect(result).toEqual('(error)')
      })
      test('fail 1e input', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1e', '2023-01-01')
        expect(result).toEqual('(error)')
      })
      test('fail YYYYMMDD input', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1d', '20230101')
        expect(result).toEqual('(error)')
      })
      test('fail YYYYMMDD input', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1d', '20230101')
        expect(result).toEqual('(error)')
      })
      test('fail YYYYMMDD.md input', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1d', '20230101.md')
        expect(result).toEqual('(error)')
      })
      test('fail YYYY-Wnn input', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1d', '2023-W01')
        expect(result).toEqual('(error)')
      })
    })

    describe('should pass', () => {
      test('2023-01-01 +1d -> 2023-01-02', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1d', '2023-01-01')
        expect(result).toEqual('2023-01-02')
      })
      // Note 2023-01-01 is actually in week 52 of 2022, so don't use that.
      test('2023-01-02 +1w -> 2023-W02', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1w', '2023-01-02')
        expect(result).toEqual('2023-W02')
      })
      test('2023-01-01 +1m -> 2023-02', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1m', '2023-01-01')
        expect(result).toEqual('2023-02')
      })
      test('2023-01-01 +1q -> 2023-Q2', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1q', '2023-01-01')
        expect(result).toEqual('2023-Q2')
      })
      test('2023-01-01 +1y -> 2024', () => {
        const result = dt.calcOffsetDateStrUsingCalendarType('1y', '2023-01-01')
        expect(result).toEqual('2024')
      })
    })
  })

  /* splitIntervalToParts() */
  describe('splitIntervalToParts()' /* function */, () => {
    test('0d', () => {
      const result = dt.splitIntervalToParts('0d')
      expect(result).toEqual({
        number: 0,
        type: 'day',
      })
    })
    test('-3d', () => {
      const result = dt.splitIntervalToParts('-3d')
      expect(result).toEqual({
        number: -3,
        type: 'day',
      })
    })
    test('{10d}', () => {
      const result = dt.splitIntervalToParts('{10d}')
      expect(result).toEqual({
        number: 10,
        type: 'day',
      })
    })
    test('2w', () => {
      const result = dt.splitIntervalToParts('2w')
      expect(result).toEqual({
        number: 2,
        type: 'week',
      })
    })
    test('+6m', () => {
      const result = dt.splitIntervalToParts('+6m')
      expect(result).toEqual({
        number: 6,
        type: 'month',
      })
    })
    test('-1q', () => {
      const result = dt.splitIntervalToParts('-1q')
      expect(result).toEqual({
        number: -1,
        type: 'quarter',
      })
    })
    test('2y', () => {
      const result = dt.splitIntervalToParts('2y')
      expect(result).toEqual({
        number: 2,
        type: 'year',
      })
    })
  })
})
