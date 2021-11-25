/* globals describe, expect, it, test */
import colors from 'chalk'
import * as tb from '../timeblocks'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/timeblocks')}`
const section = colors.blue

describe(`${PLUGIN_NAME}`, () => {
  describe(section('timeblocking.js'), () => {
    describe('isTimeBlockLine ', () => {
      test('should return false if no timeblock', () => {
        expect(tb.isTimeBlockLine('01. no timeblock here :')).toEqual(false)
      })
      describe('RE_TIMEBLOCK_TYPE1 ', () => {
        test('should work with single time (no range) and no AM or PM', () => {
          expect(tb.isTimeBlockLine('12:30')).toEqual(true)
        })
        test('should work with range and no AM or PM', () => {
          expect(tb.isTimeBlockLine('12:30-14:45')).toEqual(true)
        })
        test('should work with single digits', () => {
          expect(tb.isTimeBlockLine('1:30')).toEqual(true)
        })
        test('should work with single digits', () => {
          expect(tb.isTimeBlockLine('1:38')).toEqual(true)
        })
        test('should not work with single digit mins', () => {
          expect(tb.isTimeBlockLine('1:8')).toEqual(false)
        })
        test('should work for 12:30AM-2:45pm (duration and caps)', () => {
          expect(tb.isTimeBlockLine('12:30AM-2:45pm')).toEqual(true)
        })
        test('should work for 12:30AM by itself', () => {
          expect(tb.isTimeBlockLine('12:30AM')).toEqual(true)
        })
      })
      describe('RE_TIMEBLOCK_TYPE2 ', () => {
        test('should work with at, like at 2AM', () => {
          expect(tb.isTimeBlockLine('at 4:30AM')).toEqual(true)
        })
        test('should work with just a number, like "at 2"', () => {
          expect(tb.isTimeBlockLine('at 4')).toEqual(true)
        })
        test('should work with just a number and a range, like "at 2-3"', () => {
          expect(tb.isTimeBlockLine('at 2-3')).toEqual(true)
        })
        test('should work with just a number and a range, like "at 2-3pm"', () => {
          expect(tb.isTimeBlockLine('at 2-3pm')).toEqual(true)
        })
      })
      describe('RE_TIMEBLOCK_TYPE3 ', () => {
        test('should work with at and mins on the ending time, like "at 9-11:30"', () => {
          expect(tb.isTimeBlockLine('at 9-11:30')).toEqual(true)
        })
      })
    })
    describe('findLongestStringInArray ', () => {
      test('should return longest string in array', () => {
        expect(tb.findLongestStringInArray(['a', 'bb', 'ccc', 'dddd'])).toEqual('dddd')
      })
      test('should return longest string in array wherever it is in array', () => {
        expect(tb.findLongestStringInArray(['aa', 'bbbbb', 'ccc', 'cc'])).toEqual('bbbbb')
      })
      test('should return empty string if no array', () => {
        expect(tb.findLongestStringInArray([])).toEqual('')
      })
    })

    describe('getTimeBlockString ', () => {
      test('should return null if no timeblock', () => {
        expect(tb.getTimeBlockString('01. no timeblock here :')).toEqual('')
      })
      describe('RE_TIMEBLOCK_TYPE1 ', () => {
        test('should work with single time (no range) and no AM or PM', () => {
          expect(tb.getTimeBlockString('12:30')).toEqual('12:30')
        })
        test('should work with range and no AM or PM', () => {
          expect(tb.getTimeBlockString('12:30-14:45')).toEqual('12:30-14:45')
        })
        test('should work with single digits', () => {
          expect(tb.getTimeBlockString('1:30')).toEqual('1:30')
        })
        test('should work with single digits', () => {
          expect(tb.getTimeBlockString('1:38')).toEqual('1:38')
        })
        test('should not work with single digit mins', () => {
          expect(tb.getTimeBlockString('1:8')).toEqual('')
        })
        test('should work for 12:30AM-2:45pm (duration and caps)', () => {
          expect(tb.getTimeBlockString('12:30AM-2:45pm')).toEqual('12:30AM-2:45pm')
        })
        test('should work for 12:30AM by itself', () => {
          expect(tb.getTimeBlockString('12:30AM')).toEqual('12:30AM')
        })
      })
      describe('RE_TIMEBLOCK_TYPE2 ', () => {
        test('should work with at, like at 4:30AM', () => {
          expect(tb.getTimeBlockString('at 4:30AM')).toEqual('at 4:30AM')
        })
        test('should work with just a number, like "at 2"', () => {
          expect(tb.getTimeBlockString('does this work at 4')).toEqual('at 4')
        })
        test('should work with just a number and a range, like "at 2-3"', () => {
          expect(tb.getTimeBlockString('something at 2-3')).toEqual('at 2-3')
        })
        test('should work with just a number and a range, like "at 2-3pm"', () => {
          expect(tb.getTimeBlockString('yep at 2-3pm')).toEqual('at 2-3pm')
        })
      })
      describe('RE_TIMEBLOCK_TYPE3 ', () => {
        test('should work with at and mins on the ending time, like "at 9-11:30"', () => {
          expect(tb.getTimeBlockString('uhhuh at 9-11:30')).toEqual('at 9-11:30')
        })
      })
    })
  })
})
