// @flow
//-----------------------------------------------------------------------------
// listStubs function for Tidy
// Jonathan Clark
// Last updated 2026-10-24 for v1.21.1 by @jgclark
//-----------------------------------------------------------------------------

import { getSettings, runHeavySyncWork, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { isValidCalendarNoteTitleStr } from '@helpers/dateTime'
import {
  getFolderListMinusExclusions,
  getFolderFromFilename,
  getFolderDisplayName,
  getJustFilenameFromFullFilename,
  getProjectNotesInFolder,
} from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayFolderAndTitle,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { appendStringToSettingArray } from '@helpers/NPSettings'
import { noteOpenInEditor } from '@helpers/NPEditor'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

type stubDetails = {
  note: TNote,
  wikilink: string
}

//----------------------------------------------------------------------------

/**
 * Private function to generate a list of wikilink stubs (i.e. links that don't lead to actual notes).
 * Ignores links to calendar notes.
 * Synchronous. Safe for runOnAsyncThread (read-only; showLoading allowed).
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {Array<string>} filenamesToExclude
 * @param {boolean} showProgress - when true, update CommandBar.showLoading during the scan
 * @returns {Array<stubDetails>} array of <stubDetails> objects: note and wikilink (without surrounding brackets)
*/
function findStubs(
  foldersToExclude: Array<string> = [],
  filenamesToExclude: Array<string> = [],
  showProgress: boolean = false,
): Array<stubDetails> {
  try {
    logDebug(pluginJson, `findStubs() starting`)
    const outputArray: Array<stubDetails> = []

    // get folder list, minus any to exclude
    const relevantFolderList = getFolderListMinusExclusions(foldersToExclude, true, false)
    const folderCount = relevantFolderList.length
    logDebug('findStubs', `- Found ${String(folderCount)} folders to check`)

    // Get all notes to check
    let notes: Array<TNote> = []
    for (let f = 0; f < folderCount; f++) {
      if (showProgress && f % 5 === 0) {
        CommandBar.showLoading(true, `Finding wikilink stubs (folder ${String(f + 1)} of ${String(folderCount)})...`, (f / folderCount) * 0.2)
      }
      notes = notes.concat(getProjectNotesInFolder(relevantFolderList[f]))
    }
    const numNotes = notes.length

    for (let noteCount = 0; noteCount < numNotes; noteCount++) {
      const thisNote = notes[noteCount]
      // Ignore the output note, if found.
      if (filenamesToExclude.includes(thisNote.filename)) {
        continue
      }
      if (showProgress && noteCount % 25 === 0) {
        CommandBar.showLoading(true, `Checking note ${String(noteCount)} of ${String(numNotes)} for stubs...`, 0.2 + (noteCount / numNotes) * 0.8)
      }
      if (noteCount > 0 && noteCount % 250 === 0) {
        logDebug('findStubs', `- checked ${String(noteCount)}/${String(numNotes)} notes, found ${String(outputArray.length)} stubs so far`)
      }
      const thisContent = thisNote.content ?? ''
      // Find all wikilinks in this note
      const matches = thisContent.matchAll(/\[\[[^\[]+?\]\]/g) // has to be global
      for (const match of matches) {
        const thisLink = match[0].slice(2, -2) // remove enclosing brackets
        // remove any '#heading'
        let thisLinkTitle = (thisLink.includes('#')) ? thisLink.split('#', 1)[0] : thisLink
        // remove any '^link' part
        thisLinkTitle = (thisLinkTitle.includes('^')) ? thisLinkTitle.split('^', 1)[0] : thisLinkTitle
        // Check to see if each match leads anywhere
        const isCalendarNote = isValidCalendarNoteTitleStr(thisLinkTitle, true) // also allows YYYYMMDD format
        const notesMatchingTitle = DataStore.projectNoteByTitle(thisLinkTitle) ?? []
        if (!isCalendarNote && notesMatchingTitle.length === 0) {
          outputArray.push({ note: thisNote, wikilink: thisLink })
        }
      }
    }
    logDebug('findStubs', `- finished: ${String(outputArray.length)} stubs from ${String(numNotes)} notes`)
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
  let runSilently: boolean = false
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()

    const outputFilename = config.stubsNoteFilename ?? 'stubs.md'

    // Decide whether to run silently
    runSilently = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug(pluginJson, `listStubs() starting, with runSilently = ${String(runSilently)}`)

    if (!runSilently) {
      CommandBar.showLoading(true, `Finding wikilink stubs`)
    }
    const startTime = new Date()
    // Side-channel: do not return large arrays from runOnAsyncThread.
    let stubsHolder: ?Array<stubDetails> = null
    /**
     * Synchronous stub scan. Safe for runOnAsyncThread (read-only; showLoading allowed).
     * @returns {true}
     */
    const syncFindStubs = (): true => {
      stubsHolder = findStubs(config.listFoldersToExclude, [config.stubsNoteFilename], !runSilently)
      return true
    }
    await runHeavySyncWork('listStubs', syncFindStubs)
    if (stubsHolder == null) {
      logWarn('listStubs', `async scan result missing; scanning on main thread`)
      syncFindStubs()
    }
    const stubs: Array<stubDetails> = stubsHolder ?? []
    if (!runSilently) {
      CommandBar.showLoading(false)
    }

    // Only continue if there are stubs found
    if (stubs.length === 0) {
      logDebug('listStubs', `No wikilink stubs found (in ${timer(startTime)}).`)
      if (!runSilently) {
        await showMessage(`No wikilink stubs found! 🥳`)
      }
      // remove old stubs note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listStubs', `Moved existing stubs note list '${outputFilename}' to @Trash.`)
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
      const thisFolderAndTitle = displayFolderAndTitle(n, false)
      // Make some button links
      const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'subWindow', false)

      // Write out header for this note (if changed from last stub)
      if (lastNote !== n) {
        numNotes++
        // outputArray.push(`## ${thisFolder} / ${titleToDisplay}`)
        outputArray.push(`## ${thisFolderAndTitle}`)
        outputArray.push(`[open note](${openMe})`) // [❌ delete note](${deleteMe})
      }
      // Write out details for this dupe
      outputArray.push(`- ${d.wikilink}`)

      lastNote = n
    }

    // To the front add title and an x-callback link under the title to allow this to be refreshed easily
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List stubs', [])
    const summaryLine = `Found ${stubs.length} stubs in ${String(numNotes)
      } notes at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.unshift(summaryLine)
    outputArray.unshift(`# Wikilink Stubs`)

    // If note is not open in an editor already, write to and open the note. Otherwise just update note.
    let noteToUse: ?TNote
    if (!noteOpenInEditor(outputFilename)) {
      noteToUse = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, outputArray.join('\n'))
    } else {
      noteToUse = DataStore.projectNoteByFilename(outputFilename)
    }
    if (!noteToUse) {
      throw new Error(`Couldn't find note '${outputFilename}' to write to`)
    }
    noteToUse.content = outputArray.join('\n')
    const noteFMAttributes = [
      { key: 'title', value: 'Wikilink Stubs' },
      { key: 'updated', value: nowLocaleShortDateTime() },
      { key: 'icon', value: 'link-slash' },
      { key: 'icon-color', value: 'red-500' }
    ]
    noteToUse.updateFrontmatterAttributes(noteFMAttributes)
  } catch (err) {
    if (!runSilently) {
      try {
        CommandBar.showLoading(false)
      } catch (_) {
        // ignore cleanup failures
      }
    }
    logError('listStubs', JSP(err))
    return // for completeness
  }
}
