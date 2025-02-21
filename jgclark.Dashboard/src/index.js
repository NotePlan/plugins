// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated for v2.2.0, 2025-02-21 by @jgclark
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

/**
 * Other imports/exports
 */
export {
  decideWhetherToUpdateDashboard,
  refreshSectionByCode,
} from './dashboardHooks.js'

export { generateDiagnosticsFile } from './diagnosticGenerator'

export {
  addNewPerspective,
  deletePerspective,
  deleteAllNamedPerspectiveSettings,
  getPerspectiveSettings, // TODO(later): remove
  logPerspectiveFiltering,
  updateCurrentPerspectiveDef,
} from './perspectiveHelpers.js'

export {
  showDashboardReact,
  onMessageFromHTMLView,
  showDemoDashboard,
  showPerspective,
  showSections,
  setSetting,
  setSettings,
  makeSettingsAsCallback,
  reactWindowInitialised,
} from './reactMain.js'

export { onUpdateOrInstall, init, onSettingsUpdated, versionCheck } from './NPHooks'

export {
  generateTagMentionCache,
  updateTagMentionCache
} from './tagMentionCache'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------
// TODO(later): remove this for testing tag cache

import {
  getNotesWithTagOrMention
} from './tagMentionCache'

/**
 * Test functions
 */
export async function testTagCache(): Promise<void> {
  let res = await getNotesWithTagOrMention(['@home'], false)
  res = await getNotesWithTagOrMention(['#jgcDR'], false)
}
