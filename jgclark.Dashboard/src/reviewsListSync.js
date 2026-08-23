// @flow
//-----------------------------------------------------------------------------
// Sync Reviews allProjectsList.json when Dashboard folder filter settings change.
// Last updated 2026-08-23 for v2.4.2 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getReviewSettings } from '../../jgclark.Reviews/src/reviewHelpers'
import { RICH_PROJECT_LIST_WIN_ID } from '../../jgclark.Reviews/src/reviews'
import { invalidateDashboardPluginSettingsCache } from './dashboardPluginSettings'
import type { TDashboardSettingsIn } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug, logInfo, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { pluginIsInstalled } from '@helpers/NPConfiguration'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

/** Dashboard `dashboardSettings` keys that change which folders or notes Reviews includes when `usePerspectives` is on. */
export const DASHBOARD_NOTE_SCOPE_SETTING_KEYS: Array<string> = ['includedFolders', 'excludedFolders', 'includedTeamspaces']

/** @deprecated Use DASHBOARD_NOTE_SCOPE_SETTING_KEYS */
export const DASHBOARD_FOLDER_FILTER_SETTING_KEYS: Array<string> = DASHBOARD_NOTE_SCOPE_SETTING_KEYS

/**
 * Whether a settings diff includes keys that change which folders or notes Reviews includes.
 * @param {Array<string>} diffKeys - top-level keys from compareObjects
 * @returns {boolean}
 */
export function dashboardFolderFilterSettingsChanged(diffKeys: Array<string>): boolean {
  return diffKeys.some((k) => DASHBOARD_NOTE_SCOPE_SETTING_KEYS.includes(k))
}

/**
 * Stable fingerprint for a folder/teamspace setting that may be a CSV string or an array.
 * @param {mixed} value
 * @returns {string}
 */
export function noteScopeSettingFingerprint(value: mixed): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).join('\u0001')
  }
  return stringListOrArrayToArray(String(value), ',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\u0001')
}

/**
 * Whether two dashboardSettings snapshots differ in folder include/exclude or Spaces to Include.
 * Accepts TDashboardSettingsIn (read-only partial) from perspective defs.
 * @param {?TDashboardSettingsIn} prevSettings
 * @param {?TDashboardSettingsIn} nextSettings
 * @returns {boolean}
 */
export function perspectiveNoteScopeChanged(prevSettings: ?TDashboardSettingsIn, nextSettings: ?TDashboardSettingsIn): boolean {
  // Cast through any: TDashboardSettingsIn has no string indexer, and `|| {}` would be an exact empty object (invalid-computed-prop).
  const prev: any = prevSettings || {}
  const next: any = nextSettings || {}
  return DASHBOARD_NOTE_SCOPE_SETTING_KEYS.some((k) => noteScopeSettingFingerprint(prev[k]) !== noteScopeSettingFingerprint(next[k]))
}

/**
 * After Dashboard saves folder/teamspace filters on the active perspective definition, keep Reviews in sync.
 * Queues an x-callback (`paintFirst` + `updated` banner) when the Rich list is open. Does not use
 * `invokePluginCommandByName` (that blocks paint until generateAllProjectsList finishes).
 * When the Rich list is closed, PROJ* refresh still picks up new JSON via Reviews folder-filter fingerprint.
 * @param {string} perspectiveName - active perspective name for the banner (optional)
 * @returns {Promise<void>}
 */
export async function syncReviewsAfterDashboardFolderFilterChange(perspectiveName: string = ''): Promise<void> {
  if (!(await pluginIsInstalled('jgclark.Reviews'))) {
    logDebug('syncReviewsAfterDashboardFolderFilterChange', 'jgclark.Reviews not installed; skipping')
    return
  }
  invalidateDashboardPluginSettingsCache()
  const config = await getReviewSettings(true)
  if (!config) {
    logWarn('syncReviewsAfterDashboardFolderFilterChange', 'No Reviews config; skipping')
    return
  }
  if (!config.usePerspectives) {
    logDebug(
      'syncReviewsAfterDashboardFolderFilterChange',
      'Reviews usePerspectives is false; folder filters come from Reviews settings.json - skipping Dashboard→Reviews sync',
    )
    return
  }
  scheduleReviewsListAfterPerspectiveSwitch(perspectiveName || config.perspectiveName || '', 'updated')
}

/**
 * After a Dashboard perspective switch has posted sections to the WebView, optionally regenerate the Reviews list.
 *
 * Must not call `DataStore.invokePluginCommandByName` here: even without `await`, NotePlan runs the other plugin on the
 * same JSContext before returning, so Dashboard cannot paint until generateAllProjectsList finishes (measured ~13s with
 * both windows open). Queue an x-callback instead so this Dashboard command can finish first.
 *
 * Passes `paintFirst` so Reviews can show its updating banner and return before the scan, letting that
 * WebView paint (same JSContext-blocking issue as Dashboard).
 *
 * Must stay synchronous (no async/await, no `new Promise`, no delayMs). NotePlan Beta throws
 * `JSPromiseConstructor is not a constructor` on those.
 *
 * When the Rich list is closed, skip (same as folder-filter sync). PROJ* in batchReplace already regenerates
 * allProjectsList.json when those sections are enabled (shouldRegenerateAllProjectsList / perspective fingerprint).
 *
 * @param {string} perspectiveName - name being switched to (logging and banner)
 * @param {string} bannerReason - `switch` (default) or `updated` (saved definition changed folder/note scope)
 * @returns {void}
 */
export function scheduleReviewsListAfterPerspectiveSwitch(perspectiveName: string, bannerReason: string = 'switch'): void {
  try {
    if (!pluginIsInstalled('jgclark.Reviews')) {
      logDebug('scheduleReviewsListAfterPerspectiveSwitch', 'jgclark.Reviews not installed; skipping')
      return
    }
    if (!isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)) {
      logDebug(
        'scheduleReviewsListAfterPerspectiveSwitch',
        `Rich list not open; skipping generateProjectListsAndRenderIfOpen after '${bannerReason}' for '${perspectiveName}'`,
      )
      return
    }
    const url = createRunPluginCallbackUrl('jgclark.Reviews', 'generateProjectListsAndRenderIfOpen', ['0', 'true', 'paintFirst', perspectiveName, bannerReason])
    logInfo(
      'scheduleReviewsListAfterPerspectiveSwitch',
      `Rich list open: queuing x-callback generateProjectListsAndRenderIfOpen (skip Dashboard invoke, paintFirst, ${bannerReason}) for '${perspectiveName}' so Dashboard can paint first: ${url}`,
    )
    NotePlan.openURL(url)
  } catch (err) {
    logWarn('scheduleReviewsListAfterPerspectiveSwitch', `Failed to queue Reviews regen for '${perspectiveName}': ${err.message}`)
  }
}
