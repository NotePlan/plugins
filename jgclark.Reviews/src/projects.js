// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 16.6.2023 for v0.12.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from "../plugin.json"
import {
  finishReview,
  renderProjectLists,
  updateReviewListAfterChange
} from './reviews'
import {
  getReviewSettings,
  Project,
} from './reviewHelpers'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, logDebug, logInfo, logWarn, logError } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getOrMakeNote } from '@helpers/note'
import { showMessageYesNo } from '@helpers/userInput'
import { archiveNoteUsingFolder } from '../../jgclark.Filer/src/archive'

//-----------------------------------------------------------------------------

const thisYearStr = hyphenatedDateString(new Date()).substring(0, 4)

//-----------------------------------------------------------------------------

export async function addProgressUpdate(): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    const { note, filename } = Editor
    if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
      logWarn(pluginJson, `Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
      return
    }

    // Construct a Project class object from this note
    const projectNote = new Project(note)
    // And then use it to add progress line
    await projectNote.addProgressLine()
    // Finally call Finish Review
    await finishReview()
  } catch (error) {
    logError(pluginJson, `addProgressUpdate: ${error.message}`)
  }
}

/**
 * Complete a Project/Area in the Editor, by:
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
    if (!Editor) {
      throw new Error(`Cannot get details from Editor. stopping.`)
    }
    const { note } = Editor
    if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from this note
    const projectNote = new Project(note)

    // Then call the class' method to update its metadata
    const newMSL = await projectNote.completeProject()

    // If this has worked, then ...
    if (newMSL) {
      // Get settings
      const config = await getReviewSettings()

      // we need to re-load the note according to @Eduard
      await Editor.openNoteByFilename(note.filename)
      // logDebug('completeProject', `- updated cache, re-opened, and now I can see ${String(note.hashtags)} ${String(note.mentions)}`)

      // Ask whether to move it to the @Archive
      const willArchive = await showMessageYesNo('Shall I move this completed note to the Archive?', ['Yes', 'No']) === 'Yes'

      if (willArchive) {
        // delete the line from the full-review-list, as we don't show project notes in the archive
        await updateReviewListAfterChange(note.title ?? '<error>', true, config)
      } else {
        // update the full-review-list, using the machineSummaryLine
        await updateReviewListAfterChange(note.title ?? '<error>', false, config, newMSL)
      }

      // re-render the outputs (but don't focus)
      await renderProjectLists(config, false)

      // Now add to the Yearly note for this year (if present)
      const lineToAdd = projectNote.detailedSummaryLine('Markdown', true)
      const yearlyNote = DataStore.calendarNoteByDateString(thisYearStr)
      if (yearlyNote != null) {
        logInfo(pluginJson, `Will add '${lineToAdd}' to note '${yearlyNote.filename}'`)
        yearlyNote.addParagraphBelowHeadingTitle(
          lineToAdd,
          'text', // bullet character gets included in the passed in string
          config.finishedListHeading,
          true, // append
          true // do create heading if not found already
        )
      }

      // ... and finally ask whether to move it to the @Archive
      if (willArchive) {
        const newFilename = (config.archiveUsingFolderStructure)
          ? archiveNoteUsingFolder(note)
          : DataStore.moveNote(note.filename, '@Archive')
        logInfo('cancelProject', `Project completed and moved to @Archive (at ${newFilename ?? '<error>'}), review list updated, and window updated.`)
      } else {
        logInfo('cancelProject', 'Project completed, review list updated, and window updated.')
      }
    } else {
      logError('completeProject', 'Error completing project.')
    }
  }
  catch (error) {
    logError('completeProject', error.message)
  }
}

/**
 * Cancel the Project/Area note in the Editor, by:
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
    if (!Editor) {
      throw new Error(`Cannot get details from Editor. stopping.`)
    }
    const { note } = Editor
    if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from this note
    const projectNote = new Project(note)

    // Then call the class' method to update its metadata
    // logDebug('cancelProject', `before cancelProject`)
    const newMSL = await projectNote.cancelProject()
    // logDebug('cancelProject', `after cancelProject, newMSL=${newMSL}`)

    // If this has worked, then ...
    if (newMSL) {
      // Get settings
      const config = await getReviewSettings()

      // we need to re-load the note according to EM
      await Editor.openNoteByFilename(note.filename)
      // logDebug('cancelProject', `- updated cache, re-opened, and now I can see ${String(note.hashtags)} ${String(note.mentions)}`)

      // Ask whether to move it to the @Archive
      const willArchive = await showMessageYesNo('Shall I move this cancelled note to the Archive?', ['Yes', 'No']) === 'Yes'

      if (willArchive) {
        // delete the line from the full-review-list, as we don't show project notes in the archive
        await updateReviewListAfterChange(note.title ?? '<error>', true, config)
      } else {
        // update the full-review-list, using the machineSummaryLine
        await updateReviewListAfterChange(note.title ?? '<error>', false, config, newMSL)
      }

      // re-render the outputs (but don't focus)
      await renderProjectLists(config, false)

      // Now add to the Yearly note for this year (if present)
      const lineToAdd = projectNote.detailedSummaryLine('Markdown', true)
      const yearlyNote = DataStore.calendarNoteByDateString(thisYearStr)
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

      // ... and finally ask whether to move it to the @Archive
      if (willArchive) {
        const newFilename = (config.archiveUsingFolderStructure)
          ? archiveNoteUsingFolder(note)
          : DataStore.moveNote(note.filename, '@Archive')
        logInfo('cancelProject', `Project completed and moved to @Archive (at ${newFilename ?? '<error>'}), review list updated, and window updated.`)
      } else {
        logInfo('cancelProject', 'Project cancelled, review list updated, and window updated.')
      }
    } else {
      logError('cancelProject', 'Error cancelling project.')
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
    if (!Editor) {
      throw new Error(`Cannot get details from Editor. stopping.`)
    }
    const { note } = Editor
    if (note == null || note.type === 'Calendar' || Editor.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from the open note
    const projectNote = new Project(note)

    // Then call the class' method to update its metadata
    const newMSL = await projectNote.togglePauseProject()

    // If this has worked, then ...
    if (newMSL !== '') {
      // Get settings
      const config = await getReviewSettings()

      // we need to re-load the note according to EM
      await Editor.openNoteByFilename(note.filename)
      // logDebug('pauseProject', `- updated cache, re-opened, and now I can see ${String(note.hashtags)} ${String(note.mentions)}`)

      // update the full-review-list, using the machineSummaryLine
      // Note: doing it this way to attempt to avoid a likely race condition that fails to have the updated version of projectNote available outside this function. Hopefully this tighter-than-ideal linkage could be de-coupled in time.
      await updateReviewListAfterChange(note.title ?? '<error>', false, config, newMSL)

      // re-render the outputs (but don't focus)
      await renderProjectLists(config, false)
      logInfo('togglePauseProject', 'Project pause now toggled, review list updated, and window updated.')
    } else {
      logError('togglePauseProject', 'Error toggling pause.')
    }
  }
  catch (error) {
    logError('pauseProject', error.message)
  }
}
