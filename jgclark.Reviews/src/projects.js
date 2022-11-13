// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 3.11.2022 for v0.9.0-beta, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from "../plugin.json"
import { updateReviewListAfterChange } from './reviews'
import {
  getReviewSettings,
  Project
} from './reviewHelpers'
import { hyphenatedDateString } from '@helpers/dateTime'
import { logDebug, logInfo, logWarn, logError } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
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
  try {
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
    const newMSL = projectNote.completeProject()

    // If this has worked, then ...
    if (newMSL !== '') {
      // Now add to the Summary note for this year (if present)
      if (DataStore.folders.includes('Summaries')) {
        const lineToAdd = projectNote.detailedSummaryLine('Markdown', true)
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
      if (filename != null) {
        if (await showMessageYesNo('Shall I move this completed note to the Archive?', ['Yes', 'No']) === 'Yes') {
          const newFilename = DataStore.moveNote(filename, '@Archive')
          // delete the project line from the full-review-list
          await updateReviewListAfterChange(note.title ?? '', false, config, newMSL)
        } else {
          // update the full-review-list, using the machineSummaryLine
          // Note: doing it this way to attempt to avoid a likely race condition that fails to have the updated version of projectNote available outside this function. Hopefully this tighter-than-ideal linkage could be de-coupled in time.
          await updateReviewListAfterChange(note.title ?? '', false, config, newMSL)
        }
      }
    }
  }
  catch (error) {
    logError('completeProject', error.message)
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
  try {
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
      // Add to the Summary note for this year (if present)
      if (DataStore.folders.includes(config.folderToStore)) {
        const lineToAdd = projectNote.detailedSummaryLine('Markdown', true)
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

      // Ask whether to move it to the @Archive
      if (filename != null &&
        (await showMessageYesNo('Shall I move this cancelled note to the Archive?', ['Yes', 'No'])) === 'Yes') {
        const newFilename = DataStore.moveNote(filename, '@Archive')
        // delete the project line from the full-review-list
        await updateReviewListAfterChange(note.title ?? '', true, config)
      } else {
        // update the full-review-list, using the machineSummaryLine
        // Note: doing it this way to attempt to avoid a likely race condition that fails to have the updated version of projectNote available outside this function. Hopefully this tighter-than-ideal linkage could be de-coupled in time.
        await updateReviewListAfterChange(note.title ?? '', true, config)
      }
    }
  }
  catch (error) {
    logError('cancelProject', error.message)
  }
}

/**
 * Toggle Un/Pause of a Project/Area note:
 * - call the instance's togglePauseProject()
 * - update the full-review-list
 * @author @jgclark
 */
export async function togglePauseProject(): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    const { note, filename } = Editor
    if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
      logWarn(pluginJson, `Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
      return
    }

    // Get settings
    const config = await getReviewSettings()

    // Construct a Project class object from the open note
    const projectNote = new Project(note)

    // Then call the class' method to update its metadata
    const newMSL = projectNote.togglePauseProject()

    // If this has worked, then ...
    if (newMSL !== '') {
      // update the full-review-list, using the machineSummaryLine
      // Note: doing it this way to attempt to avoid a likely race condition that fails to have the updated version of projectNote available outside this function. Hopefully this tighter-than-ideal linkage could be de-coupled in time.
      await updateReviewListAfterChange(note.title ?? '<error>', false, config, newMSL)
    }
  }
  catch (error) {
    logError('pauseProject', error.message)
  }
}
