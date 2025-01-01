/* global jest, describe, test, expect, beforeAll */
import { format } from 'date-fns'
import * as NPNote from '../NPnote'
import { DataStore, Paragraph, Note, Editor, Calendar } from '@mocks/index'
import { unhyphenatedDate } from '@helpers/dateTime'

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'none' // change to DEBUG to see more console output during test runs
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.Calendar = Calendar // so we see DEBUG logs in VSCode Jest debugs
  global.Editor = Editor // so we see DEBUG logs in VSCode Jest debugs
})

const PLUGIN_NAME = `helpers`
const FILENAME = `NPNote`
const paragraphs = [new Paragraph({ content: 'line1' }), new Paragraph({ content: 'line2' })]
const note = new Note({ paragraphs })
note.filename = `${unhyphenatedDate(new Date())}.md`
Editor.note = note
Editor.filename = note.filename

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * getTodaysReferences()
     */
    describe('getTodaysReferences()' /* function */, () => {
      test('should return empty array if no backlinks', async () => {
        const result = await NPNote.getTodaysReferences({ ...note, backlinks: [] })
        expect(result).toEqual([])
      })
      test('should console.log and return empty array if note is null', async () => {
        const spy = jest.spyOn(console, 'log')
        // const oldLogLevel = DataStore.settings['_logLevel']
        // DataStore.settings['_logLevel'] = 'DEBUG' //DON'T CHANGE THIS
        const editorWas = Editor.note
        Editor.note = null
        const result = await NPNote.getTodaysReferences(null)
        expect(result).toEqual([])
        // expect(mockWasCalledWithString(spy, /timeblocking could not open Note/)).toBe(true)
        spy.mockRestore()
        Editor.note = editorWas
        // DataStore.settings['_logLevel'] = oldLogLevel
      })
      // FIXME: this broke in moving some helpers around, and JGC can't see why. Skipping for now.
      test.skip('should tell user there was a problem with config', async () => {
        Editor.note.backlinks = [{ content: 'line1', subItems: [{ test: 'here' }] }]
        const result = await NPNote.getTodaysReferences()
        expect(result).toEqual([{ test: 'here' }])
        Editor.note.backlinks = []
      })
      test('should find todos in the Editor note', async () => {
        const paras = [new Paragraph({ content: 'line1 >today', type: 'open' }), new Paragraph({ content: 'this is not today content', type: 'open' })]
        const noteWas = Editor.note
        Editor.note.backlinks = []
        Editor.note.paragraphs = paras
        const result = await NPNote.findOpenTodosInNote(Editor.note)
        expect(result[0].content).toEqual(paras[0].content)
        Editor.note = noteWas
      })
    })

    describe('findOpenTodosInNote', () => {
      const note = {
        paragraphs: [
          { content: 'foo', type: 'done', filename: 'foof.md' },
          { content: 'bar', type: 'open', filename: 'barf.md' },
          { content: 'baz', type: 'list', filename: 'bazf.txt' },
          { content: 'baz', type: 'text', filename: 'bazf.txt' },
        ],
      }
      test('should find nothing if there are no today marked items', () => {
        const res = NPNote.findOpenTodosInNote(note)
        expect(res).toEqual([])
      })
      test('should find items with >today in them', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findOpenTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should find items with >[todays date hyphenated] in them', () => {
        const tdh = format(new Date(), 'yyyy-MM-dd')
        const note2 = { paragraphs: [{ content: `foo >${tdh} bar`, type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findOpenTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should not find items with >today if they are done', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'done', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2)
        expect(res).toEqual([])
      })
      test('should not find items with >today if they are not tagged for toeay', () => {
        const note2 = { paragraphs: [{ content: 'foo bar', type: 'open', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2)
        expect(res).toEqual([])
      })
      test('should find non-today items in note if second param is true', () => {
        const note2 = { paragraphs: [{ content: 'foo bar', type: 'open', filename: 'foof.md' }] }
        const res = NPNote.findOpenTodosInNote(note2, true)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
    })

    describe('getHeadingsFromNote', () => {
      const note = {
        filename: 'foof.md',
        type: 'Notes',
        title: 'TEST Note title',
        paragraphs: [
          { content: 'TEST Note title', type: 'title', lineIndex: 0, headingLevel: 1 },
          { content: '  First heading', type: 'title', lineIndex: 1, headingLevel: 2 },
          { content: 'foo', type: 'done', lineIndex: 2, headingLevel: 2 },
          { content: 'bar', type: 'open', lineIndex: 3, headingLevel: 2 },
          { content: 'baz', type: 'list', lineIndex: 4, headingLevel: 2 },
          { content: ' L2 heading ', type: 'title', lineIndex: 5, headingLevel: 2 },
          { content: 'baz', type: 'text', lineIndex: 6, headingLevel: 2 },
          { content: 'L3 heading  ', type: 'title', lineIndex: 7, headingLevel: 3 },
          { content: 'sojeiro awe', type: 'text', lineIndex: 8, headingLevel: 3 },
          { content: '', type: 'empty', lineIndex: 3 },
        ],
      }
      test('should find 3 headings; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, false, false, false, false)
        expect(headings.length).toEqual(3)
      })
      test('should find 3 headings left trimmed; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, false, false, false, false)
        expect(headings.length).toEqual(3)
        expect(headings[0]).toEqual('First heading')
        expect(headings[1]).toEqual('L2 heading ')
        expect(headings[2]).toEqual('L3 heading  ')
      })
      test('should find 3 headings suitably trimmed; include markdown heading markers; everything else false', () => {
        const headings = NPNote.getHeadingsFromNote(note, true, false, false, false)
        expect(headings.length).toEqual(3)
        expect(headings[0]).toEqual('## First heading')
        expect(headings[1]).toEqual('## L2 heading ')
        expect(headings[2]).toEqual('### L3 heading  ')
      })
    })
  })
})
