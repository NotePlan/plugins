// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import PromptDateHandler from '../lib/support/modules/prompts/PromptDateHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

// Mock the @helpers/userInput module
// $FlowIgnore - jest mocking
jest.mock('@helpers/userInput', () => ({
  datePicker: jest.fn().mockImplementation((msg, config) => {
    // Accept any config, either object or string
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
    datePicker.mockClear()

    const templateData = "<%- promptDate('selectedDate', 'Select a date with, comma:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')

    // Verify the datePicker was called with the right message and empty config
    expect(datePicker).toHaveBeenCalledWith('{question:"Select a date with, comma:"}', {})
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
    expect(datePicker).toHaveBeenCalledWith('{question:"Select a date with \'quotes\':"}', {})
  })

  test('Should handle double quotes in parameters', async () => {
    // Using the mocked datePicker from @helpers/userInput
    datePicker.mockClear()

    const templateData = "<%- promptDate('selectedDate', 'Select a date with \"quotes\":') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')

    // Verify the datePicker was called with the right message
    expect(datePicker).toHaveBeenCalledWith('{question:"Select a date with "quotes":"}', {})
  })

  test('Should handle multiple promptDate calls', async () => {
    datePicker.mockClear()

    const templateData = `
      <%- promptDate('firstDate', 'Select first date:') %>
      <%- promptDate('secondDate', 'Select second date:') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.firstDate).toBe('2023-01-15')
    expect(result.sessionData.secondDate).toBe('2023-01-15')
    expect(datePicker).toHaveBeenCalledTimes(2)
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

  test('Should handle date formatting options', async () => {
    datePicker.mockClear()

    // Using JSON for options
    const templateData = "<%- promptDate('selectedDate', 'Select date:', '{\"format\": \"YYYY-MM-DD\"}') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.selectedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- selectedDate %>')
    expect(datePicker).toHaveBeenCalledWith('Select date:', { format: 'YYYY-MM-DD' })
  })

  test('Should handle complex date formatting options', async () => {
    datePicker.mockClear()

    // Test with more complex options
    const templateData = "<%- let formattedDate = promptDate('formattedDate', 'Select date:', 'FIXME: add promptDate options here') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.formattedDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- formattedDate %>')
    expect(datePicker).toHaveBeenCalledWith('{question:"Select date:"}', {})
    //FIXME: also add to the prompt dialog
  })

  test('Should handle variable names with question marks', async () => {
    datePicker.mockClear()

    const templateData = "<%- promptDate('dueDate?', 'Select due date:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // The question mark should be removed from the variable name
    expect(result.sessionData.dueDate).toBe('2023-01-15')
    expect(result.sessionTemplateData).toBe('<%- dueDate %>')
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
    datePicker.mockClear()

    // Make datePicker throw an error for this test
    datePicker.mockRejectedValueOnce(new Error('Test error'))

    const templateData = "<%- promptDate('errorDate', 'This will cause an error:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should handle the error gracefully
    expect(result.sessionData.errorDate).toBe('')
    expect(result.sessionTemplateData).toBe('<%- errorDate %>')
  })
})
