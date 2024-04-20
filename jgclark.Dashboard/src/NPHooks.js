/* eslint-disable require-await */
// @flow

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { showDashboard } from './HTMLGeneratorGrid'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

/*
 * NOTEPLAN GLOBAL PLUGIN HOOKS
 *
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 *
 */

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings started`)
    const res = await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

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
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onSettingsUpdated started`)
    // If v3.11+, can now refresh Dashboard
    if (NotePlan.environment.buildVersion >= 1181) {
      if (isHTMLWindowOpen(pluginJson['plugin.id'])) {
        logDebug(pluginJson, `will refresh Dashboard as it is open`)
        await showDashboard('refresh', false) // probably don't need await
      }
    }
  } catch (error) {
    logError(pluginJson, `onSettingsUpdated: ${JSP(error)}`)
  }
}

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
