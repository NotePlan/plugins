// @flow
//-----------------------------------------------------------------------------
// preferredWindowType helpers (Dashboard-global setting in dashboardSettings).
// Canonical labels match NotePlan / Reviews UI: New Window | Main Window | Split View.
// Last updated 2026-07-27 for v2.4.0.b55 by @CursorAI
//-----------------------------------------------------------------------------

export const PREFERRED_WINDOW_TYPE_DEFAULT: string = 'Main Window'

const SHORT_TO_LONG: { [string]: string } = {
  Window: 'New Window',
  Main: 'Main Window',
  Split: 'Split View',
}

/**
 * Normalize preferredWindowType to a canonical long label.
 * Accepts short legacy aliases (Window / Main / Split) from earlier Dashboard UI.
 * @param {?string} value
 * @returns {string}
 */
export function normalizePreferredWindowType(value: ?string): string {
  if (value == null || value === '') return PREFERRED_WINDOW_TYPE_DEFAULT
  if (SHORT_TO_LONG[value]) return SHORT_TO_LONG[value]
  if (value === 'New Window' || value === 'Main Window' || value === 'Split View') return value
  return PREFERRED_WINDOW_TYPE_DEFAULT
}

export type TPreferredWindowHtmlOptions = {
  showInMainWindow: boolean,
  splitView: boolean,
}

/**
 * Map preferredWindowType to HtmlWindowOptions open-mode flags.
 * @param {?string} preferredWindowType
 * @returns {TPreferredWindowHtmlOptions}
 */
export function windowOptionsFromPreferredWindowType(preferredWindowType: ?string): TPreferredWindowHtmlOptions {
  const normalized = normalizePreferredWindowType(preferredWindowType)
  switch (normalized) {
    case 'New Window':
      return { showInMainWindow: false, splitView: false }
    case 'Split View':
      return { showInMainWindow: true, splitView: true }
    case 'Main Window':
    default:
      return { showInMainWindow: true, splitView: false }
  }
}
