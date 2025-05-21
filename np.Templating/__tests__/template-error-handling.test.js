/**
 * @jest-environment jsdom
 */

/**
 * Tests for template error handling improvements
 * Verifies that error messages are clear and helpful
 */

import TemplatingEngine from '../lib/TemplatingEngine'
import NPTemplating from '../lib/NPTemplating'
import { DataStore } from '@mocks/index'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

describe('TemplatingEngine error handling', () => {
  let templatingEngine
  let originalConsoleLog
  let consoleOutput = []

  beforeEach(() => {
    templatingEngine = new TemplatingEngine()

    originalConsoleLog = console.log
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })

    // Mock DataStore.invokePluginCommandByName
    global.DataStore = DataStore
    DataStore.invokePluginCommandByName = jest.fn().mockResolvedValue('mocked result')
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleOutput = []
    delete global.DataStore
    jest.clearAllMocks()
  })

  test('should provide clear error messages for syntax errors', async () => {
    const template = `<% const x = 5
    const y = "unclosed string
    %>`

    const result = await templatingEngine.render(template, {})

    // Check for clear error message format
    expect(result).toContain('Template Rendering Error')
    expect(result).toContain('SyntaxError:') // Should indicate it's a syntax error
    expect(result).not.toContain('ejs:') // Should not have noisy ejs internals
  })

  test('should provide context around the error location', async () => {
    const template = `<% const a = 1; %>
<% let b = c; // Undefined variable %>
<% const d = 3; %>`

    const result = await templatingEngine.render(template, {})

    // Should include line context with line numbers and markers
    expect(result).toMatch(/\d+\|.*const a/) // Line before error
    expect(result).toMatch(/>>.*\d+\|.*let b = c/) // Error line with marker
    expect(result).toMatch(/\d+\|.*const d/) // Line after error

    // Should include error message
    expect(result).toMatch(/not defined|undefined|Reference/)
  })

  test('should handle errors in real-world day template', async () => {
    const template = `<% const dayNum = date.dayNumber(\`\${date.format('YYYY-MM-DD',Editor.note.title)}\`)
const isWeekday = dayNum >= 1 && dayNum <= 5
const isWeekend = !isWeekday
-%>
# Missing semicolons but should still work
<% if (dayNum = 6) { // Assignment instead of comparison - should cause error -%>
* Weekend task
<% } -%>`

    const renderData = {
      date: {
        dayNumber: jest.fn().mockReturnValue(5),
        format: jest.fn().mockReturnValue('2023-01-01'),
      },
      Editor: {
        note: {
          title: 'Test Note',
        },
      },
    }

    const result = await templatingEngine.render(template, renderData)

    // Should correctly identify the error
    expect(result).toMatch(/>>.*\d+\|.*dayNum = 6/) // Should mark the error line
    expect(result).toMatch(/Assignment.*variable|TypeError.*Assignment/i) // Should explain the error
  })

  test('should detect unclosed EJS tags', async () => {
    const template = `<% const x = 5 %>
<% if (x > 3) { %>
  Hello World
<% } // Missing closing tag`

    const result = await templatingEngine.render(template, {})

    // Should match error format with line numbers and >> indicator
    expect(result).toContain('## Template Rendering Error')
    expect(result).toContain('==Rendering failed==')
    expect(result).toContain('Could not find matching close tag for "<%".')
  })

  test('should detect unmatched closing tags', () => {
    const template = `<% const x = 5 %>
<% if (x > 3) { %>
  Hello World
<% } %>
%> // Extra closing tag`

    const result = NPTemplating.validateTemplateTags(template)

    // Should match error format with line numbers and >> indicator
    expect(result).toContain('==Template error: Found unmatched closing tag near line')
    expect(result).toContain('(showing the line where a closing tag was found without a matching opening tag)')
    expect(result).toMatch(/```\n\s+\d+\|\s*<% const x = 5 %>/)
    expect(result).toMatch(/>>\s+\d+\|\s*%> \/\/ Extra closing tag/)
  })

  test('should handle nested tags correctly', async () => {
    const template = `<% if (true) { %>
  <% if (false) { %>
    Nested content
  <% } %>
<% } %>`

    const result = await templatingEngine.render(template, {})
    expect(result).not.toContain('Template error') // Should not find any tag errors
  })

  test('should handle all EJS tag types', async () => {
    const template = `<%= "Escaped output" %>
<%- "Unescaped output" %>
<%~ "Trimmed output" %>
<% const x = 5 %>`

    const result = await templatingEngine.render(template, {})
    expect(result).not.toContain('Template error') // Should not find any tag errors
  })

  test('should handle complex nested structures', async () => {
    const template = `<% if (true) { %>
  <%= "Level 1" %>
  <% if (false) { %>
    <%- "Level 2" %>
    <% if (undefined) { %>
      <%~ "Level 3" %>
    <% } %>
  <% } %>
<% } %>`

    const result = await templatingEngine.render(template, {})
    expect(result).not.toContain('Template error') // Should not find any tag errors
  })

  test('should show context around syntax errors', async () => {
    const template = `<% const x = 5 %>
<% if (x > 3) { %>
  Hello World
<% } // Missing closing brace`

    const result = await templatingEngine.render(template, {})

    // Should show context with line numbers and >> indicator
    expect(result).toContain('## Template Rendering Error')
    expect(result).toContain('==Rendering failed==')
    expect(result).toContain('Could not find matching close tag for "<%".')
  })
})
