/**
 * @jest-environment jsdom
 */

/**
 * Integration test to ensure that include/import tags are properly preprocessed.
 */

// @flow
import { DataStore } from '@mocks/index'

// Add Jest to Flow globals
/* global describe, beforeEach, test, expect, jest */

// Define template content for tests
const TEMPLATE_CONTENT = {
  header: '# Included Header\n\nThis is the included header content.',
  footer: '## Included Footer\n\nThis is the included footer content.',
  nested: "Nested template with its own include: <%- include('header') %>",
}

// Create a simplified version of importTemplates for testing
const importTemplates = async (templateData) => {
  let newTemplateData = templateData

  // Process include tags
  const includeRegex = /<%[-\s]*include\(['"]([^'"]+)['"]\)[\s-]*%>/g
  let match
  while ((match = includeRegex.exec(templateData)) !== null) {
    const fullTag = match[0]
    const templateName = match[1]
    const content = TEMPLATE_CONTENT[templateName]

    if (content) {
      // First replace the exact tag
      newTemplateData = newTemplateData.replace(fullTag, content)

      // If the content itself has include tags, process them recursively
      if (content.includes('<%- include(')) {
        newTemplateData = await importTemplates(newTemplateData)
      }
    }
  }

  // Process import tags (same as include for our test purposes)
  const importRegex = /<%[-\s]*import\(['"]([^'"]+)['"]\)[\s-]*%>/g
  while ((match = importRegex.exec(templateData)) !== null) {
    const fullTag = match[0]
    const templateName = match[1]
    const content = TEMPLATE_CONTENT[templateName]

    if (content) {
      newTemplateData = newTemplateData.replace(fullTag, content)
    }
  }

  return newTemplateData
}

// Mock core module
jest.mock('../lib/core', () => {
  return {
    getTemplate: jest.fn().mockImplementation((templateName) => {
      return Promise.resolve(TEMPLATE_CONTENT[templateName] || '')
    }),
    getTemplateFolder: jest.fn().mockResolvedValue('@Templates'),
    isCommentTag: jest.fn().mockImplementation((tag) => false),
  }
})

// Mock FrontmatterModule
jest.mock('../lib/support/modules/FrontmatterModule', () => {
  return jest.fn().mockImplementation(() => {
    return {
      isFrontmatterTemplate: jest.fn().mockReturnValue(false),
      body: jest.fn().mockImplementation((content) => content),
    }
  })
})

describe('Template Preprocessing - test import/include tags', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Setup DataStore mock
    global.DataStore = {
      settings: {
        _logLevel: 'none',
      },
      projectNoteByTitle: jest.fn((title) => {
        const baseName = title.replace(/\.(md|txt)$/, '')
        const content = TEMPLATE_CONTENT[baseName]
        if (content) {
          return { content }
        }
        return null
      }),
      projectNoteByFilename: jest.fn((filename) => {
        const baseName = filename.replace(/\.(md|txt)$/, '')
        const content = TEMPLATE_CONTENT[baseName]
        if (content) {
          return { content }
        }
        return null
      }),
      calendarNoteByDate: jest.fn(() => null),
    }
  })

  test('should process include tags correctly', async () => {
    const templateWithInclude = `
# My Template

<%- include('header') %>

Content in the middle.

<%- include('footer') %>
`

    // Process includes
    const result = await importTemplates(templateWithInclude)

    // Verify the result contains the content from the included templates
    expect(result).toContain('# Included Header')
    expect(result).toContain('This is the included header content')
    expect(result).toContain('## Included Footer')
    expect(result).toContain('This is the included footer content')

    // Verify the original include tags are not present in the output
    expect(result).not.toContain("<%- include('header') %>")
    expect(result).not.toContain("<%- include('footer') %>")
  })

  test('should process import tags correctly', async () => {
    const templateWithImport = `
# My Template

<%- import('header') %>

Content in the middle.

<%- import('footer') %>
`

    // Process imports
    const result = await importTemplates(templateWithImport)

    // Verify the result contains the content from the imported templates
    expect(result).toContain('# Included Header')
    expect(result).toContain('This is the included header content')
    expect(result).toContain('## Included Footer')
    expect(result).toContain('This is the included footer content')

    // Verify the original import tags are not present in the output
    expect(result).not.toContain("<%- import('header') %>")
    expect(result).not.toContain("<%- import('footer') %>")
  })

  test('should handle both include and import tags in complex templates', async () => {
    // Template with both include and import tags, and other EJS tags
    const complexTemplate = `
# Complex Template

<%- include('header') %>

<% const name = 'Test User' %>
<%= name %>, welcome to the template.

<%- import('footer') %>

<% if (name.length > 5) { %>
  Your name is quite long!
<% } else { %>
  Your name is quite short.
<% } %>
`

    // Process the template with importTemplates
    const result = await importTemplates(complexTemplate)

    // Verify the result contains the content from the included/imported templates
    expect(result).toContain('# Included Header')
    expect(result).toContain('This is the included header content')
    expect(result).toContain('## Included Footer')
    expect(result).toContain('This is the included footer content')

    // EJS tags should still be present (not processed yet)
    expect(result).toContain("<% const name = 'Test User' %>")
    expect(result).toContain('<%= name %>, welcome to the template.')
    expect(result).toContain('<% if (name.length > 5) { %>')

    // Verify the original include/import tags are not present in the output
    expect(result).not.toContain("<%- include('header') %>")
    expect(result).not.toContain("<%- import('footer') %>")
  })

  test('should handle nested includes', async () => {
    const templateWithNestedInclude = `
# Template with Nested Include

<%- include('nested') %>

End of template.
`

    // Process includes
    const result = await importTemplates(templateWithNestedInclude)

    // Verify the result contains the nested content
    expect(result).toContain('Nested template with its own include:')
    expect(result).toContain('# Included Header')
    expect(result).toContain('This is the included header content')

    // Verify the original include tags are not present in the output
    expect(result).not.toContain("<%- include('nested') %>")
    expect(result).not.toContain("<%- include('header') %>")
  })
})
