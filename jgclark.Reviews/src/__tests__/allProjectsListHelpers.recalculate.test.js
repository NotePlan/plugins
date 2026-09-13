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
import { recalculateAllProjectsListItems } from '../allProjectsListHelpers'

const preferenceValues: { [string]: any } = {}
const notesByFilename: { [string]: TNote } = {}

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

function makeListRow(filename: string, tag: string = '#project'): any {
  return {
    filename,
    title: filename,
    folder: 'Projects',
    allProjectTags: [tag],
    nextActionsRawContent: [],
    percentComplete: 0,
  }
}

beforeAll(() => {
  global.NotePlan = new NotePlan()
  global.Editor = { note: null }
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
    folders: ['/', 'Projects'],
    projectNotes: [],
    projectNoteByFilename: jest.fn((filename: string) => notesByFilename[filename] ?? null),
    noteByFilename: jest.fn(() => null),
    updateCache: jest.fn(),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  reviewSettingsHolder.config = makeConfig()
  Object.keys(notesByFilename).forEach((key) => {
    delete notesByFilename[key]
  })
  global.DataStore.projectNotes = []
  global.DataStore.loadData.mockReturnValue('[]')
  global.DataStore.saveData.mockReturnValue(true)
  global.DataStore.preference = (key: string): any => {
    if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
    if (key === 'Reviews-lastAllProjectsPerspective') return ''
    if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(reviewSettingsHolder.config)
    return preferenceValues[key] ?? ''
  }
})

describe('recalculateAllProjectsListItems', () => {
  test('re-parses existing list rows without enumerating DataStore.projectNotes', async () => {
    const noteA = makeProjectNote('Projects/one.md')
    const noteB = makeProjectNote('Projects/two.md')
    notesByFilename['Projects/one.md'] = noteA
    notesByFilename['Projects/two.md'] = noteB
    global.DataStore.loadData.mockReturnValue(JSON.stringify([
      makeListRow('Projects/one.md'),
      makeListRow('Projects/two.md'),
    ]))

    const rebuilt = await recalculateAllProjectsListItems(reviewSettingsHolder.config, false, 0, true, true)

    expect(rebuilt).toHaveLength(2)
    expect(rebuilt.map((project) => project.filename).sort()).toEqual(['Projects/one.md', 'Projects/two.md'])
    expect(global.DataStore.saveData).toHaveBeenCalledTimes(1)
    const saved = JSON.parse(global.DataStore.saveData.mock.calls[0][0])
    expect(saved).toHaveLength(2)
    expect(global.DataStore.projectNotes).toEqual([])
  })

  test('keeps the previous row when a listed note cannot be loaded', async () => {
    notesByFilename['Projects/one.md'] = makeProjectNote('Projects/one.md')
    global.DataStore.loadData.mockReturnValue(JSON.stringify([
      makeListRow('Projects/one.md'),
      makeListRow('Projects/missing.md'),
    ]))

    const rebuilt = await recalculateAllProjectsListItems(reviewSettingsHolder.config, false, 0, true, true)

    expect(rebuilt).toHaveLength(2)
    expect(rebuilt.map((project) => project.filename).sort()).toEqual(['Projects/missing.md', 'Projects/one.md'])
  })
})
