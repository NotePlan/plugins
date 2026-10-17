/* globals describe, expect, test, beforeAll, beforeEach */
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

function fmBlock(lines: Array<string>): string {
  return `---\n${lines.join('\n')}\n---\n# Example\n#project\nBody\n`
}

describe('Project constructor: default review interval in frontmatter', () => {
  beforeEach(() => {
    global.DataStore.updateCache.mockClear()
  })

  beforeAll(() => {
    preferenceValues['projectMetadataFrontmatterKey'] = 'project'
    preferenceValues['startMentionStr'] = '@start'
    preferenceValues['dueMentionStr'] = '@due'
    preferenceValues['reviewedMentionStr'] = '@reviewed'
    preferenceValues['completedMentionStr'] = '@completed'
    preferenceValues['cancelledMentionStr'] = '@cancelled'
    preferenceValues['reviewIntervalMentionStr'] = '@review'
    preferenceValues['nextReviewMentionStr'] = '@nextReview'
    preferenceValues['progressStr'] = '@progress'
    preferenceValues['ignoreChecklistsInProgress'] = true
    preferenceValues['numberDaysForFutureToIgnore'] = 0
  })

  test('sets reviewInterval in memory without writing when migration is disabled', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(['project: #project']),
    })
    const contentBefore = note.content

    const project = new Project((note: any), '', false, [], '')

    expect(project.reviewInterval).toBe('1w')
    expect(note.content).toBe(contentBefore)
    expect(note.content).not.toMatch(/\breview:\s*1w\b/)
    expect(global.DataStore.updateCache).not.toHaveBeenCalled()
  })

  test('uses embedded @review interval in memory without writing when migration is disabled', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(['project: #project @start(2026-02-09) @due(2026-06-30) @review(1w)']),
    })
    const contentBefore = note.content

    const project = new Project((note: any), '', false, [], '')

    expect(project.reviewInterval).toBe('1w')
    expect(project.startDate).toBe('2026-02-09')
    expect(project.dueDate).toBe('2026-06-30')
    expect(note.content).toBe(contentBefore)
    expect(global.DataStore.updateCache).not.toHaveBeenCalled()
  })

  test('writes review: 1w when migrateMetadataNowIfNeeded is true and review key is absent', () => {
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(['project: #project']),
    })

    const project = new Project((note: any), '', false, [], '', true)

    expect(project.reviewInterval).toBe('1w')
    expect(note.content).toMatch(/^---\n[\s\S]*\breview:\s*1w\b[\s\S]*\n---\n/m)
    expect(global.DataStore.updateCache).toHaveBeenCalledWith(note, true)
  })
})
