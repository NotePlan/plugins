// @flow
/* globals describe, expect, test, jest, beforeAll, beforeEach */
/* eslint-disable import/first */

jest.mock('../../../np.Shared/src/notesChangedRecentlyCache.js', () => ({
  updateNotesChangedRecentlyCacheIfTooOld: jest.fn(() => Promise.resolve(false)),
  isNotesChangedRecentlyCacheGenerationScheduled: jest.fn(() => false),
  generateNotesChangedRecentlyCache: jest.fn(() => Promise.resolve()),
  getFilenamesChangedSince: jest.fn(() => []),
}))

jest.mock('../reviewHelpers', () => {
  const actual = jest.requireActual<any>('../reviewHelpers')
  return {
    ...actual,
    updateRichProjectListIfOpen: jest.fn(() => Promise.resolve()),
    updateDashboardIfOpen: jest.fn(() => Promise.resolve()),
  }
})

import { NotePlan } from '@mocks/index'
import { shouldUseFullAllProjectsGenerate } from '../allProjectsListHelpers'

const preferenceValues: { [string]: any } = {}

function makeConfig(overrides: any = {}): any {
  return {
    projectTypeTags: ['#project'],
    foldersToInclude: [],
    foldersToIgnore: [],
    usePerspectives: false,
    perspectiveName: '',
    includedTeamspaces: ['private'],
    nextActionTags: [],
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

beforeAll(() => {
  global.NotePlan = new NotePlan()
  global.Editor = { note: null }
  global.DataStore = {
    preference: (key: string): any => preferenceValues[key],
    fileExists: jest.fn(() => true),
    loadData: jest.fn(() => JSON.stringify([{ filename: 'Projects/A.md', allProjectTags: ['#project'] }])),
    saveData: jest.fn(() => true),
    setPreference: jest.fn((key: string, value: any) => {
      preferenceValues[key] = value
    }),
    folders: ['/', 'Projects'],
    projectNotes: [],
    updateCache: jest.fn(),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  Object.keys(preferenceValues).forEach((k) => {
    delete preferenceValues[k]
  })
  const config = makeConfig()
  preferenceValues['Reviews-lastAllProjectsGenerationTime'] = Date.now()
  preferenceValues['Reviews-lastAllProjectsFullScanTime'] = Date.now()
  preferenceValues['Reviews-lastAllProjectsPerspective'] = ''
  preferenceValues['Reviews-lastAllProjectsFolderFilters'] = folderFilterFingerprint(config)
  global.DataStore.fileExists = jest.fn(() => true)
  global.DataStore.loadData = jest.fn(() =>
    JSON.stringify([{ filename: 'Projects/A.md', allProjectTags: ['#project'] }]),
  )
})

describe('shouldUseFullAllProjectsGenerate', () => {
  test('forceFullGenerate always true', () => {
    expect(shouldUseFullAllProjectsGenerate(makeConfig(), true)).toBe(true)
  })

  test('missing file requires full', () => {
    global.DataStore.fileExists = jest.fn(() => false)
    expect(shouldUseFullAllProjectsGenerate(makeConfig())).toBe(true)
  })

  test('empty baseline requires full', () => {
    global.DataStore.loadData = jest.fn(() => '[]')
    expect(shouldUseFullAllProjectsGenerate(makeConfig())).toBe(true)
  })

  test('folder fingerprint change requires full', () => {
    preferenceValues['Reviews-lastAllProjectsFolderFilters'] = 'old'
    expect(shouldUseFullAllProjectsGenerate(makeConfig({ foldersToInclude: ['Projects'] }))).toBe(true)
  })

  test('full scan older than 24h requires full', () => {
    preferenceValues['Reviews-lastAllProjectsFullScanTime'] = Date.now() - 25 * 60 * 60 * 1000
    expect(shouldUseFullAllProjectsGenerate(makeConfig())).toBe(true)
  })

  test('fresh full scan and matching fingerprint allows incremental', () => {
    expect(shouldUseFullAllProjectsGenerate(makeConfig())).toBe(false)
  })

  test('never full-scanned requires full', () => {
    delete preferenceValues['Reviews-lastAllProjectsFullScanTime']
    expect(shouldUseFullAllProjectsGenerate(makeConfig())).toBe(true)
  })
})
