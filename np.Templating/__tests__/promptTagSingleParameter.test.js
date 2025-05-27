/* eslint-disable */
// @flow

import PromptTagHandler from '../lib/support/modules/prompts/PromptTagHandler'
import PromptMentionHandler from '../lib/support/modules/prompts/PromptMentionHandler'
import '../lib/support/modules/prompts' // Import to register all prompt handlers

/* global describe, test, expect, jest, beforeEach, beforeAll */

describe('promptTag and promptMention with single parameter', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })

  describe('promptTag with single message parameter', () => {
    it('should correctly parse a tag with single quoted parameter', () => {
      const tag = '<%- promptTag("tagMessage") %>'
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('tagMessage')
    })

    it('should correctly parse a tag with single quoted parameter and spaces', () => {
      const tag = '<%- promptTag("Select a tag:") %>'
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('Select a tag:')
    })

    it('should correctly parse a tag with single parameter using single quotes', () => {
      const tag = "<%- promptTag('tagMessage') %>"
      const result = PromptTagHandler.parsePromptTagParameters(tag)

      expect(result.promptMessage).toBe('tagMessage')
    })
  })

  describe('promptMention with single message parameter', () => {
    it('should correctly parse a tag with single quoted parameter', () => {
      const tag = '<%- promptMention("mentionMessage") %>'
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('mentionMessage')
    })

    it('should correctly parse a tag with single quoted parameter and spaces', () => {
      const tag = '<%- promptMention("Select a mention:") %>'
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('Select a mention:')
    })

    it('should correctly parse a tag with single parameter using single quotes', () => {
      const tag = "<%- promptMention('mentionMessage') %>"
      const result = PromptMentionHandler.parsePromptMentionParameters(tag)

      expect(result.promptMessage).toBe('mentionMessage')
    })
  })
})
