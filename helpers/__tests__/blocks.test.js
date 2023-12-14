/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { breakParagraphsIntoBlocks, isBreakBlock, isTitleWithEqualOrLowerHeadingLevel } from '../blocks'
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

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
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
        const result = breakParagraphsIntoBlocks(input)
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
        const result = breakParagraphsIntoBlocks(input)
        expect(result.length).toBe(3)
        expect(result).toEqual(expectedOutput)
      })

      test('should handle empty input array', () => {
        const input = []
        const expectedOutput = []
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no break block types', () => {
        const input = [{ type: 'title', headingLevel: 1 }, { type: 'text' }, { type: 'text' }, { type: 'title', headingLevel: 2 }, { type: 'text' }]
        const expectedOutput = [input]
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no titles', () => {
        const input = [{ type: 'text' }, { type: 'text' }]
        const expectedOutput = [input]
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with single item', () => {
        const input = [{ type: 'title', headingLevel: 1 }]
        const expectedOutput = [[{ type: 'title', headingLevel: 1 }]]
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with all break block types', () => {
        const input = [{ type: 'empty' }, { type: 'separator' }, { type: 'title', headingLevel: 1 }]
        const expectedOutput = [[{ type: 'empty' }], [{ type: 'separator' }], [{ type: 'title', headingLevel: 1 }]]
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })

      test('should handle input with no paragraphs', () => {
        const input = [{ type: 'title', headingLevel: 1 }, { type: 'separator' }, { type: 'title', headingLevel: 2 }]
        const expectedOutput = [[{ type: 'title', headingLevel: 1 }], [{ type: 'separator' }], [{ type: 'title', headingLevel: 2 }]]
        expect(breakParagraphsIntoBlocks(input)).toEqual(expectedOutput)
      })
    })

    describe('isBreakBlock', () => {
      test('should return true for break block types', () => {
        const item = { type: 'separator' }
        const breakBlockTypes = ['empty', 'separator', 'title']
        expect(isBreakBlock(item, breakBlockTypes)).toBe(true)
      })

      test('should return false for non-break block type', () => {
        const item = { type: 'text' }
        const breakBlockTypes = ['empty', 'separator', 'title']
        expect(isBreakBlock(item, breakBlockTypes)).toBe(false)
      })
    })

    describe('isTitleWithEqualOrLowerHeadingLevel', () => {
      test('should return true for title with lower heading level', () => {
        const item = { type: 'title', headingLevel: 2 }
        const prevLowestLevel = 3
        expect(isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(true)
      })

      test('should return false for title with equal heading level', () => {
        const item = { type: 'title', headingLevel: 3 }
        const prevLowestLevel = 3
        expect(isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(true)
      })

      test('should return false for title with higher heading level', () => {
        const item = { type: 'title', headingLevel: 3 }
        const prevLowestLevel = 2
        expect(isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(false)
      })

      test('should return false for non-title item', () => {
        const item = { type: 'text' }
        const prevLowestLevel = 2
        expect(isTitleWithEqualOrLowerHeadingLevel(item, prevLowestLevel)).toBe(false)
      })
    })
  }) // end of describe(`${FILENAME}`, () => {
}) // end of describe(`${PLUGIN_NAME}`, () => {
