// @flow
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect, beforeAll */

//               expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/ERROR/))

import * as mainFile from '../src/NPTimeblocking'
import * as configFile from '../src/config'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'
import { unhyphenatedDate } from '@helpers/dateTime'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

/* note: {
		"filename": "_TEST/New Note - 15.3950.md",
		"type": "Notes",
		"title": "MyNoteTitle",
		"changedDate": "2022-06-12T20:23:27.705Z",
		"createdDate": "2022-06-12T20:23:15.402Z",
		"hashtags": [],
		"mentions": [],
		"linkedItems": [],
		"datedTodos": [],
		"backlinks": [],
		"frontmatterTypes": [],
		"content": "# MyNoteTitle
    * one task in the note",
		"paragraphs": [
				"{"type":"title","content":"MyNoteTitle","rawContent":"# MyNoteTitle","prefix":"# ","contentRange":{},"lineIndex":0,"heading":"","headingLevel":1,"isRecurring":false,"indents":0,"filename":"_TEST/New Note - 15.3950.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}",
				"{"type":"open","content":"one task in the note","rawContent":"* one task in the note","prefix":"* ","contentRange":{},"lineIndex":1,"heading":"MyNoteTitle","headingRange":{},"headingLevel":1,"isRecurring":false,"indents":0,"filename":"_TEST/New Note - 15.3950.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[],"referencedBlocks":[],"note":{}}"
		]
} ,  */

const paragraphs = [new Paragraph({ content: 'line1' }), new Paragraph({ content: 'line2' })]
const note = new Note({ paragraphs })
note.filename = `${unhyphenatedDate(new Date())}.md`
Editor.note = note
Editor.filename = note.filename

/**
 * Check if a spy was called (at any point) with a regex
 * @param { JestSpyType } spy
 * @param {*} regex - a regex to match the spy call's arguments
 * @returns {boolean} was called or not
 */
export const mockWasCalledWith = (spy: JestSpyType, regex: RegExp) => {
  let found = []
  if (spy?.mock?.calls?.length) {
    const calls = spy.mock.calls
    found = calls.filter((call) => call.find((arg) => regex.test(arg)))
  }
  return found.length > 0
}

describe('dwertheimer.EventAutomations' /* pluginID */, () => {
  describe('NPTimeblocking.js' /* file */, () => {
    /*
     * getConfig()
     */
    describe('getConfig()' /* function */, () => {
      // test('should XXX', () => {
      //   const result = mainFile.getConfig()
      //   expect(result).toEqual(true)
      // })
      test('should return default config if getting config fails', () => {
        const result = mainFile.getConfig()
        expect(Object.keys(result).length).toBeGreaterThan(1)
      })
      test('should return default config if no settings set', () => {
        const oldSettings = DataStore.settings
        DataStore.settings = undefined
        const result = mainFile.getConfig()
        expect(Object.keys(result).length).toBeGreaterThan(1)
        DataStore.settings = oldSettings
      })
      test('should return default config', () => {
        const result = mainFile.getConfig()
        expect(Object.keys(result).length).toBeGreaterThan(1)
      })
      test('should complain about improper config', () => {
        const oldSettings = DataStore.settings
        DataStore.settings = { improper: 'key' }
        const spy = jest.spyOn(console, 'log')
        mainFile.getConfig()
        expect(mockWasCalledWith(spy, /Running with default settings/)).toBe(true)
        DataStore.settings = oldSettings
      })
    })
    /*
     * getTodaysReferences()
     */
    describe('getTodaysReferences()' /* function */, () => {
      test('should return empty array if no backlinks', async () => {
        const result = await mainFile.getTodaysReferences({ ...note, backlinks: [] })
        expect(result).toEqual([])
      })
      test('should console.log and return empty array if note is null', async () => {
        const spy = jest.spyOn(console, 'log')
        const editorWas = Editor.note
        Editor.note = null
        const result = await mainFile.getTodaysReferences(null)
        expect(result).toEqual([])
        expect(mockWasCalledWith(spy, /timeblocking could not open Note/)).toBe(true)
        spy.mockRestore()
        Editor.note = editorWas
      })
      test('should tell user there was a problem with config', async () => {
        Editor.note.backlinks = [{ content: 'line1', subItems: [{ test: 'here' }] }]
        const result = await mainFile.getTodaysReferences()
        expect(result).toEqual([{ test: 'here', title: 'line1' }])
        Editor.note.backlinks = []
      })
      test('should find todos in the Editor note', async () => {
        const paras = [new Paragraph({ content: 'line1 >today', type: 'open' })]
        Editor.note.backlinks = []
        Editor.note.paragraphs = paras
        const result = await mainFile.getTodaysReferences()
        expect(result).toEqual(paras)
      })
    })
    /*
     * insertTodosAsTimeblocks()
     */
    describe('insertTodosAsTimeblocks()' /* function */, () => {
      test('should tell user there was a problem with config', async () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks(note)
        expect(spy.mock.calls[0][1]).toMatch(/Plugin Settings Error/)
        spy.mockRestore()
      })
      test('should do nothing if there are no backlinks', async () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks(note)
        // $FlowIgnore - jest doesn't know about this param
        expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for >today`)
        spy.mockRestore()
      })
      // [WIP]
      test.skip('should do something if there are backlinks', async () => {
        Editor.note.backlinks = [{ subItems: [{ content: 'line1' }] }]
        const spy = jest.spyOn(CommandBar, 'prompt')
        await mainFile.insertTodosAsTimeblocks(note)
        // $FlowIgnore - jest doesn't know about this param
        expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for >today`)
        spy.mockRestore()
      })
    })
  })
})
