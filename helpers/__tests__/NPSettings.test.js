/* eslint-disable import/order */
/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../NPSettings'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import * as samplePlugin from '@mocks/support/pluginSample.json'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPSettings`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
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
To use factories (from the factories folder inside of __tests__):
      const templateData = await factory('dates.ejs')

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
     * getSettingsOptions()
     */
    describe('getSettingsOptions() - ignores separators' /* function */, () => {
      test('should get settings options without hidden (default)', () => {
        const result = f.getSettingsOptions(samplePlugin['plugin.settings'])
        expect(result.length).toEqual(9)
      })
      test('should get settings options with hidden', () => {
        const result = f.getSettingsOptions(samplePlugin['plugin.settings'], true)
        expect(result.length).toEqual(10)
      })
    })
  })
})
