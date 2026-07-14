/* globals describe, expect, test */
// Last updated 2026-07-14 for v2.4.0.b50 by @CursorAI

import { getDashboardSettingsDefaults } from '../dashboardSettingsDefaults'
import { getListOfEnabledSections } from '../dashboardHelpers'

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
  })
})
