/* globals describe, expect, test */
// Last updated 2026-08-18 for v2.4.0.b64 by @CursorAI

import { getDashboardSettingsDefaults } from '../dashboardSettingsDefaults'
import { sectionCodesNeedRemindersFetch } from '../dataGeneration'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'sectionCodesNeedRemindersFetch'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('returns false for sections that never inject reminders (TAG, PRIORITY)', () => {
      const config = getDashboardSettingsDefaults()
      expect(sectionCodesNeedRemindersFetch(['TAG'], config)).toBe(false)
      expect(sectionCodesNeedRemindersFetch(['PRIORITY', 'PROJACT'], config)).toBe(false)
    })

    test('returns true for REM, TB, DT, DY, DO, OVERDUE when Reminders are on', () => {
      const config = getDashboardSettingsDefaults()
      expect(sectionCodesNeedRemindersFetch(['REM'], config)).toBe(true)
      expect(sectionCodesNeedRemindersFetch(['TB'], config)).toBe(true)
      expect(sectionCodesNeedRemindersFetch(['DT'], config)).toBe(true)
      expect(sectionCodesNeedRemindersFetch(['DY'], config)).toBe(true)
      expect(sectionCodesNeedRemindersFetch(['DO'], config)).toBe(true)
      expect(sectionCodesNeedRemindersFetch(['OVERDUE'], config)).toBe(true)
    })

    test('returns true when any code in a startup batch needs reminders', () => {
      const config = getDashboardSettingsDefaults()
      expect(sectionCodesNeedRemindersFetch(['TB', 'REM', 'TAG', 'OVERDUE'], config)).toBe(true)
    })

    test('returns false when master Show Reminders is off', () => {
      const config = { ...getDashboardSettingsDefaults(), showRemindersSection: false }
      expect(sectionCodesNeedRemindersFetch(['TB', 'REM', 'DT', 'OVERDUE'], config)).toBe(false)
    })

    test('returns false for OVERDUE when showOverdueSection is off', () => {
      const config = { ...getDashboardSettingsDefaults(), showOverdueSection: false }
      expect(sectionCodesNeedRemindersFetch(['OVERDUE'], config)).toBe(false)
    })
  })
})
