// @flow
//-----------------------------------------------------------------------------
// Last updated 15.8.2023 for v0.3.0+, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import { createRunPluginCallbackUrl, displayTitle } from '@helpers/general'
import { getOrMakeNote, replaceSection } from '@helpers/note'
import { projectNotesFromFilteredFolders } from '@helpers/note'
import { noteOpenInEditor } from '@helpers/NPWindows'
import {
  chooseFolder,
  getInput,
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

const pluginID = 'jgclark.MOCs'

export type headingLevelType = 1 | 2 | 3 | 4 | 5
export type MOCsConfigType = {
  matchWholeWords: boolean,
  foldersToExclude: Array<string>,
  headingLevel: headingLevelType,
  headingPrefix: string,
  resultPrefix: string,
  resultSortOrder: string,
  showEmptyOccurrences: boolean,
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 *
 * @return {MOCsConfigType} object with configuration
 */
export async function getMOCsSettings(): Promise<any> { // want to use 'Promise<MOCsConfigType>' but too many Flow problems result
  logDebug(pluginJson, `Start of getMOCsSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: MOCsConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    clo(v2Config, `${pluginID} settings:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }
    return v2Config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
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
    const config: MOCsConfigType = await getMOCsSettings()
    let termsToMatch: Array<string> = []
    let termsToMatchStr = ''
    let noteFilename = ''
    let note: ?TNote
    let requestedTitle: string

    // If we have 2 passed arguments, then use those instead of asking the user.
    // This allows use by x-callback, and therefore to have a 'refresh' pseudo-button in MOCs.
    // If we both arguments, then use those
    if (filenameArg !== undefined && termsArg !== undefined) {
      noteFilename = filenameArg
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
        termsToMatchStr = newTerms
      }
      logDebug(pluginJson, `makeMOC: looking for '${String(termsToMatch)}' over all notes:`)

      // Get note title + folder to write to
      const res2 = await getInput(`What do you want to call this note?`, 'OK', 'Make MOC', `${newTerms} MOC`)
      if (typeof res2 === 'boolean') {
        // i.e. user has cancelled
        logWarn(pluginJson, `User has cancelled operation.`)
        return
      } else {
        requestedTitle = res2
      }

      // Check to see if note already exists (in active notes, not Archive or Trash). If so, reuse it. Otherwise ask for location for new note.
      let folderName
      const possibleNotes = DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
      if (possibleNotes.length === 0) {
        folderName = await chooseFolder(`Which folder do you want to store this MOC in?`, false, true)
        if (typeof folderName === 'boolean') {
          // i.e. user has cancelled
          logWarn(pluginJson, `User has cancelled operation.`)
          return
        }
        // Make the note
        note = await getOrMakeNote(requestedTitle, folderName)
      } else {
        note = possibleNotes[0]
        folderName = getFolderFromFilename(note.filename)
        logDebug(pluginJson, `Found ${possibleNotes.length} existing '${requestedTitle}' notes, so will re-use the first of those, from folder ${folderName}`)
      }


      // V1 method
      // const existingNotes: $ReadOnlyArray<TNote> =
      //   DataStore.projectNoteByTitle(requestedTitle, true, false) ?? []
      // logDebug(pluginJson, `  found ${existingNotes.length} existing '${requestedTitle}' notes`)

      // if (existingNotes.length > 0) {
      //   note = existingNotes[0] // pick the first if more than one
      //   logDebug(pluginJson, `  will write MOC to existing note: ${displayTitle(note)}`)
      // } else {
      // // make a new note for this. NB: filename here = folder + filename
      //   // (API says don't add "/" for root, though.)
      //   noteFilename = DataStore.newNote(requestedTitle, folderName) ?? ''
      //   if (noteFilename === '') {
      //     logError(pluginJson, `Error creating new note (filename '${noteFilename}')`)
      //     await showMessage('There was an error creating the new note')
      //     return
      //   }
      //   logDebug(pluginJson, `  newNote filename: ${noteFilename}`)
      //   note = DataStore.projectNoteByFilename(noteFilename)
      // }
    }

    if (note == null) {
      logError(pluginJson, `Can't get new note (filename: ${noteFilename})`)
      await showMessage('There was an error getting the new note ready to write')
      return
    }
    const noteToUse = note
    noteFilename = noteToUse.filename
    logDebug(pluginJson, `Will write MOC to note '${displayTitle(note)}'`)

    // Add an x-callback link under the title to allow this MOC to be re-created
    const xCallbackURL = createRunPluginCallbackUrl('jgclark.MOCs', 'make MOC', [noteToUse.filename, termsToMatchStr])
    const xCallbackLine = `Last updated: ${nowLocaleShortDateTime()} [🔄 Click to refresh](${xCallbackURL})`
    // Either replace the existing line that starts the same way, or insert a new line after the title, so as not to disrupt any other section headings
    const line1content = (noteToUse.paragraphs.length >= 2) ? noteToUse.paragraphs[1].content : ''
    // logDebug(pluginJson, `line 1 of ${String(noteToUse.paragraphs.length)}: <${line1content}>`)
    if (line1content?.includes('[🔄 Click to refresh](noteplan://x-callback-url/')) {
      noteToUse.paragraphs[1].content = xCallbackLine
      noteToUse.updateParagraph(noteToUse.paragraphs[1])
      // logDebug(pluginJson, `- updated xcallback at line 1`)
    } else {
      noteToUse.insertParagraph(xCallbackLine, 1, 'text')
      // DataStore.updateCache(note)
      // logDebug(pluginJson, `- inserted xcallback at line 1`)
    }
    // logDebug(pluginJson, `line 1 of ${String(noteToUse.paragraphs.length)}: <${noteToUse.paragraphs[1].content}>`)

    // Main loop: find entries and then decide whether to add or not
    // Find matches in this set of notes

    for (const term of termsToMatch) {
      CommandBar.showLoading(true, `Searching for ${term} ...`)
      const startTime = new Date()
      const searchTerm = term.trim()
      const headingToUse = `${(config.headingPrefix) ? config.headingPrefix + ' ' : ''}${searchTerm}`
      const outputArray = []
      // V2 method using later search API, to try to work for chinese characters 筆記
      let results = await DataStore.search(searchTerm, ['notes'], [], config.foldersToExclude)
      logDebug(pluginJson, `- found ${results.length} matches for [${searchTerm}]`)

      // If matchWholeWords is true, then now filter out those that don't align to word boundaries
      if (config.matchWholeWords) {
        const stringToLookForWithDelimiters = `[\\b\\s^]${searchTerm}[\\b\\s$]`
        const re = new RegExp(stringToLookForWithDelimiters, 'i')
        results = results.filter((t) => re.test(t.content))
        logDebug(pluginJson, `- after matchWholeWords,  ${results.length} matches for [${searchTerm}]`)
      }

      const resultNotes = results.map((r) => r.note)
      if (resultNotes.length > 0) {
        // dedupe results by making and unmaking it into a set
        let uniqNotes = resultNotes.filter((noteToUse, index, self) =>
          index === self.findIndex((t) => (
            // $FlowFixMe[incompatible-use]
            t.filename === noteToUse.filename
          ))
        )
        logDebug(pluginJson, `-> ${uniqNotes.length} different notes`)
        // remove this output note title (if it exists)
        uniqNotes = uniqNotes.filter((n) => (displayTitle(n) !== requestedTitle))

        // Sort by whatever the user's setting says
        switch (config.resultSortOrder) {
          case 'alphabetical':
            uniqNotes.sort((a, b) => (displayTitle(a).toUpperCase() < displayTitle(b).toUpperCase() ? -1 : 1))
            break
          case 'createdDate':
            // $FlowFixMe[incompatible-use]
            uniqNotes.sort((a, b) => (a.createdDate > b.createdDate ? -1 : 1))
            break
          default: // updatedDate
            // $FlowFixMe[incompatible-use]
            uniqNotes.sort((a, b) => (a.changedDate > b.changedDate ? -1 : 1))
            break
        }

        const uniqTitles = uniqNotes.map((r) => displayTitle(r))

        // V1 method using JGC's gatherMatchingLines()
        // Create list of project notes not in excluded folders, starting with NP's list of Project Notes (which only excludes the @Trash).
        // const projectNotesToUse = projectNotesFromFilteredFolders(config.foldersToExclude, true)
        // const results = await gatherMatchingLines(projectNotesToUse, searchTerm, false, 'none', config.caseInsensitive)
        // const resultTitles = results?.[1]
        // if (resultTitles.length > 0) {
        //   // dedupe results by making and unmaking it into a set
        //   const uniqTitlesAsLinks = [...new Set(resultTitles)]
        //   // remove [[ and ]]
        //   let uniqTitles: Array<string> = uniqTitlesAsLinks.map((element) => {
        //     return element.slice(2, -2)
        //   })
        //   // remove this note title (if it exists)
        //   uniqTitles = uniqTitles.filter((t) => t !== requestedTitle)

        logDebug('runSearchesV2', `- ${uniqTitles.length} results for '${searchTerm}' in ${timer(startTime)}`)
        CommandBar.showLoading(false)

        if (uniqTitles.length > 0) {
          let myn: string | boolean
          if (requestedTitle !== undefined) {
            // Decide whether to add this section
            myn = await showMessageYesNo(`There are ${uniqTitles.length} matches for '${searchTerm}'. Shall I add them?`, ['Yes', 'No', 'Cancel'], `Make MOC: ${requestedTitle}`)
            if (typeof myn === 'boolean' || myn === 'Cancel') {
              // i.e. user has cancelled
              logDebug(pluginJson, `User has cancelled operation.`)
              return
            }
          } else {
            myn = 'Yes'
          }
          if (myn === 'Yes') {
            // write all (wanted) lines out, starting with a heading if needed
            for (let i = 0; i < uniqTitles.length; i++) {
              outputArray.push(`${config.resultPrefix} [[${uniqTitles[i]}]]`)
            }
            // Write new lines to end of active section of note
            // await replaceContentUnderHeading(noteToUse, headingToUse, outputArray.join('\n'), true, config.headingLevel)
            replaceSection(noteToUse, headingToUse, headingToUse, config.headingLevel, outputArray.join('\n'))
          }
        } else {
          if (config.showEmptyOccurrences) {
            // await replaceContentUnderHeading(noteToUse, headingToUse, `No notes found`, true, config.headingLevel)
            replaceSection(noteToUse, headingToUse, headingToUse, config.headingLevel, `No notes found`)
          } else {
            logWarn(pluginJson, `- no matches for search term '${searchTerm}'`)
          }
        }
      } else {
        CommandBar.showLoading(false)
        if (config.showEmptyOccurrences) {
          // await replaceContentUnderHeading(noteToUse, headingToUse, `No notes found`, true, config.headingLevel)
          replaceSection(noteToUse, headingToUse, headingToUse, config.headingLevel, `No notes found`)
        } else {
          logWarn(pluginJson, `- no matches for search term '${searchTerm}'`)
        }
      }
    }

    logDebug(pluginJson, `Written results to note '${noteFilename}'`)
    // Open the newly-written MOC note
    if (noteOpenInEditor(noteFilename)) {
      logDebug(pluginJson, `- note ${noteFilename} already open in an editor window`)
    } else {
      // Open the results note in a new split window
      await Editor.openNoteByFilename(noteFilename, false, 0, 0, true)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.message}'`)
  }
}
