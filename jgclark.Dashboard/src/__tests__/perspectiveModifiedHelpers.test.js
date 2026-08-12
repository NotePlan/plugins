/* globals describe, expect, test */
// Last updated 2026-05-23 for v2.4.0 by @CursorAI

import { getDashboardSettingsDefaults } from '../dashboardHelpers.js'
import { cleanDashboardSettingsInAPerspective, ensurePerspectiveDefHasDashboardSettings, isNamedPerspectiveModified } from '../perspectiveHelpers.js'

const PLUGIN_NAME = 'jgclark.Dashboard'

describe(`${PLUGIN_NAME}`, () => {
  describe('ensurePerspectiveDefHasDashboardSettings', () => {
    test('fills cleaned defaults when dashboardSettings is missing', () => {
      const defaults = getDashboardSettingsDefaults()
      // Incomplete fixture: older defs can lack dashboardSettings at runtime
      const def: any = { name: 'Work', isActive: true, isModified: false }
      const { def: filled, filled: didFill } = ensurePerspectiveDefHasDashboardSettings(def, defaults)
      expect(didFill).toBe(true)
      expect(filled.dashboardSettings).toBeDefined()
      expect(Object.keys(filled.dashboardSettings || {}).length).toBeGreaterThan(0)
    })

    test('fills cleaned defaults when dashboardSettings is empty object', () => {
      const defaults = getDashboardSettingsDefaults()
      const def = { name: 'Work', isActive: true, isModified: false, dashboardSettings: {} }
      const { def: filled, filled: didFill } = ensurePerspectiveDefHasDashboardSettings(def, defaults)
      expect(didFill).toBe(true)
      expect(Object.keys(filled.dashboardSettings || {}).length).toBeGreaterThan(0)
    })

    test('leaves existing dashboardSettings unchanged', () => {
      const defaults = getDashboardSettingsDefaults()
      const saved = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false })
      const def = { name: 'Work', isActive: true, isModified: false, dashboardSettings: saved }
      const { def: result, filled: didFill } = ensurePerspectiveDefHasDashboardSettings(def, defaults)
      expect(didFill).toBe(false)
      expect(result).toBe(def)
      expect(result.dashboardSettings.showQuarterSection).toBe(false)
    })
  })

  describe('isNamedPerspectiveModified', () => {
    test('returns true when isModified flag is set', () => {
      const def = { name: 'Work', isModified: true, dashboardSettings: {} }
      expect(isNamedPerspectiveModified(def, {})).toBe(true)
    })

    test('returns true when live dashboard differs from saved def', () => {
      const defaults = getDashboardSettingsDefaults()
      const saved = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false })
      const def = { name: 'P+R Demo', isModified: false, dashboardSettings: saved }
      const live = { ...defaults, showQuarterSection: true }
      expect(isNamedPerspectiveModified(def, live)).toBe(true)
    })

    test('returns false for default "-" perspective', () => {
      const def = { name: '-', isModified: true, dashboardSettings: {} }
      expect(isNamedPerspectiveModified(def, { showQuarterSection: true })).toBe(false)
    })

    test('returns false after perspective switch when live matches baseline but differs from saved def', () => {
      const defaults = getDashboardSettingsDefaults()
      const saved = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false })
      const def = { name: 'Other', isModified: false, dashboardSettings: saved }
      const live = { ...defaults, showQuarterSection: true }
      const baseline = cleanDashboardSettingsInAPerspective(live)
      expect(isNamedPerspectiveModified(def, live, baseline)).toBe(false)
    })

    test('returns true when live differs from baseline after switch', () => {
      const defaults = getDashboardSettingsDefaults()
      const baseline = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false })
      const def = { name: 'Work', isModified: false, dashboardSettings: baseline }
      const live = { ...defaults, showQuarterSection: true }
      expect(isNamedPerspectiveModified(def, live, baseline)).toBe(true)
    })

    test('forSave: true when live matches baseline but differs from saved def (switch carryover)', () => {
      const defaults = getDashboardSettingsDefaults()
      const saved = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false })
      const def = { name: 'P+R Demo', isModified: false, dashboardSettings: saved }
      const live = cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: true })
      expect(isNamedPerspectiveModified(def, live, live, { forSave: true })).toBe(true)
      expect(isNamedPerspectiveModified(def, live, live)).toBe(false)
    })
  })
})
