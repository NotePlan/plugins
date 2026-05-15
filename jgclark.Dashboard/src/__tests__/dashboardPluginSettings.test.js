/* globals describe, expect, test */
// Last updated 2026-05-15 for v2.4.0.b35 by @CursorAI

import { buildSanitizeReportLines, sanitizeDashboardPluginSettings } from '../dashboardPluginSettings.js'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'dashboardPluginSettings'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('sanitizeDashboardPluginSettings()', () => {
      test('removes stray numeric root keys from array-spread corruption', () => {
        const raw = {
          perspectiveSettings: [{ name: '-', dashboardSettings: { showTodaySection: true }, isModified: false, isActive: true }],
          dashboardSettings: { showTodaySection: true },
          '0': { name: '-', dashboardSettings: { showTodaySection: false }, isModified: false, isActive: false },
          '1': { name: 'Home', dashboardSettings: {}, isModified: false, isActive: false },
        }
        const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw)
        expect(needsWrite).toBe(true)
        expect(report.removedRootKeys).toEqual(expect.arrayContaining(['0', '1']))
        expect(settings['0']).toBeUndefined()
        expect(settings['1']).toBeUndefined()
        expect(Array.isArray(settings.perspectiveSettings)).toBe(true)
        expect(settings.perspectiveSettings).toHaveLength(1)
      })

      test('coerces perspectiveSettings object with numeric keys to array', () => {
        const raw = {
          dashboardSettings: {},
          perspectiveSettings: {
            '0': { name: '-', dashboardSettings: { showTodaySection: true }, isModified: false, isActive: true },
            '1': { name: 'Work', dashboardSettings: { showTodaySection: false }, isModified: false, isActive: false },
          },
        }
        const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw)
        expect(needsWrite).toBe(true)
        expect(report.coercedPerspectiveSettingsFromObject).toBe(true)
        expect(Array.isArray(settings.perspectiveSettings)).toBe(true)
        expect(settings.perspectiveSettings.map((p) => p.name)).toEqual(['-', 'Work'])
      })

      test('parses string dashboardSettings and perspectiveSettings', () => {
        const raw = {
          dashboardSettings: '{"showTodaySection":true}',
          perspectiveSettings: '[{"name":"-","dashboardSettings":{"showTodaySection":true},"isModified":false,"isActive":true}]',
        }
        const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw)
        expect(needsWrite).toBe(true)
        expect(report.parsedStringDashboardSettings).toBe(true)
        expect(report.parsedStringPerspectiveSettings).toBe(true)
        expect(settings.dashboardSettings.showTodaySection).toBe(true)
        expect(settings.perspectiveSettings[0].name).toBe('-')
      })

      test('buildSanitizeReportLines describes repairs for user messaging', () => {
        const lines = buildSanitizeReportLines({
          removedRootKeys: ['0', '1'],
          coercedPerspectiveSettingsFromObject: false,
          parsedStringDashboardSettings: false,
          parsedStringPerspectiveSettings: false,
          cleanedPerspectiveDefCount: 0,
        })
        expect(lines.some((l) => l.includes('0, 1'))).toBe(true)
      })

      test('does not remove allowed root keys or coerce a valid perspectiveSettings array', () => {
        const raw = {
          pluginID: 'jgclark.Dashboard',
          dashboardSettings: { showTodaySection: true, usePerspectives: true },
          perspectiveSettings: [
            { name: '-', dashboardSettings: { showTodaySection: true }, isModified: false, isActive: true },
          ],
          _logLevel: 'INFO',
        }
        const { settings, report } = sanitizeDashboardPluginSettings(raw)
        expect(report.removedRootKeys).toHaveLength(0)
        expect(report.coercedPerspectiveSettingsFromObject).toBe(false)
        expect(report.parsedStringDashboardSettings).toBe(false)
        expect(report.parsedStringPerspectiveSettings).toBe(false)
        expect(settings.pluginID).toBe('jgclark.Dashboard')
        expect(settings._logLevel).toBe('INFO')
        expect(settings['0']).toBeUndefined()
      })

      test('load-style sanitize does not flag perspective cleaning (cleanPerspectiveDefs false)', () => {
        const raw = {
          dashboardSettings: { usePerspectives: true, lastChange: 'live' },
          perspectiveSettings: [
            {
              name: 'Work',
              dashboardSettings: { usePerspectives: true, lastChange: 'should strip on save only', showTodaySection: true },
              isModified: false,
              isActive: true,
            },
          ],
        }
        const { report, needsWrite } = sanitizeDashboardPluginSettings(raw, { cleanPerspectiveDefs: false })
        expect(report.cleanedPerspectiveDefCount).toBe(0)
        expect(needsWrite).toBe(false)
      })

      test('save-style sanitize can clean perspective dashboardSettings', () => {
        const raw = {
          dashboardSettings: {},
          perspectiveSettings: [
            {
              name: 'Work',
              dashboardSettings: { usePerspectives: true, showTodaySection: true },
              isModified: false,
              isActive: true,
            },
          ],
        }
        const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw, { cleanPerspectiveDefs: true })
        expect(needsWrite).toBe(true)
        expect(report.cleanedPerspectiveDefCount).toBe(1)
        expect(settings.perspectiveSettings[0].dashboardSettings.usePerspectives).toBeUndefined()
      })
    })
  })
})
