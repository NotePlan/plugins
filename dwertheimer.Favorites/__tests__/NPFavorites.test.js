/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

// NOTE: IF YOU CALL A NPFRONTMATTER FUNCTION, YOU MUST MOCK IT MANUALLY HERE OR YOU WILL GET A FUNCTION NOT FOUND ERROR

import * as f from '../src/NPFavorites'
import { CustomConsole, LogType, LogMessage, clo } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter, Note, Paragraph /* mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { getConfig } from '../src/NPFavorites'

// dbw note: some of ChatGPT's suggested mocking actually becomes a hassle because underlying functions imported in these modules are not mocked
// I have tried to include them with the ...originalModule approach but it is not always possible
// DBW NOTE TO SELF: Avoid the function mocking wherever possible. Only mock things like showMessage & chooseOption

// Mocks for userInput helpers
jest.mock('../../helpers/userInput', () => {
  const originalModule = jest.requireActual('../../helpers/userInput')
  return {
    ...originalModule,
    chooseOption: jest.fn(),
    showMessage: jest.fn((msg) => Promise.resolve()),
  }
})

const PLUGIN_NAME = `Favorites`
const FILENAME = `NPFavorites`

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

/**
 * Tests for the NPFavorites plugin functions.
 * @module NPFavorites.test
 */

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /**
     * Reset mocks and globals before each test
     * @returns {void}
     */
    beforeEach(() => {
      jest.clearAllMocks()
      // Reset Editor.note to a new Note by default
      Editor.note = new Note()
      // Set default settings favoriteIdentifier to 'Star in title'
      DataStore.settings.favoriteIdentifier = 'Star in title'
      DataStore.settings._logLevel = 'none'
      // Default for projectNotes
      DataStore.projectNotes = []
    })
    afterEach(() => {
      DataStore.settings._logLevel = 'none'
    })

    /**
     * Tests for the setFavorite function
     * @returns {void}
     */
    describe('setFavorite', () => {
      /**
       * Test that when the note is already a favorite, the user is notified and no further action is taken.
       * @returns {Promise<void>}
       */
      test('should notify user if the note is already a favorite', async () => {
        // Setup note as already favorite
        Editor.note = new Note({ title: '⭐️ Test Note', type: 'Notes' })
        const { showMessage } = require('../../helpers/userInput')
        showMessage.mockClear()
        await f.setFavorite()
        expect(showMessage).toHaveBeenCalledWith('This file is already a Favorite! Use /unfave to remove.')
      })

      /**
       * Test that when the note is not already a favorite and using the Star identifier, the title is updated correctly.
       * @returns {Promise<void>}
       */
      test('should set favorite by updating note title when not already favorite using Star identifier', async () => {
        // Setup note as not already favorite
        Editor.note = new Note({ title: 'Test Note', type: 'Notes' })
        await f.setFavorite()
      })

      /**
       * Test that if no valid note is selected, the user is notified accordingly.
       * @returns {Promise<void>}
       */
      test.skip('should notify user when no valid note is selected', async () => {
        // Explicitly set Editor.note to null to simulate no note selected
        Editor.note = null
        const { showMessage } = require('../../helpers/userInput')
        showMessage.mockClear()
        await f.setFavorite()
        expect(showMessage).toHaveBeenCalledWith('Please select a Project Note in Editor first.')
        global.Editor = Editor
      })
      test('should work in real world example', async () => {
        const note = new Note({
          title: 'this is title',
          filename: 'DELETEME/Productivity & Apps/this is title.md',
          type: 'Notes',
          frontmatterAttributes: { title: 'this is title' },
          paragraphs: [
            {
              content: '---',
              rawContent: '---',
              type: 'separator',
              heading: '',
              headingLevel: -1,
              lineIndex: 0,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'title: this is title',
              rawContent: 'title: this is title',
              type: 'text',
              heading: '',
              headingLevel: -1,
              lineIndex: 1,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: '---',
              rawContent: '---',
              type: 'separator',
              heading: '',
              headingLevel: -1,
              lineIndex: 2,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
            {
              content: 'this is text',
              rawContent: 'this is text',
              type: 'text',
              heading: '',
              headingLevel: -1,
              lineIndex: 3,
              isRecurring: false,
              indents: 0,
              noteType: 'Notes',
            },
          ],
        })
        Editor.note = note
        await f.setFavorite()
        expect(note.paragraphs[1].content).toEqual('title: ⭐️ this is title')
        expect(note.paragraphs.length).toEqual(4)
      })
    })

    /**
     * Tests for openFavorite function
     * @returns {void}
     */
    describe('openFavorite', () => {
      /**
       * Test that when no favorite documents are found, the user is notified.
       * @returns {Promise<void>}
       */
      test('should notify user if no favorite documents found', async () => {
        // Setup mocks to simulate no favorites available
        const { showMessage } = require('../../helpers/userInput')
        showMessage.mockClear()
        await f.openFavorite()
        expect(showMessage).toHaveBeenCalledWith('No favorites found matching your setting which requires: "Star in title"! Use the /fave document command to set a favorite.')
      })

      /**
       * Test that when favorites exist, the selected favorite document is opened.
       * @returns {Promise<void>}
       */
      test('should open the selected favorite document', async () => {
        // Setup mocks to simulate favorites available
        DataStore.projectNotes = [{ title: '⭐️ Fav Note', filename: 'fav_note.md' }]
        const { chooseOption } = require('../../helpers/userInput')
        chooseOption.mockClear()
        chooseOption.mockResolvedValue('fav_note.md')

        // Spy on Editor.openNoteByFilename
        Editor.openNoteByFilename = jest.fn((filename) => Promise.resolve())
        await f.openFavorite()
        expect(chooseOption).toHaveBeenCalledWith('Choose a Favorite (⭐️) Document:', [{ label: '⭐️ Fav Note', value: 'fav_note.md' }], '')
        expect(Editor.openNoteByFilename).toHaveBeenCalledWith('fav_note.md')
      })

      /**
       * Test that openFavorite combines notes with frontmatter and notes with stars.
       * @returns {Promise<void>}
       */
      test('should combine notes with frontmatter and notes with stars', async () => {
        // Setup mock notes
        const notesWithFM = [
          new Note({ title: 'FM Note', filename: 'fm_note.md', frontmatterAttributes: { favorite: true }, type: 'Notes', content: '---\nfavorite: true\n---\n' }),
        ]
        const notesWithStars = [new Note({ title: '⭐️ Star Note', filename: 'star_note.md' })]
        DataStore.projectNotes = [...notesWithStars, ...notesWithFM]
        DataStore.settings = {
          ...DataStore.settings,
          favoriteIdentifier: 'Star or Frontmatter (either)',
          favoriteKey: 'favorite',
          _logLevel: 'none',
        }

        const { chooseOption } = require('../../helpers/userInput')
        chooseOption.mockClear()
        chooseOption.mockResolvedValue('star_note.md')

        // Spy on Editor.openNoteByFilename
        Editor.openNoteByFilename = jest.fn((filename) => Promise.resolve())

        await f.openFavorite()
        expect(chooseOption).toHaveBeenCalledWith(
          'Choose a Favorite (⭐️) Document:',
          [
            { label: 'FM Note', value: 'fm_note.md' },
            { label: '⭐️ Star Note', value: 'star_note.md' },
          ],
          '',
        )
        expect(Editor.openNoteByFilename).toHaveBeenCalledWith('star_note.md')
      })
    })

    /**
     * Tests for removeFavorite function
     * @returns {void}
     */
    describe('removeFavorite', () => {
      /**
       * Test that when a note is favorite using the Star identifier, its favorite status is removed by updating the title.
       * @returns {Promise<void>}
       */
      test('should remove favorite status when note is favorite using Star identifier', async () => {
        // Setup note as favorite using Star indicator
        Editor.note = new Note({ title: '⭐️ Test Note', type: 'Notes' })
        await f.removeFavorite()
      })

      /**
       * Test that if the note is not marked as favorite, the user is notified.
       * @returns {Promise<void>}
       */
      test('should notify user if note is not favorite', async () => {
        // Setup note that is not favorite
        Editor.note = new Note({ title: 'Test Note', type: 'Notes' })
        const { showMessage } = require('../../helpers/userInput')
        showMessage.mockClear()
        await f.removeFavorite()
        expect(showMessage).toHaveBeenCalledWith('This file is not a Favorite! Use /fave to make it one.')
      })

      /**
       * Test that if no valid note is selected for removal, the user is notified accordingly.
       * @returns {Promise<void>}
       * // FIXME: This test is failing because Editor is a proxy. I don't know how to mock it.
       */
      test.skip('should notify user when no valid note is selected in removeFavorite', async () => {
        // Explicitly set Editor.note to null to simulate no note selected
        Editor.note = null
        const { showMessage } = require('../../helpers/userInput')
        showMessage.mockClear()
        await f.removeFavorite()
        expect(showMessage).toHaveBeenCalledWith('Please select a Project Note in Editor first.')
      })

      /**
       * Test that removeFavorite removes the frontmatter favorite property when using Frontmatter only configuration.
       * @returns {Promise<void>} A promise that resolves when the test is complete.
       * // FIXME: This test is failing because Editor is a proxy. I don't know how to mock it.
       */
      test.skip('should remove frontmatter favorite property when using Frontmatter only', async () => {
        // Setup note with favorite marked in frontmatter
        const note = new Note({ title: 'Test Note', type: 'Notes', frontmatterAttributes: { favorite: 'true' } })
        Editor.note = note
        // Set configuration to Frontmatter only using dynamic favoriteKey
        DataStore.settings.favoriteIdentifier = 'Frontmatter only'
        DataStore.settings.favoriteKey = 'favorite'
        DataStore.settings._logLevel = 'none'
        // Call removeFavorite
        await f.removeFavorite()

        // Verify that the frontmatter attribute was removed using the dynamic key
        expect(note.content).not.toContain('favorite: true')
      })
    })

    describe('Frontmatter favorite behavior in NP Favorites', () => {
      /**
       * Test that setFavorite sets the frontmatter favorite property to 'true' when using Frontmatter only configuration.
       * @returns {Promise<void>} A promise that resolves when the test is complete.
       */
      test.skip('should set frontmatter favorite when using Frontmatter only', async () => {
        // TODO: we need a mock for changing frontMatterAttributes when note content changes
        // Setup note with no favorite marked in frontmatter
        const paragraphs = [
          new Paragraph({ content: '---', rawContent: '---', type: 'separator', heading: '', headingLevel: -1, lineIndex: 0, isRecurring: false, indents: 0, noteType: 'Notes' }),
          new Paragraph({
            content: 'title: Test Note',
            rawContent: 'title: Test Note',
            type: 'text',
            heading: '',
            headingLevel: -1,
            lineIndex: 1,
            isRecurring: false,
            indents: 0,
            noteType: 'Notes',
          }),
          new Paragraph({ content: '---', rawContent: '---', type: 'separator', heading: '', headingLevel: -1, lineIndex: 2, isRecurring: false, indents: 0, noteType: 'Notes' }),
          new Paragraph({ content: 'foo', rawContent: 'foo', type: 'text', heading: '', headingLevel: -1, lineIndex: 3, isRecurring: false, indents: 0, noteType: 'Notes' }),
        ]
        const note = new Note({ title: 'Test Note', type: 'Notes', frontmatterAttributes: {}, paragraphs })
        global.Editor = { ...global.Editor, ...note, note: note }
        // Set configuration to Frontmatter only using dynamic favoriteKey
        DataStore.settings.favoriteIdentifier = 'Frontmatter only'
        DataStore.settings.favoriteKey = 'favorite'
        DataStore.settings._logLevel = 'none'
        // Call setFavorite
        await f.setFavorite()

        // Verify that the frontmatter attribute was set to 'true' using the dynamic key
        expect(note.frontmatterAttributes['favorite']).toEqual('true')
      })

      /**
       * Test that removeFavorite sets the frontmatter favorite property to 'false' when using Frontmatter only configuration.
       * @returns {Promise<void>} A promise that resolves when the test is complete.
       * // FIXME: This test is failing because Editor is a proxy. I don't know how to mock it.
       */
      test.skip('should remove frontmatter favorite when using Frontmatter only', async () => {
        // Setup note with favorite marked in frontmatter
        const note = new Note({ title: 'Test Note', type: 'Notes', frontmatterAttributes: { favorite: 'true' } })
        Editor.note = note
        // Set configuration to Frontmatter only using dynamic favoriteKey
        DataStore.settings.favoriteIdentifier = 'Frontmatter only'
        DataStore.settings.favoriteKey = 'favorite'
        DataStore.settings._logLevel = 'none'

        // Call removeFavorite
        await f.removeFavorite()

        // Verify that the frontmatter attribute was set to 'false' using the dynamic key
        expect(note.frontmatterAttributes['favorite']).toBeUndefined()
      })
    })

    describe('getConfig', () => {
      /**
       * Test that the favoriteKey is reset to 'favorite' if it contains invalid characters.
       * @returns {Promise<void>}
       */
      test('should reset favoriteKey to default if it contains invalid characters', async () => {
        DataStore.settings = {
          ...DataStore.settings,
          favoriteIdentifier: 'Frontmatter only',
          favoriteKey: 'fav@key',
          _logLevel: 'none',
        }
        const config = await getConfig()
        expect(config.favoriteKey).toBe('favorite')
      })

      /**
       * Test that the favoriteKey remains unchanged if it is valid.
       * @returns {Promise<void>}
       */
      test('should keep favoriteKey unchanged if it is valid', async () => {
        DataStore.settings = {
          ...DataStore.settings,
          favoriteIdentifier: 'Frontmatter only',
          favoriteKey: 'validKey',
          _logLevel: 'none',
        }
        const config = await getConfig()
        expect(config.favoriteKey).toBe('validKey')
      })
    })
    // end of function tests
  }) // end of describe(`${FILENAME}`)
}) // end of describe(`${PLUGIN_NAME}`)
