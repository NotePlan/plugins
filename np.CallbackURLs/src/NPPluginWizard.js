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
import { log, logError, clo, JSP, chooseRunPluginXCallbackURL } from '../../helpers/dev'
import { createRunPluginCallbackUrl } from '../../helpers/general'
import pluginJson from '../plugin.json'
import { chooseOption, showMessage } from '@helpers/userInput'

// https://help.noteplan.co/article/49-x-callback-url-scheme#addnote

export async function runPluginWizard(incoming: ?string = ''): Promise<void> {
  try {
    let url = '',
      canceled = false

    const options = [
      { label: 'OPEN a note', value: 'openNote' },
      { label: 'ADD text to a note', value: 'addText' },
      { label: 'Add a NEW NOTE with title and text', value: 'addNote' },
      { label: 'DELETE a note by title', value: 'deleteNote' },
      { label: 'Select a TAG in the sidebar', value: 'selectTag' },
      { label: 'SEARCH for text in a type of notes', value: 'search' },
      { label: 'Get NOTE INFO (x-success) for use in another app', value: 'noteInfo' },
      { label: 'Run a Plugin Command', value: 'runPlugin' },
    ]
    const res = await chooseOption(`Select an X-Callback type`, options, '')
    switch (res.value) {
      case '':
        log(pluginJson, 'No option selected')
        canceled = true
        break
      case 'runPlugin':
        url = await chooseRunPluginXCallbackURL()
        break
      default:
        showMessage(`${res.value}: This type is not yet available in this plugin`, 'OK', 'Sorry!')
        break
    }
    // ask if they want x-success and add it if so

    if (!canceled) {
      Editor.insertTextAtCursor(url)
      Clipboard.string = url
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
