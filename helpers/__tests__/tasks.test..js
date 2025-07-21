/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { noteWIthOpenAndCancelledTasks, noteWIthDoneAndScheduledTasks, noteWithOpenAndDoneTasks, noteWithOneTaskOfEachType } from '@mocks/factories/noteFactory'

import { getAllTasksFromCurrentNote } from '../tasks.js'
import * as sorting from '@helpers/sorting'
import { CustomConsole } from '@jest/console' // see note below
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
  describe('test getTasksByType', () => {
    test('prove Open and Cancelled Tasks found in sample note', () => {
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
      const foundTasks = sorting.getTasksByType(noteWIthDoneAndScheduledTasks.paragraphs)

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
    test('returns open and done tasks from current note', () => {
      const tasks = getAllTasksFromCurrentNote(noteWithOpenAndDoneTasks)
      expect(tasks.length).toBe(3)
      expect(tasks[0].content).toBe('Open task 1')
      expect(tasks[1].content).toBe('Open task 2')
      expect(tasks[2].content).toBe('Done task')
    })

    test('returns open and cancelled tasks from current note', () => {
      const tasks = getAllTasksFromCurrentNote(noteWIthOpenAndCancelledTasks)
      expect(tasks.length).toBe(2)
      expect(tasks[0].content).toBe('task 1')
      expect(tasks[1].content).toBe('task cancelled')
    })

    test('returns one of each task types from current note', () => {
      const tasks = getAllTasksFromCurrentNote(noteWithOneTaskOfEachType)
      expect(tasks.length).toBe(8)
      expect(tasks[0].content).toBe('Open task 1')
      expect(tasks[1].content).toBe('Scheduled task 2')
      expect(tasks[2].content).toBe('Done task')
      expect(tasks[3].content).toBe('Cancelled task')
      expect(tasks[4].content).toBe('checklist')
      expect(tasks[5].content).toBe('checklistScheduled')
      expect(tasks[6].content).toBe('checklistDone')
      expect(tasks[7].content).toBe('checklistCancelled')
    })
  })
})
