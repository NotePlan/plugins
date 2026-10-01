// @flow
/* globals describe, expect, test, jest, beforeAll, beforeEach */
/* eslint-disable import/first */

const reviewSettingsHolder: { config: any } = { config: null }

jest.mock('../reviewHelpers', () => {
  const actual = jest.requireActual<any>('../reviewHelpers')
  return {
    ...actual,
    updateRichProjectListIfOpen: jest.fn(() => Promise.resolve()),
    updateDashboardIfOpen: jest.fn(() => Promise.resolve()),
  }
})

jest.mock('../reviewSettings', () => {
  const actual = jest.requireActual<any>('../reviewSettings')
  return {
    ...actual,
    getReviewSettings: jest.fn(() => Promise.resolve(reviewSettingsHolder.config)),
  }
})

import { Note, NotePlan } from '@mocks/index'
import { updateDashboardIfOpen, updateRichProjectListIfOpen } from '../reviewHelpers'
import { getAllProjectsFromList } from '../allProjectsListHelpers'

const preferenceValues: { [string]: any } = {}

function makeConfig(overrides: any = {}): any {
  return {
    projectTypeTags: ['#project'],
    foldersToInclude: [],
    foldersToIgnore: [],
    usePerspectives: false,
    includedTeamspaces: ['private'],
    nextActionTags: ['#na'],
    sequentialTag: '#sequential',
    ...overrides,
  }
}

function folderFilterFingerprint(config: any): string {
  const include = Array.isArray(config.foldersToInclude) ? config.foldersToInclude.join('\u0001') : ''
  const ignore = Array.isArray(config.foldersToIgnore) ? config.foldersToIgnore.join('\u0001') : ''
  const teamspaces = Array.isArray(config.includedTeamspaces) ? config.includedTeamspaces.join('\u0001') : ''
  return `${include}\u0002${ignore}\u0002${teamspaces}`
}

function makeProjectNote(filename: string, tag: string = '#project'): TNote {
  return new Note({
    title: filename.replace(/\//g, ' '),
    filename,
    content: `---\nproject: ${tag}\n---\n# Test\n${tag}\n- [ ] first task #na\n`,
    hashtags: [tag],
  })
}

beforeAll(() => {
  global.NotePlan = new NotePlan()
  global.CommandBar = { showLoading: jest.fn() }
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
    preference: (key: string): any => preferenceValues[key] ?? '',
    fileExists: jest.fn(() => false),
    loadData: jest.fn(() => '[]'),
    saveData: jest.fn(() => true),
    setPreference: jest.fn(),
    folders: ['/', 'Projects'],
    projectNotes: [],
    projectNoteByFilename: jest.fn(() => null),
    noteByFilename: jest.fn(() => null),
    updateCache: jest.fn(),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  reviewSettingsHolder.config = makeConfig()
  global.DataStore.projectNotes = []
  global.DataStore.fileExists.mockReturnValue(false)
  global.DataStore.loadData.mockReturnValue('[]')
  global.DataStore.saveData.mockReturnValue(true)
  global.Editor = { note: null, filename: '' }
  global.DataStore.preference = (key: string): any => {
    if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
    if (key === 'Reviews-lastAllProjectsPerspective') return ''
    if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(reviewSettingsHolder.config)
    return preferenceValues[key] ?? ''
  }
})

describe('getAllProjectsFromList progress', () => {
  test('a missing list shows progress, skips Dashboard and Rich refresh, and does not read Editor', async () => {
    const note = makeProjectNote('Projects/one.md')
    const editorNote = makeProjectNote('Projects/one.md')
    global.Editor = { note: editorNote, filename: 'Projects/one.md' }
    global.DataStore.projectNotes = [note]

    const projects = await getAllProjectsFromList()

    expect(projects).toHaveLength(1)
    expect(projects[0].note).toBe(note)
    expect(projects[0].note).not.toBe(editorNote)
    expect(global.CommandBar.showLoading).toHaveBeenCalled()
    expect(updateDashboardIfOpen).not.toHaveBeenCalled()
    expect(updateRichProjectListIfOpen).not.toHaveBeenCalled()
  })

  test('a fresh list does not show the progress dialog', async () => {
    global.DataStore.fileExists.mockReturnValue(true)
    global.DataStore.loadData.mockReturnValue(JSON.stringify([
      {
        filename: 'Projects/one.md',
        title: 'Projects one.md',
        folder: 'Projects',
        allProjectTags: ['#project'],
        nextActionsRawContent: [],
        percentComplete: 0,
      },
    ]))

    const projects = await getAllProjectsFromList()

    expect(projects).toHaveLength(1)
    expect(global.CommandBar.showLoading).not.toHaveBeenCalled()
    expect(global.DataStore.saveData).not.toHaveBeenCalled()
    expect(updateDashboardIfOpen).not.toHaveBeenCalled()
    expect(updateRichProjectListIfOpen).not.toHaveBeenCalled()
  })
})
