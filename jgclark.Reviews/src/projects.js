// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 30.3.2024 for v0.14.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from "../plugin.json"
import { archiveNoteUsingFolder } from '../../jgclark.Filer/src/archive'
import {
  finishReview,
  renderProjectLists,
  updateReviewListAfterChange
} from './reviews'
import {
  getReviewSettings,
  Project,
  type ReviewConfig
} from './reviewHelpers'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, logDebug, logInfo, logWarn, logError } from '@helpers/dev'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const thisYearStr = hyphenatedDateString(new Date()).substring(0, 4)

//-----------------------------------------------------------------------------
/**
 * Add progress to a Project note in the Editor (or passed by noteArg)
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function addProgressUpdate(noteArg?: TNote): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines) or we're passed a valid Note
    logDebug('addProgressUpdate', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)
    const note: TNote = noteArg ? noteArg : Editor
    if (!note || note.type === 'Calendar' || note.paragraphs.length < 2) {
      logWarn('addProgressUpdate', `Not in (or passed) a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
      return
    }

    // Construct a Project class object from this note
    const thisProject = new Project(note)
    // And then use it to add progress line
    await thisProject.addProgressLine()
    // Finally call Finish Review
    await finishReview()
  } catch (error) {
    logError('addProgressUpdate', `addProgressUpdate: ${error.message}`)
  }
}

/**
 * Complete a Project/Area in the Editor (or passed by noteArg), by:
 * - adding @completed(<today's date>) to the current note in the Editor
 * - add '#archive' flag to metadata line
 * - remove from this plugin's review list
 * - add to a yearly 'Completed Projects' list in the Summaries folder (if present)
 * - offer to move it to the @Archive
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function completeProject(noteArg?: TNote): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines) or we're passed a valid Note
    logDebug('addProgressUpdate', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)
    const note: TNote = noteArg ? noteArg : Editor
    if (!note || note.type === 'Calendar' || note.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from this note
    const thisProject = new Project(note)

    // Then call the class' method to update its metadata
    const newMSL = await thisProject.completeProject()

    // If this has worked, then ...
    if (newMSL) {
      // Get settings
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {
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
        const lineToAdd = thisProject.detailedSummaryLine('Markdown', true)
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
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function completeProjectByFilename(filename: string): Promise<void> {
  logDebug('completeProjectByFilename', `Starting for filename '${filename}`)
  const note = DataStore.projectNoteByFilename(filename)
  if (note) await completeProject(note)
}

/**
 * Cancel the Project/Area note in the Editor, by:
 * - adding @cancelled(<today's date>) to the current note in the Editor
 * - add '#archive' flag to metadata line
 * - remove from this plugin's review list
 * - add to a yearly 'Finished Projects' list in the Summaries folder (if present)
 * - offer to move it to the @Archive
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function cancelProject(noteArg?: TNote): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines) or we're passed a valid Note
    logDebug('addProgressUpdate', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)
    const note: TNote = noteArg ? noteArg : Editor
    if (!note || note.type === 'Calendar' || note.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from this note
    const thisProject = new Project(note)

    // Then call the class' method to update its metadata
    // logDebug('cancelProject', `before cancelProject`)
    const newMSL = await thisProject.cancelProject()
    // logDebug('cancelProject', `after cancelProject, newMSL=${newMSL}`)

    // If this has worked, then ...
    if (newMSL) {
      // Get settings
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {

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
        const lineToAdd = thisProject.detailedSummaryLine('Markdown', true)
        const yearlyNote = DataStore.calendarNoteByDateString(thisYearStr)
        if (yearlyNote != null) {
          logInfo(pluginJson, `Will add '${lineToAdd}' to note '${yearlyNote.filename}'`)
          yearlyNote.addParagraphBelowHeadingTitle(
            lineToAdd,
            'text', // bullet character gets included in the passed in string
            config?.finishedListHeading,
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
  }
  catch (error) {
    logError('cancelProject', error.message)
  }
}

/**
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function cancelProjectByFilename(filename: string): Promise<void> {
  logDebug('cancelProjectByFilename', `Starting for filename '${filename}`)
  const note = DataStore.projectNoteByFilename(filename)
  if (note) await cancelProject(note)
}

/**
 * Toggle Un/Pause of a Project/Area note:
 * - call the instance's togglePauseProject()
 * - update the full-review-list
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function togglePauseProject(noteArg?: TNote): Promise<void> {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines) or we're passed a valid Note
    logDebug('addProgressUpdate', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)
    const note: TNote = noteArg ? noteArg : Editor
    if (!note || note.type === 'Calendar' || note.paragraphs.length < 2) {
      throw new Error(`Not in a Project note (at least 2 lines long). (Note title = '${Editor.title ?? ''}')`)
    }

    // Construct a Project class object from the open note
    const thisProject = new Project(note)

    // Then call the class' method to update its metadata
    const newMSL = await thisProject.togglePauseProject()

    // If this has worked, then ...
    if (newMSL !== '') {
      // Get settings
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {
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
  }
  catch (error) {
    logError('pauseProject', error.message)
  }
}

/**
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function togglePauseProjectByFilename(filename: string): Promise<void> {
  logDebug('togglePauseProjectByFilename', `Starting for filename '${filename}`)
  const note = DataStore.projectNoteByFilename(filename)
  if (note) await togglePauseProject(note)
}
