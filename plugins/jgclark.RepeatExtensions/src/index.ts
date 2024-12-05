// @flow
//-----------------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// Last updated 7.6.2024 for v0.7.1
//-----------------------------------------------------------------------------
// allow changes in plugin.json to trigger recompilation

import pluginJson from '../plugin.json'
import { logDebug, logError, logInfo, JSP } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@np/helpers/NPConfiguration'
import { editSettings } from '@np/helpers/NPSettings'
// import { showMessage } from '@np/helpers/userInput'

const pluginID = "jgclark.RepeatExtensions"

export { generateRepeats, onEditorWillSave } from './main'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
    //   pluginUpdated(pluginJson, r),
    // )
  } catch (error: any) {
    logError(pluginJson, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder to avoid complaints
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (testUpdate) {
      updateSettingsResult = 1 // updated
      logDebug(pluginID, '- forcing pluginUpdated() to run ...')
    }
    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

  } catch (error: any) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
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
  } catch (error: any) {
    logError(pluginJson, JSP(error))
  }
}
