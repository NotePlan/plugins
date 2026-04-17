/* globals describe, expect, test */

import { escapeRegExp } from '../regexEscape'

describe('escapeRegExp (Monterey-safe module for consumers that must not load regex.js)', () => {
  test('returns empty string for empty input', () => {
    expect(escapeRegExp('')).toBe('')
  })

  test('leaves alphanumeric text unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello')
  })

  test('escapes all RegExp metacharacters', () => {
    const raw = '.*+?^${}()|[]\\'
    const out = escapeRegExp(raw)
    expect(out).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
    expect(new RegExp(out).test(raw)).toBe(true)
    expect(new RegExp(out).test('x')).toBe(false)
  })

  test('round-trips user string as literal in RegExp', () => {
    const user = 'foo(bar)^baz'
    const r = new RegExp(`^${escapeRegExp(user)}$`)
    expect(r.test(user)).toBe(true)
    expect(r.test('foo(bar)^baz!')).toBe(false)
  })
})
