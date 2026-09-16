// @flow
/* globals describe, expect, test */

import {
  getChangedSettingKeys,
  getSettingsUpdateAction,
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

  test('does nothing when settings are unchanged', () => {
    const { previous, current } = settingsPair({}, {})
    expect(getSettingsUpdateAction(previous, current)).toBe('none')
  })
})
