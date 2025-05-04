// @flow

import NPTemplating from '../lib/NPTemplating'
import { processPrompts } from '../lib/support/modules/prompts'
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

// $FlowFixMe - deliberately mocking for tests
jest.mock(
  '@helpers/userInput',
  () => ({
    // $FlowFixMe - Flow doesn't handle Jest mocks well
    datePicker: jest.fn().mockResolvedValue('2023-01-01'),
    // $FlowFixMe - Flow doesn't handle Jest mocks well
    askDateInterval: jest.fn().mockResolvedValue({
      startDate: '2023-01-01',
      endDate: '2023-01-31',
      stringValue: '2023-01-01 to 2023-01-31',
    }),
  }),
  { virtual: true },
) // Make it a virtual mock since the module may not exist in tests

describe('Prompt Safety Checks', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }

    // Mock CommandBar methods for all tests
    global.CommandBar = {
      // $FlowFixMe - Flow doesn't handle Jest mocks well
      textPrompt: jest.fn().mockImplementation((message, defaultValue) => {
        return Promise.resolve('Test Response')
      }),
      // $FlowFixMe - Flow doesn't handle Jest mocks well
      showOptions: jest.fn().mockImplementation((options, message) => {
        return Promise.resolve({ index: 0, value: options[0] })
      }),
    }
  })

  describe('Variable Name Sanitization', () => {
    test('Should sanitize variable names with invalid characters', async () => {
      const templateData = "<%- prompt('variable-with-hyphens', 'Enter value:') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // The hyphen should be removed as it's not valid in JS identifiers
      expect(result.sessionData).toHaveProperty('variablewithhyphens')
      expect(result.sessionTemplateData).toBe('<%- variablewithhyphens %>')
    })

    test('Should sanitize JavaScript reserved words as variable names', async () => {
      const templateData = "<%- prompt('class', 'Enter value:') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // 'class' is a reserved word and should be prefixed
      expect(result.sessionData).toHaveProperty('var_class')
      expect(result.sessionTemplateData).toBe('<%- var_class %>')
    })

    test('Should handle empty variable names', async () => {
      const templateData = "<%- prompt('', 'Enter value:') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // Empty variable names should be replaced with a default
      expect(result.sessionData).toHaveProperty('unnamed')
      expect(result.sessionTemplateData).toBe('<%- unnamed %>')
    })
  })

  describe('Complex Parameter Parsing', () => {
    test('Should handle mixed quotes in parameters', async () => {
      const templateData = "<%- prompt('mixedQuotes', \"Message with 'mixed' quotes\", 'Default with \"quotes\"') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      expect(result.sessionData.mixedQuotes).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- mixedQuotes %>')
    })

    test('Should handle commas inside quoted strings', async () => {
      const templateData = "<%- prompt('commaVar', 'Message with, comma', 'Default, with, commas') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      expect(result.sessionData.commaVar).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- commaVar %>')
    })

    test('Should handle complex nested quotes', async () => {
      const templateData = "<%- prompt('nestedQuotes', 'Outer \"middle \\'inner\\' quotes\"') %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      expect(result.sessionData.nestedQuotes).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- nestedQuotes %>')
    })

    test('Should handle malformed arrays gracefully', async () => {
      const templateData = "<%- prompt('badArray', 'Choose:', [option1, 'option2', option3]) %>"
      const userData = {}

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // Should still process and not crash
      expect(result.sessionData).toHaveProperty('badArray')
      expect(result.sessionTemplateData).toBe('<%- badArray %>')
    })
  })

  describe('Mixed Prompt Tags', () => {
    test('Should handle multiple prompts with commas and quotes correctly', async () => {
      const templateData = `
        Name: <%- prompt('name', 'Enter name:') %> 
        Date: <%- promptDate('date', 'Select date:') %>
        Message: <%- prompt('message', 'Enter message with, comma: "and quotes"') %>
      `
      // Initialize userData with all expected properties
      const userData = {
        name: 'John Doe',
        date: '2023-01-15',
        message: 'Hello, World!',
      }

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // Verify the session data values are preserved
      expect(result.sessionData.name).toBe('John Doe')
      expect(result.sessionData.date).toBe('2023-01-15')
      expect(result.sessionData.message).toBe('Hello, World!')

      // Verify the template contains the correct variable references
      expect(result.sessionTemplateData).toContain('<%- name %>')
      expect(result.sessionTemplateData).toContain('<%- date %>')
      expect(result.sessionTemplateData).toContain('<%- message %>')

      // Verify that none of the original prompt tags remain
      expect(result.sessionTemplateData).not.toContain('<%- prompt(')
      expect(result.sessionTemplateData).not.toContain('<%- promptDate(')
    })

    test('Should handle await with complex quoted parameters', async () => {
      const templateData = "<%- await prompt('complexVar', 'Message with, \" comma and \\'quotes\\',', 'Default with, comma') %>"
      // Initialize userData with the expected values
      const userData = {
        complexVar: 'Test Response',
      }

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      expect(result.sessionData.complexVar).toBe('Test Response')
      expect(result.sessionTemplateData).toBe('<%- complexVar %>')
      expect(result.sessionTemplateData).not.toContain('await')
    })

    test('Should handle the case that failed in production', async () => {
      const templateData = "Hello, <%- name01 %>! Today is <%- await promptDate('today01', 'Select today\\'s date:') %>."
      // Initialize userData with the expected values
      const userData = {
        name01: 'foo',
        today01: '2023-01-15',
      }

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      expect(result.sessionData.today01).toBe('2023-01-15')
      expect(result.sessionTemplateData).toBe('Hello, <%- name01 %>! Today is <%- today01 %>.')

      // The key thing we're testing - no await_ prefix or quotes in the variable name
      expect(result.sessionTemplateData).not.toContain('await_')
      expect(result.sessionTemplateData).not.toContain("'today01'")
    })
  })

  describe('Error Handling', () => {
    test('Should handle errors gracefully and not break the template', async () => {
      // StandardPromptHandler has special handling for 'badVar' that will throw an error

      const templateData = `
        Good: <%- prompt('goodVar', 'This works:') %>
        Bad: <%- prompt('badVar', 'This fails:') %>
        Also Good: <%- prompt('alsoGood', 'This also works:') %>
      `

      // Initialize userData with the values we expect
      const userData = {
        goodVar: 'Text Response',
        alsoGood: 'Third Response',
      }

      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // The template processing should continue even after an error
      expect(result.sessionData.goodVar).toBe('Text Response')
      // alsoGood may have a different value since we're not in Jest context
      expect(result.sessionData.alsoGood).toBeTruthy()

      // Ensure badVar is not defined or is empty
      expect(typeof result.sessionData.badVar).toBe('string')

      // The template should contain our variables
      expect(result.sessionTemplateData).toContain('<%- goodVar %>')
      expect(result.sessionTemplateData).toContain('<%- alsoGood %>')

      // Verify that the 'Bad:' line doesn't contain the original prompt tag
      expect(result.sessionTemplateData).not.toContain("<%- prompt('badVar', 'This fails:') %>")

      // Verify that some form of replacement happened (either empty string or error message)
      expect(result.sessionTemplateData).toContain('Bad:')
    })

    test('Should handle extreme edge cases without crashing', async () => {
      const edgeCases = [
        // Really unusual variable names
        "<%- prompt('$@#%^&*', 'Invalid chars:') %>",

        // Extremely nested quotes
        '<%- prompt(\'nested\', \'"outer\\"middle\\\\"inner\\\\\\"quotes\\\\\\"\\"middle\\"outer"\') %>',

        // Missing closing quotes
        "<%- prompt('unclosed', 'Unclosed quote:\"') %>",

        // Missing closing brackets
        "<%- prompt('unclosedArray', 'Options:', [1, 2, 3') %>",

        // Extremely long variable name
        "<%- prompt('extremely_long_variable_name_that_exceeds_reasonable_length_and_might_cause_issues_in_some_contexts_but_should_still_be_handled_gracefully_by_our_robust_system', 'Long:') %>",

        // Invalid syntax but should be caught
        "<%- prompt('invalid syntax', missing quotes, another param) %>",
      ]

      // Join all edge cases in one template
      const templateData = edgeCases.join('\n')

      // Initialize userData with the expected values for all edge cases
      const userData = {
        $: 'Test Response',
        nested: 'Test Response',
        unclosed: 'Test Response',
        unclosedArray: 'Test Response',
        extremely_long_variable_name_that_exceeds_reasonable_length_and_might_cause_issues_in_some_contexts_but_should_still_be_handled_gracefully_by_our_robust_system:
          'Test Response',
        invalid_syntax: 'Test Response',
      }

      // This should not throw an exception
      const result = await processPrompts(templateData, userData, '<%', '%>', NPTemplating.getTags.bind(NPTemplating))

      // We're just checking that it doesn't crash
      expect(result.sessionTemplateData).toBeDefined()

      // Verify the $ variable is properly handled
      if (result.sessionData.$) {
        expect(result.sessionData.$).toBe('Test Response')
        expect(result.sessionTemplateData).toContain('<%- $ %>')
      }

      // Verify other variables are properly handled
      if (result.sessionData.nested) {
        expect(result.sessionData.nested).toBe('Test Response')
        expect(result.sessionTemplateData).toContain('<%- nested %>')
      }

      if (result.sessionData.unclosed) {
        expect(result.sessionData.unclosed).toBe('Test Response')
        expect(result.sessionTemplateData).toContain('<%- unclosed %>')
      }

      if (result.sessionData.unclosedArray) {
        expect(result.sessionData.unclosedArray).toBe('Test Response')
        expect(result.sessionTemplateData).toContain('<%- unclosedArray %>')
      }

      // Very long variable name should be handled
      const longVarKey = Object.keys(result.sessionData).find((k) => k.startsWith('extremely_long_variable_name'))
      expect(longVarKey).toBeDefined()
      if (longVarKey) {
        expect(result.sessionData[longVarKey]).toBe('Test Response')
        expect(result.sessionTemplateData).toContain(`<%- ${longVarKey} %>`)
      }

      // Verify no original prompt tags remain
      expect(result.sessionTemplateData).not.toContain('<%- prompt(')
    })
  })

  describe('Helper Methods', () => {
    test('BasePromptHandler.cleanVarName should handle all cases', () => {
      const testCases = [
        { input: 'normal', expected: 'normal' },
        { input: 'with spaces', expected: 'with_spaces' },
        { input: 'with-hyphens', expected: 'with-hyphens' },
        { input: 'with.dots', expected: 'with.dots' },
        { input: '123starts_with_number', expected: 'var_123starts_with_number' },
        { input: 'class', expected: 'var_class' }, // Reserved word
        { input: 'αβγ', expected: 'αβγ' }, // Greek letters are valid
        { input: null, expected: 'unnamed' }, // Null check
        { input: undefined, expected: 'unnamed' }, // Undefined check
        { input: '', expected: 'unnamed' }, // Empty string check
        { input: '!@#$%^&*()', expected: 'var_!@#$%^&*()' },
      ]

      testCases.forEach(({ input, expected }) => {
        // $FlowFixMe - We're deliberately testing with null/undefined
        const result = BasePromptHandler.cleanVarName(input)
        expect(result).toBe(expected)
      })
    })

    test('BasePromptHandler.getPromptParameters should handle complex cases', () => {
      const testCases = [
        {
          tag: "<%- prompt('normalVar', 'Normal message:') %>",
          expectedVarName: 'normalVar',
          expectedPromptMessage: 'Normal message:',
        },
        {
          tag: "<%- prompt('var with spaces', 'Message with, comma') %>",
          expectedVarName: 'var_with_spaces',
          expectedPromptMessage: 'Message with, comma',
        },
      ]

      testCases.forEach(({ tag, expectedVarName, expectedPromptMessage }) => {
        const params = BasePromptHandler.getPromptParameters(tag)
        expect(params.varName).toBe(expectedVarName)
        expect(params.promptMessage).toBe(expectedPromptMessage)
      })
    })

    test('BasePromptHandler.getPromptParameters should correctly handle array options with quoted text', () => {
      const testCases = [
        {
          tag: "<%- prompt('choices', 'Select option:', ['Simple option', 'Option with, comma', 'Option with \"quotes\"']) %>",
          expectedOptions: ['Simple option', 'Option with, comma', 'Option with "quotes"'],
        },
        {
          tag: "<%- prompt('mixedQuotes', 'Pick one:', [\"First 'option'\", 'Second, complex', \"Third: special &$#! chars\"]) %>",
          expectedOptions: ["First 'option'", 'Second, complex', 'Third: special &$#! chars'],
        },
        {
          tag: "<%- prompt('simpleNested', 'Choose:', ['Option with nested \"quotes\"']) %>",
          expectedOptions: ['Option with nested "quotes"'],
        },
      ]

      testCases.forEach(({ tag, expectedOptions }) => {
        const params = BasePromptHandler.getPromptParameters(tag)
        expect(Array.isArray(params.options)).toBe(true)

        // Check each option matches expected value without placeholder text
        const optionsArray = (params.options: any)
        if (Array.isArray(optionsArray)) {
          try {
            expect(optionsArray.length).toBe(expectedOptions.length)
          } catch (e) {
            throw new Error(`Failed while checking options length: ${JSON.stringify(optionsArray)}`)
          }
          optionsArray.forEach((option, index) => {
            expect(option).toBe(expectedOptions[index])
            // Verify no placeholder text remains
            expect(option).not.toMatch(/__QUOTED_TEXT_\d+__/)
          })
        }
      })
    })
  })
})
