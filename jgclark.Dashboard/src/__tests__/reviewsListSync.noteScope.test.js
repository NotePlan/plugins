/* globals describe, expect, test */
// Last updated 2026-08-20 for v2.4.0.b66 by @CursorAI

import { dashboardFolderFilterSettingsChanged, noteScopeSettingFingerprint, perspectiveNoteScopeChanged } from '../reviewsListSync.js'

const PLUGIN_NAME = 'jgclark.Dashboard'

describe(`${PLUGIN_NAME}`, () => {
  describe('dashboardFolderFilterSettingsChanged', () => {
    test('true for includedFolders, excludedFolders, or includedTeamspaces', () => {
      expect(dashboardFolderFilterSettingsChanged(['maxItemsToShowInSection'])).toBe(false)
      expect(dashboardFolderFilterSettingsChanged(['includedFolders'])).toBe(true)
      expect(dashboardFolderFilterSettingsChanged(['excludedFolders', 'showMonthSection'])).toBe(true)
      expect(dashboardFolderFilterSettingsChanged(['includedTeamspaces'])).toBe(true)
    })
  })

  describe('noteScopeSettingFingerprint', () => {
    test('treats CSV string and array as the same', () => {
      expect(noteScopeSettingFingerprint('Home, Work')).toBe(noteScopeSettingFingerprint(['Home', 'Work']))
    })

    test('treats empty values as equal', () => {
      expect(noteScopeSettingFingerprint('')).toBe('')
      expect(noteScopeSettingFingerprint(null)).toBe('')
      expect(noteScopeSettingFingerprint([])).toBe('')
    })
  })

  describe('perspectiveNoteScopeChanged', () => {
    test('false when folder and teamspace scope is unchanged', () => {
      const prev = { includedFolders: 'Home', excludedFolders: 'Archive', includedTeamspaces: ['private'], showMonthSection: false }
      const next = { includedFolders: 'Home', excludedFolders: 'Archive', includedTeamspaces: ['private'], showMonthSection: true }
      expect(perspectiveNoteScopeChanged(prev, next)).toBe(false)
    })

    test('true when includedFolders changes', () => {
      const prev = { includedFolders: 'Home', excludedFolders: '', includedTeamspaces: ['private'] }
      const next = { includedFolders: 'Work', excludedFolders: '', includedTeamspaces: ['private'] }
      expect(perspectiveNoteScopeChanged(prev, next)).toBe(true)
    })

    test('true when includedTeamspaces changes', () => {
      const prev = { includedFolders: '', excludedFolders: '', includedTeamspaces: ['private'] }
      const next = { includedFolders: '', excludedFolders: '', includedTeamspaces: ['private', 'abc'] }
      expect(perspectiveNoteScopeChanged(prev, next)).toBe(true)
    })
  })
})
