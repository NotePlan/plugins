// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Specific how-to: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
// The beauty of this set-up is that each NP command can have its own file
// And all will be packaged together into one file for NP to load
// from Terminal: npm run autowatch (should watch and re-bundle every time you edit)
// `npm run autowatch` will watch for changes and will compile the Plugin script code
// and copy it to your plugins directory
// Since NP reloads the Javascript every time you CMD-J to insert a plugin,
// you can immmediately test the new code with NP
// Add a line below for each function that you want NP to have access to.
// Typically, listed below are only the top-level plug-in functions listed in plugin.json
export { pluginTester } from './pluginTester'
