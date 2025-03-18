/* eslint-disable */
// @flow
/**
 * @jest-environment jsdom
 */

import PromptTagHandler from '../lib/support/modules/prompts/PromptTagHandler'
import PromptMentionHandler from '../lib/support/modules/prompts/PromptMentionHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('promptTag and promptMention with single parameter', () => {
  beforeEach(() => {
    // Suppress console logs during tests
    // $FlowFixMe - Console properties are read-only but we're mocking for tests
    console.log = jest.fn()
    // $FlowFixMe - Console properties are read-only but we're mocking for tests
    console.debug = jest.fn()
    // $FlowFixMe - Console properties are read-only but we're mocking for tests
    console.info = jest.fn()
    // $FlowFixMe - Console properties are read-only but we're mocking for tests
    console.warn = jest.fn()
    // $FlowFixMe - Console properties are read-only but we're mocking for tests
    console.error = jest.fn()
  })

  describe('promptTag with single message parameter', () => {
    it('should correctly parse a tag with single quoted parameter', () => {
      const tag = '<%- promptTag("tagMessage") %>'
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('tagMessage')
      expect(result.varName).toBe('')
    })

    it('should correctly parse a tag with single quoted parameter and spaces', () => {
      const tag = '<%- promptTag("Select a tag:") %>'
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('Select a tag:')
      expect(result.varName).toBe('')
    })

    it('should correctly parse a tag with single parameter using single quotes', () => {
      const tag = "<%- promptTag('tagMessage') %>"
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('tagMessage')
      expect(result.varName).toBe('')
    })
  })

  describe('promptMention with single message parameter', () => {
    it('should correctly parse a tag with single quoted parameter', () => {
      const tag = '<%- promptMention("mentionMessage") %>'
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('mentionMessage')
      expect(result.varName).toBe('')
    })

    it('should correctly parse a tag with single quoted parameter and spaces', () => {
      const tag = '<%- promptMention("Select a mention:") %>'
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('Select a mention:')
      expect(result.varName).toBe('')
    })

    it('should correctly parse a tag with single parameter using single quotes', () => {
      const tag = "<%- promptMention('mentionMessage') %>"
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('mentionMessage')
      expect(result.varName).toBe('')
    })
  })
})
