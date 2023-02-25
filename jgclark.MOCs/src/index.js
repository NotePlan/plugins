// @flow

//-----------------------------------------------------------------------------
// Map of Contents plugin
// Jonathan Clark
// Last updated 18.8.2022 for v0.2.2
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { logInfo, logError } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
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
