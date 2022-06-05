// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// export async function [name of the function called by Noteplan]
// then include that function name as an export in the index.js file also
// Type checking reference: https://flow.org/
// Specific how-to re: Noteplan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPHelloWorld.js
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have corresponding tests
// support/utils is an example of a testable file that is used by the plugin command

import utils from './support/utils'
import { log, logError, clo, JSP } from '../../helpers/dev'
import { createRunPluginCallbackUrl } from '../../helpers/general'
import pluginJson from '../plugin.json'

export async function sayHello(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    if (incoming?.length) {
      // if incoming is set, this plugin/command run must have come from a runPlugin call (e.g. clicking on a noteplan:// xcallback link or a template call)
      Editor.insertTextAtCursor(
        `You clicked the link! The message at the end of the link is "${incoming}". Now the rest of the plugin will run just as before...\n\n`,
      )
    }

    // a call to a support function in a separate file
    const message = utils.uppercase('Hello World from Test Plugin!')

    // this will appear in NotePlan Plugin Console (NotePlan > Help > Plugin Console)
    log(pluginJson, `The plugin says: ${message}`)

    // Get some info from the plugin settings panel (where users can change settings)
    const settings = DataStore.settings // Plugin settings documentation: https://help.noteplan.co/article/123-plugin-configuration
    const settingsString = settings.settingsString ?? ''
    // this will be inserted at cursor position in the Editor
    Editor.insertTextAtCursor(
      `${message}\n\nThis came from the Plugin Settings Panel: **"${settingsString}"** (You should go now to Preferences > Plugins, click the "cog" next to this plugin name and change the text. When you run this plugin again, you will see the new setting text.\n\n`,
    )

    // This will Console Log an Object that comes from the NotePlan API (in this case, the currently-open Note's paragraphs)
    clo(Editor.note?.paragraphs, `The note paragraphs:`)

    if (!incoming?.length) {
      // Create a XCallback URL that can run this command
      const url = createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name, [
        'This text was in the link!',
      ])
      Editor.insertTextAtCursor(
        `This link could be used anywhere inside or outside of NotePlan to call this plugin:\n${url}\nGo ahead and click it! ^^^\nYou will see the results below:\n\n*****\n`,
      )
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
