/* global describe, test, expect, beforeAll, beforeEach, afterEach */
import { DataStore } from '@mocks/index'
import {
  DEFAULT_NOTE_FILE_EXTENSION,
  FILE_EXTENSIONS_GROUP,
  RE_NOTE_FILE_EXTENSION,
  SUPPORTED_NOTE_FILE_EXTENSIONS,
  getUsersNoteFileExtension,
  makeCalendarFilename,
} from '../NPFileExtensions'

const PLUGIN_NAME = 'helpers'
const FILENAME = 'NPFileExtensions'

beforeAll(() => {
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none'
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('constants', () => {
      test('SUPPORTED_NOTE_FILE_EXTENSIONS lists md and txt', () => {
        expect(SUPPORTED_NOTE_FILE_EXTENSIONS).toEqual(['md', 'txt'])
      })

      test('DEFAULT_NOTE_FILE_EXTENSION is the first supported extension', () => {
        expect(DEFAULT_NOTE_FILE_EXTENSION).toBe('md')
        expect(SUPPORTED_NOTE_FILE_EXTENSIONS[0]).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('FILE_EXTENSIONS_GROUP matches supported extensions at end of string', () => {
        const composed = new RegExp(`20240828${FILE_EXTENSIONS_GROUP}`, 'i')
        expect('20240828.md').toMatch(composed)
        expect('20240828.txt').toMatch(composed)
        expect('20240828.pdf').not.toMatch(composed)
      })
    })

    describe('RE_NOTE_FILE_EXTENSION', () => {
      test.each([
        'note.md',
        'note.txt',
        'folder/subfolder/note.md',
        'note.MD',
        'note.TXT',
        'My Note.md',
      ])('matches supported note filename: %s', (filename) => {
        expect(RE_NOTE_FILE_EXTENSION.test(filename)).toBe(true)
      })

      test.each([
        'note.pdf',
        'note.markdown',
        'note',
        'note.md.backup',
        'notemd',
        'folder/note.txt/readme',
      ])('does not match non-note filename: %s', (filename) => {
        expect(RE_NOTE_FILE_EXTENSION.test(filename)).toBe(false)
      })

      test('match() returns the extension with original casing', () => {
        expect('folder/My Note.MD'.match(RE_NOTE_FILE_EXTENSION)?.[0]).toBe('.MD')
      })

      test('replace() strips the extension', () => {
        expect('20240828.md'.replace(RE_NOTE_FILE_EXTENSION, '')).toBe('20240828')
        expect('folder/weekly.md'.replace(RE_NOTE_FILE_EXTENSION, '')).toBe('folder/weekly')
      })
    })

    describe('getUsersNoteFileExtension', () => {
      let savedDefaultFileExtension

      beforeEach(() => {
        savedDefaultFileExtension = DataStore.defaultFileExtension
      })

      afterEach(() => {
        DataStore.defaultFileExtension = savedDefaultFileExtension
      })

      test('returns DataStore.defaultFileExtension when set', () => {
        DataStore.defaultFileExtension = 'txt'
        expect(getUsersNoteFileExtension()).toBe('txt')
      })

      test('returns default when defaultFileExtension is unset', () => {
        DataStore.defaultFileExtension = undefined
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('returns default when defaultFileExtension is empty', () => {
        DataStore.defaultFileExtension = ''
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('returns default when defaultFileExtension is a function (React/HTML window bridge proxy)', () => {
        // In a React/HTML window every DataStore property access returns an async bridge function,
        // which is truthy - returning it built filenames like "20260829.function(...args) {...}".
        // $FlowFixMe[incompatible-type] - deliberately wrong type, to mimic the WebView bridge
        DataStore.defaultFileExtension = function (...args) {
          return Promise.resolve(args)
        }
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
        expect(makeCalendarFilename('20260829')).toBe(`20260829.${DEFAULT_NOTE_FILE_EXTENSION}`)
      })

      test('returns default when defaultFileExtension is not a string', () => {
        // $FlowFixMe[incompatible-type] - deliberately wrong type
        DataStore.defaultFileExtension = { then: () => {} }
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('trims whitespace and any leading dot', () => {
        DataStore.defaultFileExtension = ' .txt '
        expect(getUsersNoteFileExtension()).toBe('txt')
      })

      test('returns default when DataStore access throws', () => {
        const savedDataStore = global.DataStore
        global.DataStore = {
          get defaultFileExtension() {
            throw new Error('DataStore unavailable')
          },
        }
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
        global.DataStore = savedDataStore
      })
    })

    describe('getUsersNoteFileExtension in a React window', () => {
      // In a React window DataStore is an async bridge proxy (every property access returns a function),
      // so the extension comes from the pluginData payload np.Shared bakes in when it opens the window.
      const bridgeProxyDataStore = {
        get defaultFileExtension() {
          return function (...args) {
            return Promise.resolve(args)
          }
        },
      }
      let savedDataStore

      beforeEach(() => {
        savedDataStore = global.DataStore
        global.DataStore = bridgeProxyDataStore
      })

      afterEach(() => {
        global.DataStore = savedDataStore
        delete global.globalSharedData
      })

      test('falls back to pluginData.notePlanSettings.defaultFileExtension', () => {
        global.globalSharedData = { pluginData: { notePlanSettings: { defaultFileExtension: 'txt' } } }
        expect(getUsersNoteFileExtension()).toBe('txt')
        expect(makeCalendarFilename('20260829')).toBe('20260829.txt')
      })

      test('returns default when globalSharedData is absent', () => {
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('returns default when pluginData has no notePlanSettings', () => {
        global.globalSharedData = { pluginData: {} }
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('returns default when the baked value is not a string', () => {
        global.globalSharedData = { pluginData: { notePlanSettings: { defaultFileExtension: 42 } } }
        expect(getUsersNoteFileExtension()).toBe(DEFAULT_NOTE_FILE_EXTENSION)
      })

      test('a real DataStore string still wins over the baked value', () => {
        global.DataStore = { defaultFileExtension: 'md' }
        global.globalSharedData = { pluginData: { notePlanSettings: { defaultFileExtension: 'txt' } } }
        expect(getUsersNoteFileExtension()).toBe('md')
      })
    })

    describe('makeCalendarFilename', () => {
      let savedDefaultFileExtension

      beforeEach(() => {
        savedDefaultFileExtension = DataStore.defaultFileExtension
      })

      afterEach(() => {
        DataStore.defaultFileExtension = savedDefaultFileExtension
      })

      test.each([
        ['20240828', 'md', '20240828.md'],
        ['2024-W35', 'md', '2024-W35.md'],
        ['2024-08', 'txt', '2024-08.txt'],
        ['2024-Q3', 'txt', '2024-Q3.txt'],
      ])('builds %s with %s extension as %s', (dateStr, extension, expected) => {
        DataStore.defaultFileExtension = extension
        expect(makeCalendarFilename(dateStr)).toBe(expected)
      })

      test('uses default extension when DataStore preference is unset', () => {
        DataStore.defaultFileExtension = undefined
        expect(makeCalendarFilename('20240828')).toBe(`20240828.${DEFAULT_NOTE_FILE_EXTENSION}`)
      })
    })
  })
})
