/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { _ } from 'lodash'
import { getAllTasksFromCurrentNote } from '../src/support/tasks.js'
import * as sorting from '@helpers/sorting'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Paragraph /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'


beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

describe('mlevison.GenAITaskChecker', () => {
  describe('getAllTasks using getTasksByType', () => {
      test('prove Open and Cancelled Tasks found in sample note', () => {
          const noteWIthOpenAndCancelledTasks = {
            paragraphs: [
              { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
              { type: 'empty', lineIndex: 1 },
              { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
              { type: 'open', lineIndex: 3, content: 'task 1' },
              { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
              { type: 'list', lineIndex: 5, content: 'first journal entry' },
              { type: 'list', lineIndex: 6, content: 'second journal entry' },
              { type: 'empty', lineIndex: 7 },
              { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
              { type: 'title', lineIndex: 9, content: 'Cancelled', headingLevel: 2 },
              { type: 'cancelled', lineIndex: 10, content: 'task 4 not done' },
            ],
          }
        const foundTasks = sorting.getTasksByType(noteWIthOpenAndCancelledTasks.paragraphs)

        console.log('foundTasks open', foundTasks.open, foundTasks.done, foundTasks.cancelled)
         
        expect(foundTasks.open.length).toBe(1)
        expect(foundTasks.done.length).toBe(0)
        expect(foundTasks.cancelled.length).toBe(1)
        expect(foundTasks.scheduled.length).toBe(0)
        expect(foundTasks.checklist.length).toBe(0)
        expect(foundTasks.checklistDone.length).toBe(0)
        expect(foundTasks.checklistCancelled.length).toBe(0)
        expect(foundTasks.checklistScheduled.length).toBe(0)
      })

      test('prove Done Tasks found in sample note', () => {
          const noteWIthDoneAndCancelledTasks = {
            paragraphs: [
              { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
              { type: 'empty', lineIndex: 1 },
              { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
              { type: 'scheduled', lineIndex: 3, content: 'task 1' },
              { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
              { type: 'list', lineIndex: 5, content: 'first journal entry' },
              { type: 'list', lineIndex: 6, content: 'second journal entry' },
              { type: 'empty', lineIndex: 7 },
              { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
              { type: 'done', lineIndex: 10, content: 'task finised' }, 
            ]
          }
        const foundTasks = sorting.getTasksByType(noteWIthDoneAndCancelledTasks.paragraphs)

        console.log('foundTasks open', foundTasks.open, foundTasks.done, foundTasks.cancelled)
         
        expect(foundTasks.open.length).toBe(0)
        expect(foundTasks.done.length).toBe(1)
        expect(foundTasks.cancelled.length).toBe(0)
        expect(foundTasks.scheduled.length).toBe(1)
        expect(foundTasks.checklist.length).toBe(0)
        expect(foundTasks.checklistDone.length).toBe(0)
        expect(foundTasks.checklistCancelled.length).toBe(0)
        expect(foundTasks.checklistScheduled.length).toBe(0)
      })
  })

  describe('getAllTasksFromCurrentNote', () => {
    test('returns open tasks from current note', () => {
      const currentNote = {
        paragraphs: [
          { type: 'title', lineIndex: 0, content: 'Title', headingLevel: 1 },
          { type: 'empty', lineIndex: 1 },
          { type: 'open', lineIndex: 2, content: 'Open task 1' },
          { type: 'open', lineIndex: 3, content: 'Open task 2' },
          { type: 'done', lineIndex: 4, content: 'Done task' },
        ],
      }
      const tasks = getAllTasksFromCurrentNote(currentNote)
      expect(tasks.length).toBe(3)
      expect(tasks[0].content).toBe('Open task 1')
      expect(tasks[1].content).toBe('Open task 2')
      expect(tasks[2].content).toBe('Done task')
    })
  })
})