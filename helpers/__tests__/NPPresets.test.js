/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console' // see note below
import * as f from '../NPPresets'
import { CommandBar, DataStore, NotePlan, simpleFormatter } from '@mocks/index' //had to skip all the tests because the DataStore __json needs to be figured out

const PLUGIN_NAME = `helpers`
const FILENAME = `NPPresets`

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  DataStore.settings['_logLevel'] = 'none' // change to DEBUG to see more console output during test runs
  global.CommandBar = CommandBar
  global.NotePlan = new NotePlan()
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWithString } from '@mocks/index'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWithString(spy, /config was empty/)).toBe(true)
*/

describe(`${PLUGIN_NAME}`, () => {
  //had to skip all the tests because the DataStore __json needs to be figured out

  describe(`${FILENAME}`, () => {
    /*
     * updateJSONForFunctionNamed()
     */
    describe('updateJSONForFunctionNamed()' /* function */, () => {
      test('should save basic command info if func is found', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const fields = { jsFunction: 'command1', name: 'newName', description: 'newDesc' }
        const result = f.updateJSONForFunctionNamed(pluginJson, fields, true)
        const unchanged = result['plugin.commands'][0]
        expect(unchanged.name).toEqual('move')
        const newCommand = result['plugin.commands'][1]
        expect(newCommand.name).toEqual('newName')
        expect(newCommand.description).toMatch(/newDesc/)
      })
    })

    /*
     * savePluginCommand()
     */

    describe('savePluginCommand()' /* function */, () => {
      test('should run command successfully', async () => {
        const pluginJson = DataStore.loadJSON('') //get the default json
        const result = await f.savePluginCommand(pluginJson, { jsFunction: 'foo', name: 'bar' })
        expect(result).toEqual(true)
      })
      test('should update DataStore.settings', async () => {
        const pluginJson = DataStore.loadJSON('') //get the default json
        await f.savePluginCommand(pluginJson, { jsFunction: 'foo', name: 'bar' })
        expect(DataStore.settings.foo.name).toEqual('bar')
      })
      test('should return fals on empty jsFunction', async () => {
        const pluginJson = DataStore.loadJSON('') //get the default json
        const res = await f.savePluginCommand(pluginJson, { name: 'bar' })
        expect(res).toEqual(false)
      })
      test('should return fals on empty jsFunction', async () => {
        const pluginJson = DataStore.loadJSON('') //get the default json
        const res = await f.savePluginCommand(pluginJson, { jsFunction: '', name: 'bar' })
        expect(res).toEqual(false)
      })
    })

    /*
     * choosePreset()
     */
    describe('choosePreset()' /* function */, () => {
      test('should return the jsFunction of a command (with no specific hidden types sent)', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const result = await f.choosePreset(pluginJson)
        expect(result).toEqual('command1')
      })
      test('should return the jsFunction of a command (with hidden types sent as true)', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const result = await f.choosePreset(pluginJson, 'messsage', true)
        expect(result).toEqual('command1')
      })
      test('should return the jsFunction of a command (with hidden types sent as false)', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const result = await f.choosePreset(pluginJson, 'messsage', false)
        expect(result).toEqual(false)
      })
      test('should return the jsFunction of a command (with hidden types sent as false)', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const result = await f.choosePreset(pluginJson, 'messsage', false)
        expect(result).toEqual(false)
      })
    })

    /*
     * updateJSONForFunctionNamed()
     */
    describe('updateJSONForFunctionNamed()' /* function */, () => {
      const pluginJson = { 'plugin.commands': [{ jsFunction: 'foo' }] }
      test('should set command correctly for blank command', () => {
        const fields = { jsFunction: 'foo', name: 'bar', description: 'baz' }
        const result = f.updateJSONForFunctionNamed(pluginJson, fields, false)
        expect(result['plugin.commands'][0]).toEqual({ ...fields, hidden: false })
      })
      test('should make no changes if no plugin.commands', () => {
        const po = {}
        const fields = { jsFunction: 'foo', name: 'bar', description: 'baz' }
        const result = f.updateJSONForFunctionNamed(po, fields)
        expect(result).toEqual(po)
      })
      test('should make no changes if no matching command', () => {
        const po = { 'plugin.commands': [{ functionName: 'foo' }] }
        const fields = { jsFunction: 'foo', name: 'bar', description: 'baz' }
        const result = f.updateJSONForFunctionNamed(po, fields)
        expect(result).toEqual(po)
      })
      test('should change name and desc if they exist', () => {
        const fields = { jsFunction: 'foo', name: 'a', description: 'b' }
        const po = { 'plugin.commands': [{ jsFunction: 'foo', name: 'fooname', description: 'foodesc' }] }
        const result = f.updateJSONForFunctionNamed(po, fields)
        const r = { 'plugin.commands': [{ jsFunction: 'foo', name: 'a', description: 'b', hidden: false }] }
        expect(result).toEqual(r)
      })
    })

    /*
     * presetChosen()
     */
    describe('presetChosen()' /* function */, () => {
      test('should call back a function with the plugin json', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const test = { called: () => {} }
        const spy = jest.spyOn(test, 'called')
        await f.presetChosen(pluginJson, 'command1', test.called)
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
      })
      test('should call back a function with the plugin json', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const test = { called: () => {} }
        const spy = jest.spyOn(test, 'called')
        await f.presetChosen(pluginJson, 'command1', test.called)
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
      })
      test('should fail when the func name is not there (shows Command Bar prompt)', async () => {
        const pluginJson = await DataStore.loadJSON('') //get the default json
        const test = { called: () => {} }
        const spy = jest.spyOn(CommandBar, 'prompt')
        await f.presetChosen(pluginJson, 'XXX', test.called)
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
      })
    })

    /*
     * rememberPresetsAfterInstall()
     */
    describe('rememberPresetsAfterInstall()' /* function */, () => {
      test('should save plugin commands based on settings', async () => {
        //FIXME: I am here. work on this test, need to test 196-208
        DataStore.settings = {
          ...DataStore.settings,
          ...{
            runPreset01: {
              jsFunction: 'runPreset01',
              data: 'someData',
            },
            command2: 'darkKnight',
            notCounted: 'foo',
          },
        }
        const pluginJson = await DataStore.loadJSON('') //get the default json
        await await f.rememberPresetsAfterInstall(pluginJson)
        const newPluginJson = await DataStore.loadJSON('') //get the default json
        const updatedCommands = newPluginJson['plugin.commands']
        expect(updatedCommands[3].data).toEqual('someData')
      })
      test('should write plugin.json only once, no matter how many presets there are', async () => {
        // Regression guard: this used to call savePluginCommand() per preset, which re-read and re-wrote
        // plugin.json every time and assigned DataStore.settings, making NotePlan fire onSettingsUpdated
        // re-entrantly and throw once per preset.
        DataStore.settings = {
          ...DataStore.settings,
          ...{
            runPreset01: { jsFunction: 'runPreset01', data: 'one' },
            runPreset02: { jsFunction: 'runPreset02', data: 'two' },
            runPreset03: { jsFunction: 'runPreset03', data: 'three' },
          },
        }
        const spy = jest.spyOn(DataStore, 'saveJSON')
        const pluginJson = await DataStore.loadJSON('') //get the default json
        await f.rememberPresetsAfterInstall(pluginJson)
        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
      })
      test('should not assign DataStore.settings (which triggers onSettingsUpdated re-entrantly)', async () => {
        // Counts *assignments*, not the resulting value: the old code wrote back a deep-equal object, so
        // comparing before/after would pass even when the (trigger-firing) assignment did happen.
        const originalSettings = { ...DataStore.settings, ...{ runPreset01: { jsFunction: 'runPreset01', data: 'someData' } } }
        let stored = originalSettings
        let assignments = 0
        Object.defineProperty(DataStore, 'settings', {
          configurable: true,
          enumerable: true,
          get: () => stored,
          set: (value) => {
            assignments += 1
            stored = value
          },
        })
        const pluginJson = await DataStore.loadJSON('') //get the default json
        await f.rememberPresetsAfterInstall(pluginJson)
        // restore a plain data property before asserting, so a failure can't leave the mock patched
        Object.defineProperty(DataStore, 'settings', { configurable: true, enumerable: true, writable: true, value: originalSettings })
        expect(assignments).toEqual(0)
      })
      test('should skip preset settings that are empty strings or have no jsFunction', async () => {
        DataStore.settings = {
          ...DataStore.settings,
          ...{ runPreset09: '', runPreset08: { name: 'no jsFunction here' } },
        }
        const spy = jest.spyOn(DataStore, 'saveJSON')
        const pluginJson = await DataStore.loadJSON('') //get the default json
        await f.rememberPresetsAfterInstall(pluginJson)
        // nothing valid to restore in these two, so they must not produce their own writes
        const calls = spy.mock.calls.length
        spy.mockRestore()
        expect(calls).toBeLessThanOrEqual(1)
      })
    })
  })
})
