// @flow
//-----------------------------------------------------------------------------
// Last updated 29.5.2022 for v0.8.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherMatchingLines,
  getSummariesSettings,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  nowLocaleDateTime,
} from '@helpers/dateTime'
import { log, logWarn, logError } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  displayTitle,
  // stringReplace,
} from '@helpers/general'
import {
  findEndOfActivePartOfNote,
  // removeSection
} from '@helpers/paragraph'
import {
  chooseFolder,
  chooseOption,
  getInput,
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Make or update a Map of Content note
 * @author @jgclark
 */
export async function makeMOC(): Promise<void> {
  // get relevant settings
  let config = await getSummariesSettings()

  let stringsToMatch = ['God was', 'wedding']
  let requestedTitle = 'NW-3'
  let folderName = '/'
  // // Get strings to search for
  // let stringsToMatch = ''
  // const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Search`, '')
  // if (typeof newTerms === 'boolean') {
  //   // i.e. user has cancelled
  //   log(pluginJson, `User has cancelled operation.`)
  //   return
  // } else {
  //   stringsToMatch = Array.from(newTerms.split(','))
  // }
  // log(pluginJson, `makeMOC: looking for '${String(stringsToMatch)}' over all notes:`)


  // // Get note title + folder to write to
  // const requestedTitle = await getInput(`What do you want to call this note?`)
  // if (typeof requestedTitle === 'boolean') {
  //   // i.e. user has cancelled
  //   logWarn(pluginJson, `User has cancelled operation.`)
  //   return
  // }
  // const folderName = await chooseFolder(`Which folder do you want to store this MOC in?`)
  // if (typeof folderName === 'boolean') {
  //   // i.e. user has cancelled
  //   logWarn(pluginJson, `User has cancelled operation.`)
  //   return
  // }

  let note: ?TNote
  // first see if this note has already been created
  // (look only in active notes, not Archive or Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
  const existingEntries: Array<string> = []
  log(pluginJson, `  found ${existingNotes.length} existing ${requestedTitle} notes`)
  if (existingNotes.length > 0) {
    note = existingNotes[0] // pick the first if more than one

    // As note exists already, read in the current MOC entries
    // TODO: existingEntries ...

    log(pluginJson, `  will write MOC to existing note: ${displayTitle(note)} with following entries:`)
    console.log(existingEntries.toString())

  } else {
    // make a new note for this. NB: filename here = folder + filename
    const noteFilename = DataStore.newNote(requestedTitle, folderName) ?? ''
    if (noteFilename === '') {
      log(pluginJson, `  Error creating new note (filename '${noteFilename}')`)
      await showMessage('There was an error creating the new note')
      return
    }
    log(pluginJson, `  newNote filename: ${noteFilename}`)
    note = DataStore.projectNoteByFilename(noteFilename)
    if (note == null) {
      logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
      await showMessage('There was an error getting the new note ready to write')
      return
    }
  }
  log(pluginJson, `Will write MOC to the new note '${displayTitle(note)}'`)

  // Create list of project notes not in excluded folders
  const allProjectNotes = DataStore.projectNotes
  const projectNotesToInclude = []
  // Iterate over the folders ...
  for (const pn of allProjectNotes) {
    const thisFolder = getFolderFromFilename(pn.filename)
    if (!config.foldersToExclude.includes(thisFolder)) {
      projectNotesToInclude.push(pn)
    } else {
      // log(pluginJson, `  excluded note '${pn.filename}'`)
    }
  }
  log(pluginJson, `Will use ${projectNotesToInclude.length} project notes out of ${allProjectNotes.length}`)

  // Main loop: find entries and then decide whether to add or not
  log(pluginJson, `makeMOC: looking for '${String(stringsToMatch)}' over all notes:`)
  // Find matches in this set of notes
  const outputArray = []
  for (const searchTerm of stringsToMatch) {
    const results = await gatherMatchingLines(projectNotesToInclude, searchTerm, false, 'none')
    // const lines = results?.[0] // Don't need these
    const resultTitles = results?.[1]
    if (resultTitles.length > 0) {
      // dedupe results
      const uniqTitles = [...new Set(resultTitles)]
      console.log(uniqTitles.toString())
      // remove this note title (if it exists)
      uniqTitles.filter((t) => t !== requestedTitle)

      // Decide whether to work interactively (checking each possible entry) for this section
      const myn = await showMessageYesNo(`There are ${uniqTitles.length} matches. Shall I add them all, or would you like to decide about each one?`, ['Add all', 'Ask for each', 'Cancel'], `Make MOC`)
      if (typeof myn === 'boolean' || myn === 'Cancel') {
        // i.e. user has cancelled
        log(pluginJson, `User has cancelled operation.`)
        return
      }
      const workInteractively: boolean = (myn === 'Add all') ? false : true
      // If users wants to select each, then remove those they don't want
      if (myn !== 'Add all') {
        let i = 0
        for (const e of uniqTitles) {
          const addyn = await showMessageYesNo(`Add '${e}' to MOC in section ${searchTerm}?`, ['Yes', 'No'], `Make MOC '${requestedTitle}'`)
          if (typeof addyn === 'boolean' || addyn === 'Cancel') {
            // i.e. user has cancelled
            log(pluginJson, `User has cancelled operation.`)
            return
          }
          if (addyn === 'No') {
            log(pluginJson, `Removing ${i}: ${e}`) // FIXME: NW-3 appears!
            uniqTitles.splice(i, 1)
          }
          i++
        }
      }

      // write all (wanted) lines out out, starting with a heading if needed
      outputArray.push(`### '${searchTerm}'`)
      for (let i = 0; i < uniqTitles.length; i++) {
        outputArray.push(`${config.resultPrefix} ${uniqTitles[i]}`)
      }
      log(pluginJson, `  Found ${uniqTitles.length} results for '${searchTerm}'`)

    } else if (config.showEmptyOccurrences) {
      // If there's nothing to report, note that in the log
      logWarn(pluginJson, `no matches for search term '${searchTerm}'`)
    }
  }

  // Write new lines to end of active section of note
  note.insertParagraph(
    outputArray.join('\n'),
    findEndOfActivePartOfNote(note),
    'text',
  )
  log(pluginJson, `Written results to note '${requestedTitle}'`)
  await Editor.openNoteByFilename(note.filename)
}
