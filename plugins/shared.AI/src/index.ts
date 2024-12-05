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

// FETCH mocking for offline testing:
// Comment this line out if you want to use live fetch/server endpoints
// uncomment it for using server mocks in support/fetchOverrides.js
// import './support/fetchOverrides'

// chat
// export { updateSettings } from './settings'
import pluginJson from '../plugin.json'
import { showMessage } from '@np/helpers/userInput'

export { editSettings } from '@np/helpers/NPSettings'
export { getChat, insertChat, createChat, continueChat } from './chat'
export { summarizeNote } from './summarize'

export { testConnection, introWizard, helpWizard } from './NPAI' // add one of these for every command specifified in plugin.json (the function could be in any file as long as it's exported)
export { createResearchRequest, createResearchListRequest, createQuickSearch, updateREADME, noteToPrompt } from '../non-implemented_functions'
export { bulletsAI, createResearchDigSite, remixQuery, explore, researchFromSelection, moveNoteToResearchCollection } from './BulletsAI-Main'
export { adjustPreferences, scrollToEntry, listEndpoints } from './support/helpers'
export { createAIImages } from './imageAI'
export { changeDefaultMaxTokens, changeTargetSummaryParagraphs, changeDefaultTargetKeyTerms, setOpenAIAPIKey } from './support/settingsAdjustments'
export { firstLaunch } from '../src/support/onboarding'

/*
 * NOTEPLAN HOOKS
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 */

// eslint-disable-next-line import/order
import { updateSettingData, pluginUpdated, getPluginJson } from '@np/helpers/NPConfiguration'
import { logError, JSP, clo } from '@np/helpers/dev'
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
    clo(DataStore.settings, `${pluginJson['plugin.id']} init running. Plugin Settings`)
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

/**
 * Check the version of the plugin (and force an update if the version is out of date)
 */
export async function versionCheck(): Promise<void> {
  try {
    await showMessage(`Current Version: ${pluginJson['plugin.version']}`, 'OK', `${pluginJson['plugin.name']}`, true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
