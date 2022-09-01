// @flow
// Flow typing is important for reducing errors and improving the quality of the code.
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
// Note: As you will see in this plugin folder, you can have multiple files -- e.g. one file per command or logical group of commands
// ...and separate files for helper/support functions that can be tested in isolation
// The `autowatch` packager combines them all into one script.js file for NotePlan to read
// From the command line:
// `noteplan-cli plugin:dev {{pluginId}} --test --watch --coverage`
// ...will watch for changes and will compile the Plugin script code
// and copy it to your plugins directory where NotePlan can find it
// Since NP reloads the Javascript every time you CMD-J to insert a plugin,
// you can immediately test the new code without restarting NotePlan
// This index.js file is where the packager starts looking for files to combine into one script.js file
// So you need to add a line below for each function that you want NP to have access to.
// Typically, listed below are only the top-level plug-in functions listed in plugin.json

import { showMessage } from "../../helpers/userInput";

export { chooseTheme, changePreset, setDefaultLightDarkTheme, toggleTheme, setPreset01, setPreset02, setPreset03, setPreset04, setPreset05 } from './NPThemeChooser' // add one of these for every command specifified in plugin.json (the function could be in any file as long as it's exported)

// Do not change this line. This is here so your plugin will get recompiled every time you change your plugin.json file
import pluginJson from '../plugin.json'
import { saveThemeNameAsCommand } from './NPThemeChooser'
import { log, clo } from '@helpers/dev'
import { /* getPluginJson ,*/ updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'

/*
 * NOTEPLAN HOOKS
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 */

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  log(pluginJson, 'NPThemeChooser::onUpdateOrInstall running')
  await updateSettingData(pluginJson)
  const settings = DataStore.settings
  const keys = Object.keys(settings)
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    if (key.includes('setPreset')) {
      log(pluginJson, `NPThemeChooser::onUpdateOrInstall ${key}=${settings[key]}`)
      await saveThemeNameAsCommand(key, settings[key])
    }
  }
  // clo(pluginJson, `Before plugin update/install, pluginJson is:`)
  // const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
  // clo(livePluginJson, `After plugin update/install, pluginJson is:`)
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export async function init(): void {
  clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {}
