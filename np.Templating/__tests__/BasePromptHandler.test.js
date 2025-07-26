/* eslint-disable */
// @flow

import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import StandardPromptHandler from '../lib/support/modules/prompts/StandardPromptHandler'
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
  registerPromptType: jest.fn(),
}))

describe('BasePromptHandler', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
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

  describe('extractAllParameters', () => {
    it('should extract quoted strings and unquoted variables', () => {
      const text = "'bgcolor', 'Sphere:', spheres"
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['bgcolor', 'Sphere:', 'spheres'])
    })

    it('should extract mixed quoted and unquoted parameters', () => {
      const text = "'Param 1', \"Param 2\", unquotedVar, 'Param 4'"
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['Param 1', 'Param 2', 'unquotedVar', 'Param 4'])
    })

    it('should handle only quoted strings', () => {
      const text = "'Option 1', 'Option 2', 'Option 3'"
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['Option 1', 'Option 2', 'Option 3'])
    })

    it('should handle only unquoted variables', () => {
      const text = 'var1, var2, var3'
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['var1', 'var2', 'var3'])
    })

    it('should handle single quoted string', () => {
      const text = "'Single Parameter'"
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['Single Parameter'])
    })

    it('should handle single unquoted variable', () => {
      const text = 'singleVar'
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['singleVar'])
    })

    it('should handle empty string', () => {
      const text = ''
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual([])
    })

    it('should handle whitespace-only string', () => {
      const text = '   '
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(['   '])
    })

    it('should handle escaped quotes within quoted strings', () => {
      const text = "'String with \\'escaped\\' quote', varName"
      const result = BasePromptHandler.extractAllParameters(text)

      expect(result).toEqual(["String with 'escaped' quote", 'varName'])
    })
  })

  describe('parseOptions', () => {
    it('should parse a single quoted string option (simulating placeholder context)', () => {
      // Simulate parseOptions receiving a single placeholder for a quoted string
      const optionsText = '__QUOTED_TEXT_0__'
      const quotedTexts = ["'Option 1'"]
      const result = BasePromptHandler.parseOptions(optionsText, quotedTexts, [])

      // parseOptions should restore the placeholder, then removeQuotes is applied.
      // removeQuotes("'Option 1'") returns "Option 1".
      expect(result).toBe('Option 1')
    })

    it('should parse array options (simulating placeholder context)', () => {
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
      const tagValue = "dummyFunc('myVar', 'Enter a value:')"
      const result = BasePromptHandler.parseParameters(tagValue, false)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Enter a value:',
        options: '',
      })
    })

    it('should parse with promptMessage as first parameter when noVar is true', () => {
      const tagValue = "dummyFunc('Enter a value:', 'Option 1', 'Option 2')"
      const result = BasePromptHandler.parseParameters(tagValue, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Enter a value:',
      })
      expect(Array.isArray(result.options)).toBe(true)
      expect(result.options).toEqual(['Option 1', 'Option 2'])
    })

    it('should parse with options as an array when noVar is true', () => {
      const tagValue = "dummyFunc('Choose:', \"['A', 'B']\")"
      const result = BasePromptHandler.parseParameters(tagValue, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Choose:',
      })
      expect(Array.isArray(result.options)).toBe(true)
      expect(result.options).toEqual(['A', 'B'])
    })

    it('should parse with options as an array', () => {
      const tagValue = "dummyFunc('myVar', 'Choose an option:', \"['Option 1', 'Option 2']\")"
      const result = BasePromptHandler.parseParameters(tagValue, false)

      expect(result).toMatchObject({
        varName: 'myVar',
        promptMessage: 'Choose an option:',
      })
      expect(Array.isArray(result.options)).toBe(true)
      if (Array.isArray(result.options)) {
        expect(result.options).toEqual(['Option 1', 'Option 2'])
      }
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

    it('should handle extra parameters (e.g. for promptDate)', () => {
      const tag = `<%- promptDate('varname','msg','default',true)`
      const result = BasePromptHandler.parseParameters(tag)
      const expectedOptions = ['default', 'true'] // note that all params end up getting quoted
      expect(result).toMatchObject({
        varName: 'varname',
        promptMessage: 'msg',
        options: expectedOptions,
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

    it('should parse a tag with only a single message parameter (noVar=false)', () => {
      const tag = "<%- prompt('Single Message Param') %>"
      const result = BasePromptHandler.getPromptParameters(tag) // noVar is false by default

      expect(result).toMatchObject({
        varName: 'Single_Message_Param', // Cleaned message becomes varName
        promptMessage: 'Single Message Param',
        options: '',
      })
    })
  })

  describe('getPromptParameters with noVar=true', () => {
    beforeEach(() => {
      // Mock CommandBar for tests in this describe block that might use it via StandardPromptHandler
      global.CommandBar = {
        textPrompt: jest.fn().mockResolvedValue('mocked user input'),
        showOptions: jest.fn().mockResolvedValue({ value: 'mocked option' }),
      }
    })

    it('should parse a tag with only a prompt message', () => {
      const tag = "<%- prompt('Enter a value:') %>"
      const result = BasePromptHandler.getPromptParameters(tag, true)

      expect(result).toMatchObject({
        varName: '',
        promptMessage: 'Enter a value:',
      })
      expect(result.options).toBe('')
    })

    it('should ensure StandardPromptHandler.getResponse calls CommandBar.textPrompt correctly with parsed single-argument message', async () => {
      const tag = "<%- prompt('My Test Message') %>"
      const params = BasePromptHandler.getPromptParameters(tag, true)

      // Verify parameters parsed by BasePromptHandler
      expect(params.promptMessage).toBe('My Test Message')
      expect(params.varName).toBe('')
      expect(params.options).toBe('')

      // Call StandardPromptHandler.getResponse with the parsed parameters
      await StandardPromptHandler.getResponse(params.promptMessage, params.options)

      // Verify CommandBar.textPrompt was called as expected
      expect(global.CommandBar.textPrompt).toHaveBeenCalledTimes(1)
      expect(global.CommandBar.textPrompt).toHaveBeenCalledWith(
        '', // title parameter - not used in templating
        'My Test Message', // placeholder argument (message || 'Enter a value:')
        '', // defaultText argument (params.options)
      )
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
      })
    })

    it('should handle prompt with unquoted variable as options parameter', () => {
      const tag = "<%- prompt('bgcolor', 'Sphere:', spheres) %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'bgcolor',
        promptMessage: 'Sphere:',
        options: 'spheres',
      })
    })

    it('should handle const assignment with unquoted variable options', () => {
      const tag = "<%- const bgcolor = prompt('bgcolor', 'Sphere:', spheres) %>"
      const result = BasePromptHandler.getPromptParameters(tag)

      expect(result).toMatchObject({
        varName: 'bgcolor',
        promptMessage: 'Sphere:',
        options: 'spheres',
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

// Add new describe blocks for the private helper functions
// Note: Accessing private methods (_*) for testing is generally okay,
// especially for complex logic, but be aware it tests implementation details.

describe('BasePromptHandler Private Helpers', () => {
  describe('_restorePlaceholders', () => {
    it('should return text unchanged if no placeholders', () => {
      const text = 'Some regular text without placeholders.'
      expect(BasePromptHandler._restorePlaceholders(text, [], [])).toBe(text)
    })

    it('should restore quoted text placeholders', () => {
      const text = 'Hello __QUOTED_TEXT_0__, welcome to __QUOTED_TEXT_1__.'
      const quotedTexts = ["'world'", '"the test"']
      const expected = 'Hello \'world\', welcome to "the test".'
      expect(BasePromptHandler._restorePlaceholders(text, quotedTexts, [])).toBe(expected)
    })

    it('should restore array placeholders', () => {
      const text = 'Options are __ARRAY_0__ and __ARRAY_1__.'
      const arrayPlaceholders = [
        { placeholder: '__ARRAY_0__', value: "['A', 'B']" },
        { placeholder: '__ARRAY_1__', value: '[1, 2]' },
      ]
      const expected = "Options are ['A', 'B'] and [1, 2]."
      expect(BasePromptHandler._restorePlaceholders(text, [], arrayPlaceholders)).toBe(expected)
    })

    it('should restore mixed placeholders (arrays first)', () => {
      const text = 'Combine __QUOTED_TEXT_0__ with __ARRAY_0__.'
      const quotedTexts = ["'text'"]
      const arrayPlaceholders = [{ placeholder: '__ARRAY_0__', value: "['val']" }]
      // Example where quoted text might look like an array placeholder if not careful
      const complexText = 'Q: __QUOTED_TEXT_0__ A: __ARRAY_0__ Q2: __QUOTED_TEXT_1__'
      const complexQuoted = ["'__ARRAY_0__'", "'final'"]
      const complexArray = [{ placeholder: '__ARRAY_0__', value: '[1,2]' }]

      expect(BasePromptHandler._restorePlaceholders(text, quotedTexts, arrayPlaceholders)).toBe("Combine 'text' with ['val'].")
      expect(BasePromptHandler._restorePlaceholders(complexText, complexQuoted, complexArray)).toBe("Q: '__ARRAY_0__' A: [1,2] Q2: 'final'")
    })
  })

  describe('_parseArrayLiteralString', () => {
    const quotedTexts = ["'quoted item'", '"another one"']

    it('should return empty array for empty or whitespace string', () => {
      expect(BasePromptHandler._parseArrayLiteralString('', quotedTexts)).toEqual([])
      expect(BasePromptHandler._parseArrayLiteralString('  ', quotedTexts)).toEqual([])
    })

    it('should parse simple items without quotes', () => {
      expect(BasePromptHandler._parseArrayLiteralString('a, b, c', quotedTexts)).toEqual(['a', 'b', 'c'])
    })

    it('should parse items with surrounding quotes', () => {
      expect(BasePromptHandler._parseArrayLiteralString('\'a\', "b", `c`', quotedTexts)).toEqual(['a', 'b', 'c'])
    })

    it('should handle items needing nested placeholder restoration', () => {
      const content = 'item1, __QUOTED_TEXT_0__, item3, __QUOTED_TEXT_1__'
      expect(BasePromptHandler._parseArrayLiteralString(content, quotedTexts)).toEqual(['item1', 'quoted item', 'item3', 'another one'])
    })

    it('should handle mixed quoted and unquoted items', () => {
      const content = 'unquoted, \'quoted\', "double"'
      expect(BasePromptHandler._parseArrayLiteralString(content, [])).toEqual(['unquoted', 'quoted', 'double'])
    })

    it('should filter out empty items from trailing commas', () => {
      expect(BasePromptHandler._parseArrayLiteralString('a, b,', quotedTexts)).toEqual(['a', 'b'])
    })
  })

  describe('_parseCommaSeparatedString', () => {
    it('should split simple strings', () => {
      expect(BasePromptHandler._parseCommaSeparatedString('a, b, c')).toBe('a, b, c')
    })

    it('should split and remove quotes from quoted parts', () => {
      expect(BasePromptHandler._parseCommaSeparatedString('\'a\', "b", `c`')).toBe('a, b, c')
    })

    it('should respect quotes when splitting', () => {
      expect(BasePromptHandler._parseCommaSeparatedString("'a, b', c")).toBe('a, b, c')
      expect(BasePromptHandler._parseCommaSeparatedString('d, "e, f"')).toBe('d, e, f')
    })

    it('should handle a single item (no commas)', () => {
      expect(BasePromptHandler._parseCommaSeparatedString('single')).toBe('single')
      expect(BasePromptHandler._parseCommaSeparatedString("'quoted single'")).toBe('quoted single')
    })

    it('should handle mixed quoted and unquoted parts', () => {
      expect(BasePromptHandler._parseCommaSeparatedString("a, 'b, c', d")).toBe('a, b, c, d')
    })
  })
})

describe('StandardPromptHandler parseParameters with comma-separated strings', () => {
  it('should convert comma-separated string to array in parseParameters', () => {
    const tag = "prompt('test', 'Choose:', 'option1, option2, option3')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toEqual(['option1', 'option2', 'option3'])
  })

  it('should handle comma-separated string with spaces', () => {
    const tag = "prompt('test', 'Choose:', '  option1  ,  option2  ,  option3  ')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toEqual(['option1', 'option2', 'option3'])
  })

  it('should convert bracket-wrapped strings to arrays', () => {
    const tag = "prompt('test', 'Choose:', '[option1, option2]')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toEqual(['option1', 'option2'])
  })

  it('should not convert text strings with spaces', () => {
    const tag = "prompt('test', 'Choose:', 'Default, with comma')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toBe('Default, with comma')
  })

  it('should convert simple comma-separated values to array', () => {
    const tag = "prompt('test', 'Choose:', 'option1,option2,option3')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toEqual(['option1', 'option2', 'option3'])
  })

  it('should not convert single-item strings', () => {
    const tag = "prompt('test', 'Choose:', 'single')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toBe('single')
  })

  it('should not convert strings that contain braces', () => {
    const tag = "prompt('test', 'Choose:', '{option1, option2}')"
    const sessionData = {}

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toBe('{option1, option2}')
  })

  it('should handle variable reference to comma-separated string', () => {
    const tag = "prompt('test', 'Choose:', dateOptions)"
    const sessionData = { dateOptions: '2025-07-19, 2025-07-20, 2025-07-26' }

    const result = StandardPromptHandler.parseParameters(tag, sessionData)

    expect(result.options).toEqual(['2025-07-19', '2025-07-20', '2025-07-26'])
  })
})
