/* globals describe, expect, test, jest, beforeEach */
// Tests for countDoneTasks. Last updated 2026-07-23 for v2.4.0.b54

import { CustomConsole } from '@jest/console'
import {
  classifyPeriodAffinity,
  getCachedHeaderDoneCount,
  getCompletedDateRangeForCalendarNote,
  getCompletedTaskBreakdownFromNote,
  getDoneDateFromContent,
  getNumCompletedTasksFromCalendarNote,
  getNumCompletedTasksFromNote,
  getPriorityLevelForWinsMarker,
} from '../src/countDoneTasks'
import { DataStore, Editor, CommandBar, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'
import * as NPnote from '@helpers/NPnote'
import * as dev from '@helpers/dev'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
DataStore.settings['_logLevel'] = 'none'

jest.mock('@helpers/dateTime', () => {
  const actual = jest.requireActual('@helpers/dateTime')
  return {
    ...actual,
    todaysDateISOString: '2026-06-16',
  }
})

const TODAY = '2026-06-16'
const YESTERDAY = '2026-06-15'
const FILENAME = '20260616.md'

/**
 * Build a done paragraph for counting tests.
 * @param {string} content
 * @returns {Paragraph}
 */
function makeDonePara(content) {
  return new Paragraph({ type: 'done', content })
}

/**
 * Build a mock note with the given paragraphs.
 * @param {Array<Paragraph>} paras
 * @param {string?} filename
 * @returns {Note}
 */
function makeNoteWithParas(paras, filename = FILENAME) {
  return new Note({ filename, paragraphs: paras })
}

describe('jgclark.Dashboard countDoneTasks', () => {
  describe('getPriorityLevelForWinsMarker()', () => {
    test('maps markers to NotePlan priorities', () => {
      expect(getPriorityLevelForWinsMarker('>>')).toBe(4)
      expect(getPriorityLevelForWinsMarker('!!!')).toBe(3)
      expect(getPriorityLevelForWinsMarker('!!')).toBe(2)
      expect(getPriorityLevelForWinsMarker('unknown')).toBe(4)
    })
  })

  describe('getDoneDateFromContent()', () => {
    test('extracts ISO date from @done tag', () => {
      expect(getDoneDateFromContent(`task @done(${TODAY} 10:00)`)).toBe(TODAY)
      expect(getDoneDateFromContent(`task @done(${YESTERDAY})`)).toBe(YESTERDAY)
      expect(getDoneDateFromContent('no done tag')).toBeNull()
    })
  })

  describe('getCompletedDateRangeForCalendarNote()', () => {
    test('returns single-day range for daily note', () => {
      expect(getCompletedDateRangeForCalendarNote('20260615.md')).toEqual({ start: YESTERDAY, end: YESTERDAY })
    })

    test('returns week range for weekly note', () => {
      const range = getCompletedDateRangeForCalendarNote('2026-W25.md')
      expect(range).not.toBeNull()
      expect(range?.start <= range?.end).toBe(true)
      expect(range?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('returns month range for monthly note', () => {
      expect(getCompletedDateRangeForCalendarNote('2026-06.md')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    })

    test('returns null for project note', () => {
      expect(getCompletedDateRangeForCalendarNote('Projects/Foo.md')).toBeNull()
    })
  })

  describe('classifyPeriodAffinity()', () => {
    test('uses remaining >today schedule tag', () => {
      expect(classifyPeriodAffinity(`done >today @done(${TODAY})`, 'Projects/x.md')).toBe('today')
    })

    test('uses remaining >ISO schedule tag for today', () => {
      expect(classifyPeriodAffinity(`done >${TODAY} @done(${TODAY})`, 'Projects/x.md')).toBe('today')
    })

    test('uses calendar note placement for today daily note', () => {
      expect(classifyPeriodAffinity(`done @done(${TODAY})`, '20260616.md')).toBe('today')
    })

    test('uses calendar note placement for yesterday daily note', () => {
      expect(classifyPeriodAffinity(`done @done(${TODAY})`, '20260615.md')).toBe('yesterday')
    })

    test('treats project note with no schedule as other', () => {
      expect(classifyPeriodAffinity(`done @done(${TODAY})`, 'Projects/x.md')).toBe('other')
    })
  })

  describe('getNumCompletedTasksFromNote()', () => {
    beforeEach(() => {
      jest.restoreAllMocks()
      jest.spyOn(dev, 'clo').mockImplementation(() => {})
      jest.spyOn(dev, 'logError').mockImplementation(() => {})
      Editor.note = makeNoteWithParas([])
      Editor.note.filename = 'other-note.md'
      Editor.paragraphs = []
    })

    test('counts only tasks completed today by default', () => {
      const paras = [
        makeDonePara(`done today @done(${TODAY})`),
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
        makeDonePara('done paragraph without @done tag'),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false)

      expect(result.completedTasks).toBe(1)
      expect(result.completedWins).toBe(0)
      expect(result.lastUpdated).toBeInstanceOf(Date)
    })

    test('counts all completed tasks when doneDateFilter is false', () => {
      const paras = [
        makeDonePara(`done today @done(${TODAY})`),
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, false)

      expect(result.completedTasks).toBe(2)
      expect(result.completedWins).toBe(0)
    })

    test('counts tasks for a specific ISO date when doneDateFilter is a string', () => {
      const paras = [
        makeDonePara(`done today @done(${TODAY})`),
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote('20260615.md', false, YESTERDAY)

      expect(result.completedTasks).toBe(1)
    })

    test('counts tasks in an inclusive date range', () => {
      const paras = [
        makeDonePara(`done today @done(${TODAY})`),
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
        makeDonePara('done earlier @done(2026-06-01)'),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, { start: YESTERDAY, end: TODAY })

      expect(result.completedTasks).toBe(2)
    })

    test('reads paragraphs from Editor when the note is open and useEditorWherePossible is true', () => {
      const editorParas = [makeDonePara(`editor task @done(${TODAY})`)]
      Editor.note = makeNoteWithParas(editorParas)
      Editor.note.filename = FILENAME
      Editor.paragraphs = editorParas
      const getNoteSpy = jest.spyOn(NPnote, 'getNoteFromFilename')

      const result = getNumCompletedTasksFromNote(FILENAME)

      expect(result.completedTasks).toBe(1)
      expect(getNoteSpy).not.toHaveBeenCalled()
    })

    test('reads paragraphs from DataStore when useEditorWherePossible is false', () => {
      const editorParas = [makeDonePara(`editor task @done(${TODAY})`)]
      const noteParas = [makeDonePara(`note task @done(${TODAY})`)]
      Editor.note = makeNoteWithParas(editorParas)
      Editor.note.filename = FILENAME
      Editor.paragraphs = editorParas
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(noteParas))

      const result = getNumCompletedTasksFromNote(FILENAME, false)

      expect(result.completedTasks).toBe(1)
    })

    test('returns completedWins when winsPriorityLevel is set', () => {
      const paras = [
        makeDonePara(`>> high priority @done(${TODAY})`),
        makeDonePara(`!!! medium priority @done(${TODAY})`),
        makeDonePara(`plain task @done(${TODAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 4)

      expect(result.completedTasks).toBe(3)
      expect(result.completedWins).toBe(1)
    })

    test('returns zero completedWins when no completed tasks match winsPriorityLevel', () => {
      const paras = [makeDonePara(`plain task @done(${TODAY})`)]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 4)

      expect(result.completedTasks).toBe(1)
      expect(result.completedWins).toBe(0)
    })

    test('does not count wins when winsPriorityLevel is zero', () => {
      const paras = [makeDonePara(`>> high priority @done(${TODAY})`)]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 0)

      expect(result.completedTasks).toBe(1)
      expect(result.completedWins).toBe(0)
    })

    test('returns zero counts when the note cannot be found', () => {
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(null)

      const result = getNumCompletedTasksFromNote('missing-note.md', false)

      expect(result.completedTasks).toBe(0)
      expect(result.completedWins).toBeUndefined()
      expect(result.lastUpdated).toBeInstanceOf(Date)
      expect(dev.logError).toHaveBeenCalled()
    })
  })

  describe('getNumCompletedTasksFromCalendarNote()', () => {
    beforeEach(() => {
      jest.restoreAllMocks()
      jest.spyOn(dev, 'logError').mockImplementation(() => {})
      Editor.note = makeNoteWithParas([])
      Editor.note.filename = 'other-note.md'
      Editor.paragraphs = []
    })

    test('for yesterday daily note counts @done(yesterday) not @done(today)', () => {
      const yesterdayFilename = '20260615.md'
      const paras = [
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
        makeDonePara(`done today sitting in yesterday note @done(${TODAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras, yesterdayFilename))

      const result = getNumCompletedTasksFromCalendarNote(yesterdayFilename, false)

      expect(result.completedTasks).toBe(1)
    })

    test('for month note counts @done dates inside the month', () => {
      const monthFilename = '2026-06.md'
      const paras = [
        makeDonePara(`in month @done(${TODAY})`),
        makeDonePara('also in month @done(2026-06-01)'),
        makeDonePara('outside @done(2026-05-31)'),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras, monthFilename))

      const result = getNumCompletedTasksFromCalendarNote(monthFilename, false)

      expect(result.completedTasks).toBe(2)
    })
  })

  describe('getCachedHeaderDoneCount()', () => {
    const CHANGED_NOTE_FILE = '../../data/jgclark.Dashboard/todaysChangedNoteList.json'

    beforeEach(() => {
      DataStore.preference = jest.fn()
      DataStore.fileExists = jest.fn()
      DataStore.loadData = jest.fn()
    })

    test('returns 0 when cache is from a previous day', () => {
      DataStore.preference.mockReturnValue(`${YESTERDAY}T12:00:00.000Z`)
      DataStore.fileExists.mockReturnValue(true)

      expect(getCachedHeaderDoneCount()).toBe(0)
      expect(DataStore.loadData).not.toHaveBeenCalled()
    })

    test('sums completedToday from JSON when cache is from today', () => {
      DataStore.preference.mockReturnValue(`${TODAY}T12:00:00.000Z`)
      DataStore.fileExists.mockImplementation((f) => f === CHANGED_NOTE_FILE)
      DataStore.loadData.mockReturnValue(JSON.stringify([
        { filename: 'a.md', completedToday: 2, completedTasks: 2 },
        { filename: 'b.md', completedTasks: 3 },
      ]))

      expect(getCachedHeaderDoneCount()).toBe(5)
    })
  })

  describe('getCompletedTaskBreakdownFromNote()', () => {
    beforeEach(() => {
      jest.restoreAllMocks()
      jest.spyOn(dev, 'logError').mockImplementation(() => {})
      Editor.note = makeNoteWithParas([])
      Editor.note.filename = 'other-note.md'
      Editor.paragraphs = []
    })

    test('buckets by affinity and counts wins', () => {
      const paras = [
        makeDonePara(`>> win for today >today @done(${TODAY})`),
        makeDonePara(`project task @done(${TODAY})`),
        makeDonePara(`week task >2026-W25 @done(${TODAY})`),
        makeDonePara(`old @done(${YESTERDAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras, 'Projects/x.md'))

      const result = getCompletedTaskBreakdownFromNote('Projects/x.md', 4, false)

      expect(result.completedTasks).toBe(3)
      expect(result.forToday).toBe(1)
      expect(result.forOtherPeriod).toBe(1)
      expect(result.completedWins).toBe(1)
    })

    test('treats today daily note placement as forToday', () => {
      const paras = [makeDonePara(`in today note @done(${TODAY})`)]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras, FILENAME))

      const result = getCompletedTaskBreakdownFromNote(FILENAME, 4, false)

      expect(result.forToday).toBe(1)
      expect(result.forOtherPeriod).toBe(0)
      expect(result.completedTasks).toBe(1)
    })
  })
})
