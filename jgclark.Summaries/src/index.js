// @flow

//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 24.7.2022 for v0.11.1
//-----------------------------------------------------------------------------

export { weeklyStats } from './forPlotting'
export { insertProgressUpdate } from './progress'
export { statsPeriod } from './stats'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const pluginID = "jgclark.Summaries"

// refactor previous variables to new types
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
