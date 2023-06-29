/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, it, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../urls'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `urls.js`

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
    describe('findURLsInText', () => {
      it('should find markdown and bare URLs in text with subdomain removed', () => {
        const text = 'Hello [Example](https://www.example.com/page)\nWorld https://www.example2.com/page2'
        const result = f.findURLsInText(text, true)
        expect(result).toEqual([
          {
            url: 'https://www.example.com/page',
            name: 'Example',
            lineIndex: 0,
            domain: 'example',
            page: 'page',
            type: 'markdown',
          },
          {
            url: 'https://www.example2.com/page2',
            name: null,
            lineIndex: 1,
            domain: 'example2',
            page: 'page2',
            type: 'bareURL',
          },
        ])
      })

      it('should find markdown and bare URLs in text in the same line', () => {
        const text = 'Hello [Example](https://www.example.com/page) World https://www.example2.com/page2'
        const result = f.findURLsInText(text, true)
        expect(result).toEqual([
          {
            url: 'https://www.example.com/page',
            name: 'Example',
            lineIndex: 0,
            domain: 'example',
            page: 'page',
            type: 'markdown',
          },
          {
            url: 'https://www.example2.com/page2',
            name: null,
            lineIndex: 0,
            domain: 'example2',
            page: 'page2',
            type: 'bareURL',
          },
        ])
      })

      it('should find markdown and bare URLs in text without removing subdomain', () => {
        const text = 'Hello [Example](https://www.example.com/page)\nWorld https://www.example2.com/page2'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([
          {
            url: 'https://www.example.com/page',
            name: 'Example',
            lineIndex: 0,
            domain: 'www.example',
            page: 'page',
            type: 'markdown',
          },
          {
            url: 'https://www.example2.com/page2',
            name: null,
            lineIndex: 1,
            domain: 'www.example2',
            page: 'page2',
            type: 'bareURL',
          },
        ])
      })

      it('should find links without http in markdown links - domain and page are empty', () => {
        const text = 'Hello [Example](www.example.com/page)'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([
          {
            url: 'www.example.com/page',
            name: 'Example',
            lineIndex: 0,
            domain: '',
            page: '',
            type: 'markdown',
          },
        ])
      })

      it('should not find the same link (without http) in a bare link', () => {
        const text = 'Hello www.example.com/page'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([])
      })

      it('should find links that are deeplinks in markdown links', () => {
        const text = 'Hello [Example](noteplan://doSomething?with=param)'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([
          {
            url: 'noteplan://doSomething?with=param',
            name: 'Example',
            lineIndex: 0,
            domain: '',
            page: '',
            type: 'markdown',
          },
        ])
      })

      it('should find bare noteplan: URIs', () => {
        const text = 'An example: noteplan://doSomething?with=param'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([
          {
            url: 'noteplan://doSomething?with=param',
            name: null,
            lineIndex: 0,
            domain: '',
            page: '',
            type: 'bareURL',
          },
        ])
      })

      it('should find bare hook mark links', () => {
        const text = 'Hello Example hook://file/something to somewhere'
        const result = f.findURLsInText(text, false)
        expect(result).toEqual([
          {
            url: 'hook://file/something',
            name: null,
            lineIndex: 0,
            domain: '',
            page: 'something',
            type: 'bareURL',
          },
        ])
      })

      it('should handle text without URLs', () => {
        const text = 'Hello World'
        const result = f.findURLsInText(text)
        expect(result).toEqual([])
      })
    })
  })
})
