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

import { log, logError, clo, JSP } from '../../helpers/dev'
import { createOpenNoteCallbackUrl } from '../../helpers/general'
import { chooseRunPluginXCallbackURL } from '@helpers/NPdev'
import pluginJson from '../plugin.json'
import { chooseOption, showMessage, chooseHeading, chooseFolder } from '@helpers/userInput'

// https://help.noteplan.co/article/49-x-callback-url-scheme#addnote

async function chooseNote(
  includeProjectNotes: boolean = true,
  includeCalendarNotes: boolean = false,
  foldersToIgnore: Array<string> = [],
): {} {
  let noteList = []
  const projectNotes = DataStore.projectNotes
  const calendarNotes = DataStore.calendarNotes
  if (includeProjectNotes) {
    noteList = noteList.concat(projectNotes)
  }
  if (includeCalendarNotes) {
    noteList = noteList.concat(calendarNotes)
  }
  const noteListFiltered = noteList.filter((note) => {
    // filter out notes that are in folders to ignore
    let isInIgnoredFolder = false
    foldersToIgnore.forEach((folder) => {
      if (note.filename.includes(`${folder}/`)) {
        isInIgnoredFolder = true
      }
    })
    return !isInIgnoredFolder
  })
  const opts = noteListFiltered.map((note) => {
    return note.title && note.title !== '' ? note?.title : note?.filename
  })
  const re = await CommandBar.showOptions(opts, 'Choose note')
  return noteListFiltered[re.index]
}

async function getOpenNoteURL(): string {
  const note = await chooseNote()
  const hasTitle = note.title && note.title !== ''
  return createOpenNoteCallbackUrl(hasTitle ? note.title : note.filename, !hasTitle) //title,isFilename,heading
}

/**
 * Walk user through creation of a xcallback url
 * @param {string} incoming - text coming in from a runPlugin link
 */
export async function xCallbackWizard(incoming: ?string = ''): Promise<void> {
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
    const item = options.find((i) => i.value === res)
    switch (res) {
      case '':
        log(pluginJson, 'No option selected')
        canceled = true
        break
      case 'openNote':
        url = await getOpenNoteURL()
        break
      case 'runPlugin':
        url = await chooseRunPluginXCallbackURL()
        break
      default:
        showMessage(`${res}: This type is not yet available in this plugin`, 'OK', 'Sorry!')
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
