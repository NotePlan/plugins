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

  describe('blockHasTaskOrChecklistParagraphs()', () => {
    test('returns false when block contains only notes, bullets, and quotes', () => {
      const block = [
        { type: 'title', content: 'Notes Section', headingLevel: 2 },
        { type: 'text', content: 'Some notes' },
        { type: 'list', content: 'bullet item' },
        { type: 'quote', content: 'quoted text' },
      ]
      expect(m.blockHasTaskOrChecklistParagraphs(block)).toBe(false)
    })

    test('returns true when block contains a completed task', () => {
      const block = [
        { type: 'title', content: 'Task Section', headingLevel: 2 },
        { type: 'text', content: 'Some notes' },
        { type: 'done', content: 'Done task' },
      ]
      expect(m.blockHasTaskOrChecklistParagraphs(block)).toBe(true)
    })
  })

  describe('buildInsertLinesFromParas()', () => {
    test('preserves raw markers/indentation and inserts every line as type text (no double markers)', () => {
      const paras = [
        { type: 'done', content: 'Task B1', rawContent: '* [x] Task B1', indents: 0 },
        { type: 'cancelled', content: 'Task B2', rawContent: '* [-] Task B2', indents: 0 },
        { type: 'list', content: 'bullet', rawContent: '- bullet', indents: 0 },
        { type: 'quote', content: 'quote', rawContent: '> quote', indents: 0 },
        { type: 'text', content: 'Child note', rawContent: '\tChild note', indents: 1 },
      ]
      const { linesToInsert, paraTypesToInsert } = m.buildInsertLinesFromParas(paras)

      // Raw markers and indentation are preserved exactly once
      expect(linesToInsert).toEqual(['* [x] Task B1', '* [-] Task B2', '- bullet', '> quote', '\tChild note'])
      // Every line is inserted as 'text' so NotePlan does not re-add a type marker
      expect(paraTypesToInsert).toEqual(['text', 'text', 'text', 'text', 'text'])
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

    test('reuses existing Done section when it immediately follows the note title (lineIndex 1)', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'title', content: 'Done', rawContent: '## Done', indents: 0, headingLevel: 2 },
          { lineIndex: 2, type: 'done', content: 'Old done task', rawContent: '* [x] Old done task', indents: 0, headingLevel: 0 },
          { lineIndex: 3, type: 'done', content: 'New done task', rawContent: '* [x] New done task', indents: 0, headingLevel: 0 },
        ],
      })

      const doneIndex = m.getOrCreateNamedDoneSection(note, 'Done')

      expect(doneIndex).toBe(1)
      const doneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeadings.length).toBe(1)
    })

    test('reuses existing Done section with NotePlan folded heading (Done …)', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'open', content: 'Open task', rawContent: '* [ ] Open task', indents: 0, headingLevel: 0 },
          { lineIndex: 2, type: 'title', content: 'Done …', rawContent: '## Done …', indents: 0, headingLevel: 2 },
          { lineIndex: 3, type: 'done', content: 'Old done task', rawContent: '* [x] Old done task', indents: 0, headingLevel: 0 },
        ],
      })

      const doneIndex = m.getOrCreateNamedDoneSection(note, 'Done')

      expect(doneIndex).toBe(2)
      const doneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && (p.content.trim() === 'Done' || p.content.trim() === 'Done …'),
      )
      expect(doneHeadings.length).toBe(1)
    })

    test('reuses existing folded Done section with trailing three dots (Done ...)', () => {
      const paragraphs = [
        { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
        { lineIndex: 1, type: 'open', content: 'Open task', rawContent: '* [ ] Open task', indents: 0, headingLevel: 0 },
      ]
      for (let i = 2; i < 100; i++) {
        paragraphs.push({ lineIndex: i, type: 'text', content: `filler ${i}`, rawContent: `filler ${i}`, indents: 0, headingLevel: 0 })
      }
      paragraphs.push(
        { lineIndex: 100, type: 'title', content: 'Done ...', rawContent: '## Done ...', indents: 0, headingLevel: 2 },
        { lineIndex: 101, type: 'done', content: 'Old done task', rawContent: '* [x] Old done task', indents: 0, headingLevel: 0 },
      )
      const note = new Note({ paragraphs })

      const doneIndex = m.getOrCreateNamedDoneSection(note, 'Done')

      expect(doneIndex).toBe(100)
      const exactDoneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(exactDoneHeadings.length).toBe(0)
      const foldedDoneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done ...',
      )
      expect(foldedDoneHeadings.length).toBe(1)
    })
  })

  describe('moveCompletedToDone', () => {
    // ----------------------------------------------------------------------------
    // @param {TNote} note
    // @param {boolean} recreateDoneSectionStructure
    // @param {boolean} onlyMoveCompletedWhenWholeSectionComplete
    // @param {boolean} skipDoneSubtasksUnderOpenTasks
    // ----------------------------------------------------------------------------
    test('does not create duplicate Done section when folded Done ... already exists', () => {
      const paragraphs = [
        { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
        { type: 'open', content: 'Open task', lineIndex: 1, rawContent: '* [ ] Open task', indents: 0, headingLevel: 0 },
        { type: 'done', content: 'New done task', lineIndex: 2, rawContent: '* [x] New done task', indents: 0, headingLevel: 0 },
      ]
      for (let i = 3; i < 100; i++) {
        paragraphs.push({ type: 'text', content: `filler ${i}`, lineIndex: i, rawContent: `filler ${i}`, indents: 0, headingLevel: 0 })
      }
      paragraphs.push(
        { type: 'title', content: 'Done ...', lineIndex: 100, rawContent: '## Done ...', indents: 0, headingLevel: 2 },
        { type: 'done', content: 'Old done task', lineIndex: 101, rawContent: '* [x] Old done task', indents: 0, headingLevel: 0 },
      )
      const note = new Note({ paragraphs })

      m.moveCompletedItemsToDoneSection(note, false, false, false)

      const exactDoneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(exactDoneHeadings.length).toBe(0)
      const foldedDoneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done ...',
      )
      expect(foldedDoneHeadings.length).toBe(1)

      const doneIndex = note.paragraphs.indexOf(foldedDoneHeadings[0])
      const openTaskIndex = note.paragraphs.findIndex((p) => p.content === 'Open task')
      const oldTaskIndex = note.paragraphs.findIndex((p) => p.content === 'Old done task')
      const newTaskIndex = note.paragraphs.findIndex((p) => p.content === 'New done task')
      expect(openTaskIndex).toBeLessThan(doneIndex)
      expect(oldTaskIndex).toBeGreaterThan(doneIndex)
      expect(newTaskIndex).toBeGreaterThan(doneIndex)
      expect(newTaskIndex).toBeGreaterThan(oldTaskIndex)
    })

    test('does not create duplicate Done section when one already exists at lineIndex 1', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Done', lineIndex: 1, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Old done task', lineIndex: 2, rawContent: '* [x] Old done task', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Active Section', lineIndex: 3, rawContent: '## Active Section', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'New done task', lineIndex: 4, rawContent: '* [x] New done task', indents: 0, headingLevel: 0 },
        ],
      })
      m.moveCompletedItemsToDoneSection(note, false, false, false)

      const doneHeadings = note.paragraphs.filter(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeadings.length).toBe(1)

      const doneIndex = note.paragraphs.indexOf(doneHeadings[0])
      const oldTaskIndex = note.paragraphs.findIndex((p) => p.content === 'Old done task')
      const newTaskIndex = note.paragraphs.findIndex((p) => p.content === 'New done task')
      expect(oldTaskIndex).toBeGreaterThan(doneIndex)
      expect(newTaskIndex).toBeGreaterThan(oldTaskIndex)
    })

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

      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()
      const doneIndex = note.paragraphs.indexOf(doneHeading)

      const taskA1 = note.paragraphs.find((p) => p.rawContent === '* [x] Task A1')
      const taskA2 = note.paragraphs.find((p) => p.rawContent === '* [ ] Task A2')
      const sectionAInActive = note.paragraphs.find(
        (p, i) => i < doneIndex && p.type === 'title' && p.content.trim() === 'Section A',
      )
      expect(taskA1).toBeDefined()
      expect(taskA2).toBeDefined()
      expect(sectionAInActive).toBeDefined()

      const sectionBInActive = note.paragraphs.find(
        (p, i) => i < doneIndex && p.type === 'title' && p.content.trim() === 'Section B',
      )
      expect(sectionBInActive).toBeUndefined()

      const sectionBInDone = note.paragraphs.find(
        (p, i) => i > doneIndex && p.type === 'title' && p.content.trim() === 'Section B',
      )
      expect(sectionBInDone).toBeDefined()
      const taskB1InDone = note.paragraphs.find((p) => p.content === 'Task B1')
      expect(taskB1InDone).toBeDefined()
      expect(note.paragraphs.indexOf(taskB1InDone)).toBeGreaterThan(note.paragraphs.indexOf(sectionBInDone))
    })

    test('when whole section is complete, moves section heading and non-task lines with the section', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section B', lineIndex: 1, rawContent: '## Section B', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Section notes', lineIndex: 2, rawContent: 'Section notes', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 3, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'cancelled', content: 'Task B2', lineIndex: 4, rawContent: '* [-] Task B2', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()
      const doneIndex = note.paragraphs.indexOf(doneHeading)

      const sectionBInActive = note.paragraphs.find(
        (p, i) => i < doneIndex && p.type === 'title' && p.content.trim() === 'Section B',
      )
      expect(sectionBInActive).toBeUndefined()

      const sectionBInDone = note.paragraphs.find(
        (p, i) => i > doneIndex && p.type === 'title' && p.content.trim() === 'Section B',
      )
      expect(sectionBInDone).toBeDefined()

      const notesInDone = note.paragraphs.find(
        (p, i) => i > doneIndex && p.content === 'Section notes',
      )
      expect(notesInDone).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'Task B1')).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'Task B2')).toBeDefined()

      // TEST: test by @jgclark, not @Cursor
      const expectedNoteAfterMove = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Done', lineIndex: 1, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Section B', lineIndex: 2, rawContent: '### Section B', indents: 0, headingLevel: 3 },
          { type: 'text', content: 'Section notes', lineIndex: 3, rawContent: 'Section notes', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 4, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'cancelled', content: 'Task B2', lineIndex: 5, rawContent: '* [-] Task B2', indents: 0, headingLevel: 0 },
        ],
      })

      expect(note).toEqual(expectedNoteAfterMove)
    })

    // TEST: test by @jgclark, not @Cursor
    test('merges whole section into existing Done subsection with same heading', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section B', lineIndex: 1, rawContent: '## Section B', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Section notes', lineIndex: 2, rawContent: 'Section notes', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 3, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'cancelled', content: 'Task B2', lineIndex: 4, rawContent: '* [-] Task B2', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Done', lineIndex: 5, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Section B', lineIndex: 6, rawContent: '### Section B', indents: 0, headingLevel: 3 },
          { type: 'done', content: 'Some other done task', lineIndex: 7, rawContent: '* [x] Some other done task', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      const expectedNoteAfterMove = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Done', lineIndex: 1, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Section B', lineIndex: 2, rawContent: '### Section B', indents: 0, headingLevel: 3 },
          { type: 'text', content: 'Section notes', lineIndex: 3, rawContent: 'Section notes', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Some other done task', lineIndex: 4, rawContent: '* [x] Some other done task', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 5, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'cancelled', content: 'Task B2', lineIndex: 6, rawContent: '* [-] Task B2', indents: 0, headingLevel: 0 },
        ],
      })

      expect(note).toEqual(expectedNoteAfterMove)
    })

    // TEST: regression for stray blank lines when merging a whole section into an existing
    // Done subsection where both the moved section and the existing subsection end in a blank line.
    test('on merge, does not introduce blank lines into the Done subsection', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Project Beta', lineIndex: 1, rawContent: '## Project Beta', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Book venue', lineIndex: 2, rawContent: '* [x] Book venue', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Send invitations', lineIndex: 3, rawContent: '* [x] Send invitations', indents: 0, headingLevel: 0 },
          { type: 'checklistDone', content: 'design the invite', lineIndex: 4, rawContent: '\t+ [x] design the invite', indents: 1, headingLevel: 0 },
          { type: 'checklistDone', content: 'export mailing list', lineIndex: 5, rawContent: '\t+ [x] export mailing list', indents: 1, headingLevel: 0 },
          { type: 'cancelled', content: 'Cancel backup venue', lineIndex: 6, rawContent: '* [-] Cancel backup venue', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'this was no longer needed', lineIndex: 7, rawContent: '\tthis was no longer needed', indents: 1, headingLevel: 0 },
          { type: 'empty', content: '', lineIndex: 8, rawContent: '', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Done', lineIndex: 9, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Project Beta', lineIndex: 10, rawContent: '### Project Beta', indents: 0, headingLevel: 3 },
          { type: 'done', content: 'Draft the budget', lineIndex: 11, rawContent: '* [x] Draft the budget', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Earlier completed admin task', lineIndex: 12, rawContent: '* [x] Earlier completed admin task', indents: 0, headingLevel: 0 },
          { type: 'empty', content: '', lineIndex: 13, rawContent: '', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      const subheadingIndex = note.paragraphs.findIndex((p) => p.type === 'title' && p.headingLevel === 3 && p.content.trim() === 'Project Beta')
      expect(subheadingIndex).toBeGreaterThan(-1)
      const lastTaskIndex = note.paragraphs.findIndex((p) => p.content === 'this was no longer needed')
      expect(lastTaskIndex).toBeGreaterThan(subheadingIndex)

      // No blank line should appear between the subheading and its last archived line
      const between = note.paragraphs.slice(subheadingIndex + 1, lastTaskIndex + 1)
      const blanksBetween = between.filter((p) => (p.rawContent ?? p.content ?? '').trim() === '')
      expect(blanksBetween.length).toBe(0)

      // Items appear in order: existing items first, then the merged ones
      const order = between.map((p) => p.content)
      expect(order).toEqual([
        'Draft the budget',
        'Earlier completed admin task',
        'Book venue',
        'Send invitations',
        'design the invite',
        'export mailing list',
        'Cancel backup venue',
        'this was no longer needed',
      ])

      // The original active section was removed entirely
      const activeProjectBeta = note.paragraphs.find((p, i) => i < subheadingIndex && p.type === 'title' && p.content.trim() === 'Project Beta')
      expect(activeProjectBeta).toBeUndefined()
    })

    test('on merge, keeps a note indented under a task with its task, and only top-level notes go under the heading', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Section B', lineIndex: 1, rawContent: '## Section B', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Top-level note', lineIndex: 2, rawContent: 'Top-level note', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 3, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'Child note', lineIndex: 4, rawContent: '\tChild note', indents: 1, headingLevel: 0 },
          { type: 'title', content: 'Done', lineIndex: 5, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Section B', lineIndex: 6, rawContent: '### Section B', indents: 0, headingLevel: 3 },
          { type: 'done', content: 'Some other done task', lineIndex: 7, rawContent: '* [x] Some other done task', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      const expectedNoteAfterMove = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Done', lineIndex: 1, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Section B', lineIndex: 2, rawContent: '### Section B', indents: 0, headingLevel: 3 },
          { type: 'text', content: 'Top-level note', lineIndex: 3, rawContent: 'Top-level note', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Some other done task', lineIndex: 4, rawContent: '* [x] Some other done task', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Task B1', lineIndex: 5, rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'Child note', lineIndex: 6, rawContent: '\tChild note', indents: 1, headingLevel: 0 },
        ],
      })

      expect(note).toEqual(expectedNoteAfterMove)
    })

    test('does not archive notes-only section when whole-section mode is enabled', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Notes Section', lineIndex: 1, rawContent: '## Notes Section', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Some notes', lineIndex: 2, rawContent: 'Some notes', indents: 0, headingLevel: 0 },
          { type: 'list', content: 'bullet item', lineIndex: 3, rawContent: '- bullet item', indents: 0, headingLevel: 0 },
          { type: 'quote', content: 'quoted text', lineIndex: 4, rawContent: '> quoted text', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Task Section', lineIndex: 5, rawContent: '## Task Section', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Done task', lineIndex: 6, rawContent: '* [x] Done task', indents: 0, headingLevel: 0 },
        ],
      })

      const result = m.moveCompletedItemsToDoneSection(note, false, true, false)

      expect(result).toBe(true)

      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done',
      )
      expect(doneHeading).toBeDefined()
      const doneIndex = note.paragraphs.indexOf(doneHeading)

      const notesSectionInActive = note.paragraphs.find(
        (p, i) => i < doneIndex && p.type === 'title' && p.content.trim() === 'Notes Section',
      )
      expect(notesSectionInActive).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'Some notes')).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'bullet item')).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'quoted text')).toBeDefined()

      const taskSectionInDone = note.paragraphs.find(
        (p, i) => i > doneIndex && p.type === 'title' && p.content.trim() === 'Task Section',
      )
      expect(taskSectionInDone).toBeDefined()
      expect(note.paragraphs.find((p) => p.content === 'Done task')).toBeDefined()
    })

    test('logs when skipping notes-only section in whole-section mode', () => {
      const logSpy = jest.spyOn(require('@helpers/dev'), 'logInfo')
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Notes Section', lineIndex: 1, rawContent: '## Notes Section', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Some notes', lineIndex: 2, rawContent: 'Some notes', indents: 0, headingLevel: 0 },
          { type: 'title', content: 'Task Section', lineIndex: 3, rawContent: '## Task Section', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Done task', lineIndex: 4, rawContent: '* [x] Done task', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, false, true, false)

      expect(logSpy).toHaveBeenCalledWith(
        'moveCompletedToDone',
        "Skipping section 'Notes Section': section contains no task/checklist paragraphs (only notes/bullets/quotes).",
      )
      logSpy.mockRestore()
    })

    test('does not create Done section when note has only a notes-only section', () => {
      const logSpy = jest.spyOn(require('@helpers/dev'), 'logInfo')
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Notes Section', lineIndex: 1, rawContent: '## Notes Section', indents: 0, headingLevel: 2 },
          { type: 'text', content: 'Some notes', lineIndex: 2, rawContent: 'Some notes', indents: 0, headingLevel: 0 },
          { type: 'list', content: 'bullet item', lineIndex: 3, rawContent: '- bullet item', indents: 0, headingLevel: 0 },
        ],
      })

      const result = m.moveCompletedItemsToDoneSection(note, false, true, false)

      expect(result).toBe(false)
      const doneHeading = note.paragraphs.find(
        (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim().startsWith('Done'),
      )
      expect(doneHeading).toBeUndefined()
      expect(logSpy).toHaveBeenCalledWith(
        'moveCompletedToDone',
        "Skipping section 'Notes Section': section contains no task/checklist paragraphs (only notes/bullets/quotes).",
      )
      logSpy.mockRestore()
    })

    test('when whole section is complete with recreateDoneSectionStructure, does not duplicate the moved section heading', () => {
      const note = new Note({
        paragraphs: [
          { lineIndex: 0, type: 'title', content: 'Test Note', rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { lineIndex: 1, type: 'title', content: 'Section B', rawContent: '## Section B', indents: 0, headingLevel: 2 },
          { lineIndex: 2, type: 'done', content: 'Task B1', rawContent: '* [x] Task B1', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, true, true, false)

      const sectionBCopies = note.paragraphs.filter(
        (p) => p.type === 'title' && p.content.trim() === 'Section B',
      )
      expect(sectionBCopies.length).toBe(1)
    })

    // TEST: regression for 'Move any complete' mode where a whole section happens to be complete.
    // The emptied section heading should be removed from the active part, and items should reuse the
    // existing H3 sub-heading in Done rather than creating a new (deeper) H4 heading.
    test('in move-any mode, removes the emptied section heading and reuses the existing H3 Done sub-heading', () => {
      const note = new Note({
        paragraphs: [
          { type: 'title', content: 'Test Note', lineIndex: 0, rawContent: '# Test Note', indents: 0, headingLevel: 1 },
          { type: 'title', content: 'Project Beta', lineIndex: 1, rawContent: '## Project Beta', indents: 0, headingLevel: 2 },
          { type: 'done', content: 'Book venue', lineIndex: 2, rawContent: '* [x] Book venue', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Send invitations', lineIndex: 3, rawContent: '* [x] Send invitations', indents: 0, headingLevel: 0 },
          { type: 'checklistDone', content: 'design the invite', lineIndex: 4, rawContent: '\t+ [x] design the invite', indents: 1, headingLevel: 0 },
          { type: 'checklistDone', content: 'export mailing list', lineIndex: 5, rawContent: '\t+ [x] export mailing list', indents: 1, headingLevel: 0 },
          { type: 'cancelled', content: 'Cancel backup venue', lineIndex: 6, rawContent: '* [-] Cancel backup venue', indents: 0, headingLevel: 0 },
          { type: 'text', content: 'this was no longer needed', lineIndex: 7, rawContent: '\tthis was no longer needed', indents: 1, headingLevel: 0 },
          { type: 'title', content: 'Done', lineIndex: 8, rawContent: '## Done', indents: 0, headingLevel: 2 },
          { type: 'title', content: 'Project Beta', lineIndex: 9, rawContent: '### Project Beta', indents: 0, headingLevel: 3 },
          { type: 'done', content: 'Draft the budget', lineIndex: 10, rawContent: '* [x] Draft the budget', indents: 0, headingLevel: 0 },
          { type: 'done', content: 'Earlier completed admin task', lineIndex: 11, rawContent: '* [x] Earlier completed admin task', indents: 0, headingLevel: 0 },
        ],
      })

      m.moveCompletedItemsToDoneSection(note, true, false, false)

      const doneIndex = note.paragraphs.findIndex((p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === 'Done')
      expect(doneIndex).toBeGreaterThan(-1)

      // The emptied '## Project Beta' heading should no longer exist in the active part
      const activeProjectBeta = note.paragraphs.find((p, i) => i < doneIndex && p.type === 'title' && p.content.trim() === 'Project Beta')
      expect(activeProjectBeta).toBeUndefined()

      // There should be exactly one 'Project Beta' heading, and it should be the existing H3 one (no new H4)
      const projectBetaHeadings = note.paragraphs.filter((p) => p.type === 'title' && p.content.trim() === 'Project Beta')
      expect(projectBetaHeadings.length).toBe(1)
      expect(projectBetaHeadings[0].headingLevel).toBe(3)
      expect(note.paragraphs.some((p) => p.type === 'title' && p.headingLevel === 4)).toBe(false)

      // All items appear in order under the reused H3 sub-heading
      const subIndex = note.paragraphs.indexOf(projectBetaHeadings[0])
      const order = note.paragraphs.slice(subIndex + 1).map((p) => p.content)
      expect(order).toEqual([
        'Draft the budget',
        'Earlier completed admin task',
        'Book venue',
        'Send invitations',
        'design the invite',
        'export mailing list',
        'Cancel backup venue',
        'this was no longer needed',
      ])
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
          i > doneIndex && p.type === 'title' && p.headingLevel === 3 && p.content.trim() === 'Section A',
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
