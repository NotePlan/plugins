/**
 * Tests for templateUtils functions
 */

import { CustomConsole } from '@jest/console'
import { describe, test, expect, beforeAll } from '@jest/globals'
import { convertEJSClosingTags } from '../lib/shared/templateUtils.js'
import { simpleFormatter, DataStore } from '@mocks/index'

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  global.DataStore = { ...DataStore, settings: { _logLevel: 'none' } }
})

describe('convertEJSClosingTags', () => {
  test('should convert <% %> to <% -%> when there is a space after <%', () => {
    const input = '<% if (condition) { %>Hello World<% } %>'
    const expected = '<% if (condition) { -%>Hello World<% } -%>'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should convert <%# %> to <%# -%> for comments with space', () => {
    const input = '<%# This is a comment %>Hello World'
    const expected = '<%# This is a comment -%>Hello World'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should NOT convert <%- %> tags (already have dash)', () => {
    const input = '<%- include("header") %>Hello World'
    const expected = '<%- include("header") %>Hello World'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should NOT convert <%= %> tags (output tags)', () => {
    const input = '<%= user.name %>Hello World'
    const expected = '<%= user.name %>Hello World'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should NOT convert <%~ %> tags (unescaped output)', () => {
    const input = '<%~ user.html %>Hello World'
    const expected = '<%~ user.html %>Hello World'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should NOT convert <% %> tags that already have -%>', () => {
    const input = '<% if (condition) { -%>Hello World<% } -%>'
    const expected = '<% if (condition) { -%>Hello World<% } -%>'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should handle mixed scenarios correctly', () => {
    const input = '<% if (user.loggedIn) { %><%= user.name %><%# Welcome message %>Welcome<% } %>'
    const expected = '<% if (user.loggedIn) { -%><%= user.name %><%# Welcome message -%>Welcome<% } -%>'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should handle multi-line tags correctly', () => {
    const input = `<% 
      if (condition) { 
        doSomething()
      } 
    %>Hello World`
    const expected = `<% 
      if (condition) { 
        doSomething()
      } 
    -%>Hello World`
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should handle nested tags correctly', () => {
    const input = '<% if (outer) { %><% if (inner) { %>Nested<% } %><% } %>'
    const expected = '<% if (outer) { -%><% if (inner) { -%>Nested<% } -%><% } -%>'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should return empty string for empty input', () => {
    expect(convertEJSClosingTags('')).toBe('')
  })

  test('should return null for null input', () => {
    expect(convertEJSClosingTags(null)).toBe(null)
  })

  test('should return undefined for undefined input', () => {
    expect(convertEJSClosingTags(undefined)).toBe(undefined)
  })

  test('should not affect regular text without EJS tags', () => {
    const input = 'Hello World, this is just regular text with no EJS tags.'
    const expected = 'Hello World, this is just regular text with no EJS tags.'
    expect(convertEJSClosingTags(input)).toBe(expected)
  })

  test('should handle complex real-world template', () => {
    const input = `<% if (user.isAdmin) { %>
  <h1>Admin Panel</h1>
  <%# Show admin controls %>
  <div class="admin-controls">
    <% users.forEach(function(user) { %>
      <div class="user-item">
        <span><%= user.name %></span>
        <button><% if (user.active) { %>Deactivate<% } else { %>Activate<% } %></button>
      </div>
    <% }); %>
  </div>
<% } %>`

    const expected = `<% if (user.isAdmin) { -%>
  <h1>Admin Panel</h1>
  <%# Show admin controls -%>
  <div class="admin-controls">
    <% users.forEach(function(user) { -%>
      <div class="user-item">
        <span><%= user.name %></span>
        <button><% if (user.active) { -%>Deactivate<% } else { -%>Activate<% } -%></button>
      </div>
    <% }); -%>
  </div>
<% } -%>`

    expect(convertEJSClosingTags(input)).toBe(expected)
  })
})
