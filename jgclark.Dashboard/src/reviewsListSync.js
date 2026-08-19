// @flow
//-----------------------------------------------------------------------------
// Sync Reviews allProjectsList.json when Dashboard folder filter settings change.
// Last updated 2026-08-19 for v2.4.0.b65 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getReviewSettings } from '../../jgclark.Reviews/src/reviewHelpers'
import { RICH_PROJECT_LIST_WIN_ID } from '../../jgclark.Reviews/src/reviews'
import { invalidateDashboardPluginSettingsCache } from './dashboardPluginSettings'
import { logDebug, logInfo, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { pluginIsInstalled } from '@helpers/NPConfiguration'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

/** Dashboard `dashboardSettings` keys that map to Reviews folder include/exclude when `usePerspectives` is on. */
export const DASHBOARD_FOLDER_FILTER_SETTING_KEYS: Array<string> = ['includedFolders', 'excludedFolders']

/**
 * Whether a settings diff includes Dashboard folder filter keys.
 * @param {Array<string>} diffKeys - top-level keys from compareObjects
 * @returns {boolean}
 */
export function dashboardFolderFilterSettingsChanged(diffKeys: Array<string>): boolean {
  return diffKeys.some((k) => DASHBOARD_FOLDER_FILTER_SETTING_KEYS.includes(k))
}

/**
 * After Dashboard saves folder include/exclude filters, keep Reviews in sync.
 * When the Rich project list is open, invokes Reviews to regenerate `allProjectsList.json` and re-render.
 * When closed, PROJ* section refresh still picks up new JSON via Reviews `shouldRegenerateAllProjectsList` folder fingerprint.
 * @returns {Promise<void>}
 */
export async function syncReviewsAfterDashboardFolderFilterChange(): Promise<void> {
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
  const richOpen = isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)
  if (richOpen) {
    logInfo(
      'syncReviewsAfterDashboardFolderFilterChange',
      `Rich list open: invoking onDashboardFolderFiltersChanged (foldersToInclude=[${String(config.foldersToInclude)}] foldersToIgnore=[${String(config.foldersToIgnore)}])`,
    )
    try {
      await DataStore.invokePluginCommandByName('onDashboardFolderFiltersChanged', 'jgclark.Reviews', [0, true])
    } catch (err) {
      logWarn('syncReviewsAfterDashboardFolderFilterChange', `onDashboardFolderFiltersChanged failed: ${err.message}`)
    }
    return
  }
  logDebug(
    'syncReviewsAfterDashboardFolderFilterChange',
    'Rich project list not open; PROJ* refresh will regenerate allProjectsList via folder-filter fingerprint if needed',
  )
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
 * @param {string} perspectiveName - name being switched to (logging only)
 * @returns {void}
 */
export function scheduleReviewsListAfterPerspectiveSwitch(perspectiveName: string): void {
  try {
    if (!pluginIsInstalled('jgclark.Reviews')) {
      logDebug('scheduleReviewsListAfterPerspectiveSwitch', 'jgclark.Reviews not installed; skipping')
      return
    }
    if (!isHTMLWindowOpen(RICH_PROJECT_LIST_WIN_ID)) {
      logDebug(
        'scheduleReviewsListAfterPerspectiveSwitch',
        `Rich list not open; skipping generateProjectListsAndRenderIfOpen after switch to '${perspectiveName}'`,
      )
      return
    }
    const url = createRunPluginCallbackUrl('jgclark.Reviews', 'generateProjectListsAndRenderIfOpen', ['0', 'true', 'paintFirst', perspectiveName])
    logInfo(
      'scheduleReviewsListAfterPerspectiveSwitch',
      `Rich list open: queuing x-callback generateProjectListsAndRenderIfOpen (skip Dashboard invoke, paintFirst) for '${perspectiveName}' so Dashboard can paint first: ${url}`,
    )
    NotePlan.openURL(url)
  } catch (err) {
    logWarn('scheduleReviewsListAfterPerspectiveSwitch', `Failed to queue Reviews regen for '${perspectiveName}': ${err.message}`)
  }
}
