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

  describe('tests with concrete base date - year-end boundaries (day-spec concrete date, d/w/m increments)', () => {
    test('@repeat(1d, 2026-12-31) on a daily note crosses year end, gives 2027-01-01', () => {
      const mockNote = { date: moment('2026-12-31').toDate(), type: 'Calendar', filename: '20261231.md' }
      const currentContent = 'task @repeat(1d, 2026-12-31)'
      const completedDate = '2027-01-01'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-01-01')
    })

    test('@repeat(1m, 2026-12-15) on a daily note crosses year end, gives 2027-01-15', () => {
      const mockNote = { date: moment('2026-12-15').toDate(), type: 'Calendar', filename: '20261215.md' }
      const currentContent = 'task @repeat(1m, 2026-12-15)'
      const completedDate = '2026-12-20'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-01-15')
    })

    test('@repeat(1w, 2026-12-28) — day-spec concrete date in the last (53rd) week of a 53-week year, with week outputTimeframe, crosses year end to 2027-W01', () => {
      const mockNote = { date: moment('2026-10-01').toDate(), type: 'Calendar', filename: '2026-W40.md' }
      const currentContent = 'task @repeat(1w, 2026-12-28)'
      const completedDate = '2027-01-03'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-W01')
    })

    test('@repeat(1w, 2025-12-22) — day-spec concrete date in the last (52nd) week of a 52-week year, with week outputTimeframe, crosses year end to 2026-W01', () => {
      const mockNote = { date: moment('2025-07-25').toDate(), type: 'Calendar', filename: '2025-W30.md' }
      const currentContent = 'task @repeat(1w, 2025-12-22)'
      const completedDate = '2025-12-29'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W01')
    })
  })

  describe('tests with concrete base date - week/month/quarter/year specs', () => {
    test('@repeat(1w, 2026-W19) on a different weekly note, gives 2026-W20 from the concrete date (not the note date)', () => {
      const mockNote = { date: moment('2026-07-20').toDate(), type: 'Calendar', filename: '2026-W30.md' }
      const currentContent = 'task @repeat(1w, 2026-W19)'
      const completedDate = '2026-07-25'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W20')
    })

    test('@repeat(1m, 2026-W19) on a different weekly note (cross-unit), gives 2026-W23 from the concrete date', () => {
      const mockNote = { date: moment('2026-07-20').toDate(), type: 'Calendar', filename: '2026-W30.md' }
      const currentContent = 'task @repeat(1m, 2026-W19)'
      const completedDate = '2026-07-25'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W23')
    })

    test('@repeat(1m, 2026-05) on a different monthly note gives 2026-06 from the concrete date', () => {
      const mockNote = { date: moment('2026-09-01').toDate(), type: 'Calendar', filename: '2026-09.md' }
      const currentContent = 'task @repeat(1m, 2026-05)'
      const completedDate = '2026-09-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-06')
    })

    test('@repeat(1q, 2026-Q2) on a different quarterly note gives 2026-Q3 from the concrete date', () => {
      const mockNote = { date: moment('2026-10-01').toDate(), type: 'Calendar', filename: '2026-Q4.md' }
      const currentContent = 'task @repeat(1q, 2026-Q2)'
      const completedDate = '2026-10-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-Q3')
    })

    test('@repeat(1y, 2026) on a different yearly note gives 2027 from the concrete date', () => {
      const mockNote = { date: moment('2030-01-01').toDate(), type: 'Calendar', filename: '2030.md' }
      const currentContent = 'task @repeat(1y, 2026)'
      const completedDate = '2030-01-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027')
    })

    test('@repeat(+1w, 2026-W19) — + prefix overrides week-spec concrete date, uses completion date (2026-W22 not 2026-W20)', () => {
      const mockNote = { date: moment('2026-05-04').toDate(), type: 'Calendar', filename: '2026-W19.md' }
      const currentContent = 'task @repeat(+1w, 2026-W19) >2026-W19'
      const completedDate = '2026-05-20'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W22')
    })

    test('@repeat(1w, 2024-01-15) — day-spec concrete date with week outputTimeframe gives 2024-W04', () => {
      const mockNote = { date: moment('2024-01-15').toDate(), type: 'Calendar', filename: '2024-W03.md' }
      const currentContent = 'task @repeat(1w, 2024-01-15) >2024-W03'
      const completedDate = '2024-01-25'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2024-W04')
    })

    test('@repeat(1m, 2026-W99) — invalid week number falls through gracefully (no concrete date applied)', () => {
      const mockNote = { date: moment('2026-05-04').toDate(), type: 'Calendar', filename: '2026-W19.md' }
      const currentContent = 'task @repeat(1m, 2026-W99) >2026-W19'
      const completedDate = '2026-05-20'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(typeof result).toBe('string')
    })

    test('@repeat(1w, 2026-W52) on a different weekly note, within a 53-week year, gives 2026-W53 (not wrapping to 2027)', () => {
      const mockNote = { date: moment('2026-03-09').toDate(), type: 'Calendar', filename: '2026-W10.md' }
      const currentContent = 'task @repeat(1w, 2026-W52)'
      const completedDate = '2026-03-15'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W53')
    })

    test('@repeat(1w, 2026-W53) — last week of a 53-week year crosses year end, gives 2027-W01', () => {
      const mockNote = { date: moment('2026-03-09').toDate(), type: 'Calendar', filename: '2026-W10.md' }
      const currentContent = 'task @repeat(1w, 2026-W53)'
      const completedDate = '2027-01-03'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-W01')
    })

    test('@repeat(1w, 2025-W52) — last week of a 52-week year crosses year end, gives 2026-W01', () => {
      const mockNote = { date: moment('2025-03-10').toDate(), type: 'Calendar', filename: '2025-W10.md' }
      const currentContent = 'task @repeat(1w, 2025-W52)'
      const completedDate = '2025-12-29'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2026-W01')
    })

    test('@repeat(1m, 2026-12) on a different monthly note crosses year end, gives 2027-01 from the concrete date', () => {
      const mockNote = { date: moment('2026-03-01').toDate(), type: 'Calendar', filename: '2026-03.md' }
      const currentContent = 'task @repeat(1m, 2026-12)'
      const completedDate = '2026-03-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-01')
    })

    test('@repeat(1q, 2026-Q4) on a different quarterly note crosses year end, gives 2027-Q1 from the concrete date', () => {
      const mockNote = { date: moment('2026-01-01').toDate(), type: 'Calendar', filename: '2026-Q1.md' }
      const currentContent = 'task @repeat(1q, 2026-Q4)'
      const completedDate = '2026-01-10'
      const result = generateNewRepeatDate(mockNote, currentContent, completedDate)
      expect(result).toBe('2027-Q1')
    })
  })
})
