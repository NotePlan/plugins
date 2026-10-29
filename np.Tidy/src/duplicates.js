// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2026-10-24 for v1.21.1 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, percentWithTerm, runHeavySyncWork } from './tidyHelpers'
import {
  daysBetween,
} from '@helpers/dateTime'
import { relativeDateFromDate } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, overrideSettingsWithEncodedTypedArgs } from '@helpers/dev'
import {
  getFolderListMinusExclusions,
  getProjectNotesInFolder,
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
 * Single pass: group notes by display title, then keep titles with 2+ notes.
 * Synchronous. Safe for runOnAsyncThread (read-only; showLoading allowed).
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @param {boolean} showProgress - when true, update CommandBar.showLoading during the scan
 * @returns {Array<dupeDetails>} array of duplicate title groups
*/
function findDuplicateNotes(foldersToExclude: Array<string> = [], showProgress: boolean = false): Array<dupeDetails> {
  try {
    logDebug(pluginJson, `findDuplicateNotes() starting`)

    const relevantFolderList = getFolderListMinusExclusions(foldersToExclude, false, false)
    const folderCount = relevantFolderList.length
    logDebug('findDuplicateNotes', `- Found ${String(folderCount)} folders to check`)

    // Group notes by display title in one pass (avoids filter + projectNoteByTitle re-lookup).
    const notesByTitle: Map<string, Array<TNote>> = new Map()
    let notesChecked = 0
    for (let f = 0; f < folderCount; f++) {
      if (showProgress && f % 5 === 0) {
        CommandBar.showLoading(true, `Looking for duplicated notes (folder ${String(f + 1)} of ${String(folderCount)})...`, f / folderCount)
      }
      if (f > 0 && f % 25 === 0) {
        logDebug('findDuplicateNotes', `- checked ${String(f)}/${String(folderCount)} folders, ${String(notesChecked)} notes so far`)
      }
      const theseNotes = getProjectNotesInFolder(relevantFolderList[f])
      for (const n of theseNotes) {
        notesChecked++
        const title = displayTitle(n, false)
        const existing = notesByTitle.get(title)
        if (existing) {
          existing.push(n)
        } else {
          notesByTitle.set(title, [n])
        }
      }
    }

    const outputArray: Array<dupeDetails> = []
    for (const [title, noteArray] of notesByTitle.entries()) {
      if (noteArray.length >= 2) {
        outputArray.push({ title, noteArray })
      }
    }
    logDebug('findDuplicateNotes', `- finished: ${String(outputArray.length)} duplicate titles from ${String(notesChecked)} notes in ${String(folderCount)} folders`)
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
  // Decide whether to run silently (also gates the loading dialog)
  let runSilently: boolean = false
  try {
    logDebug(pluginJson, `listDuplicates: Starting with params '${params}'`)
    let config = await getSettings()
    const outputFilename = config.duplicateNoteFilename ?? FALLBACK_OUTPUT_FILENAME

    runSilently = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('listDuplicates', `runSilently = ${String(runSilently)}`)

    if (!runSilently) {
      CommandBar.showLoading(true, `Looking for duplicated notes`)
    }
    const startTime = new Date()
    // Side-channel: do not return large arrays from runOnAsyncThread.
    let dupesHolder: ?Array<dupeDetails> = null
    /**
     * Synchronous duplicate scan. Safe for runOnAsyncThread (read-only; showLoading allowed).
     * @returns {true}
     */
    const syncFindDuplicates = (): true => {
      dupesHolder = findDuplicateNotes(config.listFoldersToExclude, !runSilently)
      return true
    }
    await runHeavySyncWork('listDuplicates', syncFindDuplicates)
    if (dupesHolder == null) {
      logWarn('listDuplicates', `async scan result missing; scanning on main thread`)
      syncFindDuplicates()
    }
    const dupes: Array<dupeDetails> = dupesHolder ?? []
    if (!runSilently) {
      CommandBar.showLoading(false)
    }

    // Only continue if there are dupes found
    if (dupes.length === 0) {
      logTimer('listDuplicates', startTime, `No duplicates found`)
      if (!runSilently) {
        await showMessage(`No duplicates found! 🥳`)
      }
      // remove old duplicate note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logInfo('listDuplicates', `Moved existing duplicate note list '${outputFilename}' to @Trash.`)
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
        // Make some button links
        const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', false)
        const deleteMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', true)
        // Write out all details for this dupe
        const teamspaceAwareFolderAndTitle = displayFolderAndTitle(n, false)
        outputArray.push(`${String(i)}. ${teamspaceAwareFolderAndTitle}.  [Open note](${openMe}) [Delete note ❌](${deleteMe})`)
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
    if (!runSilently) {
      try {
        CommandBar.showLoading(false)
      } catch (_) {
        // ignore cleanup failures
      }
    }
    logError('listDuplicates', JSP(err))
  }
}
