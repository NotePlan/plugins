/* globals describe, expect, jest, test, beforeEach, afterEach, beforeAll */

// Last updated: 13.5.2022 by @jgclark

import colors from 'chalk'
import * as dt from '../dateTime'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/dateTime')}`
// const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
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
    test('work with overflow YYYY-MM-DD string', () => {
      expect(dt.getDateObjFromDateString('2021-14-44')).toEqual(new Date(2022, 2, 16, 0, 0, 0)) // surprising but true
    })
    test('fail with a different date style', () => {
      expect(dt.getDateObjFromDateString('3/9/2021')).toEqual(undefined)
    })
  })

  // @dwertheimer
  describe('getDateObjFromDateTimeString ', () => {
    test('should create date and HH:MM from string, no seconds', () => {
      expect(dt.getDateObjFromDateTimeString('2021-01-01 09:40').toTimeString()).toMatch(/09:40:00/) //not checking date b/c it's locale-dependent
    })
    test('should work with seconds specified', () => {
      expect(dt.getDateObjFromDateTimeString('2021-01-01 00:00:01').toTimeString()).toMatch(/00:00:01/)
    })
    test('should work with only date, no time given', () => {
      expect(dt.getDateObjFromDateTimeString('2021-01-01').toTimeString()).toMatch(/00:00:00/) //not checking date b/c it's locale-dependent
    })
    // Errors should throw
    test('should throw error when date format is incorrect', () => {
      expect(() => {
        dt.getDateObjFromDateTimeString(`foo 00:00`)
      }).toThrow(/not in expected format/)
    })
    test('should throw error when date format is incorrect (no day)', () => {
      expect(() => {
        dt.getDateObjFromDateTimeString(`2020-01 02:02`)
      }).toThrow(/not in expected format/)
    })
    test('should throw error when time format is incorrect', () => {
      expect(() => {
        dt.getDateObjFromDateTimeString(`2020-01-01 02`)
      }).toThrow(/not in expected format/)
    })
    test('should throw error when time format is incorrect', () => {
      expect(() => {
        dt.getDateObjFromDateTimeString(`2020-01-01 aa:00`)
      }).toThrow(/Invalid Date/)
    })

    describe('getDateObjFromString mocked date', () => {
      beforeEach(() => {
        jest.spyOn(Date.prototype, 'toTimeString').mockReturnValue('99:99:99')
      })
      test('should throw error when Date object time does not match time sent in', () => {
        expect(() => {
          dt.getDateObjFromDateTimeString(`2020-01-01 22:00`)
        }).toThrow(/Catalina date hell/)
      })
      afterEach(() => {
        jest.restoreAllMocks()
      })
    })
  })

  test('getTimeStringFromDate should return time portion of Date as string HH:MM', () => {
    expect(dt.getTimeStringFromDate(new Date('2020-01-01 23:59'))).toEqual('23:59')
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
    // TODO: add test over year boundary
    // TODO: add test on a leap day
  })

  describe('daysBetween', () => {
    // TODO: this can be tested
  })

  describe('relativeDateFromNumber', () => {
    // TODO: this can be tested
  })

  describe('getDateFromString', () => {
    // TODO: this can be tested
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
      expect(dt.getISODateStringFromYYYYMMDD('2021123.md')).toEqual('(invalid date)')
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

  describe('unhyphenatedDate', () => {
    test('for 20210424', () => {
      expect(dt.unhyphenatedDate(new Date(2021, 3, 24, 0, 0, 0))).toEqual('20210424')
    })
    test('for 20211231', () => {
      expect(dt.unhyphenatedDate(new Date(2021, 11, 31, 0, 0, 0))).toEqual('20211231')
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

  describe('removeDateTagsAndToday', () => {
    test('should remove ">today at end" ', () => {
      expect(dt.removeDateTagsAndToday(`test >today`)).toEqual('test')
    })
    test('should remove ">today at beginning" ', () => {
      expect(dt.removeDateTagsAndToday(`>today test`)).toEqual(' test')
    })
    test('should remove ">today in middle" ', () => {
      expect(dt.removeDateTagsAndToday(`this is a >today test`)).toEqual('this is a test')
    })
    test('should remove >YYYY-MM-DD date', () => {
      expect(dt.removeDateTagsAndToday(`test >2021-11-09 `)).toEqual('test')
    })
    test('should remove nothing if no date tag ', () => {
      expect(dt.removeDateTagsAndToday(`test no date`)).toEqual('test no date')
    })
  })

  describe('calcOffsetDateStr', () => {
    test('2022-01-01 +1d', () => {
      expect(dt.calcOffsetDateStr('2022-01-01', '1d')).toEqual('2022-01-02')
    })
    test('2022-01-01 +364d', () => {
      expect(dt.calcOffsetDateStr('2022-01-01', '364d')).toEqual('2022-12-31')
    })
    test('2022-01-01 +2w', () => {
      expect(dt.calcOffsetDateStr('2022-01-01', '2w')).toEqual('2022-01-15')
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

  describe('includesScheduledFutureDate()', () => {
    test('should find in "a >2022-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a >2022-04-21 date')).toEqual(true)
    })
    test('should find in ">2022-04-21"', () => {
      expect(dt.includesScheduledFutureDate('>2022-04-21')).toEqual(true)
    })
    test('should find in "a>2022-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a>2022-04-21 date')).toEqual(true)
    })
    test('should find in "(>2022-04-21)"', () => {
      expect(dt.includesScheduledFutureDate('(>2022-04-21)')).toEqual(true)
    })
    test('should not find in "a 2022-04-21 date"', () => {
      expect(dt.includesScheduledFutureDate('a 2022-04-21 date')).toEqual(false)
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
    test('test date1 style date', () => {
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

  describe('weekStartEnd()', () => {
    // skipped, as I can't see why moment is right here
    test('2021W52 -> (2021-12-27, 2022-01-02)', () => {
      expect(dt.weekStartEnd(52, 2021)).toEqual([new Date(2021, 11, 27, 0, 0, 0), new Date(2022, 0, 2, 23, 59, 59)])
    })
    test('2022W1 -> (2022-01-03, 2022-01-09)', () => {
      expect(dt.weekStartEnd(1, 2022)).toEqual([new Date(2022, 0, 3, 0, 0, 0), new Date(2022, 0, 9, 23, 59, 59)])
    })
    test('2022W2 -> (2022-01-10, 2022-01-16)', () => {
      expect(dt.weekStartEnd(2, 2022)).toEqual([new Date(2022, 0, 10, 0, 0, 0), new Date(2022, 0, 16, 23, 59, 59)])
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
    test('should return valid date for weekly note filename', () => {
      const result = dt.getDateStringFromCalendarFilename('2022-W52.md')
      expect(result).toEqual('20221226')
    })
  })

  /*
   * isValidCalendarNoteTitle()
   */
  describe('isValidCalendarNoteTitle()' /* function */, () => {
    describe('passes', () => {
      test('should work for iso date1 01-01', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-01-01`)
        expect(result).toEqual(true)
      })
      test('should work for iso date with 12-31', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-12-21`)
        expect(result).toEqual(true)
      })
      test('should work for week date W01', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-W01`)
        expect(result).toEqual(true)
      })
      test('should work for week date W52', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-W52`)
        expect(result).toEqual(true)
      })
      test('should work for week date W49', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-W49`)
        expect(result).toEqual(true)
      })
      test('should work for week date W53', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-W53`)
        expect(result).toEqual(true)
      })
      test('should work for week 10', () => {
        const result = dt.isValidCalendarNoteTitle(`2021-W10`)
        expect(result).toEqual(true)
      })
      test('should work for week 21', () => {
        const result = dt.isValidCalendarNoteTitle(`2021-W21`)
        expect(result).toEqual(true)
      })
      test('should work for week 39', () => {
        const result = dt.isValidCalendarNoteTitle(`2021-W39`)
        expect(result).toEqual(true)
      })
    })
    describe('fails', () => {
      test('should fail for iso date1 01-1', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-01-1`)
        expect(result).toEqual(false)
      })
      test('should fail for iso date with 13-31', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-13-31`)
        expect(result).toEqual(false)
      })
      test('should fail for week date W1', () => {
        const result = dt.isValidCalendarNoteTitle(`2020-W1`)
        expect(result).toEqual(false)
      })
      test('should fail for week date 21-W52', () => {
        const result = dt.isValidCalendarNoteTitle(`21-W52`)
        expect(result).toEqual(false)
      })
      test('should fail for week 54', () => {
        const result = dt.isValidCalendarNoteTitle(`2021-W54`)
        expect(result).toEqual(false)
      })
      test('should fail for week 00', () => {
        const result = dt.isValidCalendarNoteTitle(`2021-W00`)
        expect(result).toEqual(false)
      })
    })
  })
})
