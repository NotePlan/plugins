// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, test, jest, expect */

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'
import { copyObject } from '@helpers/dev'
import { unhyphenatedDate } from '@helpers/dateTime'
import * as mainFile from '../src/NPTimeblocking'

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

describe('dwertheimer.EventAutomations' /* pluginID */, () => {
  describe('NPTimeblocking' /* file */, () => {
    describe('insertTodosAsTimeblocks' /* function */, () => {
      test('should tell user there was a problem with config', async () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const ret = await mainFile.insertTodosAsTimeblocks()
        expect(spy.mock.calls[0][1]).toMatch(/Plugin Settings Error/)
        spy.mockRestore()
      })
      test('should do nothing if there are no backlinks', async () => {
        const spy = jest.spyOn(CommandBar, 'prompt')
        const ret = await mainFile.insertTodosAsTimeblocks()
        expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for >today`)
        spy.mockRestore()
      })
      // [WIP]
      test.skip('should do something if there are backlinks', async () => {
        Editor.note.backlinks = [{ subItems: [{ content: 'line1' }] }]
        const spy = jest.spyOn(CommandBar, 'prompt')
        const ret = await mainFile.insertTodosAsTimeblocks()
        expect(spy.mock.lastCall[1]).toEqual(`No todos/references marked for >today`)
        spy.mockRestore()
      })
    })
  })
})
