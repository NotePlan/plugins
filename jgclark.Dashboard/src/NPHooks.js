/* eslint-disable require-await */
// @flow
// Last updated 2026-01-22 for v2.4.0 by @jgclark

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
// import { getLogSettings, setPluginData } from './dashboardHelpers'
import { logError, JSP } from '@helpers/dev'
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
 */
export async function onSettingsUpdated(): Promise<void> {
  return
}

// Note: a updateSettings() function is not needed as Dashboard has its own built-in settings window.

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
