// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2.1.2024 for v0.11.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { constrainMainWindow } from '@helpers/NPWindows'
import { getSettings, percentWithTerm } from './tidyHelpers'
import {
  relativeDateFromDate,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, timer } from '@helpers/dev'
import {
  createPrettyRunPluginLink,
  createRunPluginCallbackUrl,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { getProjectNotesInFolder } from '@helpers/note'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { showMessage } from "@helpers/userInput"

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

type DoubleDetails = {
  filename: string,
  contentLength: number,
  matchLevel: number
}

//----------------------------------------------------------------------------

/**
 * Private function to generate list of potentially doubled Calendar notes.
 * Does this by comparing the first and second halves of each note, and if the difference is <= 10%, then its likely to be doubled.
 * @author @jgclark
 * @returns {Array<DoubleDetails>} array of filenames, one for each suspected doubled Calendar note
*/
function getPotentialDoubledNotes(): Array<DoubleDetails> {
  try {
    logDebug(pluginJson, `getPotentialDoubledNotes() starting`)
    let outputArray: Array<DoubleDetails> = [] // of NP filenames

    // Get all Calendar notes to check (that are at least 8 lines long)
    const calendarNotes = DataStore.calendarNotes.slice().filter(n => n.paragraphs.length > 8)

    // Look at each and see if it looks doubled
    for (const n of calendarNotes) {
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
      const percentDiff: number = (totalDiffBytes > 0) ? ((totalDiffBytes / allContent.length / 2) * 100) : 100
      // If diff is <= 10%, then it's likely to be doubled
      if (percentDiff <= 10) {
        // logDebug('getPotentialDoubledNotes', `${n.filename} = ${percentDiff}`)
        outputArray.push({ filename: n.filename, contentLength: allContent.length, matchLevel: percentDiff })
      }
    }
    return outputArray
  }
  catch (err) {
    logError(pluginJson, 'getPotentialDoubledNotes() ' + JSP(err))
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
    const outputFilename = config.doubledNoteFilename ?? 'Possible Doubled Notes.md'

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding possible doubles`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const doubles: Array<DoubleDetails> = getPotentialDoubledNotes()
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    logDebug('listPotentialDoubles', `Found ${doubles.length} potential doubles in ${timer(startTime)}:`)

    // Form the contents of a note to display the details of doubles
    const outputArray: Array<string> = []

    // Start with an x-callback link under the title to allow this to be refreshed easily
    outputArray.push(`# Potentially Doubled notes`)
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List doubled notes', [])

    const summaryLine = `Found ${doubles.length} potential doubles at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.push(summaryLine)

    for (const d of doubles) {
      const n = DataStore.calendarNoteByDateString(d.filename.split('.')[0])
      if (n) {
        const titleToDisplay = displayTitle(n)
        const openURL = createRunPluginCallbackUrl('np.Tidy', 'openCalendarNoteInSplit', [n.filename, String(Math.round(d.contentLength / 2))])
        // logDebug(pluginJson, `- ${titleToDisplay}`)
        // Write out all details for this dupe
        outputArray.push(`- ${titleToDisplay} [open note in split](${openURL}): match ${d.matchLevel.toPrecision(3)}. (${String(n.paragraphs?.length ?? 0)} lines, ${String(d.contentLength)} bytes, last updated ${relativeDateFromDate(n.changedDate)})`)
      } else {
        // error
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

    // Show message if no doubles found
    if (doubles.length === 0 && !runSilently) {
      await showMessage(`No possible doubles found! 🥳`)
    }
  }
  catch (err) {
    logError('listPotentialDoubles', JSP(err))
  }
}

/**
 * Open a calendar note in a split editor, and (optionally) move insertion point to 'cursorPointIn'
 * @author @jgclark
 * @param {*} filename
 * @param {*} cursorPointIn
 */
export async function openCalendarNoteInSplit(filename: string, cursorPointIn?: string | number = 0): Promise<void> {
  // For some reason need to add a bit to get to the right place.
  const cursorPoint = (typeof cursorPointIn === 'string') ? parseInt(cursorPointIn) + 21 : cursorPointIn + 21
  const res = Editor.openNoteByDateString(filename.split('.')[0], false, cursorPoint, cursorPoint, true)
  if (res) {
    // Make sure it all fits on the screen
    await constrainMainWindow()
  }
}
