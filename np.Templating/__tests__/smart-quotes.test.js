// @flow
/* global describe, test, expect */

/**
 * @fileoverview Tests for smart quote replacement functionality
 */

import { replaceSmartQuotes } from '../lib/utils/stringUtils'

describe('replaceSmartQuotes', () => {
  test('should replace left double quotation mark (U+201C) with straight double quote (")', () => {
    const input = 'Hello \u201Cworld\u201D'
    const expected = 'Hello "world"'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace right double quotation mark (U+201D) with straight double quote (")', () => {
    const input = 'Hello \u201Cworld\u201D'
    const expected = 'Hello "world"'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace left single quotation mark (U+2018) with straight single quote (")', () => {
    const input = "It's a \u2018test\u2019"
    const expected = "It's a 'test'"
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace right single quotation mark (U+2019) with straight single quote (")', () => {
    const input = "It's a \u2018test\u2019"
    const expected = "It's a 'test'"
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle mixed smart quotes in the same string', () => {
    const input = 'She said \u201CHello\u201D and he replied \u2018Hi\u2019'
    const expected = 'She said "Hello" and he replied \'Hi\''
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle multiple occurrences of the same smart quote', () => {
    const input = 'Quote 1: \u201CHello\u201D Quote 2: \u201CWorld\u201D'
    const expected = 'Quote 1: "Hello" Quote 2: "World"'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle strings with no smart quotes', () => {
    const input = 'This is a normal string with "regular" quotes'
    const expected = 'This is a normal string with "regular" quotes'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle empty string', () => {
    const input = ''
    const expected = ''
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle null input', () => {
    const input = null
    expect(replaceSmartQuotes(input)).toBe(input)
  })

  test('should handle undefined input', () => {
    const input = undefined
    expect(replaceSmartQuotes(input)).toBe(input)
  })

  test('should handle non-string input', () => {
    const input = 123
    expect(replaceSmartQuotes(input)).toBe(input)
  })

  test('should handle complex template-like content with smart quotes', () => {
    const input = 'const message = "Hello \'world\'"; const title = "My \'Title\'"'
    const expected = 'const message = "Hello \'world\'"; const title = "My \'Title\'"'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle smart quotes in template tags', () => {
    const input = '<% prompt("Choose an option:") %>'
    const expected = '<% prompt("Choose an option:") %>'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle actual smart quote characters in template tags', () => {
    const input = "<%- np.weather(':FeelsLikeF:') %>"
    const expected = "<%- np.weather(':FeelsLikeF:') %>"
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle actual smart quote characters in text', () => {
    const input = 'She said "Hello" and he replied \'Hi\''
    const expected = 'She said "Hello" and he replied \'Hi\''
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should handle mixed Unicode and actual smart quote characters', () => {
    const input = 'Mixed: "Unicode" and "actual" quotes'
    const expected = 'Mixed: "Unicode" and "actual" quotes'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace literal left and right double curly quotes (“ and ”) with straight double quotes (")', () => {
    const input = 'Hello “world” and “again”'
    const expected = 'Hello "world" and "again"'
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace literal left and right single curly quotes (‘ and ’) with straight single quotes (")', () => {
    const input = 'It‘s a ‘test’ and ‘again’'
    const expected = "It's a 'test' and 'again'"
    expect(replaceSmartQuotes(input)).toBe(expected)
  })

  test('should replace mixed Unicode and literal curly quotes', () => {
    const input = '“Unicode” and \u201CUnicode\u201D and ‘Unicode’ and \u2018Unicode\u2019'
    const expected = '"Unicode" and "Unicode" and \'Unicode\' and \'Unicode\''
    expect(replaceSmartQuotes(input)).toBe(expected)
  })
})
