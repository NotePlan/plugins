/* eslint-disable */
// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 NotePlan Plugin Developers. All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

const { describe, expect, it, test } = require('@jest/globals')
import NPTemplating from '../lib/NPTemplating'

describe('isCode', () => {
  beforeEach(() => {
    global.DataStore = {
      settings: { logLevel: 'none' },
    }
  })

  it('should detect function calls with no space', () => {
    // Test cases for function calls with no space between function name and parentheses
    expect(NPTemplating.isCode('<%- weather() %>')).toBe(true)
    expect(NPTemplating.isCode('<%- getValues() %>')).toBe(true)
    expect(NPTemplating.isCode('<%- getValuesForKey("tags") %>')).toBe(true)
    expect(NPTemplating.isCode('<%-weather() %>')).toBe(true)
    expect(NPTemplating.isCode('<%-  weather() %>')).toBe(true) // Multiple spaces after <%-
  })

  it('should detect JavaScript blocks with space after <%', () => {
    // Test cases for blocks that start with <% followed by a space
    expect(NPTemplating.isCode('<% if (condition) { %>')).toBe(true)
    expect(NPTemplating.isCode('<% for (let i = 0; i < 10; i++) { %>')).toBe(true)
  })

  it('should detect variable declarations', () => {
    // Test cases for variable declarations
    expect(NPTemplating.isCode('<% let x = 10 %>')).toBe(true)
    expect(NPTemplating.isCode('<% const name = "John" %>')).toBe(true)
    expect(NPTemplating.isCode('<% var age = 25 %>')).toBe(true)
  })

  it('should detect template-specific syntax', () => {
    // Test cases for template-specific syntax
    expect(NPTemplating.isCode('<%~ someFunction() %>')).toBe(true)
  })

  it('should not detect prompt calls', () => {
    // Test cases for prompt calls
    expect(NPTemplating.isCode('<%- prompt("Enter your name") %>')).toBe(false)
    expect(NPTemplating.isCode('<%- promptDate("Select a date") %>')).toBe(false)
    expect(NPTemplating.isCode('<%- promptKey("Select a key") %>')).toBe(false)
  })

  it('should not detect comment tags', () => {
    // First, verify that isCommentTag correctly identifies comments
    const isCommentTag = (tag: string = '') => tag.includes('<%#')
    expect(isCommentTag('<%# This is a comment %>')).toBe(true)
    expect(isCommentTag('<%- Not a comment %>')).toBe(false)

    // Now test that isCode doesn't treat comments as code blocks
    // Note: The isCode function doesn't explicitly check for comments, but the templating
    // system first filters them out using isCommentTag before processing with isCode
    expect(NPTemplating.isCode('<%# This is a comment %>')).toBe(false)
  })

  it('should not detect non-function tags', () => {
    // Test cases for non-function tags
    expect(NPTemplating.isCode('<%- someVariable %>')).toBe(false)
    expect(NPTemplating.isCode('<%- "Some string" %>')).toBe(false)
  })

  it('should handle mixed scenarios correctly', () => {
    // Function call with significant whitespace
    expect(NPTemplating.isCode('<%- weather   (   ) %>')).toBe(true)

    // Complex template with function calls
    expect(NPTemplating.isCode('<%- date.now("YYYY-MM-DD") %>')).toBe(true)

    // Nested function calls
    expect(NPTemplating.isCode('<%- getValues(getParam("name")) %>')).toBe(true)

    // Functions with string parameters containing parentheses
    expect(NPTemplating.isCode('<%- weather("temp (C)") %>')).toBe(true)
  })

  it('should correctly handle edge cases', () => {
    // Empty tags
    expect(NPTemplating.isCode('<%- %>')).toBe(false)
    expect(NPTemplating.isCode('<% %>')).toBe(false)

    // Tags with only whitespace
    expect(NPTemplating.isCode('<%-   %>')).toBe(false)

    // Tags with special characters
    expect(NPTemplating.isCode('<%- @special %>')).toBe(false)

    // Template syntax with no function call
    expect(NPTemplating.isCode('<%- ${variable} %>')).toBe(false)
  })
})
