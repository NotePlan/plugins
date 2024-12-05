/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

import { splitItemsByTags } from '../src/timeblocking-helpers.js'

const PLUGIN_NAME = `dwertheimer.EventAutomations`
const FILENAME = `timeblocking-helpers.js`

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

    describe('splitItemsByTags', () => {
      test('correctly groups items by matching tags', () => {
        const arrayOfItems = [
          { content: 'Item with #foo and #bar', duration: 10 }, // Matches foo and bar
          { content: 'Item with #foo', duration: 5 }, // Matches foo
          { content: 'Item without hashtags', duration: 3 }, // Matches none
          { content: 'Item with #bar', duration: 7 }, // Matches bar
        ]

        const tags = {
          foo: true,
          bar: true,
        }

        const result = splitItemsByTags(arrayOfItems, tags)
        const { matched, unmatched } = result

        // Assert the grouping is correct based on the content structure
        expect(matched.foo).toEqual(expect.arrayContaining([
          { content: 'Item with #foo and #bar', duration: 10 },
          { content: 'Item with #foo', duration: 5 }
        ]))
        expect(matched.bar).toEqual(expect.arrayContaining([
          { content: 'Item with #foo and #bar', duration: 10 },
          { content: 'Item with #bar', duration: 7 }
        ]))
        expect(unmatched).toEqual(expect.arrayContaining([
          { content: 'Item without hashtags', duration: 3 }
        ]))
      })

      test('handles empty arrayOfItems and tags correctly', () => {
        const arrayOfItems = []
        const tags = {}

        const { matched, unmatched } = splitItemsByTags(arrayOfItems, tags)

        expect(matched).toEqual({})
        expect(unmatched).toEqual([])
      })

      test('handles case where no items match any tags', () => {
        const arrayOfItems = [{ hashtags: ['x', 'y'] }, { hashtags: ['z'] }]
        const tags = { foo: ['09:00', '12:00'] }

        const { matched, unmatched } = splitItemsByTags(arrayOfItems, tags)

        expect(matched).toEqual({})
        expect(unmatched).toEqual(expect.arrayContaining(arrayOfItems))
      })
      describe('splitItemsByTags handling multiple matches', () => {
        test('places an item with two matching hashtags under both properties in matched', () => {
        // Assuming getTagsFromString can extract hashtags from the content string
        const arrayOfItems = [
          { content: 'This item matches #multiMatch1 and #multiMatch2', duration: 10 }, // This item matches two tags
          { content: 'This item matches #singleMatch', duration: 5 }, // This item matches only one tag
          { content: 'This item does not match any tag', duration: 3 }, // This item does not match any tag
        ]

        // Define tags with two matching tags and one additional tag that won't match
        const tags = {
          multiMatch1: true,
          multiMatch2: true,
          singleMatch: true,
          unmatchedTag: true,
        }

        const { matched, unmatched } = splitItemsByTags(arrayOfItems, tags)

        // Assert the item is under both matching tag properties in 'matched'
        // The expected objects in the assertions have to match the input structure of arrayOfItems
        expect(matched.multiMatch1).toEqual(expect.arrayContaining([{ content: 'This item matches #multiMatch1 and #multiMatch2', duration: 10 }]))
        expect(matched.multiMatch2).toEqual(expect.arrayContaining([{ content: 'This item matches #multiMatch1 and #multiMatch2', duration: 10 }]))

        // Assert the single match is correctly placed
        expect(matched.singleMatch).toEqual(expect.arrayContaining([{ content: 'This item matches #singleMatch', duration: 5 }]))

        // Assert that 'unmatched' contains the item without any matching tags
        expect(unmatched).toEqual(expect.arrayContaining([{ content: 'This item does not match any tag', duration: 3 }]))

        // Assert the unmatchedTag key does not exist in the matched object
        expect(matched).not.toHaveProperty('unmatchedTag')
        })
      })
    })

    // end of function tests
  }) // end of describe(`${FILENAME}`
}) // // end of describe(`${PLUGIN_NAME}`
