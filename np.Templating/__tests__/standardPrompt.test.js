// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import { getTags } from '../lib/core'
import StandardPromptHandler from '../lib/support/modules/prompts/StandardPromptHandler'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach */

// Mock CommandBar global
global.CommandBar = {
  prompt: jest.fn<[string, string], string | false>().mockImplementation((title, message) => {
    // console.log('CommandBar.prompt called with:', { title, message })
    if (message.includes('cancelled') || message.includes('This prompt will be cancelled') || message.includes('Enter a value:') || message.includes('Choose an option:')) {
      return false
    }
    return 'Test Response'
  }),
  textPrompt: jest.fn<[string, string, string], string | false>().mockImplementation((title, message, defaultValue) => {
    // console.log('CommandBar.textPrompt called with:', { title, message, defaultValue })
    if (message.includes('cancelled') || message.includes('This prompt will be cancelled') || message.includes('Enter a value:') || message.includes('Choose an option:')) {
      return false
    }
    return 'Test Response'
  }),
  chooseOption: jest.fn<[string, Array<any>], any | false>().mockImplementation((title, options) => {
    // console.log('CommandBar.chooseOption called with:', { title, options })
    if (title.includes('cancelled') || title.includes('This prompt will be cancelled') || title.includes('Enter a value:') || title.includes('Choose an option:')) {
      return false
    }
    return { index: 0, value: 'Test Response' }
  }),
  showOptions: jest.fn<[string, Array<any>], any | false>().mockImplementation((title, options) => {
    // console.log('CommandBar.showOptions called with:', { title, options })
    if (title.includes('cancelled') || title.includes('This prompt will be cancelled') || title.includes('Enter a value:') || title.includes('Choose an option:')) {
      return false
    }
    return { index: 0, value: 'Test Response' }
  }),
}

// Mock user input helpers
jest.mock('@helpers/userInput', () => ({
  chooseOption: jest.fn<[string, Array<any>], any | false>().mockImplementation((title, options) => {
    // console.log('userInput.chooseOption called with:', { title, options })
    if (title.includes('cancelled') || title.includes('This prompt will be cancelled') || title.includes('Enter a value:') || title.includes('Choose an option:')) {
      return false
    }
    return { index: 0, value: 'Test Response' }
  }),
  textPrompt: jest.fn<[string, string], string | false>().mockImplementation((title, message) => {
    // console.log('userInput.textPrompt called with:', { title, message })
    if (message.includes('cancelled') || message.includes('This prompt will be cancelled') || message.includes('Enter a value:') || message.includes('Choose an option:')) {
      return false
    }
    return 'Test Response'
  }),
  showOptions: jest.fn<[string, Array<any>], any | false>().mockImplementation((title, options) => {
    // console.log('userInput.showOptions called with:', { title, options })
    if (title.includes('cancelled') || title.includes('This prompt will be cancelled') || title.includes('Enter a value:') || title.includes('Choose an option:')) {
      return false
    }
    return { index: 0, value: 'Test Response' }
  }),
}))

describe('StandardPromptHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })

  describe('Successful prompts', () => {
    test('Should process standard prompt properly', async () => {
      const templateData = "<%- prompt('testVar', 'Enter test value:') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData)

      expect(result).not.toBe(false)
      if (result !== false) {
        expect(result.sessionData.testVar).toBe('Test Response')
        expect(result.sessionTemplateData).toBe('<%- testVar %>')
        expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter test value:', '')
      }
    })

    test('Should process prompt with default value', async () => {
      const templateData = "<%- prompt('testVar', 'Enter test value:', 'default value') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData)

      expect(result).not.toBe(false)
      if (result !== false) {
        expect(result.sessionData.testVar).toBe('Test Response')
        expect(result.sessionTemplateData).toBe('<%- testVar %>')
        expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter test value:', 'default value')
      }
    })

    test('Should process prompt with array options', async () => {
      const templateData = "<%- prompt('testVar', 'Choose an option:', ['option1', 'option2', 'option3']) %>"
      const userData = {}

      const result = await processPrompts(templateData, userData)

      expect(result).not.toBe(false)
      if (result !== false) {
        expect(result.sessionTemplateData).toBe('<%- testVar %>')
        expect(result.sessionData.testVar).toBe('Test Response')
        expect(global.CommandBar.showOptions).toHaveBeenCalled()
      }
    })
  })

  describe('Cancelled prompts', () => {
    test('Should handle basic text prompt cancellation', async () => {
      const template = '<%- prompt("testVar", "This prompt will be cancelled") %>'
      const result = await processPrompts(template, {}, '<%', '%>', getTags)
      expect(result).toBe(false)
    })

    test('Should handle prompt with default value cancellation', async () => {
      const template = '<%- prompt("testVar", "This prompt will be cancelled", "default") %>'
      const result = await processPrompts(template, {}, '<%', '%>', getTags)
      expect(result).toBe(false)
    })

    // skipping this test because in practice, hittins escape stops the plugin in NP so it will never return
    test.skip('Should handle prompt with options cancellation', async () => {
      const template = '<%- prompt("testVar", "This prompt will be cancelled", ["option1", "option2"]) %>'
      const result = await processPrompts(template, {}, '<%', '%>', getTags)
      expect(result).toBe(false)
    })
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

  test('Should handle quoted parameters properly', async () => {
    const templateData = "<%- prompt('greeting', 'Hello, world!', 'Default, with comma') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.greeting).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- greeting %>')
      expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Hello, world!', 'Default, with comma')
    }
  })

  test('Should handle single quotes in parameters', async () => {
    const templateData = "<%- prompt('greeting', \"Hello 'world'!\", \"Default 'value'\") %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.greeting).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- greeting %>')
      expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', "Hello 'world'!", "Default 'value'")
    }
  })

  test('Should handle double quotes in parameters', async () => {
    const templateData = '<%- prompt("greeting", "Hello \\"world\\"!", "Default \\"value\\"") %>'
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.greeting).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- greeting %>')
      expect(global.CommandBar.textPrompt).toHaveBeenCalled()
    }
  })

  test('Should handle multiple prompt calls', async () => {
    const templateData = `
      <%- prompt('var1', 'Enter first value:') %>
      <%- prompt('var2', 'Enter second value:') %>
    `
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.var1).toBe('Test Response')
      expect(result.sessionData.var2).toBe('Test Response')
      expect(result.sessionTemplateData).toContain('<%- var1 %>')
      expect(result.sessionTemplateData).toContain('<%- var2 %>')
    }
  })

  test('Should reuse existing values in session data without prompting again', async () => {
    const templateData = '<%- existingVar %>'
    const userData = { existingVar: 'Already Exists' }

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.existingVar).toBe('Already Exists')
      expect(result.sessionTemplateData).toBe('<%- existingVar %>')
      expect(global.CommandBar.textPrompt).not.toHaveBeenCalled()
    }
  })

  test('Should handle variable names with question marks', async () => {
    const templateData = "<%- prompt('include_this?', 'Include this item?') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.include_this).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- include_this %>')
    }
  })

  test('Should handle variable names with spaces', async () => {
    const templateData = "<%- prompt('project name', 'Enter project name:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.project_name).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- project_name %>')
    }
  })

  test('Should handle empty parameter values', async () => {
    const templateData = "<%- prompt('emptyDefault', 'Enter value:', '') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.emptyDefault).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- emptyDefault %>')
      expect(global.CommandBar.textPrompt).toHaveBeenCalledWith('', 'Enter value:', '')
    }
  })

  test('Should handle basic text prompt', async () => {
    const template = '<%- prompt("testVar", "Enter a value:") %>'
    const result = await processPrompts(template, {}, '<%', '%>', getTags)
    expect(result).toBe(false)
  })

  test('Should handle prompt with default value', async () => {
    const template = '<%- prompt("testVar", "Enter a value:", "default") %>'
    const result = await processPrompts(template, {}, '<%', '%>', getTags)
    expect(result).toBe(false)
  })

  test('Should handle prompt with options', async () => {
    const template = '<%- prompt("testVar", "Choose an option:", ["option1", "option2"]) %>'
    const result = await processPrompts(template, {}, '<%', '%>', getTags)
    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.testVar).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- testVar %>')
      expect(global.CommandBar.showOptions).toHaveBeenCalled()
    }
  })

  test('Should gracefully handle user cancelling the prompt', async () => {
    const template = '<%- prompt("cancelledVar", "This prompt will be cancelled") %>'
    const result = await processPrompts(template, {}, '<%', '%>', getTags)
    expect(result).toBe(false)
  })

  test('Should gracefully handle errors', async () => {
    // Make CommandBar.textPrompt throw an error
    global.CommandBar.textPrompt.mockClear()
    global.CommandBar.textPrompt.mockRejectedValueOnce(new Error('Mocked error'))

    const templateData = "<%- prompt('errorVar', 'This will error:') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    // Should handle the error gracefully
    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.errorVar).toBe('')
      expect(result.sessionTemplateData).toBe('<%- errorVar %>')
    }
  })

  test('Should handle complex prompts with special characters', async () => {
    const templateData = "<%- prompt('complex', 'Text with symbols: @#$%^&*_+{}[]|\\:;\"<>,.?/~`', 'Default with symbols: !@#$%^&*') %>"
    const userData = {}

    const result = await processPrompts(templateData, userData)

    expect(result).not.toBe(false)
    if (result !== false) {
      expect(result.sessionData.complex).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- complex %>')
    }
  })
})
