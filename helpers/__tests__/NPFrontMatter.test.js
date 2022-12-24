/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console' // see note below
import * as f from '../NPFrontMatter'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, mockWasCalledWithString /* , Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `NPFrontMatter`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
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
     * hasFrontMatter()
     */
    describe('hasFrontMatter()' /* function */, () => {
      test('should return true if there is frontmatter', () => {
        const text = '---\nfoo: bar\n---\n'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(true)
      })
      test('should return false if there is nofrontmatter', () => {
        const text = 'foo: bar'
        const result = f.hasFrontMatter(text)
        expect(result).toEqual(false)
      })
    })

    /*
     * getFrontMatterAttributes()
     */
    describe('getFrontMatterAttributes()' /* function */, () => {
      test('should return false if no frontmatter', () => {
        const result = f.getFrontMatterAttributes({ content: '' })
        expect(result).toEqual(false)
      })
      test('should return empty object if empty frontmatter', () => {
        const text = '---\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({})
      })
      test('should return object with frontmatter vars and boolean values', () => {
        const text = '---\nfield1: true\nfield2: false\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({ field1: true, field2: false })
      })
      test('should return object with frontmatter vars', () => {
        const text = '---\nfield1: true\nfield2: foo\n---\n'
        const result = f.getFrontMatterAttributes({ content: text })
        expect(result).toEqual({ field1: true, field2: 'foo' })
      })
    })

    /*
     * ensureFrontmatter()
     */
    describe('ensureFrontmatter()' /* function */, () => {
      test('should return false if note is null or undefined', async () => {
        const note = undefined
        const result = await f.ensureFrontmatter(note)
        expect(result).toEqual(false)
      })
      test('should return true if already has frontmatter', async () => {
        const note = { content: '---\nfoo: bar\n---\n' }
        const result = await f.ensureFrontmatter(note)
        expect(result).toEqual(true)
      })
      test('should return true if already has frontmatter but change title', async () => {
        const note = { content: '---\ntitle: bar\n---\n' }
        const result = await f.ensureFrontmatter(note, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should set note title if had no title', async () => {
        const note = { content: '---\nsam: bar\n---\n' }
        const result = await f.ensureFrontmatter(note, 'baz')
        expect(result).toEqual(true)
        expect(note.content).toMatch(/title: baz/)
      })
      test('should return false if no content and no title', async () => {
        const note = { paragraphs: [], content: '' }
        const result = await f.ensureFrontmatter(note)
        expect(result).toEqual(false)
      })
      test('should return true if no content but with title', async () => {
        const note = new Note({ paragraphs: [], content: '', prependParagraph: () => {} })
        const spy = jest.spyOn(note, 'prependParagraph')
        const result = await f.ensureFrontmatter(note, 'baz')
        expect(result).toEqual(true)
        expect(mockWasCalledWithString(spy, /title: baz/)).toEqual(true)
      })
    })
  })
})
