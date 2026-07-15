/* globals describe, expect, test */
// Last updated 2026-07-15 for v2.4.0.b51 by @CursorAI

import { getDashboardSettingsDefaults } from '../dashboardSettingsDefaults'
import { getListOfEnabledSections, isTBSectionEnabled } from '../dashboardHelpers'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'dashboardSettingsDefaults'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('getDashboardSettingsDefaults() turns showRemindersSection on by default', () => {
      const defaults = getDashboardSettingsDefaults()
      expect(defaults.showRemindersSection).toBe(true)
    })

    test('getListOfEnabledSections() includes REM when showRemindersSection is missing', () => {
      const defaults = getDashboardSettingsDefaults()
      // Simulate upgrade settings that never stored the key
      const withoutRemindersKey = { ...defaults }
      // $FlowIgnore[prop-missing]
      delete withoutRemindersKey.showRemindersSection
      const enabled = getListOfEnabledSections(withoutRemindersKey)
      expect(enabled).toContain('REM')
    })

    test('getListOfEnabledSections() omits REM when showRemindersSection is explicitly false', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showRemindersSection: false })
      expect(enabled).not.toContain('REM')
    })

    test('getListOfEnabledSections() includes TB when Time Block is off but Reminders is on', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: false, showRemindersSection: true })
      expect(enabled).toContain('TB')
    })

    test('getListOfEnabledSections() includes TB when Time Block is on but Reminders is off', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: true, showRemindersSection: false })
      expect(enabled).toContain('TB')
    })

    test('getListOfEnabledSections() omits TB when Time Block and Reminders are both off', () => {
      const defaults = getDashboardSettingsDefaults()
      const enabled = getListOfEnabledSections({ ...defaults, showTimeBlockSection: false, showRemindersSection: false })
      expect(enabled).not.toContain('TB')
    })

    test('isTBSectionEnabled() is true for Time Block only, Reminders only, or both', () => {
      const defaults = getDashboardSettingsDefaults()
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: true, showRemindersSection: false })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: false, showRemindersSection: true })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: true, showRemindersSection: true })).toBe(true)
      expect(isTBSectionEnabled({ ...defaults, showTimeBlockSection: false, showRemindersSection: false })).toBe(false)
    })
  })
})
