// @flow
//-----------------------------------------------------------------------------
// preferredWindowType helpers (Dashboard-global setting in dashboardSettings).
// Canonical labels match NotePlan / Reviews UI: New Window | Main Window | Split View.
// Last updated 2026-08-14 for v2.4.0.b63 by @CursorAI
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

/**
 * Decide how Dashboard should open a note in the Editor from a click.
 * When Dashboard occupies the main window (Main Window or Split View), opening in the main
 * editor would replace the Dashboard -- so default to split (reuseSplitView / splitView).
 * Alt always forces split; New Window (floating Dashboard) defaults to the main editor.
 * @param {?string} modifierKey - from extractModifierKeys().modifierName ('alt' | 'meta' | ...)
 * @param {?string} preferredWindowType
 * @returns {'window' | 'split'}
 */
export function resolveEditorOpenTypeForDashboardClick(modifierKey: ?string, preferredWindowType: ?string): 'window' | 'split' {
  if (modifierKey === 'alt') return 'split'
  const { showInMainWindow } = windowOptionsFromPreferredWindowType(preferredWindowType)
  return showInMainWindow ? 'split' : 'window'
}
