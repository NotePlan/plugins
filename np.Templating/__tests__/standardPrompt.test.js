// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import StandardPromptHandler from '../lib/support/modules/prompts/StandardPromptHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

describe('StandardPromptHandler', () => {
  beforeEach(() => {
    // Mock CommandBar methods with default responses
    global.CommandBar = {
      textPrompt: jest.fn().mockResolvedValue('Test Response'),
      showOptions: jest.fn().mockResolvedValue({ index: 0, value: 'Test Response' }),
    }
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })

  test('Should parse parameters correctly - basic usage', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:') %>"
    const params = StandardPromptHandler.parseParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')
    expect(params.options).toBe('')
  })

  test('Should parse parameters with default value', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:', 'default value') %>"
    const params = StandardPromptHandler.parseParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')
    expect(params.options).toBe('default value')
  })

  test('Should parse parameters with array options', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:', ['option1', 'option2', 'option3']) %>"
    const params = StandardPromptHandler.parseParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')

    // Verify options is an array with expected content
    expect(Array.isArray(params.options)).toBe(true)
    if (Array.isArray(params.options)) {
      expect(params.options.length).toBe(3)
      expect(params.options).toContain('option1')
      expect(params.options).toContain('option2')
      expect(params.options).toContain('option3')
    }
  })

  test('Should process standard prompt properly', async () => {
    const templateData = "<%- prompt('testVar', 'Enter test value:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.testVar).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- testVar %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter test value:', '')
  })

  test('Should process prompt with default value', async () => {
    const templateData = "<%- prompt('testVar', 'Enter test value:', 'default value') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.testVar).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- testVar %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter test value:', 'default value')
  })

  test('Should process prompt with array options', async () => {
    // Mock showOptions specifically for this test
    global.CommandBar.showOptions.mockClear()
    global.CommandBar.showOptions.mockResolvedValueOnce({
      index: 0,
      value: 'Test Response',
    })

    const templateData = "<%- prompt('testVar', 'Choose an option:', ['option1', 'option2', 'option3']) %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Verify the session data and template were updated
    expect(result.sessionTemplateData).toBe('<%- testVar %>')
    expect(result.sessionData.testVar).toBe('Test Response')

    // Check that showOptions was called
    expect(global.CommandBar.showOptions).toHaveBeenCalled()

    // Verify the arguments passed to showOptions (need to get first call's first argument)
    const optionsArg = global.CommandBar.showOptions.mock.calls[0][0]
    expect(Array.isArray(optionsArg)).toBe(true)
    if (Array.isArray(optionsArg)) {
      expect(optionsArg.length).toBe(3)
      expect(optionsArg).toContain('option1')
      expect(optionsArg).toContain('option2')
      expect(optionsArg).toContain('option3')
    }
  })

  test('Should handle quoted parameters properly', async () => {
    const templateData = "<%- prompt('greeting', 'Hello, world!', 'Default, with comma') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.greeting).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- greeting %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Hello, world!', 'Default, with comma')
  })

  test('Should handle single quotes in parameters', async () => {
    const templateData = "<%- prompt('greeting', \"Hello 'world'!\", \"Default 'value'\") %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.greeting).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- greeting %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', "Hello 'world'!", "Default 'value'")
  })

  test('Should handle double quotes in parameters', async () => {
    // Clear mock to ensure we get a fresh one
    global.CommandBar.textPrompt.mockClear()

    // Create a specific mock for just this test
    global.CommandBar.textPrompt.mockImplementation((title, message, defaultValue) => {
      expect(message).toBe('Hello "world"!')
      expect(defaultValue).toBe('Default "value"')
      return Promise.resolve('Test Response')
    })

    const templateData = '<%- prompt("greeting", "Hello \\"world\\"!", "Default \\"value\\"") %>'
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.greeting).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- greeting %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalled()
  })

  test('Should handle multiple prompt calls', async () => {
    // Set up different responses for each call
    global.CommandBar.textPrompt.mockClear()
    global.CommandBar.textPrompt.mockResolvedValueOnce('First Response').mockResolvedValueOnce('Second Response')

    const templateData = `
      <%- prompt('var1', 'Enter first value:') %>
      <%- prompt('var2', 'Enter second value:') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.var1).toBe('First Response')
    expect(result.sessionData.var2).toBe('Second Response')

    // Check that the template has been updated correctly
    expect(result.sessionTemplateData).toContain('<%- var1 %>')
    expect(result.sessionTemplateData).toContain('<%- var2 %>')
  })

  test('Should reuse existing values in session data without prompting again', async () => {
    global.CommandBar.textPrompt.mockClear()

    const templateData = '<%- existingVar %>'
    // Provide an existing value in the session data
    const userData = { existingVar: 'Already Exists' }

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should use the existing value without calling textPrompt
    expect(result.sessionData.existingVar).toBe('Already Exists')
    expect(result.sessionTemplateData).toBe('<%- existingVar %>')
    expect(global.CommandBar.textPrompt).not.toHaveBeenCalled()
  })

  test('Should handle variable names with question marks', async () => {
    const templateData = "<%- prompt('include_this?', 'Include this item?') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Question marks should be removed from variable names
    expect(result.sessionData.include_this).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- include_this %>')
  })

  test('Should handle variable names with spaces', async () => {
    const templateData = "<%- prompt('project name', 'Enter project name:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Spaces should be converted to underscores
    expect(result.sessionData.project_name).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- project_name %>')
  })

  test('Should handle empty parameter values', async () => {
    const templateData = "<%- prompt('emptyDefault', 'Enter value:', '') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.emptyDefault).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- emptyDefault %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter value:', '')
  })

  test('Should gracefully handle user cancelling the prompt', async () => {
    // When user cancels, CommandBar.textPrompt returns false
    global.CommandBar.textPrompt.mockClear()
    global.CommandBar.textPrompt.mockResolvedValueOnce(false)

    const templateData = "<%- prompt('cancelledVar', 'This will be cancelled:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should handle the cancellation gracefully
    expect(result.sessionData.cancelledVar).toBe('')
    expect(result.sessionTemplateData).toBe('<%- cancelledVar %>')
  })

  test('Should gracefully handle errors', async () => {
    // Make CommandBar.textPrompt throw an error
    global.CommandBar.textPrompt.mockClear()
    global.CommandBar.textPrompt.mockRejectedValueOnce(new Error('Mocked error'))

    const templateData = "<%- prompt('errorVar', 'This will error:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Should handle the error gracefully
    expect(result.sessionData.errorVar).toBe('')
    expect(result.sessionTemplateData).toBe('<%- errorVar %>')
  })

  test('Should handle complex prompts with special characters', async () => {
    const templateData = "<%- prompt('complex', 'Text with symbols: @#$%^&*_+{}[]|\\:;\"<>,.?/~`', 'Default with symbols: !@#$%^&*') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.complex).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- complex %>')
    // Fixed test to match the actual parsed parameters
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Text with symbols: @#$%^&*_+{}[]|\\:;"<>,.?/~`', 'Default with symbols: !@#$%^&*')
  })
})
