/* globals describe, expect, test, beforeAll */

import { Project } from '../projectClass'
import { Note } from '@mocks/index'

const preferenceValues: { [string]: any } = {}

beforeAll(() => {
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key] ?? '',
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
})

