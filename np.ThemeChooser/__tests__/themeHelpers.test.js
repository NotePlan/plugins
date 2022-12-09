// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, expect, beforeAll */
import { CustomConsole /*, LogType, LogMessage */ } from '@jest/console' // see note below
import * as helpers from '../src/support/themeHelpers'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
  Editor.currentTheme = { filename: 'foo' }
})

describe('np.ThemeChooser' /* pluginID */, () => {
  describe('helpers' /* file */, () => {
    /*
     * getPropDifferences()
     */
    describe('getPropDifferences()' /* function */, () => {
      test('should return no differences if there are none', () => {
        const result = helpers.getPropDifferences({ a: 1, b: 2 }, { a: 1, b: 2 })
        expect(result).toEqual([[], []])
      })
    })
    describe('getPropsWithInfo()' /* function */, () => {
      test('should return empty array when no props have _info', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.getPropsWithInfo({ foo: 'bar' })
        expect(result).toEqual([])
      })
      test('should return items which have _info', async () => {
        // tests start with "should" to describe the expected behavior
        const result = await helpers.getPropsWithInfo({ foo: 'bar', foo_info: 'baz', joe: { slam: 'bam' } })
        expect(result).toEqual(['foo'])
      })
    })
    /*
     * getPropNamesOfObjects()
     */
    describe('getPropNamesOfObjects()' /* function */, () => {
      test('should return empty array if no objects', () => {
        const result = helpers.getPropNamesOfObjects({ foo: 'bar' })
        expect(result).toEqual([])
      })
      test('should return an object prop name', () => {
        const result = helpers.getPropNamesOfObjects({ foo: 'bar', bin: 'baz', joe: { slam: 'bam' } })
        expect(result).toEqual(['joe'])
      })
      test('should return an array also', () => {
        const result = helpers.getPropNamesOfObjects({ foo: 'bar', foo_info: 'baz', joe: [{ slam: 'bam' }] })
        expect(result).toEqual(['joe'])
      })
      test('should not return items which are dates', () => {
        const result = helpers.getPropNamesOfObjects({ foo: 'bar', foo_info: 'baz', joe: new Date() })
        expect(result).toEqual([])
      })
      test('should not return items which are info objects', () => {
        const result = helpers.getPropNamesOfObjects({ foo: 'bar', foo_info: { bar: 'baz' }, joe: new Date() })
        expect(result).toEqual([])
      })
    })
    /*
     * getThemePropertiesInfoText()
     * skipping for now because it's not technically a pure file anymore (accesses Editor)
     */
    describe.skip('getThemePropertiesInfoText()' /* function */, () => {
      test('should create a theme example line', () => {
        const input = { foo: 'bar', foo_info: { description: 'baz', type: 'string', example: 'joe' } }
        const result = helpers.getThemePropertiesInfoText(input)
        expect(result.length).toEqual(1)
        expect(result[0]).toMatch(/## foo: baz \[Change\]\(noteplan:.*arg0=foo/)
      })
      test('should create a theme example line nested down a layer', () => {
        const input = { foo: 'bar', fafa: { foo_info: { description: 'baz', type: 'string', example: 'joe' } } }
        const result = helpers.getThemePropertiesInfoText(input)
        expect(result.length).toEqual(1)
        expect(result[0]).toMatch(/## foo: baz \[Change\]\(noteplan:.*arg0=fafa.foo/)
      })
      test('should create a theme example line nested down two layers', () => {
        const input = { foo: 'bar', fafa: { gaga: { foo_info: { description: 'baz', type: 'string', example: 'joe' } } } }
        const result = helpers.getThemePropertiesInfoText(input)
        expect(result.length).toEqual(1)
        expect(result[0]).toMatch(/## foo: baz \[Change\]\(noteplan:.*arg0=fafa.gaga.foo/)
      })
      test('should create a theme example lines at different layers', () => {
        const input = { foo: 'bar', fafa: { foo_info: { description: 'baz', type: 'string', example: 'joe' } }, goya_info: { description: 'gdesk' } }
        const result = helpers.getThemePropertiesInfoText(input)
        expect(result.length).toEqual(2)
        expect(result[0]).toMatch(/## goya: gdesk \[Change\]\(noteplan:.*arg0=goya/)
        expect(result[1]).toMatch(/## foo: baz \[Change\]\(noteplan:.*arg0=fafa.foo/)
      })
    })
  })
})
