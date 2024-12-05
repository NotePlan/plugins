/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { filterCommands } from '../support/filterFunctions.jsx'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `np.plugin-test`
const FILENAME = `support/filterFunctions.js`

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

// Mock data for testing
const pluginList = [
  {
    name: 'Plugin 1',
    desc: 'bar',
    commands: [
      { name: 'Command 1', desc: 'Description 1' },
      { name: 'Command 2', desc: 'Description 2' },
    ],
  },
  {
    name: 'Plugin 2',
    desc: 'foo',
    commands: [
      { name: 'Command 3', desc: 'Description 3' },
      { name: 'Command 4', desc: 'Description 4' },
    ],
  },
]
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
    // Test case for filtering commands with a filter
    test('filterCommands should filter commands based on the filter (command name) and return all commands if any pass', () => {
      const filter = 'command 1'
      const filteredPlugins = filterCommands({ pluginList, filter })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 1',
          desc: 'bar',
          commands: [
            { name: 'Command 1', desc: 'Description 1' },
            { name: 'Command 2', desc: 'Description 2' },
          ],
        },
      ])
    })
    test('filterCommands should filter commands based on the filter (command desc) and return all commands if any pass', () => {
      const filter = 'Description 1'
      const filteredPlugins = filterCommands({ pluginList, filter })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 1',
          desc: 'bar',
          commands: [
            { name: 'Command 1', desc: 'Description 1' },
            { name: 'Command 2', desc: 'Description 2' },
          ],
        },
      ])
    })
    // Test case for filtering commands with a filter but returning only matching commands
    test('filterCommands should filter commands but returning only matching commands', () => {
      const filter = 'command 1'
      const filteredPlugins = filterCommands({ pluginList, filter, returnOnlyMatchingCommands: true })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 1',
          desc: 'bar',
          commands: [{ name: 'Command 1', desc: 'Description 1' }],
        },
      ])
    })
    // Test case for filtering plugins with a category filter
    test('filterCommands should filter plugins based on the category filter', () => {
      const categoryFilter = 'foo'
      const filteredPlugins = filterCommands({ pluginList, categoryFilter })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [
            { name: 'Command 3', desc: 'Description 3' },
            { name: 'Command 4', desc: 'Description 4' },
          ],
        },
      ])
    })
    // Test case for filtering commands with a category filter
    // skipping for now because category filter does not currently apply to commands (only plugin.desc)
    test.skip('filterCommands should filter commands based on the category filter', () => {
      const categoryFilter = 'command 3'
      const filteredPlugins = filterCommands({ pluginList, categoryFilter })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [
            { name: 'Command 3', desc: 'Description 3' },
            { name: 'Command 4', desc: 'Description 4' },
          ],
        },
      ])
    })
    // Test case for filtering commands with a category filter with CSV terms
    // skipping for now because category filter does not currently apply to commands (only plugin.desc)
    test.skip('filterCommands should filter commands with a category filter with CSV terms', () => {
      const categoryFilter = 'foo,command 3'
      const filteredPlugins = filterCommands({ pluginList, categoryFilter })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [
            { name: 'Command 3', desc: 'Description 3' },
            { name: 'Command 4', desc: 'Description 4' },
          ],
        },
      ])
    })

    // Test case for returning only matching commands
    test('filterCommands should filter commands based on both filter and category filter', () => {
      const filter = 'command 3'
      const filteredPlugins = filterCommands({ pluginList, filter, returnOnlyMatchingCommands: true })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [{ name: 'Command 3', desc: 'Description 3' }],
        },
      ])
    })

    // Test case for filtering commands with both filter and category filter
    // skipping for now because category filter does not currently apply to commands (only plugin.desc)
    test.skip('filterCommands should filter commands based on both filter and category filter', () => {
      const filter = 'command'
      const categoryFilter = '3'
      const filteredPlugins = filterCommands({ pluginList, filter, categoryFilter, returnOnlyMatchingCommands: true })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [{ name: 'Command 3', desc: 'Description 3' }],
        },
      ])
    })

    // Test case for filtering commands with both filter and category filter
    // skipping for now because category filter does not currently apply to commands (only plugin.desc)
    test.skip('filterCommands should filter commands based on both filter and category filter', () => {
      const filter = 'command'
      const categoryFilter = '3'
      const filteredPlugins = filterCommands({ pluginList, filter, categoryFilter, returnOnlyMatchingCommands: true })

      expect(filteredPlugins).toEqual([
        {
          name: 'Plugin 2',
          desc: 'foo',
          commands: [{ name: 'Command 3', desc: 'Description 3' }],
        },
      ])
    })

    // Test case for returning null when no matching commands are found and returnOnlyMatchingCommands is true
    test('filterCommands should return null when no matching commands are found and returnOnlyMatchingCommands is true', () => {
      const filter = 'non-existent'
      const filteredPlugins = filterCommands({ pluginList, filter, returnOnlyMatchingCommands: true })

      expect(filteredPlugins).toEqual([])
    })

    // Specific test
    test('should filter on actual plugin', () => {
      const filter = 'passed'
      const categoryFilter = 'event'
      const pluginList = [
        {
          documentation: 'CorePlugins',
          id: 'np.MeetingNotes',
          installedVersion: '1.2.0',
          version: '1.2.0',
          repoUrl: 'CorePlugins',
          author: 'NotePlan',
          isInstalled: true,
          installLink: 'noteplan://x-callback-url/runPlugin?pluginID=np.plugin-test&command=Install%20Plugin%20and%20Re-Generate%20Listing&arg0=false',
          commands: [
            {
              pluginName: '✍️ Meeting Notes',
              arguments: [],
              isHidden: false,
              name: 'newMeetingNote',
              desc: 'Create a meeting note by choosing an event and a template.',
              pluginID: 'np.MeetingNotes',
            },
            {
              pluginName: '✍️ Meeting Notes',
              arguments: [],
              isHidden: true,
              name: 'newMeetingNoteFromEventID',
              desc: 'Create a meeting note for a passed EventID.',
              pluginID: 'np.MeetingNotes',
            },
            {
              pluginName: '✍️ Meeting Notes',
              arguments: [],
              isHidden: true,
              name: 'insertNoteTemplate',
              desc: 'Inserts a template into the current note',
              pluginID: 'np.MeetingNotes',
            },
          ],
          desc: 'Create Meeting Notes from events using templates.',
          isOnline: false,
          script: 'script.js',
          isHidden: false,
          hidden: false,
          updateIsAvailable: false,
          name: '✍️ Meeting Notes',
        },
      ]
      const filteredPlugins = filterCommands({ pluginList, filter, categoryFilter, returnOnlyMatchingCommands: true })
      //       expect(result).toEqual(expect.objectContaining({ field1: true, field2: 'someString'}))
      expect(filteredPlugins.length).toEqual(1)
      expect(filteredPlugins[0].commands.length).toEqual(1)
    })
  })
})
