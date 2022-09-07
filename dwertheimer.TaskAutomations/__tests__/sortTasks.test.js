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
  describe(`${FILENAME}`, () => {})
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
})
