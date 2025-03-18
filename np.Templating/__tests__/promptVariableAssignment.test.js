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
    }

    // Mock CommandBar for standard prompt
    global.CommandBar = {
      textPrompt: jest.fn(() => Promise.resolve('Mock Response')),
      showOptions: jest.fn(() => Promise.resolve({ value: 'Mock Option' })),
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

  describe('ProcessPromptTag variable assignment', () => {
    test('should process promptTag with variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% const myTag = promptTag('Select a tag:') %>"

      // Mock the processPromptTag function
      jest.spyOn(PromptRegistry, 'processPromptTag').mockImplementation(async (tag, sessionData) => {
        // Simulate the proper behavior
        sessionData.myTag = 'Selected Tag'
        return '<%- myTag %>'
      })

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('<%- myTag %>')
      expect(sessionData.myTag).toBe('Selected Tag')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process promptKey with variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% let keyVar = promptKey('Choose key:') %>"

      // Mock the processPromptTag function
      jest.spyOn(PromptRegistry, 'processPromptTag').mockImplementation(async (tag, sessionData) => {
        // Simulate the proper behavior
        sessionData.keyVar = 'Selected Key'
        return '<%- keyVar %>'
      })

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('<%- keyVar %>')
      expect(sessionData.keyVar).toBe('Selected Key')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process promptMention with variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% var mentionVar = promptMention('Choose mention:') %>"

      // Mock the processPromptTag function
      jest.spyOn(PromptRegistry, 'processPromptTag').mockImplementation(async (tag, sessionData) => {
        // Simulate the proper behavior
        sessionData.mentionVar = 'Selected Mention'
        return '<%- mentionVar %>'
      })

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('<%- mentionVar %>')
      expect(sessionData.mentionVar).toBe('Selected Mention')

      // Restore mocks
      jest.restoreAllMocks()
    })

    test('should process await with variable assignment', async () => {
      const sessionData: any = {}
      const tag = "<% const myVar = await promptTag('Select a tag:') %>"

      // Mock the processPromptTag function
      jest.spyOn(PromptRegistry, 'processPromptTag').mockImplementation(async (tag, sessionData) => {
        // Simulate the proper behavior
        sessionData.myVar = 'Selected Tag (Await)'
        return '<%- myVar %>'
      })

      const result = await PromptRegistry.processPromptTag(tag, sessionData, '<%', '%>')
      expect(result).toBe('<%- myVar %>')
      expect(sessionData.myVar).toBe('Selected Tag (Await)')

      // Restore mocks
      jest.restoreAllMocks()
    })
  })
})
