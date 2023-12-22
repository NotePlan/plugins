/* global describe, expect, test, beforeAll, beforeEach, afterAll, it */
import moment from 'moment'
import { CustomConsole } from '@jest/console' // see note below
import * as p from '../NPParagraph'
import { clo, logDebug, logInfo } from '../dev'
import { getParagraphParentsOnly, getChildParas, getIndentedNonTaskLinesUnderPara, removeParentsWhoAreChildren } from '../NPParagraph'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph, simpleFormatter } from '@mocks/index'
import { SCHEDULED_MONTH_NOTE_LINK } from '@helpers/dateTime'

let globalNote // use this to test with semi-real Note+paragraphs

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.Note = Note
  global.Paragraph = Paragraph
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging | none for quiet
})

beforeEach(() => {
  const paragraphs = [
    {
      content: 'Call Allianz 1-800-334-7525',
      rawContent: '* Call Allianz 1-800-334-7525',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 0,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: 'Change healthplan',
      rawContent: '* Change healthplan',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 1,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '1This is a top task',
      rawContent: '* 1This is a top task',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 2,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '2This is indented under it',
      rawContent: '\t* 2This is indented under it',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 3,
      isRecurring: false,
      indents: 1,
      noteType: 'Calendar',
    },
    {
      content: '3 text under the 1 top task',
      rawContent: '\t\t3 text under the 1 top task',
      type: 'text',
      heading: '',
      headingLevel: -1,
      lineIndex: 4,
      isRecurring: false,
      indents: 2,
      noteType: 'Calendar',
    },
    {
      content: '4 this is under 2 also (last line)',
      rawContent: '\t\t* 4 this is under 2 also (last line)',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 5,
      isRecurring: false,
      indents: 2,
      noteType: 'Calendar',
    },
    {
      content: '',
      rawContent: '',
      type: 'empty',
      heading: '',
      headingLevel: -1,
      lineIndex: 6,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
  ]
  paragraphs[0].children = () => []
  paragraphs[1].children = () => []
  paragraphs[2].children = () => [paragraphs[3], paragraphs[4], paragraphs[5]]
  paragraphs[3].children = () => [paragraphs[4], paragraphs[5]]
  paragraphs[4].children = () => []
  paragraphs[5].children = () => []
  paragraphs[6].children = () => []
  globalNote = new Note({ paragraphs })
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
   * testForOverdue()
   * Most of the edges of this function are exercised in the tests for:
   * - hasOverdueYearTag
   * - hasOverdueWeekTag
   * - hasOverdueMonthTag etc.
   * But we do need to test the basic functions underneath here
   */
  describe('testForOverdue()' /* function */, () => {
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
      const thieMonth = '2022-01'
      const result = p.testForOverdue(before, SCHEDULED_MONTH_NOTE_LINK, thieMonth, true, 'Monthly')
      const expected = { isOverdue: false, overdueLinks: [], notOverdueLinks: [] }
      expect(result).toEqual(expect.objectContaining(expected))
    })
  })

  /*
   * getTagDetails()
   */
  describe('getTagDetails()' /* function */, () => {
    test('should return false if there is no date', () => {
      const before = { content: 'This is a note with no tag' }
      const result = p.getTagDetails(before)
      expect(result).toEqual(false)
    })
    test('should get basic details for non overdue task', () => {
      const paraDate = new moment('2999-01-01')
      const before = { content: 'This is a note with a tag not overdue >2999-W01', date: paraDate }
      const result = p.getTagDetails(before)
      expect(result.isOverdue).toEqual(false)
      expect(result.notOverdueLinks).toEqual(['>2999-W01'])
    })
    test('should get details for overdue task', () => {
      const paraDate = new moment('2023-01-01')
      const before = { content: 'This is a note with a tag overdue >2023-W01', date: paraDate }
      const result = p.getTagDetails(before)
      expect(result.isOverdue).toEqual(true)
      expect(result.overdueLinks).toEqual(['>2023-W01'])
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
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Weekly', overdueLinks: ['>2000-W01'] }))
    })
    test('should work if there are two overdues (not really suggesting this use case)', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01 >2000-W02' }
      const result = p.hasOverdueWeekTag(before, true)
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Weekly', overdueLinks: ['>2000-W01', '>2000-W02'] }))
    })
    test('should return partial overdues', () => {
      const before = { content: 'This is a note with a tag overdue >2000-W01 >2999-W02' }
      const result = p.hasOverdueWeekTag(before, true)
      expect(result).toEqual(expect.objectContaining({ isOverdue: false, linkType: 'Weekly', overdueLinks: ['>2000-W01'] }))
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
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Monthly', overdueLinks: ['>2000-01'] }))
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
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Quarterly', overdueLinks: ['>2000-Q1'] }))
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
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Yearly', overdueLinks: ['>2000'] }))
    })
    test('should not confuse a year tag with another tag', () => {
      const before = { content: 'This is a note with a tag overdue >2000 >2000-01 >2000-Q1 >2000-01-01' }
      const result = p.hasOverdueYearTag(before, true)
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Yearly', overdueLinks: ['>2000'] }))
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
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Daily', overdueLinks: ['>2000-01-01'] }))
    })
    test('should work if there are two overdues (not really suggesting this use case)', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01 >2000-02-02' }
      const result = p.hasOverdueDayTag(before, true)
      expect(result).toEqual(expect.objectContaining({ isOverdue: true, linkType: 'Daily', overdueLinks: ['>2000-01-01', '>2000-02-02'] }))
    })
    test('should return partial overdues', () => {
      const before = { content: 'This is a note with a tag overdue >2000-01-01 >2999-02-02' }
      const result = p.hasOverdueDayTag(before, true)
      expect(result).toEqual(expect.objectContaining({ isOverdue: false, linkType: 'Daily', overdueLinks: ['>2000-01-01'] }))
    })
  })

  /*
   * hasOverdueTag()
   */
  describe('hasOverdueTag()' /* function */, () => {
    describe('simple bool response', () => {
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
    describe('return detailed object', () => {
      test('should return details if second arg is true (daily)', () => {
        const before = { content: 'This is a note with a tag overdue >2000 >2000-01 >2000-Q1 >2000-01-01' }
        const result = p.hasOverdueTag(before, true)
        expect(result).toEqual(expect.objectContaining({ isOverdue: true, overdueLinks: ['>2000-01-01'], linkType: 'Daily' }))
      })
      test('should return details if second arg is true (yearly)', () => {
        const before = { content: 'This is a note with a tag overdue >2000' }
        const result = p.hasOverdueTag(before, true)
        expect(result).toEqual(expect.objectContaining({ isOverdue: true, overdueLinks: ['>2000'], linkType: 'Yearly' }))
      })
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
    test('should return false if task is scheduled in the future', () => {
      const before = { content: 'This is a note >2999-01-01', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(false)
    })
    test('should return true if task is scheduled in the past (yes is overdue, but is not "effectively overdue")', () => {
      const before = { content: 'This is a note >2000-01-01', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(false)
    })
    test('should return true if task was on an old daily note', () => {
      const before = { content: 'This is a note', type: 'open', note: { type: 'Calendar', title: '2000-01-01', filename: '20000101.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(true)
    })
    test('should return true if task was on an old weekly note', () => {
      const before = { content: 'This is a note', type: 'open', note: { type: 'Calendar', title: '2000-W01', filename: '2000-W01.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(true)
    })
    test('should return true if task was on an old yearly note', () => {
      const before = { content: 'This is a note', type: 'open', note: { type: 'Calendar', title: '2000', filename: '2000.md' } }
      const result = p.paragraphIsEffectivelyOverdue(before)
      expect(result).toEqual(true)
    })
  })
  /*
   * findParagraph()
   */
  describe('findParagraph()' /* function */, () => {
    test('should find a paragraph whose content has not been edited', () => {
      const parasToLookIn = [
        new Paragraph({ rawContent: '* not a match?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* Shabbos dessert?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* no match here?', filename: '20230210.md' }),
      ]
      const obj = {
        rawContent: '* Shabbos dessert?',
        filename: '20230210.md',
      }
      const result = p.findParagraph(parasToLookIn, obj)
      expect(result.rawContent).toEqual(obj.rawContent)
    })
    test('should not find a paragraph if there is no match', () => {
      const parasToLookIn = [
        new Paragraph({ rawContent: '* not a match?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* Shabbos dessert?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* no match here?', filename: '20230210.md' }),
      ]
      const obj = {
        rawContent: '* foo bar?',
        filename: '20230210.md',
      }
      const result = p.findParagraph(parasToLookIn, obj)
      expect(result).toEqual(null)
    })
    test('should find a paragraph by filename and lineIndex', () => {
      const parasToLookIn = [
        new Paragraph({ lineIndex: 0, filename: '20230210.md' }),
        new Paragraph({ lineIndex: 1, filename: '20230210.md' }),
        new Paragraph({ lineIndex: 2, filename: '20230210.md' }),
      ]
      const obj = {
        lineIndex: 2,
        filename: '20230210.md',
      }
      const result = p.findParagraph(parasToLookIn, obj, ['filename', 'lineIndex'])
      expect(result).not.toEqual(null)
      expect(result.lineIndex).toEqual(2)
    })
    test('should find a paragraph whose content has been edited', () => {
      const parasToLookIn = [
        new Paragraph({ rawContent: '* not a match?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* Shabbos dessert?', filename: '20230210.md' }),
        new Paragraph({ rawContent: '* no match here?', filename: '20230210.md' }),
      ]
      const obj = {
        prefix: '* ',
        content: 'Shabbos dessert?',
        rawContent: '* Shabbos dessert? oops forgot<div><br></div>',
        overdueStatus: 'Overdue',
        noteType: 'Calendar',
        lineIndex: 21,
        id: 14,
        isExpanded: true,
        filename: '20230210.md',
        type: 'open',
        originalRawContent: '* Shabbos dessert?',
      }
      const result = p.findParagraph(parasToLookIn, obj, ['filename', 'rawContent'])
      expect(result).not.toEqual(null)
      expect(result.rawContent).toEqual(obj.originalRawContent)
    })
  })

  /*
   * createStaticObject()
   */
  describe('createStaticObject()' /* function */, () => {
    test('should create an object with the proper fields', () => {
      const origObj = { a: 1, b: 2, c: 3 }
      const result = p.createStaticObject(origObj, ['a', 'b'])
      const expected = { a: 1, b: 2 }
      expect(result).toEqual(expected)
    })
  })
  /*
   * createStaticArray()
   */
  describe('createStaticArray()' /* function */, () => {
    test('should create an array of objects with the proper fields', () => {
      const origObj = [{ a: 1, b: 2, c: 3 }]
      const result = p.createStaticParagraphsArray(origObj, ['a', 'b'])
      const expected = [{ a: 1, b: 2 }]
      expect(result).toEqual(expected)
    })
  })

  /*
   * getDaysTilDue()
   */
  describe('getDaysTilDue()' /* function */, () => {
    global.NotePlan = new NotePlan()
    describe('overdue tests - daysTilDue should be negative', () => {
      test('should return -1 day even if it is a fraction of a day', () => {
        const para = new Paragraph({ content: '* foo bar? >2000-01-01', filename: '20200101.md', noteType: 'Calendar', date: new Date('2000-01-01T13:00:00') })
        const result = p.getDaysTilDue(para, '2000-01-02')
        expect(result).toEqual(-1)
      })
      test('should return -2 for overdue >2000-01-01 and today is 2000-01-03', () => {
        const para = new Paragraph({ content: '* foo bar? >2000-01-01', filename: '20200101.md', noteType: 'Calendar', date: new Date('2000-01-01T13:00:00') })
        const result = p.getDaysTilDue(para, '2000-01-03')
        expect(result).toEqual(-2)
      })
      test('should count from the end of the period -- -3 for one day overdue for day after EOM', () => {
        const para = new Paragraph({ content: '* foo bar? >2000-01', filename: '20200101.md', noteType: 'Calendar', date: new Date('2000-01-01T13:00:00') })
        const result = p.getDaysTilDue(para, '2000-02-03')
        expect(result).toEqual(-3)
      })
      test('should count from the end of the period -- EOQ -4 for two days past quarter due', () => {
        const para = new Paragraph({ content: '* foo bar? >2000-Q1', filename: '20200101.md', noteType: 'Calendar', date: new Date('2000-01-01T13:00:00') })
        const result = p.getDaysTilDue(para, '2000-04-04')
        expect(result).toEqual(-4)
      })
      test('should count from the end of the period -- EOY + 1 day should be -1', () => {
        const para = new Paragraph({ content: '* foo bar? >2000', filename: '20200101.md', noteType: 'Calendar', date: new Date('2000-01-01T13:00:00') })
        const result = p.getDaysTilDue(para, '2001-01-05')
        expect(result).toEqual(-5)
      })
      test('should count from the end of the period -- EOW', () => {
        const paraStartDate = new moment('2023-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2023-W01', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '2023-01-08') //1st was a sunday, week was Jan1-Jan7 if you start on Sundays, but we don't know what user setting is
        expect(result).toEqual(-1)
      })
    })
    describe('not overdue tests - zero days til due', () => {
      test('due today', () => {
        const paraStartDate = new moment('2000-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2000-01-01', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '2000-01-01')
        expect(result).toEqual(0)
      })
      test('should not be overdue if we are still in the period (on last day of month)', () => {
        const paraStartDate = new moment('2000-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2000-01', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '2000-01-31')
        expect(result).toEqual(0)
      })
      test('should not be overdue if we are still in the period (qtr)', () => {
        const paraStartDate = new moment('2000-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2000-Q1', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '2000-03-31')
        expect(result).toEqual(0)
      })
    })
    describe('not overdue tests - positive days til due', () => {
      test('due tomorrow', () => {
        const paraStartDate = new moment('2000-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2000-01-01', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '1999-12-31')
        expect(result).toEqual(1)
      })
      test('due in 2 days', () => {
        const paraStartDate = new moment('2000-01-01').toDate()
        const para = new Paragraph({ content: '* foo bar? >2000-01-01', filename: '20200101.md', noteType: 'Calendar', date: paraStartDate })
        const result = p.getDaysTilDue(para, '1999-12-30')
        expect(result).toEqual(2)
      })
    })
  })

  describe('p.getDaysToCalendarNote', () => {
    test('should return the (negative) number of days between two dates', () => {
      const para = {
        noteType: 'Calendar',
        note: {
          title: '2022-01-01', // Replace with your desired date
        },
      }
      const asOfDayString = '2022-01-02' // Replace with your desired date
      const result = p.getDaysToCalendarNote(para, asOfDayString)
      expect(result).toBe(-1) // Replace with the expected number of days
    })
    test('should return zero if the date is the same', () => {
      const para = {
        noteType: 'Calendar',
        note: {
          title: '2022-01-01', // Replace with your desired date
        },
      }
      const asOfDayString = '2022-01-01' // Replace with your desired date
      const result = p.getDaysToCalendarNote(para, asOfDayString)
      expect(result).toBe(0) // Replace with the expected number of days
    })
    test('should return positive if the date is the future', () => {
      const para = {
        noteType: 'Calendar',
        note: {
          title: '2022-01-02', // Replace with your desired date
        },
      }
      const asOfDayString = '2022-01-01' // Replace with your desired date
      const result = p.getDaysToCalendarNote(para, asOfDayString)
      expect(result).toBe(1) // Replace with the expected number of days
    })
    test('should return null if para.noteType is not "Calendar"', () => {
      const para = {
        noteType: 'Other',
        note: {
          title: '2022-01-01',
        },
      }
      const result = p.getDaysToCalendarNote(para)
      expect(result).toBeNull()
    })

    test('should return null if para.note is not defined', () => {
      const para = {
        noteType: 'Calendar',
      }
      const result = p.getDaysToCalendarNote(para)
      expect(result).toBeNull()
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

/*
 * makeBasicParasFromContent()
 * Note: skipped, as what it's testing isn't complete yet
 */
describe('makeBasicParasFromContent()', () => {
  // TODO: delete next phrase when all is working
  beforeEach(() => {
    DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging | none for quiet
  })
  test.skip('should return block (with heading) when passed a heading string', () => {
    const content = `# line 0 title
* line 1 open task
* [ ] line 2 open task
- bullet line 3
* [x] line 4 closed task
* [-] line 5 cancelled task
---

line 8 ordinary para
> line 9 quote
1. line 10 numbered list
+ line 11 checklist`
    const paragraphs = [
      /*new Paragraph(*/ { type: 'title', content: 'line 0 title', rawContent: '# line 0 title', lineIndex: 0 },
      /*new Paragraph(*/ { type: 'open', content: 'line 1 open task', rawContent: '* line 1 open task', lineIndex: 1 },
      /*new Paragraph(*/ { type: 'open', content: 'line 2 open task', rawContent: '* [ ] line 2 open task', lineIndex: 2 },
      /*new Paragraph(*/ { type: 'list', content: '- bullet line 3', rawContent: '- bullet line 3', lineIndex: 3 },
      /*new Paragraph(*/ { type: 'done', content: 'line 4 closed task', rawContent: '* [x] line 4 closed task', lineIndex: 4 },
      /*new Paragraph(*/ { type: 'cancelled', content: 'line 5 cancelled task', rawContent: '* [-] line 5 cancelled task', lineIndex: 5 },
      /*new Paragraph(*/ { type: 'separator', content: '---', rawContent: '---', lineIndex: 6 },
      /*new Paragraph(*/ { type: 'empty', content: '', rawContent: '', lineIndex: 7 },
      /*new Paragraph(*/ { type: 'text', content: 'line 8 ordinary para', rawContent: 'line 8 ordinary para', lineIndex: 8 },
      /*new Paragraph(*/ { type: 'quote', content: 'line 9 quote', rawContent: '> line 9 quote', lineIndex: 9 },
      /*new Paragraph(*/ { type: 'list', content: 'line 10 numbered list', rawContent: '1. line 10 numbered list', lineIndex: 10 },
      /*new Paragraph(*/ { type: 'checklist', content: 'line 11 checklist', rawContent: '+ line 11 checklist', lineIndex: 11 },
    ]

    const resultParas = p.makeBasicParasFromContent(content)
    expect(resultParas).toEqual(paragraphs)
  })
})

/*
 * getParagraphParentsOnly()
 */
describe('getParagraphParentsOnly', () => {
  it('should return an array of parent paragraphs with their children - Test case 1', () => {
    const paragraphs1 = [
      { lineIndex: 0, indents: 0, children: () => [] },
      { lineIndex: 1, indents: 1, children: () => [] },
      { lineIndex: 2, indents: 1, children: () => [] },
      { lineIndex: 3, indents: 0, children: () => [] },
    ]
    paragraphs1[0].children = () => [paragraphs1[1], paragraphs1[2]]
    const result1 = getParagraphParentsOnly(paragraphs1)
    expect(result1.length).toEqual(4)
    expect(result1[0].parent.lineIndex).toEqual(0)
    expect(result1[0].children.length).toEqual(2)
    expect(result1[0].children[0].lineIndex).toEqual(1)
    expect(result1[0].children[1].lineIndex).toEqual(2)
    expect(result1[3].parent.lineIndex).toEqual(3)
    expect(result1[1].children.length).toEqual(0)
  })
  it('should return the same number of items it received', () => {
    const result = getParagraphParentsOnly(globalNote.paragraphs)
    expect(result.length).toEqual(globalNote.paragraphs.length) // one result for each paragraph
  })
  it('should deal properly with multiple indents', () => {
    const result = getParagraphParentsOnly(globalNote.paragraphs)
    expect(result[0].children.length).toEqual(0)
    expect(result[1].children.length).toEqual(0)
    expect(result[2].children.length).toEqual(1)
    expect(result[3].children.length).toEqual(2)
    expect(result[4].children.length).toEqual(0)
    expect(result[5].children.length).toEqual(0)
  })
  it('should include text under tasks', () => {
    const result = getParagraphParentsOnly(globalNote.paragraphs)
    expect(result[3].children[0].type).toEqual('text') // one result for each paragraph
  })
  it('should include text under tasks one parent only', () => {
    const result = getParagraphParentsOnly([globalNote.paragraphs[3]])
    expect(result[0].children[0].type).toEqual('text') // one result for each paragraph
  })
})

/*
 * removeParentsWhoAreChildren()
 */
describe('removeParentsWhoAreChildren()' /* function */, () => {
  test('base case - should remove child from parents and return an array of only parents', () => {
    const parents = [
      { parent: { lineIndex: 0, indents: 0, children: () => [] }, children: [] },
      { parent: { lineIndex: 1, indents: 1, children: () => [] }, children: [] },
    ]
    parents[0].children = [parents[1].parent]

    const result = removeParentsWhoAreChildren(parents)
    expect(result.length).toEqual(1)
    expect(result[0].parent.lineIndex).toEqual(0)
  })
  test('deal with real-world paragraph cases', () => {
    const parents = getParagraphParentsOnly(globalNote.paragraphs) // this is tested above
    const result = removeParentsWhoAreChildren(parents)
    expect(result.length).toEqual(globalNote.paragraphs.length - 3) // remove two parents and one empty
  })
})

/*
 * getChildParas()
 */
describe('getChildParas', () => {
  it('should return an array of children paragraphs - Test case 1: No children', () => {
    const para1 = { lineIndex: 1, indents: 0, children: () => [] }
    const paragraphs1 = [para1]
    const result1 = getChildParas(para1, paragraphs1)
    expect(result1).toEqual(expect.objectContaining([]))
  })

  it('should return an array of children paragraphs - Test case 2: One child with removeChildrenFromTopLevel as false', () => {
    const para2 = { lineIndex: 1, indents: 0, type: 'open', children: () => [{ lineIndex: 2, indents: 1, type: 'text', children: () => [] }] }
    const paragraphs2 = [para2, { lineIndex: 2, indents: 1, children: () => [], type: 'text' }]
    const result2 = getChildParas(para2, paragraphs2)
    expect(result2.length).toEqual(1)
    expect(result2[0].lineIndex).toEqual(2)
  })

  it('should return an array of children paragraphs - Test case 4: Multiple children', () => {
    const para4 = {
      lineIndex: 1,
      indents: 0,
      children: () => [
        { lineIndex: 2, indents: 1, children: () => [] },
        { lineIndex: 3, indents: 1, children: () => [] },
      ],
    }
    const paragraphs4 = [para4, { lineIndex: 2, indents: 1, children: () => [] }, { lineIndex: 3, indents: 1, children: () => [] }]
    const result4 = getChildParas(para4, paragraphs4)
    expect(result4.length).toEqual(2)
    expect(result4[0].lineIndex).toEqual(2)
    // Add similar it() statements for other test cases
  })

  it('should work for complex multi-indent case', () => {
    const para = globalNote.paragraphs[2]
    const result = getChildParas(para, globalNote.paragraphs)
    expect(result.length).toEqual(1)
    expect(result[0].lineIndex).toEqual(3)
  })

  it('should return an array of children paragraphs - Test case 5: Multiple children with removeChildrenFromTopLevel as true', () => {
    const paras5 = [
      {
        type: 'done',
        content: '5 done',
        rawContent: '\t* [x] 5 done',
        prefix: '* [x] ',
        contentRange: {},
        lineIndex: 4,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 1,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'checklist',
        content: '6further indented checkbox',
        rawContent: '\t\t+ 6further indented checkbox',
        prefix: '+ ',
        contentRange: {},
        lineIndex: 5,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 2,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'text',
        content: "7 ok final - this is the problem cuz it's not a task",
        rawContent: "\t\t7 ok final - this is the problem cuz it's not a task",
        prefix: '',
        contentRange: {},
        lineIndex: 6,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 2,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
      {
        type: 'text',
        content: '8 double final',
        rawContent: '\t\t\t8 double final',
        prefix: '',
        contentRange: {},
        lineIndex: 7,
        heading: '',
        headingLevel: -1,
        isRecurring: false,
        indents: 3,
        filename: '20231202.md',
        noteType: 'Calendar',
        linkedNoteTitles: [],
        subItems: [],
        referencedBlocks: [],
        note: {},
        children: () => [],
      },
    ]
    paras5[0].children = () => paras5.slice(1)
    const result5 = getChildParas(paras5[0], paras5, false)
    expect(result5.length).toEqual(2)
    expect(result5[0].lineIndex).toEqual(5)
    const result6 = getChildParas(paras5[2], paras5, false)
    expect(result6.length).toEqual(1)
    expect(result6[0].lineIndex).toEqual(7)
  })
  describe('getIndentedNonTaskLinesUnderPara', () => {
    // Mock data
    const mockParagraphs = [
      { lineIndex: 1, indents: 0, type: 'text' },
      { lineIndex: 2, indents: 1, type: 'text' },
      { lineIndex: 3, indents: 1, type: 'open' },
      { lineIndex: 4, indents: 2, type: 'text' },
      { lineIndex: 5, indents: 2, type: 'text' },
      { lineIndex: 6, indents: 3, type: 'text' },
    ]
    it('should return an array of indented paragraphs underneath the given paragraph', () => {
      const para = { lineIndex: 3, indents: 1 }
      const result = getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([
        { lineIndex: 4, indents: 2, type: 'text' },
        { lineIndex: 5, indents: 2, type: 'text' },
        { lineIndex: 6, indents: 3, type: 'text' },
      ])
    })

    it('should return an empty array if no indented paragraphs are found', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph is the last one in the array', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph is the last one in the array', () => {
      const para = { lineIndex: 6, indents: 3 }
      const result = getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle the case where the given paragraph has no indented paragraphs underneath', () => {
      const para = { lineIndex: 4, indents: 2 }
      const result = getIndentedNonTaskLinesUnderPara(para, mockParagraphs)
      expect(result).toEqual([])
    })

    it('should handle complex real-world data', () => {
      const para = globalNote.paragraphs[3]
      const result = getIndentedNonTaskLinesUnderPara(para, globalNote.paragraphs)
      expect(result).toEqual([globalNote.paragraphs[4]])
    })
  })
})
