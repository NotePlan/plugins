/* globals beforeAll, describe, expect, test */

import { getOrMakeMetadataLineIndex } from '../reviewHelpers'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  // Minimal DataStore mock for preference lookups in reviewHelpers.
  // eslint-disable-next-line no-global-assign
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
  }
})

describe('getOrMakeMetadataLineIndex', () => {
  test('in frontmatter mode, selects configured combined key line only', () => {
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

    const expectedIndex = note.paragraphs.findIndex((p: any) => String(p.content).startsWith('project:'))
    const actualIndex = getOrMakeMetadataLineIndex((note: any))
    expect(actualIndex).toBe(expectedIndex)
  })
})

