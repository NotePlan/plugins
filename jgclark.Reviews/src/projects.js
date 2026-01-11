// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 2025-12-10 for v1.4.0, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import { Project, generateProjectOutputLine } from './projectClass'
import {
  finishReview,
  renderProjectLists,
  // updateAllProjectsListAfterChange,
} from './reviews'
import {
  getReviewSettings,
  type ReviewConfig
} from './reviewHelpers'
import {
  updateAllProjectsListAfterChange
} from './allProjectsListHelpers'
import { hyphenatedDateString } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { archiveNoteUsingFolder } from '@helpers/NPnote'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const thisYearStr = hyphenatedDateString(new Date()).substring(0, 4)
const ERROR_FILENAME_PLACEHOLDER = '<error>'
const ARCHIVE_PROMPT_YES = 'Yes'
const ARCHIVE_PROMPT_NO = 'No'

//-----------------------------------------------------------------------------
// Private functions

/**
 * Validate and get note from Editor or argument
 * @param {TNote?} noteArg - Optional note argument
 * @param {string} functionName - Name of calling function for error messages
 * @returns {TNote} Validated note
 * @throws {Error} If note is invalid
 * @private
 */
function validateAndGetNote(noteArg?: TNote, functionName: string = 'function'): TNote {
  const noteMaybe: ?TNote = noteArg ?? Editor?.note
  if (!noteMaybe) {
    throw new Error(`Not in an Editor and no note passed for ${functionName}.`)
  }
  const note: TNote = noteMaybe
  if (note.type === 'Calendar' || note.paragraphs.length < 2) {
    throw new Error(`Not in a Project note (at least 2 lines long) for ${functionName}. (Note title = '${note.title ?? ''}')`)
  }
  return note
}

/**
 * Reload note, update project lists, and render outputs
 * @param {TNote} note - Note to reload
 * @param {ReviewConfig} config - Review configuration
 * @param {boolean} shouldArchive - Whether note should be archived
 * @returns {Promise<void>}
 * @private
 */
async function reloadAndUpdateLists(note: TNote, config: ReviewConfig, shouldArchive: boolean): Promise<void> {
  // Reload the note according to @Eduard
  await Editor.openNoteByFilename(note.filename)

  // Update the allProjects list
  await updateAllProjectsListAfterChange(note.filename ?? ERROR_FILENAME_PLACEHOLDER, shouldArchive, config)

  // Re-render the outputs (but don't focus)
  await renderProjectLists(config, false)
}

/**
 * Add project line to yearly note
 * @param {Project} thisProject - Project instance
 * @param {ReviewConfig} config - Review configuration
 * @returns {void}
 * @private
 */
function addToYearlyNote(thisProject: Project, config: ReviewConfig): void {
  const lineToAdd = generateProjectOutputLine(thisProject, config, 'list')
  const yearlyNote = DataStore.calendarNoteByDateString(thisYearStr)
  if (yearlyNote != null) {
    logInfo('addToYearlyNote', `Will add '${lineToAdd}' to note '${yearlyNote.filename}'`)
    yearlyNote.addParagraphBelowHeadingTitle(
      lineToAdd,
      'text', // bullet character gets included in the passed in string
      config.finishedListHeading,
      true, // append
      true // do create heading if not found already
    )
  }
}

/**
 * Archive a note if requested
 * @param {TNote} note - Note to archive
 * @param {ReviewConfig} config - Review configuration
 * @param {boolean} willArchive - Whether to archive
 * @returns {?string} New filename if archived, null otherwise
 * @private
 */
function archiveNoteIfRequested(note: TNote, config: ReviewConfig, willArchive: boolean): ?string {
  if (!willArchive) {
    return null
  }

  const newFilename = (config.archiveUsingFolderStructure)
    ? archiveNoteUsingFolder(note, config.archiveFolder)
    : DataStore.moveNote(note.filename, config.archiveFolder)

  return newFilename
}

/**
 * Handle post-processing after completing or cancelling a project: ask whether to move it to the @Archive, reload the note, update the review list, and add to the yearly note.
 * @param {Project} thisProject - Project instance
 * @param {TNote} note - Note being processed
 * @param {ReviewConfig} config - Review configuration
 * @param {string} actionType - Type of action ('completed' or 'cancelled')
 * @returns {Promise<void>}
 * @private
 */
async function handleProjectCompletionOrCancellation(
  thisProject: Project,
  note: TNote,
  config: ReviewConfig,
  actionType: 'completed' | 'cancelled'
): Promise<void> {
  // Ask whether to move it to the @Archive
  const archivePrompt = actionType === 'completed'
    ? 'Shall I move this completed note to the Archive?'
    : 'Shall I move this cancelled note to the Archive?'
  const willArchive = await showMessageYesNo(archivePrompt, [ARCHIVE_PROMPT_YES, ARCHIVE_PROMPT_NO]) === ARCHIVE_PROMPT_YES

  // Reload note and update lists
  await reloadAndUpdateLists(note, config, willArchive)

  // Add to yearly note
  await addToYearlyNote(thisProject, config)

  // Archive if requested
  const newFilename = await archiveNoteIfRequested(note, config, willArchive)

  if (willArchive) {
    logInfo(`handleProjectCompletionOrCancellation`, `Project ${actionType} and moved to @Archive (at ${newFilename ?? ERROR_FILENAME_PLACEHOLDER}), review list updated, and window updated.`)
  } else {
    logInfo(`handleProjectCompletionOrCancellation`, `Project ${actionType}, review list updated, and window updated.`)
  }
}

//-----------------------------------------------------------------------------
/**
 * Add progress to a Project note in the Editor (or passed by noteArg)
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function addProgressUpdate(noteArg?: TNote): Promise<void> {
  try {
    logDebug('addProgressUpdate', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    // Validate note (using try-catch to handle gracefully)
    let note: TNote
    try {
      note = validateAndGetNote(noteArg, 'addProgressUpdate')
    } catch (error) {
      logWarn('addProgressUpdate', error.message)
      return
    }

    // Construct a Project class object from this note
    const thisProject = new Project(note)

    await thisProject.addProgressLine()

    await finishReview()
  } catch (error) {
    logError('addProgressUpdate', JSP(error))
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
    logDebug('project/completeProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'completeProject')
    const thisProject = new Project(note)

    // Call the class' method to update its metadata
    const newSummaryLine = thisProject.completeProject()

    // If this has worked, then handle post-processing
    if (newSummaryLine && newSummaryLine !== '') {
      const config: ReviewConfig = await getReviewSettings()
      if (config) {
        await handleProjectCompletionOrCancellation(thisProject, note, config, 'completed')
      } else {
        logError('project/completeProject', 'Error getting review settings.')
      }
    } else {
      logError('project/completeProject', 'Error completing project.')
    }
  } catch (error) {
    logError('project/completeProject', error.message)
  }
}

/**
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function completeProjectByFilename(filename: string): Promise<void> {
  try {
    logDebug('project/completeProjectByFilename', `Starting for filename '${filename}'`)
    const note = DataStore.projectNoteByFilename(filename)
    if (note) {
      await completeProject(note)
    } else {
      logWarn('completeProjectByFilename', `Note not found for filename '${filename}'`)
    }
  } catch (error) {
    logError('completeProjectByFilename', error.message)
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
 * @param {TNote?} noteArg 
 */
export async function cancelProject(noteArg?: TNote): Promise<void> {
  try {
    logDebug('project/cancelProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'cancelProject')
    const thisProject = new Project(note)

    // Add a progress line to the note
    await thisProject.addProgressLine()

    // Call the class' method to update its metadata
    const newSummaryLine = thisProject.cancelProject()

    // If this has worked, then handle post-processing
    if (newSummaryLine && newSummaryLine !== '') {
      const config: ReviewConfig = await getReviewSettings()
      if (config) {
        await handleProjectCompletionOrCancellation(thisProject, note, config, 'cancelled')
      } else {
        logError('cancelProject', 'Error getting review settings.')
      }
    } else {
      logError('cancelProject', 'Error cancelling project.')
    }
  } catch (error) {
    logError('cancelProject', error.message)
  }
}

/**
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function cancelProjectByFilename(filename: string): Promise<void> {
  try {
    logDebug('cancelProjectByFilename', `Starting for filename '${filename}'`)
    const note = DataStore.projectNoteByFilename(filename)
    if (note) {
      await cancelProject(note)
    } else {
      logWarn('cancelProjectByFilename', `Note not found for filename '${filename}'`)
    }
  } catch (error) {
    logError('cancelProjectByFilename', error.message)
  }
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
    logDebug('togglePauseProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'togglePauseProject')
    const thisProject = new Project(note)

    // Call the class' method to update its metadata
    const newSummaryLine = await thisProject.togglePauseProject()

    // If this has worked, then handle post-processing
    if (newSummaryLine && newSummaryLine !== '') {
      const config: ReviewConfig = await getReviewSettings()
      if (config) {
        // Reload note and update lists (no archiving for pause)
        await reloadAndUpdateLists(note, config, false)
        logInfo('togglePauseProject', 'Project pause now toggled, review list updated, and window updated.')
      } else {
        logError('togglePauseProject', 'Error getting review settings.')
      }
    } else {
      logError('togglePauseProject', 'Error toggling pause.')
    }
  } catch (error) {
    logError('togglePauseProject', error.message)
  }
}

/**
 * Bridge function, may be useful for Dashboard
 * @param {string} filename 
 */
export async function togglePauseProjectByFilename(filename: string): Promise<void> {
  try {
    logDebug('togglePauseProjectByFilename', `Starting for filename '${filename}'`)
    const note = DataStore.projectNoteByFilename(filename)
    if (note) {
      await togglePauseProject(note)
    } else {
      logWarn('togglePauseProjectByFilename', `Note not found for filename '${filename}'`)
    }
  } catch (error) {
    logError('togglePauseProjectByFilename', error.message)
  }
}
