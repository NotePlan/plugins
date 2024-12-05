/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, it, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../src/topLevelTasks.js'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, Note, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import * as NPParagraph from '@helpers/NPParagraph'

const PLUGIN_NAME = `np.Tidy`
const FILENAME = `topLevelTasks.js`
let globalNote // use this to test with semi-real Note+paragraphs

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

beforeEach(() => {
  const paragraphs = [
    {
      content: 'Call Allianz 1-800-334-7525',
      rawContent: '* Call Allianz 1-800-334-7525',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 0,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: 'Change healthplan',
      rawContent: '* Change healthplan',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 1,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '1This is a top task',
      rawContent: '* 1This is a top task',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 2,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
    {
      content: '2This is indented under it',
      rawContent: '\t* 2This is indented under it',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 3,
      isRecurring: false,
      indents: 1,
      noteType: 'Calendar',
    },
    {
      content: '3 here is some text under the 1 top task',
      rawContent: '\t\t3 here is some text under the 1 top task',
      type: 'text',
      heading: '',
      headingLevel: -1,
      lineIndex: 4,
      isRecurring: false,
      indents: 2,
      noteType: 'Calendar',
    },
    {
      content: '4 this is under 2 also (last line)',
      rawContent: '\t\t* 4 this is under 2 also (last line)',
      type: 'open',
      heading: '',
      headingLevel: -1,
      lineIndex: 5,
      isRecurring: false,
      indents: 2,
      noteType: 'Calendar',
    },
    {
      content: '',
      rawContent: '',
      type: 'empty',
      heading: '',
      headingLevel: -1,
      lineIndex: 6,
      isRecurring: false,
      indents: 0,
      noteType: 'Calendar',
    },
  ]
  paragraphs[0].children = () => []
  paragraphs[1].children = () => []
  paragraphs[2].children = () => [paragraphs[3], paragraphs[4], paragraphs[5]]
  paragraphs[3].children = () => [paragraphs[4], paragraphs[5]]
  paragraphs[4].children = () => []
  paragraphs[5].children = () => []
  paragraphs[6].children = () => []
  globalNote = new Note({ paragraphs })
})

/* Samples:
To use factories (from the factories folder inside of __tests__):
const testFile = new Note(JSON.parse(await loadFactoryFile(__dirname, 'jgclarksSortTest.json')))
 // load a factory file from the __tests__/factories folder
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(() => compileAndroidCode()).toThrow(/JDK/);
expect(result).toEqual([])
// object matching - important to not use exact match because you may add fields later
      expect(result).toEqual(expect.objectContaining({ field1: true, field2: 'someString'}))
// or if you want to check if an array has objects in it with certain fields:
test('we should have name 1 and 2', () => {
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({name: 1}),
      expect.objectContaining({name: 2})
    ])
  );
});

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
    describe('getTopLevelTasks', () => {
      it('should return top-level task paragraphs', () => {
        const mockNote = {
          paragraphs: [
            { headingLevel: -1, type: 'open', content: 'Task 1' },
            { headingLevel: 0, type: 'open', content: 'Task 2' },
          ],
        }

        const result = f.getTopLevelTasks(mockNote)

        expect(result).toEqual([mockNote.paragraphs[0]])
      })

      it('should return an empty array if no top-level tasks found', () => {
        const mockNote = {
          paragraphs: [{ headingLevel: 1, type: 'open', content: 'Task 1' }],
        }

        const result = f.getTopLevelTasks(mockNote)

        expect(result).toEqual([])
      })
      it('should work with realworld example', () => {
        const result = f.getTopLevelTasks(globalNote)
        expect(result.length).toEqual(5)
      })
      it('should work with empty note', () => {
        const result = f.getTopLevelTasks({ paragraphs: [] })
        expect(result.length).toEqual(0)
      })
      it('should work with realworld and titles', () => {
        globalNote.paragraphs.push(
          {
            content: 'im a heading',
            rawContent: '## im a heading',
            type: 'title',
            heading: '',
            headingLevel: 2,
            lineIndex: 6,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
          {
            content: 'task under',
            rawContent: '* task under',
            type: 'open',
            heading: 'im a heading',
            headingLevel: 2,
            lineIndex: 7,
            isRecurring: false,
            indents: 0,
            noteType: 'Calendar',
          },
        )
        const result = f.getTopLevelTasks(globalNote)
        expect(result.length).toEqual(5)
      })
    })
    /*
     * getFlatArrayOfParentsAndChildren()
     */
    describe('getFlatArrayOfParentsAndChildren', () => {
      // Mock getParagraphParentsOnly to ensure results are consistent
      // it is tested elsewhere
      beforeEach(() => {
        jest.spyOn(NPParagraph, 'getParagraphParentsOnly').mockImplementation((paragraphs: TParagraph[]) => {
          return paragraphs.map((para) => ({ parent: para, children: para.children || [] }))
        })
      })

      afterEach(() => {
        jest.restoreAllMocks()
      })

      it('should return an empty array when input is empty', () => {
        expect(f.getFlatArrayOfParentsAndChildren([])).toEqual([])
      })

      it('should handle single parent without children', () => {
        const parent = { id: 1, content: 'Parent', children: () => [] }
        expect(f.getFlatArrayOfParentsAndChildren([parent])).toEqual([parent])
      })

      it('should handle single parent with children', () => {
        const child1 = { lineIndex: 2, content: 'Child 1', children: () => [] }
        const child2 = { lineIndex: 3, content: 'Child 2', children: () => [] }
        const parent = { lineIndex: 1, content: 'Parent', children: () => [child1, child2] }
        expect(f.getFlatArrayOfParentsAndChildren([parent])).toEqual([parent, child1, child2])
      })

      it('should handle multiple parents with and without children', () => {
        const child1 = { lineIndex: 2, content: 'Child 1', children: () => [] }
        const parent1 = { lineIndex: 1, content: 'Parent 1', children: () => [child1] }
        const parent2 = { lineIndex: 3, content: 'Parent 2', children: () => [] }
        const child2 = { lineIndex: 4, content: 'Child 2', children: () => [] }
        const parent3 = { lineIndex: 5, content: 'Parent 3', children: () => [child2] }
        expect(f.getFlatArrayOfParentsAndChildren([parent1, parent2, parent3])).toEqual([parent1, child1, parent2, parent3, child2])
      })
      it('should deal with real-world example', () => {
        const topTasks = f.getTopLevelTasks(globalNote) //tested above
        const result = f.getFlatArrayOfParentsAndChildren(topTasks)
        expect(result.length).toEqual(6)
      })
    })

    /*
     * processTopLevelTasks()
     */
    describe('processTopLevelTasks()' /* function */, () => {
      test('should process actual note data (integration test)', () => {
        // use globalNote defined in beforeAll
        const expected = globalNote.paragraphs.map((p) => p.rawContent)
        expected.pop() // remove the "" empty at the end
        const result = f.processTopLevelTasks(globalNote, globalNote.paragraphs, 'Tasks', true)
        expect(result).toEqual(expected)
      })
    })

    /*
     * moveTopLevelTasksInEditor()
     */
    describe('moveTopLevelTasksInEditor()' /* function */, () => {
      test('should return tasks as string (entrypoint integration test)', async () => {
        // use globalNote defined in beforeAll
        Editor.paragraphs = globalNote.paragraphs
        Editor.note = globalNote
        // test the return-as-string version
        const result = await f.moveTopLevelTasksInEditor('', true, true)
        // expect result to be a string
        expect(result).toEqual(expect.any(String))
        const lines = result.split('\n')
        expect(lines.length).toEqual(6)
        expect(lines[0]).toEqual('* Call Allianz 1-800-334-7525')
        expect(lines[1]).toEqual('* Change healthplan')
        expect(lines[2]).toEqual('* 1This is a top task')
        expect(lines[3]).toEqual('	* 2This is indented under it')
        expect(lines[4]).toEqual('		3 here is some text under the 1 top task')
        expect(lines[5]).toEqual('		* 4 this is under 2 also (last line)')
      })
    })
  }) // end of describe(`${FILENAME}`
}) // // end of describe(`${PLUGIN_NAME}`
