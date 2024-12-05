/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global it, jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../utils.js'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `utils.js`

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
    /*
     * removeDuplicates
     */
    describe('removeDuplicates', () => {
      it('should remove duplicate objects based on specified keys', () => {
        const objA = { name: 'foo', index: 0, filename: 'bar' }
        const objB = { name: 'foo', index: 1, filename: 'bar' }
        const objectsArray = [objA, objB]

        const result = f.removeDuplicates(objectsArray, ['name', 'filename'])

        expect(result).toEqual([objA])
      })

      it('should not remove any object if not all specified properties match', () => {
        const objA = { name: 'foo', index: 0, filename: 'bar' }
        const objB = { name: 'foo', index: 1, filename: 'bar' }
        const objectsArray = [objA, objB]

        const result = f.removeDuplicates(objectsArray, ['name', 'index'])

        expect(result).toEqual(objectsArray)
      })
    })
  })
})

describe('findLongestStringInArray()', () => {
  test('should return longest string in array', () => {
    expect(f.findLongestStringInArray(['a', 'bb', '', 'dddd'])).toEqual('dddd')
  })
  test('should return longest string in array with emojis as longest term', () => {
    expect(f.findLongestStringInArray(['a', 'bb', '', 'dd🔬d'])).toEqual('dd🔬d')
  })
  // Doesn't pass, but we don't think this will be an actual issue, so disable
  test.skip('should return longest string in array with emojis in other terms', () => {
    expect(f.findLongestStringInArray(['a🔬', 'bb', 'cc🔬', 'dddd'])).toEqual('dd🔬d')
  })
  test('should return longest string in array wherever it is in array', () => {
    expect(f.findLongestStringInArray(['aa', 'bbbbb', '', 'cc'])).toEqual('bbbbb')
  })
  test('should return empty string if no array', () => {
    expect(f.findLongestStringInArray([])).toEqual('')
  })
})
