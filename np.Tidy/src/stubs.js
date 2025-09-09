// @flow
//-----------------------------------------------------------------------------
// listStubs function for Tidy
// Jonathan Clark
// Last updated 2025-09-09 for v0.14.11 by @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
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
 * Private function to generate a list of wikilink stubs (i.e. links that don't lead to actual notes).
 * Ignores links to calendar notes.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @returns {Array<stubDetails>} array of <stubDetails> objects: note and wikilink (without surrounding brackets)
*/
function findStubs(
  foldersToExclude: Array<string> = [],
  filenamesToExclude: Array<string> = [],
): Array<stubDetails> {
  try {
    logDebug(pluginJson, `findStubs() starting`)
    const outputArray: Array<stubDetails> = []

    // get folder list, minus any to exclude
    let relevantFolderList = getFolderListMinusExclusions(foldersToExclude, false, false)
    logDebug('getDuplicateNotes', `- Found ${relevantFolderList.length} folders to check`)

    // Get all notes to check
    let notes: Array<TNote> = []
    for (const thisFolder of relevantFolderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder) //.filter((n) => n.title?.startsWith('T')) // used in testing
      notes = notes.concat(theseNotes)
    }
    const numNotes = notes.length

    let stubs = 0
    let noteCount = 0
    for (const thisNote of notes) {
      noteCount++
      // Ignore the output note, if found.
      if (filenamesToExclude.includes(thisNote.filename)) {
        continue
      }
      CommandBar.showLoading(true, `Checking note ${String(noteCount)}`, noteCount / numNotes)
      const thisContent = thisNote.content ?? ''
      // logDebug('findStubs', `- checking in note: ${displayTitle(thisNote)}`)
      // Find all wikilinks in this note
      const matches = thisContent.matchAll(/\[\[[^\[]+?\]\]/g) // has to be global
      for (const match of matches) {
        const thisLink = match[0].slice(2, -2) // remove enclosing brackets
        // remove any '#heading'
        let thisLinkTitle = (thisLink.includes('#')) ? thisLink.split('#', 1)[0] : thisLink
        // remove any '^link' part
        thisLinkTitle = (thisLinkTitle.includes('^')) ? thisLinkTitle.split('^', 1)[0] : thisLinkTitle
        // logDebug('findStubs', `  - checking for thisLinkTitle: ${thisLinkTitle} from '${match[0]}'`)
        // Check to see if each match leads anywhere
        const isCalendarNote = isValidCalendarNoteTitleStr(thisLinkTitle, true) // also allows YYYYMMDD format
        const notesMatchingTitle = DataStore.projectNoteByTitle(thisLinkTitle) ?? []
        if (!isCalendarNote && notesMatchingTitle.length === 0) {
          // logDebug('findStubs', `- ${thisLink} is a stub`)
          stubs++
          outputArray.push({ note: thisNote, wikilink: thisLink })
        } else {
          // logDebug('findStubs', `- ${thisLink} NOT a stub`)
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
    const stubs: Array<stubDetails> = findStubs(config.listFoldersToExclude, [config.stubsNoteFilename])
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
      // const thisFolder = n.filename.includes('/') ? '**' + getFolderDisplayName(getFolderFromFilename(n.filename), true) + '**' : '**root**'
      // logDebug('listStubs', `${counter}. ${titleToDisplay} / ${d.wikilink}`)
      // const thisJustFilename = getJustFilenameFromFullFilename(n.filename)
      // TODO: update this function for Teamspaces
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
    logError('listStubs', JSP(err))
    return // for completeness
  }
}
