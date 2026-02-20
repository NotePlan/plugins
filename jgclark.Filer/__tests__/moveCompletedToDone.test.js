/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console'
import * as m from '../src/moveCompletedToDone'
import { clo, JSP } from '@helpers/dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, simpleFormatter } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'none' // DEBUG or none
})

describe('jgclark.Filer', () => {
  describe('moveCompletedToDone', () => {
    // ----------------------------------------------------------------------------
    // @param {TNote} note
    // @param {boolean} recreateDoneSectionStructure
    // @param {boolean} onlyMoveCompletedWhenWholeSectionComplete
    // @param {boolean} skipDoneSubtasksUnderOpenTasks
    // ----------------------------------------------------------------------------
    test('creates Done section and moves a simple completed task with child line', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'done', content: 'Task 1', lineIndex: 1, rawContent: '* [x] Task 1', indents: 0, headingLevel: 1 },
          { type: 'text', content: 'child of task 1', lineIndex: 2, rawContent: '\tchild of task 1', indents: 1, headingLevel: 1 },
          { type: 'open', content: 'Task 2', lineIndex: 3, rawContent: '* [ ] Task 2', indents: 0, headingLevel: 1 },
        ],
      })
      const expectedNote = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'open', content: 'Task 2', lineIndex: 1, rawContent: '* [ ] Task 2', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Done', lineIndex: 2, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Task 1', lineIndex: 3, rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'child of task 1', lineIndex: 4, rawContent: '\tchild of task 1', indents: 1, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, false)
      expect(note.paragraphs).toEqual(expectedNote.paragraphs)
    })

    test('moves completed tasks with child line but does not recreate Done section structure', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section A', lineIndex: 1, rawContent: '## Section A', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Task 1', lineIndex: 2, rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'child of task 1', lineIndex: 3, rawContent: '\tchild of task 1', indents: 1, headingLevel: 0 },
          { type: 'open', content: 'Task 2', lineIndex: 4, rawContent: '* [ ] Task 2', indents: 0, headingLevel: 0 },
        ],
      })
      const expectedNote = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section A', lineIndex: 1, rawContent: '## Section A', indents: 0, headingLevel: 2 },
          { type: 'open', content: 'Task 2', lineIndex: 2, rawContent: '* [ ] Task 2', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Done', lineIndex: 3, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Task 1', lineIndex: 4, rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'child of task 1', lineIndex: 5, rawContent: '\tchild of task 1', indents: 1, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, false)
      expect(note.paragraphs).toEqual(expectedNote.paragraphs)
  })
    
    test('does not move completed task when it has an active child. Does not create a Done section.', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note' },
          { type: 'done', content: 'Task 1', lineIndex: 1, rawContent: '* [x] Task 1', indents: 0 },
          { type: 'open', content: 'child open task', lineIndex: 2, rawContent: '\t* [ ] child open task', indents: 1 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, false)

      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeading).toBeUndefined()

      const task1 = note.paragraphs.find((p) => p.rawContent === '* [x] Task 1')
      const child = note.paragraphs.find((p) => p.rawContent === '\t* [ ] child open task')
      expect(task1).toBeDefined()
      expect(child).toBeDefined()
    })

    test('only moves completed items when whole section is complete', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section A', lineIndex: 1, rawContent: '## Section A', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Task A1', lineIndex: 2, rawContent: '* [x] Task A1', indents: 0, headingLevel: 0 },
          { type: 'open', content: 'Task A2', lineIndex: 3, rawContent: '* [ ] Task A2', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Section B', lineIndex: 4, rawContent: '## Section B', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Task B1', lineIndex: 5, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      const taskA1 = note.paragraphs.find((p) => p.rawContent === '* [x] Task A1')
      const taskA2 = note.paragraphs.find((p) => p.rawContent === '* [ ] Task A2')
      expect(taskA1).toBeDefined()
      expect(taskA2).toBeDefined()

      const taskB1InDone = note.paragraphs.find((p) => p.rawContent === '* [x] Task B1')
      expect(taskB1InDone).toBeDefined()
    })

    test('recreates section structure under Done when option is enabled', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'title', content: 'Section A', rawContent: '## Section A', indents: 0, headingLevel: 2 },
          { lineIndex: 2, type: 'done', content: 'Task A1', rawContent: '* [x] Task A1', indents: 0, headingLevel: 0 },
          { lineIndex: 3, type: 'open', content: 'Task A2', rawContent: '* [ ] Task A2', indents: 0, headingLevel: 0 },
          { lineIndex: 4, type: 'done', content: 'Task A3', rawContent: '* [x] Task A3', indents: 0, headingLevel: 0 },
        ],
      })
      const expectedNote = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note' , rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'title', content: 'Section A', rawContent: '## Section A', indents: 0, headingLevel: 2 },
          { lineIndex: 2, type: 'open', content: 'Task A2', rawContent: '* [ ] Task A2', indents: 0, headingLevel: 0 },
          { lineIndex: 3, type: 'title', content: 'Done', rawContent: '## Done', indents: 0, headingLevel: 2 },
          { lineIndex: 4, type: 'title', content: 'Section A', rawContent: '### Section A', indents: 0, headingLevel: 3 },
          { lineIndex: 5, type: 'done', content: 'Task A1', rawContent: '* [x] Task A1', indents: 0, headingLevel: 0 },
          { lineIndex: 6, type: 'done', content: 'Task A3', rawContent: '* [x] Task A3', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, true, false, false)
      expect(note.paragraphs).toEqual(expectedNote.paragraphs)
    })

    test('uses custom Done section heading name when provided', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'done', content: 'Task 1', rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
        ],
      })
      const expectedNote = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'title', content: 'Completed', rawContent: '## Completed', indents: 0, headingLevel: 2 },
          { lineIndex: 2, type: 'done', content: 'Task 1', rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, false, 'Completed')
      expect(note.paragraphs).toEqual(expectedNote.paragraphs)
    })

    test('when option is enabled, does not move completed subtask that is indented under an open parent task', () => {
      const note = new Note({
          paragraphs: [
            { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
            { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
            { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
          ],
        })
        const expectedNoteParas = [
            { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
            { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
            { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
          ]
      m.moveCompletedItemsToDoneSection(note, false, false, true)
      expect(note.paragraphs).toEqual(expectedNoteParas)
    })

    test('when option is not enabled, moves completed subtask that is indented under an open parent task', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
          { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
        ],
      })
      const expectedNoteParas = [
        { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
        { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
        { lineIndex: 2, type: 'title', content: 'Done', rawContent: '## Done', indents: 0, headingLevel: 2 },
        { lineIndex: 3, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 0 },
      ]
      m.moveCompletedItemsToDoneSection(note, false, false, false)
      expect(note.paragraphs).toEqual(expectedNoteParas)
    })
  })
})
