/**
 * @jest-environment jsdom
 */

/**
 * Tests for template error handling improvements
 * Verifies that error messages are clear and helpful
 */

import TemplatingEngine from '../lib/TemplatingEngine'
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
    expect(result).toContain('An error occurred rendering template:')
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
})
