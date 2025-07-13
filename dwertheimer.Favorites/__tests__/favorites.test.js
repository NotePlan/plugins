/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* globals describe, expect, it, test, beforeAll, beforeEach, afterAll, jest */
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import * as f from '../src/favorites'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { getFavoriteDefault, favoriteNotes, getFaveOptionsArray, titleHasFavoriteIcon, getFavoritedTitle, removeFavoriteFromTitle, noteIsFavorite } from '../src/favorites'
import { noteHasFrontMatter, getFrontMatterAttributes } from '@helpers/NPFrontMatter'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
  DataStore.settings['favoriteIdentifier'] = 'Star in title'
  DataStore.settings['favoriteKey'] = 'favorite'
})

const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star in title', favoriteKey: 'favorite' }

// Mock the functions that need to be mocked
jest.mock('../src/favorites', () => ({
  ...jest.requireActual('../src/favorites'),
  titleHasFavoriteIcon: jest.fn((title, icon) => title.includes(icon)),
}))

jest.mock('@helpers/NPFrontMatter', () => ({
  noteHasFrontMatter: jest.fn(() => true),
  getFrontMatterAttributes: jest.fn(() => ({ favorite: true })),
  hasFrontMatter: jest.fn(() => true),
  getAttributes: jest.fn(() => ({ favorite: true })),
}))

// Jest suite
describe('dwertheimer.Favorites favorites.js', () => {
  // getFavoriteDefault
  test('getFavoriteDefault', () => {
    // expect(pd.isTask(noteWithTasks.paragraphs[1])).toBe(true)
    // expect(pd.isTask(noteWithOutTasks.paragraphs[1])).toBe(false)
    expect(getFavoriteDefault()).toEqual('⭐️')
  })

  //favoriteNotes
  describe('favoriteNotes ', () => {
    test('should find favorites tag wherever it exists in a string', () => {
      const notes = [{ title: '⭐️ front' }, { title: 'back ⭐️' }, { title: 'mid ⭐️ dle' }, { title: 'none' }]
      const faves = favoriteNotes(notes, config)
      expect(faves.length).toEqual(3)
      expect(faves[0].title).toEqual('⭐️ front')
      expect(faves[1].title).toEqual('back ⭐️')
      expect(faves[2].title).toEqual('mid ⭐️ dle')
    })
    test('should find no favorites if title is undefined', () => {
      expect(favoriteNotes([{ title: undefined }], config)).toEqual([])
    })
  })

  // getFaveOptionsArray
  describe('getFaveOptionsArray ', () => {
    test('options creator function should return value/label for each favorite', () => {
      const notes = [
        { title: '⭐️ front', filename: 'f1' },
        { title: 'back ⭐️', filename: 'f2' },
        { title: 'mid ⭐️ dle', filename: 'f3' },
      ]
      const options = getFaveOptionsArray(notes)
      expect(options.length).toEqual(3)
      expect(options[0].label).toEqual('⭐️ front')
      expect(options[0].value).toEqual('f1')
    })
    test('options creator function should return empty array for undefined values', () => {
      expect(getFaveOptionsArray([{ title: undefined, filename: undefined }])).toEqual([])
    })
  })

  // Test f.removeFavorite
  describe('removeFavorite ', () => {
    test('should remove favorite marker wherever it is in the string', () => {
      expect(removeFavoriteFromTitle('⭐️ front', '⭐️', config.favoriteIdentifier)).toEqual('front')
      expect(removeFavoriteFromTitle('back ⭐️', '⭐️', config.favoriteIdentifier)).toEqual('back')
      expect(removeFavoriteFromTitle('not here', '⭐️', config.favoriteIdentifier)).toEqual('not here')
    })
  })

  //titleHasFavoriteIcon
  describe('titleHasFavoriteIcon ', () => {
    test('should return true if there is a favorite icon in the title', () => {
      expect(titleHasFavoriteIcon(`⭐️`, `⭐️`)).toEqual(true)
      expect(titleHasFavoriteIcon(`⭐️ yes`, `⭐️`)).toEqual(true)
      expect(titleHasFavoriteIcon(`test ⭐️`, `⭐️`)).toEqual(true)
      expect(titleHasFavoriteIcon(`test ⭐️ test`, `⭐️`)).toEqual(true)
    })
    test('should return false if there is no favorite icon in the title', () => {
      expect(titleHasFavoriteIcon(`test test`, `⭐️`)).toEqual(false)
      expect(titleHasFavoriteIcon(``, `⭐️`)).toEqual(false)
    })
  })

  //getFavoritedTitle
  describe('getFavoritedTitle ', () => {
    test('should insert favorite icon at front of string with prepend option', () => {
      expect(getFavoritedTitle(`test`, 'prepend', `⭐️`, config.favoriteIdentifier)).toEqual(`⭐️ test`)
    })
    test('should insert favorite icon at end of string with append option', () => {
      expect(getFavoritedTitle(`test`, 'append', `⭐️`, config.favoriteIdentifier)).toEqual(`test ⭐️`)
    })
  })

  // Test noteIsFavorite function
  describe('noteIsFavorite', () => {
    test('should return true if note is favorite by title', () => {
      const note = { title: '⭐️ Note', filename: 'note.md', paragraphs: [{ type: 'separator' }] }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star in title', favoriteKey: 'favorite' }
      titleHasFavoriteIcon.mockReturnValue(true)

      expect(noteIsFavorite(note, config)).toBe(true)
    })

    test('should return false if note is not favorite by title', () => {
      const note = { title: 'Note', filename: 'note.md', paragraphs: [{ type: 'separator' }] }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star in title', favoriteKey: 'favorite' }
      titleHasFavoriteIcon.mockReturnValue(false)

      expect(noteIsFavorite(note, config)).toBe(false)
    })

    test('should return true if note is favorite by frontmatter', () => {
      const note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: { favorite: true },
      }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Frontmatter only', favoriteKey: 'favorite' }
      noteHasFrontMatter.mockReturnValue(true)

      expect(noteIsFavorite(note, config)).toBe(true)
    })

    test('should return false if note is not favorite by frontmatter', () => {
      const note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: { favorite: false },
      }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Frontmatter only', favoriteKey: 'favorite' }
      noteHasFrontMatter.mockReturnValue(true)

      expect(noteIsFavorite(note, config)).toBe(false)
    })

    test('should return true if note is favorite by either title or frontmatter', () => {
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star or Frontmatter (either)', favoriteKey: 'favorite' }
      // Case 1: Title is favorite
      let note = {
        title: '⭐️ Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: {},
      }
      titleHasFavoriteIcon.mockReturnValue(true)
      noteHasFrontMatter.mockReturnValue(false)
      expect(noteIsFavorite(note, config)).toBe(true)

      // Case 2: Frontmatter is favorite
      note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: { favorite: true },
      }
      titleHasFavoriteIcon.mockReturnValue(false)
      noteHasFrontMatter.mockReturnValue(true)
      expect(noteIsFavorite(note, config)).toBe(true)
    })

    test('should return false if note is not favorite by either title or frontmatter', () => {
      const note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: {},
      }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star or Frontmatter (either)', favoriteKey: 'favorite' }
      titleHasFavoriteIcon.mockReturnValue(false)
      noteHasFrontMatter.mockReturnValue(false)

      expect(noteIsFavorite(note, config)).toBe(false)
    })

    test('should return true if note is favorite by both title and frontmatter', () => {
      const note = {
        title: '⭐️ Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: { favorite: true },
      }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star and Frontmatter (both)', favoriteKey: 'favorite' }
      titleHasFavoriteIcon.mockReturnValue(true)
      noteHasFrontMatter.mockReturnValue(true)

      expect(noteIsFavorite(note, config)).toBe(true)
    })

    test('should return false if note is not favorite by both title and frontmatter', () => {
      let note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: {},
      }
      const config = { favoriteIcon: '⭐️', favoriteIdentifier: 'Star and Frontmatter (both)', favoriteKey: 'favorite' }
      titleHasFavoriteIcon.mockReturnValue(true)
      noteHasFrontMatter.mockReturnValue(false)
      expect(noteIsFavorite(note, config)).toBe(false)

      note = {
        title: 'Note',
        filename: 'note.md',
        paragraphs: [{ type: 'separator' }],
        frontmatterAttributes: { favorite: true },
      }
      titleHasFavoriteIcon.mockReturnValue(false)
      noteHasFrontMatter.mockReturnValue(true)
      expect(noteIsFavorite(note, config)).toBe(false)
    })
  })
})
