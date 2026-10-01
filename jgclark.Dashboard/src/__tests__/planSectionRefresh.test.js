/* globals describe, expect, test */
// Last updated 2026-10-01 for v2.5.0 by @CursorAI

import { planSectionRefreshAfterDashboardSettingsChange } from '../clickHandlers'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'planSectionRefresh'

function settings(overrides) {
  return {
    showProjectReviewSection: false,
    showProjectActiveSection: false,
    ...overrides,
  }
}

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('turning on Projects to Review refreshes only PROJREVIEW', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ showProjectReviewSection: false }),
        settings({ showProjectReviewSection: true }),
      )
      expect(plan.resultsToHandle).toContain('REFRESH_SECTION_IN_JSON')
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultExtra.sectionCodes).toEqual(['PROJREVIEW'])
    })

    test('turning off Projects to Review does not refresh tag or project sections', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ showProjectReviewSection: true }),
        settings({ showProjectReviewSection: false }),
      )
      expect(plan.resultsToHandle).toContain('CLOSE_UNNEEDED_SECTIONS')
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultsToHandle).not.toContain('REFRESH_SECTION_IN_JSON')
    })

    test('turning on Active Projects and Projects to Review refreshes both project sections', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ showProjectActiveSection: false, showProjectReviewSection: false }),
        settings({ showProjectActiveSection: true, showProjectReviewSection: true }),
      )
      expect(plan.resultExtra.sectionCodes).toEqual(['PROJACT', 'PROJREVIEW'])
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
    })

    test('Hide duplicates does not regenerate sections', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ hideDuplicates: false }),
        settings({ hideDuplicates: true }),
      )
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultsToHandle).not.toContain('REFRESH_SECTION_IN_JSON')
      expect(plan.resultsToHandle).not.toContain('CLOSE_UNNEEDED_SECTIONS')
    })

    test('Overdue lookback refreshes only OVERDUE', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ lookBackDaysForOverdue: 31 }),
        settings({ lookBackDaysForOverdue: 14 }),
      )
      expect(plan.resultsToHandle).toContain('REFRESH_SECTION_IN_JSON')
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultExtra.sectionCodes).toEqual(['OVERDUE'])
    })

    test('turning on one tag section refreshes only TAG', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ tagsToShow: '@alice', 'showTagSection_@alice': false }),
        settings({ tagsToShow: '@alice', 'showTagSection_@alice': true }),
      )
      expect(plan.resultExtra.sectionCodes).toEqual(['TAG'])
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
    })

    test('turning on Priority refreshes only PRIORITY', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ showPrioritySection: false }),
        settings({ showPrioritySection: true }),
      )
      expect(plan.resultExtra.sectionCodes).toEqual(['PRIORITY'])
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
    })

    test('checklist filter skips project sections', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ ignoreChecklistItems: false, showProjectActiveSection: true, showProjectReviewSection: true }),
        settings({ ignoreChecklistItems: true, showProjectActiveSection: true, showProjectReviewSection: true }),
      )
      expect(plan.resultsToHandle).toContain('REFRESH_SECTION_IN_JSON')
      expect(plan.resultsToHandle).not.toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultExtra.sectionCodes).toContain('DT')
      expect(plan.resultExtra.sectionCodes).not.toContain('PROJACT')
      expect(plan.resultExtra.sectionCodes).not.toContain('PROJREVIEW')
    })

    test('folder include still refreshes every enabled section and syncs Reviews', () => {
      const plan = planSectionRefreshAfterDashboardSettingsChange(
        settings({ includedFolders: '' }),
        settings({ includedFolders: 'Work' }),
      )
      expect(plan.resultsToHandle).toContain('REFRESH_ALL_ENABLED_SECTIONS')
      expect(plan.resultsToHandle).toContain('ACTIVE_PERSPECTIVE_DEFINITION_CHANGED')
      expect(plan.resultsToHandle).not.toContain('REFRESH_SECTION_IN_JSON')
    })
  })
})
