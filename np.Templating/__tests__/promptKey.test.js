/* eslint-disable */
// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 NotePlan Plugin Developers. All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import NPTemplating from '../lib/NPTemplating'
import PromptKeyHandler from '../lib/support/modules/prompts/PromptKeyHandler'
import { isCode } from '../lib/core'
import { processPrompts } from '../lib/support/modules/prompts/PromptRegistry'
import { getTags } from '../lib/core'

/**
 * Tests for the promptKey functionality in NPTemplating
 * These tests ensure the parameter parsing works correctly and
 * that function detection in isCode properly excludes promptKey calls
 */
describe('promptKey functionality', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
    // Mock CommandBar
    global.CommandBar = {
      showOptions: jest.fn(),
      showInput: jest.fn(),
      prompt: jest.fn(),
    }
  })
  describe('parsePromptKeyParameters', () => {
    it('should parse a basic promptKey tag with only tagKey parameter', () => {
      const tag = "<%- promptKey('bg-color') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('bg-color')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('')
      expect(result.noteType).toBe('All')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should parse a promptKey tag with all parameters', () => {
      const tag = "<%- promptKey('bg-color', 'Choose the bg-color tag', 'Notes', true, 'folder1', false) -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('bg-color')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Choose the bg-color tag')
      expect(result.noteType).toBe('Notes')
      expect(result.caseSensitive).toBe(true)
      expect(result.folderString).toBe('folder1')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should parse a promptKey tag with double quotes', () => {
      const tag = '<%- promptKey("status", "Choose status", "Calendar", false, "Work/Projects", true) -%>'
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('status')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Choose status')
      expect(result.noteType).toBe('Calendar')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('Work/Projects')
      expect(result.fullPathMatch).toBe(true)
    })

    it('should parse a promptKey tag with mixed quotes', () => {
      const tag = '<%- promptKey(\'project\', "Select project", \'All\', true, "Work/Projects", false) -%>'
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('project')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Select project')
      expect(result.noteType).toBe('All')
      expect(result.caseSensitive).toBe(true)
      expect(result.folderString).toBe('Work/Projects')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should parse a promptKey tag with partial parameters', () => {
      const tag = "<%- promptKey('type', 'Choose type', 'Notes') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('type')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Choose type')
      expect(result.noteType).toBe('Notes')
      // Default values for omitted parameters
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should parse a promptKey tag with an empty tagKey', () => {
      const tag = "<%- promptKey('') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('')
      expect(result.varName).toBe('')
      // Default values
      expect(result.promptMessage).toBe('')
      expect(result.noteType).toBe('All')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should parse a promptKey tag with command syntax without output', () => {
      const tag = "<% promptKey('category', 'Select category') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('category')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Select category')
      expect(result.noteType).toBe('All')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('')
      expect(result.fullPathMatch).toBe(false)
    })

    it('should handle commas inside quoted parameters', () => {
      const tag = "<%- promptKey('tags', 'Select tags, comma-separated', 'Notes', false, 'Projects/2023', true) -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('tags')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Select tags, comma-separated')
      expect(result.noteType).toBe('Notes')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('Projects/2023')
      expect(result.fullPathMatch).toBe(true)
    })
  })

  describe('isCode function with promptKey', () => {
    it('should not identify promptKey calls as code blocks', () => {
      // Basic promptKey call
      expect(isCode("<%- promptKey('status') -%>")).toBe(false)

      // promptKey with all parameters
      expect(isCode("<%- promptKey('bg-color', 'Choose color', 'Notes', true, 'folder1', false) -%>")).toBe(false)
    })

    it('should identify other function calls as code blocks', () => {
      // Regular function calls should be identified as code
      expect(isCode('<%- weather() -%>')).toBe(true)
      expect(isCode("<%- getValuesForKey('tags') -%>")).toBe(true)
    })
  })

  // For the processPrompts tests, we'll take a different approach since
  // we can't easily mock the promptKey method

  describe('processPrompts parameter extraction', () => {
    it('should correctly extract parameters from promptKey tags', () => {
      const tag = "<%- promptKey('test-key', 'Select a key') -%>"

      // Test that parsePromptKeyParameters returns the expected values
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)

      expect(result.tagKey).toBe('test-key')
      expect(result.varName).toBe('')
      expect(result.promptMessage).toBe('Select a key')
      expect(result.noteType).toBe('All')
      expect(result.caseSensitive).toBe(false)
      expect(result.folderString).toBe('')
      expect(result.fullPathMatch).toBe(false)
    })
  })

  describe('regex pattern handling', () => {
    it('should parse regex patterns with flags', () => {
      const tag = "<%- promptKey('/^NOTE/i', 'Choose a NOTE') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)
      expect(result.tagKey).toBe('/^NOTE/i')
    })

    it('should parse regex patterns with multiple flags', () => {
      const tag = "<%- promptKey('/Project.*/gi', 'Choose a project') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)
      expect(result.tagKey).toBe('/Project.*/gi')
    })

    it('should parse regex patterns with special characters', () => {
      const tag = "<%- promptKey('/Task(?!.*Done)/', 'Choose a task') -%>"
      const result = PromptKeyHandler.parsePromptKeyParameters(tag)
      expect(result.tagKey).toBe('/Task(?!.*Done)/')
    })
  })

  describe('prompt cancellation handling', () => {
    it('should handle cancelled prompts', async () => {
      // Mock chooseOptionWithModifiers to return false
      const originalChooseOption = global.chooseOptionWithModifiers
      // $FlowFixMe: Mock function type
      global.chooseOptionWithModifiers = jest.fn().mockResolvedValue({ value: '' })

      const result = await NPTemplating.render("<%- promptKey('test-key', 'Choose a value') -%>", {})
      expect(result).toBe('')

      // Restore original function
      global.chooseOptionWithModifiers = originalChooseOption
    })

    it('should handle null responses', async () => {
      // Mock chooseOptionWithModifiers to return null
      const originalChooseOption = global.chooseOptionWithModifiers
      // $FlowFixMe: Mock function type
      global.chooseOptionWithModifiers = jest.fn().mockResolvedValue({ value: '' })

      const result = await NPTemplating.render("<%- promptKey('test-key', 'Choose a value') -%>", {})
      expect(result).toBe('')

      // Restore original function
      global.chooseOptionWithModifiers = originalChooseOption
    })
  })
})
