// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated for v2.2.0.a9, 2025-03-27 by @jgclark
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
// No longer used
// import {  getNotesWithTagOrMention} from './tagMentionCache'

const pluginID = 'jgclark.Dashboard'

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

export {
  // onUpdateOrInstall,
  init, onSettingsUpdated, versionCheck
} from './NPHooks'

export {
  generateTagMentionCache,
  updateTagMentionCache
} from './tagMentionCache'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------

import { renameKeys } from '@helpers/dataManipulation'
import { saveSettings } from '@helpers/NPConfiguration'

// Migrate some setting names to new names
// TODO(later): remove this code in v2.3.0+
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginJson, `onUpdateOrInstall() starting ...`)
    const initialSettings = DataStore.settings
    // clo(initialSettings, `onUpdateOrInstall - initialSettings:`)

    // Migrate some setting names to new names
    const keysToChange = {
      usePerspectives: 'perspectivesEnabled',
      includeFolderName: 'showFolderName',
      includeScheduledDates: 'showScheduledDates',
      includeTaskContext: 'showTaskContext',
    }
    logInfo(pluginJson, `onUpdateOrInstall() renaming any necessary keys from 2.1.x to 2.2.x ...`)
    const migratedSettings = renameKeys(initialSettings, keysToChange)
    clo(migratedSettings, `onUpdateOrInstall - migratedSettings:`)

    // Save the settings back to the DataStore
    if (migratedSettings !== initialSettings) {
      const result = await saveSettings(pluginID, migratedSettings)
      logInfo(`onUpdateOrInstall`, `Changes detected. Saved settings with result: ${JSP(result)}`)
    }
    logInfo(pluginJson, `onUpdateOrInstall() finished.`)
  } catch (err) {
    logError(pluginJson, `onUpdateOrInstall() error: ${err.message}`)
  }
}

//-----------------------------------------------------------------------------

/**
 * Test functions
 */
// No longer used
// export async function testTagCache(): Promise<void> {
//   let res = await getNotesWithTagOrMention(['@home'], false)
//   res = await getNotesWithTagOrMention(['#jgcDR'], false)
// }
