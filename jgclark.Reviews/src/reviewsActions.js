/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Review lifecycle commands: start, finish, skip, set interval
// Extracted from reviews.js
// by @jgclark
//-----------------------------------------------------------------------------

import {
  clearNextReviewFrontmatterField,
  deleteMetadataMentionInEditor,
  deleteMetadataMentionInNote,
  getProjectMetadataLineIndex,
  getNextActionLineIndex,
  getReviewSettings,
  isProjectNoteIsMarkedSequential,
  migrateProjectMetadataLineInEditor,
  migrateProjectMetadataLineInNote,
  promptForMissingProjectTypeTag,
  type ReviewConfig,
  updateBodyMetadataInEditor,
  updateBodyMetadataInNote,
  writeCombinedProjectTagAndReviewedMentions,
} from './reviewHelpers'
import {
  getNextNoteToReview,
  getSpecificProjectFromList,
  updateAllProjectsListAfterChange,
  updateProjectInAllProjectsList,
} from './allProjectsListHelpers.js'
import { calcReviewFieldsForProject } from './projectClassCalculations.js'
import {
  clearProjectReviewingInHTML,
  generateProjectListsAndRenderIfOpen,
  renderProjectListsIfOpen,
  setReviewingProjectInHTML,
} from './reviewsList'
import { checkString } from '@helpers/checkType'
import { getTodaysDateHyphenated, RE_DATE, RE_DATE_INTERVAL, todaysDateISOString } from '@helpers/dateTime'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { numberOfOpenItemsInNote } from '@helpers/note'
import { calcOffsetDateStr } from '@helpers/NPdateTime'
import { getFirstRegularNoteAmongOpenEditors, getOpenEditorFromFilename, saveEditorIfNecessary } from '@helpers/NPEditor'
import { openNoteInSplitViewIfNotOpenAlready } from '@helpers/NPWindows'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * If the note is open in an Editor pane, focus that pane and return it only when the global Editor
 * is that note. Otherwise return null so callers use the DataStore note path (avoids NotePlan's
 * "The editor is not open" warning when the Rich list HTML window or another pane has focus).
 * @param {string} filename
 * @param {string} logContext
 * @returns {Promise<?TEditor>}
 * @private
 */
async function getFocusedEditorForFilename(filename: string, logContext: string): Promise<?TEditor> {
  try {
    const possibleThisEditor = getOpenEditorFromFilename(filename)
    if (!possibleThisEditor || possibleThisEditor === false) {
      return null
    }
    if (!possibleThisEditor.note) {
      logDebug(logContext, `Open editor for '${filename}' has no .note; using note path`)
      return null
    }
    if (Editor?.filename === filename) {
      return possibleThisEditor
    }
    // $FlowIgnore[method-unbinding] existence check before call; TEditor always defines this when present
    if (typeof possibleThisEditor.focus === 'function') {
      possibleThisEditor.focus()
      logDebug(logContext, `Focused editor pane for '${filename}'`)
    }
    if (Editor?.filename === filename) {
      return possibleThisEditor
    }
    logDebug(logContext, `After focus, Editor.filename is '${String(Editor?.filename)}' not '${filename}'; using note path`)
    return null
  } catch (error) {
    logWarn(logContext, `getFocusedEditorForFilename failed: ${error.message}`)
    return null
  }
}
//-------------------------------------------------------------------------------

/**
 * Apply finish-review metadata updates for a note or open editor.
 * When there is no body metadata line and no combined `project:` frontmatter key, prompts the user to
 * choose a project type tag from settings (plus Cancel). Cancel aborts without writing reviewed.
 * @param {CoreNoteFields | TEditor} noteLike
 * @param {ReviewConfig} config
 * @param {string} reviewedTodayString - e.g. 'reviewed(2026-08-03)'
 * @param {'editor' | 'note'} mode - which mention helpers to use when a metadata line already exists
 * @returns {Promise<boolean>} false if the user cancelled (no metadata writes for the missing-project path)
 * @private
 */
async function applyFinishReviewMetadataUpdates(
  noteLike: CoreNoteFields | TEditor,
  config: ReviewConfig,
  reviewedTodayString: string,
  mode: 'editor' | 'note',
): Promise<boolean> {
  const metadataLineIndex = getProjectMetadataLineIndex(noteLike)
  if (metadataLineIndex === false) {
    logDebug('finishReviewCoreLogic', `No project metadata line found (body or frontmatter) for '${displayTitle(noteLike)}'`)
    // Avoid wiping nextReview until the user confirms the project tag choice.
    const projectTag = await promptForMissingProjectTypeTag(config, displayTitle(noteLike))
    if (projectTag == null) {
      logInfo('finishReviewCoreLogic', `User cancelled; not finishing review for '${displayTitle(noteLike)}'`)
      return false
    }
    clearNextReviewFrontmatterField(noteLike)
    writeCombinedProjectTagAndReviewedMentions(noteLike, projectTag, [reviewedTodayString], 'finishReviewCoreLogic')
    return true
  }

  if (mode === 'editor') {
    // $FlowFixMe[incompatible-call] TEditor path
    deleteMetadataMentionInEditor((noteLike: any), metadataLineIndex, [config.nextReviewMentionStr])
    clearNextReviewFrontmatterField(noteLike)
    // $FlowFixMe[incompatible-call]
    updateBodyMetadataInEditor((noteLike: any), [reviewedTodayString])
  } else {
    deleteMetadataMentionInNote((noteLike: any), metadataLineIndex, [config.nextReviewMentionStr])
    clearNextReviewFrontmatterField(noteLike)
    updateBodyMetadataInNote((noteLike: any), [reviewedTodayString])
  }
  return true
}

/**
 * Finish a project review -- private core logic used by 2 functions.
 * @param {TNote} note - The note to finish
 * @param {number} scrollPos - scroll position for Rich project list refresh after list write
 * @param {{ skipUpdateDashboardIfOpen?: boolean }} [options] - when true, skip Dashboard PROJ* invoke (Dashboard bridge refreshes in-process)
 * @returns {Promise<boolean>} true when review metadata and project list were updated
 */
async function finishReviewCoreLogic(
  note: TNote,
  scrollPos: number = 0,
  options?: { skipUpdateDashboardIfOpen?: boolean }
): Promise<boolean> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`

    // If we're interested in Next Actions, and there are open items in the note, check to see if one is now set.
    // But if the note is marked as sequential, then no need to check.
    const numOpenItems = numberOfOpenItemsInNote(note)
    const isSequential = config.sequentialTag && isProjectNoteIsMarkedSequential(note, config.sequentialTag)
    const runNextActionCheck = !isSequential && config.nextActionTags.length > 0 && numOpenItems > 0
    const nextActionTagLineIndexes: Array<number> = []
    if (runNextActionCheck) {
      for (const naTag of config.nextActionTags) {
        logDebug('finishReviewCoreLogic', `Checking for Next Action tag '${naTag}' in '${displayTitle(note)}' ... with ${numOpenItems} open items`)
        const nextActionLineIndex = getNextActionLineIndex(note, naTag)
        logDebug('finishReviewCoreLogic', `- nextActionLineIndex= '${String(nextActionLineIndex)}'`)

        if (!isNaN(nextActionLineIndex)) {
          nextActionTagLineIndexes.push(nextActionLineIndex)
        }
      }
    }

    // For sequential projects, just make a log note if there are no open tasks
    if (isSequential && numOpenItems === 0) {
      logDebug('finishReviewCoreLogic', `Note: no open tasks found for sequential project '${displayTitle(note)}'.`)
    }

    let wroteMetadata = false
    const focusedEditor = await getFocusedEditorForFilename(note.filename, 'finishReviewCoreLogic')
    if (focusedEditor) {
      logDebug('finishReviewCoreLogic', `Updating EDITOR note '${displayTitle(focusedEditor)}' ...`)
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then clean up @nextReview/@reviewed mentions once.
      migrateProjectMetadataLineInEditor(focusedEditor)
      wroteMetadata = await applyFinishReviewMetadataUpdates(focusedEditor, config, reviewedTodayString, 'editor')
      if (wroteMetadata) {
        await focusedEditor.save()
      }
      // Note: no longer seem to need to update cache
    } else {
      logDebug('finishReviewCoreLogic', `Updating note '${displayTitle(note)}' ...`)
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then clean up @nextReview/@reviewed mentions once.
      migrateProjectMetadataLineInNote(note)
      wroteMetadata = await applyFinishReviewMetadataUpdates(note, config, reviewedTodayString, 'note')
      if (wroteMetadata) {
        DataStore.updateCache(note, true)
      }
    }

    if (!wroteMetadata) {
      logInfo('finishReviewCoreLogic', `- Stopped without updating project list (user cancelled or no write).`)
      return false
    }

    // Rebuild this project from the updated note so progress comments and other note changes
    // are reflected in allProjectsList.json (patching the cached JSON row left lastProgressComment stale).
    logDebug('finishReviewCoreLogic', `- updating Project instance from note`)
    await updateAllProjectsListAfterChange(
      note.filename,
      false,
      config,
      scrollPos,
      options?.skipUpdateDashboardIfOpen ? { skipUpdateDashboardIfOpen: true } : undefined,
    )

    // Ensure the Project List window (if open) no longer shows this project as being actively reviewed
    await clearProjectReviewingInHTML()

    logDebug('finishReviewCoreLogic', `- done`)
    return true
  }
  catch (error) {
    logError('finishReviewCoreLogic', error.message)
    return false
  }
}

// --------------------------------------------------------------------

/**
 * Core of the logic for starting a project review: optionally confirm with user, open note in Editor, highlight as active review in Project List HTML.
 * @param {TNote} noteToReview
 * @param {ReviewConfig} config
 * @param {boolean} offerConfirm - If true and config.confirmNextReview, prompt before opening (startReviews / finish-and-next). If false, open immediately (startReviewForNote).
 * @param {string} logContext - Log tag (e.g. startReviews, startReviewForNote, finishReviewAndStartNextReview)
 * @returns {Promise<boolean>} true if the note was opened, false if user cancelled confirmation
 * @private
 */
async function startReviewCoreLogic(
  noteToReview: TNote,
  config: ReviewConfig,
  offerConfirm: boolean,
  logContext: string,
): Promise<boolean> {
  if (offerConfirm && config.confirmNextReview) {
    const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
    if (res !== 'OK') {
      logDebug(logContext, `- User didn't want to continue.`)
      return false
    }
  }

  // Open/focus the note first, then highlight in the Rich list (highlight-before-open was wiped by list refresh / focus steal).
  logInfo(logContext, `🔍 Opening '${displayTitle(noteToReview)}' note to review ...`)

  // Check if note is already open in one of the Editor windows:
  // - If so, just focus it.
  // - Otherwise open it in the Editor (if running from 'New Window' or 'Split View' mode), or a new split view if not.
  if (config.preferredWindowType === 'Main Window') {
    // Open in split view
    const res = openNoteInSplitViewIfNotOpenAlready(noteToReview.filename)
    if (res) {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was opened in a new split view.`)
    } else {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was already open in an Editor window. Focusing it.`)
    }
  } else {
    // Open in main Editor window
    const openedNote = await Editor.openNoteByFilename(noteToReview.filename)
    if (openedNote) {
      logInfo(logContext, `- Note '${displayTitle(noteToReview)}' was opened in the main Editor.`)
    } else {
      logWarn(logContext, `- Note '${displayTitle(noteToReview)}' couldn't be opened in the main Editor window.`)
    }
  }

  // Show that this project is now being reviewed, if the 'Rich' Project List is open
  await setReviewingProjectInHTML(noteToReview)
  return true
}

/**
 * Start a series of project reviews..
 * Then offers to load the first note to review, based on allProjectsList, ordered by most overdue for review.
 * Note: Used by Project List dialog, and Dashboard.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    // Get the next note to review, based on allProjectsList, ordered by most overdue for review.
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
      return
    } else {
      await startReviewCoreLogic(noteToReview, config, true, 'startReviews')
    }
  } catch (error) {
    logError('startReviews', error.message)
  }
}

/**
 * Start a single project review for a known note (no confirm prompt).
 * Note: Used by Project List dialog and Dashboard. Respects preferredWindowType via startReviewCoreLogic.
 * @param {TNote} noteToReview - the note to start reviewing
 * @author @jgclark
 */
export async function startReviewForNote(noteToReview: TNote): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    await startReviewCoreLogic(noteToReview, config, false, 'startReviewForNote')
  } catch (error) {
    logError('startReviewForNote', error.message)
  }
}

/**
 * Start new review. 
 * Note: Just calls startReviews(), as there's nothing different between the two operations any more. But leaving the distinction in case this changes in future.
 * Note: Used by Project List dialog, ?and Dashboard?.
 * @author @jgclark
 */
export async function nextReview(): Promise<void> {
  try {
    logDebug('nextReview', `Simply calling startReviews() ...`)
    await startReviews()
  } catch (error) {
    logError('nextReview', error.message)
  }
}

/**
 * Complete the current review on the current Editor note
 * @author @jgclark
 */
export async function finishReview(): Promise<void> {
  try {
    // Prefer focused Editor when it is a project note; otherwise any open split with a regular note (calendar may have focus).
    // If several Regular Notes are open and focus is not on one, the helper asks which to use.
    const currentNote = await getFirstRegularNoteAmongOpenEditors()
    if (!currentNote) {
      logWarn('finishReview', `- There's no project note in any open Editor pane to finish reviewing.`)
      await showMessage(`No open editor pane has a project note to finish reviewing. Open the project note (or focus it) and try again.`, 'OK, thanks', 'Reviews')
      return
    }
    logInfo('finishReview', `Starting with Editor note '${displayTitle(currentNote)}'`)
    await finishReviewCoreLogic(currentNote)
  } catch (error) {
    logError('finishReview', error.message)
  }
}

/**
 * Complete review of the given note
 * Note: Used by Dashboard and Project List dialog
 * @author @jgclark
 * @param {TNote} noteIn
 * @param {number} scrollPos - scroll position for Rich project list refresh after list write
 * @param {{ skipUpdateDashboardIfOpen?: boolean }} [options] - when true, skip Dashboard PROJ* invoke (Dashboard bridge refreshes in-process)
 * @returns {Promise<boolean>} true when review metadata and project list were updated
 */
export async function finishReviewForNote(
  noteToUse: TNote,
  scrollPos: number = 0,
  options?: { skipUpdateDashboardIfOpen?: boolean },
): Promise<boolean> {
  try {
    if (!noteToUse || noteToUse.type !== 'Notes') {
      logWarn('finishReviewForNote', `- Not passed a valid project note to finish reviewing. Stopping.`)
      return false
    }

    logInfo('finishReviewForNote', `Starting for passed note '${displayTitle(noteToUse)}'`)
    return await finishReviewCoreLogic(noteToUse, scrollPos, options)
  }
  catch (error) {
    logError('finishReviewForNote', error.message)
    return false
  }
}

/**
 * Complete review of the current (or supplied) project note, then open the next one to review in the Editor.
 * @author @jgclark
 * @param {TNote?} noteArg - optional note to finish; defaults to a Regular Note open in an Editor pane
 * @param {number} scrollPos - scroll position for Rich project list refresh after list write
 * @param {{ skipUpdateDashboardIfOpen?: boolean }} [options] - when true, skip Dashboard PROJ* invoke
 */
export async function finishReviewAndStartNextReview(
  noteArg?: TNote,
  scrollPos: number = 0,
  options?: { skipUpdateDashboardIfOpen?: boolean },
): Promise<void> {
  try {
    logDebug('finishReviewAndStartNextReview', `Starting`)
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    const noteToFinish: ?TNote = noteArg ?? (await getFirstRegularNoteAmongOpenEditors())
    if (!noteToFinish) {
      logWarn('finishReviewAndStartNextReview', `- There's no project note in any open Editor pane to finish reviewing.`)
      await showMessage(`No open editor pane has a project note to finish reviewing. Open the project note (or focus it) and try again.`, 'OK, thanks', 'Reviews')
      return
    }

    logInfo('finishReviewAndStartNextReview', `Finishing review for '${displayTitle(noteToFinish)}'`)
    const finished = await finishReviewForNote(noteToFinish, scrollPos, options)
    if (!finished) {
      logInfo('finishReviewAndStartNextReview', `- Finish did not complete; not starting next review.`)
      return
    }
    logDebug('finishReviewAndStartNextReview', `- Returned from finishReviewForNote() and will now look for next review ...`)

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('finishReviewAndStartNextReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    } else {
      logDebug('finishReviewAndStartNextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      await startReviewCoreLogic(noteToReview, config, true, 'finishReviewAndStartNextReview')
    }
  } catch (error) {
    logError('finishReviewAndStartNextReview', error.message)
  }
}

//-------------------------------------------------------------------------------

/**
 * Skip a project review, moving it forward to a specified date/interval. 
 * Note: private core logic used by 2 functions.
 * @param (TNote | TEditor) note
 * @param (string?) skipIntervalOrDate (optional)
 */
async function skipReviewCoreLogic(note: TNote | TEditor, skipIntervalOrDate: string = '', scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (config == null) throw new Error('No config found. Stopping.')
    logDebug('skipReviewCoreLogic', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
    let newDateStr: string = ''

    // Calculate new date from param 'skipIntervalOrDate' (if given) or ask user
    if (skipIntervalOrDate !== '') {
      // Get new date from parameter as date interval or iso date 
      newDateStr = skipIntervalOrDate.match(RE_DATE_INTERVAL)
        ? calcOffsetDateStr(todaysDateISOString, skipIntervalOrDate)
        : skipIntervalOrDate.match(RE_DATE)
          ? skipIntervalOrDate
          : ''
      if (newDateStr === '') {
        logWarn('skipReviewCoreLogic', `${skipIntervalOrDate} is not a valid interval, so will stop.`)
        return
      }
    }
    else {
      // Get new date from input in the common ISO format, and create new metadata `@nextReview(date)`. Note: different from `@reviewed(date)`.
      const reply = await getInputTrimmed("Next review date (YYYY-MM-DD) or date interval (e.g. '2w' or '3m') to skip until:", 'OK', 'Skip next review')
      if (!reply || typeof reply === 'boolean') {
        logDebug('skipReviewCoreLogic', `User cancelled command.`)
        return
      }
      newDateStr = reply.match(RE_DATE)
        ? reply
        : reply.match(RE_DATE_INTERVAL)
          ? calcOffsetDateStr(todaysDateISOString, reply)
          : ''
      if (newDateStr === '') {
        logWarn('skipReviewCoreLogic', `No valid date entered, so will stop.`)
        return
      }
    }

    // create new metadata `@nextReview(date)`. Note: different from `@reviewed(date)` below.
    const nextReviewMetadataStr = `${config.nextReviewMentionStr}(${newDateStr})`
    logDebug('skipReviewCoreLogic', `- nextReviewDateStr: ${newDateStr} / nextReviewMetadataStr: ${nextReviewMetadataStr}`)

    const focusedEditor = await getFocusedEditorForFilename(note.filename, 'skipReviewCoreLogic')
    if (focusedEditor) {
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions. This ensures that when both frontmatter and
      // body metadata are present, we first migrate/merge them and then update @nextReview() in the canonical place.
      migrateProjectMetadataLineInEditor(focusedEditor)

      // Update metadata in the focused Editor pane
      logDebug('skipReviewCoreLogic', `Updating Editor ...`)
      updateBodyMetadataInEditor(focusedEditor, [nextReviewMetadataStr])
      await focusedEditor.save()
      logDebug('skipReviewCoreLogic', `- done`)
    } else {
      // If project metadata is in frontmatter, replace any body metadata line with migration message (or remove that message)
      // before we recalculate the metadata line index and update mentions.
      migrateProjectMetadataLineInNote(note)

      // add/update metadata on the note
      logDebug('skipReviewCoreLogic', `Updating note ...`)
      updateBodyMetadataInNote(note, [nextReviewMetadataStr])
      DataStore.updateCache(note, true)
    }
    logDebug('skipReviewCoreLogic', `- done`)

    // Save changes to allProjects list
    // v1:
    // const thisNoteAsProject = new Project(note)
    // const newMSL = thisNoteAsProject.TSVSummaryLine()
    // logDebug('skipReviewCoreLogic', `- updatedTSVSummaryLine => '${newMSL}'`)
    // await updateAllProjectsListAfterChange(currentNote.filename, false, config, newMSL)
    // v2: Try to find this project in allProjects, and update that as well
    let thisNoteAsProject = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.nextReviewDateStr = newDateStr
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      logDebug('skipReviewCoreLogic', `-> reviewedDate = ${String(thisNoteAsProject.reviewedDate)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDateStr = ${String(thisNoteAsProject.nextReviewDateStr)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
      // Write changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (but don't open window if not open already)
      await renderProjectListsIfOpen(config, scrollPos)
    } else {
      // Regenerate whole list (and display if window is already open)
      logWarn('skipReviewCoreLogic', `- Couldn't find project '${note.filename}' in allProjects list. So regenerating whole list and display.`)
      await generateProjectListsAndRenderIfOpen(scrollPos)
    }
  }
  catch (error) {
    logError('skipReviewCoreLogic', error.message)
  }
}

/**
 * Skip the next review for the note open in the Editor, asking when to delay to, add that as a @nextReview() date, and jump to next project to review.
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 */
export async function skipReview(): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    const currentNote = Editor
    if (!currentNote || currentNote.type !== 'Notes') {
      logWarn('skipReview', `- There's no project note in the Editor, so will stop.`)
      await showMessage(`The current Editor note doesn't contain a project note.`, 'OK, thanks', 'Skip Review')
      return
    }
    logDebug('skipReview', `Starting for Editor '${displayTitle(currentNote)}'`)
    await skipReviewCoreLogic(currentNote)

    // Then move to nextReview
    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (!noteToReview) {
      logInfo('skipReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
      return
    }
    else {
      logDebug('skipReview', `- opening '${displayTitle(noteToReview)}' as next note ...`)
      // Reuse start path so preferredWindowType and Rich list "Under Review" highlight apply
      await startReviewCoreLogic(noteToReview, config, true, 'skipReview')
    }
  } catch (error) {
    logError('skipReview', error.message)
  }
}

/**
 * Skip the next review for the given note, to the date/interval specified.
 * Note: skipReview() is an interactive version of this for Editor.note
 * @author @jgclark
 */
export async function skipReviewForNote(note: TNote, skipIntervalOrDate: string, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')

    if (!note || note.type !== 'Notes') {
      logWarn('skipReviewForNote', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
      return
    }
    logDebug('skipReviewForNote', `Starting for note '${displayTitle(note)}' with ${skipIntervalOrDate}`)
    await skipReviewCoreLogic(note, skipIntervalOrDate, scrollPos)
  }
  catch (error) {
    logError('skipReviewForNote', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Set a new review interval the note open in the Editor, by asking user.
 * TEST: following change to allProjects list
 * Note: see below for a non-interactive version that takes parameters
 * @author @jgclark
 * @param {TNote?} noteArg 
 */
export async function setNewReviewInterval(noteArg?: TNote, scrollPos: number = 0): Promise<void> {
  try {
    const config: ?ReviewConfig = await getReviewSettings()
    if (config == null) throw new Error('No config found. Stopping.')
    logDebug('setNewReviewInterval', `Starting for ${noteArg ? 'passed note (' + noteArg.filename + ')' : 'Editor'}`)
    const note: TNote | TEditor = noteArg ? noteArg : Editor
    if (!note || note.type !== 'Notes') {
      await showMessage(`The current Editor note doesn't contain a project note.`, 'OK, thanks', 'Set new review interval')
      throw new Error(`Not in a valid project note. Stopping.`)
    }

    // Ask user for new date interval
    const reply = await getInputTrimmed("Next review interval (e.g. '2w' or '3m') to set", 'OK', 'Set new review interval')
    if (!reply || typeof reply === 'boolean') {
      logDebug('setNewReviewInterval', `User cancelled command.`)
      return
    }
    // Get new date interval
    const newIntervalStr: string = reply.match(RE_DATE_INTERVAL) ? reply : ''
    if (newIntervalStr === '') {
      logError('setNewReviewInterval', `No valid interval entered, so will stop.`)
      return
    }
    logDebug('setNewReviewInterval', `- new review interval = ${newIntervalStr}`)

    // Update `@review(int)` metadata in the current open note in Editor, or the given note
    if (!noteArg) {
      // Update metadata in the current open note
      logDebug('setNewReviewInterval', `Updating metadata in Editor`)
      const possibleThisEditor = getOpenEditorFromFilename(note.filename)
      if (possibleThisEditor) {
        // Ensure any legacy body metadata is migrated into frontmatter before updating @review()
        migrateProjectMetadataLineInEditor(possibleThisEditor)
        updateBodyMetadataInEditor(possibleThisEditor, [`@review(${newIntervalStr})`])
      } else {
        logDebug('setNewReviewInterval', `- Couldn't find open Editor for note '${note.filename}', so will update note directly.`)
        migrateProjectMetadataLineInNote(note)
        updateBodyMetadataInNote(note, [`@review(${newIntervalStr})`])
      }
      // Save Editor, so the latest changes can be picked up elsewhere
      // Putting the Editor.save() here, rather than in the above functions, seems to work
      await saveEditorIfNecessary()
    } else {
      // update metadata on the note
      logDebug('setNewReviewInterval', `Updating metadata in note`)
      migrateProjectMetadataLineInNote(note)
      updateBodyMetadataInNote(note, [`@review(${newIntervalStr})`])
    }
    logDebug('setNewReviewInterval', `- done`)

    // Save changes to allProjects list
    // v1:
    // const thisNoteAsProject = new Project(note)
    // thisNoteAsProject.calcDurations()
    // thisNoteAsProject.calcNextReviewDate()
    // const newMSL = thisNoteAsProject.TSVSummaryLine()
    // await updateAllProjectsListAfterChange(note.filename, false, config)
    // v2:
    let thisNoteAsProject = await getSpecificProjectFromList(note.filename)
    if (thisNoteAsProject) {
      thisNoteAsProject.reviewInterval = newIntervalStr
      thisNoteAsProject = calcReviewFieldsForProject(thisNoteAsProject)
      logDebug('setNewReviewInterval', `-> reviewInterval = ${String(thisNoteAsProject.reviewInterval)} / dueDays = ${String(thisNoteAsProject.dueDays)} / nextReviewDateStr = ${String(thisNoteAsProject.nextReviewDateStr)} / nextReviewDays = ${String(thisNoteAsProject.nextReviewDays)}`)
      // Write changes to allProjects list
      await updateProjectInAllProjectsList(thisNoteAsProject)
      // Update display for user (but don't focus)
      await renderProjectListsIfOpen(config, scrollPos)
    }
  } catch (error) {
    logError('setNewReviewInterval', error.message)
  }
}
