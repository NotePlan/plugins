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
  describe('hasOpenParentTask()', () => {
    test('hasOpenParentTask returns true when subtask has open parent even with intermediate non-task lines', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
          { lineIndex: 2, type: 'text', content: 'Explanation', rawContent: '\tExplanation', indents: 1, headingLevel: 1 },
          { lineIndex: 3, type: 'done', content: 'Child done task', rawContent: '\t\t* [x] Child done task', indents: 2, headingLevel: 1 },
        ],
      })
      const childPara = note.paragraphs[3]
      const result = m.hasOpenParentTask(note, childPara)
      expect(result).toBe(true)
    })

    test('hasOpenParentTask returns false when closest ancestor task is closed', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'done', content: 'Parent done task', rawContent: '* [x] Parent done task', indents: 0, headingLevel: 1 },
          { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
        ],
      })
      const childPara = note.paragraphs[2]
      const result = m.hasOpenParentTask(note, childPara)
      expect(result).toBe(false)
    })
  })

  describe('getOrCreateNamedDoneSection()', () => {
    test('creates a Done section when none exists', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Task 1', rawContent: '* [ ] Task 1', indents: 0, headingLevel: 0 },
        ],
      })

      const lineIndex = m.getOrCreateNamedDoneSection(note, 'Done')

      const doneHeading = note.paragraphs[lineIndex]
      expect(doneHeading.type).toBe('title')
      expect(doneHeading.headingLevel).toBe(2)
      expect(doneHeading.content.trim()).toBe('Done')
    })

    test('reuses existing Done section after active part of note', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Task 1', rawContent: '* [ ] Task 1', indents: 0, headingLevel: 0 },
          { lineIndex: 2, type: 'title', content: 'Done', rawContent: '## Done', indents: 0, headingLevel: 2 },
        ],
      })

      const firstIndex = m.getOrCreateNamedDoneSection(note, 'Done')
      const secondIndex = m.getOrCreateNamedDoneSection(note, 'Done')

      expect(firstIndex).toBe(2)
      expect(secondIndex).toBe(2)
      // Ensure no duplicate Done heading was created
      const doneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeadings.length).toBe(1)
    })
  })

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
      m.moveCompletedItemsToDoneSection(note, false, false, false)
      // Ensure Done heading was created
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()

      // Ensure Task 2 remains in the main part of the note
      const task2 = note.paragraphs.find((p) => p.content === 'Task 2')
      expect(task2).toBeDefined()

      // Ensure Task 1 and its child line were moved into the Done section
      const doneIndex = note.paragraphs.indexOf(doneHeading)
      const movedTask1Index = note.paragraphs.findIndex(
        (p, i) => i > doneIndex && p.content === 'Task 1',
      )
      expect(movedTask1Index).toBeGreaterThan(doneIndex)
      const childLineIndex = note.paragraphs.findIndex(
        (p, i) => i > doneIndex && p.content === 'child of task 1',
      )
      expect(childLineIndex).toBeGreaterThan(movedTask1Index)
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
      m.moveCompletedItemsToDoneSection(note, false, false, false)
      // Ensure original section heading remains
      const sectionA = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Section A',
      )
      expect(sectionA).toBeDefined()

      // Ensure Done heading exists
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()

      // Ensure Task 2 is still under Section A (before Done)
      const sectionIndex = note.paragraphs.indexOf(sectionA)
      const doneIndex = note.paragraphs.indexOf(doneHeading)
      const task2Index = note.paragraphs.findIndex(
        (p, i) => i > sectionIndex && i < doneIndex && p.content === 'Task 2',
      )
      expect(task2Index).toBeGreaterThan(sectionIndex)
      expect(task2Index).toBeLessThan(doneIndex)

      // Ensure Task 1 and its child are now under Done
      const movedTask1Index = note.paragraphs.findIndex(
        (p, i) => i > doneIndex && p.content === 'Task 1',
      )
      expect(movedTask1Index).toBeGreaterThan(doneIndex)
      const childLineIndex = note.paragraphs.findIndex(
        (p, i) => i > doneIndex && p.content === 'child of task 1',
      )
      expect(childLineIndex).toBeGreaterThan(movedTask1Index)
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

      const taskB1InDone = note.paragraphs.find((p) => p.content === 'Task B1')
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
      m.moveCompletedItemsToDoneSection(note, true, false, false)
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()
      const doneIndex = note.paragraphs.indexOf(doneHeading)

      const sectionCopy = note.paragraphs.find(
        (p, i) =>
          i > doneIndex && p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Section A',
      )
      expect(sectionCopy).toBeDefined()

      const movedTaskA1 = note.paragraphs.find(
        (p, i) => i > doneIndex && p.content === 'Task A1',
      )
      const movedTaskA3 = note.paragraphs.find(
        (p, i) => i > doneIndex && p.content === 'Task A3',
      )
      expect(movedTaskA1).toBeDefined()
      expect(movedTaskA3).toBeDefined()
    })

    test('uses custom Done section heading name when provided', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'done', content: 'Task 1', rawContent: '* [x] Task 1', indents: 0, headingLevel: 0 },
        ],
      })
      m.moveCompletedItemsToDoneSection(note, false, false, false, 'Completed')
      const completedHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Completed',
      )
      expect(completedHeading).toBeDefined()
      const movedTask = note.paragraphs.find(
        (p, i) => i > note.paragraphs.indexOf(completedHeading) && p.content === 'Task 1',
      )
      expect(movedTask).toBeDefined()
    })

    test('when option is enabled, does not move completed subtask that is indented under an open parent task', () => {
      const note = new Note({
          paragraphs: [
            { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
            { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
            { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
          ],
        })
      m.moveCompletedItemsToDoneSection(note, false, false, true)
      // No Done heading created
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeading).toBeUndefined()
      // Parent and child still present
      const parent = note.paragraphs.find((p) => p.content === 'Parent task')
      const child = note.paragraphs.find((p) => p.content === 'Child done task')
      expect(parent).toBeDefined()
      expect(child).toBeDefined()
    })

    test('when option is not enabled, moves completed subtask that is indented under an open parent task', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
          { lineIndex: 2, type: 'done', content: 'Child done task', rawContent: '\t* [x] Child done task', indents: 1, headingLevel: 1 },
        ],
      })
      m.moveCompletedItemsToDoneSection(note, false, false, false)
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeading).toBeDefined()
      const doneIndex = note.paragraphs.indexOf(doneHeading)
      const movedChildIndex = note.paragraphs.findIndex(
        (p, i) => i > doneIndex && p.content === 'Child done task',
      )
      expect(movedChildIndex).toBeGreaterThan(doneIndex)
    })

    test('skipDoneSubtasksUnderOpenTasks treats subtasks as children even with intermediate non-task lines', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
          // explanatory text at a lower indent than the subtask but higher than the parent
          { lineIndex: 2, type: 'text', content: 'Explanation', rawContent: '\tExplanation', indents: 1, headingLevel: 1 },
          { lineIndex: 3, type: 'done', content: 'Child done task', rawContent: '\t\t* [x] Child done task', indents: 2, headingLevel: 1 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, true)

      // No Done section created
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeading).toBeUndefined()

      // Parent and child remain in place
      const parent = note.paragraphs.find((p) => p.rawContent === '* [ ] Parent task')
      const child = note.paragraphs.find((p) => p.rawContent === '\t\t* [x] Child done task')
      expect(parent).toBeDefined()
      expect(child).toBeDefined()
    })

    test('when skipDoneSubtasksUnderOpenTasks is false, moves subtask even with intermediate non-task lines', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Parent task', rawContent: '* [ ] Parent task', indents: 0, headingLevel: 1 },
          { lineIndex: 2, type: 'text', content: 'Explanation', rawContent: '\tExplanation', indents: 1, headingLevel: 1 },
          { lineIndex: 3, type: 'done', content: 'Child done task', rawContent: '\t\t* [x] Child done task', indents: 2, headingLevel: 1 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, false, false)

      const doneHeadingIndex = note.paragraphs.findIndex(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeadingIndex).toBeGreaterThan(-1)

      const childIndex = note.paragraphs.findIndex((p) => p.content === 'Child done task')
      expect(childIndex).toBeGreaterThan(doneHeadingIndex)

      const parent = note.paragraphs.find((p) => p.rawContent === '* [ ] Parent task')
      expect(parent).toBeDefined()
    })
  })
})
