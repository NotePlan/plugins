/* globals beforeAll, describe, expect, test */

import { getMetadataLineIndexFromBody, getProjectMetadataLineIndex } from '../reviewHelpers'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  // Minimal DataStore mock for preference lookups in reviewHelpers.
  // eslint-disable-next-line no-global-assign
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
  }
})

describe('getMetadataLineIndexFromBody', () => {
  test('finds body metadata line when present', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '# Example\n' +
        'project: #project @review(1w)\n' +
        '\n' +
        'Body line 1\n',
    })

    const expectedIndex = note.paragraphs.findIndex((p: any) => String(p.content).startsWith('project:'))
    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(expectedIndex)
  })

  test('returns false when no body metadata line exists', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '# Example\n' +
        '\n' +
        'Body line 1\n',
    })

    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(false)
  })

  test('ignores configured frontmatter metadata key and returns false when body has none', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '---\n' +
        'project: #project\n' +
        'reviewed: 2026-03-26\n' +
        'nextReview:\n' +
        'review: 1w\n' +
        '---\n' +
        '# Example\n' +
        '\n' +
        'Body line 1\n',
    })

    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(false)
  })
})

describe('getProjectMetadataLineIndex', () => {
  test('returns frontmatter combined key line when body has no metadata line', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '---\n' +
        'project: #project @review(1m)\n' +
        '---\n' +
        '# Example\n' +
        '\n' +
        'Body line 1\n',
    })

    const projectLineIndex = note.paragraphs.findIndex((p: any) => String(p.content).startsWith('project:'))
    expect(projectLineIndex).toBeGreaterThan(0)
    const actualIndex = getProjectMetadataLineIndex((note: any))
    expect(actualIndex).toBe(projectLineIndex)
  })

  test('matches body-only helper when metadata is in the note body', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '# Example\n' +
        'project: #project @review(1w)\n' +
        '\n' +
        'Body line 1\n',
    })

    expect(getProjectMetadataLineIndex((note: any))).toBe(getMetadataLineIndexFromBody((note: any)))
  })
})
