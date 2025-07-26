// @flow
import { jest, describe, expect, test, beforeEach } from '@jest/globals'
import NPTemplating from '../lib/NPTemplating'
import { logDebug } from '@helpers/dev'

// Mock CommandBar global
global.CommandBar = {
  prompt: jest.fn().mockReturnValue(false),
  textPrompt: jest.fn().mockReturnValue(false),
  chooseOption: jest.fn().mockReturnValue(false),
  showOptions: jest.fn().mockReturnValue(false),
}

// Mock user input helpers
jest.mock('@helpers/userInput', () => ({
  chooseOption: jest.fn().mockReturnValue(false),
  textPrompt: jest.fn().mockReturnValue(false),
  showOptions: jest.fn().mockReturnValue(false),
}))

describe('Prompt Cancellation Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
    global.DataStore = {
      settings: { _logLevel: 'none' },
    }
  })

  test('should stop processing when a prompt is cancelled', async () => {
    const template = `
      <%- prompt('var1', 'This prompt will be cancelled') %>
      <%- var2 %>
      <%- var3 %>
    `
    const result = await NPTemplating.render(template)
    expect(result).toBe('')
  })

  test('should stop template rendering when a prompt is cancelled', async () => {
    const template = `
      <%- var1 %>
      <%- prompt('var2', 'This prompt will be cancelled') %>
      <%- var3 %>
    `
    const result = await NPTemplating.render(template)
    expect(result).toBe('')
  })

  test('should handle frontmatter prompts cancellation', async () => {
    const template = `---
title: Test Template
var1: <%- prompt('var1', 'This prompt will be cancelled') %>
var2: <%- var2 %>
---
Content here
    `
    const result = await NPTemplating.render(template)
    expect(result).toBe('')
  })

  test('should handle mixed prompt types cancellation', async () => {
    const template = `---
title: Test Template
var1: <%- prompt('var1', 'This prompt will be cancelled') %>
---
<%- var2 %>
<%- prompt('var3', 'This prompt will be cancelled') %>
    `
    const result = await NPTemplating.render(template)
    expect(result).toBe('')
  })
})
