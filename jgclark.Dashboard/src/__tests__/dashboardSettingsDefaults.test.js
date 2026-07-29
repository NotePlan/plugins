/* globals describe, expect, test */
// Last updated 2026-07-29 for v2.4.0.b56 by @CursorAI

import { getDashboardSettingsDefaults } from '../dashboardSettingsDefaults'
import { getListOfEnabledSections, isTBSectionEnabled } from '../dashboardHelpers'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'dashboardSettingsDefaults'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('getDashboardSettingsDefaults() turns showCurrentReminders and showUndatedOverdueReminders on by default', () => {
      const defaults = getDashboardSettingsDefaults()
      expect(defaults.showCurrentReminders).toBe(true)
      expect(defaults.showUndatedOverdueReminders).toBe(true)
    })

    test('getDashboardSettingsDefaults() defaults includedReminderLists to blank', () => {
      const defaults = getDashboardSettingsDefaults()
      expect(defaults.includedReminderLists).toBe('')
    })

    test('getListOfEnabledSections() includes REM when showUndatedOverdueReminders is missing', () => {
      const defaults = getDashboardSettingsDefaults()
      const withoutKey = { ...defaults }
      // $FlowIgnore[prop-missing]
      delete withoutKey.showUndatedOverdueReminders
      const enabled = getListOfEnabledSections(withoutKey)
      expect(enabled).toContain('REM')
    })

    test('getListOfEnabledSections() omits REM when showUndatedOverdueReminders is explicitly false', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showUndatedOverdueReminders: false })
      expect(enabled).not.toContain('REM')
    })

    test('getListOfEnabledSections() includes TB when Time Block is off but Current Reminders is on', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: false, showCurrentReminders: true })
      expect(enabled).toContain('TB')
    })

    test('getListOfEnabledSections() includes TB when Time Block is on but Current Reminders is off', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: true, showCurrentReminders: false })
      expect(enabled).toContain('TB')
    })

    test('getListOfEnabledSections() omits TB when Time Block and Current Reminders are both off', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: false, showCurrentReminders: false })
      expect(enabled).not.toContain('TB')
    })

    test('isTBSectionEnabled() is true for Time Block only, Current Reminders only, or both', () => {
      const defaults = getDashboardSettingsDefaults()
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: true, showCurrentReminders: false })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: false, showCurrentReminders: true })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: true, showCurrentReminders: true })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: false, showCurrentReminders: false })).toBe(false)
    })
  })
})
