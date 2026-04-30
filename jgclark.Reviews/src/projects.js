// @flow

//-----------------------------------------------------------------------------
// Commands for working with Project and Area notes, seen in NotePlan notes.
// by @jgclark
// Last updated 2026-04-30 for v2.0.0.b26, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment'
import { buildProjectLineForStyle } from './projectsHTMLGenerator'
import { Project } from './projectClass'
import { finishReviewForNote, renderProjectListsIfOpen } from './reviews'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import { updateAllProjectsListAfterChange } from './allProjectsListHelpers'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { archiveNoteUsingFolder } from '@helpers/NPnote'
import { usersVersionHas } from '@helpers/NPVersions'
import { getInputTrimmed, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Constants

const thisYearStr = moment().format('YYYY')
const thisQuarterStr = moment().format('YYYY-[Q]Q')
const thisDayStr = moment().format('YYYY-MM-DD')
const ERROR_FILENAME_PLACEHOLDER = '<error>'
const ARCHIVE_PROMPT_YES = 'Yes'
const ARCHIVE_PROMPT_NO = 'No'

type SummaryDestination = 'none' | 'quarterly' | 'yearly'

type ProjectCloseoutInputs = {
  willArchive: boolean,
  summaryDestination: SummaryDestination,
  finalProgressComment: string,
}

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
 * Reload note, update project lists, and render outputs.
 * This is called by completeProject, cancelProject, togglePauseProject.
 * @param {TNote} note - Note to reload
 * @param {ReviewConfig} config - Review configuration
 * @param {boolean} shouldArchive - Whether note should be archived
 * @returns {Promise<void>}
 * @private
 */
async function reloadAndUpdateLists(note: TNote, config: ReviewConfig, shouldArchive: boolean, scrollPos: number = 0): Promise<void> {
  // Reload the note according to @Eduard
  await Editor.openNoteByFilename(note.filename)

  // Update the allProjects list
  await updateAllProjectsListAfterChange(note.filename ?? ERROR_FILENAME_PLACEHOLDER, shouldArchive, config)

  // Re-render the outputs if window open (but don't focus)
  await renderProjectListsIfOpen(config, scrollPos)
}

type SummaryCalendarPeriod = 'quarter' | 'year'

/**
 * Add a project line to a yearly or quarterly summary calendar note.
 * Pass `showFolderName: true` so folder appears before title (config may be frozen from loadJSON).
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {SummaryCalendarPeriod} period - 'year' for the current calendar year, 'quarter' for the current quarter
 * @returns {void}
 * @private
 */
function addToSummaryCalendarNote(thisProject: Project, config: ReviewConfig, period: SummaryCalendarPeriod): void {
  const lineToAdd = buildProjectLineForStyle(thisProject,
    { ...config, showFolderName: true },
    'list') // list = for summary note, without [x] etc.
  const dateString = period === 'year' ? thisYearStr : thisQuarterStr
  const summaryNote = DataStore.calendarNoteByDateString(dateString)
  if (summaryNote != null) {
    const periodLabel = period === 'year' ? 'yearly' : 'quarterly'
    logInfo('addToSummaryCalendarNote', `Will add '${lineToAdd}' to ${periodLabel} note '${summaryNote.filename}'`)
    summaryNote.addParagraphBelowHeadingTitle(
      lineToAdd,
      'text', // bullet character gets included in the passed in string
      config.finishedListHeading,
      true, // append
      true // do create heading if not found already
    )
  }
}

/**
 * Add project line to selected summary note.
 * @param {Project} thisProject
 * @param {ReviewConfig} config
 * @param {SummaryDestination} summaryDestination
 * @returns {void}
 * @private
 */
function addToSummaryNote(thisProject: Project, config: ReviewConfig, summaryDestination: SummaryDestination): void {
  if (summaryDestination === 'quarterly') {
    addToSummaryCalendarNote(thisProject, config, 'quarter')
    return
  }
  if (summaryDestination === 'yearly') {
    addToSummaryCalendarNote(thisProject, config, 'year')
  }
}

/**
 * Convert free text to SummaryDestination with safe default.
 * @param {mixed} value
 * @returns {SummaryDestination}
 * @private
 */
function parseSummaryDestination(value: mixed): SummaryDestination {
  const raw = String(value ?? '').trim().toLowerCase()
  if (['quarterly', 'Quarterly', 'quarter', 'q', 'current quarter'].includes(raw)) {
    return 'quarterly'
  }
  if (['yearly', 'Yearly', 'year', 'y', 'current year'].includes(raw)) {
    return 'yearly'
  }
  if (['none', 'no', 'n', 'skip', 'off'].includes(raw)) {
    return 'none'
  }
  return 'yearly'
}

/**
 * Convert free text to yes/no boolean with safe default.
 * @param {mixed} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 * @private
 */
function parseBooleanChoice(value: mixed, defaultValue: boolean = false): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'archive'].includes(raw)) return true
  if (['no', 'n', 'false', '0', 'keep'].includes(raw)) return false
  return defaultValue
}

/**
 * Parse form result for complete/cancel project closeout form.
 * @param {CommandBarFormResult} formResult
 * @returns {?ProjectCloseoutInputs}
 * @private
 */
function parseProjectCloseoutFormValues(formResult: CommandBarFormResult): ?ProjectCloseoutInputs {
  try {
    if (formResult == null || typeof formResult !== 'object') {
      throw new Error('formResult is null or not an object')
    }
    if (formResult.submitted === false) {
      logDebug('parseProjectCloseoutFormValues', `User didn't submit form`)
      return null
    }
    const fieldMap: { [string]: mixed } = formResult.values ?? {}
    const willArchive = parseBooleanChoice(fieldMap.archiveProject, false)
    const summaryDestination = parseSummaryDestination(fieldMap.summaryDestination)
    const finalProgressComment = String(fieldMap.finalProgressComment ?? '').trim()
    return { willArchive, summaryDestination, finalProgressComment }
  } catch (error) {
    logError('parseProjectCloseoutFormValues', `Error parsing form result: ${error.message}`)
    return null
  }
}

/**
 * Collect closeout decisions for complete/cancel project.
 * Uses a single CommandBar form when available in current NotePlan; otherwise falls back to prompts.
 * @param {'completed' | 'cancelled'} actionType
 * @param {string} projectTitle
 * @returns {Promise<?ProjectCloseoutInputs>}
 * @private
 */
async function promptProjectCloseoutInputs(actionType: 'completed' | 'cancelled', projectTitle: string): Promise<?ProjectCloseoutInputs> {
  const actionWord = actionType === 'completed' ? 'Complete' : 'Cancel'
  const defaultCloseoutInputs: ProjectCloseoutInputs = {
    willArchive: true,
    summaryDestination: 'yearly',
    finalProgressComment: '',
  }
  const commandBarWithForm: any = CommandBar
  if (usersVersionHas('commandBarForms') && typeof commandBarWithForm.showForm === 'function') {
    try {
      const raw = await commandBarWithForm.showForm({
        title: `${actionWord} Project '${projectTitle}'`,
        submitText: `${actionWord} Project`,
        fields: [
          { type: 'bool', key: 'archiveProject', title: 'Archive project note?', default: true, required: true },
          { type: 'string', key: 'summaryDestination', title: 'Add summary line to a calendar note?', choices: ['Quarterly', 'Yearly', 'none'], default: 'yearly', required: true },
          { type: 'string', key: 'finalProgressComment', title: 'Final progress comment (optional)', description: "Optional final comments to add as a 'Progress' line", required: false, placeholder: 'Optional final comments' },
        ],
      })
      if (raw == null || raw.submiited !== true) {
        logDebug('promptProjectCloseoutInputs', `User cancelled the form input; continuing closeout with defaults and no final progress comment`)
        return defaultCloseoutInputs
      }
      const parsed = parseProjectCloseoutFormValues(raw)
      if (parsed) {
        return parsed
      }
      logWarn('promptProjectCloseoutInputs', `Could not parse showForm result; continuing closeout with defaults and no final progress comment`)
      return defaultCloseoutInputs
    } catch (error) {
      logWarn('promptProjectCloseoutInputs', `CommandBar.showForm failed (${error.message}); using separate prompts`)
    }
  }

  const archivePrompt = actionType === 'completed'
    ? 'Archive this completed project note?'
    : actionType === 'completed'
      ? 'Archive this cancelled project note?'
      : '(invalid action type)'
  const willArchive = await showMessageYesNo(archivePrompt, [ARCHIVE_PROMPT_YES, ARCHIVE_PROMPT_NO]) === ARCHIVE_PROMPT_YES

  const summaryRaw = await getInputTrimmed(
    "Add line to which summary note? (quarterly / yearly / none)",
    'OK',
    `${actionWord} Project`,
  )
  if (summaryRaw === false || summaryRaw == null) {
    logDebug('promptProjectCloseoutInputs', `User cancelled summary destination prompt`)
    return null
  }
  const summaryDestination = parseSummaryDestination(summaryRaw)

  const finalCommentRaw = await getInputTrimmed(
    'Final progress comment? (optional; leave blank for none)',
    'OK',
    `${actionWord} Project`,
  )
  const finalProgressComment = (finalCommentRaw && finalCommentRaw !== true)
    ? String(finalCommentRaw).trim()
    : ''

  return { willArchive, summaryDestination, finalProgressComment }
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
  actionType: 'completed' | 'cancelled',
  closeoutInputs: ProjectCloseoutInputs,
  scrollPos: number = 0,
): Promise<void> {
  const { willArchive, summaryDestination } = closeoutInputs

  // Reload note and update lists
  await reloadAndUpdateLists(note, config, willArchive, scrollPos)

  // Add to chosen summary note
  addToSummaryNote(thisProject, config, summaryDestination)

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
export async function addProgressUpdate(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
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
    // Add progress line to note, and then update reviewed date
    await thisProject.addProgressLine()
    await finishReviewForNote(note, scrollPos)
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
export async function completeProject(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
  try {
    logDebug('project/completeProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'completeProject')
    const thisProject = new Project(note)
    const closeoutInputs = await promptProjectCloseoutInputs('completed', thisProject.title)
    if (!closeoutInputs) {
      logDebug('project/completeProject', `User cancelled complete-project closeout prompt`)
      return
    }

    if (closeoutInputs.finalProgressComment !== '') {
      await thisProject.addProgressLine('Final progress comment for', {
        comment: closeoutInputs.finalProgressComment,
        progressDateStr: thisDayStr,
        percentStr: '',
      })
    }

    // Call the class' method to update its metadata
    const success = thisProject.completeProject()

    // If this has worked, then handle post-processing
    if (success) {
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {
        await handleProjectCompletionOrCancellation(thisProject, note, config, 'completed', closeoutInputs, scrollPos)
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
export async function cancelProject(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
  try {
    logDebug('project/cancelProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'cancelProject')
    const thisProject = new Project(note)
    const closeoutInputs = await promptProjectCloseoutInputs('cancelled', thisProject.title)
    if (!closeoutInputs) {
      logDebug('project/cancelProject', `User cancelled cancel-project closeout prompt`)
      return
    }

    if (closeoutInputs.finalProgressComment !== '') {
      await thisProject.addProgressLine('Final progress comment for', {
        comment: closeoutInputs.finalProgressComment,
        progressDateStr: thisDayStr,
        percentStr: '',
      })
    }

    // Call the class' method to update its metadata
    const success = thisProject.cancelProject()

    // If this has worked, then handle post-processing
    if (success) {
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {
        await handleProjectCompletionOrCancellation(thisProject, note, config, 'cancelled', closeoutInputs, scrollPos)
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
export async function togglePauseProject(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
  try {
    logDebug('togglePauseProject', `Starting for ${noteArg ? 'passed note' : 'Editor'}`)

    const note = validateAndGetNote(noteArg, 'togglePauseProject')
    const thisProject = new Project(note)

    // Call the class' method to update its metadata
    const success = await thisProject.togglePauseProject()

    // If this has worked, then handle post-processing
    if (success) {
      const config: ?ReviewConfig = await getReviewSettings()
      if (config) {
        // Reload note and update lists (no archiving for pause)
        await reloadAndUpdateLists(note, config, false, scrollPos)
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
