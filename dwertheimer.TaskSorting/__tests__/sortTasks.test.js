/* eslint-disable no-unused-vars */
/* global jest, describe, test, expect, beforeAll, beforeEach, afterEach, afterAll */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../src/sortTasks'
import * as testNote from './factories/taskDocument.json'
import * as testNoteAfterSortByTitle from './factories/taskDocumentAfterSortByTitle.json'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, simpleFormatter, mockWasCalledWithString, Paragraph } from '@mocks/index'
import { getTasksByType } from '@helpers/sorting'

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
        await f.writeOutTasks(note, tByType)
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
        await f.writeOutTasks(note, tByType)
        const result = note.paragraphs
        expect(result.length).toEqual(10)
        // export const TASK_TYPES: Array<string> = ['open', 'scheduled', 'done', 'cancelled']
        // output order is the reverse of that order
        // Note that types will be unreliable because rawContent is being pasted
        // so we're just checking the content

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
        await f.writeOutTasks(note, tByType)
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
        await f.writeOutTasks(note, tByType)
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
        await f.writeOutTasks(note, tByType)
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
        await f.writeOutTasks(note, tByType, false, false, false, 'theTitle')
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
        await f.writeOutTasks(note, tByType)
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
        await f.writeOutTasks(note, tByType)
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
          await f.sortTasks(false, ['-priority', 'content'], false, null)
          const result = global.Editor.paragraphs
          testNoteAfterSortByTitle.paragraphs.forEach((p, i) => {
            const shouldBe = `${p.rawContent}`
            const newContent = `${result[i].rawContent}`
            // uncomment the following line if this test is failing and it will give you more clues on how far it got

            // Put breakpoint on the expect and compare the objects in the debugger
            expect(newContent).toMatch(shouldBe)
          })
          global.Editor = { ...editorBackup }
          global.DataStore = { ...dataStoreBackup }
        })
      })
    })
  })
})
