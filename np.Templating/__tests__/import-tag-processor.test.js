/**
 * @fileoverview Tests for import tag processing with template string support
 */

import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import { importTemplates } from '../lib/rendering/templateProcessor'
import { getTemplate, getTags, isCommentTag } from '../lib/core'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// Mock the core module functions
jest.mock('../lib/core', () => ({
  getTemplate: jest.fn(),
  getTags: jest.fn(),
  isCommentTag: jest.fn(),
}))

describe('Import tag processing with template strings', () => {
  let getTemplateMock, getTagsMock, isCommentTagMock

  beforeEach(() => {
    getTemplateMock = getTemplate
    getTagsMock = getTags
    isCommentTagMock = isCommentTag

    getTemplateMock.mockClear()
    getTagsMock.mockClear()
    isCommentTagMock.mockClear()

    // Default mock implementations
    getTagsMock.mockResolvedValue([])
    isCommentTagMock.mockReturnValue(false)
  })

  // Test case 1: Basic template string evaluation
  test('should evaluate basic template strings in import tag template names', async () => {
    const templateData = '<%- import(`Monthly Notes/${currentMonth} Monthly Note`) %>'
    const sessionData = { currentMonth: 'July' }
    const expectedTemplateName = 'Monthly Notes/July Monthly Note'

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import(`Monthly Notes/${currentMonth} Monthly Note`) %>'])

    // Mock getTemplate to return a simple template with frontmatter
    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Test Content')

    const result = await importTemplates(templateData, sessionData)

    // Verify getTemplate was called with the evaluated template name
    expect(getTemplateMock).toHaveBeenCalledWith(expectedTemplateName)

    // Verify the import tag was replaced with the template body
    expect(result).toContain('# Test Content')
    expect(result).not.toContain('<%- import')
  })

  // Test case 2: Template string with nested object properties
  test('should evaluate template strings with nested object properties', async () => {
    const templateData = '<%- import(`templates/${user.name}`) %>'
    const sessionData = { user: { name: 'John' } }
    const expectedTemplateName = 'templates/John'

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import(`templates/${user.name}`) %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# User Template')

    const result = await importTemplates(templateData, sessionData)

    expect(getTemplateMock).toHaveBeenCalledWith(expectedTemplateName)
    expect(result).toContain('# User Template')
  })

  // Test case 3: Template string with multiple variables
  test('should evaluate template strings with multiple variables', async () => {
    const templateData = '<%- import(`templates/${year}/${month}/template`) %>'
    const sessionData = { year: '2024', month: 'January' }
    const expectedTemplateName = 'templates/2024/January/template'

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import(`templates/${year}/${month}/template`) %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Multi-variable Template')

    const result = await importTemplates(templateData, sessionData)

    expect(getTemplateMock).toHaveBeenCalledWith(expectedTemplateName)
    expect(result).toContain('# Multi-variable Template')
  })

  // Test case 4: Template string with quotes preserved
  test('should preserve template strings with quotes in template names', async () => {
    const templateData = '<%- import(`templates/${user.name || "default"}`) %>'
    const sessionData = { user: { name: 'John' } }
    // The evaluateTemplateStrings function doesn't support JavaScript expressions with operators
    // It only supports simple variable substitution, so the expression should be preserved
    const expectedTemplateName = 'templates/${user.name || "default"}'

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import(`templates/${user.name || "default"}`) %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Quoted Template')

    const result = await importTemplates(templateData, sessionData)

    expect(getTemplateMock).toHaveBeenCalledWith(expectedTemplateName)
    expect(result).toContain('# Quoted Template')
  })

  // Test case 5: No template strings - should work as before
  test('should handle import tags without template strings', async () => {
    const templateData = '<%- import("simple-template") %>'
    const sessionData = {}

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import("simple-template") %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Simple Template')

    const result = await importTemplates(templateData, sessionData)

    expect(getTemplateMock).toHaveBeenCalledWith('simple-template')
    expect(result).toContain('# Simple Template')
  })

  // Test case 6: Template string with missing variable - should preserve original
  test('should preserve template string when variable is missing', async () => {
    const templateData = '<%- import(`templates/${missingVariable}`) %>'
    const sessionData = { otherVariable: 'value' }

    // Mock getTags to return the import tag
    getTagsMock.mockResolvedValue(['<%- import(`templates/${missingVariable}`) %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Missing Variable Template')

    const result = await importTemplates(templateData, sessionData)

    // Should preserve the original template string since missingVariable is not in sessionData
    expect(getTemplateMock).toHaveBeenCalledWith('templates/${missingVariable}')
    expect(result).toContain('# Missing Variable Template')
  })

  // Test case 7: Multiple import tags in same template
  test('should handle multiple import tags with template strings', async () => {
    const templateData = `
      <%- import(\`templates/\${currentMonth}\`) %>
      <%- import(\`templates/\${currentYear}\`) %>
    `
    const sessionData = { currentMonth: 'July', currentYear: '2024' }

    // Mock getTags to return both import tags
    getTagsMock.mockResolvedValue(['<%- import(`templates/${currentMonth}`) %>', '<%- import(`templates/${currentYear}`) %>'])

    getTemplateMock.mockResolvedValue('---\ntitle: Test\n---\n# Multiple Imports')

    const result = await importTemplates(templateData, sessionData)

    expect(getTemplateMock).toHaveBeenCalledWith('templates/July')
    expect(getTemplateMock).toHaveBeenCalledWith('templates/2024')
    expect(result).toContain('# Multiple Imports')
  })

  // Test case 8: Import tag with error handling
  test('should handle import tag parsing errors gracefully', async () => {
    const templateData = '<%- import() %>' // Missing content
    const sessionData = {}

    // Mock getTags to return the malformed import tag
    getTagsMock.mockResolvedValue(['<%- import() %>'])

    const result = await importTemplates(templateData, sessionData)

    expect(result).toContain('**Unable to parse import**')
    expect(getTemplateMock).not.toHaveBeenCalled()
  })
})
