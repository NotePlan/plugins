// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Specific how-to: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
// The beauty of this set-up is that each NP command can have its own file
// And all will be packaged together into one file for NP to load
// from Terminal: npm run autowatch (should watch and re-bundle every time you edit)
// `npm run autowatch` will watch for changes and will compile the Plugin script code
// and copy it to your plugins directory
// Since NP reloads the Javascript every time you CMD-J to insert a plugin,
// you can immediately test the new code with NP
// Add a line below for each function that you want NP to have access to.
// Typically, listed below are only the top-level plug-in functions listed in plugin.json

// including so rollup will trigger build when plugin.json is modified

import pluginJson from '../plugin.json'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData } from '@helpers/NPconfiguration'

export { xCallbackWizard } from './NPXCallbackWizard' // this makes the command function available to NotePlan (see plugin.json for details)

export async function onUpdateOrInstall(): Promise<void> {
  // this runs after the plugin is installed or updated. the following command updates the plugin's settings data
  updateSettingData(pluginJson)
}

export async function init(): Promise<void> {
  // this runs every time the plugin starts up (any command in this plugin is run)
  // normally, you don't need to do anything here
  // the command-specific entrypoints (e.g. sayHello in the helloWorld.js file is where you'll do your work)
}

export async function onSettingsUpdated(): Promise<void> {
  // you probably won't need to use this...it's fired when the settings are updated in the Preferences panel
}
