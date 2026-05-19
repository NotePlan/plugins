// @flow
/* eslint-disable */

import { parseAllProjectsListFileContent } from '../allProjectsListHelpers'

describe('parseAllProjectsListFileContent', () => {
  test('returns null for null, empty, or whitespace content', () => {
    expect(parseAllProjectsListFileContent(null)).toBeNull()
    expect(parseAllProjectsListFileContent('')).toBeNull()
    expect(parseAllProjectsListFileContent('   ')).toBeNull()
  })

  test('returns empty array for []', () => {
    expect(parseAllProjectsListFileContent('[]')).toEqual([])
  })

  test('returns null for {} (not an array)', () => {
    expect(parseAllProjectsListFileContent('{}')).toBeNull()
  })

  test('parses a JSON array of project rows', () => {
    const rows = [{ filename: 'Work/foo.md', title: 'Foo' }]
    expect(parseAllProjectsListFileContent(JSON.stringify(rows))).toEqual(rows)
  })

  test('returns null for invalid JSON', () => {
    expect(parseAllProjectsListFileContent('not json')).toBeNull()
  })
})
