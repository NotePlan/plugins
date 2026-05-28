// @flow
/* eslint-disable flowtype/require-valid-file-annotation */
/* globals describe, it, expect */

import {
  cleanDashboardSettingsInAPerspective,
  getWantedTagNamesFromSettings,
  isDashboardGlobalOnlySettingsDiff,
  isDashboardGlobalSettingKey,
  isTagCacheEnabled,
  removeStaleTagSections,
  syncTagSectionsWithSettings,
} from '../src/dashboardSettingsClean'
import { getDashboardSettingsDefaults } from '../src/dashboardHelpers'
import { getPerspectiveLiveVsSavedDiff, mergeDashboardSettingsForPerspectiveDef } from '../src/perspectiveHelpers'

describe('getWantedTagNamesFromSettings', () => {
  it('returns tag names from tagsToShow', () => {
    expect([...getWantedTagNamesFromSettings({ tagsToShow: '@friend, @work' })]).toEqual(['@friend', '@work'])
  })

  it('returns empty set when tagsToShow is empty', () => {
    expect(getWantedTagNamesFromSettings({ tagsToShow: '' }).size).toBe(0)
  })
})

describe('removeStaleTagSections', () => {
  const baseSettings = {
    tagsToShow: '@friend',
    showTagSection_friend: true,
  }

  it('removes TAG sections whose name is not in tagsToShow', () => {
    const sections = [
      { ID: 'TAG_0', sectionCode: 'TAG', name: '@father', sectionItems: [] },
      { ID: 'DT', sectionCode: 'DT', name: 'Today', sectionItems: [] },
    ]
    const result = removeStaleTagSections(sections, baseSettings)
    expect(result.map((s) => s.ID)).toEqual(['DT'])
  })

  it('keeps TAG sections listed in tagsToShow', () => {
    const sections = [
      { ID: 'TAG_0', sectionCode: 'TAG', name: '@friend', sectionItems: [] },
      { ID: 'DT', sectionCode: 'DT', name: 'Today', sectionItems: [] },
    ]
    const result = removeStaleTagSections(sections, baseSettings)
    expect(result.map((s) => s.ID)).toEqual(['TAG_0', 'DT'])
  })

  it('removes all TAG sections when tagsToShow is empty', () => {
    const sections = [{ ID: 'TAG_0', sectionCode: 'TAG', name: '@friend', sectionItems: [] }]
    const result = removeStaleTagSections(sections, { tagsToShow: '' })
    expect(result).toEqual([])
  })
})

describe('syncTagSectionsWithSettings', () => {
  it('removes disabled TAG sections and dedupes TAG names', () => {
    const settings = {
      tagsToShow: '@dbw, @jgc',
      'showTagSection_@dbw': true,
      'showTagSection_@jgc': false,
    }
    const sections = [
      { ID: 'DT', sectionCode: 'DT', name: 'Today', sectionItems: [] },
      { ID: 'TAG_0', sectionCode: 'TAG', name: '@dbw', sectionItems: [] },
      { ID: 'TAG_1', sectionCode: 'TAG', name: '@jgc', sectionItems: [] },
      { ID: 'TAG_2', sectionCode: 'TAG', name: '@dbw', sectionItems: [] },
    ]

    const result = syncTagSectionsWithSettings(sections, settings)
    expect(result.filter((s) => s.sectionCode === 'TAG').map((s) => s.name)).toEqual(['@dbw'])
    expect(result.find((s) => s.ID === 'TAG_2')).toBeDefined()
  })
})

describe('isTagCacheEnabled', () => {
  it('returns true when FFlag_UseTagCache is absent or true', () => {
    expect(isTagCacheEnabled({})).toBe(true)
    expect(isTagCacheEnabled({ FFlag_UseTagCache: true })).toBe(true)
  })

  it('returns false only when FFlag_UseTagCache is explicitly false', () => {
    expect(isTagCacheEnabled({ FFlag_UseTagCache: false })).toBe(false)
  })
})

describe('cleanDashboardSettingsInAPerspective', () => {
  it('removes showFeatureFlagMenu and FFlag_* keys', () => {
    const cleaned = cleanDashboardSettingsInAPerspective({
      showTodaySection: true,
      showFeatureFlagMenu: true,
      FFlag_UseTagCache: true,
      FFlag_DebugPanel: true,
    })
    expect(cleaned.showTodaySection).toBe(true)
    expect(cleaned.showFeatureFlagMenu).toBeUndefined()
    expect(cleaned.FFlag_UseTagCache).toBeUndefined()
    expect(cleaned.FFlag_DebugPanel).toBeUndefined()
  })
})

describe('isDashboardGlobalSettingKey', () => {
  it('identifies FFlags and showFeatureFlagMenu as global', () => {
    expect(isDashboardGlobalSettingKey('FFlag_UseTagCache')).toBe(true)
    expect(isDashboardGlobalSettingKey('showFeatureFlagMenu')).toBe(true)
    expect(isDashboardGlobalSettingKey('showTodaySection')).toBe(false)
  })
})

describe('isDashboardGlobalOnlySettingsDiff', () => {
  it('returns true when all diff keys are dashboard-global', () => {
    expect(isDashboardGlobalOnlySettingsDiff(['FFlag_UseTagCache', 'showFeatureFlagMenu'])).toBe(true)
    expect(isDashboardGlobalOnlySettingsDiff(['FFlag_UseTagCache', 'showTodaySection'])).toBe(false)
  })
})

describe('mergeDashboardSettingsForPerspectiveDef', () => {
  it('does not let legacy FFlag in perspective def override live top-level value', () => {
    const defaults = getDashboardSettingsDefaults()
    const prev = { ...defaults, FFlag_UseTagCache: true, showTodaySection: true }
    const perspectiveDef = {
      name: 'Work',
      isModified: false,
      isActive: true,
      dashboardSettings: { FFlag_UseTagCache: false, showTodaySection: false },
    }
    const merged = mergeDashboardSettingsForPerspectiveDef(perspectiveDef, prev, defaults)
    expect(merged.FFlag_UseTagCache).toBe(true)
    expect(merged.showTodaySection).toBe(false)
  })
})

describe('getPerspectiveLiveVsSavedDiff', () => {
  it('ignores legacy FFlag in perspective def when comparing to live globals', () => {
    const defaults = getDashboardSettingsDefaults()
    const perspectiveDef = {
      name: 'Work',
      isModified: false,
      isActive: true,
      dashboardSettings: { ...defaults, FFlag_UseTagCache: false, showQuarterSection: false },
    }
    const live = { ...defaults, FFlag_UseTagCache: true, showQuarterSection: false }
    expect(getPerspectiveLiveVsSavedDiff(perspectiveDef, live)).toBeNull()
  })
})
