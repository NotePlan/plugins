// @flow

import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import NPTemplating from '../lib/NPTemplating'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('Unquoted Parameter Tests', () => {
  beforeEach(() => {
    // Setup the necessary global mocks
    global.DataStore = {
      settings: { logLevel: 'none' },
      projectNotes: [],
      calendarNotes: [],
    }

    // Mock CommandBar for consistent responses
    global.CommandBar = {
      textPrompt: jest.fn(() => Promise.resolve('Test Value')),
      showOptions: jest.fn((options, message) => {
        return Promise.resolve({ value: 'Test Value' })
      }),
    }

    global.getValuesForFrontmatterTag = jest.fn().mockResolvedValue(['Option1', 'Option2'])
  })

  test('should process unquoted parameter as a string literal', async () => {
    // The template with unquoted parameter
    const template = `<% const category = promptKey(category) -%>\nResult: <%- category %>`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {}, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Log diagnostic information
    console.log('Session Data:', JSON.stringify(sessionData, null, 2))
    console.log('Template Output:', sessionTemplateData)

    // Verify the session data contains the variable
    expect(sessionData).toHaveProperty('category')

    // Verify the result is not "promptKey(category)" but the actual value
    expect(sessionData.category).not.toBe('promptKey(category)')

    // Verify that the template has been transformed
    expect(sessionTemplateData).toContain('Result: <%- category %>')

    // Verify the original code is replaced
    expect(sessionTemplateData).not.toContain('const category = promptKey(category)')
  })

  test('should correctly handle a variable reference in parameter', async () => {
    // Initial session data with an existing variable
    const initialSessionData = {
      existingVar: 'my-category',
    }

    // Template that uses the existing variable as parameter
    const template = `<% const result = promptKey(existingVar) -%>\nResult: <%- result %>`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, initialSessionData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Log diagnostic information
    console.log('Initial Session Data:', JSON.stringify(initialSessionData, null, 2))
    console.log('Final Session Data:', JSON.stringify(sessionData, null, 2))
    console.log('Template Output:', sessionTemplateData)

    // Verify the session data contains our variable
    expect(sessionData).toHaveProperty('result')

    // The key issue: verify the system recognized existingVar as a variable reference
    expect(sessionData.result).not.toBe('promptKey(existingVar)')

    // Check the template transformation
    expect(sessionTemplateData).toContain('Result: <%- result %>')
  })
})
