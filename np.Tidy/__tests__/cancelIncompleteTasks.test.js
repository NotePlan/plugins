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

    describe('filterNotesForFolderCancel', () => {
      it('keeps regular notes and excludes Calendar and Teamspace notes', () => {
        const regular = new Note({ filename: 'Imports/Archive/Note.md', type: 'Notes', paragraphs: [] })
        const calendar = new Note({ filename: '20240101.md', type: 'Calendar', paragraphs: [] })
        const teamspace = new Note({
          filename: '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/Shared/5a31e9ea-732f-45ba-8464-11260522e0de',
          type: 'Notes',
          paragraphs: [],
        })
        const rootRegular = new Note({ filename: 'Solo.md', type: 'Notes', paragraphs: [] })

        const result = f.filterNotesForFolderCancel([regular, calendar, teamspace, rootRegular])
        expect(result.map((n) => n.filename)).toEqual(['Imports/Archive/Note.md', 'Solo.md'])
      })
    })

    describe('aggregateIncompleteCountsForNotes', () => {
      it('aggregates counts and only returns notes that have incomplete items', () => {
        const withItems = new Note({
          filename: 'Imports/A.md',
          type: 'Notes',
          paragraphs: [
            new Paragraph({ type: 'open', content: 'Task 1' }),
            new Paragraph({ type: 'checklist', content: 'Check 1' }),
            new Paragraph({ type: 'scheduled', content: 'Task 2' }),
          ],
        })
        const empty = new Note({
          filename: 'Imports/B.md',
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'done', content: 'Done' }), new Paragraph({ type: 'text', content: 'Hi' })],
        })
        const moreItems = new Note({
          filename: 'Imports/Sub/C.md',
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'checklistScheduled', content: 'Check 2' })],
        })

        const result = f.aggregateIncompleteCountsForNotes([withItems, empty, moreItems])
        expect(result.totalTasks).toEqual(2)
        expect(result.totalChecklists).toEqual(2)
        expect(result.notesWithItems.map((n) => n.filename)).toEqual(['Imports/A.md', 'Imports/Sub/C.md'])
      })

      it('returns zeros when no notes have incomplete items', () => {
        const note = new Note({
          filename: 'Imports/Empty.md',
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'done', content: 'Done' })],
        })
        const result = f.aggregateIncompleteCountsForNotes([note])
        expect(result.totalTasks).toEqual(0)
        expect(result.totalChecklists).toEqual(0)
        expect(result.notesWithItems).toEqual([])
      })
    })

    describe('folder-scoped cancel via helpers', () => {
      it('filters then cancels incomplete items across eligible notes only', () => {
        const regular = new Note({
          filename: 'Imports/Keep.md',
          type: 'Notes',
          paragraphs: [
            new Paragraph({ type: 'open', content: 'Import task' }),
            new Paragraph({ type: 'checklist', content: 'Import check' }),
            new Paragraph({ type: 'done', content: 'Already done' }),
          ],
        })
        const calendar = new Note({
          filename: '20240101.md',
          type: 'Calendar',
          paragraphs: [new Paragraph({ type: 'open', content: 'Should not be touched' })],
        })
        const teamspace = new Note({
          filename: '%%NotePlanCloud%%/c484b190-77dd-4d40-a05c-e7d7144f24e1/Shared/5a31e9ea-732f-45ba-8464-11260522e0de',
          type: 'Notes',
          paragraphs: [new Paragraph({ type: 'open', content: 'Teamspace task' })],
        })

        const eligible = f.filterNotesForFolderCancel([regular, calendar, teamspace])
        const { notesWithItems, totalTasks, totalChecklists } = f.aggregateIncompleteCountsForNotes(eligible)
        expect(totalTasks).toEqual(1)
        expect(totalChecklists).toEqual(1)
        expect(notesWithItems).toHaveLength(1)

        let changedTotal = 0
        for (const note of notesWithItems) {
          changedTotal += f.cancelIncompleteTasksAndChecklistsInNote(note)
        }
        expect(changedTotal).toEqual(2)
        expect(regular.paragraphs.map((p) => p.type)).toEqual(['cancelled', 'checklistCancelled', 'done'])
        expect(calendar.paragraphs[0].type).toEqual('open')
        expect(teamspace.paragraphs[0].type).toEqual('open')
      })
    })
  })
})

