// @flow

export { createEvents } from './NPEventBlocks' // add one of these for every command specifified in plugin.json (the function could be in any file as long as it's exported)

// Do not change this line. This is here so your plugin will get recompiled every time you change your plugin.json file
import pluginJson from '../plugin.json'

/*
 * NOTEPLAN HOOKS
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 */

// eslint-disable-next-line import/order
import { updateSettingData } from '@helpers/NPConfiguration'

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
export async function init(): Promise<void> {}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {}
