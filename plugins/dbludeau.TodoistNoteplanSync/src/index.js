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

export { syncToday, syncEverything, syncProject, syncAllProjects, syncAllProjectsAndToday } from './NPPluginMain' 

// FETCH mocking for offline testing
// If you want to use external server calls in your plugin, it can be useful to mock the server responses
// while you are developing the plugin. This allows you to test the plugin without having to
// have a server running or having to have a network connection (or wait/pay for the server calls)
// Comment the following import line out if you want to use live fetch/server endpoints (normal operation)
// Uncomment it for using server mocks (fake/canned responses) you define in support/fetchOverrides.js
// import './support/fetchOverrides'

/**
 * Other imports/exports - you will normally not need to edit these
 */
// eslint-disable-next-line import/order
export { editSettings } from '@helpers/NPSettings'
export { onUpdateOrInstall, init, onSettingsUpdated } from './NPTriggers-Hooks'
export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'
