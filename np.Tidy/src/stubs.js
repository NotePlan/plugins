// @flow
//-----------------------------------------------------------------------------
// listStubs function for Tidy
// Jonathan Clark
// Last updated 27.8.2023 for v0.9.0, @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { isValidCalendarNoteTitleStr } from '@helpers/dateTime'
import {
  getFilteredFolderList,
  getFolderFromFilename,
  getJustFilenameFromFullFilename
} from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import {
  getProjectNotesInFolder,
  // projectNotesSortedByTitle
} from '@helpers/note'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { appendStringToSettingArray } from '@helpers/NPSettings'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

type stubDetails = {
  note: TNote,
  wikilink: string
}

//----------------------------------------------------------------------------

/**
 * Private function to generate list of wikilink stubs (i.e. links that don't lead to actual notes).
 * Ignores links to calendar notes.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @returns {Array<stubDetails>} array of strings, one for each output line
*/
function getStubs(
  foldersToExclude: Array<string> = [],
  filenamesToExclude: Array<string> = [],
): Array<stubDetails> {
  try {
    logDebug(pluginJson, `getStubs() starting`)
    const outputArray: Array<stubDetails> = []

    // get folder list, minus any to exclude
    let folderList = getFilteredFolderList(foldersToExclude, true, [], true)
    logDebug('getDuplicateNotes', `- Found ${folderList.length} folders to check`)

    // Get all notes to check
    let notes: Array<TNote> = []
    for (const thisFolder of folderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder) //.filter((n) => n.title?.startsWith('T')) // used in testing
      notes = notes.concat(theseNotes)
    }
    const numNotes = notes.length

    let stubs = 0
    let i = 0
    for (const thisNote of notes) {
      if (filenamesToExclude.includes(thisNote.filename)) {
        continue
      }
      i++
      CommandBar.showLoading(true, `Checking note ${String(i)}`, i / numNotes)
      const thisContent = thisNote.content ?? ''
      // Find all wikilinks in this note
      const matches = thisContent.matchAll(/\[\[[^\[]+?\]\]/g) // has to be global
      for (const match of matches) {
        const thisLink = match[0].slice(2, -2) // remove enclosing brackets
        const thisLinkTitle = (thisLink.includes('#')) ? thisLink.split('#', 1)[0] : thisLink // remove any '#heading' part
        // Check to see if each match leads anywhere
        const isCalendarNote = isValidCalendarNoteTitleStr(thisLinkTitle)
        const notesMatchingTitle = DataStore.projectNoteByTitle(thisLinkTitle) ?? []
        if (!isCalendarNote && notesMatchingTitle.length === 0) {
          // logDebug('getStubs', `- ${thisLink} is a stub`)
          stubs++
          outputArray.push({ note: thisNote, wikilink: thisLink })
        } else {
          // logDebug('getStubs', `- ${thisLink} NOT a stub`)
        }
      }
    }
    CommandBar.showLoading(false)

    return outputArray
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    return [] // for completeness
  }
}

/**
 * Write out list of all wikilink stubs (i.e. links that don't lead to actual notes) to a note
 * @author @jgclark
 * @params {string?} params
 */
export async function listStubs(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()

    const outputFilename = config.stubsNoteFilename ?? 'stubs.md'

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug(pluginJson, `listStubs() starting, with runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding wikilink stubs`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const stubs: Array<stubDetails> = getStubs(config.listFoldersToExclude, [config.stubsNoteFilename])
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Only continue if there are stubs found
    if (stubs.length === 0) {
      logDebug('listStubs', `No wikilink stubs found (in ${timer(startTime)}).`)
      if (!runSilently) {
        await showMessage(`No wikilink stubs found! 🥳`)
      }
      // remove old conflicted note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listStubs', `Moved existing duplicate note list '${outputFilename}' to @Trash.`)
      }
      return
    } else {
      logDebug('listStubs', `Found ${stubs.length} stubs in ${timer(startTime)}:`)
    }

    // Form the contents of a note to display the details of stubs
    const outputArray = []
    let counter = 0
    let numNotes = 0
    let lastNote = null

    for (const d of stubs) {
      counter++
      const n = d.note
      const titleToDisplay = (n.title !== '') ? n.title ?? 'Untitled' : 'Untitled' // to keep flow happy
      logDebug('listStubs', `${counter}. ${titleToDisplay} / ${d.wikilink}`)
      const thisFolder = n.filename.includes('/') ? '**' + getFolderFromFilename(n.filename) + '**' : '**root**'
      const thisJustFilename = getJustFilenameFromFullFilename(n.filename)
      // Make some button links
      const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', false)
      // const deleteMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', true)

      // Write out header for this note (if changed from last stub)
      if (lastNote !== n) {
        numNotes++
        outputArray.push(`## ${thisFolder} / ${titleToDisplay}`)
        outputArray.push(`[open note](${openMe})`) // [❌ delete note](${deleteMe})
      }
      // Write out details for this dupe
      outputArray.push(`- ${d.wikilink}`)

      lastNote = n
    }

    // To the front add title and an x-callback link under the title to allow this to be refreshed easily
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List stubs', [])
    const summaryLine = `Found ${stubs.length} stubs in ${String(numNotes)
      }  notes at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.unshift(summaryLine)
    outputArray.unshift(`# Wikilink Stubs`)


    // If note is not open in an editor already, write to and open the note. Otherwise just update note.
    if (!noteOpenInEditor(outputFilename)) {
      const resultingNote = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, outputArray.join('\n'))
    } else {
      const noteToUse = DataStore.projectNoteByFilename(outputFilename)
      if (noteToUse) {
        noteToUse.content = outputArray.join('\n')
      } else {
        throw new Error(`Couldn't find note '${outputFilename}' to write to`)
      }
    }

  } catch (err) {
    logError('listStubs', JSP(err))
    return // for completeness
  }
}
