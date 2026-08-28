/* globals beforeAll, describe, expect, test */
// @flow

import {
  getMatchingProjectTypeTagsOnNote,
  getProjectTypeTagsFromNoteMetadata,
  noteHasProjectTypeTag,
} from '../reviewHelpers'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  // eslint-disable-next-line no-global-assign
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
  }
  preferenceValues['projectMetadataFrontmatterKey'] = 'project'
})

describe('getProjectTypeTagsFromNoteMetadata', () => {
  test('reads project type from frontmatter only', () => {
    const note = new Note({
      title: 'Area note',
      filename: 'Areas/test.md',
      rawContent:
        '---\n' +
        'project: #area\n' +
        'review: 1m\n' +
        '---\n' +
        '# Area note\n' +
        '* [x] Fix bug with type #goal in log @done(2023-01-01)\n' +
        '* [x] Nested #projects and #project/company issue @done(2023-01-02)\n',
    })

    expect(getProjectTypeTagsFromNoteMetadata((note: any))).toEqual(['#area'])
  })

  test('includes legacy body metadata line when no frontmatter project key', () => {
    const note = new Note({
      title: 'Legacy',
      filename: 'Projects/legacy.md',
      rawContent: '# Legacy\nproject: #project @review(1w)\n\nBody\n',
    })

    expect(getProjectTypeTagsFromNoteMetadata((note: any))).toEqual(['#project'])
  })

  test('merges frontmatter and body metadata tags without duplicates', () => {
    const note = new Note({
      title: 'Both',
      filename: 'Projects/both.md',
      rawContent:
        '---\n' +
        'project: #area\n' +
        '---\n' +
        '# Both\n' +
        'project: #area #sequential\n',
    })

    expect(getProjectTypeTagsFromNoteMetadata((note: any))).toEqual(['#area', '#sequential'])
  })
})

describe('getMatchingProjectTypeTagsOnNote', () => {
  test('returns configured tags present in metadata, in config order', () => {
    const note = new Note({
      title: 'Multi',
      filename: 'Projects/multi.md',
      rawContent: '---\nproject: #area #project\n---\n# Multi\n',
    })

    expect(getMatchingProjectTypeTagsOnNote((note: any), ['#goal', '#project', '#area'])).toEqual(['#project', '#area'])
  })

  test('ignores body hashtags not in metadata', () => {
    const note = new Note({
      title: 'Reviews Plugin',
      filename: 'Notes/Plugins/Reviews Plugin.md',
      rawContent:
        '---\n' +
        'project: #area\n' +
        '---\n' +
        '# Reviews Plugin\n' +
        '* [x] type #goal bug @done(2023-11-10)\n' +
        '+ [x] #projects and #project/company nested hashtag bug\n',
    })

    expect(getMatchingProjectTypeTagsOnNote((note: any), ['#goal', '#project', '#area'])).toEqual(['#area'])
    expect(noteHasProjectTypeTag((note: any), '#goal')).toBe(false)
    expect(noteHasProjectTypeTag((note: any), '#project')).toBe(false)
    expect(noteHasProjectTypeTag((note: any), '#area')).toBe(true)
  })
})
