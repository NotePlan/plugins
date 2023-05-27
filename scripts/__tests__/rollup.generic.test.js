/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

import { getRollupConfig, rollupReactFiles } from '../rollup.generic'

const PLUGIN_NAME = `scripts`
const FILENAME = `rollup.generic.test`

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
expect(result).toEqual([])
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
    /*
     * getRollupConfig()
     */
    describe('getRollupConfig()' /* function */, () => {
      test('should fail if you dont provide a input/output path', async () => {
        expect(() => getRollupConfig({})).toThrow()
      })
      test('should pass paths appropriately', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar' }
        const result = getRollupConfig(input)
        expect(result.input).toContain('foo')
        expect(result.output.file).toContain('bar')
        expect(result.output.format).toEqual('iife')
      })
      test('should replace REPLACEME text in output filename for dev', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar.REPLACEME.js' }
        const result = getRollupConfig(input)
        expect(result.output.file).toContain('bar.dev.js')
      })
      test('should replace REPLACEME text in output filename for dev', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar.REPLACEME.js', buildMode: 'production' }
        const result = getRollupConfig(input)
        expect(result.output.file).toContain('bar.min.js')
      })
      test('should create 5 plugins for default (development) version', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar' }
        const result = getRollupConfig(input)
        expect(result.plugins.length).toEqual(5)
      })
      test('should create 6 plugins for version with bundlegraph', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar', createBundleGraph: true }
        const result = getRollupConfig(input)
        expect(result.plugins.length).toEqual(6)
      })
      test('should create 1 output plugin (terser) for default (production) version', () => {
        const input = { entryPointPath: 'foo', outputFilePath: 'bar', buildMode: 'production' }
        const result = getRollupConfig(input)
        expect(result.output.plugins.length).toEqual(1) // terser
      })
    })
  })
})
