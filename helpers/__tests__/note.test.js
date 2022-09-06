/* global describe, test, expect, beforeAll */
import colors from 'chalk'
import * as n from '../note'
import DataStore from '@mocks/index'
import { hyphenatedDateString } from '@helpers/dateTime'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/note')}`
const section = colors.blue

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
})

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  describe(section('helpers/calendar.js'), () => {
    /*
     * convertOverdueTasksToToday()
     */
    describe('convertOverdueTasksToToday()' /* function */, () => {
      test('should find and return an overdue+ para', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01+' }] }
        const result = n.convertOverdueTasksToToday(note, false, false)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should not find and return a plain (non +) overdue para when 3rd pram is true', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
        const result = n.convertOverdueTasksToToday(note, false, true)
        expect(result).toEqual([])
      })
      test('should find and return a plain (non +) overdue para when 3rd pram is true', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01' }] }
        const result = n.convertOverdueTasksToToday(note, false, false)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should not find and return an overdue+ para if its not open', () => {
        const note = { datedTodos: [{ type: 'done', content: 'foo >2020-01-01+' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result).toEqual([])
      })
      test('should find and return an overdue+ para if is open', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01+' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should find and return a plain (non +) overdue para if is open', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result[0].content).toMatch(/>today/)
      })
      test('should do nothing if there is already a >today', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 >today' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result).toEqual([])
      })
      test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo >2020-01-01 and >2021-12-31' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result[0].content).toEqual(`foo >2020-01-01 and >today`)
      })
      test('if there are multiple dates in one line and all dates are past, replace the latest with >today and leave the other, no matter the order', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2021-12-31 >2020-01-01' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result[0].content).toEqual(`foo and >today >2020-01-01`)
      })
      test('if there are multiple dates in one line and one is in the future then do nothing', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result).toEqual([]) //make no change
      })
      test('should always convert a past due datePlus', () => {
        const note = { datedTodos: [{ type: 'open', content: 'foo and >2044-12-31 >2020-01-01+' }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result[0].content).toEqual('foo and >2044-12-31 >today')
      })

      test('should convert a datePlus for today', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}+` }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
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
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result.length).toEqual(2)
        expect(result[1].content).toMatch(/bar/)
      })

      test('should NOT consider today overdue (if no plus)', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo and >${todayHyphenated}` }] }
        const result = n.convertOverdueTasksToToday(note, true, false)
        expect(result).toEqual([]) //make no change
      })

      test('should leave dates in place if replaceDate is false', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01` }] }
        const result = n.convertOverdueTasksToToday(note, true, false, false)
        expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
      })

      test('should always replace date+ date with date if replaceDate is false', () => {
        const todayHyphenated = hyphenatedDateString(new Date())
        const note = { datedTodos: [{ type: 'open', content: `foo >2020-01-01+` }] }
        const result = n.convertOverdueTasksToToday(note, true, false, false)
        expect(result[0].content).toEqual(`foo >2020-01-01 >today`) //make no change
      })
    })
  })
})
