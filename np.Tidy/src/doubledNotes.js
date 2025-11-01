// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2025-11-01 for v1.15.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { constrainMainWindow } from '@helpers/NPWindows'
import { getSettings, percentWithTerm } from './tidyHelpers'
import { relativeDateFromDate } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, createRunPluginCallbackUrl, displayTitle, getTagParamsFromString } from '@helpers/general'
import { setIconForNote } from '@helpers/note'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { usersVersionHas } from '@helpers/NPVersions'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { showMessage, showMessageYesNo } from "@helpers/userInput"

//----------------------------------------------------------------------------
// Constants

const pluginID = 'np.Tidy'
const MAX_PERCENT_DIFF_FOR_DOUBLED_NOTE = 20
const OUTPUT_TITLE = 'Potentially Duplicated Content notes'
const FALLBACK_OUTPUT_FILENAME = 'Possible Duplicated Content.md'

//----------------------------------------------------------------------------
// Type definitions

type DoubleDetails = {
  filename: string,
  contentLength: number,
  matchLevel: number
}

//----------------------------------------------------------------------------

/**
 * Private function to generate a list of potentially doubled Calendar notes.
 * Does this by comparing the first and second halves of each note, and if the difference is <= 10%, then its likely to be doubled.
 * @author @jgclark
 * @returns {Array<DoubleDetails>} array of filenames, one for each suspected doubled Calendar note
*/
function findPotentialDoubledNotes(): Array<DoubleDetails> {
  try {
    logDebug(pluginJson, `findPotentialDoubledNotes() starting`)
    let outputArray: Array<DoubleDetails> = [] // of NP filenames

    // Get all Calendar notes to check (that are at least 4 lines long)
    const calendarNotes = DataStore.calendarNotes.slice().filter(n => n.content?.length ?? 0 >= 20)

    // Look at each and see if it looks doubled
    let i = 0
    for (const n of calendarNotes) {
      i++
      CommandBar.showLoading(true, `Checking note ${String(i)}`, i / calendarNotes.length)
      // Split note content into halves
      const contentLength = n.paragraphs.length
      // Get all content by joining .content of all paragraphs
      const allContent = n.paragraphs.map(p => p.content).join('\n')

      // Then create the first and second halves of the note
      const firstHalfContent = allContent.substring(0, allContent.length / 2)
      const secondHalfContent = allContent.substring((allContent.length / 2) + 1)

      // Compare the two halves, by getting length of diffs
      const allDiffRanges = NotePlan.stringDiff(firstHalfContent, secondHalfContent)
      const totalDiffBytes = allDiffRanges.reduce((a, b) => a + Math.abs(b.length), 0)
      const percentDiff: number = (totalDiffBytes > 0) ? ((totalDiffBytes / allContent.length / 2) * 100) : 0
      // If diff is <= MAX_PERCENT_DIFF_FOR_DOUBLED_NOTE%, then it's likely to be doubled
      if (percentDiff <= MAX_PERCENT_DIFF_FOR_DOUBLED_NOTE) {
        outputArray.push({ filename: n.filename, contentLength: allContent.length, matchLevel: (100-percentDiff) })
        logDebug('findPotentialDoubledNotes', `${n.filename} = ${percentDiff}`)
      }
    }
    CommandBar.showLoading(false)
    return outputArray
  }
  catch (err) {
    logError(pluginJson, 'findPotentialDoubledNotes() ' + JSP(err))
    return [] // for completeness
  }
}

/**
 * Command to show details of duplicates in a NP note (replacing any earlier version of the note)
 * @author @jgclark
 * @params {string?} params
 */
export async function listPotentialDoubles(params: string = ''): Promise<void> {
  try {
    logDebug(pluginJson, `listPotentialDoubles: Starting with params '${params}'`)
    let config = await getSettings()
    const outputFilename = config.doubledNoteFilename ?? FALLBACK_OUTPUT_FILENAME

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    // If we're running NP 3.19.2+ then show a message about the new built-in feature
    if (!runSilently && usersVersionHas('contentDeduplicator')) {
      const answer = await showMessageYesNo(`NotePlan has since added a "Content deduplicator tool" (in Sync > Advanced). This is quicker, but it only finds exact duplication, whereas this command allows for a 15% margin of difference, which I found necessary.\nShall I continue?`, ['Continue', 'Cancel'], 'Doubled Content Finder tool')
      if (answer === 'Cancel') {
        logDebug('listPotentialDoubledNotes', `User cancelled`)
        return
      }
    }

    CommandBar.showLoading(true, `Finding possible doubles`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const doubles: Array<DoubleDetails> = findPotentialDoubledNotes()
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('listPotentialDoubles', `Found ${doubles.length} potential doubles in ${timer(startTime)}:`)

    // Form the contents of a note to display the details of doubles
    const outputArray: Array<string> = []

    // Start with an x-callback link under the title to allow this to be refreshed easily
    outputArray.push(`# ${OUTPUT_TITLE}`)
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List duplicated content', [])

    const summaryLine = `Found ${doubles.length} potential doubles at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.push(summaryLine)

    // Write out details for each possible duplicated content note
    for (const d of doubles) {
      const n = DataStore.calendarNoteByDateString(d.filename.split('.')[0])
      if (n) {
        const titleToDisplay = displayTitle(n)
        const openURL = createRunPluginCallbackUrl('np.Tidy', 'openCalendarNoteInSplit', [n.filename, String(Math.round(d.contentLength / 2))])

        outputArray.push(`- ${titleToDisplay}: match ${d.matchLevel.toPrecision(3)}% (${String(n.paragraphs?.length ?? 0)} lines, updated ${relativeDateFromDate(n.changedDate)}) [Open note](${openURL})`)
      } else {
        // error
        logWarn('listPotentialDoubledNotes', `- Couldn't find note '${d.filename}'`)
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

    // Show message if no doubles found
    if (doubles.length === 0 && !runSilently) {
      await showMessage(`No possible duplicated content found! 🥳`)
    }
  }
  catch (err) {
    logError('listPotentialDoubles', JSP(err))
  }
}
