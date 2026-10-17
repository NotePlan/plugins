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

import {
  addNewProjectToAllProjectsListIfInScope,
  isNoteInCurrentProjectSelection,
  updateAllProjectsListAfterChange,
} from '../allProjectsListHelpers'
import { Project } from '../projectClass'
import { Note, NotePlan } from '@mocks/index'

const preferenceValues: { [string]: any } = {}
const notesByFilename: { [string]: TNote } = {}

function makeConfig(overrides: any = {}): any {
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
  const teamspaces = Array.isArray(config.includedTeamspaces) ? config.includedTeamspaces.join('\u0001') : ''
  return `${include}\u0002${ignore}\u0002${teamspaces}`
}

function makeProjectNote(filename: string, tag: string = '#project'): TNote {
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
      if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
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
    projectNoteByFilename: jest.fn((filename: string) => notesByFilename[filename] ?? null),
    noteByFilename: jest.fn(() => null),
    updateCache: jest.fn(),
  }
  global.CommandBar = { showLoading: jest.fn() }
})

beforeEach(() => {
  jest.clearAllMocks()
  reviewSettingsHolder.config = makeConfig()
  Object.keys(notesByFilename).forEach((key) => {
    delete notesByFilename[key]
  })
  global.DataStore.projectNotes = []
  global.DataStore.folders = ['/', 'Projects', 'Archive']
  global.DataStore.loadData.mockReturnValue('[]')
  global.DataStore.saveData.mockReturnValue(true)
  global.DataStore.projectNoteByFilename = jest.fn((filename: string) => notesByFilename[filename] ?? null)
  global.DataStore.preference = (key: string): any => {
    if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
    if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
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

  test('returns false for note in @Archive even when foldersToIgnore is empty', () => {
    const config = makeConfig({ foldersToInclude: [], foldersToIgnore: [] })
    reviewSettingsHolder.config = config
    global.DataStore.folders = ['/', 'Projects', '@Archive', '@Archive/Old']
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    const note = makeProjectNote('@Archive/Old/done.md')
    expect(isNoteInCurrentProjectSelection((note: any), config, '#project')).toBe(false)
  })

  test('returns false when tag is not in projectTypeTags', () => {
    const note = makeProjectNote('Projects/test.md', '#area')
    expect(isNoteInCurrentProjectSelection((note: any), makeConfig(), '#area')).toBe(false)
  })

  test('returns false when tag appears only in body tasks, not in frontmatter', () => {
    const note = new Note({
      title: 'Reviews Plugin',
      filename: 'Projects/Reviews Plugin.md',
      content:
        '---\nproject: #area\nreview: 1m\n---\n# Reviews Plugin\n* [x] type #goal bug\n+ [x] #projects and #project/company issue\n',
      hashtags: ['#area', '#goal', '#project', '#projects'],
    })
    const config = makeConfig({ projectTypeTags: ['#goal', '#project', '#area'] })
    expect(isNoteInCurrentProjectSelection((note: any), config, '#goal')).toBe(false)
    expect(isNoteInCurrentProjectSelection((note: any), config, '#project')).toBe(false)
    expect(isNoteInCurrentProjectSelection((note: any), config, '#area')).toBe(true)
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
      if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
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

describe('updateAllProjectsListAfterChange simplyDelete miss', () => {
  test('does not regenerate when simplyDelete target is already absent from the list', async () => {
    const config = makeConfig({ foldersToInclude: ['Home'], foldersToIgnore: [] })
    reviewSettingsHolder.config = config
    global.DataStore.folders = ['/', 'Home', 'Projects']
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    global.DataStore.loadData.mockReturnValue(
      JSON.stringify([
        {
          filename: 'Home/other.md',
          title: 'Other',
          allProjectTags: ['#project'],
          reviewInterval: '1w',
        },
      ]),
    )

    await updateAllProjectsListAfterChange('Home Areas/Wills for J+M.md', true, config)

    expect(global.DataStore.saveData).not.toHaveBeenCalled()
  })
})

describe('updateAllProjectsListAfterChange out-of-scope miss', () => {
  test('does not regenerate when note is missing from list and outside folder selection', async () => {
    const config = makeConfig({ foldersToInclude: ['Home'], foldersToIgnore: [] })
    reviewSettingsHolder.config = config
    global.DataStore.folders = ['/', 'Home', 'Projects']
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    // Baseline list has other projects so an accidental full regen would rewrite via saveData
    global.DataStore.loadData.mockReturnValue(
      JSON.stringify([
        {
          filename: 'Home/other.md',
          title: 'Other',
          allProjectTags: ['#project'],
          reviewInterval: '1w',
        },
      ]),
    )
    const note = makeProjectNote('Projects/out-of-scope.md')
    notesByFilename['Projects/out-of-scope.md'] = note

    await updateAllProjectsListAfterChange('Projects/out-of-scope.md', false, config)

    expect(global.DataStore.saveData).not.toHaveBeenCalled()
  })

  test('does not regenerate when teamspace note is outside includedTeamspaces', async () => {
    const teamspaceFilename =
      '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard v2.5/e571b525-968a-40eb-b658-5411e582383c'
    const config = makeConfig({
      foldersToInclude: [],
      foldersToIgnore: [],
      usePerspectives: true,
      includedTeamspaces: ['private'],
    })
    reviewSettingsHolder.config = config
    global.DataStore.folders = [
      '/',
      'Home',
      '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919',
      '%%NotePlanCloud%%/1b91b194-4c76-4a48-8d4d-4c499d64a919/Dashboard v2.5',
    ]
    global.DataStore.preference = (key: string): any => {
      if (key === 'Reviews-lastAllProjectsGenerationTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsFullScanTime') return Date.now()
      if (key === 'Reviews-lastAllProjectsPerspective') return ''
      if (key === 'Reviews-lastAllProjectsFolderFilters') return folderFilterFingerprint(config)
      return preferenceValues[key] ?? ''
    }
    global.DataStore.loadData.mockReturnValue(
      JSON.stringify([
        {
          filename: 'Home/other.md',
          title: 'Other',
          allProjectTags: ['#project'],
          reviewInterval: '1w',
        },
      ]),
    )
    const note = new Note({
      title: 'IP for more sections',
      filename: teamspaceFilename,
      content: '---\nproject: #project\n---\n# IP for more sections\n#project\n',
      hashtags: ['#project'],
      isTeamspaceNote: true,
      teamspaceID: '1b91b194-4c76-4a48-8d4d-4c499d64a919',
    })
    // getNoteFromFilename uses noteByFilename for teamspace paths
    global.DataStore.noteByFilename = jest.fn((filename: string) =>
      filename === teamspaceFilename ? note : null,
    )

    await updateAllProjectsListAfterChange(teamspaceFilename, false, config)

    expect(global.DataStore.saveData).not.toHaveBeenCalled()
  })
})
