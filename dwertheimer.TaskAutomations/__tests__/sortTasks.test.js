/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll */
import * as f from '../src/sortTasks'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const PLUGIN_NAME = `dwertheimer.TaskAutomations`
const FILENAME = `sortTasks`

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * removeEmptyHeadings()
     */
    describe('removeEmptyHeadings()' /* function */, () => {
      test('should not remove anything when no spinsters', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'foo', headingLevel: 1 },
          { type: 'text', content: 'bar', headingLevel: 1 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should not remove a Level3 spinster that is not one we created (TASK_TYPES)', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'foo', headingLevel: 3 },
          { type: 'empty', content: '', headingLevel: 3 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should remove a Level3 spinster and an empty line', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'Open Tasks:', headingLevel: 3 },
          { type: 'empty', content: '', headingLevel: 3 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).toHaveBeenCalledWith(note.paragraphs)
        spy.mockRestore()
      })

      test('should remove a Level3 spinster at the very bottom', () => {
        const note = {}
        note.paragraphs = [
          { type: 'empty', content: '', headingLevel: 3 },
          { type: 'title', content: 'Open Tasks:', headingLevel: 3 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).toHaveBeenCalledWith([note.paragraphs[1]])
        spy.mockRestore()
      })

      test('should not remove a Level3 with content under it', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'Open Tasks:', headingLevel: 3 },
          { type: 'text', content: 'text', headingLevel: 3 },
        ]
        note.removeParagraphs = (paras) => {
          /* console.log(`removeParagraphs: ${paras.length} received`) */
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should remove a Level3 spinster at the end', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'foo', headingLevel: 3 },
          { type: 'text', content: 'bar', headingLevel: 3 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should not remove a Level4 spinster that is not one we created (no colon at end)', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'foo', headingLevel: 4 },
          { type: 'empty', content: '', headingLevel: 4 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should remove a Level4 spinster and an empty line', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: '@horticulture:', headingLevel: 4 },
          { type: 'empty', content: '', headingLevel: 4 },
        ]
        note.removeParagraphs = (paras) => {
          /*console.log(`removeParagraphs: ${paras.length} received`)*/
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).toHaveBeenCalledWith(note.paragraphs)
        spy.mockRestore()
      })

      test('should remove a Level4 spinster at the very bottom', () => {
        const note = {}
        note.paragraphs = [
          { type: 'empty', content: '', headingLevel: 4 },
          { type: 'title', content: '@foo:', headingLevel: 4 },
        ]
        note.removeParagraphs = (paras) => {
          /* console.log(`removeParagraphs: ${paras.length} received`) */
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).toHaveBeenCalledWith([note.paragraphs[1]])
        spy.mockRestore()
      })

      test('should not remove a Level4 with content under it', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'sample:', headingLevel: 4 },
          { type: 'text', content: 'text', headingLevel: 4 },
        ]
        note.removeParagraphs = (paras) => {
          /* console.log(`removeParagraphs: ${paras.length} received`) */
        }
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })

      test('should remove a Level4 spinster at the end', () => {
        const note = {}
        note.paragraphs = [
          { type: 'title', content: 'foo', headingLevel: 4 },
          { type: 'text', content: 'bar', headingLevel: 4 },
        ]
        note.removeParagraphs = (paras) => console.log(`removeParagraphs: ${paras.length} received`)
        const spy = jest.spyOn(note, 'removeParagraphs')
        f.removeEmptyHeadings(note)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })
    })
    /*
     * getTasksByHeading()
     */
    describe('getTasksByHeading()' /* function */, () => {
      test('should send back empty if no note', () => {
        const result = f.getTasksByHeading(null)
        expect(result).toEqual({ __: [] })
      })
      test('should send back empty if no paras', () => {
        const result = f.getTasksByHeading({ paragraphs: [] })
        expect(result).toEqual({ __: [] })
      })
      test('should put one item under a title', () => {
        const p1 = { type: 'title', content: 'foo' }
        const p2 = { type: 'text', content: 'bar', heading: 'foo' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [], foo: [p2] })
      })
      test('should work for two titles and content underneath', () => {
        const p1 = { type: 'title', content: 'foo' }
        const p2 = { type: 'text', content: 'bar', heading: 'foo' }
        const p3 = { type: 'title', content: 'baz' }
        const p4 = { type: 'text', content: 'bam', heading: 'baz' }
        const p5 = { type: 'title', content: 'soy' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2, p3, p4, p5] })
        expect(result).toEqual({ __: [], foo: [p2], baz: [p4], soy: [] })
      })
      test('should work with emojis and stuff', () => {
        const p1 = { type: 'title', content: '# ✈️ dallas (2022-10-07 - 2023-10-08) ) - Travel Checklist', heading: '' }
        const p2 = { type: 'text', content: 'bar', heading: '# ✈️ dallas (2022-10-07 - 2023-10-08) ) - Travel Checklist' }
        const p3 = { type: 'title', content: 'baz' }
        const p4 = { type: 'text', content: 'bam', heading: 'baz' }
        const p5 = { type: 'title', content: 'soy' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2, p3, p4, p5] })
        expect(result).toEqual({ __: [], '# ✈️ dallas (2022-10-07 - 2023-10-08) ) - Travel Checklist': [p2], baz: [p4], soy: [] })
      })
      test('should work with blank heading (e.g. calendar note)', () => {
        const p2 = { type: 'text', content: 'bar', heading: '' }
        const p3 = { type: 'title', content: 'baz', heading: '' }
        const p4 = { type: 'text', content: 'bam', heading: 'baz' }
        const result = f.getTasksByHeading({ paragraphs: [p2, p3, p4] })
        expect(result).toEqual({ __: [p2], baz: [p4] })
      })
      test('should work with spaces in a a title', () => {
        const p1 = { type: 'title', content: 'foo ' }
        const p2 = { type: 'text', content: 'bar', heading: 'foo ' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [], foo: [p2] })
      })
      test('should fail gracefully when there is no title', () => {
        const p1 = { type: 'title', content: '' }
        const p2 = { type: 'text', content: 'bar', heading: '' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [p2] })
      })
      test('should fail gracefully when heading does not match', () => {
        const p1 = { type: 'title', content: '' }
        const p2 = { type: 'text', content: 'bar', heading: '' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [p2] })
      })
      test('should work for jgclark example 1', () => {
        const p1 = { type: 'text', content: `[[Italy Holiday 2022 ✈️🚅🛤 Checklist]]`, heading: '' }
        const p2 = { type: 'open', content: `* [x] ! House sitting instructions @done(2022-09-07)`, heading: '' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [p1, p2] })
      })
      test('should work for jgclark example 2', () => {
        const p1 = { type: 'text', content: `* [x] ! Pick up tailoring from @town @done(2022-10-07)`, heading: '' }
        const p2 = { type: 'open', content: `* [x] ! Fix low space problem on MM4 @done(2022-10-07)`, heading: '' }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2] })
        expect(result).toEqual({ __: [p1, p2] })
      })
    })
  })
})
