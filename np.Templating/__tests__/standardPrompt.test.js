// @flow
/**
 * @jest-environment jsdom
 */

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import StandardPromptHandler from '../lib/support/modules/prompts/StandardPromptHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

describe('StandardPromptHandler', () => {
  beforeEach(() => {
    // Mock CommandBar methods
    global.CommandBar = {
      textPrompt: jest.fn<any, any>().mockResolvedValue('Test Response'),
      showOptions: jest.fn<any, any>().mockResolvedValue({ index: 0 }),
    }
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })

  test('Should parse parameters correctly - basic usage', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:') %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')
    expect(params.options).toBe('')
  })

  test('Should parse parameters with default value', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:', 'default value') %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')
    expect(params.options).toBe('default value')
  })

  test('Should parse parameters with array options', () => {
    const tag = "<%- prompt('testVar', 'Enter test value:', ['option1', 'option2', 'option3']) %>"
    const params = BasePromptHandler.getPromptParameters(tag)

    expect(params.varName).toBe('testVar')
    expect(params.promptMessage).toBe('Enter test value:')
    expect(Array.isArray(params.options)).toBe(true)
    expect(params.options.length).toBe(3)
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
    const templateData = "<%- prompt('testVar', 'Choose an option:', ['option1', 'option2', 'option3']) %>"
    const userData = {}

    // For array options, showOptions is used instead of textPrompt
    // Mock the showOptions to return option2 directly
    global.CommandBar.showOptions.mockResolvedValueOnce({
      index: 1,
      value: 'Test Response', // Use the default test response
    })

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    // Just check that showOptions was called and the template was updated
    expect(result.sessionTemplateData).toBe('<%- testVar %>')
    expect(global.CommandBar.showOptions).toHaveBeenCalled()
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
    const templateData = '<%- prompt("greeting", "Hello "world"!", "Default "value"") %>'
    const userData = {}

    const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

    expect(result.sessionData.greeting).toBe('Test Response')
    expect(result.sessionTemplateData).toBe('<%- greeting %>')
    expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Hello "world"!', 'Default "value"')
  })

  test('Should handle multiple prompt calls', async () => {
    // Set up different responses for each call
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
