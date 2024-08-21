/* eslint-disable require-await */
// @flow
// Last updated 2024-07-12 for v2.0.1 by @jgclark

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { getLogSettings, setPluginData } from './dashboardHelpers'
import { log, logError, logInfo, logDebug, timer, clo, JSP } from '@helpers/dev'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
// import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

/*
 * NOTEPLAN GLOBAL PLUGIN HOOKS
 *
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 *
 */


/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onUpdateOrInstall started`)
    // Tell user the plugin has been updated
    await updateSettingData(pluginJson)
    await pluginUpdated(pluginJson, { code: 2, message: `Plugin Installed.` })
  } catch (error) {
    logError(pluginJson, `onUpdateOrInstall: ${JSP(error)}`)
  }
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin, including triggers)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export function init(): void {
  try {
    // logDebug(pluginJson, `${pluginJson['plugin.id']} :: init running`)
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false)
  } catch (error) {
    logError(pluginJson, `init: ${JSP(error)}`)
  }
}

/**
 * Log settings have been updated in the Preferences panel.
 * Note: It's only changes to the log settings that the front-end won't notice, so no need to re-render.
 * FIXME: this ^^^ is now not valid, as I didn't realise at the time we had hidden settings.
 */
export async function onSettingsUpdated(): Promise<void> {
  logDebug(pluginJson, `NotePlan automatically fired ${pluginJson['plugin.id']}::onSettingsUpdated().`)
  const logSettings = await getLogSettings()
  await setPluginData({ logSettings: logSettings }, '_logSettings were updated')
  return
}

// Note: not needed as Dashboard has its own built-in settings window.
// /**
//  * Update Settings/Preferences (for iOS/iPadOS)
//  * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
//  * @author @dwertheimer
//  */
// export async function updateSettings(): Promise<void> {
//   try {
//     logDebug(pluginJson, `updateSettings running`)
//     await editSettings(pluginJson)
//   } catch (error) {
//     logError(pluginJson, JSP(error))
//   }
// }

/**
 * Check the version of the plugin (which triggers init() which forces an update if the version is out of date)
 */
export async function versionCheck(): Promise<void> {
  try {
    await showMessage(`Current Version: ${pluginJson['plugin.version']}`, 'OK', `${pluginJson['plugin.name']}`, true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
