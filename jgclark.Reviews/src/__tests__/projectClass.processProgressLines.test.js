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

function fmBlock(lines: Array<string>, bodyLines: Array<string> = []): string {
  return `---\n${lines.join('\n')}\n---\n# Example\n#project\n${bodyLines.join('\n')}\n`
}

function setDefaultPreferences(): void {
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
}

describe('Project constructor: progress from frontmatter', () => {
  beforeEach(() => {
    global.DataStore.updateCache.mockClear()
    setDefaultPreferences()
  })

  test('reads percent from configured frontmatter key when no body progress lines exist', () => {
    preferenceValues['progressStr'] = 'this_is_progress'
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(
        ['project: #project', 'this_is_progress: 30@20260523 Started'],
        ['- [ ] Open task', '- [x] Done task'],
      ),
    })

    const project = new Project((note: any), '', false, [], '')

    expect(project.percentComplete).toBe(30)
    expect(project.lastProgressComment).toBe('Started')
  })

  test('prefers body progress lines over frontmatter when both are present', () => {
    preferenceValues['progressStr'] = 'progress'
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(
        ['project: #project', 'progress: 80@20260523 FM comment'],
        ['Progress: 40@20260523 Body comment'],
      ),
    })

    const project = new Project((note: any), '', false, [], '')

    expect(project.percentComplete).toBe(40)
    expect(project.lastProgressComment).toBe('Body comment')
  })

  test('reads default progress frontmatter key when progressStr is unset', () => {
    delete preferenceValues.progressStr
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(['project: #project', 'progress: 25@20260523 On track']),
    })

    const project = new Project((note: any), '', false, [], '')

    expect(project.percentComplete).toBe(25)
    expect(project.lastProgressComment).toBe('On track')
  })

  test('falls back to task count when frontmatter progress has no percent', () => {
    delete preferenceValues.progressStr
    const note = new Note({
      title: 'Example',
      filename: 'example.md',
      content: fmBlock(
        ['project: #project', 'progress: @20260523 Started'],
        ['- [ ] Open task', '- [x] Done task'],
      ),
    })

    const project = new Project((note: any), '', false, [], '')

    expect(project.percentComplete).toBe(50)
    expect(project.lastProgressComment).toBe('Started')
  })
})
