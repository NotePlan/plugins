/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, beforeEach, afterEach, afterAll */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../src/sortTasks'
import * as testNote from './factories/taskDocument.json'
import * as testNoteAfterSortByTitle from './factories/taskDocumentAfterSortByTitle.json'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, simpleFormatter, mockWasCalledWithString /*, Paragraph */ } from '@mocks/index'
import { getTasksByType } from '@helpers/sorting'
import { Paragraph } from '../../__mocks__'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging
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

      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWithString(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

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

    /*
     * sortParagraphsByType Integration Test()
     */
    describe('sortParagraphsByType Integration Test()' /* function */, () => {
      test('should sort all the tasks in the test note (spot check)', () => {
        const editorBackup = Editor
        const note = new Note(testNote)
        const result = f.sortParagraphsByType(note.paragraphs)
        expect(result.open.length).toEqual(5)
        expect(result.open[0].content).toEqual("!! Task-3 that's more important")
        expect(result.done.length).toEqual(7)
        expect(result.cancelled.length).toEqual(2)
        expect(result.scheduled.length).toEqual(0)
        global.Editor = editorBackup
      })
      test('should sort one specific section (spot check)', () => {
        const editorBackup = Editor
        const note = new Note(testNote)
        const selection = note.paragraphs.filter((p) => p.lineIndex >= 21 && p.lineIndex <= 33)
        const result = f.sortParagraphsByType(selection)
        expect(result.open.length).toEqual(2)
        expect(result.open[0].content).toEqual("! Task-8 that's important")
        expect(result.open[0].children[0].content).toEqual('And a note under Task-8')
        expect(result.done.length).toEqual(3)
        global.Editor = editorBackup
      })
    })

    /*
     * writeOutTasks()
     */
    describe('writeOutTasks()' /* function */, () => {
      test('should write to Editor one of each task type in proper order', async () => {
        const editorBackup = Editor
        const note = new Note({ paragraphs: [] })
        const tasks = [
          new Paragraph({ type: 'open', content: '1-open' }),
          new Paragraph({ type: 'done', content: '2-done' }),
          new Paragraph({ type: 'cancelled', content: '3-cancelled' }),
          new Paragraph({ type: 'scheduled', content: '4-scheduled' }),
        ]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType)
        const result = note.paragraphs
        expect(result.length).toEqual(4)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        expect(result[0].content).toEqual('- [-] 3-cancelled')
        expect(result[1].content).toEqual('- [x] 2-done')
        expect(result[2].content).toEqual('- [>] 4-scheduled')
        expect(result[3].content).toEqual('- [ ] 1-open')
        global.Editor = editorBackup
      })
      test('should perform a basic write to Editor of testNote content', async () => {
        const editorBackup = Editor
        const note = new Note({ paragraphs: [] })
        const tasks = new Note(testNote).paragraphs.filter((p) => p.lineIndex >= 21 && p.lineIndex <= 33)
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType)
        const result = note.paragraphs
        expect(result.length).toEqual(9)
        expect(result.open[0].content).toEqual("!! Task-3 that's more important")
        global.Editor = editorBackup
      })
    })

    /*
     * sortTasks Integration Tests()
     */
    describe('sortTasks Integration Tests' /* function */, () => {
      describe('sort within each heading' /* function */, () => {
        const CommandBar_backup = {}
        let removeSpy, updateSpy
        beforeAll(() => {
          CommandBar_backup.showOptions = CommandBar.showOptions
          CommandBar.showOptions = async function (options, text) {
            switch (text) {
              case "Sort each heading's tasks individually?":
                return { index: 0, value: 'Yes' }
              case 'Select sort order:':
                return { index: 0, value: 'By Priority (!!! and (A)) then by content' }
              case 'Include Task Type headings in the output?':
                return { index: 0, value: 'No' }
              default:
                break
            }
          }
        })
        afterAll(() => {
          CommandBar.showOptions = CommandBar_backup.showOptions
          jest.restoreAllMocks()
        })
        test('should process the whole note correctly', async () => {
          const editorBackup = Editor
          const note = new Note(testNote)
          // writableTestNote.removeParagraphs = (args) => {
          //   console.log('removeParagraphs', args)
          // }
          // writableTestNote.updateParagraphs = (args) => {
          //   console.log('updateParagraphs', args)
          // }
          global.Editor = note
          global.Editor.note = note
          removeSpy = jest.spyOn(note, 'removeParagraphs')
          updateSpy = jest.spyOn(note, 'updateParagraphs')
          await f.sortTasks()
          const result = global.Editor.paragraphs
          testNoteAfterSortByTitle.paragraphs.forEach((p, i) => {
            // expect().toEqual(`[${i}] ${result[i].content}`)
            const shouldBe = `[${i}] ${p.content}`
            const newContent = `[${i}] ${result[i].content}`
            // Put breakpoint on the expect and compare the objects in the debugger
            expect(newContent).toEqual(shouldBe)
          })
          // expect(mockWasCalledWithString(removeSpy, /config was empty/)).toBe(true)
          // testNote
          // const result = f.sortTasks Integration Tests()
          // expect(result).toEqual(true)
          global.Editor = editorBackup
        })
      })
    })
  })
})
