/* eslint-disable require-await */
// @flow

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { setPluginData } from './clickHandlers'
import { getCombinedSettings } from './dashboardHelpers'
import { log, logError, logInfo, logDebug, timer, clo, JSP } from '@helpers/dev'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
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
    // we will use this as a way to migrate settings from previous Dashboard
    const config = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)

    if (config == null || Object.keys(config).length === 0 || !config.migratedSettingsFromOriginalDashboard) {
      const oldDashboardSettings = await DataStore.loadJSON('../jgclark.Dashboard/settings.json')
      if (!oldDashboardSettings) {
        logError(`Cannot find settings for the '${pluginJson['plugin.id']}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
        return
      }
      const settings = oldDashboardSettings ? { ...DataStore.settings, ...oldDashboardSettings } : DataStore.settings
      DataStore.settings = {...settings, migratedSettingsFromOriginalDashboard: oldDashboardSettings ? "yes" : "no"}
      logInfo(pluginJson, oldDashboardSettings ? `Migrated settings from jgclark.Dashboard to jgclark.DashboardReact` : 'Created default settings')
    }
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
  logDebug(pluginJson, `NotePlan automatically fired ${pluginJson['plugin.id']}::onSettingsUpdated(). Updating settings in React Window`)
  const combinedSettings = await getCombinedSettings()
  clo(combinedSettings, 'onSettingsUpdated() - setting React pluginData.settings to combinedSettings')
  await setPluginData({ settings: combinedSettings }, '_settings were updated')
  return
  // probably get rid of all of this because it's not used
  // try {
  //   // If v3.11+, can now refresh Dashboard
  //   if (NotePlan.environment.buildVersion >= 1181) {
  //     if (isHTMLWindowOpen(pluginJson['plugin.id'])) {
  //       logDebug(pluginJson, `will refresh Dashboard as it is open`)
  //       await showDashboardReact('refresh', false) // probably don't need await
  //     }
  //   }
  // } catch (error) {
  //   logError(pluginJson, `onSettingsUpdated: ${JSP(error)}`)
  // }
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
