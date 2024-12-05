// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev {{pluginId}} --test --watch --coverage`
// IMPORTANT: It's a good idea for you to open the settings ASAP in NotePlan Preferences > Plugins and set your plugin's logging level to DEBUG

/**
 * LOGGING
 * A user will be able to set their logging level in the plugin's settings (if you used the plugin:create command)
 * As a general rule, you should use logDebug (see below) for messages while you're developing. As developer,
 * you will set your log level in your plugin preferences to DEBUG and you will see these messages but
 * an ordinary user will not. When you want to output a message,you can use the following.
 * logging level commands for different levels of messages:
 *
 * logDebug(pluginJson,"Only developers or people helping debug will see these messages")
 * log(pluginJson,"Ordinary users will see these informational messages")
 * logWarn(pluginJson,"All users will see these warning/non-fatal messages")
 * logError(pluginJson,"All users will see these fatal/error messages")
 */
import pluginJson from '../plugin.json'
import * as helpers from './support/helpers'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'

// NOTE: Plugin entrypoints (jsFunctions called by NotePlan) must be exported as async functions or you will get a TypeError in the NotePlan plugin console
// if you do not have an "await" statement inside your function, you can put an eslint-disable line like below so you don't get an error
// eslint-disable-next-line require-await
export async function sayHello(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    if (incoming?.length) {
      // When commands are  launched from NotePlan Command Bar, they are passed with no arguments
      // if `incoming` is set, this plugin/command run must have come from a runPlugin call (e.g. clicking on a noteplan:// xcallback link or a template call)
      Editor.insertTextAtCursor(`***You clicked the link!*** The message at the end of the link is "${incoming}". Now the rest of the plugin will run just as before...\n\n`)
    }

    // a call to a support function in a separate file
    const message = helpers.uppercase('Hello World from Test Plugin!')

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
      const url = createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name, ['This text was in the link!'])
      Editor.insertTextAtCursor(
        `This link could be used anywhere inside or outside of NotePlan to call this plugin:\n${url}\nGo ahead and click it! ^^^\nYou will see the results below:\n\n*****\n`,
      )
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
