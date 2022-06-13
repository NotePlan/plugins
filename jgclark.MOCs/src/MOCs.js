// @flow
//-----------------------------------------------------------------------------
// Last updated 11.6.2022 for v0.2.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherMatchingLines,
} from '@helpers/NPparagraph'
import {
  nowLocaleDateTime,
} from '@helpers/dateTime'
import { clo, log, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import {
  displayTitle,
} from '@helpers/general'
import {
  findEndOfActivePartOfNote,
} from '@helpers/paragraph'
import {
  replaceContentUnderHeading
} from '@helpers/NPparagraph'
import {
  chooseFolder,
  chooseOption,
  getInput,
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

const configKey = 'mocs'

export type headingLevelType = 1 | 2 | 3 | 4 | 5
export type MOCsConfig = {
  caseInsensitive: boolean,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  resultPrefix: string,
  resultSortOrder: string,
  showEmptyOccurrences: boolean,
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 *
 * @return {MOCsConfig} object with configuration
 */
export async function getMOCsSettings(): Promise<any> {
  log(pluginJson, `Start of getMOCsSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: MOCsConfig = await DataStore.loadJSON('../jgclark.MOCs/settings.json')
    // clo(v2Config, `${configKey} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${configKey}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

/**
 * Make or update a Map of Content note
 * @author @jgclark
 */
export async function makeMOC(): Promise<void> {
  // get relevant settings
  let config = await getMOCsSettings()

  // Get strings to search for
  let stringsToMatch = ''
  const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Make MOC`, '')
  if (typeof newTerms === 'boolean') {
    // i.e. user has cancelled
    log(pluginJson, `User has cancelled operation.`)
    return
  } else {
    stringsToMatch = Array.from(newTerms.split(','))
  }
  // log(pluginJson, `makeMOC: looking for '${String(stringsToMatch)}' over all notes:`)


  // Get note title + folder to write to
  const requestedTitle = await getInput(`What do you want to call this note?`, 'OK', 'Make MOC', `${newTerms} MOC`)
  if (typeof requestedTitle === 'boolean') {
    // i.e. user has cancelled
    logWarn(pluginJson, `User has cancelled operation.`)
    return
  }
  const folderName = await chooseFolder(`Which folder do you want to store this MOC in?`)
  if (typeof folderName === 'boolean') {
    // i.e. user has cancelled
    logWarn(pluginJson, `User has cancelled operation.`)
    return
  }

  let note: ?TNote
  // See if this note has already been created (in active notes, not Archive or Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
  const existingEntries: Array<string> = []
  log(pluginJson, `  found ${existingNotes.length} existing ${requestedTitle} notes`)
  if (existingNotes.length > 0) {
    note = existingNotes[0] // pick the first if more than one
    log(pluginJson, `  will write MOC to existing note: ${displayTitle(note)}`)
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
    log(pluginJson, `Will write MOC to the new note '${displayTitle(note)}'`)
  }

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

  // Sort this list by whatever the user's setting says
  // (Need to do this before the gatherMatchingLines, as afterwards we don't have date information.)
  switch (config.resultSortOrder) {
    case 'alphabetical':
      projectNotesToInclude.sort((a, b) => (displayTitle(a).toUpperCase() < displayTitle(b).toUpperCase() ? -1 : 1))
      break
    case 'createdDate':
      projectNotesToInclude.sort((a, b) => (a.createdDate > b.createdDate ? -1 : 1))
      break
    default: // updatedDate
      projectNotesToInclude.sort((a, b) => (a.changedDate > b.changedDate ? -1 : 1))
      break
  }

  // Main loop: find entries and then decide whether to add or not
  log(pluginJson, `makeMOC: looking for '${String(stringsToMatch)}' over all notes:`)
  // Find matches in this set of notes
  for (const searchTerm of stringsToMatch) {
    const outputArray = []
    const results = await gatherMatchingLines(projectNotesToInclude, searchTerm, false, 'none', config.caseInsensitive)
    let resultTitles = results?.[1]
    if (resultTitles.length > 0) {
      // dedupe results by making and unmaking it into a set
      let uniqTitlesAsLinks = [...new Set(resultTitles)]
      // remove [[ and ]]
      let uniqTitles: Array<string> = uniqTitlesAsLinks.map((element) => {
        return element.slice(2, -2)
      })
      // remove this note title (if it exists)
      uniqTitles = uniqTitles.filter((t) => t !== requestedTitle)

      if (uniqTitles.length > 0) {
        // Decide whether to add this section
        const myn = await showMessageYesNo(`There are ${uniqTitles.length} matches for '${searchTerm}'. Shall I add them?`, ['Yes', 'No', 'Cancel'], `Make MOC: ${requestedTitle}`)
        if (typeof myn === 'boolean' || myn === 'Cancel') {
          // i.e. user has cancelled
          log(pluginJson, `User has cancelled operation.`)
          return
        }
        if (myn === 'Yes') {
          // write all (wanted) lines out out, starting with a heading if needed
          for (let i = 0; i < uniqTitles.length; i++) {
            outputArray.push(`${config.resultPrefix} [[${uniqTitles[i]}]]`)
          }
          // Write new lines to end of active section of note
          replaceContentUnderHeading(note, `'${searchTerm}'`, outputArray.join('\n'), true, config.headingLevel)
        }
      } else {
        if (config.showEmptyOccurrences) {
          replaceContentUnderHeading(note, `'${searchTerm}'`, `No notes found`, true, config.headingLevel)
        } else {
          log(pluginJson, `- no matches for search term '${searchTerm}'`)
        }
      }
    } else {
      if (config.showEmptyOccurrences) {
        replaceContentUnderHeading(note, `'${searchTerm}'`, `No notes found`, true, config.headingLevel)
      } else {
        log(pluginJson, `- no matches for search term '${searchTerm}'`)
      }
    }
  }

  // log(pluginJson, `Written results to note '${requestedTitle}'`)
  await Editor.openNoteByFilename(note.filename)
}
