/*
 * THIS FILE SHOULD BE RENAMED WITH ".test.js" AT THE END SO JEST WILL FIND AND RUN IT
 * It is included here as an example/starting point for your own tests
 */

/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
// Jest testing docs: https://jestjs.io/docs/using-matchers
/* eslint-disable */

import * as f from '../src/sortTasks'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `{{pluginID}}`
const FILENAME = `NPPluginMain`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
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

describe('dbludeau.TodoistNoteplanSync' /* pluginID */, () => {
  describe('NPPluginMain' /* file */, () => {
    describe('sayHello' /* function */, () => {
      test('should insert text if called with a string param', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const result = await mainFile.sayHello('Testing...')
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(
          1,
          `***You clicked the link!*** The message at the end of the link is "Testing...". Now the rest of the plugin will run just as before...\n\n`,
        )
        spy.mockRestore()
      })
      test('should write result to console', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(console, 'log')
        const result = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/The plugin says: HELLO WORLD FROM TEST PLUGIN!/))
        spy.mockRestore()
      })
      test('should call DataStore.settings', async () => {
        // tests start with "should" to describe the expected behavior
        const oldValue = DataStore.settings
        DataStore.settings = { settingsString: 'settingTest' }
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const _ = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/settingTest/))
        DataStore.settings = oldValue
        spy.mockRestore()
      })
      test('should call DataStore.settings if no value set', async () => {
        // tests start with "should" to describe the expected behavior
        const oldValue = DataStore.settings
        DataStore.settings = { settingsString: undefined }
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const _ = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(1, expect.stringMatching(/\*\*\"\"\*\*/))
        DataStore.settings = oldValue
        spy.mockRestore()
      })
      test('should CLO write note.paragraphs to console', async () => {
        // tests start with "should" to describe the expected behavior
        const prevEditorNoteValue = copyObject(Editor.note || {})
        Editor.note = new Note({ filename: 'testingFile' })
        Editor.note.paragraphs = [new Paragraph({ content: 'testingParagraph' })]
        const spy = jest.spyOn(console, 'log')
        const result = await mainFile.sayHello()
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenNthCalledWith(2, expect.stringMatching(/\"content\": \"testingParagraph\"/))
        Editor.note = prevEditorNoteValue
        spy.mockRestore()
      })
      test('should insert a link if not called with a string param', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(Editor, 'insertTextAtCursor')
        const result = await mainFile.sayHello('')
        expect(spy).toHaveBeenCalled()
        expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/noteplan:\/\/x-callback-url\/runPlugin/))
        spy.mockRestore()
      })
      test('should write an error to console on throw', async () => {
        // tests start with "should" to describe the expected behavior
        const spy = jest.spyOn(console, 'log')
        const oldValue = Editor.insertTextAtCursor
        delete Editor.insertTextAtCursor
        try {
          const result = await mainFile.sayHello()
        } catch (e) {
          expect(e.message).stringMatching(/ERROR/)
        }
        expect(spy).toHaveBeenCalledWith(expect.stringMatching(/ERROR/))
        Editor.insertTextAtCursor = oldValue
        spy.mockRestore()
      })
    })
  })
})
