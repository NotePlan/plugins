// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import { getTags } from '../lib/core'
import PromptDateIntervalHandler from '../lib/support/modules/prompts/PromptDateIntervalHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

// Mock the @helpers/userInput module
// $FlowIgnore - jest mocking
jest.mock('@helpers/userInput', () => ({
  askDateInterval: jest.fn().mockImplementation((msg) => {
    return Promise.resolve('2023-01-01 to 2023-01-31')
  }),
}))

// Get the mocked function
// $FlowIgnore - jest mocked module
const { askDateInterval } = require('@helpers/userInput')

describe('PromptDateIntervalHandler', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })
  test('Should parse parameters correctly', () => {
    const tag = "<%- promptDateInterval('testInterval', 'Select date range:') %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testInterval')
    expect(params.promptMessage).toBe('Select date range:')
  })

  test('Should process promptDateInterval properly', async () => {
    // Using the mocked askDateInterval from @helpers/userInput
    const templateData = "<%- promptDateInterval('dateRange', 'Select date range:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result.sessionData.dateRange).toBe('2023-01-01 to 2023-01-31')
    expect(result.sessionTemplateData).toBe('<%- dateRange %>')
  })

  test('Should handle quoted parameters properly', async () => {
    // Using the mocked askDateInterval from @helpers/userInput
    const templateData = "<%- promptDateInterval('dateRange', 'Select date range with, comma:', '{format: \"YYYY-MM-DD\"}') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result.sessionData.dateRange).toBe('2023-01-01 to 2023-01-31')
    expect(result.sessionTemplateData).toBe('<%- dateRange %>')

    // Verify the askDateInterval was called with the right message
    expect(askDateInterval).toHaveBeenCalledWith('Select date range with, comma:')
  })

  test('Should handle multiple promptDateInterval calls', async () => {
    // Reset the mock and set up multiple responses
    // $FlowIgnore - jest mocked function
    askDateInterval.mockClear()
    // $FlowIgnore - jest mocked function
    askDateInterval.mockResolvedValueOnce('2023-01-01 to 2023-01-31').mockResolvedValueOnce('2023-02-01 to 2023-02-28')

    const templateData = `
      <%- promptDateInterval('range1', 'Select first range:') %>
      <%- promptDateInterval('range2', 'Select second range:') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result.sessionData.range1).toBe('2023-01-01 to 2023-01-31')
    expect(result.sessionData.range2).toBe('2023-02-01 to 2023-02-28')

    // Check that the template has been updated correctly
    expect(result.sessionTemplateData).toContain('<%- range1 %>')
    expect(result.sessionTemplateData).toContain('<%- range2 %>')

    // Ensure there are no instances of await_'variableName'
    expect(result.sessionTemplateData).not.toContain('await_')
  })
})
