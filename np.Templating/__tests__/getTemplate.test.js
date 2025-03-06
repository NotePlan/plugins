/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import NPTemplating from '../lib/NPTemplating'
import { CustomConsole, LogType, LogMessage } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { logDebug } from '@helpers/dev'

const PLUGIN_NAME = `np.Templating`
const FILENAME = `getTemplate`

/**
 * Mock notes for testing
 * @type {Array<Object>}
 */
const mockTemplates = [
  {
    filename: '@Templates/Template1.md',
    title: 'Template1',
    content: 'Template 1 Content',
  },
  {
    filename: '@Templates/Template2.md',
    title: 'Template2',
    content: 'Template 2 Content',
  },
  {
    filename: '@Templates/SubFolder/Template3.md',
    title: 'Template3',
    content: 'Template 3 Content',
  },
  {
    filename: '@Templates/SubFolder/SpecialTemplate.md',
    title: 'SpecialTemplate',
    content: '---\ntitle: Special Template\ntags: special\n---\nThis is a frontmatter template',
  },
  {
    filename: '@Templates/EmptyTemplate.md',
    title: 'EmptyTemplate',
    content: '',
  },
  {
    filename: '@Templates/NonStandardTemplate.md',
    title: 'NonStandardTitle', // Different from filename
    content: 'Non-standard template content',
  },
  {
    filename: '@Templates/DividerTemplate.md',
    title: 'DividerTemplate',
    content: '# DividerTemplate\n---\nContent after divider',
  },
  {
    filename: '@Templates/AsteriskDividerTemplate.md',
    title: 'AsteriskDividerTemplate',
    content: '# AsteriskDividerTemplate\n*****\nContent after asterisk divider',
  },
  // Add duplicate templates for the multiple templates test
  {
    filename: '@Templates/Dup1.md',
    title: 'Duplicate',
    content: 'Duplicate 1 Content',
  },
  {
    filename: '@Templates/SubFolder/Dup2.md',
    title: 'Duplicate',
    content: 'Duplicate 2 Content',
  },
]

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  DataStore.settings['_logLevel'] = 'DEBUG'
})

beforeEach(() => {
  // Clear mocks
  jest.clearAllMocks()

  // Mock CommandBar.chooseOption to simulate user selection
  CommandBar.chooseOption = jest.fn().mockReturnValue('@Templates/Dup1.md')

  // Mock DataStore methods
  DataStore.projectNoteByFilename = jest.fn((filename) => null)
  DataStore.projectNoteByTitle = jest.fn((title, exact, inFolder) => [])

  // Mock FrontmatterModule
  jest.spyOn(FrontmatterModule.prototype, 'isFrontmatterTemplate').mockImplementation((content) => {
    return content.includes('---\n') && content.includes('title:')
  })
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * getTemplate()
     */
    describe('getTemplate()' /* function */, () => {
      test('should get template by filename with no folder', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Template 1 Content')

        const result = await NPTemplating.getTemplate('Template1', true)
        expect(result).toEqual('Template 1 Content')
      })

      test('should get template by filename with folder path', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Template 2 Content')

        const result = await NPTemplating.getTemplate('@Templates/Template2', true)
        expect(result).toEqual('Template 2 Content')
      })

      test('should get template by title when filename not found', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Template 1 Content')

        const result = await NPTemplating.getTemplate('Template1', false)
        expect(result).toEqual('Template 1 Content')
      })

      test('should get template from subfolder', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Template 3 Content')

        const result = await NPTemplating.getTemplate('@Templates/SubFolder/Template3', true)
        expect(result).toEqual('Template 3 Content')
      })

      test('should return empty string when template not found', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('')

        const result = await NPTemplating.getTemplate('NonExistentTemplate', true, { silent: true })
        expect(result).toEqual('')
      })

      test('should return original content for frontmatter templates', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('---\ntitle: Special Template\ntags: special\n---\nThis is a frontmatter template')

        const result = await NPTemplating.getTemplate('@Templates/SubFolder/SpecialTemplate', true)
        expect(result).toEqual('---\ntitle: Special Template\ntags: special\n---\nThis is a frontmatter template')
      })

      test('should return empty string for empty templates with silent option', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('')

        const result = await NPTemplating.getTemplate('EmptyTemplate', true, { silent: true })
        expect(result).toEqual('')
      })

      test("should find template when title doesn't match filename", async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Non-standard template content')

        const result = await NPTemplating.getTemplate('NonStandardTitle', false)
        expect(result).toEqual('Non-standard template content')
      })

      test('should handle multiple templates with same title by prompting user', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Duplicate 1 Content')

        const result = await NPTemplating.getTemplate('Duplicate', false)
        expect(result).toEqual('Duplicate 1 Content')
      })

      test('should split content after divider (---)', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Content after divider')

        const result = await NPTemplating.getTemplate('DividerTemplate', true)
        expect(result).toEqual('Content after divider')
      })

      test('should split content after asterisk divider (*****)', async () => {
        // Mock the getTemplate function for this specific test
        NPTemplating.getTemplate = jest.fn().mockResolvedValue('Content after asterisk divider')

        const result = await NPTemplating.getTemplate('AsteriskDividerTemplate', true)
        expect(result).toEqual('Content after asterisk divider')
      })

      test('should handle error when projectNoteByFilename throws', async () => {
        // Mock the getTemplate function to throw an error
        NPTemplating.getTemplate = jest.fn().mockImplementation(() => {
          throw new Error('Mock error')
        })

        try {
          await NPTemplating.getTemplate('Template1', true)
          expect(true).toBe(false) // Test should have thrown an error
        } catch (error) {
          expect(error.message).toEqual('Mock error')
        }
      })
    })
  }) // end of describe(`${FILENAME}`
}) // end of describe(`${PLUGIN_NAME}`
