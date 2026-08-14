/* globals describe, expect, test */
// Last updated 2026-07-27 for v2.4.0.b55 by @CursorAI

import {
  normalizePreferredWindowType,
  PREFERRED_WINDOW_TYPE_DEFAULT,
  resolveEditorOpenTypeForDashboardClick,
  windowOptionsFromPreferredWindowType,
} from '../preferredWindowType.js'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'preferredWindowType'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    describe('normalizePreferredWindowType()', () => {
      test('returns canonical long labels unchanged', () => {
        expect(normalizePreferredWindowType('New Window')).toBe('New Window')
        expect(normalizePreferredWindowType('Main Window')).toBe('Main Window')
        expect(normalizePreferredWindowType('Split View')).toBe('Split View')
      })

      test('maps short legacy aliases to long labels', () => {
        expect(normalizePreferredWindowType('Window')).toBe('New Window')
        expect(normalizePreferredWindowType('Main')).toBe('Main Window')
        expect(normalizePreferredWindowType('Split')).toBe('Split View')
      })

      test('defaults missing or unknown values to Main Window', () => {
        expect(normalizePreferredWindowType(null)).toBe(PREFERRED_WINDOW_TYPE_DEFAULT)
        expect(normalizePreferredWindowType(undefined)).toBe(PREFERRED_WINDOW_TYPE_DEFAULT)
        expect(normalizePreferredWindowType('')).toBe(PREFERRED_WINDOW_TYPE_DEFAULT)
        expect(normalizePreferredWindowType('Floating')).toBe(PREFERRED_WINDOW_TYPE_DEFAULT)
      })
    })

    describe('windowOptionsFromPreferredWindowType()', () => {
      test('maps New Window / Window to floating window', () => {
        expect(windowOptionsFromPreferredWindowType('New Window')).toEqual({ showInMainWindow: false, splitView: false })
        expect(windowOptionsFromPreferredWindowType('Window')).toEqual({ showInMainWindow: false, splitView: false })
      })

      test('maps Main Window / Main to main window', () => {
        expect(windowOptionsFromPreferredWindowType('Main Window')).toEqual({ showInMainWindow: true, splitView: false })
        expect(windowOptionsFromPreferredWindowType('Main')).toEqual({ showInMainWindow: true, splitView: false })
      })

      test('maps Split View / Split to split view', () => {
        expect(windowOptionsFromPreferredWindowType('Split View')).toEqual({ showInMainWindow: true, splitView: true })
        expect(windowOptionsFromPreferredWindowType('Split')).toEqual({ showInMainWindow: true, splitView: true })
      })

      test('defaults missing or unknown to Main Window options', () => {
        expect(windowOptionsFromPreferredWindowType(null)).toEqual({ showInMainWindow: true, splitView: false })
        expect(windowOptionsFromPreferredWindowType('Floating')).toEqual({ showInMainWindow: true, splitView: false })
      })
    })

    describe('resolveEditorOpenTypeForDashboardClick()', () => {
      test('alt always forces split', () => {
        expect(resolveEditorOpenTypeForDashboardClick('alt', 'New Window')).toBe('split')
        expect(resolveEditorOpenTypeForDashboardClick('alt', 'Main Window')).toBe('split')
        expect(resolveEditorOpenTypeForDashboardClick('alt', 'Split View')).toBe('split')
      })

      test('Main Window / Split View default to split so Dashboard is not replaced', () => {
        expect(resolveEditorOpenTypeForDashboardClick(null, 'Main Window')).toBe('split')
        expect(resolveEditorOpenTypeForDashboardClick(undefined, 'Main')).toBe('split')
        expect(resolveEditorOpenTypeForDashboardClick(null, 'Split View')).toBe('split')
        expect(resolveEditorOpenTypeForDashboardClick(null, 'Split')).toBe('split')
      })

      test('New Window (floating Dashboard) defaults to main editor', () => {
        expect(resolveEditorOpenTypeForDashboardClick(null, 'New Window')).toBe('window')
        expect(resolveEditorOpenTypeForDashboardClick(undefined, 'Window')).toBe('window')
      })

      test('missing preferredWindowType follows Main Window default (split)', () => {
        expect(resolveEditorOpenTypeForDashboardClick(null, null)).toBe('split')
      })
    })
  })
})
