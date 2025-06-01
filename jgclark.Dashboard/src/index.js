// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2025-05-18 for v2.3.0
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import { generateTagMentionCache } from './tagMentionCache'
import { renameKeys } from '@helpers/dataManipulation'
import { clo, compareObjects, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  pluginUpdated,
  saveSettings
} from '@helpers/NPConfiguration'

// ----------------------------------------------------------------------------

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
  reactWindowInitialisedSoStartGeneratingData,
} from './reactMain.js'

export {
  // onUpdateOrInstall, // Note: a more specialised version of this is below
  init, onSettingsUpdated, versionCheck
} from './NPHooks'

export {
  generateTagMentionCache,
  updateTagMentionCache
} from './tagMentionCache'

export {
  backupSettings
} from './backupSettings'

export {
  updateDoneCountsFromChangedNotes
} from './countDoneTasks'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------

// Migrate some setting names to new names
// TODO(later): remove this code in v2.3.0+
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginJson, `onUpdateOrInstall() starting ...`)
    const initialSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(initialSettings, `onUpdateOrInstall - initialSettings:`)
    // Note: this is deceptive because dashboardSettings is one single JSON stringified key inside initialSettings

    // Migrate some setting names to new names.
    // Note: can't easily be done with updateSettingData() in index.js as there can be multiple copies of these settings at different object levels.
    logInfo(pluginJson, `- renaming any necessary keys from 2.1.x to 2.2.x ...`)
    const keysToChange = {
      perspectivesEnabled: 'usePerspectives',
      includeFolderName: 'showFolderName',
      includeScheduledDates: 'showScheduledDates',
      includeTaskContext: 'showTaskContext',
    }
    const initialDashboardSettings = JSON.parse(initialSettings.dashboardSettings)
    const migratedDashboardSettings = renameKeys(initialDashboardSettings, keysToChange)

    // Add any new settings for 2.3.0
    logInfo(pluginJson, `- adding new keys for 2.3.0 ...`)
    migratedDashboardSettings.includeFutureTagMentions = false
    migratedDashboardSettings.showProgressInSections = 'number closed'

    // Note: Workaround for number types getting changed to strings at some point in our Settings system.
    migratedDashboardSettings.newTaskSectionHeadingLevel = parseInt(migratedDashboardSettings.newTaskSectionHeadingLevel || 2)
    migratedDashboardSettings.maxItemsToShowInSection = parseInt(migratedDashboardSettings.maxItemsToShowInSection || 24)
    migratedDashboardSettings.lookBackDaysForOverdue = parseInt(migratedDashboardSettings.lookBackDaysForOverdue || 7)
    migratedDashboardSettings.autoUpdateAfterIdleTime = parseInt(migratedDashboardSettings.autoUpdateAfterIdleTime || 10)

    // clo(migratedDashboardSettings, `onUpdateOrInstall - migratedDashboardSettings:`)

    // Save the settings back to the DataStore
    if (compareObjects(migratedDashboardSettings, initialDashboardSettings, [], true) != null) {
      const migratedSettings = { ...initialSettings, dashboardSettings: JSON.stringify(migratedDashboardSettings) }
      const result = await saveSettings(pluginID, migratedSettings)
      logInfo(`onUpdateOrInstall`, `- Changes detected. Saved settings with result: ${JSP(result)}`)
    }

    // Now get the tagMentionCache up to date. 
    // Note: Deliberately don't await this, because it can take 15+ seconds.
    const _cachePromise = generateTagMentionCache(true)

    await pluginUpdated(pluginJson, { code: 1, message: `Plugin Installed or Updated.` })

    logInfo(`onUpdateOrInstall`, `- finished.`)
  } catch (err) {
    logError(pluginJson, `onUpdateOrInstall() error: ${err.message}`)
  }
}
