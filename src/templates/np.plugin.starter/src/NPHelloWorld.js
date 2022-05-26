// @flow
// If you're not up for Flow typechecking (it's quite an undertaking), delete the line above
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export default async function [name of the function called by Noteplan]
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPHelloWorld.js
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have corresponding tests

import utils from './support/utils'
import { log, logError, clo, JSP } from '../../helpers/dev'
import pluginJson from '../plugin.json'

export async function sayHello(): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    const message = utils.uppercase('Hello World from Test Plugin!') // a call to a support function

    // this will appear in NotePlan Plugin Console (NotePlan > Help > Plugin Console)
    log(pluginJson, `The plugin says: ${message}`)
    // This will Console Log an Object that comes from the NotePlan API (in this case, the currently-open Note)
    clo(Editor.note, `The note params:`)

    // Get some info from the plugin settings panel (where users can change settings)
    const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    const settingsString = settings.settingsString ?? ''
    // this will be inserted at cursor position in the Editor
    Editor.insertTextAtCursor(`${message}\n...and this came from the Plugin Settings Panel: "${settingsString}"`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
