// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2025-11-01 for v1.15.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, percentWithTerm } from './tidyHelpers'
import {
  daysBetween,
} from '@helpers/dateTime'
import { relativeDateFromDate } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import {
  getFolderListMinusExclusions,
  getFolderFromFilename,
  getProjectNotesInFolder,
  getJustFilenameFromFullFilename
} from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayFolderAndTitle,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { setIconForNote } from '@helpers/note'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPEditor'
import { showMessage } from "@helpers/userInput"

//----------------------------------------------------------------------------
// Constants

const pluginID = 'np.Tidy'
const OUTPUT_TITLE = 'Duplicate notes'
const FALLBACK_OUTPUT_FILENAME = 'Duplicate Notes.md'

//----------------------------------------------------------------------------
// Type definitions

type dupeDetails = {
  title: string,
  noteArray: $ReadOnlyArray<TNote>
}

//----------------------------------------------------------------------------

/**
 * Private function to generate a list of potentially duplicate notes.
 * Ignores folders in the 'foldersToExclude' setting, plus Trash.
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @returns {Array<dupeDetails>} array of strings, one for each output line
*/
function findDuplicateNotes(foldersToExclude: Array<string> = []): Array<dupeDetails> {
  try {
    logDebug(pluginJson, `findDuplicateNotes() starting`)

    const outputArray: Array<dupeDetails> = []
    let relevantFolderList = getFolderListMinusExclusions(foldersToExclude, false, false)
    logDebug('findDuplicateNotes', `- Found ${relevantFolderList.length} folders to check`)
    // Get all the notes in those folders to check
    let notes: Array<TNote> = []
    for (const thisFolder of relevantFolderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder)
      notes = notes.concat(theseNotes)
    }

    // Get all dupes, now including Teamspace notes
    const counter: { [mixed]: number } = {}
    const dupes = notes.filter(n => (counter[displayTitle(n, false)] = counter[displayTitle(n, false)] + 1 || 1) === 2)
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
    logError(pluginJson, 'findDuplicateNotes() ' + JSP(err))
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
    const outputFilename = config.duplicateNoteFilename ?? FALLBACK_OUTPUT_FILENAME

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding duplicates`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const dupes: Array<dupeDetails> = findDuplicateNotes(config.listFoldersToExclude)
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
    outputArray.push(`# ${OUTPUT_TITLE}`)
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
        const teamspaceAwareFolderAndTitle = displayFolderAndTitle(n, false)
        outputArray.push(`${String(i)}. ${teamspaceAwareFolderAndTitle}  [Open note](${openMe}) [Delete note ❌](${deleteMe})`)
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
      if (resultingNote) {
        setIconForNote(resultingNote, 'code-branch', 'orange-500')
      }
    } else {
      const noteToUse = DataStore.projectNoteByFilename(outputFilename)
      if (noteToUse) {
        noteToUse.content = outputArray.join('\n')
        setIconForNote(noteToUse, 'code-branch', 'orange-500')
      } else {
        throw new Error(`Couldn't find note '${outputFilename}' to write to`)
      }
    }
  }
  catch (err) {
    logError('listDuplicates', JSP(err))
  }
}
