// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2025-07-04 for v2.3.0.b4
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import { generateTagMentionCache } from './tagMentionCache'
import { getDashboardSettingsDefaultsWithSectionsSetToFalse } from './dashboardHelpers'
import { showDashboardReact } from './reactMain'
import { backupSettings } from './backupSettings'
import { renameKeys } from '@helpers/dataManipulation'
import { clo, compareObjects, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { pluginUpdated, saveSettings } from '@helpers/NPConfiguration'

// ----------------------------------------------------------------------------

const pluginID = 'jgclark.Dashboard'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

/**
 * Other imports/exports
 */
export { decideWhetherToUpdateDashboard, refreshSectionByCode } from './dashboardHooks.js'

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
  init,
  onSettingsUpdated,
  versionCheck,
} from './NPHooks'

export { generateTagMentionCache, updateTagMentionCache } from './tagMentionCache'

export { backupSettings } from './backupSettings'

export { updateDoneCountsFromChangedNotes } from './countDoneTasks'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------

// Migrate some setting names to new names
// TODO(later): remove this code in v2.3.0+
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginJson, `onUpdateOrInstall() starting ...`)
    const initialSettings = (await DataStore.loadJSON(`../${pluginID}/settings.json`)) || DataStore.settings
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
    const defaults = getDashboardSettingsDefaultsWithSectionsSetToFalse()
    const migratedDashboardSettings = { ...defaults, ...renameKeys(initialDashboardSettings, keysToChange) }

    // Note: no longer need to add new settings here, because if they are in the defaults of dashboardSettings, they will be added to the perspectives.

    // Note: Workaround for number types getting changed to strings at some point in our Settings system.  FIXME: but lower priority for now.
    migratedDashboardSettings.newTaskSectionHeadingLevel = parseInt(migratedDashboardSettings.newTaskSectionHeadingLevel || 2)
    migratedDashboardSettings.maxItemsToShowInSection = parseInt(migratedDashboardSettings.maxItemsToShowInSection || 24)
    migratedDashboardSettings.lookBackDaysForOverdue = parseInt(migratedDashboardSettings.lookBackDaysForOverdue || 7)
    migratedDashboardSettings.autoUpdateAfterIdleTime = parseInt(migratedDashboardSettings.autoUpdateAfterIdleTime || 10)

    clo(migratedDashboardSettings, `onUpdateOrInstall - migratedDashboardSettings:`)

    clo(initialSettings, `onUpdateOrInstall - initialSettings:`)
    const perspectiveSettings = await JSON.parse(initialSettings.perspectiveSettings)
    const newPerspectives = perspectiveSettings.map((p) => ({ ...p, dashboardSettings: { ...defaults, ...p.dashboardSettings } }))
    const migratedSettings = { ...initialSettings, dashboardSettings: JSON.stringify(migratedDashboardSettings), perspectiveSettings: JSON.stringify(newPerspectives) }

    const diff = compareObjects(migratedDashboardSettings, initialDashboardSettings, [], true)
    if (diff != null) {
      // Save the settings back to the DataStore
      clo(diff, `Dashboard: onUpdateOrInstall - changes detected; diff:`)
      await backupSettings(true)
      await saveSettings(pluginID, migratedSettings)
      await showDashboardReact() // force a refresh of the dashboard with the new settings.
      // throw new Error('Stop because changes detected (this is not actually an ERROR but we are using a throw statement to stop execution)') // updates were required to be made to the settings.
    } else {
      logInfo(`onUpdateOrInstall`, `- no changes detected to settings.`)
    }
    logInfo(`onUpdateOrInstall`, `- finished.`)
    pluginUpdated(pluginJson, { code: 1, message: `Plugin Installed or Updated.` })

    // Now get the tagMentionCache up to date, by forcing a rebuild.
    // Note: DBW thinks that we don't await this, NotePlan will kill the thread, and stop this from finishing.
    await generateTagMentionCache(true)
  } catch (err) {
    logError(pluginJson, `onUpdateOrInstall() error: ${err.message}`)
  }
}
