// @flow
/**
 * Test to verify that ALL prompt tag types behave correctly regarding output:
 *
 * 1. Variable assignment tags (<% let myvar = prompt(...) %>) should:
 *    - Set the variable in sessionData
 *    - Return empty string (no output to template)
 *
 * 2. Execution tags (<% prompt(...) %>) should:
 *    - Set the variable in sessionData (using first parameter as variable name)
 *    - Return empty string (no output to template)
 *
 * 3. Output tags (<%- prompt(...) %>) should:
 *    - Set the variable in sessionData (using first parameter as variable name)
 *    - Return variable reference (<%- varName %>) for template output
 *
 * This test covers ALL registered prompt types to ensure consistent behavior.
 */

import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import { getTags } from '../lib/core'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

// Mock the @helpers/userInput module
jest.mock('@helpers/userInput', () => ({
  datePicker: (jest.fn(): any).mockResolvedValue('2024-01-15'),
  askDateInterval: (jest.fn(): any).mockResolvedValue('TestValue'),
  chooseOptionWithModifiers: (jest.fn((message: any, options: any, allowCreate: any): any => {
    // Return the first option's value, or 'TestValue' if no options
    const value = options && options.length > 0 ? options[0].value : 'TestValue'
    return Promise.resolve({
      value: value,
      label: options && options.length > 0 ? options[0].label : 'TestValue',
      index: 0,
    })
  }): any),
  chooseOption: (jest.fn(): any).mockResolvedValue('TestValue'),
  getInput: (jest.fn(): any).mockResolvedValue('TestValue'),
}))

// Type definition for processPrompts result
type ProcessPromptsResult =
  | {
      sessionTemplateData: string,
      sessionData: Object,
    }
  | false

describe('Prompt Tag Output Behavior - All Prompt Types', () => {
  beforeEach(() => {
    // Setup the necessary global mocks
    global.DataStore = {
      settings: { _logLevel: 'none' },
      hashtags: ['#Work', '#Personal', '#TestTag'],
      mentions: ['@person1', '@person2'],
    }

    // Mock CommandBar for consistent responses
    global.CommandBar = {
      textPrompt: (jest.fn((): any => Promise.resolve('TestValue')): any),
      showOptions: (jest.fn((options: any, message: any): any => {
        return Promise.resolve({ value: 'TestValue' })
      }): any),
      showInput: (jest.fn((): any => Promise.resolve('TestValue')): any),
    }

    // Mock necessary functions for various prompt types
    global.getValuesForFrontmatterTag = (jest.fn((): any => Promise.resolve(['Option1', 'Option2'])): any)

    // Mock date picker
    global.datePicker = (jest.fn((): any => Promise.resolve('2024-01-15')): any)

    // Mock chooseOptionWithModifiers for tag and mention prompts - this is the key function
    global.chooseOptionWithModifiers = (jest.fn((message: any, options: any, allowCreate: any): any => {
      // Return the first option's value, or 'TestValue' if no options
      const value = options && options.length > 0 ? options[0].value : 'TestValue'
      return Promise.resolve({
        value: value,
        label: options && options.length > 0 ? options[0].label : 'TestValue',
        index: 0,
      })
    }): any)

    // Mock getInput for when no options are available
    global.getInput = (jest.fn((): any => Promise.resolve('TestValue')): any)

    // Mock for promptDateInterval
    global.chooseOption = (jest.fn((): any => Promise.resolve('TestValue')): any)

    // Mock askDateInterval for promptDateInterval
    global.askDateInterval = (jest.fn((): any => Promise.resolve('TestValue')): any)
  })

  /**
   * All prompt types that should be tested
   * Each entry contains the prompt call and expected variable name
   */
  const allPromptTypes = [
    {
      name: 'prompt',
      calls: {
        assignment: "prompt('lastName', 'What is your last name?')",
        execution: "prompt('lastName', 'What is your last name?')",
        output: "prompt('lastName', 'What is your last name?')",
      },
      expectedVar: 'lastName',
      expectedValue: 'TestValue',
    },
    {
      name: 'promptKey',
      calls: {
        assignment: "promptKey('category')",
        execution: "promptKey('category')",
        output: "promptKey('category')",
      },
      expectedVar: '',
      expectedValue: 'TestValue',
    },
    {
      name: 'promptTag',
      calls: {
        assignment: "promptTag('Select a tag:')",
        execution: "promptTag('Select a tag:')",
        output: "promptTag('Select a tag:')",
      },
      expectedVar: '',
      expectedValue: '#Work',
    },
    {
      name: 'promptDate',
      calls: {
        assignment: "promptDate('Choose date:')",
        execution: "promptDate('Choose date:')",
        output: "promptDate('Choose date:')",
      },
      expectedVar: 'Choose_date',
      expectedValue: '2024-01-15',
    },
    {
      name: 'promptMention',
      calls: {
        assignment: "promptMention('Select person:')",
        execution: "promptMention('Select person:')",
        output: "promptMention('Select person:')",
      },
      expectedVar: '',
      expectedValue: '@person1',
    },
    {
      name: 'promptDateInterval',
      calls: {
        assignment: "promptDateInterval('Choose interval:')",
        execution: "promptDateInterval('Choose interval:')",
        output: "promptDateInterval('Choose interval:')",
      },
      expectedVar: 'Choose_interval',
      expectedValue: 'TestValue',
    },
  ]

  describe('Variable Assignment Tags (should NOT output)', () => {
    test.each(allPromptTypes)('$name: const variable assignment should set variable and return empty string', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<% const myVar = ${calls.assignment} -%>
After`

      const result: ProcessPromptsResult = await processPrompts(template, {})

      // Should not return false (cancelled)
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // Should set the variable
      expect(sessionData).toHaveProperty('myVar')
      expect(sessionData.myVar).toBe(expectedValue)

      // Should not output anything (empty string replacement)
      expect(sessionTemplateData).toBe(`Before
After`)
      expect(sessionTemplateData).not.toContain(expectedValue)
      expect(sessionTemplateData).not.toContain(name)
    })

    test.each(allPromptTypes)('$name: let variable assignment should set variable and return empty string', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<% let myVar = ${calls.assignment} -%>
After`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      expect(sessionData).toHaveProperty('myVar')
      expect(sessionData.myVar).toBe(expectedValue)
      expect(sessionTemplateData).toBe(`Before
After`)
    })

    test.each(allPromptTypes)('$name: var variable assignment should set variable and return empty string', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<% var myVar = ${calls.assignment} -%>
After`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      expect(sessionData).toHaveProperty('myVar')
      expect(sessionData.myVar).toBe(expectedValue)
      expect(sessionTemplateData).toBe(`Before
After`)
    })
  })

  describe('Execution Tags (should NOT output)', () => {
    test.each(allPromptTypes)('$name: execution tag should set variable and return empty string', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<% ${calls.execution} -%>
After`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // Should set the variable (using the expected variable name)
      if (expectedVar) {
        expect(sessionData).toHaveProperty(expectedVar)
        expect(sessionData[expectedVar]).toBe(expectedValue)
      }

      // Should not output anything
      expect(sessionTemplateData).toBe(`Before
After`)
      expect(sessionTemplateData).not.toContain(expectedValue)
    })
  })

  describe('Output Tags (should output variable reference for prompts that have mandatory variables -- prompt|promptDate|promptDateInterval)', () => {
    test.each(allPromptTypes)('$name: output tag should set variable and return variable reference', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<%- ${calls.output} -%>
After`
      if (['prompt', 'promptDate', 'promptDateInterval'].includes(name)) {
        const result: ProcessPromptsResult = await processPrompts(template, {})
        expect(result).not.toBe(false)
        if (result === false) return // Type guard

        const { sessionTemplateData, sessionData } = result

        // Should set the variable
        expect(sessionData).toHaveProperty(expectedVar)
        expect(sessionData[expectedVar]).toBe(expectedValue)

        // Should output the variable reference
        expect(sessionTemplateData).toBe(`Before
<%- ${expectedVar} -%>After`)
        expect(sessionTemplateData).toContain(`<%- ${expectedVar} -%>`)
      }
    })
  })

  describe('Output Tags (should output prompt return value for prompts w/o mandatory variables -- promptTag,promptMention,promptKey)', () => {
    test.each(allPromptTypes)('$name: output tag should set variable and return variable reference', async ({ name, calls, expectedVar, expectedValue }) => {
      const template = `Before
<%- ${calls.output} -%>
After`
      if (['promptTag', 'promptMention', 'promptKey'].includes(name)) {
        const result: ProcessPromptsResult = await processPrompts(template, {})
        expect(result).not.toBe(false)
        if (result === false) return // Type guard

        const { sessionTemplateData, sessionData } = result

        // Should output the variable reference
        expect(sessionTemplateData).toBe(`Before
${expectedValue}After`)
      }
    })
  })

  describe('Original User Issue - Specific Test Cases', () => {
    test('should handle the exact user example correctly', async () => {
      const template = `<% let myvar = prompt("foo","message") %>
<% prompt("foo","message") %>
<%- prompt('bar',"message") %>`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // All variables should be set
      expect(sessionData).toHaveProperty('myvar')
      expect(sessionData).toHaveProperty('foo')
      expect(sessionData).toHaveProperty('bar')

      expect(sessionData.myvar).toBe('TestValue')
      expect(sessionData.foo).toBe('TestValue')
      expect(sessionData.bar).toBe('TestValue')

      // Only the output tag should produce output
      expect(sessionTemplateData).toBe(`

<%- bar %>`)
    })

    test('should handle the original reported issue', async () => {
      const template = `<% prompt('lastName', 'What is your last name?') -%>`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // Should set the variable
      expect(sessionData).toHaveProperty('lastName')
      expect(sessionData.lastName).toBe('TestValue')

      // Should not output anything (empty string)
      expect(sessionTemplateData).toBe('')
    })

    test('should handle output tag correctly', async () => {
      const template = `<%- prompt('lastName', 'What is your last name?') -%>`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // Should set the variable
      expect(sessionData).toHaveProperty('lastName')
      expect(sessionData.lastName).toBe('TestValue')

      // Should output the variable reference
      expect(sessionTemplateData).toBe('<%- lastName -%>')
    })
  })

  describe('Mixed scenarios with all prompt types', () => {
    test('should handle combination of assignment, execution, and output tags', async () => {
      const template = `# Project Template
<% const category2 = promptKey("category") -%>
<% promptTag("Select a tag:") -%>
<% let priority = prompt("priority", "Enter priority:") -%>
Category: <%- category2 %>
Tag: <%- Select_a_tag %>
Priority: <%- priority %>
Date: <%- promptDate("Choose date:") -%>`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      // All variables should be set
      expect(sessionData).not.toHaveProperty('category')
      expect(sessionData).toHaveProperty('category2')
      expect(sessionData).not.toHaveProperty('Select_a_tag')
      expect(sessionData).toHaveProperty('priority')
      expect(sessionData).toHaveProperty('Choose_date')

      // Template should have variable references only for output tags
      expect(sessionTemplateData).toContain('Category: <%- category2 %>')
      expect(sessionTemplateData).toContain('Tag: <%- Select_a_tag %>')
      expect(sessionTemplateData).toContain('Priority: <%- priority %>')
      expect(sessionTemplateData).toContain('Date: <%- Choose_date -%>')

      // Should not contain the original prompt calls
      expect(sessionTemplateData).not.toContain('promptKey("category")')
      expect(sessionTemplateData).not.toContain('promptTag("Select a tag:")')
      expect(sessionTemplateData).not.toContain('prompt("priority"')
      expect(sessionTemplateData).not.toContain('promptDate("Choose date:")')
    })
  })

  describe('Edge cases and error handling', () => {
    test('should handle empty templates', async () => {
      const template = ``
      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result
      expect(sessionTemplateData).toBe('')
      expect(sessionData).toEqual({})
    })

    test('should handle templates with no prompts', async () => {
      const template = `Just some text with no prompts`
      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result
      expect(sessionTemplateData).toBe('Just some text with no prompts')
      expect(sessionData).toEqual({})
    })

    test('should handle multiple instances of the same prompt type', async () => {
      const template = `<% const first = prompt("var1", "First prompt") %>
<% const second = prompt("var2", "Second prompt") %>
<%- first %> and <%- second %>`

      const result: ProcessPromptsResult = await processPrompts(template, {})
      expect(result).not.toBe(false)
      if (result === false) return // Type guard

      const { sessionTemplateData, sessionData } = result

      expect(sessionData).toHaveProperty('first')
      expect(sessionData).toHaveProperty('second')
      expect(sessionTemplateData).toContain('<%- first %> and <%- second %>')
    })
  })
})
