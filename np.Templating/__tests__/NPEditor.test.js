/* global describe, test, expect, jest, beforeEach, afterEach, beforeAll */

// Create jest.mock configurations before imports
jest.mock('@helpers/note', () => ({
  getNote: jest.fn(),
}))

jest.mock('@helpers/paragraph', () => ({
  findStartOfActivePartOfNote: jest.fn(),
  findEndOfActivePartOfNote: jest.fn(),
}))

jest.mock('@helpers/userInput', () => ({
  showMessage: jest.fn().mockResolvedValue(true),
  chooseNote: jest.fn().mockResolvedValue({ title: 'Chosen Note' }),
}))

jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  clo: jest.fn(),
  clof: jest.fn(),
  JSP: jest.fn((e) => e.toString()),
  log: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  timer: jest.fn(),
  overrideSettingsWithStringArgs: jest.fn().mockReturnValue({}),
}))

jest.mock('@helpers/NPnote', () => ({
  selectFirstNonTitleLineInEditor: jest.fn(),
  getNoteFromIdentifier: jest.fn(),
}))

jest.mock('@helpers/dateTime', () => ({
  hyphenatedDate: jest.fn().mockReturnValue('2023-03-14'),
  getISOWeekAndYear: jest.fn(),
  getISOWeekString: jest.fn(),
}))

jest.mock('@helpers/NPdateTime', () => ({
  getNPWeekData: jest.fn(),
}))

jest.mock('@helpers/NPParagraph', () => ({
  replaceContentUnderHeading: jest.fn(),
}))

// Mock the plugin.json
jest.mock('../plugin.json', () => ({
  name: 'Templating',
  version: '1.0.0',
}))

// Mock the helpers
jest.mock('../lib/helpers', () => ({
  helpInfo: jest.fn().mockReturnValue('Mock help info'),
}))

// Create stub modules - only mock what we need
jest.mock(
  'NPTemplating',
  () => ({
    default: {},
  }),
  { virtual: true },
)

jest.mock(
  '@templatingModules/FrontmatterModule',
  () => {
    // Simple mock function
    return function () {
      return {
        isFrontmatterTemplate: jest.fn().mockReturnValue(true),
      }
    }
  },
  { virtual: true },
)

// Skip actual module import
jest.mock('moment/min/moment-with-locales', () => {}, { virtual: true })

// Set up globals
global.NotePlan = {
  environment: {
    templateFolder: '@Templates',
  },
}

global.CommandBar = {
  prompt: jest.fn().mockResolvedValue(true),
}

global.Editor = {
  filename: '',
  note: null,
  openNoteByFilename: jest.fn().mockResolvedValue(true),
}

global.DataStore = {
  invokePluginCommandByName: jest.fn().mockResolvedValue(true),
}

// Load modules - only the ones we need for testing
import * as noteHelper from '@helpers/note'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

// Import the specific function we want to test
// We need to do manual imports to avoid loading all dependencies
// which would require more complex mocking
let addFrontmatterToTemplate

// Load the function directly to avoid loading the entire module
describe('NPEditor', () => {
  beforeAll(() => {
    // We need to mock the module.exports to avoid loading the entire module
    const NPEditor = require('../src/NPEditor')
    addFrontmatterToTemplate = NPEditor.addFrontmatterToTemplate
  })

  describe('addFrontmatterToTemplate', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // Reset the template folder before each test
      NotePlan.environment.templateFolder = '@Templates'
      // Reset Editor state
      Editor.filename = ''
      Editor.note = null
    })

    /**
     * Tests for the startParagraph check
     */
    test('should return early when startParagraph content is "--" (existing frontmatter)', async () => {
      // Create a mock note with existing frontmatter
      const mockNote = {
        filename: '@Templates/Template.md',
        title: 'Template',
        paragraphs: [
          { content: '--', type: 'text' },
          { content: 'NOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note', type: 'text' },
          { content: '--', type: 'text' },
          { content: 'Template content', type: 'text' },
        ],
        insertParagraph: jest.fn(),
      }

      // Mock dependencies
      noteHelper.getNote.mockResolvedValue(mockNote)
      findStartOfActivePartOfNote.mockReturnValue(0) // First paragraph is start of active part

      // Call the function
      await addFrontmatterToTemplate('Template', false)

      // Verify function exited early
      expect(mockNote.insertParagraph).not.toHaveBeenCalled()
      expect(showMessage).toHaveBeenCalledWith('This note already has a note properties section')
    })

    test('should add frontmatter when startParagraph is not frontmatter', async () => {
      // Create a mock note without frontmatter
      const mockNote = {
        filename: '@Templates/Template.md',
        title: 'Template',
        paragraphs: [{ content: 'Template content', type: 'text' }],
        insertParagraph: jest.fn(),
      }

      // Mock dependencies
      noteHelper.getNote.mockResolvedValue(mockNote)
      findStartOfActivePartOfNote.mockReturnValue(0) // First paragraph is start of active part

      // Call the function
      await addFrontmatterToTemplate('Template', false)

      // Verify frontmatter was added
      expect(mockNote.insertParagraph).toHaveBeenCalledWith('--\nNOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note\n--', 0, 'text')
      expect(showMessage).not.toHaveBeenCalled()
    })

    test('should handle when startParagraph is null (empty note)', async () => {
      // Create a mock note without paragraphs
      const mockNote = {
        filename: '@Templates/EmptyTemplate.md',
        title: 'EmptyTemplate',
        paragraphs: [], // Empty note
        insertParagraph: jest.fn(),
      }

      // Mock dependencies
      noteHelper.getNote.mockResolvedValue(mockNote)
      findStartOfActivePartOfNote.mockReturnValue(0) // Start at index 0

      // Call the function
      await addFrontmatterToTemplate('EmptyTemplate', false)

      // Verify frontmatter was added despite null startParagraph
      expect(mockNote.insertParagraph).toHaveBeenCalledWith('--\nNOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note\n--', 0, 'text')
      expect(showMessage).not.toHaveBeenCalled()
    })

    test('should open note in Editor when openInEditor is true', async () => {
      // Create a mock note without frontmatter
      const mockNote = {
        filename: '@Templates/Template.md',
        title: 'Template',
        paragraphs: [{ content: 'Template content', type: 'text' }],
        insertParagraph: jest.fn(),
      }

      // Mock dependencies
      noteHelper.getNote.mockResolvedValue(mockNote)
      findStartOfActivePartOfNote.mockReturnValue(0) // First paragraph is start of active part

      // Call the function with openInEditor=true
      await addFrontmatterToTemplate('Template', true)

      // Verify frontmatter was added and note was opened
      expect(mockNote.insertParagraph).toHaveBeenCalled()
      expect(Editor.openNoteByFilename).toHaveBeenCalledWith('@Templates/Template.md')
    })

    test('should use current Editor note when no template is specified', async () => {
      // Set up the current Editor note
      const editorNote = {
        filename: 'CurrentNote.md',
        title: 'Current Note',
        paragraphs: [{ content: 'Current note content', type: 'text' }],
        insertParagraph: jest.fn(),
      }
      Editor.note = editorNote

      // Mock dependencies
      findStartOfActivePartOfNote.mockReturnValue(0) // First paragraph is start of active part

      // Call the function without specifying a template
      await addFrontmatterToTemplate('', false)

      // Verify frontmatter was added to the current Editor note
      expect(editorNote.insertParagraph).toHaveBeenCalledWith('--\nNOTE_PROPERTIES: Properties in this section will be in the frontmatter of the generated note\n--', 0, 'text')
      expect(noteHelper.getNote).not.toHaveBeenCalled() // getNote should not be called
    })

    test('should use Editor.filename when no template is specified and no Editor.note is available', async () => {
      // Set up just Editor.filename
      Editor.filename = 'CurrentNote.md'
      Editor.note = null

      // Create a mock note to be returned by getNote
      const mockNote = {
        filename: 'CurrentNote.md',
        title: 'Current Note',
        paragraphs: [{ content: 'Current note content', type: 'text' }],
        insertParagraph: jest.fn(),
      }

      // Mock dependencies
      noteHelper.getNote.mockResolvedValue(mockNote)
      findStartOfActivePartOfNote.mockReturnValue(0) // First paragraph is start of active part

      // Call the function without specifying a template
      await addFrontmatterToTemplate('', false)

      // Verify getNote was called with Editor.filename
      expect(noteHelper.getNote).toHaveBeenCalledWith('CurrentNote.md', null, '@Templates')
      expect(mockNote.insertParagraph).toHaveBeenCalled()
    })

    test('should show error when note is not found', async () => {
      // Mock dependencies to return null for the note
      noteHelper.getNote.mockResolvedValue(null)

      // Call the function
      await addFrontmatterToTemplate('NonExistentTemplate', false)

      // Verify error message was shown
      expect(CommandBar.prompt).toHaveBeenCalledWith('Unable to locate template "NonExistentTemplate"', expect.any(String))
      expect(findStartOfActivePartOfNote).not.toHaveBeenCalled() // The function should exit early
    })

    test('should handle errors gracefully', async () => {
      // Mock getNote to throw an error
      noteHelper.getNote.mockRejectedValue(new Error('Test error'))

      // Call the function
      await addFrontmatterToTemplate('Template', false)

      // Verify error was logged
      expect(require('@helpers/dev').logError).toHaveBeenCalled()
    })
  })
})
