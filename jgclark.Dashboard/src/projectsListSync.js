// @flow
//-----------------------------------------------------------------------------
// Sync Dashboard note changes with Reviews allProjectsList.json (PROJ sections).
// Extracted so pluginToHTMLBridge and clickHandlers can share without circular imports.
//
// Ordering note: after a PROJ* task change, writeAllProjectsList would call updateDashboardIfOpen -> invokePluginCommandByName
// targeting this same plugin. That invoke can settle before the webview refresh applies; the bridge could then send UPDATE_DATA
// from a pre-refresh snapshot and hide the new next-action. We skip that invoke for this path and call refreshSectionsByCode here instead.
// Last updated 2026-05-11 by @jgclark / @CursorAI
//-----------------------------------------------------------------------------

import { updateAllProjectsListAfterChange } from '../../jgclark.Reviews/src/allProjectsListHelpers'
import { getReviewSettings } from '../../jgclark.Reviews/src/reviewHelpers'
import { refreshSectionsByCode } from './dashboardHooks'
import type { TSectionCode } from './types'
import { logDebug, logInfo, logWarn } from '@helpers/dev'

/**
 * Keep Reviews plugin's allProjectsList.json in sync when a project task line changes in PROJACT / PROJREVIEW.
 * Writes the list with `skipUpdateDashboardIfOpen: true`, then calls `refreshSectionsByCode` in this plugin process so PROJ* section
 * data is merged before `processActionOnReturn` sends `UPDATE_DATA` (see file header and `writeAllProjectsList` / `updateDashboardIfOpen` JSDoc).
 * @param {string} filename - project note filename
 * @param {TSectionCode} sectionCode - dashboard section (only PROJACT / PROJREVIEW run sync)
 */
export async function updateProjectsListIfProjectSection(filename: string, sectionCode: TSectionCode): Promise<void> {
  logInfo('updateProjectsListIfProjectSection', `Starting from ${filename} in section ${sectionCode}`)
  if (sectionCode !== 'PROJACT' && sectionCode !== 'PROJREVIEW') return
  const reviewsConfig = await getReviewSettings(true)
  if (!reviewsConfig) {
    logWarn('updateProjectsListIfProjectSection', `No Reviews config returned, so skipping allProjects list sync for ${filename}`)
    return
  }
  await updateAllProjectsListAfterChange(filename, false, reviewsConfig, 0, { skipUpdateDashboardIfOpen: true })
  logDebug('updateProjectsListIfProjectSection', `Refreshing PROJACT/PROJREVIEW in-process after list write (avoids same-plugin invoke vs bridge UPDATE_DATA race)`)
  await refreshSectionsByCode(['PROJACT', 'PROJREVIEW'])
}
