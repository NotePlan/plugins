// @flow

// TODO: go through all of this

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 22.3.2024 for v1.0.0, @jgclark
// ----------------------------------------------------------------------------

/**
 * Imports
 */
// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
// // import { getPluginJson, pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
// import { editSettings } from '@helpers/NPSettings'
// import { isHTMLWindowOpen, logWindowsList } from '@helpers/NPWindows'
// import { showMessage } from '@helpers/userInput'

// import { showDashboard } from './HTMLGeneratorGrid'

/**
 * Command Exports
 */
export { editSettings } from '@helpers/NPSettings'

// export { getDemoDataForDashboard } from './demoDashboard'
// export {
//   addTask, addChecklist,
//   refreshDashboard,
//   showDashboard,
//   showDemoDashboard,
//   resetDashboardWinSize,
// } from './demoDashboard'

export {
  testReactWindow,
  onMessageFromHTMLView,
  showDemoDashboard,
} from './reactMain.js'

/**
 * Hooks
 */

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

export async function onSettingsUpdated(): Promise<void> {
  // you probably won't need to use this...it's fired when the settings are updated in the Preferences panel
}

export function onUpdateOrInstall(): void {
  // this runs after the plugin is installed or updated. the following command updates the plugin's settings data
  updateSettingData(pluginJson)
}
