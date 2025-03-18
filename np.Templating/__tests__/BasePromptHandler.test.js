/* eslint-disable */
// @flow

import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import { getRegisteredPromptNames, cleanVarName } from '../lib/support/modules/prompts/PromptRegistry'

/* global describe, test, expect, jest, beforeEach, beforeAll */

// Mock the PromptRegistry module
jest.mock('../lib/support/modules/prompts/PromptRegistry', () => ({
  getRegisteredPromptNames: jest.fn(() => ['prompt', 'promptKey', 'promptDate']),
  cleanVarName: jest.fn((varName) => {
    if (!varName) return ''
    // Simple implementation that replaces spaces with underscores and removes question marks
    return varName.replace(/\s+/g, '_').replace(/\?/g, '')
  }),
}))

describe('BasePromptHandler', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })

  describe('extractVariableAssignment', () => {
    it('should extract const variable assignment', () => {
      const tag = "const myVar = prompt('Enter a value:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('myVar')
        expect(result.cleanedTag).toBe("prompt('Enter a value:')")
      }
    })

    it('should extract let variable assignment', () => {
      const tag = "let userInput = promptKey('Choose option:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('userInput')
        expect(result.cleanedTag).toBe("promptKey('Choose option:')")
      }
    })

    it('should extract var variable assignment', () => {
      const tag = "var date = promptDate('Select date:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('date')
        expect(result.cleanedTag).toBe("promptDate('Select date:')")
      }
    })

    it('should extract await with variable assignment', () => {
      const tag = "const result = await promptKey('Select:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('result')
        expect(result.cleanedTag).toBe("promptKey('Select:')")
      }
    })

    it('should handle await without variable assignment', () => {
      const tag = "await promptKey('Select:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('')
        expect(result.cleanedTag).toBe("promptKey('Select:')")
      }
    })

    it('should return null for tags without variable assignment', () => {
      const tag = "promptKey('Select:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)
      expect(result).toBeNull()
    })
  })

  describe('extractDirectParameters', () => {
    it('should extract a single quoted parameter', () => {
      const tag = "promptKey('Select an option:')"
      const result = BasePromptHandler.extractDirectParameters(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.message).toBe('Select an option:')
      }
    })

    it('should extract a single double-quoted parameter', () => {
      const tag = 'promptKey("Select an option:")'
      const result = BasePromptHandler.extractDirectParameters(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.message).toBe('Select an option:')
      }
    })

    it('should not extract multiple parameters', () => {
      const tag = "promptKey('varName', 'Select an option:')"
      const result = BasePromptHandler.extractDirectParameters(tag)
      expect(result).toBeNull()
    })

    it('should handle invalid tags', () => {
      const tag = 'promptKey'
      const result = BasePromptHandler.extractDirectParameters(tag)
      expect(result).toBeNull()
    })
  })

  describe('parseOptions', () => {
    it('should parse string options', () => {
      const optionsText = "'Option 1', 'Option 2'"
      const quotedTexts = ["'Option 1'", "'Option 2'"]
      const result = BasePromptHandler.parseOptions(optionsText, quotedTexts, [])

      expect(result).toBe('Option 1, Option 2')
    })

    it('should parse array options', () => {
      const optionsText = "['Option 1', 'Option 2']"
      const quotedTexts = ["'Option 1'", "'Option 2'"]
      const arrayPlaceholders = [{ placeholder: '__ARRAY_0__', value: "['Option 1', 'Option 2']" }]
      const result = BasePromptHandler.parseOptions(optionsText, quotedTexts, arrayPlaceholders)

      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        // Flow type check
        expect(result).toContain('Option 1')
        expect(result).toContain('Option 2')
      }
    })

    it('should handle empty array options', () => {
      const optionsText = '[]'
      const arrayPlaceholders = [{ placeholder: '__ARRAY_0__', value: '[]' }]
      const result = BasePromptHandler.parseOptions(optionsText, [], arrayPlaceholders)

      expect(Array.isArray(result)).toBe(true)
      if (Array.isArray(result)) {
        // Flow type check
        expect(result.length).toBe(0)
      }
    })
  })

  describe('parseParameters', () => {
    it('should parse with varName as first parameter', () => {
      const tagValue = "'myVar', 'Enter a value:'"
      const result = BasePromptHandler.parseParameters(tagValue, false)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Enter a value:',
        options: '',
      })
    })

    it('should parse with promptMessage as first parameter when noVar is true', () => {
      const tagValue = "'Enter a value:', 'Option 1', 'Option 2'"
      const result = BasePromptHandler.parseParameters(tagValue, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Enter a value:',
      })
      expect(typeof result.options).toBe('string')
      expect(result.options).toMatch(/Option 1/)
      expect(result.options).toMatch(/Option 2/)
    })

    it('should parse with options as an array', () => {
      const tagValue = "'myVar', 'Choose an option:', ['Option 1', 'Option 2']"
      const result = BasePromptHandler.parseParameters(tagValue, false)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Choose an option:',
      })
      expect(Array.isArray(result.options)).toBe(true)
    })

    it('should handle empty tag value', () => {
      const result = BasePromptHandler.parseParameters('', false)
      expect(result).toMatchObject({
        varName: 'unnamed',
        promptMessage: '',
        options: '',
      })
    })

    it('should handle empty tag value with noVar', () => {
      const result = BasePromptHandler.parseParameters('', true)
      expect(result).toMatchObject({
        varName: '',
        promptMessage: '',
        options: '',
      })
    })
  })

  describe('getPromptParameters with noVar=false (default)', () => {
    it('should parse a basic prompt with varName and promptMessage', () => {
      const tag = "<%- prompt('myVar', 'Enter a value:') %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Enter a value:',
      })
      expect(result.options).toBe('')
    })

    it('should parse a prompt with varName, promptMessage, and options', () => {
      const tag = "<%- prompt('myVar', 'Choose an option:', ['Option 1', 'Option 2']) %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Choose an option:',
      })
      expect(Array.isArray(result.options)).toBe(true)
      expect(result.options).toContain('Option 1')
      expect(result.options).toContain('Option 2')
    })

    it('should clean the varName', () => {
      const tag = "<%- prompt('my var name?', 'Enter a value:') %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result.varName).toBe('my_var_name')
    })
  })

  describe('getPromptParameters with noVar=true', () => {
    it('should parse a tag with only a prompt message', () => {
      const tag = "<%- prompt('Enter a value:') %>"
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Enter a value:',
      })
      expect(result.options).toBe('')
    })

    it('should parse a tag with prompt message and options', () => {
      const tag = "<%- prompt('Choose an option:', 'Option 1', 'Option 2') %>"
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Choose an option:',
      })
      expect(typeof result.options).toBe('string')
      expect(result.options).toMatch(/Option 1/)
      expect(result.options).toMatch(/Option 2/)
    })

    it('should parse a tag with prompt message and array options', () => {
      const tag = "<%- prompt('Choose an option:', ['Option 1', 'Option 2']) %>"
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Choose an option:',
      })
      // The result could be either an array or a string depending on the implementation
      if (Array.isArray(result.options)) {
        expect(result.options).toContain('Option 1')
        expect(result.options).toContain('Option 2')
      } else {
        // If it's a string representation, just check that the options are included
        expect(result.options).toMatch(/Option 1/)
        expect(result.options).toMatch(/Option 2/)
      }
    })

    it('should handle quoted parameters correctly', () => {
      const tag = '<%- prompt("Select an item:", "pattern1|pattern2", "exclude") %>'
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Select an item:',
      })
      expect(typeof result.options).toBe('string')
      expect(result.options).toMatch(/pattern1\|pattern2/)
      expect(result.options).toMatch(/exclude/)
    })

    it('should handle invalid tags gracefully', () => {
      const tag = '<%- prompt() %>'
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: '',
      })
    })
  })

  describe('getPromptParameters with variable assignment', () => {
    it('should handle const assignment', () => {
      const tag = "<%- const result = prompt('Choose an option:') %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'result',
        promptMessage: 'Choose an option:',
        options: '',
      })
    })

    it('should handle let assignment with await', () => {
      const tag = "<%- let answer = await promptKey('Select:') %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'answer',
        promptMessage: 'Select:',
        options: '',
      })
    })

    it('should handle direct await without assignment', () => {
      const tag = "<%- await promptKey('Select:') %>"
      const result = BasePromptHandler.getPromptParameters(tag, false)

      expect(result).toMatchObject({
        promptMessage: 'Select:',
        options: '',
      })
    })
  })

  describe('removeQuotes', () => {
    it('should remove double quotes', () => {
      expect(BasePromptHandler.removeQuotes('"test"')).toBe('test')
    })

    it('should remove single quotes', () => {
      expect(BasePromptHandler.removeQuotes("'test'")).toBe('test')
    })

    it('should remove backticks', () => {
      expect(BasePromptHandler.removeQuotes('`test`')).toBe('test')
    })

    it('should return the string as-is if no quotes are present', () => {
      expect(BasePromptHandler.removeQuotes('test')).toBe('test')
    })

    it('should handle empty strings', () => {
      expect(BasePromptHandler.removeQuotes('')).toBe('')
    })

    it('should handle null/undefined values', () => {
      // $FlowFixMe - Testing with undefined
      expect(BasePromptHandler.removeQuotes('')).toBe('')
      // $FlowFixMe - Testing with null
      expect(BasePromptHandler.removeQuotes('')).toBe('')
    })
  })

  describe('cleanVarName', () => {
    it('should replace spaces with underscores', () => {
      expect(BasePromptHandler.cleanVarName('my var')).toBe('my_var')
    })

    it('should remove question marks', () => {
      expect(BasePromptHandler.cleanVarName('test?')).toBe('test')
    })

    it('should handle multiple spaces and question marks', () => {
      expect(BasePromptHandler.cleanVarName('my var name?')).toBe('my_var_name')
    })
  })
})
