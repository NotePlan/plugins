/* global describe, test, expect, jest, beforeEach, afterEach */

// We need to set up the global mocks before importing the module under test
global.NotePlan = {
  environment: {
    templateFolder: '@Templates',
  },
}

global.CommandBar = {
  prompt: jest.fn().mockResolvedValue(true),
}

// Now import the module under test
import { getTemplateNote } from '../lib/NPTemplateNoteHelpers'
import * as note from '@helpers/note'

// Mock the dependencies
jest.mock('@helpers/note', () => ({
  getNote: jest.fn(),
}))

jest.mock('@helpers/dev', () => ({
  logDebug: jest.fn(),
  clo: jest.fn(),
  clof: jest.fn(),
  JSP: jest.fn(),
  log: jest.fn(),
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  timer: jest.fn(),
}))

// No need to mock these any more since we're using globals
// jest.mock('@mocks/index', () => ({
//   CommandBar: {
//     prompt: jest.fn().mockResolvedValue(true),
//   },
//   NotePlan: {
//     environment: {
//       templateFolder: '@Templates',
//     },
//   },
// }));

describe('NPTemplateNoteHelpers', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
      preference: jest.fn((key: string) => {
        // Return default values for common preferences
        if (key === 'templateFolder') return '@Templates'
        if (key === 'formsFolder') return '@Forms'
        return null
      }),
    }
  })
  describe('getTemplateNote', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // Reset the template folder before each test
      NotePlan.environment.templateFolder = '@Templates'
    })

    /**
     * Tests for successfully finding template notes
     */
    test('should return a template note found by title', async () => {
      // Mock successful note retrieval
      const mockNote = { filename: '@Templates/Template Note.md', title: 'Template Note' }
      note.getNote.mockResolvedValue(mockNote)

      // Call the function with just a title
      const result = await getTemplateNote('Template Note')

      // Verify correct parameters were passed to getNote
      expect(note.getNote).toHaveBeenCalledWith('Template Note', false, '@Templates')
      expect(result).toEqual(mockNote)
      expect(CommandBar.prompt).not.toHaveBeenCalled()
    })

    test('should return a template note found with filename', async () => {
      // Mock successful note retrieval
      const mockNote = { filename: '@Templates/Template.md', title: 'Template' }
      note.getNote.mockResolvedValue(mockNote)

      // Call the function with a filename
      const result = await getTemplateNote('Template.md')

      // Verify correct parameters were passed to getNote
      expect(note.getNote).toHaveBeenCalledWith('Template.md', false, '@Templates')
      expect(result).toEqual(mockNote)
      expect(CommandBar.prompt).not.toHaveBeenCalled()
    })

    test('should return a template note found with a path', async () => {
      // Mock successful note retrieval
      const mockNote = { filename: '@Templates/Snippets/Code Block.md', title: 'Code Block' }
      note.getNote.mockResolvedValue(mockNote)

      // Call the function with a path
      const result = await getTemplateNote('Snippets/Code Block')

      // Verify correct parameters were passed to getNote
      // The getNote function will handle finding the note with the path and filePathStartsWith parameter
      expect(note.getNote).toHaveBeenCalledWith('Snippets/Code Block', false, '@Templates')
      expect(result).toEqual(mockNote)
      expect(CommandBar.prompt).not.toHaveBeenCalled()
    })

    test('should return a template note with a full path starting with template folder', async () => {
      // Mock successful note retrieval
      const mockNote = { filename: '@Templates/Snippets/Code Block.md', title: 'Code Block' }
      note.getNote.mockResolvedValue(mockNote)

      // Call the function with a full path
      const result = await getTemplateNote('@Templates/Snippets/Code Block')

      // Verify correct parameters were passed to getNote
      expect(note.getNote).toHaveBeenCalledWith('@Templates/Snippets/Code Block', false, '@Templates')
      expect(result).toEqual(mockNote)
      expect(CommandBar.prompt).not.toHaveBeenCalled()
    })

    /**
     * Tests for template notes that aren't found
     */
    test('should show prompt when template is not found', async () => {
      // Mock unsuccessful note retrieval
      note.getNote.mockResolvedValue(null)

      // Call the function with a non-existent template
      const result = await getTemplateNote('Non-existent Template')

      // Verify correct parameters were passed to getNote
      expect(note.getNote).toHaveBeenCalledWith('Non-existent Template', false, '@Templates')
      expect(result).toBeNull()
      // Updated message to reflect that we now search in multiple folders
      expect(CommandBar.prompt).toHaveBeenCalledWith(
        'Unable to locate template "Non-existent Template"',
        expect.stringContaining('Unable to locate template "Non-existent Template"'),
      )
    })

    test('should not show prompt when template is not found and runSilently is true', async () => {
      // Mock unsuccessful note retrieval
      note.getNote.mockResolvedValue(null)

      // Call the function with a non-existent template and runSilently=true
      const result = await getTemplateNote('Non-existent Template', true)

      // Verify correct parameters were passed to getNote
      expect(note.getNote).toHaveBeenCalledWith('Non-existent Template', false, '@Templates')
      expect(result).toBeNull()
      expect(CommandBar.prompt).not.toHaveBeenCalled()
    })

    /**
     * Tests for custom template folder
     */
    test('should use custom template folder from NotePlan.environment', async () => {
      // Change the template folder
      NotePlan.environment.templateFolder = '@Custom Templates'
      // Also update the preference mock to return the custom folder
      global.DataStore.preference.mockImplementation((key: string) => {
        if (key === 'templateFolder') return '@Custom Templates'
        if (key === 'formsFolder') return '@Forms'
        return null
      })

      // Mock successful note retrieval
      const mockNote = { filename: '@Custom Templates/Template.md', title: 'Template' }
      note.getNote.mockResolvedValue(mockNote)

      // Call the function
      const result = await getTemplateNote('Template')

      // Verify correct parameters were passed to getNote with the custom folder
      expect(note.getNote).toHaveBeenCalledWith('Template', false, '@Custom Templates')
      expect(result).toEqual(mockNote)
      
      // Reset preference mock for other tests
      global.DataStore.preference.mockImplementation((key: string) => {
        if (key === 'templateFolder') return '@Templates'
        if (key === 'formsFolder') return '@Forms'
        return null
      })
    })

    test('should handle empty template name', async () => {
      // Mock unsuccessful note retrieval
      note.getNote.mockResolvedValue(null)

      // Call the function with an empty template name
      const result = await getTemplateNote('')

      // For empty string, getNote is not called because of the if(_templateName) check
      expect(note.getNote).not.toHaveBeenCalled()
      expect(result).toBeNull()
      expect(CommandBar.prompt).toHaveBeenCalled()
    })

    test('should handle undefined template name', async () => {
      // Mock unsuccessful note retrieval
      note.getNote.mockResolvedValue(null)

      // Call the function with undefined
      const result = await getTemplateNote(undefined)

      // For undefined (default parameter becomes empty string), getNote is not called
      expect(note.getNote).not.toHaveBeenCalled()
      expect(result).toBeNull()
      expect(CommandBar.prompt).toHaveBeenCalled()
    })
  })
})
