/* globals describe, expect, test, jest, beforeEach */
// Last updated 2026-05-23 for v2.4.0 by @CursorAI

import { resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload } from '../perspectiveSettingsOnDashboardSave.js'
import { getDashboardSettingsDefaults } from '../dashboardHelpers.js'
import { cleanDashboardSettingsInAPerspective } from '../perspectiveHelpers.js'

const defaults = getDashboardSettingsDefaults()
const activeNamedDefSettings = cleanDashboardSettingsInAPerspective({
  ...defaults,
  showQuarterSection: false,
  showWeekSection: true,
})

const mockPerspectiveSettings = [
  { name: '-', isActive: false, isModified: false, dashboardSettings: cleanDashboardSettingsInAPerspective({ ...defaults, showQuarterSection: false }) },
  {
    name: 'P+R Demo',
    isActive: true,
    isModified: false,
    dashboardSettings: activeNamedDefSettings,
  },
]

jest.mock('../perspectiveHelpers.js', () => {
  const actual = jest.requireActual('../perspectiveHelpers.js')
  return {
    ...actual,
    loadPerspectiveDefsFromPluginSettings: jest.fn(async () => mockPerspectiveSettings),
  }
})

jest.mock('../dashboardPluginSettings.js', () => ({
  loadDashboardPluginSettings: jest.fn(async () => ({ dashboardSettings: {}, perspectiveSettings: mockPerspectiveSettings })),
  saveDashboardPluginSettings: jest.fn(async () => true),
}))

const PLUGIN_NAME = 'jgclark.Dashboard'

describe(`${PLUGIN_NAME}`, () => {
  describe('resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    test('sets isModified on active named perspective when showQuarterSection changes', async () => {
      const incoming = {
        ...defaults,
        usePerspectives: true,
        showQuarterSection: true,
        showWeekSection: true,
      }
      const result = await resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload(incoming, incoming)
      expect(result.kind).toBe('continue')
      const active = result.perspectivesToSave?.find((p) => p.name === 'P+R Demo')
      expect(active).toBeDefined()
      expect(active?.isModified).toBe(true)
      expect(active?.dashboardSettings?.showQuarterSection).toBe(false)
    })

  })
})
