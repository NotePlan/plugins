/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, it, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { migrateCommandsIfNecessary, pluginIsInstalled, findPluginInList, pluginUpdated } from '../NPConfiguration' // Adjust the import path

import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { logDebug } from '@helpers/dev' // Adjust the import path
import { showMessageYesNo } from '@helpers/userInput'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPConfiguration`

jest.mock('../NPConfiguration', () => {
  const originalModule = jest.requireActual('../NPConfiguration')
  return {
    ...originalModule,
    pluginIsInstalled: jest.fn(),
    findPluginInList: jest.fn(),
    logDebug: jest.fn(),
    pluginUpdated: jest.fn(),
  }
})

jest.mock('@helpers/userInput', () => {
  const originalModule = jest.requireActual('@helpers/userInput')
  return {
    ...originalModule,
    showMessageYesNo: jest.fn(),
  }
})

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
     * migrateCommandsIfNecessary()
     */
    describe('migrateCommandsIfNecessary', () => {
      beforeEach(() => {
        jest.clearAllMocks()
      })

      it('should do nothing if offerToDownloadPlugin is not present', async () => {
        DataStore.listPlugins = jest.fn()
        DataStore.listPlugins.mockResolvedValueOnce([{ id: 'np.Tidy', version: '2.18.0', name: 'Tidy Plugin' }])
        const result = await migrateCommandsIfNecessary({})
        expect(result).toBeUndefined()
        expect(DataStore.listPlugins).not.toHaveBeenCalled()
        expect(pluginIsInstalled).not.toHaveBeenCalled()
      })

      it('should do nothing if the plugin is already installed', async () => {
        pluginIsInstalled.mockReturnValueOnce(true)
        DataStore.installedPlugins = jest.fn()
        DataStore.installedPlugins.mockResolvedValueOnce([{ id: 'np.Tidy', version: '2.18.0', name: 'Tidy Plugin' }])
        const result = await migrateCommandsIfNecessary({ offerToDownloadPlugin: { id: 'np.Tidy', minVersion: '2.18.0' } })
        expect(DataStore.listPlugins).not.toHaveBeenCalled()
        expect(showMessageYesNo).not.toHaveBeenCalled()
      })

      it('should prompt user to install the plugin if not installed and available', async () => {
        pluginIsInstalled.mockResolvedValueOnce(false)
        const thePlugin = { id: 'np.Tidy', version: '2.18.0', name: 'Tidy Plugin' }
        DataStore.listPlugins.mockResolvedValueOnce([thePlugin])
        findPluginInList.mockReturnValueOnce(thePlugin)
        showMessageYesNo.mockResolvedValueOnce('Yes')
        DataStore.installPlugin = jest.fn()
        DataStore.installPlugin.mockResolvedValueOnce(true)
        // it will be called twice during the test. need 2 different return values
        DataStore.installedPlugins.mockReturnValueOnce([]).mockReturnValueOnce([thePlugin])
        findPluginInList.mockReturnValueOnce(thePlugin)

        await migrateCommandsIfNecessary({
          offerToDownloadPlugin: { id: 'np.Tidy', minVersion: '2.18.0' },
          commandMigrationMessage: 'Task Sorting commands have moved...',
        })
        expect(DataStore.installPlugin).toHaveBeenCalledWith({ id: 'np.Tidy', name: 'Tidy Plugin', version: '2.18.0' }, false)
        expect(showMessageYesNo.mock.calls.length).toEqual(2) // once for should install, once after install (pluginUpdated())
        expect(showMessageYesNo).toHaveBeenNthCalledWith(1, expect.stringContaining('Task Sorting commands have moved...'), expect.any(Array), expect.any(String))
        expect(showMessageYesNo).toHaveBeenNthCalledWith(2, expect.stringContaining('plugin was installed'), expect.any(Array), expect.any(String))
      })

      it('should not install the plugin if user says no', async () => {
        pluginIsInstalled.mockResolvedValueOnce(false)
        const thePlugin = { id: 'np.Tidy', version: '2.18.0', name: 'Tidy Plugin' }
        DataStore.listPlugins.mockResolvedValueOnce([thePlugin])
        findPluginInList.mockReturnValueOnce(thePlugin)
        showMessageYesNo.mockResolvedValueOnce('No')
        DataStore.installPlugin = jest.fn()
        DataStore.installPlugin.mockResolvedValueOnce(true)
        DataStore.installedPlugins.mockReturnValueOnce([]).mockReturnValueOnce([thePlugin])
        findPluginInList.mockReturnValueOnce(thePlugin)

        await migrateCommandsIfNecessary({
          offerToDownloadPlugin: { id: 'np.Tidy', minVersion: '2.18.0' },
          commandMigrationMessage: 'Task Sorting commands have moved...',
        })
        expect(DataStore.installPlugin).not.toHaveBeenCalled()
        expect(showMessageYesNo.mock.calls.length).toEqual(1) // once for should install
      })

      // Additional tests for other scenarios...
    })
    // end of function tests
  }) // end of describe(`${FILENAME}`
}) // // end of describe(`${PLUGIN_NAME}`
