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
  test('migrates embedded mentions from combined frontmatter into separate YAML keys when mention prefs are unset (migrateMetadataNowIfNeeded)', () => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'
    preferenceValues['ignoreChecklistsInProgress'] = true
    preferenceValues['numberDaysForFutureToIgnore'] = 0
    delete preferenceValues.startMentionStr
    delete preferenceValues.dueMentionStr
    delete preferenceValues.reviewedMentionStr
    delete preferenceValues.completedMentionStr
    delete preferenceValues.cancelledMentionStr
    delete preferenceValues.reviewIntervalMentionStr
    delete preferenceValues.nextReviewMentionStr

    const note = new Note({
      title: 'Migrate me',
      filename: 'migrate-me.md',
      content:
        '---\n' +
        'project: #area #plugin @start(2021-06-10) @review(3m) @reviewed(2025-08-30)\n' +
        '---\n' +
        '# Migrate me\n' +
        'Body line\n',
    })

    new Project((note: any), '', false, [], '', true)

    const projectLine = note.paragraphs.find((p) => String(p.content).startsWith('project:'))
    expect(projectLine?.content ?? '').not.toMatch(/@/)
    expect(projectLine?.content).toMatch(/#area/)
    expect(projectLine?.content).toMatch(/#plugin/)
    const keys = new Set(note.paragraphs.map((p) => String(p.content).split(':')[0]))
    expect(keys.has('start')).toBe(true)
    expect(keys.has('review')).toBe(true)
    expect(keys.has('reviewed')).toBe(true)
    expect(note.paragraphs.some((p) => p.content === 'start: 2021-06-10')).toBe(true)
    expect(note.paragraphs.some((p) => p.content === 'review: 3m')).toBe(true)
    expect(note.paragraphs.some((p) => p.content === 'reviewed: 2025-08-30')).toBe(true)
  })

  test('prefers embedded @start/@due/@review in combined frontmatter over body metadata when constructor migration is disabled', () => {
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

    expect(project.reviewInterval).toBe('1w')
    expect(project.startDate).toBe('2026-02-09')
    expect(project.dueDate).toBe('2026-06-30')
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
    const normalizedCombinedTags = project.getProjectTagsFrontmatterValue('project')

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
    const normalizedCombinedTags = project.getProjectTagsFrontmatterValue('metadata')

    expect(project.getLeadingProjectTag()).toBe('#project-large')
    expect(project.allProjectTags).toContain('#project-large')
    expect(project.allProjectTags).toContain('#project-small')
    expect(project.allProjectTags).toHaveLength(2)
    expect(project.allProjectTags.filter((t) => t === '#project-large')).toHaveLength(1)
    expect(normalizedCombinedTags).toContain('#project-large')
    expect(normalizedCombinedTags.includes(',')).toBe(false)
  })
})

