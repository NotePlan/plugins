// @flow
/**
 * @jest-environment jsdom
 */

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

describe('Prompt Await Issue Tests', () => {
  beforeEach(() => {
    // Create a fresh CommandBar mock for each test
    global.CommandBar = {
      textPrompt: jest.fn().mockResolvedValue('Test Response'),
      showOptions: jest.fn().mockResolvedValue({ index: 0 }),
    }
    global.DataStore = {
      settings: { logLevel: 'none' },
    }

    // Mock userInput methods
    // $FlowIgnore - jest mocking
    jest.mock(
      '@helpers/userInput',
      () => ({
        datePicker: jest.fn().mockImplementation(() => Promise.resolve('2023-01-15')),
        askDateInterval: jest.fn().mockImplementation(() => Promise.resolve('5d')),
      }),
      { virtual: true },
    )
  })

  test('Should handle await promptDateInterval correctly', async () => {
    // This reproduces the issue seen in production
    const templateData = "<%- await promptDateInterval('intervalVariable01') %>"
    const userData = {}

    // Get the mocked function
    // $FlowIgnore - jest mocked module
    const { askDateInterval } = require('@helpers/userInput')

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Log the result for debugging
    console.log('Session data:', JSON.stringify(result.sessionData, null, 2))
    console.log('Template data:', result.sessionTemplateData)

    // The issue is that the variable name becomes 'await_\'intervalVariable01\'' instead of just 'intervalVariable01'
    // This test will fail until the issue is fixed
    expect(result.sessionData).toHaveProperty('intervalVariable01')
    expect(result.sessionData).not.toHaveProperty("await_'intervalVariable01'")
    expect(result.sessionTemplateData).toBe('<%- intervalVariable01 %>')
    expect(result.sessionTemplateData).not.toContain('await_')
    expect(result.sessionTemplateData).not.toContain("'intervalVariable01'")
  })

  test('Should handle await promptDate correctly', async () => {
    const templateData = "<%- await promptDate('dateVariable01') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData).toHaveProperty('dateVariable01')
    expect(result.sessionData).not.toHaveProperty("await_'dateVariable01'")
    expect(result.sessionTemplateData).toBe('<%- dateVariable01 %>')
    expect(result.sessionTemplateData).not.toContain('await_')
  })

  test('Should handle await prompt correctly', async () => {
    const templateData = "<%- await prompt('standardVariable01', 'Enter value:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData).toHaveProperty('standardVariable01')
    expect(result.sessionData).not.toHaveProperty("await_'standardVariable01'")
    expect(result.sessionTemplateData).toBe('<%- standardVariable01 %>')
    expect(result.sessionTemplateData).not.toContain('await_')
  })

  test('Should handle await promptKey correctly', async () => {
    const templateData = "<%- await promptKey('keyVariable01', 'Press a key:') %>"
    const userData = {}

    // Mock CommandBar.textPrompt
    global.CommandBar = {
      textPrompt: jest.fn().mockResolvedValue('Test Response'),
    }

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData).toHaveProperty('keyVariable01')
    expect(result.sessionData).not.toHaveProperty("await_'keyVariable01'")
    expect(result.sessionTemplateData).toBe('Test Response') // promptKey returns the text prompt result
    expect(result.sessionTemplateData).not.toContain('await_')
  })

  test('Should handle multiple awaited prompts in one template', async () => {
    const templateData = `
      Start Date: <%- await promptDate('startDate') %>
      End Date: <%- await promptDate('endDate') %>
      Duration: <%- await promptDateInterval('duration') %>
      Priority: <%- await prompt('priority', 'Enter priority:') %>
      Urgent: <%- await promptKey('urgent', 'Is it urgent?') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData).toHaveProperty('startDate')
    expect(result.sessionData).toHaveProperty('endDate')
    expect(result.sessionData).toHaveProperty('duration')
    expect(result.sessionData).toHaveProperty('priority')
    expect(result.sessionData).toHaveProperty('urgent')

    expect(result.sessionTemplateData).toContain('<%- startDate %>')
    expect(result.sessionTemplateData).toContain('<%- endDate %>')
    expect(result.sessionTemplateData).toContain('<%- duration %>')
    expect(result.sessionTemplateData).toContain('<%- priority %>')
    expect(result.sessionTemplateData).toContain('Test Response')

    expect(result.sessionTemplateData).not.toContain('await_')
    expect(result.sessionTemplateData).not.toContain("'startDate'")
    expect(result.sessionTemplateData).not.toContain("'endDate'")
    expect(result.sessionTemplateData).not.toContain("'duration'")
    expect(result.sessionTemplateData).not.toContain("'priority'")
    expect(result.sessionTemplateData).not.toContain("'urgent'")
  })
})
