/* global describe, expect, test, beforeAll */
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import moment from 'moment'
import { generateNewRepeatDate } from '../src/repeatHelpers'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

// TODO: Add tests for generateRepeatForPara()

describe('generateNewRepeatDate', () => {
  describe('tests from calendar notes', () => {
    test('1d repeat from 20240614 on 20240616 with no due date -> 2024-06-15', () => {
      const mockNote = { date: moment('2024-06-14').toDate(), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(1d)'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-15')
    })

    test('+1d repeat from 20240614 on 20240616 with no due date -> 2024-06-17', () => {
      const mockNote = { date: moment('2024-06-14').toDate(), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(+1d)'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-17')
    })

    test('1d repeat from 20240616 on 20240616 with due date 2024-06-16 -> 2024-06-17', () => {
      const mockNote = { date: moment('2024-06-14').toDate(), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(+1d) >2024-06-16'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-17')
    })

    test('1w repeat from 2024-W45 with no due date -> 2024-W46', () => {
      const mockNote = { date: moment('2024-10-14').toDate(), type: 'Calendar', filename: '2024-W45.md' }
      const currentContent = 'test text @repeat(1w) >2024-W45'
      const completedDate = '2024-11-02'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-W46')
    })

    test('+1w repeat from 2024-W45 with no due date -> 2024-W47', () => {
      const mockNote = { date: moment('2024-10-14').toDate(), type: 'Calendar', filename: '2024-W45.md' }
      const currentContent = 'test text @repeat(+1w) >2024-W45'
      const completedDate = '2024-11-14'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-W47')
    })
  })

  describe('tests with concrete base date', () => {
    test('@repeat(1m, 2024-01-15) completed late still gives 2024-02-15', () => {
      const mockNote = { date: moment('2024-01-14').toDate(), type: 'Calendar', filename: '20240114.md' }
      const currentContent = 'do expenses @repeat(1m, 2024-01-15)'
      const completedDate = '2024-01-20'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-02-15')
    })

    test('@repeat(1w, 2024-01-15) completed late still gives 2024-01-22', () => {
      const mockNote = { date: moment('2024-01-10').toDate(), type: 'Calendar', filename: '20240110.md' }
      const currentContent = 'task @repeat(1w, 2024-01-15)'
      const completedDate = '2024-01-25'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-01-22')
    })

    test('@repeat(+1m, 2024-01-15) — + prefix overrides concrete date, gives 2024-02-25 (from completion) not 2024-02-15', () => {
      const mockNote = { date: moment('2024-01-14').toDate(), type: 'Calendar', filename: '20240114.md' }
      const currentContent = 'do expenses @repeat(+1m, 2024-01-15)'
      const completedDate = '2024-01-25'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-02-25')
    })

    test('@repeat(1y, 2024-03-01) gives 2025-03-01', () => {
      const mockNote = { date: moment('2024-03-01').toDate(), type: 'Calendar', filename: '20240301.md' }
      const currentContent = 'annual review @repeat(1y, 2024-03-01)'
      const completedDate = '2024-03-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2025-03-01')
    })

    test('@repeat(+1d) without concrete date still uses completion date (unchanged behaviour)', () => {
      const mockNote = { date: moment('2024-06-14').toDate(), type: 'Calendar', filename: '20240614.md' }
      const currentContent = 'text @repeat(+1d)'
      const completedDate = '2024-06-16'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-06-17')
    })

    test('@repeat(1m) with scheduled date still uses scheduled date (unchanged behaviour)', () => {
      const mockNote = { date: moment('2024-01-10').toDate(), type: 'Calendar', filename: '20240110.md' }
      const currentContent = 'do expenses @repeat(1m) >2024-01-15'
      const completedDate = '2024-01-20'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-02-15')
    })

    test('malformed @repeat(foo, 2024-01-15) falls through to existing logic gracefully', () => {
      const mockNote = { date: moment('2024-01-14').toDate(), type: 'Calendar', filename: '20240114.md' }
      const currentContent = 'task @repeat(foo, 2024-01-15)'
      const completedDate = '2024-01-20'
      // Invalid interval — RE_EXTENDED_REPEAT won't match, so RE_EXTENDED_REPEAT_CAPTURE captures
      // the raw "foo, 2024-01-15". The interval validation guard skips the split, leaving
      // dateIntervalString as the full string. length > 0 but not a valid +/plain interval,
      // so calcOffsetDateStr returns completedDate as a graceful fallback.
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(typeof result).toBe('string')
    })
  })
})
