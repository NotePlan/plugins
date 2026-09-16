/* globals beforeAll, describe, expect, test */
// @flow

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
      rawContent:
        '# Example\n' +
        'project: #project @review(1w)\n' +
        '\n' +
        'Body line 1\n',
    })

    const expectedIndex = note.paragraphs.findIndex((p: any) => String(p.rawContent).startsWith('project:'))
    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(expectedIndex)
  })

  test('returns false when no body metadata line exists', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
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
      rawContent:
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

  test('ignores tasks including #project tag', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        '* [ ] #project Task 1\n' +
        '* [x] #project Task 2\n' +
        '\n' +
        'Body line 1\n',
    })

    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(false)
  })

  test('ignores tasks including "project:" phrase', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        '* [ ] see project: 1\n' +
        '* [x] work on project: 2\n' +
        '\n' +
        'Body line 1\n',
    })

    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(false)
  })

  test('ignores unrelated hashtag line under title (issue #775)', () => {
    preferenceValues['projectTypeTags'] = ['#project', '#area']
    preferenceValues['sequentialTag'] = '#sequential'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '---\n' +
        'type: #area\n' +
        'review: 3m\n' +
        '---\n' +
        '# Example\n' +
        '#admin [[Some Resource]] some other text\n' +
        '\n' +
        'Body line 1\n',
    })

    const actualIndex = getMetadataLineIndexFromBody((note: any))
    expect(actualIndex).toBe(false)
  })

  test('ignores personal nested hashtag under title that is not in Hashtags to Review', () => {
    preferenceValues['projectTypeTags'] = ['#project', '#area']

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        '#hobby/creative · [[Some Other Note]]\n' +
        '\n' +
        'Body line 1\n',
    })

    expect(getMetadataLineIndexFromBody((note: any))).toBe(false)
  })

  test('still finds legacy body line that starts with a configured project type hashtag', () => {
    preferenceValues['projectTypeTags'] = ['#project', '#area']

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        '#project @review(1w)\n' +
        '\n' +
        'Body line 1\n',
    })

    const expectedIndex = note.paragraphs.findIndex((p: any) => String(p.rawContent).startsWith('#project'))
    expect(getMetadataLineIndexFromBody((note: any))).toBe(expectedIndex)
  })

  test('still finds legacy body line that starts with #paused', () => {
    preferenceValues['projectTypeTags'] = ['#project']

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        '#paused\n' +
        '\n' +
        'Body line 1\n',
    })

    const expectedIndex = note.paragraphs.findIndex((p: any) => String(p.rawContent).startsWith('#paused'))
    expect(getMetadataLineIndexFromBody((note: any))).toBe(expectedIndex)
  })
})

describe('getProjectMetadataLineIndex', () => {
  test('returns frontmatter combined key line when body has no metadata line', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '---\n' +
        'project: #project @review(1m)\n' +
        '---\n' +
        '# Example\n' +
        '\n' +
        'Body line 1\n',
    })

    const projectLineIndex = note.paragraphs.findIndex((p: any) => String(p.rawContent).startsWith('project:'))
    expect(projectLineIndex).toBeGreaterThan(0)
    const actualIndex = getProjectMetadataLineIndex((note: any))
    expect(actualIndex).toBe(projectLineIndex)
  })

  test('cached false skips body scan but matches full call for frontmatter-only metadata', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '---\n' +
        'project: #project @review(1m)\n' +
        '---\n' +
        '# Example\n' +
        '\n' +
        'Body line 1\n',
    })

    const fullScan = getProjectMetadataLineIndex((note: any))
    const withCachedFalse = getProjectMetadataLineIndex((note: any), false)
    expect(withCachedFalse).toBe(fullScan)
    const projectLineIndex = note.paragraphs.findIndex((p: any) => String(p.rawContent).startsWith('project:'))
    expect(fullScan).toBe(projectLineIndex)
  })

  test('matches body-only helper when metadata is in the note body', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      rawContent:
        '# Example\n' +
        'project: #project @review(1w)\n' +
        '\n' +
        'Body line 1\n',
    })

    expect(getProjectMetadataLineIndex((note: any))).toBe(getMetadataLineIndexFromBody((note: any)))
  })
})
