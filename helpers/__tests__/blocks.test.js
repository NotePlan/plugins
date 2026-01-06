/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, Paragraph, simpleFormatter /* mockWasCalledWithString */ } from '@mocks/index'
import * as b from '../blocks'
const PLUGIN_NAME = `helpers`
const FILENAME = `blocks`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
To use factories (from the factories folder inside of __tests__):
const testFile = new Note(JSON.parse(await loadFactoryFile(__dirname, 'jgclarksSortTest.json')))
 // load a factory file from the __tests__/factories folder
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(() => compileAndroidCode()).toThrow(/JDK/);
expect(result).toEqual([])
// object matching - important to not use exact match because you may add fields later
      expect(result).toEqual(expect.objectContaining({ field1: true, field2: 'someString'}))
// or if you want to check if an array has objects in it with certain fields:
test('we should have name 1 and 2', () => {
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({name: 1}),
      expect.objectContaining({name: 2})
    ])
  );
});

import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

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

describe(`helpers/blocks`, () => {
    //functions go here using jfunc command
    describe('breakParagraphsIntoBlocks', () => {
      test('should break paragraphs into blocks based on block types', () => {
        const input = [
          { type: 'title', headingLevel: 1 },
          { type: 'text' },
          { type: 'separator' },
          { type: 'title', headingLevel: 2 },
          { type: 'text' },
          { type: 'empty' },
          { type: 'title', headingLevel: 3 },
          { type: 'text' },
        ]
        const expectedOutput = [
          [{ type: 'title', headingLevel: 1 }, { type: 'text' }],
          [{ type: 'separator' }],
          [{ type: 'title', headingLevel: 2 }, { type: 'text' }],
          [{ type: 'empty' }],
          [{ type: 'title', headingLevel: 3 }, { type: 'text' }],
        ]
        const result = b.breakParagraphsIntoBlocks(input)
        expect(result.length).toBe(5)
        expect(result[1][0].type).toBe('separator')
        expect(result[3][0].type).toBe('empty')
        expect(result).toEqual(expectedOutput)
      })

      test('should break paragraphs into blocks based on title changes', () => {
        const input = [
          { type: 'title', headingLevel: 2 },
          { type: 'text' },
          { type: 'title', headingLevel: 2 },
          { type: 'text' },
          { type: 'title', headingLevel: 1 },
          { type: 'text' },
        ]
        const expectedOutput = [
          [{ type: 'title', headingLevel: 2 }, { type: 'text' }],
          [{ type: 'title', headingLevel: 2 }, { type: 'text' }],
          [{ type: 'title', headingLevel: 1 }, { type: 'text' }],
        ]
        const result = b.breakParagraphsIntoBlocks(input)
        expect(result.length).toBe(3)
        expect(result).toEqual(expectedOutput)
      })

      test('should handle empty input array', () => {
        const input = []
        const expectedOutput = []
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no break block types', () => {
        const input = [{ type: 'title', headingLevel: 1 }, { type: 'text' }, { type: 'text' }, { type: 'title', headingLevel: 2 }, { type: 'text' }]
        const expectedOutput = [input]
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no titles', () => {
        const input = [{ type: 'text' }, { type: 'text' }]
        const expectedOutput = [input]
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with single item', () => {
        const input = [{ type: 'title', headingLevel: 1 }]
        const expectedOutput = [[{ type: 'title', headingLevel: 1 }]]
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with all break block types', () => {
        const input = [{ type: 'empty' }, { type: 'separator' }, { type: 'title', headingLevel: 1 }]
        const expectedOutput = [[{ type: 'empty' }], [{ type: 'separator' }], [{ type: 'title', headingLevel: 1 }]]
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no paragraphs', () => {
        const input = [{ type: 'title', headingLevel: 1 }, { type: 'separator' }, { type: 'title', headingLevel: 2 }]
        const expectedOutput = [[{ type: 'title', headingLevel: 1 }], [{ type: 'separator' }], [{ type: 'title', headingLevel: 2 }]]
        expect(b.breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })
    })

    describe('isBreakParaType', () => {
      test('should return true for break block types', () => {
        const item = { type: 'separator' }
        const breakBlockTypes = ['empty', 'separator', 'title']
        expect(b.isBreakParaType(item, breakBlockTypes)).toBe(true)
      })

      test('should return false for non-break block type', () => {
        const item = { type: 'text' }
        const breakBlockTypes = ['empty', 'separator', 'title']
        expect(b.isBreakParaType(item, breakBlockTypes)).toBe(false)
      })
    })

    // JGC doesn't know how to mock this out yet
    // describe('isAChildPara', () => {
    // })

    // JGC doesn't know how to mock this out yet
    // describe('getParaAndAllChildren', () => {
  // })
  
    describe('blockHasActiveTasks', () => {
    test('returns false when block has only completed/cancelled tasks', () => {
      const block = [
        { type: 'done', content: 't1' },
        { type: 'checklistDone', content: 't2' },
        { type: 'cancelled', content: 't3' },
        { type: 'checklistCancelled', content: 't4' },
      ]
      expect(b.blockHasActiveTasks(block)).toBe(false)
    })
    test('returns false when block has only non-task paragraphs', () => {
      const block = [
        { type: 'text', content: 't1' },
        { type: 'heading', content: 't2' },
        { type: 'separator', content: 't3' },
        { type: 'empty', content: 't4' },
        { type: 'list', content: 't5' },
        { type: 'quote', content: 't6' },
      ]
      expect(b.blockHasActiveTasks(block)).toBe(false)
    })
    test('returns true when block has any active task', () => {
      const block = [
        { type: 'done', content: 't1' },
        { type: 'open', content: 't2' },
      ]
      expect(b.blockHasActiveTasks(block)).toBe(true)
    })
    test('returns true when block has any active checklist', () => {
      const block = [
        { type: 'checklistDone', content: 't1' },
        { type: 'checklistCancelled', content: 't2' },
        { type: 'checklistScheduled', content: 't3' },
        { type: 'checklist', content: 't4' },
      ]
      expect(b.blockHasActiveTasks(block)).toBe(true)
    })
    test('returns true when block has a mix of completed and active tasks and non-task paragraphs', () => {
      const block = [
        { type: 'done', content: 't1' },
        { type: 'open', content: 't2' },
        { type: 'text', content: 't3' },
        { type: 'heading', content: 't4' },
        { type: 'separator', content: 't5' },
        { type: 'empty', content: 't6' },
        { type: 'list', content: 't7' },
        { type: 'quote', content: 't8' },
      ]
      expect(b.blockHasActiveTasks(block)).toBe(true)
    })
    })

  /*
 * getParagraphBlock(). Parameters:
 * - note
 * - selectedParaIndex
 * - includeFromStartOfSection
 * - useTightBlockDefinition
 */
  describe('getParagraphBlock() for project note' /* function */, () => {
    // Skip this set until it's clearer what the most sensible answers are
    // for asking block from title onwards in a regular note
    test.skip('should return block lineIndex 0-4 from 0/false/false', () => {
      const result = b.getParagraphBlock(Editor.note, 0, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    })
    test.skip('should return block lineIndex 0-3 from 0/false/true', () => {
      const result = b.getParagraphBlock(Editor.note, 0, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })
    test.skip('should return block lineIndex 0-4 from 0/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 0, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 5))
    })
    test.skip('should return block lineIndex 0-3 from 0/true/true', () => {
      const result = b.getParagraphBlock(Editor.note, 0, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })

    test('should return block lineIndex 1-5 from 1/false/false', () => {
      const result = b.getParagraphBlock(Editor.note, 1, false, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB1', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 1/false/true', () => {
      const result = b.getParagraphBlock(Editor.note, 1, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
    test('should return block lineIndex 1-5 from 1/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 1, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB2', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 1/true/true', () => {
      const result = b.getParagraphBlock(Editor.note, 1, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })

    test('should return block lineIndex 2 from 2/false/false', () => {
      const result = b.getParagraphBlock(Editor.note, 2, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
    })
    test('should return block lineIndex 2 from 2/false/true', () => {
      const result = b.getParagraphBlock(Editor.note, 2, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 3))
    })
    test('should return block lineIndex 0-5 from 2/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 2, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logInfo('testGPB3', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 6))
    })
    test('should return block lineIndex 1-3 from 2/true/true', () => {
      const result = b.getParagraphBlock(Editor.note, 2, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(1, 4))
    })
    test('should return block lineIndex 6-9 from 7/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 7, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 10))
    })
    test('should return block lineIndex 6-8 from 7/true/true', () => {
      const result = b.getParagraphBlock(Editor.note, 7, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(6, 9))
    })
    test('should return block lineIndex 11-13 from 11/false/false', () => {
      const result = b.getParagraphBlock(Editor.note, 11, false, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(11, 14))
    })
    test('should return block lineIndex 11-12 from 11/false/true', () => {
      const result = b.getParagraphBlock(Editor.note, 11, false, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(11, 13))
    })
    test('should return block lineIndex 10-13 (section "Cancelled") from 12/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 12, true, false)
      expect(result).toEqual(Editor.note.paragraphs.slice(10, 14))
    })
    test('should return block lineIndex 10-12 (section "Cancelled") from 10/true/false', () => {
      const result = b.getParagraphBlock(Editor.note, 10, true, true)
      expect(result).toEqual(Editor.note.paragraphs.slice(10, 13))
    })
    test('should return block lineIndex 13 from 13/false/true', () => {
      const result = b.getParagraphBlock(Editor.note, 13, false, true)
      const firstIndex = result[0].lineIndex
      const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB6', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
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
      const result = b.getParagraphBlock(Editor.note, 2, true, true)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB4', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 4))
    })
    test('should return block lineIndex 0-5 from 2/true/false [for calendar note]', () => {
      const result = b.getParagraphBlock(Editor.note, 2, true, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB5', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(0, 6))
    })
    test('should return block lineIndex 2-3 from 2/false/true [for calendar note]', () => {
      const result = b.getParagraphBlock(Editor.note, 2, false, true)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB5', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 4))
    })
    test('should return block lineIndex 2-5 from 2/false/false [for calendar note]', () => {
      const result = b.getParagraphBlock(Editor.note, 2, false, false)
      // const firstIndex = result[0].lineIndex
      // const lastIndex = firstIndex + result.length - 1
      // logDebug('testGPB6', `-> lineIndex ${String(firstIndex)} - ${String(lastIndex)}`)
      expect(result).toEqual(Editor.note.paragraphs.slice(2, 6))
    })
  })
})
