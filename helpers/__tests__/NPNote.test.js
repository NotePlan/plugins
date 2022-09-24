/* global jest, describe, test, expect, beforeAll */
import { format } from 'date-fns'
import * as NPNote from '../NPnote'
import { DataStore, Paragraph, Note, Editor, Calendar } from '@mocks/index'
import { mockWasCalledWith } from '@mocks/mockHelpers'
import { unhyphenatedDate } from '@helpers/dateTime'

beforeAll(() => {
  DataStore.settings['logLevel'] = 'none' // change to DEBUG to see more console output during test runs
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
        const oldLogLevel = DataStore.settings['_logLevel']
        DataStore.settings['_logLevel'] = 'DEBUG'
        const editorWas = Editor.note
        Editor.note = null
        const result = await NPNote.getTodaysReferences(null)
        expect(result).toEqual([])
        expect(mockWasCalledWith(spy, /timeblocking could not open Note/)).toBe(true)
        spy.mockRestore()
        Editor.note = editorWas
        DataStore.settings['_logLevel'] = oldLogLevel
      })
      test('should tell user there was a problem with config', async () => {
        Editor.note.backlinks = [{ content: 'line1', subItems: [{ test: 'here' }] }]
        const result = await NPNote.getTodaysReferences()
        expect(result).toEqual([{ test: 'here', title: 'line1' }])
        Editor.note.backlinks = []
      })
      test('should find todos in the Editor note', async () => {
        const paras = [new Paragraph({ content: 'line1 >today', type: 'open' }), new Paragraph({ content: 'this is not today content', type: 'open' })]
        const noteWas = Editor.note
        Editor.note.backlinks = []
        Editor.note.paragraphs = paras
        const result = await NPNote.findTodayTodosInNote(Editor.note)
        expect(result[0].content).toEqual(paras[0].content)
        Editor.note = noteWas
      })
    })

    /*
     * findOverdueWeeksInString()
     */
    describe('findOverdueWeeksInString()' /* function */, () => {
      test('should find no date in line with no date', () => {
        const result = NPNote.findOverdueWeeksInString('no date here')
        expect(result.length).toEqual(0)
      })
      test('should find no date in line not overdue yet', () => {
        const result = NPNote.findOverdueWeeksInString('>2922-W22')
        expect(result.length).toEqual(0)
      })
      test('should find date in line with overdue', () => {
        const result = NPNote.findOverdueWeeksInString('>1999-W22')
        expect(result.length).toEqual(1)
        expect(result).toEqual(['>1999-W22'])
      })
      test('should find 2 overdue dates', () => {
        const result = NPNote.findOverdueWeeksInString('>1999-W22 >2000-W22')
        expect(result.length).toEqual(2)
        expect(result[1]).toEqual('>2000-W22')
      })
    })

    describe('findTodayTodosInNote', () => {
      const note = {
        paragraphs: [
          { content: 'foo', type: 'done', filename: 'foof.md' },
          { content: 'bar', type: 'open', filename: 'barf.md' },
          { content: 'baz', type: 'list', filename: 'bazf.txt' },
          { content: 'baz', type: 'text', filename: 'bazf.txt' },
        ],
      }
      test('should find nothing if there are no today marked items', () => {
        const res = NPNote.findTodayTodosInNote(note)
        expect(res).toEqual([])
      })
      test('should find items with >today in them', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findTodayTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should find items with >[todays date hyphenated] in them', () => {
        const tdh = format(new Date(), 'yyyy-MM-dd')
        const note2 = { paragraphs: [{ content: `foo >${tdh} bar`, type: 'open', filename: 'foof.md' }] }
        const consolidated = { paragraphs: [...note2.paragraphs, ...note.paragraphs] }
        const res = NPNote.findTodayTodosInNote(consolidated)
        expect(res.length).toEqual(1)
        expect(res[0].content).toEqual(note2.paragraphs[0].content)
      })
      test('should not find items with >today if they are done', () => {
        const note2 = { paragraphs: [{ content: 'foo >today bar', type: 'done', filename: 'foof.md' }] }
        const res = NPNote.findTodayTodosInNote(note2)
        expect(res).toEqual([])
      })
    })
  })
})
