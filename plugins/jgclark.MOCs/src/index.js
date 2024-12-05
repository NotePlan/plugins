// @flow

//-----------------------------------------------------------------------------
// Map of Contents plugin
// Jonathan Clark
// Last updated 16.6.2023 for v0.3.1
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { makeMOC } from './MOCs'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) => pluginUpdated(pluginJson, r))
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const pluginID = 'jgclark.MOCs'

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })
  } catch (error) {
    console.log(error)
  }
  console.log(`${pluginID}: onUpdateOrInstall finished`)
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
