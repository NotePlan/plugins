// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 24.7.2022 for v0.7.0+, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from "../plugin.json"
import { updateReviewListAfterReview } from './reviews'
import {
  getReviewSettings,
  Project
} from './reviewHelpers'
import { hyphenatedDateString } from '@helpers/dateTime'
import { logDebug, logInfo, logWarn, logError } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'
import {
  // getInput,
  showMessageYesNo
} from '@helpers/userInput'

//-----------------------------------------------------------------------------

const thisYearStr = hyphenatedDateString(new Date()).substring(0, 4)

//-----------------------------------------------------------------------------

/**
 * Complete a Project/Area note by
 * - adding @completed(<today's date>) to the current note in the Editor
 * - add '#archive' flag to metadata line
 * - remove from this plugin's review list
 * - add to a yearly 'Completed Projects' list in the Summaries folder (if present)
 * - offer to move it to the @Archive
 * @author @jgclark
 */
export async function completeProject(): Promise<void> {
  // only proceed if we're in a valid Project note (with at least 2 lines)
  const { note, filename } = Editor
  if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
    logWarn(pluginJson, `Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    return
  }

  // Get settings
  const config = await getReviewSettings()

  // Construct a Project class object from this note
  const projectNote = new Project(note)

  // Then call the class' method to update its metadata
  const res = projectNote.completeProject()

  // If this has worked, then ...
  if (res) {
    // remove this note from the review list
    await updateReviewListAfterReview(note)

    // Now add to the Summary note for this year (if present)
    if (DataStore.folders.includes(config.folderToStore)) {
      const lineToAdd = projectNote.detailedSummaryLine('markdown', true)
      const summaryNote = await getOrMakeNote(thisYearStr, config.folderToStore)
      if (summaryNote != null) {
        logInfo(pluginJson, `Will add '${lineToAdd}' to note '${summaryNote.filename}'`)
        summaryNote.addParagraphBelowHeadingTitle(
          lineToAdd,
          'text', // bullet character gets included in the passed in string
          config.finishedListHeading,
          true, // append
          true  // do create heading if not found already
        )
      }
    }

    // ... and finally ask whether to move it to the @Archive
    if (filename != null &&
      (await showMessageYesNo('Shall I move this completed note to the Archive?', ['Yes', 'No'])) === 'Yes') {
      // eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
      const newFilename = DataStore.moveNote(filename, '@Archive')
    }
  } else {
    logError(pluginJson, `Error: something has gone wrong in Completing this project note`)
  }
}

/**
 * Cancel a Project/Area note by
 * - adding @cancelled(<today's date>) to the current note in the Editor
 * - add '#archive' flag to metadata line
 * - remove from this plugin's review list
 * - add to a yearly 'Finished Projects' list in the Summaries folder (if present)
 * - offer to move it to the @Archive
 * @author @jgclark
 */
export async function cancelProject(): Promise<void> {
  // only proceed if we're in a valid Project note (with at least 2 lines)
  const { note, filename } = Editor
  if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
    logWarn(pluginJson, `Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    return
  }

  // Get settings
  const config = await getReviewSettings()

  // Construct a Project class object from this note
  const projectNote = new Project(note)

  // Then call the class' method to update its metadata
  const res = projectNote.cancelProject()

  // If this has worked, then ...
  if (res) {
    // remove this note from the review list
    await updateReviewListAfterReview(note)

    // Now add to the Summary note for this year (if present)
    if (DataStore.folders.includes(config.folderToStore)) {
      const lineToAdd = projectNote.detailedSummaryLine('markdown', true)
      const yearlyNote = await getOrMakeNote(thisYearStr, config.folderToStore)
      if (yearlyNote != null) {
        logInfo(pluginJson, `Will add '${lineToAdd}' to note '${yearlyNote.filename}'`)
        yearlyNote.addParagraphBelowHeadingTitle(
          lineToAdd,
          'text', // bullet character gets included in the passed in string
          config.finishedListHeading,
          true, // append
          true  // do create heading if not found already
        )
      }
    }

    // ... and finally ask whether to move it to the @Archive
    if (filename != null &&
      (await showMessageYesNo('Shall I move this cancelled note to the Archive?', ['Yes', 'No'])) === 'Yes') {
      // eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
      const newFilename = DataStore.moveNote(filename, '@Archive')
      logInfo(pluginJson, `Project note has been moved to the @Archive.`)
    }
  } else {
    logError(pluginJson, `Something has gone wrong in Cancelling this project note.`)
  }
}
