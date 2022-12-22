// @flow
//-----------------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// Last updated 21.12.2022 for v0.4.0
//-----------------------------------------------------------------------------
// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { logDebug, logError } from "@helpers/dev"
import { updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

const pluginID = "jgclark.RepeatExtensions"

export { repeats, onEditorWillSave } from './repeatExtensions'


export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder to avoid complaints
}

// refactor previous variables to new types
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${pluginID}: onUpdateOrInstall finished`)
}
