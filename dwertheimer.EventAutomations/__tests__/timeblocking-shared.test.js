/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import { deleteParagraphsContainingString } from '../src/timeblocking-shared'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Paragraph, Note, mockWasCalledWithString } from '@mocks/index'

const PLUGIN_NAME = `dwertheimer.EventAutomations`
const FILENAME = `timeblocking-shared.js`

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
    //functions go here using jfunc command
    /*
     * deleteParagraphsContainingString()
     */
    describe('deleteParagraphsContainingString()' /* function */, () => {
      /* template:
            test('should XXX', () => {
              const result = mainFile.deleteParagraphsContainingString()
              expect(result).toEqual(true)
            })
            */
      test('should not delete anything if no matches', () => {
        const paras = [new Paragraph({ content: 'line1', type: 'open' }), new Paragraph({ content: 'line2', type: 'open' })]
        const note = new Note({ paragraphs: paras })
        const spy = jest.spyOn(note, 'removeParagraphs')
        deleteParagraphsContainingString(note, 'xxx')
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      })
      test('should call delete with matching line', () => {
        const paras = [new Paragraph({ content: 'line1', type: 'open' }), new Paragraph({ content: 'line2', type: 'open' })]
        const note = new Note({ paragraphs: paras })
        const spy = jest.spyOn(note, 'removeParagraphs')
        deleteParagraphsContainingString(note, 'line1')
        expect(spy).toHaveBeenCalledWith([paras[0]])
        spy.mockRestore()
      })
    })
    /*
     * insertItemsIntoNote()
     */
    describe('insertItemsIntoNote()' /* function */, () => {
      /* template:
        test('should XXX', () => {
          const result = mainFile.insertItemsIntoNote()
          expect(result).toEqual(true)
        })
        */
      test('should fail gracefully with missing list', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = null
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).not.toHaveBeenCalled() //inserts nothing
        spy.mockRestore()
      })
      test('should fail gracefully with empty list', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = []
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).not.toHaveBeenCalled() //inserts nothing
        spy.mockRestore()
      })
      test('should work with null/default params and no title', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 0, 'text')
        spy.mockRestore()
      })
      test('should work with null/default params and a title', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'title1', rawContent: '# title1', headingLevel: 1, type: 'title' })] })
        const list = ['line1', 'line2']
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text')
        spy.mockRestore()
      })
      test('should work with empty heading', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = ''
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, false, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 0, 'text')
        spy.mockRestore()
      })
      test('should call insert content under heading', () => {
        const note = new Note({ type: 'Notes', paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = 'heading'
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, false, config)
        const text = `## ${heading}\n`.concat(list.join('\n')).concat('\n')
        expect(spy).toHaveBeenCalledWith(text, 0, 'text')
        spy.mockRestore()
      })
      test('should ignore folding if heading is empty', () => {
        const note = new Note({ paragraphs: [new Paragraph({ content: 'line1', type: 'open' })] })
        const list = ['line1', 'line2']
        const heading = ''
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, true, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 0, 'text') //inserts nothing
        spy.mockRestore()
      })
      //TODO FIXME: stopped working here:
      test.skip('should find heading and insert under it', () => {
        const note = new Note({
          paragraphs: [
            new Paragraph({ content: 'old1head', type: 'title' }),
            new Paragraph({ content: 'old1head', type: 'title' }),
            new Paragraph({ content: 'old2', type: 'open' }),
          ],
        })
        const list = ['new1', 'new2']
        const heading = 'old1head'
        const config = configFile.getTimeBlockingDefaults()
        const spy = jest.spyOn(note, 'insertParagraph')
        mainFile.insertItemsIntoNote(note, list, heading, true, config)
        expect(spy).toHaveBeenCalledWith(list.join('\n'), 1, 'text') //inserts nothing
        spy.mockRestore()
      })
    })
    // end of function tests
  }) // end of describe(`${FILENAME}`
}) // // end of describe(`${PLUGIN_NAME}`
