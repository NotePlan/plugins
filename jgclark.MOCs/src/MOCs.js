// @flow
//-----------------------------------------------------------------------------
// Last updated 24.7.2022 for v0.2.2+, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  gatherMatchingLines,
  replaceContentUnderHeading
} from '@helpers/NPParagraph'
import { clo, logInfo, logDebug, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import {
  chooseFolder,
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
  logDebug(pluginJson, `Start of getMOCsSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: MOCsConfig = await DataStore.loadJSON('../jgclark.MOCs/settings.json')
    clo(v2Config, `${configKey} settings from V2:`)

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
 * Updated to allow use by x-callback, and therefore to have a 'refresh' pseudo-button in MOCs.
 * @author @jgclark
 * @param {string?} filenameArg optional filename of MOC to write to
 * @param {string?} termsArg optional comma-settings list of search term(s) to use
 */
export async function makeMOC(filenameArg?: string, termsArg?: string): Promise<void> {
  try {
  // get relevant settings
  const config = await getMOCsSettings()
    let termsToMatch = []
    let termsToMatchStr = ''
    let noteFilename = ''
    let note: ?TNote
    let requestedTitle = ''

    // If we have 2 passed arguments, then use those instead of asking the user.
    // This allows use by x-callback, and therefore to have a 'refresh' pseudo-button in MOCs.
    // If we both arguments, then use those
    if (filenameArg !== undefined && termsArg !== undefined) {
      noteFilename = noteFilename
      termsToMatch = Array.from(termsArg.split(','))
      termsToMatchStr = termsArg
      logDebug(pluginJson, `- called with 2 args: filename '${noteFilename}' / strings '${termsToMatchStr}'`)
      note = DataStore.projectNoteByFilename(noteFilename)
      if (note == null) {
        logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
        await showMessage('There was an error getting the new note ready to write')
        return
      }
    }
    else {
      // Get details interactively from user
      // Get strings to search for
      const newTerms = await getInput(`Enter search term (or comma-separated set of terms)`, 'OK', `Make MOC`, '')
      if (typeof newTerms === 'boolean') {
        // i.e. user has cancelled
        logDebug(pluginJson, `User has cancelled operation.`)
        return
      } else {
        termsToMatch = Array.from(newTerms.split(','))
      }
      logDebug(pluginJson, `makeMOC: looking for '${String(termsToMatch)}' over all notes:`)

      // Get note title + folder to write to
      requestedTitle = await getInput(`What do you want to call this note?`, 'OK', 'Make MOC', `${newTerms} MOC`)
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

      // See if this note has already been created (in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
      logDebug(pluginJson, `  found ${existingNotes.length} existing '${requestedTitle}' notes`)

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        logDebug(pluginJson, `  will write MOC to existing note: ${displayTitle(note)}`)
      } else {
      // make a new note for this. NB: filename here = folder + filename
        // (API says don't add "/" for root, though.)
        noteFilename = DataStore.newNote(requestedTitle, folderName) ?? ''
        if (noteFilename === '') {
          logError(pluginJson, `Error creating new note (filename '${noteFilename}')`)
          await showMessage('There was an error creating the new note')
          return
        }
        logDebug(pluginJson, `  newNote filename: ${noteFilename}`)
        note = DataStore.projectNoteByFilename(noteFilename)

        if (note == null) {
          logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
        logDebug(pluginJson, `Will write MOC to the new note '${displayTitle(note)}'`)
      }
    }

    // Add an x-callback link under the title to allow this MOC to be re-created
    const xCallbackLine = `[Click to refresh these results](noteplan://x-callback-url/runPlugin?pluginID=jgclark.MOC&command=make%20MOC&arg0=${encodeURIComponent(noteFilename)}&arg1=${encodeURIComponent(termsToMatchStr)})`
    // Either replace the existing line that starts the same way, or insert a new line after the title, so as not to disrupt any other section headings
    const line1content = (note.paragraphs.length >= 2) ? note.paragraphs[1].content : ''
    logDebug(pluginJson, line1content)
    if (line1content?.startsWith('[Click to refresh these results](noteplan://x-callback-url/')) {
      logDebug(pluginJson, 'update xcallback at line 1')
      note.paragraphs[1].content = xCallbackLine
      note.updateParagraph(note.paragraphs[1])
    } else {
      logDebug(pluginJson, 'insert xcallback at line 1')
      note.insertParagraph(xCallbackLine, 1, 'text')
    }
    // TODO: test calling from x-callback

    // Create list of project notes not in excluded folders
    const allProjectNotes = DataStore.projectNotes
    const projectNotesToInclude = []
    // Iterate over the folders ...
    for (const pn of allProjectNotes) {
      const thisFolder = getFolderFromFilename(pn.filename)
      if (!config.foldersToExclude.includes(thisFolder)) {
        projectNotesToInclude.push(pn)
      } else {
        // logDebug(pluginJson, `  excluded note '${pn.filename}'`)
      }
    }
    logDebug(pluginJson, `Will use ${projectNotesToInclude.length} project notes out of ${allProjectNotes.length}`)

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
    logDebug(pluginJson, `makeMOC: looking for '${String(termsToMatch)}' over all notes:`)
    // Find matches in this set of notes
    for (const searchTerm of termsToMatch) {
      const outputArray = []
      const results = await gatherMatchingLines(projectNotesToInclude, searchTerm, false, 'none', config.caseInsensitive)
      const resultTitles = results?.[1]
      if (resultTitles.length > 0) {
        // dedupe results by making and unmaking it into a set
        const uniqTitlesAsLinks = [...new Set(resultTitles)]
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
            logDebug(pluginJson, `User has cancelled operation.`)
            return
          }
          if (myn === 'Yes') {
            // write all (wanted) lines out out, starting with a heading if needed
            for (let i = 0; i < uniqTitles.length; i++) {
              outputArray.push(`${config.resultPrefix} [[${uniqTitles[i]}]]`)
            }
            // Write new lines to end of active section of note
            // FIXME: work out why this line gets undone by the following note changes.
            replaceContentUnderHeading(note, `Notes matching '${searchTerm}'`, outputArray.join('\n'), true, config.headingLevel)
          }
        } else {
          if (config.showEmptyOccurrences) {
            replaceContentUnderHeading(note, `'${searchTerm}'`, `No notes found`, true, config.headingLevel)
          } else {
            logWarn(pluginJson, `- no matches for search term '${searchTerm}'`)
          }
        }
      } else {
        if (config.showEmptyOccurrences) {
          replaceContentUnderHeading(note, `'${searchTerm}'`, `No notes found`, true, config.headingLevel)
        } else {
          logWarn(pluginJson, `- no matches for search term '${searchTerm}'`)
        }
      }
    }

    // Open the newly-written MOC note
    // logDebug(pluginJson, `Written results to note '${requestedTitle}'`)
    await Editor.openNoteByFilename(note.filename)
  }
  catch (err) {
    logError(pluginJson, `${err.message}'`)
  }
}
