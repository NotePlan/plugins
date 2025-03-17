// @flow
/**
 * @jest-environment jsdom
 */

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import PromptDateHandler from '../lib/support/modules/prompts/PromptDateHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

// Mock the @helpers/userInput module
// $FlowIgnore - jest mocking
jest.mock('@helpers/userInput', () => ({
  datePicker: jest.fn().mockImplementation((msg) => {
    return Promise.resolve('2023-01-15')
  }),
}))

// Get the mocked function
// $FlowIgnore - jest mocked module
const { datePicker } = require('@helpers/userInput')

describe('PromptDateHandler', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })
  test('Should parse parameters correctly - basic usage', () => {
    const tag = "<%- promptDate('testDate', 'Select a date:') %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testDate')
    expect(params.promptMessage).toBe('Select a date:')
    expect(params.options).toBe('')
  })

  test('Should parse parameters with formatting options', () => {
    const tag = "<%- promptDate('testDate', 'Select a date:', '{dateStyle: \"full\"}') %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testDate')
    expect(params.promptMessage).toBe('Select a date:')
    expect(params.options).toBe('{dateStyle: "full"}')
  })

  test('Should process promptDate properly - basic usage', async () => {
    // Using the mocked datePicker from @helpers/userInput
    const templateData = "<%- promptDate('selectedDate', 'Select a date:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')
  })

  test('Should handle quoted parameters properly', async () => {
    // Using the mocked datePicker from @helpers/userInput
    const templateData = "<%- promptDate('selectedDate', 'Select a date with, comma:', '{dateStyle: \"full\", locale: \"en-US\"}') %>"
    datePicker.mockClear()
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')

    // Verify the datePicker was called with the right message
    expect(datePicker).toHaveBeenCalledWith('Select a date with, comma:', '{dateStyle: "full", locale: "en-US"}')
  })

  test('Should handle single quotes in parameters', async () => {
    // Using the mocked datePicker from @helpers/userInput
    datePicker.mockClear()

    const templateData = "<%- promptDate('selectedDate', \"Select a date with 'quotes':\") %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')

    // Verify the datePicker was called with the right message
    expect(datePicker).toHaveBeenCalledWith("Select a date with 'quotes':", '')
  })

  test('Should handle multiple promptDate calls', async () => {
    // Reset the mock and set up multiple responses
    datePicker.mockClear()
    // $FlowIgnore - jest mocked function
    datePicker.mockResolvedValueOnce('2023-01-15').mockResolvedValueOnce('2023-02-28')

    const templateData = `
      <%- promptDate('startDate', 'Select start date:') %>
      <%- promptDate('endDate', 'Select end date:') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.startDate).toBe('2023-01-15')
    expect(result.sessionData.endDate).toBe('2023-02-28')

    // Check that the template has been updated correctly
    expect(result.sessionTemplateData).toContain('<%- startDate %>')
    expect(result.sessionTemplateData).toContain('<%- endDate %>')
  })

  test('Should reuse existing values in session data without prompting again', async () => {
    datePicker.mockClear()

    const templateData = "<%- promptDate('existingDate', 'Select a date:') %>"
    // Provide an existing value in the session data
    const userData = { existingDate: '2022-12-25' }

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should use the existing value without calling datePicker
    expect(result.sessionData.existingDate).toBe('2022-12-25')
    expect(result.sessionTemplateData).toBe('<%- existingDate %>')
    expect(datePicker).not.toHaveBeenCalled()
  })

  test('Should handle complex date formatting options', async () => {
    datePicker.mockClear()

    const templateData = '<%- promptDate(\'formattedDate\', \'Select date:\', \'{dateStyle: "full", timeStyle: "medium", locale: "en-US"}\') %>'
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.formattedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- formattedDate %>')
    expect(datePicker).toHaveBeenCalledWith('Select date:', '{dateStyle: "full", timeStyle: "medium", locale: "en-US"}')
  })

  test('Should handle variable names with question marks', async () => {
    const templateData = "<%- promptDate('due_date?', 'When is this due?') %>"
    const userData = {}
    datePicker.mockClear()

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Question marks should be removed from variable names
    expect(result.sessionData.due_date).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- due_date %>')
  })

  test('Should handle variable names with spaces', async () => {
    const templateData = "<%- promptDate('due date', 'When is this due?') %>"
    const userData = {}
    datePicker.mockClear()
    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Spaces should be converted to underscores
    expect(result.sessionData.due_date).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- due_date %>')
  })

  test('Should gracefully handle errors', async () => {
    // Make datePicker throw an error
    datePicker.mockRejectedValueOnce(new Error('Mocked error'))

    const templateData = "<%- promptDate('errorDate', 'This will error:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should handle the error gracefully
    expect(result.sessionData.errorDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- errorDate %>')
  })
})
