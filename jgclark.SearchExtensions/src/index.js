// @flow
//-----------------------------------------------------------------------------
// More advanced searching
// Jonathan Clark
// Last updated 22.7.2022 for v0.5.0
//-----------------------------------------------------------------------------

export { quickSearch, saveSearch, saveSearchOverAll, saveSearchOverNotes, saveSearchOverCalendar } from './saveSearch'
export { saveSearchPeriod } from './saveSearchPeriod'

const pluginID = "jgclark.SearchExtensions"

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
