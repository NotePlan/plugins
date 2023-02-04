/* global describe, expect, test, beforeAll, beforeEach, afterAll */
import { CustomConsole } from '@jest/console' // see note below
import * as p from '../NPParagraph'
import { clo, logDebug, logInfo } from '../dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.Note = Note
  global.Paragraph = Paragraph
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging | none for quiet
})

// mimicking a project note
let paragraphs = [
  new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
  new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
  new Paragraph({ type: 'text', content: 'line 3 (child of 2)', headingLevel: 1, indents: 1, lineIndex: 2 }),
  new Paragraph({ type: 'open', content: 'task on line 4', headingLevel: 1, indents: 0, lineIndex: 3 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 4 }),
  new Paragraph({ type: 'separator', content: '---', lineIndex: 5 }),
  new Paragraph({ type: 'title', content: 'Done', headingLevel: 2, indents: 0, lineIndex: 6 }),
  new Paragraph({ type: 'done', content: 'done task on line 7', headingLevel: 2, indents: 0, lineIndex: 7 }),
  new Paragraph({ type: 'done', content: 'done task on line 8', headingLevel: 2, indents: 0, lineIndex: 8 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 2, indents: 0, lineIndex: 9 }),
  new Paragraph({ type: 'title', content: 'Cancelled', headingLevel: 2, indents: 0, lineIndex: 10 }),
  new Paragraph({ type: 'cancelled', content: 'cancelled task under Cancelled', headingLevel: 2, indents: 0, lineIndex: 11 }),
  new Paragraph({ type: 'text', content: 'line under Cancelled', headingLevel: 2, indents: 0, lineIndex: 12 }),
  new Paragraph({ type: 'empty', content: '', headingLevel: 2, indents: 0, lineIndex: 13 }),
]
Editor.note = new Note({ paragraphs, type: 'Notes' })
// Note: This used to be set in a
//   beforeEach(() => {
//     ...
//   })
// block, but now need to override it for some tests.

describe('NPParagraphs()', () => {
  /*
   * findHeading()
   */
  describe('findHeading()' /* function */, () => {
    test('should return null if no heading', () => {
      const result = p.findHeading(Editor.note, '')
      expect(result).toEqual(null)
    })
    test('should return null when not matched', () => {
      const result = p.findHeading(Editor.note, 'NoTitleMatch')
      expect(result).toEqual(null)
    })
    test('should return a paragraph when fully matched', () => {
      const result = p.findHeading(Editor.note, 'theTitle')
      expect(result?.content).toEqual(`theTitle`)
    })
    test('should return null on partial match in middle with includesString false', () => {
      const result = p.findHeading(Editor.note, 'eTit', false)
      expect(result).toEqual(null)
    })
    test('should return partial match in middle with includesString true', () => {
      const result = p.findHeading(Editor.note, 'eTit', true)
      expect(result?.content).toEqual('theTitle')
    })
  })

  /*
   * getBlockUnderHeading(). Parameters:
   * - note
   * - selectedParaIndex
   * - includeFromStartOfSection
   * - useTightBlockDefinition
   */
  describe('getParagraphBlock() for project note' /* function */, () => {
    // Skip this set until it's clearer what the most sensible answers are
    // for asking block from title onwards in a regular note
    test.skip('should return block lineIndex 0-4 from 0/false/false', () => {
      const result = p.getParagraphBlock(Editor.note, 0, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    })
    test.skip('should return block lineIndex 0-3 from 0/false/true', () => {
      const result = p.getParagraphBlock(Editor.note, 0, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })
    test.skip('should return block lineIndex 0-4 from 0/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 0, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    })
    test.skip('should return block lineIndex 0-3 from 0/true/true', () => {
      const result = p.getParagraphBlock(Editor.note, 0, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })

    test('should return block lineIndex 1-5 from 1/false/false', () => {
      const result = p.getParagraphBlock(Editor.note, 1, false, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB1', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 1/false/true', () => {
      const result = p.getParagraphBlock(Editor.note, 1, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
    test('should return block lineIndex 1-5 from 1/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 1, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB2', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 1/true/true', () => {
      const result = p.getParagraphBlock(Editor.note, 1, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })

    test('should return block lineIndex 2 from 2/false/false', () => {
      const result = p.getParagraphBlock(Editor.note, 2, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
    })
    test('should return block lineIndex 2 from 2/false/true', () => {
      const result = p.getParagraphBlock(Editor.note, 2, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
    })
    test('should return block lineIndex 0-5 from 2/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 2, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB3', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 2/true/true', () => {
      const result = p.getParagraphBlock(Editor.note, 2, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
    test('should return block lineIndex 6-9 from 7/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 7, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 10))
    })
    test('should return block lineIndex 6-8 from 7/true/true', () => {
      const result = p.getParagraphBlock(Editor.note, 7, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 9))
    })
    test('should return block lineIndex 11-13 from 11/false/false', () => {
      const result = p.getParagraphBlock(Editor.note, 11, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(11, 14))
    })
    test('should return block lineIndex 11-12 from 11/false/true', () => {
      const result = p.getParagraphBlock(Editor.note, 11, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(11, 13))
    })
    test('should return block lineIndex 10-13 (section "Cancelled") from 12/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 12, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(10, 14))
    })
    test('should return block lineIndex 10-12 (section "Cancelled") from 10/true/false', () => {
      const result = p.getParagraphBlock(Editor.note, 10, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(10, 13))
    })
    test('should return block lineIndex 13 from 13/false/true', () => {
      const result = p.getParagraphBlock(Editor.note, 13, false, true)
      const firstIndex = result[0].lineIndex
      const lastIndex = firstIndex + result.length - 1
      logDebug('testGPB6', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(13, 14))
    })
  })

  // Test as if a calendar note (no title)
  /*
   * getBlockUnderHeading(). Parameters:
   * - note
   * - selectedParaIndex
   * - includeFromStartOfSection
   * - useTightBlockDefinition
   */
  // similar to above, but mimicking a calendar note
  describe('getParagraphBlock() for calendar note' /* function */, () => {
    beforeEach(() => {
      paragraphs = [
        new Paragraph({ type: 'text', content: 'line 1 (not title)', headingLevel: 0, indents: 0, lineIndex: 0 }),
        new Paragraph({ type: 'task', content: 'Task on line 2', headingLevel: 0, indents: 0, lineIndex: 1 }),
        new Paragraph({ type: 'text', content: 'line 3', headingLevel: 0, indents: 0, lineIndex: 2 }),
        new Paragraph({ type: 'text', content: 'task on line 4', headingLevel: 0, indents: 0, lineIndex: 3 }),
        new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 4 }),
        new Paragraph({ type: 'separator', content: '---', lineIndex: 5 }),
        new Paragraph({ type: 'title', content: 'Done', headingLevel: 2, indents: 0, lineIndex: 6 }),
      ]
      Editor.note = new Note({ paragraphs, type: 'Calendar' })
    })

    test('should return block lineIndex 0-3 from 2/true/true [for calendar note]', () => {
      const result = p.getParagraphBlock(Editor.note, 2, true, true)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB4', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })
    test('should return block lineIndex 0-5 from 2/true/false [for calendar note]', () => {
      const result = p.getParagraphBlock(Editor.note, 2, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB5', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 6))
    })
    test('should return block lineIndex 2-3 from 2/false/true [for calendar note]', () => {
      const result = p.getParagraphBlock(Editor.note, 2, false, true)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB5', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 4))
    })
    test('should return block lineIndex 2-5 from 2/false/false [for calendar note]', () => {
      const result = p.getParagraphBlock(Editor.note, 2, false, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB6', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 6))
    })
  })

  // dwertheimer 2023-02-03: commenting out for now, as it's causing a lot of tests to fail. if you see this in a month, delete it and the tests!
  /*
   * getOverdueParagraphs() - Commented out in code. Eventually delete these tests
   */
  describe.skip('getOverdueParagraphs()' /* function */, () => {
    describe('>ISODate date tests' /* function */, () => {
      test('should send back unchanged array when there is no date in type Calendar', () => {
        const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result).toEqual([])
      })
      test('should send back empty array when there is no date in type Notes', () => {
        const note = { type: 'Notes', filename: 'foos.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result).toEqual([])
      })
      test('should send back empty array when there is no date in Weekly Note', () => {
        const note = { type: 'Calendar', filename: '2020-W20.md', datedTodos: [{ type: 'open', content: 'foo bar' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result).toEqual([])
      })
      test('should find a basic overdue date', () => {
        const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: 'foo bar >1999-01-01' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('foo bar')
      })
      test('should find a overdue date at start', () => {
        const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: '>1999-01-01 foo bar' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('foo bar')
      })
      test('should find a overdue date in middle', () => {
        const note = { type: 'Calendar', filename: '20201212.md', datedTodos: [{ type: 'open', content: ' foo >1999-01-01 bar ' }] }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('foo bar')
      })
      test('should find multiple dates in multiple notes', () => {
        const note = {
          type: 'Calendar',
          filename: '20201212.md',
          datedTodos: [
            { type: 'open', content: ' foo >1999-01-01 bar ' },
            { type: 'open', content: ' sam >2000-01-01 jaw ' },
          ],
        }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(2)
        expect(result[1].content).toEqual('sam jaw')
      })
      test('should ignore lines that are not open', () => {
        const note = {
          type: 'Calendar',
          filename: '20201212.md',
          datedTodos: [
            { type: 'open', content: ' foo >1999-01-01 bar ' },
            { type: 'done', content: ' sam >2000-01-01 jaw ' },
            { type: 'open', content: ' sam >2000-01-01 jaw ' },
          ],
        }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(2)
        expect(result[1].content).toEqual('sam jaw')
      })
    })
    // NOTE: weekly tests are in NPNote.test.js
    describe('Combined weekly and date tests' /* function */, () => {
      test('should find one date and one week overdue', () => {
        const note = {
          type: 'Calendar',
          filename: '20201212.md',
          datedTodos: [
            { type: 'open', content: ' foo >1999-01-01 bar ' },
            { type: 'open', content: ' sam >2000-W01 jaw ' },
          ],
        }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(2)
        expect(result[1].content).toEqual('sam jaw')
      })
      test('should find one week when one date is not overdue', () => {
        const note = {
          type: 'Calendar',
          filename: '20201212.md',
          datedTodos: [
            { type: 'open', content: ' foo >3000-01-01 bar ' },
            { type: 'open', content: ' sam >2000-W01 jaw ' },
          ],
        }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('sam jaw')
      })
      test('should find one date when one week is not overdue', () => {
        const note = {
          type: 'Calendar',
          filename: '20201212.md',
          datedTodos: [
            { type: 'open', content: ' foo >2000-01-01 bar ' },
            { type: 'open', content: ' sam >3000-W01 jaw ' },
          ],
        }
        const result = p.getOverdueParagraphs(note)
        expect(result.length).toEqual(1)
        expect(result[0].content).toEqual('foo bar')
      })
    })
  })

  /*
   * findOverdueWeeksInString()
   */
  describe('findOverdueWeeksInString()' /* function */, () => {
    test('should find no date in line with no date', () => {
      const result = p.findOverdueWeeksInString('no date here')
      expect(result.length).toEqual(0)
    })
    test('should find no date in line not overdue yet', () => {
      const result = p.findOverdueWeeksInString('>2922-W22')
      expect(result.length).toEqual(0)
    })
    test('should find date in line with overdue', () => {
      const result = p.findOverdueWeeksInString('>1999-W22')
      expect(result.length).toEqual(1)
      expect(result).toEqual(['>1999-W22'])
    })
    test('should find 2 overdue dates', () => {
      const result = p.findOverdueWeeksInString('>1999-W22 >2000-W22')
      expect(result.length).toEqual(2)
      expect(result[1]).toEqual('>2000-W22')
    })
  })

  /*
   * getBlockUnderHeading()
   */
  describe('getBlockUnderHeading()', () => {
    // mimicking a project note
    beforeEach(() => {
      const paragraphs = [
        new Paragraph({ type: 'title', content: 'theTitle', headingLevel: 1, indents: 0, lineIndex: 0 }),
        new Paragraph({ type: 'text', content: 'line 2', headingLevel: 1, indents: 0, lineIndex: 1 }),
        new Paragraph({ type: 'text', content: 'line 3 (child of 2)', headingLevel: 1, indents: 1, lineIndex: 2 }),
        new Paragraph({ type: 'text', content: 'task on line 4', headingLevel: 1, indents: 0, lineIndex: 3 }),
        new Paragraph({ type: 'empty', content: '', headingLevel: 1, indents: 0, lineIndex: 4 }),
        new Paragraph({ type: 'title', content: 'a Heading', headingLevel: 2, indents: 0, lineIndex: 5 }),
        new Paragraph({ type: 'text', content: 'line 2', headingLevel: 2, indents: 0, lineIndex: 6 }),
        new Paragraph({ type: 'text', content: 'line 3 (child of 2)', headingLevel: 2, indents: 1, lineIndex: 7 }),
        new Paragraph({ type: 'separator', content: '---', lineIndex: 8 }),
        new Paragraph({ type: 'title', content: 'Done', headingLevel: 2, indents: 0, lineIndex: 9 }),
      ]
      Editor.note = new Note({ paragraphs, type: 'Notes' })
    })
    test('should return block (with heading) when passed a heading string', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'a Heading', true)
      expect(result).toEqual(Editor.note.paragraphs.slice(5, 8))
    })
    test('should return block (without heading) when passed a heading string', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'a Heading', false)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 8))
    })
    test('should return block (with heading) when passed a heading paragraph', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'a Heading', true)
      expect(result).toEqual(Editor.note.paragraphs.slice(5, 8))
    })
    test('should return block (without heading) when passed a heading paragraph', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'a Heading', false)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 8))
    })

    // Skip this set until it's clearer what the most sensible answers are
    // for asking block from title onwards in a regular note

    test.skip('should return block (without title) when passed a title string (even when asking for heading)', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'theTitle', true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
    test('should return block (without title) when passed a title string', () => {
      const result = p.getBlockUnderHeading(Editor.note, 'theTitle', false)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
  })

  /*
   * hasOverdueWeekTag()
   */
  describe('hasOverdueDayTag()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return false if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.hasOverdueDayTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return false if has week tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999-01-01' }
      const result = p.hasOverdueDayTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should not return true if it is a scheduled tag', () => {
      const before = { content: 'This is a note with a tag not overdue <2000-01-01' }
      const result = p.hasOverdueDayTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return true if has week tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01' }
      const result = p.hasOverdueDayTag(before)
      expect(result).toEqual(true)
    })
    test('should return object if has week tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01' }
      const result = p.hasOverdueDayTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-01-01'] })
    })
    test('should work if there are two overdues (not really suggesting this use case)', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01 >2000-02-02' }
      const result = p.hasOverdueDayTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-01-01', '>2000-02-02'] })
    })
    test('should return partial overdues', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01 >2999-02-02' }
      const result = p.hasOverdueDayTag(before, true)
      expect(result).toEqual({ isOverdue: false, overdueStrings: ['>2000-01-01'] })
    })
  })

  /*
   * hasOverdueWeekTag()
   */
  describe('hasOverdueWeekTag()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return false if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.hasOverdueWeekTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return false if has week tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999-W01' }
      const result = p.hasOverdueWeekTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return true if has week tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01' }
      const result = p.hasOverdueWeekTag(before)
      expect(result).toEqual(true)
    })
    test('should return object if has week tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01' }
      const result = p.hasOverdueWeekTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-W01'] })
    })
    test('should work if there are two overdues (not really suggesting this use case)', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01 >2000-W02' }
      const result = p.hasOverdueWeekTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-W01', '>2000-W02'] })
    })
    test('should return partial overdues', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01 >2999-W02' }
      const result = p.hasOverdueWeekTag(before, true)
      expect(result).toEqual({ isOverdue: false, overdueStrings: ['>2000-W01'] })
    })
  })

  /*
   * hasOverdueMonthTag()
   */
  describe('hasOverdueMonthTag()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return false if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.hasOverdueMonthTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return false if has month tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999-01' }
      const result = p.hasOverdueMonthTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return true if has month tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01' }
      const result = p.hasOverdueMonthTag(before)
      expect(result).toEqual(true)
    })
    test('should return object if has month tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01' }
      const result = p.hasOverdueMonthTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-01'] })
    })
  })

  /*
   * hasOverdueQuarterTag()
   */
  describe('hasOverdueQuarterTag()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return false if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.hasOverdueQuarterTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return false if has quarter tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999-Q1' }
      const result = p.hasOverdueQuarterTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return true if has quarter tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-Q1' }
      const result = p.hasOverdueQuarterTag(before)
      expect(result).toEqual(true)
    })
    test('should return object if has quarter tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-Q1' }
      const result = p.hasOverdueQuarterTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000-Q1'] })
    })
  })

  /*
   * getOverdueTags()
   */
  describe('getOverdueTags()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return []] if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.getOverdueTags(before)
      const expected = []
      expect(result).toEqual(expected)
    })
    test('should return []] if has year tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999' }
      const result = p.getOverdueTags(before)
      const expected = []
      expect(result).toEqual(expected)
    })
    test('should return tag if has year tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000' }
      const result = p.getOverdueTags(before)
      expect(result).toEqual(['>2000'])
    })
    test('should return only one tag if only one is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000-Q1 >2999-Q1' }
      const result = p.getOverdueTags(before)
      expect(result).toEqual(['>2000-Q1'])
    })
    test('should return multiple tags', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01 >2000 >2000-01 >2000-Q1' }
      const result = p.getOverdueTags(before)
      expect(result).toEqual(['>2000-01-01', '>2000-01', '>2000-Q1', '>2000'])
    })
  })

  /*
   * hasOverdueYearTag()
   */
  describe('hasOverdueYearTag()' /* function */, () => {
    let dsb = global.DataStore
    beforeAll(() => {
      dsb = { ...global.DataStore }
      global.DataStore.defaultFileExtension = 'md'
    })
    afterAll(() => {
      global.DataStore = dsb
    })
    test('should return false if no matches', () => {
      const before = { content: 'This is a note with no tags' }
      const result = p.hasOverdueYearTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return false if has year tag but not overdue', () => {
      const before = { content: 'This is a note with a tag not overdue >2999' }
      const result = p.hasOverdueYearTag(before)
      const expected = false
      expect(result).toEqual(expected)
    })
    test('should return true if has year tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000' }
      const result = p.hasOverdueYearTag(before)
      expect(result).toEqual(true)
    })
    test('should return object if has year tag that is overdue', () => {
      const before = { content: 'This is a note with a tag overdue >2000' }
      const result = p.hasOverdueYearTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000'] })
    })
    test('should not confuse a year tag with another tag', () => {
      const before = { content: 'This is a note with a tag overdue >2000 >2000-01 >2000-Q1 >2000-01-01' }
      const result = p.hasOverdueYearTag(before, true)
      expect(result).toEqual({ isOverdue: true, overdueStrings: ['>2000'] })
    })
  })

  /*
   * hasOverdueTag()
   */
  describe('hasOverdueTag()' /* function */, () => {
    test('should return false if no overdue tag', () => {
      const before = { content: 'This is a note' }
      const result = p.hasOverdueTag(before)
      expect(result).toEqual(false)
    })
    test('should return true if one is overdue', () => {
      const before = { content: 'This is a note >2022-01 >2999-01-01 >2999-W12' }
      const result = p.hasOverdueTag(before)
      expect(result).toEqual(true)
    })
    test('should return true if multiple are set', () => {
      const before = { content: 'This is a note with a tag overdue >2000 >2000-01 >2000-Q1 >2000-01-01' }
      const result = p.hasOverdueTag(before)
      expect(result).toEqual(true)
    })
  })

  /*
   * paragraphIsEffectivelyOverdue()
   */
  describe('paragraphIsEffectivelyOverdue()' /* function */, () => {
    test('should return false if no open task', () => {
      const before = { content: 'This is a note', type: 'done', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(false)
    })
    test('should return false if task is scheduled', () => {
      const before = { content: 'This is a note >2999-01-01', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(false)
    })
    test('should return true if task is scheduled in the past', () => {
      const before = { content: 'This is a note >2000-01-01', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(true)
    })
    test('should return true if task was on an old note', () => {
      const before = { content: 'This is a note', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(true)
    })
  })
})

// ----------------------------------------------------------------------------

// Note: commented out, as I don't know how to get the mocks working for
// .insertParagraph and .appendParagraph
// despite the imports at the beginning.

// describe('getOrMakeMetadataLine()', () => {
//   const noteA = {
//     paragraphs: [
//       { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//       { type: 'empty', lineIndex: 1, content: '' },
//       { type: 'title', lineIndex: 2, content: 'Tasks for 3.4.22', headingLevel: 2 },
//       { type: 'open', lineIndex: 3, content: 'task 1' },
//       { type: 'title', lineIndex: 4, content: 'Journal for 3.4.22' },
//       { type: 'list', lineIndex: 5, content: 'first journal entry' },
//       { type: 'list', lineIndex: 6, content: 'second journal entry' },
//       { type: 'empty', lineIndex: 7, content: '' },
//       { type: 'title', lineIndex: 8, content: 'Done ...', headingLevel: 2 },
//       { type: 'title', lineIndex: 9, content: 'Cancelled', headingLevel: 2 },
//       { type: 'cancelled', lineIndex: 10, content: 'task 4 not done' },
//     ],
//   }
//   test("should return blank line after title", () => {
//     expect(p.getOrMakeMetadataLine(noteA)).toEqual(1)
//   })
//   test("should return metadata line style 1", () => {
//     const noteB = {
//       paragraphs: [
//         { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//         { type: 'text', lineIndex: 1, content: '@due(2023-01-01) @review(2m)' },
//       ],
//     }
//     expect(p.getOrMakeMetadataLine(noteB)).toEqual(1)
//   })
//   test("should return metadata line style 2", () => {
//     const noteC = {
//       paragraphs: [
//         { type: 'title', lineIndex: 0, content: 'NoteA Title', headingLevel: 1 },
//         { type: 'text', lineIndex: 1, content: '#project @due(2023-01-01) @reviewed(2022-08-01)' },
//       ],
//     }
//     expect(p.getOrMakeMetadataLine(noteC)).toEqual(1)
//   })
//   test('should return line after single empty para', () => {
//     const noteE = {
//       paragraphs: [
//         { type: 'empty', lineIndex: 0, content: '' },
//       ],
//     }
//     const result = p.getOrMakeMetadataLine(noteE)
//     expect(result).toEqual(1)
//   })
//   test('should return line after single para', () => {
//     const noteF = {
//       paragraphs: [
//         { type: 'text', lineIndex: 0, content: 'Single line only' },
//       ],
//     }
//     const result = p.getOrMakeMetadataLine(noteF)
//     expect(result).toEqual(1)
//   })
//   test('should return 1 for no paras at all', () => {
//     const noteG = {
//       paragraphs: [],
//     }
//     const result = p.getOrMakeMetadataLine(noteG)
//     expect(result).toEqual(1)
//   })
// })
