/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, beforeEach, afterEach, afterAll */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../src/sortTasks'
import * as testNote from './factories/taskDocument.json'
import * as testNoteAfterSortByTitle from './factories/taskDocumentAfterSortByTitle.json'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, simpleFormatter, mockWasCalledWithString, Paragraph } from '@mocks/index'
import { getTasksByType, TASK_TYPES } from '@helpers/sorting'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
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
      test('should stop at ## Done', () => {
        DataStore.settings.stopAtDoneHeading = true
        const p1 = { type: 'text', content: `* [x] ! Pick up tailoring from @town @done(2022-10-07)`, heading: '', lineIndex: 0 }
        const p2 = { type: 'open', content: `* [ ] ! Fix low space problem on MM4 @done(2022-10-07)`, heading: '', lineIndex: 1 }
        const p3 = { type: 'title', content: `Done`, heading: '', headingLevel: 2, lineIndex: 2 }
        const p4 = { type: 'open', content: `* [ ] ! Fix low space problem on MM4 @done(2022-10-07)`, heading: 'Done', lineIndex: 3 }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2, p3, p4] })
        expect(result).toEqual({ __: [p1, p2] })
      })
      test('should stop at ## Cancelled', () => {
        DataStore.settings.stopAtDoneHeading = true
        const p1 = { type: 'text', content: `* [x] ! Pick up tailoring from @town @done(2022-10-07)`, heading: '', lineIndex: 0 }
        const p2 = { type: 'open', content: `* [ ] ! Fix low space problem on MM4 @done(2022-10-07)`, heading: '', lineIndex: 1 }
        const p3 = { type: 'title', content: `Cancelled`, heading: '', headingLevel: 2, lineIndex: 2 }
        const p4 = { type: 'open', content: `* [ ] ! Fix low space problem on MM4 @done(2022-10-07)`, heading: 'Done', lineIndex: 3 }
        const result = f.getTasksByHeading({ paragraphs: [p1, p2, p3, p4] })
        expect(result).toEqual({ __: [p1, p2] })
      })
    })

    /*
     * addChecklistTypes()
     */
    describe('addChecklistTypes()' /* function */, () => {
      test('should add one type', () => {
        const result = f.addChecklistTypes(['foo', 'open'])
        expect(result).toEqual(['foo', 'open', 'checklist'])
      })
      test('should add two types', () => {
        const result = f.addChecklistTypes(['foo', 'open', 'nothing', 'done'])
        expect(result).toEqual(['foo', 'open', 'checklist', 'nothing', 'done', 'checklistDone'])
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
      test('should write to Editor one of each task type in default order', async () => {
        // const taskTypes = (DataStore.settings.outputOrder ?? 'open, scheduled, done, cancelled').split(',').map((t) => t.trim())
        const editorBackup = Editor
        const titlePara = new Paragraph({ type: 'title', content: 'NoteTitle', lineIndex: 0 })
        const firstLine = new Paragraph({ type: 'empty', content: '', lineIndex: 1 })
        const note = new Note({ paragraphs: [titlePara, firstLine] })
        const tasks = [
          new Paragraph({ type: 'open', content: '1-open' }),
          new Paragraph({ type: 'done', content: '2-done' }),
          new Paragraph({ type: 'cancelled', content: '3-cancelled' }),
          new Paragraph({ type: 'scheduled', content: '4-scheduled' }),
        ]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(6)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        expect(result[4].content).toEqual('3-cancelled')
        expect(result[3].content).toEqual('2-done')
        expect(result[2].content).toEqual('4-scheduled')
        expect(result[1].content).toEqual('1-open')
        global.Editor = editorBackup
      })
      test('should write to Editor one of each task+checklist type in default order', async () => {
        // const taskTypes = (DataStore.settings.outputOrder ?? 'open, scheduled, done, cancelled').split(',').map((t) => t.trim())
        const editorBackup = Editor
        const titlePara = new Paragraph({ type: 'title', content: 'NoteTitle', lineIndex: 0 })
        const firstLine = new Paragraph({ type: 'empty', content: '', lineIndex: 1 })
        const note = new Note({ paragraphs: [titlePara, firstLine] })
        const tasks = [
          new Paragraph({ type: 'open', content: '1-open' }),
          new Paragraph({ type: 'checklist', content: '2-checklist' }),
          new Paragraph({ type: 'done', content: '3-done' }),
          new Paragraph({ type: 'checklistDone', content: '4-checklistDone' }),
          new Paragraph({ type: 'cancelled', content: '5-cancelled' }),
          new Paragraph({ type: 'checklistCancelled', content: '6-checklistCancelled' }),
          new Paragraph({ type: 'scheduled', content: '7-scheduled' }),
          new Paragraph({ type: 'checklistScheduled', content: '8-checklistScheduled' }),
        ]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(10)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        // so we're just checking the content
        // console.log(`sortTasks result`, result)
        expect(result[8].content).toEqual('6-checklistCancelled')
        expect(result[7].content).toEqual('5-cancelled')
        expect(result[6].content).toEqual('4-checklistDone')
        expect(result[5].content).toEqual('3-done')
        expect(result[4].content).toEqual('8-checklistScheduled')
        expect(result[3].content).toEqual('7-scheduled')
        expect(result[2].content).toEqual('2-checklist')
        expect(result[1].content).toEqual('1-open')
        global.Editor = editorBackup
      })
      test('should write to Editor one of each task type in user-specified order', async () => {
        const dataStoreBackup = { ...DataStore }
        const editorBackup = { ...Editor }
        DataStore.settings.outputOrder = 'cancelled, done, scheduled, open'
        const titlePara = new Paragraph({ type: 'title', content: 'NoteTitle', lineIndex: 0 })
        const firstLine = new Paragraph({ type: 'empty', content: '', lineIndex: 1 })
        const note = new Note({ paragraphs: [titlePara, firstLine] })
        const tasks = [
          new Paragraph({ type: 'open', content: '1-open' }),
          new Paragraph({ type: 'done', content: '2-done' }),
          new Paragraph({ type: 'cancelled', content: '3-cancelled' }),
          new Paragraph({ type: 'scheduled', content: '4-scheduled' }),
        ]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(6)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        expect(result[1].content).toEqual('3-cancelled')
        expect(result[2].content).toEqual('2-done')
        expect(result[3].content).toEqual('4-scheduled')
        expect(result[4].content).toEqual('1-open')
        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })
      test('should write to Editor one of each task type in user-specified order with tasksToTop setting true', async () => {
        const dataStoreBackup = { ...DataStore }
        const editorBackup = { ...Editor }
        DataStore.settings.outputOrder = 'cancelled, done, scheduled, open'
        DataStore.settings.tasksToTop = true
        const titlePara = new Paragraph({ type: 'title', content: 'NoteTitle', lineIndex: 0 })
        const firstLine = new Paragraph({ type: 'empty', content: '', lineIndex: 1 })
        const note = new Note({ paragraphs: [titlePara, firstLine] })
        const tasks = [
          new Paragraph({ type: 'open', content: '1-open' }),
          new Paragraph({ type: 'done', content: '2-done' }),
          new Paragraph({ type: 'cancelled', content: '3-cancelled' }),
          new Paragraph({ type: 'scheduled', content: '4-scheduled' }),
        ]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(6)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        expect(result[1].content).toEqual('3-cancelled')
        expect(result[2].content).toEqual('2-done')
        expect(result[3].content).toEqual('4-scheduled')
        expect(result[4].content).toEqual('1-open')
        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })
      test('should append to Editor when content exists', async () => {
        const editorBackup = Editor
        const dataStoreBackup = { ...DataStore }
        DataStore.settings.tasksToTop = false
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'title', content: 'theTitle' }),
            new Paragraph({ type: 'open', content: 'openTask' }),
            new Paragraph({ type: 'separator', content: '---' }),
          ],
        })
        const tasks = [new Paragraph({ type: 'open', content: '1-open' })]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(4)
        expect(result[3].content).toEqual('1-open')
        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })
      test('should write to Editor under a title', async () => {
        const editorBackup = Editor
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'title', content: 'docTitle' }),
            new Paragraph({ type: 'title', content: 'theTitle' }),
            new Paragraph({ type: 'cancelled', content: 'xclTask' }),
            new Paragraph({ type: 'separator', content: '---' }),
          ],
        })
        // will get ReferenceError: type is not defined if there is no lineIndex
        note.paragraphs.forEach((p, i) => (note.paragraphs[i].lineIndex = i))

        const tasks = [new Paragraph({ type: 'open', content: '1-open' })]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, 'theTitle', false)
        const result = note.paragraphs
        expect(result.length).toEqual(5)
        expect(result[3].content).toEqual('1-open')
        global.Editor = editorBackup
      })
      test('should append to Editor when frontmatter exists', async () => {
        const editorBackup = Editor
        const note = new Note({
          paragraphs: [
            new Paragraph({ type: 'separator', content: '---' }),
            new Paragraph({ type: 'text', content: 'test: frontmatter' }),
            new Paragraph({ type: 'separator', content: '---' }),
            new Paragraph({ type: 'title', content: 'theTitle' }),
            new Paragraph({ type: 'open', content: 'openTask' }),
            new Paragraph({ type: 'separator', content: '---' }),
          ],
        })
        const tasks = [new Paragraph({ type: 'open', content: '1-open' })]
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result.length).toEqual(7)
        expect(result[6].content).toEqual('1-open')
        global.Editor = editorBackup
      })
      test('should perform a basic write to Editor of testNote content', async () => {
        const editorBackup = Editor
        const note = new Note({ paragraphs: [] })
        const tasks = new Note(testNote).paragraphs.filter((p) => p.lineIndex >= 21 && p.lineIndex <= 33)
        const tByType = getTasksByType(tasks)
        await f.writeOutTasks(note, tByType, false, false, null, '', false)
        const result = note.paragraphs
        expect(result[0].content).toEqual('Task-4 @done(2022-10-01)')
        expect(result[8].content).toEqual('And a note under Task-8')
        expect(result[8].indents).toEqual(1)
        expect(result.length).toEqual(9)
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
          CommandBar.showOptions = function (options, text) {
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
        /**
         * Use Factories to test entire note paragraphs before and after
         */
        test('should process the whole note correctly', async () => {
          const editorBackup = { ...Editor }
          const dataStoreBackup = { ...DataStore }
          DataStore.settings.sortInHeadings = true
          DataStore.settings.outputOrder = 'open, done, scheduled, cancelled'
          const note = new Note(testNote)
          global.Editor = note
          global.Editor.note = note
          await f.sortTasks(false, ['-priority', 'content'], false, null, false)
          const result = global.Editor.paragraphs
          testNoteAfterSortByTitle.paragraphs.forEach((p, i) => {
            const shouldBe = `${p.rawContent}`
            const newContent = `${result[i].rawContent}`
            // uncomment the following line if this test is failing and it will give you more clues on how far it got
            // console.log(`sortTasks: [${i}]: (result) ${newContent} ${newContent === shouldBe ? '===' : ' !== '} "${shouldBe}" (expected)`)
            // Put breakpoint on the expect and compare the objects in the debugger
            expect(newContent).toMatch(shouldBe)
          })
          global.Editor = { ...editorBackup }
          global.DataStore = { ...dataStoreBackup }
        })
      })
    })

    /**
     * Tests for interleaveTaskTypes functionality
     */
    describe('interleaveTaskTypes functionality', () => {
      const testNoteWithMixedTasks = {
        title: 'Test Note with Mixed Tasks',
        paragraphs: [
          { type: 'title', content: 'Test Note with Mixed Tasks', lineIndex: 0, rawContent: '# Test Note with Mixed Tasks' },
          { type: 'open', content: 'Low priority open task', lineIndex: 1, rawContent: '- [ ] Low priority open task' },
          { type: 'checklist', content: '!!! High priority checklist task (A)', lineIndex: 2, rawContent: '- [ ] !!! High priority checklist task (A)' },
          { type: 'open', content: '!! Medium priority open task (B)', lineIndex: 3, rawContent: '- [ ] !! Medium priority open task (B)' },
          { type: 'checklist', content: 'Low priority checklist task (C)', lineIndex: 4, rawContent: '- [ ] Low priority checklist task (C)' },
          { type: 'scheduled', content: '!! High priority scheduled task >2024-01-01 (D)', lineIndex: 5, rawContent: '- [>] !! High priority scheduled task >2024-01-01 (D)' },
          { type: 'done', content: '! Completed task', lineIndex: 6, rawContent: '- [x] ! Completed task' },
        ],
      }

      const expectedTraditionalSort = {
        title: 'Test Note with Mixed Tasks',
        paragraphs: [
          { type: 'title', content: 'Test Note with Mixed Tasks', lineIndex: 0, rawContent: '# Test Note with Mixed Tasks' },
          // Open tasks first (sorted by priority desc)
          { type: 'open', content: 'Medium priority open task', lineIndex: 3, rawContent: '- [ ] Medium priority open task (B)', priority: 5 },
          { type: 'open', content: 'Low priority open task', lineIndex: 1, rawContent: '- [ ] Low priority open task', priority: 1 },
          // Then checklist tasks (sorted by priority desc)
          { type: 'checklist', content: 'High priority checklist task', lineIndex: 2, rawContent: '- [ ] High priority checklist task (A)', priority: 10 },
          { type: 'checklist', content: 'Low priority checklist task', lineIndex: 4, rawContent: '- [ ] Low priority checklist task (C)', priority: 2 },
          // Then scheduled tasks (sorted by priority desc)
          { type: 'scheduled', content: 'High priority scheduled task', lineIndex: 5, rawContent: '- [>] High priority scheduled task >2024-01-01 (D)', priority: 9 },
          // Then done tasks (sorted by priority desc)
          { type: 'done', content: 'Completed task', lineIndex: 6, rawContent: '- [x] Completed task', priority: 8 },
        ],
      }

      const expectedInterleavedSort = {
        title: 'Test Note with Mixed Tasks',
        paragraphs: [
          { type: 'title', content: 'Test Note with Mixed Tasks', lineIndex: 0, rawContent: '# Test Note with Mixed Tasks' },
          // Active tasks interleaved by priority (high to low)
          { type: 'checklist', content: 'High priority checklist task', lineIndex: 2, rawContent: '- [ ] High priority checklist task (A)', priority: 10 },
          { type: 'scheduled', content: 'High priority scheduled task', lineIndex: 5, rawContent: '- [>] High priority scheduled task >2024-01-01 (D)', priority: 9 },
          { type: 'open', content: 'Medium priority open task', lineIndex: 3, rawContent: '- [ ] Medium priority open task (B)', priority: 5 },
          { type: 'checklist', content: 'Low priority checklist task', lineIndex: 4, rawContent: '- [ ] Low priority checklist task (C)', priority: 2 },
          { type: 'open', content: 'Low priority open task', lineIndex: 1, rawContent: '- [ ] Low priority open task', priority: 1 },
          // Completed tasks (separate group)
          { type: 'done', content: 'Completed task', lineIndex: 6, rawContent: '- [x] Completed task', priority: 8 },
        ],
      }

      test('should sort tasks by type first when interleaveTaskTypes is false (traditional)', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, scheduled, done'

        const note = new Note(testNoteWithMixedTasks)
        global.Editor = note
        global.Editor.note = note

        // Call sortTasks with interleaveTaskTypes = false (traditional sorting)
        await f.sortTasks(false, ['-priority'], false, false, false)

        const result = global.Editor.paragraphs

        // Verify the order matches traditional sorting (type first, then priority)
        expect(result[1].content).toBe('!! Medium priority open task (B)') // Highest priority open task (!!)
        expect(result[2].content).toBe('Low priority open task') // Lower priority open task (no priority)
        expect(result[3].content).toBe('!!! High priority checklist task (A)') // Highest priority checklist task (!!!)
        expect(result[4].content).toBe('Low priority checklist task (C)') // Lower priority checklist task (no priority)
        expect(result[5].content).toBe('!! High priority scheduled task >2024-01-01 (D)') // Scheduled task (!!)
        expect(result[6].content).toBe('! Completed task') // Done task (!)

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should interleave compatible task types when interleaveTaskTypes is true', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, scheduled, done'

        const note = new Note(testNoteWithMixedTasks)
        global.Editor = note
        global.Editor.note = note

        // Call sortTasks with interleaveTaskTypes = true (interleaved sorting)
        await f.sortTasks(false, ['-priority'], false, false, true)

        const result = global.Editor.paragraphs

        // Verify the order matches interleaved sorting (priority first, open tasks before checklists within same priority)
        // Note: Tasks are now inserted at top of note, so they start at index 0, title is pushed down
        expect(result[0].content).toBe('!!! High priority checklist task (A)') // Highest priority (!!!)
        expect(result[1].content).toBe('!! High priority scheduled task >2024-01-01 (D)') // Second highest (!!) - scheduled is open type
        expect(result[2].content).toBe('!! Medium priority open task (B)') // Third highest (!!) - open task
        expect(result[3].content).toBe('Low priority open task') // Fourth highest (no priority) - open task
        expect(result[4].content).toBe('Low priority checklist task (C)') // Fifth highest (no priority) - checklist
        expect(result[5].content).toBe('! Completed task') // Done task (separate group)
        expect(result[6].content).toBe('Test Note with Mixed Tasks') // Title is now at the bottom

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should handle sortTasksUnderHeading with interleaving', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, scheduled, done'

        const noteWithHeading = {
          title: 'Test Note with Heading',
          paragraphs: [
            { type: 'title', content: 'Test Note with Heading', lineIndex: 0, rawContent: '# Test Note with Heading' },
            { type: 'title', content: 'Active Tasks', lineIndex: 1, rawContent: '## Active Tasks', headingLevel: 2 },
            { type: 'open', content: 'Low priority open task', lineIndex: 2, rawContent: '- [ ] Low priority open task' },
            { type: 'checklist', content: '!!! High priority checklist task (A)', lineIndex: 3, rawContent: '- [ ] !!! High priority checklist task (A)' },
            { type: 'open', content: '!! Medium priority open task (B)', lineIndex: 4, rawContent: '- [ ] !! Medium priority open task (B)' },
          ],
        }

        const note = new Note(noteWithHeading)
        global.Editor = note
        global.Editor.note = note

        // Call sortTasksUnderHeading with interleaveTaskTypes = true
        await f.sortTasksUnderHeading('Active Tasks', ['-priority'], null, true)

        const result = global.Editor.paragraphs

        // Verify the tasks under the heading are interleaved by priority
        expect(result[2].content).toBe('!!! High priority checklist task (A)') // Highest priority (!!!)
        expect(result[3].content).toBe('!! Medium priority open task (B)') // Second highest (!!)
        expect(result[4].content).toBe('Low priority open task') // Lowest priority (no priority)

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should maintain separate groups for completed and cancelled tasks even when interleaving', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, checklist, scheduled, done, cancelled'

        const noteWithAllTypes = {
          title: 'Test Note with All Types',
          paragraphs: [
            { type: 'title', content: 'Test Note with All Types', lineIndex: 0, rawContent: '# Test Note with All Types' },
            { type: 'open', content: 'Low priority open task', lineIndex: 1, rawContent: '- [ ] Low priority open task' },
            { type: 'checklist', content: '!!! High priority checklist task', lineIndex: 2, rawContent: '- [ ] !!! High priority checklist task' },
            { type: 'done', content: '!! High priority done task', lineIndex: 3, rawContent: '- [x] !! High priority done task' },
            { type: 'done', content: 'Low priority done task', lineIndex: 4, rawContent: '- [x] Low priority done task' },
            { type: 'cancelled', content: '! Cancelled task', lineIndex: 5, rawContent: '- [-] ! Cancelled task' },
          ],
        }

        const note = new Note(noteWithAllTypes)
        global.Editor = note
        global.Editor.note = note

        // Call sortTasks with interleaveTaskTypes = true
        await f.sortTasks(false, ['-priority'], false, false, true)

        const result = global.Editor.paragraphs

        // Verify active tasks are interleaved, but completed/cancelled are separate groups
        // Note: Tasks are now inserted at top of note, so they start at index 0, title is pushed down
        expect(result[0].content).toBe('!!! High priority checklist task') // Highest active priority (!!!)
        expect(result[1].content).toBe('Low priority open task') // Lower active priority (no priority)
        expect(result[2].content).toBe('!! High priority done task') // Highest done priority (!!)
        expect(result[3].content).toBe('Low priority done task') // Lower done priority (no priority)
        expect(result[4].content).toBe('! Cancelled task') // Cancelled task (separate group)
        expect(result[5].content).toBe('Test Note with All Types') // Title is now at the bottom

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should handle string parameters for interleaveTaskTypes correctly', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, scheduled, done'

        const note = new Note(testNoteWithMixedTasks)
        global.Editor = note
        global.Editor.note = note

        // Test with string 'true' parameter
        await f.sortTasks(false, ['-priority'], false, false, 'true')

        const result = global.Editor.paragraphs

        // Verify it behaves like boolean true (interleaved, open tasks before checklists within same priority)
        // Note: Tasks are now inserted at top of note, so they start at index 0, title is pushed down
        expect(result[0].content).toBe('!!! High priority checklist task (A)') // Highest priority (!!!)
        expect(result[1].content).toBe('!! High priority scheduled task >2024-01-01 (D)') // Second highest (!!) - scheduled is open type

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should handle string parameters for interleaveTaskTypes correctly (false)', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = false
        DataStore.settings.outputOrder = 'open, scheduled, done'

        const note = new Note(testNoteWithMixedTasks)
        global.Editor = note
        global.Editor.note = note

        // Test with string 'false' parameter
        await f.sortTasks(false, ['-priority'], false, false, 'false')

        const result = global.Editor.paragraphs

        // Verify it behaves like boolean false (traditional)
        expect(result[1].content).toBe('!! Medium priority open task (B)') // Highest priority open task (!!)
        expect(result[2].content).toBe('Low priority open task') // Lower priority open task (no priority)
        expect(result[3].content).toBe('!!! High priority checklist task (A)') // Highest priority checklist task (!!!)

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })

      test('should interleave tasks correctly in real-world scenario with heading', async () => {
        const editorBackup = { ...global.Editor }
        const dataStoreBackup = { ...global.DataStore }

        DataStore.settings.sortInHeadings = true
        DataStore.settings.outputOrder = 'open, scheduled, done'

        // Create a note that matches the real-world scenario from the debug logs
        const realWorldNote = new Note({
          title: 'jgclark sort test',
          content: `# jgclark sort test

## my heading
+ !!! 01 a checklist
* !!! a 3 ! open task
+ !! 06 a two checklist
* !! a high priority task
+ ! a single priority checklist
* ! a single priority open task
* 02 a task
	some indented text under 02 a task
	+ !!!! 03 a high priority checklist under 02 a task
		* 04 a task under 03 checklist
* [x] !!! a super high priority completed task
+ [x] a completed checklist
	a completed task
* [x] a completed task
`,
        })

        global.Editor = realWorldNote
        global.Editor.note = realWorldNote

        // Test interleaving with the exact same parameters as the real-world scenario
        await f.sortTasks(false, ['-priority', 'content'], false, false, true)

        const result = global.Editor.paragraphs

        // Find the heading section
        const headingIndex = result.findIndex((p) => p.content === 'my heading')
        expect(headingIndex).toBeGreaterThan(-1)

        // The tasks should be interleaved by priority within logical groups:
        // Group 1: Active tasks (open + checklist) - sorted by priority, open tasks first within same priority:
        // 1. * !!! a 3 ! open task (priority 3, open)
        // 2. + !!! 01 a checklist (priority 3, checklist)
        // 3. * !! a high priority task (priority 2, open)
        // 4. + !! 06 a two checklist (priority 2, checklist)
        // 5. * ! a single priority open task (priority 1, open)
        // 6. + ! a single priority checklist (priority 1, checklist)
        // 7. * 02 a task (priority 0, open)
        // Group 2: Completed tasks (done + checklistDone) - interleaved by priority:
        // 8. * [x] !!! a super high priority completed task (priority 3, completed)
        // 9. + [x] a completed checklist (priority 0, completed)
        // 10. * [x] a completed task (priority 0, completed)

        const tasksAfterHeading = result.slice(headingIndex + 1).filter((p) => p.content && !p.content.startsWith('noteplan://') && TASK_TYPES.includes(p.type))

        // Interleaved order: priority first, then open tasks before checklists within same priority
        expect(tasksAfterHeading[0].rawContent).toBe('+ !!! 01 a checklist') // Highest priority (3) checklist
        expect(tasksAfterHeading[1].rawContent).toBe('* !!! a 3 ! open task') // Same priority (3) open task
        expect(tasksAfterHeading[2].rawContent).toBe('+ !! 06 a two checklist') // Next priority (2) checklist
        expect(tasksAfterHeading[3].rawContent).toBe('* !! a high priority task') // Same priority (2) open task
        expect(tasksAfterHeading[4].rawContent).toBe('+ ! a single priority checklist') // Next priority (1) checklist
        expect(tasksAfterHeading[5].rawContent).toBe('* ! a single priority open task') // Same priority (1) open task

        // Verify completed tasks come after active tasks
        const completedTasks = tasksAfterHeading.filter((p) => p.content.includes('[x]'))
        const activeTasks = tasksAfterHeading.filter((p) => !p.content.includes('[x]'))

        // All active tasks should come before completed tasks
        const firstCompletedIndex = tasksAfterHeading.findIndex((p) => p.content.includes('[x]'))

        // Check that all tasks before the first completed task are active tasks
        for (let i = 0; i < firstCompletedIndex; i++) {
          expect(tasksAfterHeading[i].content).not.toContain('[x]')
        }

        global.Editor = { ...editorBackup }
        global.DataStore = { ...dataStoreBackup }
      })
    })
  })
})
