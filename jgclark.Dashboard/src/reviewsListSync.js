// @flow
//-----------------------------------------------------------------------------
// Sync Reviews allProjectsList.json when Dashboard folder filter settings change.
// Last updated 2026-05-18 for v2.4.0.b38 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getReviewSettings } from '../../jgclark.Reviews/src/reviewHelpers'
import { RICH_PROJECT_LIST_WIN_ID } from '../../jgclark.Reviews/src/reviews'
import { invalidateDashboardPluginSettingsCache } from './dashboardPluginSettings'
import { logDebug, logInfo, logWarn } from '@helpers/dev'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { pluginIsInstalled } from '@helpers/NPConfiguration'

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
