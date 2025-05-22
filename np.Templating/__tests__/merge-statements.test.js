import { mergeMultiLineStatements } from '../lib/utils'

// for Flow errors with Jest
/* global describe, beforeEach, afterEach, test, expect, jest */

describe('mergeMultiLineStatements', () => {
  test('should merge simple method chains', () => {
    const input = 'DataStore.projectNotes\n  .filter(f => f.isSomething)\n  .sort(s => s.title);'
    const expected = 'DataStore.projectNotes .filter(f => f.isSomething) .sort(s => s.title);'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should merge simple ternary operators', () => {
    const input = 'const x = condition\n  ? value1\n  : value2;'
    const expected = 'const x = condition ? value1 : value2;'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should handle leading/trailing whitespace on continuation lines', () => {
    const input = 'object.method1()\n   .method2()\n      ? valueIfTrue\n   : valueIfFalse;'
    const expected = 'object.method1() .method2() ? valueIfTrue : valueIfFalse;'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should remove semicolon from previous line if next is a chain', () => {
    const input = 'object.method1();\n  .method2()\n  .method3();'
    const expected = 'object.method1() .method2() .method3();' // Semicolon from method1 removed
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should not merge lines unnecessarily', () => {
    const input = 'const a = 1;\nconst b = 2;\nconsole.log(a);'
    const expected = 'const a = 1;\nconst b = 2;\nconsole.log(a);' // Should remain unchanged
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should handle complex chained calls and ternaries mixed', () => {
    const input = 'items.map(item => item.value)\n  .filter(value => value > 10)\n  .sort((a,b) => a - b);\nconst result = items.length > 0\n  ? items[0]\n  : null;'
    const expected = 'items.map(item => item.value) .filter(value => value > 10) .sort((a,b) => a - b);\nconst result = items.length > 0 ? items[0] : null;'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should handle multiple distinct statements with continuations', () => {
    const input = 'const arr = [1,2,3]\n .map(x => x * 2);\nlet y = foo\n .bar();'
    const expected = 'const arr = [1,2,3] .map(x => x * 2);\nlet y = foo .bar();'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should handle lines starting with ? or : for ternaries even after semicolon', () => {
    const input = "let result;\nresult = (x === 1)\n    ? 'one'\n    : 'other';"
    const expected = "let result;\nresult = (x === 1) ? 'one' : 'other';"
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })

  test('should maintain correct spacing when merging', () => {
    const input = 'foo\n.bar\n?baz\n:qux'
    const expected = 'foo .bar ?baz :qux'
    expect(mergeMultiLineStatements(input)).toBe(expected)
  })
})
