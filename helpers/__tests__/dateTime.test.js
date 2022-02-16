/* globals describe, expect, it, test */

// Last updated: 30.12.2021 by @jgclark

import colors from 'chalk'
import * as dt from '../dateTime'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/dateTime')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe(section('dateTime.js'), () => {

    describe('getDateObjFromDateString', () => {
      test('fail with empty string', () => {
        expect(dt.getDateObjFromDateString('')).toEqual(undefined)
      })
      test('fail with a time string', () => {
        expect(dt.getDateObjFromDateString('12:30')).toEqual(undefined)
      })
      test('work with a valid YYYY-MM-DD string', () => {
        expect(dt.getDateObjFromDateString('2021-12-12')).toEqual(new Date(2021,11,12,0,0,0))
      })
      test('work with overflow YYYY-MM-DD string', () => {
        expect(dt.getDateObjFromDateString('2021-14-44')).toEqual(new Date(2022,2,16,0,0,0)) // surprising but true
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

    describe('getWeek', () => {
      /**
       * The ISO 8601 definition for week 01 is the week with the first Thursday of the Gregorian
       * year (i.e. of January) in it.  The following definitions based on properties of this week 
       * are mutually equivalent, since the ISO week starts with Monday:
       * - It is the first week with a majority (4 or more) of its days in January.
       * - Its first day is the Monday nearest to 1 January.
       * - It has 4 January in it
       * - NB: Here start of week is Sunday not Monday.
       */
      test('2021-12-31 (Fri) -> week 52', () => {
        expect(dt.getWeek(new Date(2021, 11, 31, 0, 0, 0))).toEqual(52)
      })
      test('2022-01-01 (Sat) -> week 52', () => {
        expect(dt.getWeek(new Date(2022, 0, 1, 0, 0, 0))).toEqual(52)
      })
      test('2022-01-02 (Sun) -> week 1 (1st day of week)', () => {
        expect(dt.getWeek(new Date(2022, 0, 2, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-03 (Mon) -> week 1', () => {
        expect(dt.getWeek(new Date(2022, 0, 3, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-08 (Sat) -> week 1 (last day of week)', () => {
        expect(dt.getWeek(new Date(2022, 0, 8, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-09 (Sun) -> week 2', () => {
        expect(dt.getWeek(new Date(2022, 0, 9, 0, 0, 0))).toEqual(2)
      })
    })

    // Commenting out, as it requires an NP function, which I missed before writing these
    // describe('weekStartEnd', () => {
    //   test('2021W52 -> (2021-12-26, 2022-01-01)', () => {
    //     expect(dt.weekStartEnd(52, 2021)).toEqual(new Date(2021, 11, 26, 0, 0, 0), new Date(2022, 0, 1, 0, 0, 0))
    //   })
    //   test('2022W1 -> (2022-01-02, 2022-01-08)', () => {
    //     expect(dt.weekStartEnd(1, 2022)).toEqual(new Date(2022, 0, 2, 0, 0, 0), new Date(2022, 0, 8, 0, 0, 0))
    //   })
    //   test('2022W2 -> (2022-01-09, 2022-01-15)', () => {
    //     expect(dt.weekStartEnd(2, 2022)).toEqual(new Date(2022, 0, 9, 0, 0, 0), new Date(2022, 0, 15, 0, 0, 0))
    //   })
    // })

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

    describe('removeDateTagsAndToday ', () => {
      test('should remove ">today at end" ', () => {
        expect(dt.removeDateTagsAndToday(`test >today`)).toEqual('test')
      })
      test('should remove ">today at beginning" ', () => {
        expect(dt.removeDateTagsAndToday(`>today test`)).toEqual('test')
      })
      test('should remove ">today in middle" ', () => {
        expect(dt.removeDateTagsAndToday(`this is a >today test`)).toEqual('this is a test')
      })
      test('should remove >YYYY-MM-DD date ', () => {
        expect(dt.removeDateTagsAndToday(`test >2021-11-09`)).toEqual('test')
      })
      test('should remove nothing if no date tag ', () => {
        expect(dt.removeDateTagsAndToday(`test no date`)).toEqual('test no date')
      })
    })

  })
})
