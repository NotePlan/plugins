// @flow
/**
 * @fileoverview Tests for shared prompt functions
 */

import { describe, expect, it } from '@jest/globals'
import { parseStringOrRegex } from '../lib/support/modules/prompts/sharedPromptFunctions'

describe('parseStringOrRegex', () => {
  it('should handle empty input', () => {
    expect(parseStringOrRegex('')).toBe('')
    expect(parseStringOrRegex(null)).toBe('')
    expect(parseStringOrRegex(undefined)).toBe('')
  })

  it('should preserve regex patterns with special characters', () => {
    expect(parseStringOrRegex('/Task(?!.*Done)/')).toBe('/Task(?!.*Done)/')
    expect(parseStringOrRegex('/Task[^D]one/')).toBe('/Task[^D]one/')
    expect(parseStringOrRegex('/Task\\/Done/')).toBe('/Task\\/Done/')
  })

  it('should preserve regex patterns with flags', () => {
    expect(parseStringOrRegex('/Task/i')).toBe('/Task/i')
    expect(parseStringOrRegex('/Task/gi')).toBe('/Task/gi')
    expect(parseStringOrRegex('/Task/mi')).toBe('/Task/mi')
  })

  it('should remove quotes from normal strings', () => {
    expect(parseStringOrRegex('"Task"')).toBe('Task')
    expect(parseStringOrRegex("'Task'")).toBe('Task')
    expect(parseStringOrRegex('Task')).toBe('Task')
  })

  it('should handle escaped characters in regex patterns', () => {
    expect(parseStringOrRegex('/Task\\.Done/')).toBe('/Task\\.Done/')
    expect(parseStringOrRegex('/Task\\+Done/')).toBe('/Task\\+Done/')
    expect(parseStringOrRegex('/Task\\*Done/')).toBe('/Task\\*Done/')
  })

  it('should handle incomplete regex patterns', () => {
    expect(parseStringOrRegex('/Task')).toBe('/Task')
    expect(parseStringOrRegex('/Task/')).toBe('/Task/')
  })
})
