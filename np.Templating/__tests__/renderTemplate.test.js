/* eslint-disable */
/* global jest, describe, test, expect, beforeEach, afterEach */

// Set up global mocks BEFORE importing the module
global.NotePlan = {
  environment: {
    templateFolder: '@Templates',
  },
}

global.CommandBar = {
  prompt: jest.fn().mockResolvedValue(true),
  showOptions: jest.fn().mockResolvedValue({ index: 0 }),
  textPrompt: jest.fn().mockResolvedValue('test value'),
}

global.DataStore = {
  projectNotes: [],
  projectNoteByTitle: jest.fn(),
  projectNoteByFilename: jest.fn(),
  settings: { _logLevel: 'none' },
}

global.Editor = {
  selectedParagraphs: [],
}

// Mock the dev helpers
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

// Now import the module under test
import NPTemplating from '../lib/NPTemplating'

const PLUGIN_NAME = 'np.Templating'

describe(`${PLUGIN_NAME}`, () => {
  describe('renderTemplate', () => {
    beforeEach(() => {
      jest.clearAllMocks()

      // Reset the template folder before each test
      NotePlan.environment.templateFolder = '@Templates'

      // Mock DataStore methods
      DataStore.projectNotes = [
        {
          filename: '@Templates/TestTemplate.md',
          title: 'TestTemplate',
          content: `---
title: Test Template
tags: test, template
---
This is the template body content.
It should be rendered without the frontmatter.`,
        },
        {
          filename: '@Templates/SimpleTemplate.md',
          title: 'SimpleTemplate',
          content: `# SimpleTemplate without frontmatter
This is a simple template without frontmatter.
It should render as-is.`,
        },
        {
          filename: '@Templates/ComplexTemplate.md',
          title: 'ComplexTemplate',
          content: `---
title: Complex Template
type: meeting-note
date: <%= date.now() %>
---
# Meeting Notes

## Agenda
- Item 1
- Item 2

## Notes
<%= meetingName %>`,
        },
      ]

      // Mock DataStore methods
      DataStore.projectNoteByTitle = jest.fn().mockImplementation((title, includeArchived, includeTrash) => {
        return DataStore.projectNotes.filter((note) => note.title === title)
      })

      DataStore.projectNoteByFilename = jest.fn().mockImplementation((filename) => {
        return DataStore.projectNotes.find((note) => note.filename === filename) || null
      })

      // Mock CommandBar
      CommandBar.prompt = jest.fn().mockResolvedValue(true)
      CommandBar.showOptions = jest.fn().mockResolvedValue({ index: 0 })
      CommandBar.textPrompt = jest.fn().mockResolvedValue('test value')

      // Mock Editor
      Editor.selectedParagraphs = []
    })

    test('should render template body without frontmatter', async () => {
      const result = await NPTemplating.renderTemplate('TestTemplate')

      // Should not contain frontmatter
      expect(result).not.toContain('---')
      expect(result).not.toContain('title: Test Template')
      expect(result).not.toContain('tags: test, template')

      // Should contain the body content
      expect(result).toContain('This is the template body content.')
      expect(result).toContain('It should be rendered without the frontmatter.')
    })

    test('should render simple template without frontmatter as-is', async () => {
      const result = await NPTemplating.renderTemplate('SimpleTemplate')

      // Should contain the full content since there's no frontmatter
      expect(result).toContain('This is a simple template without frontmatter.')
      expect(result).toContain('It should render as-is.')
    })

    test('should process template variables in body', async () => {
      const result = await NPTemplating.renderTemplate('ComplexTemplate', {
        meetingName: 'Test Meeting',
      })

      // Should not contain frontmatter
      expect(result).not.toContain('---')
      expect(result).not.toContain('title: Complex Template')
      expect(result).not.toContain('type: meeting-note')

      // Should contain processed body content
      expect(result).toContain('# Meeting Notes')
      expect(result).toContain('## Agenda')
      expect(result).toContain('- Item 1')
      expect(result).toContain('- Item 2')
      expect(result).toContain('## Notes')
      expect(result).toContain('Test Meeting') // Processed variable
    })

    test('should handle template not found gracefully', async () => {
      const result = await NPTemplating.renderTemplate('NonExistentTemplate')

      // Should return an error message
      expect(result).toContain('Error')
      expect(result).toContain('NonExistentTemplate')
    })

    test('should pass user data to template rendering', async () => {
      const userData = {
        name: 'John Doe',
        company: 'Test Corp',
      }

      // Create a template that uses the user data
      DataStore.projectNotes.push({
        filename: '@Templates/UserDataTemplate.md',
        title: 'UserDataTemplate',
        content: `---
title: User Data Template
---
Hello <%= name %> from <%= company %>!`,
      })

      const result = await NPTemplating.renderTemplate('UserDataTemplate', userData)

      // Should not contain frontmatter
      expect(result).not.toContain('---')
      expect(result).not.toContain('title: User Data Template')

      // Should contain processed user data
      expect(result).toContain('Hello John Doe from Test Corp!')
    })

    test('should handle frontmatter with template variables', async () => {
      // Create a template with frontmatter that has template variables
      const dn = String(Date.now())
      DataStore.projectNotes.push({
        filename: '@Templates/FrontmatterVarsTemplate.md',
        title: 'FrontmatterVarsTemplate',
        frontmatterAttributes: { title: 'FrontmatterVarsTemplate', date: dn, foo: 'bar' },
        content: `---
title: FrontmatterVarsTemplate
foo: bar
---
Content for <%= title %>`,
      })

      const userData = {}
      const result = await NPTemplating.renderTemplate('FrontmatterVarsTemplate', {})

      // Should not contain the frontmatter section
      expect(result).not.toContain('---')
      expect(result).not.toContain('<%')

      // Should contain the processed body content
      expect(result).toContain('Content for FrontmatterVarsTemplate')
    })
  })
})
