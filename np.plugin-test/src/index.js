// @flow
export { pluginTester, testOutputEditorContents, doNothing } from './pluginTester'
export { generatePluginCommandList, installPlugin } from './commandListGenerator'
export { generatePluginCommandListHTML } from './pluginCommandsPopup'

// Do not change this line. This is here so your plugin will get recompiled every time you change your plugin.json file
import pluginJson from '../plugin.json'

/*
 * NOTEPLAN HOOKS
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 */

// eslint-disable-next-line import/order
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { logError, JSP, clo } from '@helpers/dev'
/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  await updateSettingData(pluginJson)
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
// eslint-disable-next-line require-await
export async function init(): Promise<void> {
  try {
    clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
    // Check for the latest version of this plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) => pluginUpdated(pluginJson, r))
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {}
