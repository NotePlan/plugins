// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2025-04-11 for v2.3.0.a1
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import {
  getFilenamesOfNotesWithTagOrMentions
} from './tagMentionCache'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'

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
    // v1
    // const initialSettings = DataStore.settings
    // v2
    const initialSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(initialSettings, `onUpdateOrInstall - initialSettings:`)

    // Migrate some setting names to new names
    const keysToChange = {
      perspectivesEnabled: 'usePerspectives',
      includeFolderName: 'showFolderName',
      includeScheduledDates: 'showScheduledDates',
      includeTaskContext: 'showTaskContext',
    }
    const migratedSettings = renameKeys(initialSettings, keysToChange)
    if (migratedSettings !== initialSettings) {
      logInfo(pluginJson, `onUpdateOrInstall() renamed any necessary keys from 2.1.x to 2.2.x ...`)
      clo(migratedSettings, `onUpdateOrInstall - migratedSettings:`)

      // Save the settings back to the DataStore
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
export async function testTagCache(): Promise<void> {
  const res1 = await getFilenamesOfNotesWithTagOrMentions(['@home'], false)
  const res2 = await getFilenamesOfNotesWithTagOrMentions(['#jgcDR'], false)
  const res3 = await getFilenamesOfNotesWithTagOrMentions(['#dbwDR'], false)
  const res4 = await getFilenamesOfNotesWithTagOrMentions(['@church'], false)
  const res5 = await getFilenamesOfNotesWithTagOrMentions(['@RP'], false)
}
