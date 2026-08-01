/* global describe, test, expect, beforeAll */

import * as f from '../src/NPTaskScanAndProcess'
import {
  handleEditAction,
  handleTypeAction,
  handleRemoveAction,
  handlePriorityAction,
  handleDeleteAction,
  handleTodayAction,
  handleOpenTaskAction,
  handleArrowDatesAction,
  CONTINUE,
  CANCEL,
  SEE_TASK_AGAIN,
} from '../src/NPTaskScanAndProcess'

import { DataStore, CommandBar, Editor, Note } from '@mocks/index'

const PLUGIN_NAME = `dwertheimer.TaskAutomations`
const FILENAME = `NPTaskScanAndProcess`

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.CommandBar = CommandBar // so we see DEBUG logs in VSCode Jest debugs
  global.Editor = Editor // so we see DEBUG logs in VSCode Jest debugs
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    //functions go here using jfunc command
    /*
     * processUserAction()
     */
    describe('processUserAction()' /* function */, () => {
      test('should return CANCEL on unknown choice', async () => {
        const choice = { label: 'unknown', value: 'unknown' }
        const result = await f.processUserAction({}, choice)
        expect(result).toEqual(CANCEL)
      })
    })

    /*
     * handleEditAction()
     */
    describe('handleEditAction()' /* function */, () => {
      test('should edit the task contents', async () => {
        // Mock the CommandBar.textPrompt function to return a specific value
        CommandBar.textPrompt = jest.fn().mockResolvedValue('new task content')

        const note = new Note()
        note.paragraphs = [{ content: 'old task content', note: note }]
        const result = await handleEditAction(note.paragraphs[0])
        expect(note.paragraphs[0].content).toEqual('new task content')
        expect(result).toEqual(CONTINUE)
      })
      test('should edit the task contents with a date', async () => {
        CommandBar.textPrompt = jest.fn().mockResolvedValue(false)
        const result = await handleEditAction({ content: 'old task content >2020-01-01' })
        expect(result).toEqual(-2)
      })
    })

    /*
     * handleTypeAction()
     */
    describe('handleTypeAction()' /* function */, () => {
      test('should change the type of the task', async () => {
        const before = { type: 'list', content: 'task content' }
        const updated = { type: 'checklist', content: 'task content' }
        const userChoice = '__checklist__'

        const result = await handleTypeAction(before, userChoice)

        expect(result).toEqual(CONTINUE)
        expect(before.type).toEqual(updated.type)
      })
    })

    /*
     * handleRemoveAction() ...
     */
    describe('handleRemoveAction()' /* function */, () => {
      test('should remove arrow date from the string', () => {
        const before = { content: '>2022-12-31 task content' }
        const result = handleRemoveAction(before)
        expect(result).toEqual(CONTINUE)
        expect(before.content).toEqual('task content')
      })
    })

    /*
     * handlePriorityAction()
     */
    describe('handlePriorityAction()' /* function */, () => {
      test('should change the priority of the task', () => {
        const before = { content: 'task content' }
        const userChoice = '__p1__'

        const result = handlePriorityAction(before, userChoice)
        expect(result).toEqual(SEE_TASK_AGAIN)
        expect(before.content).toEqual('! task content')
      })
    })

    /*
     * handleDeleteAction()
     */
    describe('handleDeleteAction()' /* function */, () => {
      test('should delete the task', () => {
        const before = { content: 'task content' }
        const result = handleDeleteAction(before)
        expect(result).toEqual(CONTINUE)
        // would need to use mocks to test the delete action
      })
    })

    /*
     * handleTodayAction()
     */
    describe('handleTodayAction()' /* function */, () => {
      test('should set the date to >today', () => {
        const before = { content: '>2022-12-31 task content' }
        const result = handleTodayAction(before)
        expect(result).toEqual(CONTINUE)
        expect(before.content).toEqual('task content >today')
      })
    })

    /*
     * handleOpenTaskAction()
     */
    describe('handleOpenTaskAction()' /* function */, () => {
      test('should open the note for this task', async () => {
        // Mock the Editor.openNoteByFilename function to return a specific value
        // Editor.openNoteByFilename = jest.fn().mockResolvedValue()

        const before = { note: { filename: 'note.md' }, content: 'task content' }
        const result = await handleOpenTaskAction(before)
        expect(result).toEqual(SEE_TASK_AGAIN)
      })
    })

    /*
     * handleArrowDatesAction()
     */
    describe('handleArrowDatesAction()' /* function */, () => {
      test("should change the date to the user's choice of >date", async () => {
        const note = new Note({ filename: 'folder/note.md', type: 'Notes' })
        const before = { content: '>2022-12-31 task content', type: 'open', note }
        const userChoice = '>2023-01-01'

        const result = await handleArrowDatesAction(before, userChoice)
        expect(result).toEqual(CONTINUE)
        expect(before.content).toEqual('task content >2023-01-01')
      })

      test('should leave the type alone for an item in a regular note (lite method)', async () => {
        const note = new Note({ filename: 'folder/note.md', type: 'Notes' })
        const before = { content: '>2022-12-31 task content', type: 'open', note }

        await handleArrowDatesAction(before, '>2023-01-01')
        expect(before.type).toEqual('open')
      })

      test('should leave the type alone in a calendar note when useLiteScheduleMethod is set', async () => {
        DataStore.settings = { ...DataStore.settings, useLiteScheduleMethod: true }
        const note = new Note({ filename: '20221231.md', type: 'Calendar' })
        const before = { content: '>2022-12-31 task content', type: 'open', note }

        await handleArrowDatesAction(before, '>2023-01-01')
        expect(before.content).toEqual('task content >2023-01-01')
        expect(before.type).toEqual('open')
        DataStore.settings = { ...DataStore.settings, useLiteScheduleMethod: false }
      })

      test("should mark a calendar note item scheduled and add a back-linked copy in the destination note (NotePlan's full method)", async () => {
        const originNote = new Note({ filename: '20221231.md', type: 'Calendar' })
        const destNote = new Note({ filename: '20230101.md', type: 'Calendar' })
        destNote.insertParagraph = jest.fn()
        DataStore.calendarNoteByDateString = jest.fn().mockReturnValue(destNote)
        const before = { content: '>2022-12-31 task content', type: 'open', note: originNote }

        const result = await handleArrowDatesAction(before, '>2023-01-01')
        expect(result).toEqual(CONTINUE)
        // original is marked [>] and points at the new date
        expect(before.content).toEqual('task content >2023-01-01')
        expect(before.type).toEqual('scheduled')
        // and a copy back-linking to the original date lands in the destination note
        expect(destNote.insertParagraph).toHaveBeenCalledWith('task content <2022-12-31', expect.any(Number), 'open')
      })

      test('should use checklistScheduled for a checklist item taking the full method', async () => {
        const originNote = new Note({ filename: '20221231.md', type: 'Calendar' })
        const destNote = new Note({ filename: '20230101.md', type: 'Calendar' })
        destNote.insertParagraph = jest.fn()
        DataStore.calendarNoteByDateString = jest.fn().mockReturnValue(destNote)
        const before = { content: '>2022-12-31 task content', type: 'checklist', note: originNote }

        await handleArrowDatesAction(before, '>2023-01-01')
        expect(before.type).toEqual('checklistScheduled')
      })
    })
  })
})
