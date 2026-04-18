/* globals describe, expect, test, beforeAll, jest */
// @flow

import { Project } from '../projectClass'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
    updateCache: jest.fn(),
  }
})

describe('Project constructor: embedded combined mentions', () => {
  test('extracts embedded @start/@due/@review from project frontmatter', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'
    preferenceValues['startMentionStr'] = '@start'
    preferenceValues['dueMentionStr'] = '@due'
    preferenceValues['reviewedMentionStr'] = '@reviewed'
    preferenceValues['completedMentionStr'] = '@completed'
    preferenceValues['cancelledMentionStr'] = '@cancelled'
    preferenceValues['reviewIntervalMentionStr'] = '@review'
    preferenceValues['nextReviewMentionStr'] = '@nextReview'
    preferenceValues['ignoreChecklistsInProgress'] = true
    preferenceValues['numberDaysForFutureToIgnore'] = 0

    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content:
        '---\n' +
        'project: #project @start(2026-02-09) @due(2026-06-30) @review(1w)\n' +
        '---\n' +
        '# Example\n' +
        '#project\n' +
        'Body line\n',
    })

    const project = new Project((note: any), '', false, [], '')

    expect(project.startDate).toBe('2026-02-09')
    expect(project.dueDate).toBe('2026-06-30')
    expect(project.reviewInterval).toBe('1w')
  })

  test('keeps slash-style project tags in combined frontmatter', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'
    preferenceValues['ignoreChecklistsInProgress'] = true
    preferenceValues['numberDaysForFutureToIgnore'] = 0

    const note = new Note({
      title: 'Slash Tag',
      filename: 'slash-tag.md',
      content:
        '---\n' +
        'project: #project/large #project/large,\n' +
        '---\n' +
        '# Slash Tag\n' +
        'Body line\n',
    })

    const project = new Project((note: any), '', false, [], '')
    const normalizedCombinedTags = project.getCombinedProjectTagsFrontmatterValue('project')

    expect(project.getLeadingProjectTag()).toBe('#project/large')
    expect(project.allProjectTags).toContain('#project/large')
    expect(project.allProjectTags.filter((t) => t === '#project/large')).toHaveLength(1)
    expect(normalizedCombinedTags).toContain('#project/large')
    expect(normalizedCombinedTags.includes(',')).toBe(false)
  })

  test('keeps hyphen-style project tags in combined frontmatter', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'metadata'
    preferenceValues['ignoreChecklistsInProgress'] = true
    preferenceValues['numberDaysForFutureToIgnore'] = 0

    const note = new Note({
      title: 'Hyphen Tag',
      filename: 'hyphen-tag.md',
      content:
        '---\n' +
        'metadata: #project-large, #project-small\n' +
        '---\n' +
        '# Hyphen Tag\n' +
        'Body line\n',
    })

    const project = new Project((note: any), '', false, [], '')
    const normalizedCombinedTags = project.getCombinedProjectTagsFrontmatterValue('metadata')

    expect(project.getLeadingProjectTag()).toBe('#project-large')
    expect(project.allProjectTags).toContain('#project-large')
    expect(project.allProjectTags).toContain('#project-small')
    expect(project.allProjectTags).toHaveLength(2)
    expect(project.allProjectTags.filter((t) => t === '#project-large')).toHaveLength(1)
    expect(normalizedCombinedTags).toContain('#project-large')
    expect(normalizedCombinedTags.includes(',')).toBe(false)
  })
})

