// @flow
/* globals describe, expect, test, jest, beforeAll, beforeEach */
/* eslint-disable import/first */

const reviewSettingsHolder: { config: any } = { config: null }

jest.mock('../reviewHelpers', () => {
  const actual = jest.requireActual('../reviewHelpers')
  return {
    ...actual,
    updateRichProjectListIfOpen: jest.fn(() => Promise.resolve()),
    updateDashboardIfOpen: jest.fn(() => Promise.resolve()),
    getReviewSettings: jest.fn(() => Promise.resolve(reviewSettingsHolder.config)),
  }
})

import { Note, NotePlan } from '@mocks/index'
import {
  addNewProjectToAllProjectsListIfInScope,
  isNoteInCurrentProjectSelection,
} from '../allProjectsListHelpers'
import { Project } from '../projectClass'

const preferenceValues: { [string]: any } = {}

function makeConfig(overrides: { [string]: any } = {}): any {
  return {
    projectTypeTags: ['#project'],
    foldersToInclude: [],
    foldersToIgnore: [],
    usePerspectives: false,
    includedTeamspaces: ['private'],
    nextActionTags: [],
    sequentialTag: '#sequential',
    ...overrides,
  }
}

function folderFilterFingerprint(config: any): string {
  const include = Array.isArray(config.foldersToInclude) ? config.foldersToInclude.join('\u0001') : ''
  const ignore = Array.isArray(config.foldersToIgnore) ? config.foldersToIgnore.join('\u0001') : ''
  return `${include}\u0002${ignore}`
}

function makeProjectNote(filename: string, tag: string = '#project'): Note {
  return new Note({
    title: 'Test project',
    filename,
    content: `---\nproject: ${tag}\n---\n# Test\n${tag}\n`,
    hashtags: [tag],
  })
}

beforeAll(() => {
  global.NotePlan = new NotePlan()
  global.Editor = { note: null }
  preferenceValues['projectMetadataFrontmatterKey'] = 'project'
  preferenceValues['startMentionStr'] = '@start'
  preferenceValues['dueMentionStr'] = '@due'
  preferenceValues['reviewedMentionStr'] = '@reviewed'
  preferenceValues['completedMentionStr'] = '@completed'
  preferenceValues['cancelledMentionStr'] = '@cancelled'
  preferenceValues['reviewIntervalMentionStr'] = '@review'
  preferenceValues['nextReviewMentionStr'] = '@nextReview'
  preferenceValues['progressStr'] = 'progress'
  preferenceValues['ignoreChecklistsInProgress'] = true
  preferenceValues['numberDaysForFutureToIgnore'] = 0

  global.DataStore = {
    preference: (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(makeConfig())
      return preferenceValues[key] ?? ''
    },
    fileExists: jest.fn(() => true),
    loadData: jest.fn(() => '[]'),
    saveData: jest.fn(() => true),
    setPreference: jest.fn(),
    folders: ['/', 'Projects', 'Archive'],
    projectNotes: [],
    updateCache: jest.fn(),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  reviewSettingsHolder.config = makeConfig()
  global.DataStore.loadData.mockReturnValue('[]')
  global.DataStore.saveData.mockReturnValue(true)
  global.DataStore.preference = (key: string): any => {
    if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
    if (key === 'Reviews-lastAllProjectsPerspective') return ''
    if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(reviewSettingsHolder.config)
    return preferenceValues[key] ?? ''
  }
})

describe('isNoteInCurrentProjectSelection', () => {
  test('returns true for note in included folder with matching tag', () => {
    const note = makeProjectNote('Projects/test.md')
    expect(isNoteInCurrentProjectSelection((note: any), makeConfig(), '#project')).toBe(true)
  })

  test('returns false for note in ignored folder branch', () => {
    const config = makeConfig({ foldersToInclude: [], foldersToIgnore: ['Archive'] })
    reviewSettingsHolder.config = config
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    const note = makeProjectNote('Archive/old.md')
    expect(isNoteInCurrentProjectSelection((note: any), config, '#project')).toBe(false)
  })

  test('returns false when tag is not in projectTypeTags', () => {
    const note = makeProjectNote('Projects/test.md', '#area')
    expect(isNoteInCurrentProjectSelection((note: any), makeConfig(), '#area')).toBe(false)
  })
})

describe('addNewProjectToAllProjectsListIfInScope', () => {
  test('Project constructor succeeds for mock converted note', () => {
    const note = makeProjectNote('Projects/new-project.md')
    expect(() => new Project((note: any), '#project', true, [], '', false)).not.toThrow()
  })

  test('appends one project row when note is in scope', async () => {
    const note = makeProjectNote('Projects/new-project.md')
    const config = makeConfig()

    const added = await addNewProjectToAllProjectsListIfInScope((note: any), '#project', config)

    expect(added).toBe(true)
    expect(global.DataStore.saveData).toHaveBeenCalledTimes(1)
    const savedPayload = global.DataStore.saveData.mock.calls[0][0]
    const parsed = JSON.parse(savedPayload)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].filename).toBe('Projects/new-project.md')
  })

  test('returns false without writing when note is out of scope', async () => {
    const config = makeConfig({ foldersToInclude: ['/'], foldersToIgnore: [] })
    reviewSettingsHolder.config = config
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    const note = makeProjectNote('Projects/new-project.md')

    const added = await addNewProjectToAllProjectsListIfInScope((note: any), '#project', config)

    expect(added).toBe(false)
    expect(global.DataStore.saveData).not.toHaveBeenCalled()
  })

  test('replaces existing row for same filename and tag', async () => {
    const existingRow = {
      filename: 'Projects/existing.md',
      title: 'Old title',
      allProjectTags: ['#project'],
      reviewInterval: '1w',
    }
    global.DataStore.loadData.mockReturnValue(JSON.stringify([existingRow]))
    const note = makeProjectNote('Projects/existing.md')

    const added = await addNewProjectToAllProjectsListIfInScope((note: any), '#project', makeConfig())

    expect(added).toBe(true)
    const parsed = JSON.parse(global.DataStore.saveData.mock.calls[0][0])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].filename).toBe('Projects/existing.md')
    expect(parsed[0].title).toBe('Test project')
  })
})
