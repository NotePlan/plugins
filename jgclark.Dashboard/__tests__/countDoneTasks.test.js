/* globals describe, expect, test, jest, beforeEach */
// Tests for getNumCompletedTasksFromNote(). Last updated 2026-06-16 for v2.4.0.b46

import { CustomConsole } from '@jest/console'
import { getNumCompletedTasksFromNote } from '../src/countDoneTasks'
import { DataStore, Editor, CommandBar, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'
import * as NPnote from '@helpers/NPnote'
import * as dev from '@helpers/dev'

global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan
global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
DataStore.settings['_logLevel'] = 'none'

jest.mock('@helpers/dateTime', () => ({
  todaysDateISOString: '2026-06-16',
}))

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
 * @returns {Note}
 */
function makeNoteWithParas(paras) {
  return new Note({ filename: FILENAME, paragraphs: paras })
}

describe('jgclark.Dashboard countDoneTasks', () => {
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
      expect(result.completedTasksAtPriority).toBe(0)
      expect(result.lastUpdated).toBeInstanceOf(Date)
    })

    test('counts all completed tasks when onlyCountTasksCompletedToday is false', () => {
      const paras = [
        makeDonePara(`done today @done(${TODAY})`),
        makeDonePara(`done yesterday @done(${YESTERDAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, false)

      expect(result.completedTasks).toBe(2)
      expect(result.completedTasksAtPriority).toBe(0)
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

    test('returns completedTasksAtPriority when priorityLevel is set', () => {
      const paras = [
        makeDonePara(`>> high priority @done(${TODAY})`),
        makeDonePara(`!!! medium priority @done(${TODAY})`),
        makeDonePara(`plain task @done(${TODAY})`),
      ]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 4)

      expect(result.completedTasks).toBe(3)
      expect(result.completedTasksAtPriority).toBe(1)
    })

    test('returns zero completedTasksAtPriority when no completed tasks match priorityLevel', () => {
      const paras = [makeDonePara(`plain task @done(${TODAY})`)]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 4)

      expect(result.completedTasks).toBe(1)
      expect(result.completedTasksAtPriority).toBe(0)
    })

    test('does not filter by priority when priorityLevel is zero', () => {
      const paras = [makeDonePara(`>> high priority @done(${TODAY})`)]
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(makeNoteWithParas(paras))

      const result = getNumCompletedTasksFromNote(FILENAME, false, true, 0)

      expect(result.completedTasks).toBe(1)
      expect(result.completedTasksAtPriority).toBe(0)
    })

    test('returns zero counts when the note cannot be found', () => {
      jest.spyOn(NPnote, 'getNoteFromFilename').mockReturnValue(null)

      const result = getNumCompletedTasksFromNote('missing-note.md', false)

      expect(result.completedTasks).toBe(0)
      expect(result.completedTasksAtPriority).toBeUndefined()
      expect(result.lastUpdated).toBeInstanceOf(Date)
      expect(dev.logError).toHaveBeenCalled()
    })
  })
})
