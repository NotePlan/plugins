// @flow

//-----------------------------------------------------------------------------
// Map of Contents plugin
// Jonathan Clark
// Last updated 22.7.2022 for v0.2.2-b2
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { migrateConfiguration, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { makeMOC } from './MOCs'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const pluginID = 'jgclark.MOCs'

export async function onUpdateOrInstall(): Promise<void> {
  try {
    console.log(`${pluginID}: onUpdateOrInstall running`)
    const updateSettingsResult = updateSettingData(pluginJson)
    console.log(`${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettingsResult}`)
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    console.log(error)
  }
  console.log(`${pluginID}: onUpdateOrInstall finished`)
}
