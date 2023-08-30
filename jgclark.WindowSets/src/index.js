// @flow

//---------------------------------------------------------------
// Window Sets commands
// Jonathan Clark
// Last updated 28.8.23 for v0.2.x by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

const pluginID = 'jgclark.WindowSets'

export {
  logWindowSets,
  saveWindowSet,
  openWindowSet,
  deleteWindowSet,
  deleteAllSavedWindowSets,
  readWindowSetDefinitions,
} from './windowSets'

export {
  logPreferenceAskUser,
  unsetPreferenceAskUser,
} from '@helpers/NPdev'

export {
  logWindowsList,
} from '@helpers/NPWindows'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  return // Placeholder only to try to stop error in logs
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

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
  return // Placeholder only to try to stop error in logs
}
