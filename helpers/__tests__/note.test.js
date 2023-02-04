/* global describe, test, expect, beforeAll */
import colors from 'chalk'
import * as n from '../note'
import { DataStore, Calendar } from '@mocks/index'
import { hyphenatedDateString } from '@helpers/dateTime'

const PLUGIN_NAME = `helpers/note`

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.Calendar = Calendar
})

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  /*
   * findOverdueDatesInString()
   */
  describe('findOverdueDatesInString()' /* function */, () => {
    test('should find no date in line with no overdue', () => {
      const result = n.findOverdueDatesInString('>2922-01-01')
      expect(result.length).toEqual(0)
    })
    test('should find date in line with overdue', () => {
      const result = n.findOverdueDatesInString('>1999-01-01')
      expect(result.length).toEqual(1)
      expect(result).toEqual(['>1999-01-01'])
    })
    test('should find 2 overdue dates', () => {
      const result = n.findOverdueDatesInString('>1999-01-01 >1998-01-01')
      expect(result.length).toEqual(2)
    })
  })

  /*
   * updateDatePlusTags()
   */
  describe('updateDatePlusTags()' /* function */, () => {
    test('should find and return an overdue+ para', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01+' }] }
      const options = { openOnly: false, plusOnlyTypes: true, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toMatch(/>today/)
    })
    test('should not find and return a plain (non +) overdue para when 3rd pram is true', () => {
      const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
      const options = { openOnly: false, plusOnlyTypes: true, replaceDate: true }
      const result = n.updateDatePlusTags(note, options)
      expect(result).toEqual([])
    })
    test('should find and return a plain (non +) overdue para when 3rd pram is true', () => {
      const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
      const options = { openOnly: false, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toMatch(/>today/)
    })
    test('should not find and return an overdue+ para if its not open', () => {
      const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01+' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result).toEqual([])
    })
    test('should find and return an overdue+ para if is open', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01+' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toMatch(/>today/)
    })
    test('should find and return a plain (non +) overdue para if is open', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toMatch(/>today/)
    })
    test('should do nothing if there is already a >today', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 >today' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result).toEqual([])
    })
    test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 and >2021-12-31' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual(`foo >2020-01-01 and >today`)
    })
    test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other, no matter the order', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo and >2021-12-31 >2020-01-01' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual(`foo and >today >2020-01-01`)
    })
    test('if there are multiple dates in one line and one is in the future then do nothing', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01' }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result).toEqual([]) //make no change
    })
    test('should always convert a past due datePlus', () => {
      const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01+' }] }
      const options = { openOnly: true, plusOnlyTypes: true, replaceDate: true }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual('foo and >2044-12-31 >today')
    })

    test('should convert a datePlus for today', () => {
      const todayHyphenated = hyphenatedDateString(new Date())
      const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}+` }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: true }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual('foo and >today')
    })

    test('should return multiple paras if is open', () => {
      const note = {
        datedTodos: [
          { type: 'open', content: 'foo >2020-01-01+' },
          { type: 'scheduled', content: 'foo >2020-01-01' },
          { type: 'open', content: 'bar >2020-01-01' },
        ],
      }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result.length).toEqual(2)
      expect(result[1].content).toMatch(/bar/)
    })

    test('should NOT consider today overdue (if no plus)', () => {
      const todayHyphenated = hyphenatedDateString(new Date())
      const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}` }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result).toEqual([]) //make no change
    })

    test('should leave dates in place if replaceDate is false', () => {
      const todayHyphenated = hyphenatedDateString(new Date())
      const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01` }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
    })

    test('should always replace date+ date with date if replaceDate is false', () => {
      const todayHyphenated = hyphenatedDateString(new Date())
      const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01+` }] }
      const options = { openOnly: true, plusOnlyTypes: false, replaceDate: false }
      const result = n.updateDatePlusTags(note, options)
      expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
    })
  })
  /*
   * getNotetype()
   */
  describe('getNotetype()' /* function */, () => {
    test('should default to project note', () => {
      const input = { filename: 'foo' }
      const expected = 'Project'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
    test('should return Daily for daily note', () => {
      const input = { type: 'Calendar', filename: '20000101.md' }
      const expected = 'Daily'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
    test('should return Weekly for Weekly note', () => {
      const input = { type: 'Calendar', filename: '2000-W51.md' }
      const expected = 'Weekly'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
    test('should return Monthly for Monthly note', () => {
      const input = { type: 'Calendar', filename: '2000-01.md' }
      const expected = 'Monthly'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
    test('should return Quarterly for Quarterly note', () => {
      const input = { type: 'Calendar', filename: '2000-Q4.md' }
      const expected = 'Quarterly'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
    test('should return Yearly for Yearly note', () => {
      const input = { type: 'Calendar', filename: '2000.md' }
      const expected = 'Yearly'
      const result = n.getNoteType(input)
      expect(result).toEqual(expected)
    })
  })
})
