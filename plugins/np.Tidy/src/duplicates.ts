// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2024-09-25 for v0.6.0+ by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, percentWithTerm } from './tidyHelpers'
import {
  daysBetween,
  relativeDateFromDate,
} from '@np/helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, overrideSettingsWithEncodedTypedArgs } from '@np/helpers/dev'
import {
  getFolderListMinusExclusions,
  getFolderFromFilename,
  getJustFilenameFromFullFilename
} from '@np/helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayTitle,
  getTagParamsFromString,
} from '@np/helpers/general'
import { getProjectNotesInFolder } from '@np/helpers/note'
import { nowLocaleShortDateTime } from '@np/helpers/NPdateTime'
import { noteOpenInEditor } from '@np/helpers/NPWindows'
import { showMessage } from "@helpers/userInput"

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

type dupeDetails = {
  title: string,
  noteArray: ReadonlyArray<TNote>
}

//----------------------------------------------------------------------------

/**
 * Private function to generate list of potentially duplicate notes
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @returns {Array<dupeDetails>} array of strings, one for each output line
*/
function getDuplicateNotes(foldersToExclude: Array<string> = []): Array<dupeDetails> {
  try {
    logDebug(pluginJson, `getDuplicateNotes() starting`)

    const outputArray: Array<dupeDetails> = []
    let relevantFolderList = getFolderListMinusExclusions(foldersToExclude, true, true)
    logDebug('getDuplicateNotes', `- Found ${relevantFolderList.length} folders to check`)
    // Get all notes to check
    let notes: Array<TNote> = []
    for (const thisFolder of relevantFolderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder)
      notes = notes.concat(theseNotes)
    }

    // Get all dupes
    const counter: { [mixed]: number } = {}
    const dupes = notes.filter(n => (counter[displayTitle(n)] = counter[displayTitle(n)] + 1 || 1) === 2)
    const dupeTitles = dupes.map(n => n.title ?? '')

    // Log details of each dupe
    for (const dt of dupeTitles) {
      const notesForThisTitle = DataStore.projectNoteByTitle(dt)
      if (notesForThisTitle && notesForThisTitle.length > 0) {
        outputArray.push({ title: dt, noteArray: notesForThisTitle })
      }
    }
    return outputArray
  }
  catch (err) {
    logError(pluginJson, 'getDuplicateNotes() ' + JSP(err))
    return [] // for completeness
  }
}

/**
 * Command to show details of duplicates in a NP note (replacing any earlier version of the note)
 * @author @jgclark
 * @params {string?} params
 */
export async function listDuplicates(params: string = ''): Promise<void> {
  try {
    logDebug(pluginJson, `listDuplicates: Starting with params '${params}'`)
    let config = await getSettings()
    const outputFilename = config.duplicateNoteFilename ?? 'Duplicate Notes.md'

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding duplicates`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const dupes: Array<dupeDetails> = getDuplicateNotes(config.listFoldersToExclude)
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Only continue if there are dupes found
    if (dupes.length === 0) {
      logTimer('listDuplicates', startTime, `No duplicates found`)
      if (!runSilently) {
        await showMessage(`No duplicates found! 🥳`)
      }
      // remove old conflicted note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listDuplicates', `Moved existing duplicate note list '${outputFilename}' to @Trash.`)
      }
      return
    } else {
      logTimer('listDuplicates', startTime, `Found ${dupes.length} dupes`)
    }

    // Form the contents of a note to display the details of dupes
    const outputArray = []

    // Start with an x-callback link under the title to allow this to be refreshed easily
    outputArray.push(`# Duplicate notes`)
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List duplicate notes', [])

    const summaryLine = `Found ${dupes.length} potential duplicates at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.push(summaryLine)

    for (const d of dupes) {
      const titleToDisplay = (d.title !== '') ? d.title : '(note with no title)'
      logDebug(pluginJson, `- ${titleToDisplay}`)
      outputArray.push(`## ${titleToDisplay}`)
      let i = 0
      let lastContent = ''
      let thisContent = ''
      let greatestSize = 0

      for (const n of d.noteArray) {
        i++
        logDebug(pluginJson, `  ${i}. ${n.filename}`)
        const thisFolder = n.filename.includes('/') ? '**' + getFolderFromFilename(n.filename) + '**' : '**root**'
        const thisJustFilename = getJustFilenameFromFullFilename(n.filename)
        // Make some button links
        const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', false)
        const deleteMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', true)
        // Write out all details for this dupe
        outputArray.push(`${String(i)}. ${thisFolder}/${thisJustFilename}: [open note](${openMe}) [❌ delete note](${deleteMe})`)
        outputArray.push(`\t- ${String(n.paragraphs?.length ?? 0)} lines, ${String(n.content?.length ?? 0)} bytes, created ${relativeDateFromDate(n.createdDate)}, updated ${relativeDateFromDate(n.changedDate)}`)

        // For all but the first of the duplicate set, show some comparison stats
        if (i > 1) {
          thisContent = n.content ?? ''
          greatestSize = Math.max(greatestSize, n.content?.length ?? 0)
          const allDiffRanges = NotePlan.stringDiff(lastContent, thisContent)
          const totalDiffBytes = allDiffRanges.reduce((a, b) => a + Math.abs(b.length), 0)
          if (totalDiffBytes > 0) {
            const percentDiff = percentWithTerm(totalDiffBytes, greatestSize, 'chars')
            outputArray.push(`\t- ${percentDiff} difference between ${String(i - 1)} and ${String(i)} (from ${allDiffRanges.length.toLocaleString()} ${allDiffRanges.length > 1 ? 'areas' : 'area'})`)
          } else {
            outputArray.push(`\t- notes ${String(i - 1)} and ${String(i)} are identical`)
          }
        }
        lastContent = n.content ?? ''
      }
    }

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
  }
  catch (err) {
    logError('listDuplicates', JSP(err))
  }
}
