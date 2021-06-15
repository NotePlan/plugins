// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Specific how-to: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md
// Add a line for each function that you want NP to have access to
// The beauty of this set-up is that each NP command can have its own file
// And will be packaged together into one file for NP to load
// from Terminal: npm run autowatch (should watch and re-bundle every time you edit)
// Typically, listed below are only the top-level plug-in functions listed in plugin.js
export { default as insertPluginFunctionNameHere } from './insertPluginFunctionNameHere'
