// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 10.6.2023 for v0.16.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, type noteHelpersConfigType } from './noteHelpers'
import {
  daysBetween,
  relativeDateFromDate,
  toISOShortDateTimeString,
} from '@helpers/dateTime'
import {
  nowLocaleShortDateTime,
  toLocaleDateString,
} from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, timer } from '@helpers/dev'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  createRunPluginCallbackUrl,
  displayTitle,
  returnNoteLink,
} from '@helpers/general'
import { getProjectNotesInFolder, notesInFolderSortedByTitle } from '@helpers/note'
import {
  chooseFolder,
  chooseOption,
  // showMessage,
} from '@helpers/userInput'
import { noteOpenInEditor } from '@helpers/NPWindows'

const pluginID = 'jgclark.NoteHelpers'

//----------------------------------------------------------------------------

type dupeDetails = {
  title: string,
  noteArray: Array<TNote>
}

//----------------------------------------------------------------------------

function charsPercent(value: number, total: number): string {
  return total > 0 ? `${value.toLocaleString()} chars (${((value / total) * 100, 2).toLocaleString([], { maximumFractionDigits: 1 })}%)` : `${value.toLocaleString()} chars`
}

/**
 * Private function to generate list of potentially duplicate notes
 * @author @jgclark
 *
 * @returns {Array<dupeDetails>} array of strings, one for each output line
*/
function getDuplicateNotes(): Array<dupeDetails> {
  try {
    logDebug(pluginJson, `getDuplicateNotes() starting`)

    const outputArray: Array<dupeDetails> = []
    let folderList = getFilteredFolderList([], true, [], true)
    logDebug('getDuplicateNotes', `- Found ${folderList.length} folders to check`)
    // Get all notes to check
    let notes: Array<TNote> = []
    for (const thisFolder of folderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder)
      notes = notes.concat(theseNotes)
    }

    // Get all dupes
    const counter = {}
    const dupes = notes.filter(n => (counter[displayTitle(n)] = counter[displayTitle(n)] + 1 || 1) === 2)
    const dupeTitles = dupes.map(n => n.title)

    // Log details of each dupe
    for (const dt of dupeTitles) {
      // $FlowIgnore[incompatible-call]
      const notesForThisTitle = DataStore.projectNoteByTitle(dt)
      // $FlowIgnore[incompatible-call]
      outputArray.push({ title: dt, noteArray: notesForThisTitle })
    }
    return outputArray
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    return [] // for completeness
  }
}

/**
 * Command to show details of duplicates in a NP note (replacing any earlier version of the note)
 * @author @jgclark
 */
export async function showDuplicates(): Promise<void> {
  try {
    CommandBar.showLoading(true, `Finding duplicates`)
    const startTime = new Date()
    const dupes: Array<dupeDetails> = getDuplicateNotes()
    CommandBar.showLoading(false)
    logDebug('showDuplicates', `Found ${dupes.length} dupes in ${timer(startTime)}:`)

    // Form the contents of a note to display the details of dupes
    const outputArray = []

    // Start with an x-callback link under the title to allow this MOC to be re-created
    outputArray.push(`# Duplicate notes`)
    const xCallbackURL = createRunPluginCallbackUrl('jgclark.NoteHelpers', 'list duplicate notes', [])
    const xCallbackLine = `Last updated: ${nowLocaleShortDateTime()} [🔄 Click to refresh](${xCallbackURL})`
    outputArray.push(xCallbackLine)

    for (const d of dupes) {
      logDebug(pluginJson, `- ${d.title}`)
      outputArray.push(`## ${d.title}`)
      let i = 0
      let lastContent = ''
      let thisContent = ''
      let greatestSize = 0

      for (const n of d.noteArray) {
        i++
        logDebug(pluginJson, `  ${i}. ${n.filename}`)
        const thisFolder = n.filename.includes('/') ? 'folder **' + getFolderFromFilename(n.filename) + '**' : '**root** folder'
        // Make some button links
        const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', false)
        const deleteMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', true)
        // Write out all details for this dupe
        outputArray.push(`${String(i)}. in ${thisFolder}: ${String(n.paragraphs.length)} lines, ${String(n.content.length)} bytes (created ${relativeDateFromDate(n.createdDate)}, updated ${relativeDateFromDate(n.changedDate)}) [open note](${openMe}) [❗️delete note](${deleteMe})`)

        if (i > 1) {
          thisContent = n.content
          // $FlowIgnore[incompatible-use]
          greatestSize = Math.max(greatestSize, n.content.length)
          // $FlowIgnore[incompatible-call]
          const allDiffRanges = NotePlan.stringDiff(lastContent, thisContent)
          const totalDiffBytes = allDiffRanges.reduce((a, b) => a + Math.abs(b.length), 0)
          if (totalDiffBytes > 0) {
            const percentDiff = charsPercent(totalDiffBytes, greatestSize)
            outputArray.push(`\t- ${percentDiff} difference between ${String(i - 1)} and ${String(i)} (from ${String(allDiffRanges.length)} areas)`)
          } else {
            outputArray.push(`\t- notes ${String(i - 1)} and ${String(i)} are identical`)
          }
        }
        lastContent = n.content
      }
    }

    const filenameToUse = 'Duplicates.md' // TODO: from setting

    if (!noteOpenInEditor(filenameToUse)) {
      const resultingNote = await Editor.openNoteByFilename(filenameToUse, false, 0, 0, true, true, outputArray.join('\n'))
    }
  }
  catch (err) {
    logError('showDuplicates', JSP(err))
  }
}
