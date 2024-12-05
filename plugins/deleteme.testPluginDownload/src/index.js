// @flow
import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onUpdateOrInstall running`)
    await updateSettingData(pluginJson)
  } catch (error) {
    logError(pluginJson, `onUpdateOrInstall: ${JSP(error)}`)
  }
}

export async function runOnInstallOrUpdate(): Promise<void> {
  try {
    logDebug(pluginJson, `runOnInstallOrUpdate running`)
    // test as after the plugin is installed or updated. the following command updates the plugin's settings data
    const r = { code: 1 /* updated */, message: 'plugin updated message' }
    await pluginUpdated(pluginJson, r)
  } catch (error) {
    logError(pluginJson, `runOnInstallOrUpdate: ${JSP(error)}`)
  }
}
