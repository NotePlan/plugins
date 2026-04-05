// @flow
/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, it, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

import * as f from '../src/cancelIncompleteTasks.js'
import { CustomConsole, LogType, LogMessage } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, Paragraph, simpleFormatter } from '@mocks/index'

const PLUGIN_NAME = `np.Tidy`
const FILENAME = `cancelIncompleteTasks.js`

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    beforeAll(() => {
      global.Calendar = Calendar
      global.Clipboard = Clipboard
      global.CommandBar = CommandBar
      global.DataStore = DataStore
      global.Editor = Editor
      global.NotePlan = new NotePlan()
      global.Paragraph = Paragraph
      global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
      DataStore.settings['_logLevel'] = 'none'
    })

    describe('countIncompleteTasksAndChecklistsInNote', () => {
      it('counts open and scheduled tasks and checklists correctly', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'open', content: 'Task 1' }),
            new Paragraph({ type: 'scheduled', content: 'Task 2' }),
            new Paragraph({ type: 'checklist', content: 'Checklist 1' }),
            new Paragraph({ type: 'checklistScheduled', content: 'Checklist 2' }),
            new Paragraph({ type: 'done', content: 'Done task' }),
            new Paragraph({ type: 'cancelled', content: 'Cancelled task' }),
            new Paragraph({ type: 'checklistDone', content: 'Done checklist' }),
            new Paragraph({ type: 'checklistCancelled', content: 'Cancelled checklist' }),
            new Paragraph({ type: 'text', content: 'Some text' }),
          ],
        })

        const result = f.countIncompleteTasksAndChecklistsInNote(note)
        expect(result.tasks).toEqual(2)
        expect(result.checklists).toEqual(2)
      })

      it('returns zero counts for notes without incomplete items', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'done', content: 'Done task' }),
            new Paragraph({ type: 'cancelled', content: 'Cancelled task' }),
            new Paragraph({ type: 'checklistDone', content: 'Done checklist' }),
            new Paragraph({ type: 'checklistCancelled', content: 'Cancelled checklist' }),
          ],
        })

        const result = f.countIncompleteTasksAndChecklistsInNote(note)
        expect(result.tasks).toEqual(0)
        expect(result.checklists).toEqual(0)
      })
    })

    describe('cancelIncompleteTasksAndChecklistsInNote', () => {
      it('converts incomplete tasks and checklists to cancelled types', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'open', content: 'Task 1' }),
            new Paragraph({ type: 'scheduled', content: 'Task 2' }),
            new Paragraph({ type: 'checklist', content: 'Checklist 1' }),
            new Paragraph({ type: 'checklistScheduled', content: 'Checklist 2' }),
            new Paragraph({ type: 'done', content: 'Done task' }),
            new Paragraph({ type: 'cancelled', content: 'Cancelled task' }),
            new Paragraph({ type: 'checklistDone', content: 'Done checklist' }),
            new Paragraph({ type: 'checklistCancelled', content: 'Cancelled checklist' }),
          ],
        })

        const changed = f.cancelIncompleteTasksAndChecklistsInNote(note)
        expect(changed).toEqual(4)

        const types = note.paragraphs.map((p) => p.type)
        expect(types).toEqual([
          'cancelled',
          'cancelled',
          'checklistCancelled',
          'checklistCancelled',
          'done',
          'cancelled',
          'checklistDone',
          'checklistCancelled',
        ])
      })

      it('returns zero when there are no incomplete items', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'done', content: 'Done task' }),
            new Paragraph({ type: 'cancelled', content: 'Cancelled task' }),
            new Paragraph({ type: 'checklistDone', content: 'Done checklist' }),
            new Paragraph({ type: 'checklistCancelled', content: 'Cancelled checklist' }),
          ],
        })

        const changed = f.cancelIncompleteTasksAndChecklistsInNote(note)
        expect(changed).toEqual(0)
      })
    })
  })
})

