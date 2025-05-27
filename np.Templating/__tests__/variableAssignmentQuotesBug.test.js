// @flow

import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import { getTags } from '../lib/core'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('Variable Assignment Quotes Bug Test', () => {
  beforeEach(() => {
    // Setup the necessary global mocks
    global.DataStore = {
      settings: { logLevel: 'none' },
    }

    // Mock CommandBar for consistent responses
    global.CommandBar = {
      textPrompt: jest.fn(() => Promise.resolve('Work')),
      showOptions: jest.fn((options, message) => {
        return Promise.resolve({ value: 'Work' })
      }),
    }

    // Mock necessary functions for promptKey
    global.getValuesForFrontmatterTag = jest.fn().mockResolvedValue(['Option1', 'Option2'])
  })

  test('should correctly process variable assignment with promptKey and quotes', async () => {
    // This is the exact format that's failing in production
    const template = `<% const category = promptKey("category") -%>
Category: <%- category %>
`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {}, '<%', '%>', getTags)

    // Check the actual values in sessionData
    // console.log('Session Data:', JSON.stringify(sessionData, null, 2))
    // console.log('Template Output:', sessionTemplateData)

    // Verify the session data contains our variable
    expect(sessionData).toHaveProperty('category')

    // This is the key test: verify that the value is NOT "promptKey(category)"
    expect(sessionData.category).not.toBe('promptKey(category)')

    // Verify that the template has been properly transformed
    expect(sessionTemplateData).toContain('Category: <%- category %>')

    // Make sure the original code is replaced
    expect(sessionTemplateData).not.toContain('const category = promptKey("category")')
  })

  test('should correctly process variable assignment with promptKey and single quotes', async () => {
    // Test with single quotes instead of double quotes
    const template = `<% const category = promptKey('category') -%>
Category: <%- category %>
`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {}, '<%', '%>', getTags)

    // Verify the session data contains our variable
    expect(sessionData).toHaveProperty('category')

    // Verify that the value is NOT "promptKey(category)"
    expect(sessionData.category).not.toBe('promptKey(category)')

    // Verify that the template has been properly transformed
    expect(sessionTemplateData).toContain('Category: <%- category %>')

    // Make sure the original code is replaced
    expect(sessionTemplateData).not.toContain("const category = promptKey('category')")
  })

  test('should correctly process variable assignment with promptKey without quotes', async () => {
    // Test with no quotes around the parameter
    const template = `<% const category = promptKey(category) -%>
Category: <%- category %>
`

    // Process the template
    const { sessionTemplateData, sessionData } = await processPrompts(template, {}, '<%', '%>', getTags)

    // Verify the session data contains our variable
    expect(sessionData).toHaveProperty('category')

    // This test might fail if the system doesn't properly handle unquoted parameters
    expect(sessionData.category).not.toBe('promptKey(category)')

    // Verify the template transformation
    expect(sessionTemplateData).toContain('Category: <%- category %>')
  })
})
