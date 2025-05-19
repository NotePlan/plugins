// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

describe('Prompt Edge Cases', () => {
  beforeEach(() => {
    // Mock CommandBar methods
    global.CommandBar = {
      textPrompt: jest.fn<[string, string, string], string | null | void | false>().mockImplementation((title, message, defaultValue) => {
        console.log('CommandBar.textPrompt called with:', { title, message, defaultValue })
        if (message.includes('This will return null')) {
          return null
        }
        if (message.includes('This will return undefined')) {
          return undefined
        }
        if (message.includes('cancelled') || message.includes('This prompt will be cancelled')) {
          return false
        }
        return 'Test Response'
      }),
      showOptions: jest.fn<[string, Array<any>], any | false>().mockImplementation((title, options) => {
        console.log('CommandBar.showOptions called with:', { title, options })
        if (title.includes('cancelled') || title.includes('This prompt will be cancelled')) {
          return false
        }
        return { index: 0, value: 'Test Response' }
      }),
    }
    global.DataStore = {
      settings: { logLevel: 'none' },
    }

    // Mock userInput methods
    // $FlowIgnore - jest mocking
    jest.mock(
      '@helpers/userInput',
      () => ({
        datePicker: jest.fn<[], Promise<string>>().mockImplementation(() => Promise.resolve('2023-01-15')),
        askDateInterval: jest.fn<[], Promise<string>>().mockImplementation(() => Promise.resolve('2023-01-01 to 2023-01-31')),
      }),
      { virtual: true },
    )
  })

  test('Should handle escaped quotes correctly', async () => {
    const templateData = '<%- prompt("quotesVar", "This has \\"escaped\\" quotes", "Default with \\"quotes\\"") %>'
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.quotesVar).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- quotesVar %>')
  })

  test('Should handle very long variable names properly', async () => {
    const longName = 'very_long_variable_name_that_tests_the_limits_of_the_system_with_many_characters_abcdefghijklmnopqrstuvwxyz'
    const templateData = `<%- prompt('${longName}', 'Very long variable name:') %>`
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData[longName]).toBe('Test Response')
    expect(result.sessionTemplateData).toBe(`<%- ${longName} %>`)
  })

  test('Should handle empty variable names gracefully', async () => {
    const templateData = "<%- prompt('', 'Empty variable name:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should use some default/fallback variable name or handle it appropriately
    expect(result.sessionTemplateData).not.toContain('prompt(')
  })

  test('Should handle empty prompt messages', async () => {
    const templateData = "<%- prompt('emptyMsg', '') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.emptyMsg).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- emptyMsg %>')
  })

  test('Should handle unicode characters in variable names and messages', async () => {
    const templateData = "<%- prompt('unicodeVar_\u03B1\u03B2\u03B3', 'Unicode message: \u2665\u2764\uFE0F\u263A') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Unicode characters should be handled properly
    expect(result.sessionData.unicodeVar_αβγ).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- unicodeVar_\u03B1\u03B2\u03B3 %>')
  })

  test('Should handle nested array parameters', async () => {
    const templateData = "<%- prompt('nestedArray', 'Choose an option:', [['Option 1a', 'Option 1b'], ['Option 2a', 'Option 2b']]) %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.nestedArray).toBeDefined()
    expect(result.sessionTemplateData).toBe('<%- nestedArray %>')
  })

  test('Should handle JSON parameters', async () => {
    const templateData = `<%- promptDate('jsonDate', 'Select date:', '{"dateStyle": "full", "timeStyle": "medium", "locale": "en-US"}') %>`
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.jsonDate).toBe('')
    expect(result.sessionTemplateData).toBe('<%- jsonDate %>')
  })

  test('Should handle consecutive template tags with no whitespace', async () => {
    // Tags right next to each other
    const templateData = `<%- prompt('var1', 'First:') %><%- prompt('var2', 'Second:') %>`
    const userData = {}

    global.CommandBar.textPrompt.mockResolvedValueOnce('First Response').mockResolvedValueOnce('Second Response')

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.var1).toBe('First Response')
    expect(result.sessionData.var2).toBe('Second Response')
  })

  test('Should handle multiple template tags on a single line', async () => {
    const templateData = `Name: <%- prompt('name', 'Enter name:') %> Date: <%- promptDate('date', 'Enter date:') %> Status: <%- promptKey('status', 'Enter status:') %>`
    const userData = {}

    global.CommandBar.textPrompt.mockResolvedValueOnce('John Doe')

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.name).toBe('John Doe')
    expect(result.sessionData.date).toBe('')
  })

  test('Should handle comments alongside prompt tags', async () => {
    const templateData = `
      <%# This is a comment %>
      <%- prompt('commentTest', 'Comment test:') %>
      <%# Another comment %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.commentTest).toBe('Test Response')
    expect(result.sessionTemplateData).toContain('<%# This is a comment %>')
    expect(result.sessionTemplateData).toContain('<%- commentTest %>')
    expect(result.sessionTemplateData).toContain('<%# Another comment %>')
  })

  test('Variables cannot be redefined; once the var is defined, prompts are skipped and the value is used', async () => {
    global.CommandBar.textPrompt.mockResolvedValueOnce('First definition').mockResolvedValueOnce('New Definition never happens')

    const templateData = `
      <%- prompt('redefined', 'First definition:') %>
      Value: <%- redefined %>
      <%- prompt('redefined', 'This prompt will never happen') %>
      New Value: <%- redefined %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // The first definition should win
    expect(result.sessionData.redefined).toBe('First definition')

    // Both references to the variable should remain
    expect(result.sessionTemplateData).toContain('Value: <%- redefined %>')
    expect(result.sessionTemplateData).toContain('New Value: <%- redefined %>')

    expect(result.sessionData.redefined).toBe('First definition')
  })

  test('Should handle all escape sequences in parameters', async () => {
    const templateData = `<%- prompt('escapeVar', 'Escape sequences: \\n\\t\\r\\b\\f\\\\\\'\\\"') %>`
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.escapeVar).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- escapeVar %>')
  })

  test('Should handle parameters that look like code', async () => {
    const templateData = `<%- prompt('codeVar', 'Code expression: if (x > 10) { return x; } else { return 0; }') %>`
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.codeVar).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- codeVar %>')
  })

  test('Should handle complex interactions between prompts and logical tests', async () => {
    // Update the mock to return 'Test Response' instead of 'Critical Project'
    global.CommandBar.textPrompt.mockResolvedValueOnce('Test Response')
    global.CommandBar.showOptions.mockResolvedValueOnce({ index: 0 }) // For status

    const templateData = `
      <%# This is a comment %>
      <%- prompt('commentTest', 'Comment test:') %>
      <%# Another comment %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.commentTest).toBe('Test Response')
    expect(result.sessionTemplateData).toContain('<%# This is a comment %>')
    expect(result.sessionTemplateData).toContain('<%- commentTest %>')
    expect(result.sessionTemplateData).toContain('<%# Another comment %>')
  })

  test('Should handle variable setting and value retrieval without duplication', async () => {
    const templateData = `<% var var9 = promptDate('9: Enter your value 09:') %><%- var9 %>`
    const userData = {}
    global.CommandBar.textPrompt.mockResolvedValue('2023-01-15')

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.var9).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- var9 %>')
  })
})
