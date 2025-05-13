/* eslint-disable */
// @flow

import { processPromptTag } from '../lib/support/modules/prompts/PromptRegistry'
import '../lib/support/modules/prompts' // Import to register all prompt handlers
import BasePromptHandler from '../lib/support/modules/prompts/BasePromptHandler'
import * as PromptRegistry from '../lib/support/modules/prompts/PromptRegistry'
/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('Variable Assignment in Prompt Tags', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { logLevel: 'none' },
      hashtags: ['ChosenOption'],
    }

    // Mock CommandBar for standard prompt
    global.CommandBar = {
      textPrompt: jest.fn(() => Promise.resolve('Mock Response')),
      showOptions: jest.fn(() => Promise.resolve({ index: 0, keyModifiers: [], value: 'Mock Option' })),
    }
  })

  describe('BasePromptHandler assignment detection', () => {
    test('should detect const variable assignment', () => {
      const tag = "const myVar = promptTag('Select a tag:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('myVar')
        expect(result.cleanedTag).toBe("promptTag('Select a tag:')")
      }
    })

    test('should detect let variable assignment', () => {
      const tag = "let selectedTag = promptTag('Select a tag:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('selectedTag')
        expect(result.cleanedTag).toBe("promptTag('Select a tag:')")
      }
    })

    test('should detect var variable assignment', () => {
      const tag = "var chosenTag = promptTag('Select a tag:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('chosenTag')
        expect(result.cleanedTag).toBe("promptTag('Select a tag:')")
      }
    })

    test('should handle await with variable assignment', () => {
      const tag = "const myTag = await promptTag('Select a tag:')"
      const result = BasePromptHandler.extractVariableAssignment(tag)

      expect(result).not.toBeNull()
      if (result) {
        // Flow type check
        expect(result.varName).toBe('myTag')
        expect(result.cleanedTag).toBe("promptTag('Select a tag:')")
      }
    })
  })

  //  because we are just testing the mocks we create in the test?
  describe('ProcessPromptTag variable assignment', () => {
    // dbw TRYING ACTUAL TEST
    test('should process promptTag with const variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% const myTag = promptTag('Select a tag:') %>"

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('')
      expect(sessionData.myTag).toBe('#ChosenOption')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process promptKey with let variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% let myTag = promptTag('Select a tag:') %>"

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('')
      expect(sessionData.myTag).toBe('#ChosenOption')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process promptMention with var variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% var myTag = promptTag('Select a tag:') %>"

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('')
      expect(sessionData.myTag).toBe('#ChosenOption')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process await with variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% const myTag = await promptTag('Select a tag:') %>"

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('')
      expect(sessionData.myTag).toBe('#ChosenOption')

      // Restore mocks
      jest.restoreAllMocks()
    })
  })
})
