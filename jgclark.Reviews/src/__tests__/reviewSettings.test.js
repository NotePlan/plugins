// @flow
/* globals describe, expect, test, jest, afterEach */
/* eslint-disable import/first */

jest.mock('../../../jgclark.Dashboard/src/perspectiveHelpers', () => ({
  getActivePerspectiveDef: jest.fn(),
  loadPerspectiveDefsFromPluginSettings: jest.fn(() => Promise.resolve([])),
}))

import { getActivePerspectiveDef, loadPerspectiveDefsFromPluginSettings } from '../../../jgclark.Dashboard/src/perspectiveHelpers'
import { METADATA_TERM_SETTINGS_FOR_RENAME } from '../projectStatus'
import {
  getChangedSettingKeys,
  getReviewSettings,
  getSettingsUpdateAction,
  settingsChangeIsOnlyMetadataTermRenames,
} from '../reviewSettings'

/**
 * Minimal raw settings pair for classifier tests.
 * @param {Object} previousPartial
 * @param {Object} currentPartial
 * @returns {{ previous: { [string]: any }, current: { [string]: any } }}
 */
function settingsPair(previousPartial: Object, currentPartial: Object): { previous: { [string]: any }, current: { [string]: any } } {
  const base = {
    projectTypeTags: ['#project', '#area'],
    usePerspectives: false,
    foldersToInclude: ['Projects'],
    foldersToIgnore: ['Reviews'],
    startMentionStr: 'start',
    outputStyle: 'Rich',
    displayOrder: 'title',
    displayFinished: false,
    confirmNextReview: false,
    _logLevel: 'INFO',
    nextActionTags: ['#na'],
  }
  return {
    previous: { ...base, ...previousPartial },
    current: { ...base, ...currentPartial },
  }
}

describe('getChangedSettingKeys', () => {
  test('returns empty when either side is missing', () => {
    expect(getChangedSettingKeys(null, { a: 1 })).toEqual([])
    expect(getChangedSettingKeys({ a: 1 }, null)).toEqual([])
  })

  test('detects primitive and array changes', () => {
    const { previous, current } = settingsPair({}, { displayFinished: true, projectTypeTags: ['#project'] })
    const changed = getChangedSettingKeys(previous, current).sort()
    expect(changed).toEqual(['displayFinished', 'projectTypeTags'])
  })
})

describe('getSettingsUpdateAction', () => {
  test('rebuilds when there is no previous snapshot', () => {
    expect(getSettingsUpdateAction(null, { outputStyle: 'Rich' })).toBe('rebuild')
    expect(getSettingsUpdateAction({ outputStyle: 'Rich' }, null)).toBe('rebuild')
  })

  test('rebuilds when a review-scope setting changes', () => {
    const { previous, current } = settingsPair({}, { foldersToInclude: ['Work'] })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('rebuilds when a metadata-term setting changes', () => {
    const { previous, current } = settingsPair({ startMentionStr: 'start' }, { startMentionStr: 'begun' })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('rebuilds when both rebuild and redisplay keys change', () => {
    const { previous, current } = settingsPair({}, { usePerspectives: true, displayOrder: 'due' })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('redisplays when only a project-list display setting changes', () => {
    const { previous, current } = settingsPair({}, { reviewsTheme: 'Solarized Light', displayGroupedByFolder: true })
    expect(getSettingsUpdateAction(previous, current)).toBe('redisplay')
  })

  test('rebuilds when both rebuild and recalculate keys change', () => {
    const { previous, current } = settingsPair({}, { foldersToInclude: ['Work'], nextActionTags: ['#next'] })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('recalculates when a next-action or progress-calculation setting changes', () => {
    const { previous, current } = settingsPair({}, { nextActionTags: ['#next'], ignoreChecklistsInProgress: false })
    expect(getSettingsUpdateAction(previous, current)).toBe('recalculate')
  })

  test('recalculates when both recalculate and redisplay keys change', () => {
    const { previous, current } = settingsPair({}, { sequentialTag: '#seq', displayOrder: 'due' })
    expect(getSettingsUpdateAction(previous, current)).toBe('recalculate')
  })

  test('does nothing when only unrelated settings change', () => {
    const { previous, current } = settingsPair({}, { _logLevel: 'DEBUG', confirmNextReview: true })
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })

  test('does nothing when only the log regex changes', () => {
    const { previous, current } = settingsPair({}, { _logFunctionRE: 'onSettingsUpdated' })
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })

  test('does nothing when only the log timer changes', () => {
    const { previous, current } = settingsPair({}, { _logTimer: true })
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })

  test('rebuilds when a metadata-term setting changes alongside the log regex and timer', () => {
    const { previous, current } = settingsPair({}, { startMentionStr: 'begun', _logFunctionRE: '.*', _logTimer: false })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('does nothing when only another command setting changes', () => {
    const { previous, current } = settingsPair({}, {
      weeklyProjectProgressBulletSummary: 'Table by sub-folder',
      archiveFolder: 'Archive',
      removeDueDatesOnPause: false,
    })
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })

  test('still rebuilds when a project-list scope setting changes alongside another command', () => {
    const { previous, current } = settingsPair({}, {
      foldersToInclude: ['Work'],
      weeklyProjectProgressHeading: '## Progress',
    })
    expect(getSettingsUpdateAction(previous, current)).toBe('rebuild')
  })

  test('does nothing when settings are unchanged', () => {
    const { previous, current } = settingsPair({}, {})
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })
})

describe('settingsChangeIsOnlyMetadataTermRenames', () => {
  test('true when only metadata-term keys change', () => {
    const { previous, current } = settingsPair(
      { pausedMentionStr: 'paused', startMentionStr: 'start' },
      { pausedMentionStr: 'onhold', startMentionStr: 'begun' },
    )
    expect(settingsChangeIsOnlyMetadataTermRenames(previous, current, METADATA_TERM_SETTINGS_FOR_RENAME)).toBe(true)
  })

  test('false when a non-term rebuild key also changes', () => {
    const { previous, current } = settingsPair(
      { pausedMentionStr: 'paused' },
      { pausedMentionStr: 'onhold', foldersToInclude: ['Work'] },
    )
    expect(settingsChangeIsOnlyMetadataTermRenames(previous, current, METADATA_TERM_SETTINGS_FOR_RENAME)).toBe(false)
  })

  test('false when only display settings change', () => {
    const { previous, current } = settingsPair({}, { displayOrder: 'due' })
    expect(settingsChangeIsOnlyMetadataTermRenames(previous, current, METADATA_TERM_SETTINGS_FOR_RENAME)).toBe(false)
  })
})

describe('getReviewSettings', () => {
  const store: any = DataStore
  const originalLoadJSON = store.loadJSON
  const originalSetPreference = store.setPreference

  afterEach(() => {
    store.loadJSON = originalLoadJSON
    store.setPreference = originalSetPreference
  })

  /**
   * @param {Object} overrides
   * @returns {Object}
   */
  function rawSettings(overrides: Object = {}): { [string]: mixed } {
    return {
      usePerspectives: false,
      foldersToInclude: ['Projects'],
      foldersToIgnore: ['Archive'],
      includedTeamspaces: ['private'],
      startMentionStr: 'started',
      completedMentionStr: 'completed',
      cancelledMentionStr: 'cancelled',
      dueMentionStr: 'due',
      reviewIntervalMentionStr: 'review',
      reviewedMentionStr: 'reviewed',
      nextReviewMentionStr: 'nextReview',
      progressStr: 'progress',
      projectTypeTags: ['#project'],
      ...overrides,
    }
  }

  test('does not mutate the object loadJSON returned when overlaying a perspective and filling defaults', async () => {
    const loaded = rawSettings({
      usePerspectives: true,
      useProjectStatus: true,
    })
    delete loaded.projectMetadataFrontmatterKey
    delete loaded.FFlag_UseCacheOfAllPerspectives
    delete loaded.notstartedMentionStr
    delete loaded.pausedMentionStr
    delete loaded.hiddenStatusTags
    delete loaded.displayPaused
    delete loaded.autoUpdateAfterIdleTime
    delete loaded.reviewsTheme
    delete loaded.hiddenProjectTypeTags
    const before = JSON.parse(JSON.stringify(loaded))
    const loadPerspectives: any = loadPerspectiveDefsFromPluginSettings
    const getActive: any = getActivePerspectiveDef
    loadPerspectives.mockResolvedValue([{ name: 'Work' }])
    getActive.mockReturnValue({
      name: 'Work',
      dashboardSettings: {
        includedFolders: 'Work,Home',
        excludedFolders: 'Archive',
        includedTeamspaces: ['team-1'],
      },
    })
    store.loadJSON = jest.fn(() => Promise.resolve(loaded))
    store.setPreference = jest.fn()

    const config = await getReviewSettings()
    if (config == null) {
      throw new Error('getReviewSettings returned null')
    }

    expect(loaded).toEqual(before)
    expect(config).not.toBe(loaded)
    expect(config.foldersToInclude).toEqual(['Work', 'Home'])
    expect(config.foldersToIgnore).toEqual(['Archive'])
    expect(config.includedTeamspaces).toEqual(['team-1'])
    expect(config.perspectiveName).toBe('Work')
    expect(config.projectMetadataFrontmatterKey).toBe('project')
    expect(config.FFlag_UseCacheOfAllPerspectives).toBe(false)
    expect(config.notstartedMentionStr).toBe('notstarted')
    expect(config.pausedMentionStr).toBe('paused')
    expect(config.hiddenStatusTags).toEqual(['#completed', '#cancelled'])
    expect(config.displayPaused).toBe(true)
    expect(config.hiddenProjectTypeTags).toEqual([])
    expect(config.autoUpdateAfterIdleTime).toBe(0)
    expect(config.reviewsTheme).toBe('')
    expect(store.setPreference).toHaveBeenCalledWith('projectMetadataFrontmatterKey', 'project')
    expect(store.setPreference).toHaveBeenCalledWith('useProjectStatus', true)
  })

  test('does not mutate the object loadJSON returned when perspectives are off', async () => {
    const loaded = rawSettings({
      usePerspectives: false,
      includedTeamspaces: ['team-x'],
    })
    const before = JSON.parse(JSON.stringify(loaded))
    store.loadJSON = jest.fn(() => Promise.resolve(loaded))
    store.setPreference = jest.fn()

    const config = await getReviewSettings()
    if (config == null) {
      throw new Error('getReviewSettings returned null')
    }

    expect(loaded).toEqual(before)
    expect(config).not.toBe(loaded)
    expect(config.includedTeamspaces).toEqual(['private'])
    expect(config.foldersToInclude).toEqual(['Projects'])
    expect(loaded.includedTeamspaces).toEqual(['team-x'])
  })
})
