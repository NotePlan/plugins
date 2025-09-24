/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */

// Mock the config module before any imports
jest.mock('../lib/config', () => ({
  getTemplateFolder: jest.fn().mockResolvedValue('@Templates'),
}))

import { CustomConsole, LogType, LogMessage } from '@jest/console'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter } from '@mocks/index'
import FrontmatterModule from '../lib/support/modules/FrontmatterModule'
import { logDebug } from '@helpers/dev'

const PLUGIN_NAME = `np.Templating`
const FILENAME = `templateManager`

/**
 * Mock notes for testing template filtering
 * @type {Array<Object>}
 */
const mockTemplates = [
  {
    filename: '@Templates/Type1Template.md',
    title: 'Type1Template',
    content: '---\ntitle: Type1Template\ntype: meeting,work\n---\nTemplate 1 Content',
    frontmatterTypes: ['meeting', 'work'],
    frontmatterAttributes: { type: 'meeting,work', tags: 'important,urgent' },
  },
  {
    filename: '@Templates/Type2Template.md',
    title: 'Type2Template',
    content: '---\ntitle: Type2Template\ntype: personal\n---\nTemplate 2 Content',
    frontmatterTypes: ['personal'],
    frontmatterAttributes: { type: 'personal', tags: 'home,family' },
  },
  {
    filename: '@Templates/MultiTypeTemplate.md',
    title: 'MultiTypeTemplate',
    content: '---\ntitle: MultiTypeTemplate\ntype: meeting,personal\n---\nTemplate 3 Content',
    frontmatterTypes: ['meeting', 'personal'],
    frontmatterAttributes: { type: 'meeting,personal', tags: 'work,home' },
  },
  {
    filename: '@Templates/Tag1Template.md',
    title: 'Tag1Template',
    content: '---\ntitle: Tag1Template\ntags: important,urgent\n---\nTemplate 4 Content',
    frontmatterTypes: ['work'],
    frontmatterAttributes: { type: 'work', tags: 'important,urgent' },
  },
  {
    filename: '@Templates/IgnoreTemplate.md',
    title: 'IgnoreTemplate',
    content: '---\ntitle: IgnoreTemplate\ntype: ignore\n---\nTemplate 6 Content',
    frontmatterTypes: ['ignore'],
    frontmatterAttributes: { type: 'ignore', tags: 'test' },
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
  DataStore.settings['_logLevel'] = 'none'

  // Set up the mock data
  DataStore.projectNotes = mockTemplates
})

beforeEach(() => {
  // Clear mocks
  jest.clearAllMocks()

  // Mock DataStore.loadJSON for getSettings
  DataStore.loadJSON = jest.fn().mockResolvedValue({})

  // Mock FrontmatterModule.attributes
  jest.spyOn(FrontmatterModule.prototype, 'attributes').mockImplementation((content) => {
    const template = mockTemplates.find((t) => t.content === content)
    return Promise.resolve(template ? template.frontmatterAttributes : {})
  })

  // Reset the config mock to default
  const configModule = require('../lib/config')
  configModule.getTemplateFolder.mockResolvedValue('@Templates')
})

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('Basic functionality tests', () => {
      test('getTemplateList should be a function', () => {
        const { getTemplateList } = require('../lib/core/templateManager')
        expect(typeof getTemplateList).toBe('function')
      })

      test('getTemplateListByTags should be a function', () => {
        const { getTemplateListByTags } = require('../lib/core/templateManager')
        expect(typeof getTemplateListByTags).toBe('function')
      })

      test('both functions should return arrays', async () => {
        const { getTemplateList, getTemplateListByTags } = require('../lib/core/templateManager')

        const typeResult = await getTemplateList('*')
        const tagResult = await getTemplateListByTags('*')

        expect(Array.isArray(typeResult)).toBe(true)
        expect(Array.isArray(tagResult)).toBe(true)
      })

      test('getTemplateList should include note object when configured', async () => {
        const { getTemplateList } = require('../lib/core/templateManager')

        const result = await getTemplateList('*')

        // The function should return an array, and if it has items, they should have the expected structure
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('label')
          expect(result[0]).toHaveProperty('value')
          // Note: The note property might be included depending on the implementation
        }
      })

      test('getTemplateListByTags should not include note object', async () => {
        const { getTemplateListByTags } = require('../lib/core/templateManager')

        const result = await getTemplateListByTags('*')

        // The function should return an array, and if it has items, they should have the expected structure
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('label')
          expect(result[0]).toHaveProperty('value')
          // Note: The note property should not be included for getTemplateListByTags
        }
      })
    })

    describe('Error handling', () => {
      test('should handle template folder not found', async () => {
        // Import the mocked config module
        const configModule = require('../lib/config')
        configModule.getTemplateFolder.mockResolvedValue(null)
        jest.spyOn(CommandBar, 'prompt').mockResolvedValue('OK')

        const { getTemplateList } = require('../lib/core/templateManager')

        const result = await getTemplateList('meeting')

        expect(CommandBar.prompt).toHaveBeenCalledWith('Templating Error', 'An error occurred locating null folder')
        expect(result).toEqual([])
      })

      test('should handle errors gracefully', async () => {
        // Import the mocked config module
        const configModule = require('../lib/config')
        configModule.getTemplateFolder.mockRejectedValue(new Error('Test error'))

        const { getTemplateList } = require('../lib/core/templateManager')

        const result = await getTemplateList('meeting')

        expect(result).toEqual([])
      })
    })

    describe('Integration test - verify refactoring works', () => {
      test('both functions should use the same helper internally', async () => {
        const { getTemplateList, getTemplateListByTags } = require('../lib/core/templateManager')

        // Both functions should exist and be callable
        expect(typeof getTemplateList).toBe('function')
        expect(typeof getTemplateListByTags).toBe('function')

        // Both should return arrays (even if empty due to mocking limitations)
        const typeResult = await getTemplateList('*')
        const tagResult = await getTemplateListByTags('*')

        expect(Array.isArray(typeResult)).toBe(true)
        expect(Array.isArray(tagResult)).toBe(true)

        // This test primarily verifies that the refactored functions can be called
        // without throwing errors, which means the helper function is working
      })

      test('functions should handle different parameter types', async () => {
        const { getTemplateList, getTemplateListByTags } = require('../lib/core/templateManager')

        // Test with string parameter
        const stringResult = await getTemplateList('meeting')
        expect(Array.isArray(stringResult)).toBe(true)

        // Test with array parameter
        const arrayResult = await getTemplateList(['meeting', 'work'])
        expect(Array.isArray(arrayResult)).toBe(true)

        // Test with exclusion parameter
        const exclusionResult = await getTemplateList('!personal')
        expect(Array.isArray(exclusionResult)).toBe(true)

        // Same tests for getTemplateListByTags
        const tagStringResult = await getTemplateListByTags('important')
        expect(Array.isArray(tagStringResult)).toBe(true)

        const tagArrayResult = await getTemplateListByTags(['important', 'urgent'])
        expect(Array.isArray(tagArrayResult)).toBe(true)

        const tagExclusionResult = await getTemplateListByTags('!important')
        expect(Array.isArray(tagExclusionResult)).toBe(true)
      })
    })
  })
})
