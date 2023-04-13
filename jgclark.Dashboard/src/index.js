// @flow

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 22.3.2023 for v0.3.2, @jgclark
// ----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getPluginJson, pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { logWindowsList } from '@helpers/NPWindows'

export { getDemoDataForDashboard } from './demoDashboard'
export { showDashboardHTML, showDemoDashboardHTML } from './dashboardHTML'
export { decideWhetherToUpdateDashboard } from './dashboardTriggers'
export { onMessageFromHTMLView } from './pluginToHTMLBridge'
export { getDataForDashboard, logDashboardData } from './dataGeneration'

const thisPluginID = 'jgclark.Dashboard'

/**
 * Check things each time this plugin's commands are run
 */
export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // Note: turned off, as it was causing too much noise in logs
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
    //   pluginUpdated(pluginJson, r),
    // )
  } catch (error) {
    logError(`${thisPluginID}/init`, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
