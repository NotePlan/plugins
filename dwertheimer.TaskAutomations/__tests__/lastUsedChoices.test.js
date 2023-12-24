/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
// import * as f from '../src/filenameBeingMocked'
import moment from 'moment/min/moment-with-locales'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import {
  getNumLastUsedChoices,
  shouldSaveChoice,
  getAllLastUsedChoices,
  getLimitedLastUsedChoices,
  getArrowDateFromRelativeDate,
  updateLastUsedChoices,
} from '../src/lastUsedChoices'

const PLUGIN_NAME = `dwertheimer.TaskAutomations`
const FILENAME = `lastUsedChoices`

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
     * getNumLastUsedChoices()
     */
    describe('getNumLastUsedChoices()' /* function */, () => {
      test('should return a number from DataStore settings', () => {
        DataStore.settings.numLastUsedChoices = '5'
        const result = getNumLastUsedChoices()
        expect(result).toEqual(5)
      })

      test('should return 0 if no number is set in DataStore settings', () => {
        DataStore.settings.numLastUsedChoices = undefined
        const result = getNumLastUsedChoices()
        expect(result).toEqual(0)
      })
    })

    /*
     * getAllLastUsedChoices()
     */
    describe('getAllLastUsedChoices()' /* function */, () => {
      test('should return an object parsed from a JSON string in DataStore settings', () => {
        DataStore.settings.lastUsedChoicesJsonStr = '{"choice1":1,"choice2":2}'
        const result = getAllLastUsedChoices()
        expect(result).toEqual({ choice1: 1, choice2: 2 })
      })

      test('should return an empty object if JSON string is not set in DataStore settings', () => {
        DataStore.settings.lastUsedChoicesJsonStr = undefined
        const result = getAllLastUsedChoices()
        expect(result).toEqual({})
      })
    })

    /*
     * getLimitedLastUsedChoices()
     */
    describe('getLimitedLastUsedChoices()' /* function */, () => {
      test('should return a limited array of last used choices', () => {
        DataStore.settings.numLastUsedChoices = '2'
        DataStore.settings.lastUsedChoicesJsonStr = '{"choice1":1,"choice2":2,"choice3":3}'
        const result = getLimitedLastUsedChoices()
        expect(result).toEqual(['choice2', 'choice3'])
      })

      test('should return an empty array if no choices are available', () => {
        DataStore.settings.numLastUsedChoices = '2'
        DataStore.settings.lastUsedChoicesJsonStr = undefined
        const result = getLimitedLastUsedChoices()
        expect(result).toEqual([])
      })
    })

    /*
     * getArrowDateFromRelativeDate()
     */
    describe('getArrowDateFromRelativeDate()' /* function */, () => {
      test('should return a formatted date for a positive relative date', () => {
        const result = getArrowDateFromRelativeDate('rel+5')
        const expectedDate = moment().add(5, 'days').format('>YYYY-MM-DD')
        expect(result).toEqual(expectedDate)
      })

      test('should return a formatted date for a negative relative date', () => {
        const result = getArrowDateFromRelativeDate('rel-3')
        const expectedDate = moment().subtract(3, 'days').format('>YYYY-MM-DD')
        expect(result).toEqual(expectedDate)
      })

      test('should return the input date if it does not start with "rel"', () => {
        const result = getArrowDateFromRelativeDate('>2023-01-01')
        expect(result).toEqual('>2023-01-01')
      })
    })

    /*
     * shouldSaveChoice()
     */
    describe('shouldSaveChoice', () => {
      test('returns false for specific date choices', () => {
        expect(shouldSaveChoice({ label: '>20231109', value: '>20231109' })).toBe(false)
      })

      test('returns false for specific week choices', () => {
        expect(shouldSaveChoice({ label: 'Weekly Note - Week 40', value: '>2023-W01' })).toBe(false)
      })

      test('returns false for general week choices', () => {
        expect(shouldSaveChoice({ label: '>thisweek Weekly Note', value: '>2023-W01' })).toBe(false)
      })

      test('returns true for non-date/week choices', () => {
        expect(shouldSaveChoice({ label: 'Edit task', value: '__edit__' })).toBe(true)
      })

      test('returns false for __opentask__', () => {
        expect(shouldSaveChoice({ label: 'open task', value: '__opentask__' })).toBe(false)
      })

      test('returns false for __skip__', () => {
        expect(shouldSaveChoice({ label: '--- leave where it is --', value: '__skip__' })).toBe(false)
      })

      test('handles empty labels gracefully', () => {
        expect(shouldSaveChoice({ label: '' })).toBe(true)
      })
    })

    /*
     * updateLastUsedChoices()
     */
    describe('updateLastUsedChoices()', () => {
      test('should increment the count of a choice in last used choices', () => {
        const commandBarSelection = { label: 'choicelabel', value: 'choicevalue' }
        DataStore.settings.lastUsedChoicesJsonStr = JSON.stringify({ choicevalue: 1 })
        const expectedSavedCommands = { choicevalue: 2 }

        updateLastUsedChoices(commandBarSelection)

        expect(DataStore.settings.lastUsedChoicesJsonStr).toEqual(JSON.stringify(expectedSavedCommands))
      })

      test('should add a new choice in last used choices if it does not exist', () => {
        const commandBarSelection = { value: 'newChoice', label: 'newLabel' }
        DataStore.settings.lastUsedChoicesJsonStr = JSON.stringify({})
        const expectedSavedCommands = { newChoice: 1 }

        updateLastUsedChoices(commandBarSelection)

        expect(DataStore.settings.lastUsedChoicesJsonStr).toEqual(JSON.stringify(expectedSavedCommands))
      })

      test('should not save specific week choices', () => {
        const commandBarSelection = { label: 'Weekly Note (Sat, 2023-11-11)' }
        DataStore.settings.lastUsedChoicesJsonStr = JSON.stringify({})
        const expectedSavedCommands = {}

        updateLastUsedChoices(commandBarSelection)

        expect(DataStore.settings.lastUsedChoicesJsonStr).toEqual(JSON.stringify(expectedSavedCommands))
      })
    })
  })
})
