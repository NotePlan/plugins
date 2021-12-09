/* globals describe, expect, it, test */

// Last updated: 9.12.2021 by @jgclark

import colors from 'chalk'
import * as dT from '../dateTime'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/dateTime')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {

  describe(section('dateTime.js'), () => {

    describe('getDateFromString', () => {
      test('fail with empty string', () => {
        expect(dT.getDateFromString('')).toEqual(undefined)
      })
      test('fail with a time string', () => {
        expect(dT.getDateFromString('12:30')).toEqual(undefined)
      })
      test('work with a valid YYYY-MM-DD string', () => {
        expect(dT.getDateFromString('2021-12-12')).toEqual(new Date(2021,11,12,0,0,0))
      })
      test('work with overflow YYYY-MM-DD string', () => {
        expect(dT.getDateFromString('2021-14-44')).toEqual(new Date(2022,2,16,0,0,0)) // surprising but true
      })
      test('fail with a different date style', () => {
        expect(dT.getDateFromString('3/9/2021')).toEqual(undefined)
      })
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
      test('2021-12-31 Fri -> week 52', () => {
        expect(dT.getWeek(new Date(2021, 11, 31, 0, 0, 0))).toEqual(52)
      })
      test('2022-01-01 (Sat) -> week 0', () => {
        expect(dT.getWeek(new Date(2022, 0, 1, 0, 0, 0))).toEqual(52)
      })
      test('2022-01-02 (Sun) -> week 1 (1st day of week)', () => {
        expect(dT.getWeek(new Date(2022, 0, 2, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-03 (Mon) -> week 1', () => {
        expect(dT.getWeek(new Date(2022, 0, 3, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-08 (Sat) -> week 1 (last day of week)', () => {
        expect(dT.getWeek(new Date(2022, 0, 8, 0, 0, 0))).toEqual(1)
      })
      test('2022-01-09 (Sun) -> week 2', () => {
        expect(dT.getWeek(new Date(2022, 0, 9, 0, 0, 0))).toEqual(2)
      })
    })

    // Commenting out, as it requires an NP function, which I missed before writing these
    // describe('weekStartEnd', () => {
    //   test('2021W52 -> (2021-12-26, 2022-01-01)', () => {
    //     expect(dT.weekStartEnd(52, 2021)).toEqual(new Date(2021, 11, 26, 0, 0, 0), new Date(2022, 0, 1, 0, 0, 0))
    //   })
    //   test('2022W1 -> (2022-01-02, 2022-01-08)', () => {
    //     expect(dT.weekStartEnd(1, 2022)).toEqual(new Date(2022, 0, 2, 0, 0, 0), new Date(2022, 0, 8, 0, 0, 0))
    //   })
    //   test('2022W2 -> (2022-01-09, 2022-01-15)', () => {
    //     expect(dT.weekStartEnd(2, 2022)).toEqual(new Date(2022, 0, 9, 0, 0, 0), new Date(2022, 0, 15, 0, 0, 0))
    //   })
    // })
  })
})
