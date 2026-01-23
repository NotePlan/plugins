// @flow
// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 2026-01-22 for v2.4.0.b17
// ----------------------------------------------------------------------------

/**
 * Imports
 */
import pluginJson from '../plugin.json'
// import { getDashboardSettingsDefaultsWithSectionsSetToFalse } from './dashboardHelpers'
// import { showDashboardReact } from './reactMain'
import { parseSettings } from './shared'
import { generateTagMentionCache } from './tagMentionCache'
// import { renameKeys } from '@helpers/dataManipulation'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
  // compareObjects
} from '@helpers/dev'
import * as npc from '@helpers/NPConfiguration'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'

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
  decideWhetherToUpdateDashboard, /// TODO(later): remove, now that onEditorWillSave is here
  onEditorWillSave,
  refreshSectionByCode
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
  makeSettingsAsCallback,
  reactWindowInitialisedSoStartGeneratingData,
  showDashboardReact,
  showDemoDashboard,
  showPerspective,
  showSections,
  setSetting,
  setSettings,
} from './reactMain.js'

export { refreshDashboard } from './refreshClickHandlers'

export { onMessageFromHTMLView } from './routeRequestsFromReact.js'

export {
  // onUpdateOrInstall, // Note: a more specialised version of this is below
  init,
  onSettingsUpdated,
  versionCheck,
} from './NPHooks'

export { generateTagMentionCache, updateTagMentionCache } from './tagMentionCache'

export { updateDoneCountsFromChangedNotes } from './countDoneTasks'

export { externallyStartSearch } from './dataGenerationSearch.js'

//-----------------------------------------------------------------------------

export async function backupSettings(): Promise<void> {
  const res = await npc.backupSettings(pluginID, 'backup')
  if (res) {
    logInfo(pluginJson, `backupSettings() - backup successful.`)
  } else {
    logError(pluginJson, `backupSettings() - backup failed.`)
  }
}

// Carry out any operations necessary when the plugin is updated.
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginJson, `onUpdateOrInstall() starting ...`)
    const initialSettings = (await DataStore.loadJSON(`../${pluginID}/settings.json`)) || DataStore.settings
    // clo(initialSettings, `onUpdateOrInstall - initialSettings:`)
    // Note: this is deceptive because dashboardSettings is one single JSON stringified key inside initialSettings

    // Backup the settings on all new installs (quietly)
    await npc.backupSettings('jgclark.Dashboard', `before_onUpdateOrInstall_v${pluginJson["plugin.version"]}`, true)

    // Log warnings if we don't have required files
    await checkForRequiredSharedFiles(pluginJson)

    // Make sure we have the np.Shared plugin which has the core react code and some basic CSS
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    // logDebug(pluginJson, `onUpdateOrInstall: installOrUpdatePluginsByID ['np.Shared'] completed`)

    const initialDashboardSettings = parseSettings(initialSettings.dashboardSettings)
    // const defaults = getDashboardSettingsDefaultsWithSectionsSetToFalse()
    // const migratedDashboardSettings = { ...defaults, ...renameKeys(initialDashboardSettings, keysToChange) }

    // Note: don't need to add *new* settings here, because if they are in the defaults of dashboardSettings, they will be added to the perspectives.

    // Note: Workaround for number types getting changed to strings at some point in our Settings system.  FIXME: but lower priority for now.
    initialDashboardSettings.newTaskSectionHeadingLevel = parseInt(initialDashboardSettings.newTaskSectionHeadingLevel || 2)
    initialDashboardSettings.maxItemsToShowInSection = parseInt(initialDashboardSettings.maxItemsToShowInSection || 24)
    initialDashboardSettings.lookBackDaysForOverdue = parseInt(initialDashboardSettings.lookBackDaysForOverdue || 7)
    initialDashboardSettings.autoUpdateAfterIdleTime = parseInt(initialDashboardSettings.autoUpdateAfterIdleTime || 10)

    clo(initialDashboardSettings, `onUpdateOrInstall - initialDashboardSettings:`)

    // const perspectiveSettings = parseSettings(initialSettings.perspectiveSettings) ?? []
    // const newPerspectives = perspectiveSettings.map((p) => ({ ...p, dashboardSettings: { ...defaults, ...p.dashboardSettings } }))
    // const migratedSettings = { ...initialSettings, dashboardSettings: migratedDashboardSettings, perspectiveSettings: newPerspectives }

    // const diff = compareObjects(initialDashboardSettings, initialDashboardSettings, [], true)
    // if (diff != null) {
    //   // Save the settings back to the DataStore
    //   clo(diff, `Dashboard: onUpdateOrInstall - changes to settings detected. Diff:`)
    //   await npc.saveSettings(pluginID, migratedSettings)
    // } else {
    //   logInfo(`onUpdateOrInstall`, `- no changes detected to settings.`)
    // }
    // // force a refresh of the dashboard with the new settings.
    // npc.pluginUpdated(pluginJson, { code: 1, message: `Plugin Installed or Updated.` })
    // await showDashboardReact()
    // logInfo(`onUpdateOrInstall`, `- finished.`)

    // Now get the tagMentionCache up to date, by forcing a rebuild.
    // Note: DBW thinks that if we don't await this, NotePlan will kill the thread, and stop this from finishing.
    await generateTagMentionCache(true)
  } catch (err) {
    logError(pluginJson, `onUpdateOrInstall() error: ${err.message}`)
  }
}
