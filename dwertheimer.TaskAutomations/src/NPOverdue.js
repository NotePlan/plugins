// @flow

import pluginJson from '../plugin.json'
import { showMessageYesNo, chooseFolder, showMessage, chooseOptionWithModifiers } from '../../helpers/userInput'
import { getOverdueParagraphs } from '../../helpers/NPParagraph'
import { reviewTasksInNotes, getNotesAndTasksToReview, createArrayOfNotesAndTasks, getNotesWithOpenTasks, getWeeklyOpenTasks } from './NPTaskScanAndProcess'
import { JSP, clo, log, logError, logWarn, logDebug } from '@helpers/dev'
import { filenameDateString } from '@helpers/dateTime'
import { getTodaysReferences } from '@helpers/NPnote'

const todayFileName = `${filenameDateString(new Date())}.${DataStore.defaultFileExtension}`

/**
 * After an overdue task scan is complete,
 * ask user if they want to review all the items on this week's note
 * @param {boolean} byTask - if true, review tasks one at a time, otherwise by note
 * @param {boolean} silent - if true, don't ask
 */
export async function askToReviewWeeklyTasks(byTask: boolean = false) {
  try {
    const { askToReviewWeeklyTasks } = DataStore.settings
    if (askToReviewWeeklyTasks) {
      // await Editor.openNoteByDate(new Date())
      const answer = await showMessageYesNo(`Want to review tasks scheduled for this week?`, ['Yes', 'No'], 'Review Weekly Note Tasks', true)

      if (answer === 'Yes') {
        logDebug(pluginJson, `askToReviewTodaysTasks: now launching review of today's tasks; byTask=${String(byTask)}`)
        await reviewEditorReferencedTasks(null, byTask, true)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * After an overdue task scan is complete,
 * ask user if they want to review all the items marked for >today or today's date
 * @param {boolean} byTask - if true, review tasks one at a time, otherwise by note
 */
export async function askToReviewTodaysTasks(byTask: boolean = false) {
  try {
    const { askToReviewTodaysTasks } = DataStore.settings
    if (askToReviewTodaysTasks) {
      await Editor.openNoteByDate(new Date())
      const answer = await showMessageYesNo(`Want to review tasks scheduled for today?`, ['Yes', 'No'], 'Review Current Tasks', true)
      if (answer === 'Yes') {
        logDebug(pluginJson, `askToReviewTodaysTasks: now launching review of today's tasks; byTask=${String(byTask)}`)
        await reviewEditorReferencedTasks(null, byTask)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * After an overdue task scan is complete,
 * ask user if they want to review all open items from previous calendar notes
 * Plugin entrypoint for command: "/COMMAND"
 * @param {*} incoming
 */
export async function askToReviewForgottenTasks(byTask: boolean = false) {
  try {
    const { askToReviewForgottenTasks, ignoreScheduledInForgottenReview } = DataStore.settings
    if (askToReviewForgottenTasks) {
      await Editor.openNoteByDate(new Date())
      const answer = await showMessageYesNo('Review undated tasks from prev days?', ['Yes', 'No'], 'Review Undated Tasks', true)
      if (answer === 'Yes') {
        // Commented out this ask about ignoring scheduled tasks. It works cand can be uncommented, but it felt like too many questions
        // added a user preference for it instead
        // answer = await showMessageYesNo('Ignore items which have dates/are scheduled?', ['Yes', 'No'], "Ignore Scheduled Tasks", true)
        logDebug(pluginJson, `askToReviewForgottenTasks: now launching review of today's tasks; byTask=${String(byTask)}`)
        await searchForOpenTasks(null, byTask, ignoreScheduledInForgottenReview)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

// WITH THE NEW OVERDUE TASK SCAN, DATE PLUS PROBABLY ISN'T NEEDED ANYMORE
/**
 * Find and update date+ tags
 * (plugin entry point for "/Update >date+ tags in Notes")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function updateDatePlusTags(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `updateDatePlusTags: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { datePlusOpenOnly, datePlusFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    const options = {
      openOnly: datePlusOpenOnly,
      foldersToIgnore: datePlusFoldersToIgnore,
      datePlusOnly: true,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: false,
      noteTaskList: null,
      noteFolder: false,
      replaceDate,
      overdueOnly: true,
    }
    const notesToReview = getNotesAndTasksToReview(options)
    await reviewTasksInNotes(notesToReview, options)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find and update all overdue tasks, including >date and >date+
 * DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks (by Note)")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksByNote(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksByNote: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    const options = {
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: true,
      noteTaskList: null,
      noteFolder: false,
      replaceDate,
      overdueOnly: true,
    }
    const notesToReview = getNotesAndTasksToReview(options)
    await reviewTasksInNotes(notesToReview, options)
    await askToReviewWeeklyTasks(false)
    await askToReviewTodaysTasks(false)
    await askToReviewForgottenTasks(false)
    await showMessage(`Review Complete!`, 'OK', 'Task Review', true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find and update all overdue tasks, including >date and >date+
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks (by Task)")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksByTask(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksByTask: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    const options = {
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: false,
      noteFolder: false,
      noteTaskList: null,
      replaceDate,
      overdueOnly: true,
    }
    const notesToReview = getNotesAndTasksToReview(options)
    await reviewTasksInNotes(notesToReview, options)
    await askToReviewWeeklyTasks(true)
    await askToReviewTodaysTasks(true)
    await askToReviewForgottenTasks(true)
    await showMessage(`Review Complete!`, 'OK', 'Task Review', true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function startReactReview() {}

/**
 * Find and update all overdue tasks, including >date and >date+ in Active Note in Editor
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks in active note")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksInNote(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksInNote: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate, confirm } = DataStore.settings
    // const overdues = Editor.note ? getOverdueParagraphs(Editor?.note, '') : [] //do not replace the dates so we can see and more easily match them
    // const openTasks = Editor?.note?.paragraphs.filter(isOpen).filter((p) => p.type === 'open') || []
    if (Editor.note) {
      const overdues = getOverdueParagraphs(Editor.note.paragraphs)
      logDebug(pluginJson, `reviewOverdueTasksInNote: overdues.length=${overdues.length}`)
      const options = {
        openOnly: overdueOpenOnly,
        foldersToIgnore: overdueFoldersToIgnore,
        datePlusOnly: false,
        confirm: confirmResults,
        showUpdatedTask,
        showNote: false,
        replaceDate,
        noteFolder: false,
        noteTaskList: overdues,
        overdueOnly: true,
      }
      // $FlowIgnore
      const notesToReview = getNotesAndTasksToReview(options)
      clo(notesToReview, 'reviewOverdueTasksInNote: notesToReview')
      await reviewTasksInNotes(notesToReview, options)
      // find tasks in Editor note that are not in overdues (match by lineIndex property)
      logDebug(pluginJson, `reviewOverdueTasksInNote: after reviewTasksInNotes`)
      const paras = Editor?.note?.paragraphs || []
      const diffTasks = paras.filter((task) => task.type === 'open' && !overdues.find((ot) => ot.lineIndex !== undefined && ot.lineIndex === task.lineIndex))
      // if there are more tasks in the note than the overdue ones we found, ask if we should review the rest
      if (diffTasks && diffTasks.length) {
        if ((await showMessageYesNo(`Review other open tasks in this note?`, ['Yes', 'No'], 'Task Review', true)) === 'Yes') {
          await reviewTasksInNotes([diffTasks], { ...options, noteTaskList: [diffTasks] || [], overdueOnly: false })
        }
      }
      if (confirm) await showMessage(`Note Review Complete!`, 'OK', 'Task Review', true)
      if (Editor.filename === todayFileName && confirm) {
        await askToReviewTodaysTasks(true)
      }
    } else {
      logDebug(pluginJson, `reviewOverdueTasksInNote Editor.note is null`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Review weekly note tasks
 * (plugin entry point for "/Review/Weekly Tasks")
 * @param {*} incoming
 */
export async function reviewWeeklyTasks(incoming: string): Promise<void> {
  logDebug(pluginJson, `reviewWeeklyTasks starting. incoming: ${incoming}`)
  await reviewEditorReferencedTasks(null, true, true)
}

/**
 *  Find all tasks in today's references (either marked for today or in weekly note)
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review/Reschedule Tasks Dated Today")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 * @param {boolean} byTask - if true, display each task individually, otherwise display all tasks in each note
 * @param {boolean} weeklyNote - if true, use weekly note instead of today's note
 */
export async function reviewEditorReferencedTasks(incoming: string | null = null, byTask: boolean = true, weeklyNote: boolean = false): Promise<void> {
  try {
    await Editor.openNoteByDate(new Date())
    logDebug(pluginJson, `reviewEditorReferencedTasks: incoming="${incoming || ''}" typeof=${typeof incoming}`)
    if (Editor.note?.type !== 'Calendar') {
      await showMessage(`You must be in a Calendar Note to run this command.`)
      return
    }
    // clo(getTodaysReferences(Editor.note), `reviewEditorReferencedTasks todayReferences`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    const refs = getTodaysReferences(Editor.note)
    logDebug(pluginJson, `reviewEditorReferencedTasks refs.length=${refs.length}`)
    const openTasks = weeklyNote ? [] : refs.filter((p) => p.type === 'open' && p.content !== '')
    const thisWeeksTasks = weeklyNote ? getWeeklyOpenTasks() : []
    logDebug(pluginJson, `reviewEditorReferencedTasks openTasks.length=${openTasks.length} thisWeeksTasks=${thisWeeksTasks.length}`)
    // gather references by note
    const arrayOfOpenNotesAndTasks = createArrayOfNotesAndTasks([...thisWeeksTasks, ...openTasks])
    // clo(arrayOfOpenNotesAndTasks, `reviewEditorReferencedTasks arrayOfOpenNotesAndTasks`)
    // clo(arrayOfNotesAndTasks, `NPOverdue::reviewEditorReferencedTasks arrayOfNotesAndTasks`)
    logDebug(pluginJson, `reviewEditorReferencedTasks arrayOfNotesAndTasks.length=${arrayOfOpenNotesAndTasks.length}`)
    const options = {
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: !byTask,
      replaceDate,
      noteFolder: false,
      noteTaskList: arrayOfOpenNotesAndTasks,
      overdueOnly: false,
    }
    await reviewTasksInNotes(arrayOfOpenNotesAndTasks, options)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find and update all overdue tasks in a specific folder
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks in <Choose Folder>")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksInFolder(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksInFolder: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    const options = {
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: true,
      replaceDate,
      noteTaskList: null,
      noteFolder: await chooseFolder('Choose Folder to Search for Overdue Tasks'),
      overdueOnly: true,
    }
    const notesToReview = getNotesAndTasksToReview(options)
    await reviewTasksInNotes(notesToReview, options)
    await askToReviewWeeklyTasks(true)
    await askToReviewTodaysTasks(true)
    await askToReviewForgottenTasks(true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * For Open task search, ask the user what notes to get and return an array of notes to review
 * @param {*} incoming
 */
export async function getNotesToReviewForOpenTasks(ignoreScheduledInForgottenReview: boolean = true): Promise<Array<Array<TParagraph>> | false> {
  try {
    const { searchForgottenTasksOldestToNewest, overdueFoldersToIgnore } = DataStore.settings

    const OPTIONS = [
      { label: '1 day', value: { num: 1, unit: 'day' } },
      { label: '7 days', value: { num: 7, unit: 'day' } },
      { label: '14 days', value: { num: 14, unit: 'day' } },
      { label: '1 month', value: { num: 1, unit: 'month' } },
      { label: '3 months', value: { num: 3, unit: 'month' } },
      { label: '6 months', value: { num: 6, unit: 'month' } },
      { label: '1 year', value: { num: 1, unit: 'year' } },
      { label: 'All Time', value: { num: 99, unit: 'year' } },
      { label: '(opt-click to include Project Notes for period)', value: { num: -1, unit: 'day' } },
      // { label: '21 days', value: { num: 21, unit: 'day' } },
      // { label: '❌ Cancel', value: { num: -1, unit: 'day' } },
    ]
    // const DEFAULT_OPTION: Option1 = { unit: 'day', num: 0 }
    const history = await chooseOptionWithModifiers('Review Calendar Note Tasks From the Last...', OPTIONS)
    if (!history || history.num === -1) return false
    const { value, keyModifiers } = history

    const noteTypes = keyModifiers.indexOf('opt') > -1 ? 'both' : 'Calendar'
    const notesWithOpenTasks = await getNotesWithOpenTasks(noteTypes, value, { searchForgottenTasksOldestToNewest, overdueFoldersToIgnore, ignoreScheduledInForgottenReview })
    const totalTasks = notesWithOpenTasks.reduce((acc, n) => acc + n.length, 0)
    logDebug(pluginJson, `Calendar + Project Notes to review: ${notesWithOpenTasks.length}; total tasks: ${totalTasks}`)
    return notesWithOpenTasks
  } catch (error) {
    logError(pluginJson, JSP(error))
    return false
  }
}

/**
 * Search for open tasks in Calendar and Project notes
 * Plugin entrypoint for command: "/Search Forgotten Tasks Oldest to Newest"
 * @param {*} incoming
 */
export async function searchForOpenTasks(incoming: string | null = null, byTask: boolean = false, ignoreScheduledInForgottenReview: boolean = true) {
  try {
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    logDebug(pluginJson, `searchForOpenTasks incoming:${incoming || ''} byTask:${String(byTask)} ignoreScheduledInForgottenReview:${String(ignoreScheduledInForgottenReview)}`)
    const notes = await getNotesToReviewForOpenTasks(ignoreScheduledInForgottenReview)

    if (!notes || !notes.length) {
      await showMessage('No open tasks in that timeframe!', 'OK', 'Open Tasks', true)
      return
    }
    const options = {
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: true,
      showUpdatedTask,
      showNote: !byTask,
      replaceDate,
      noteTaskList: null,
      noteFolder: false,
      overdueOnly: false,
    }
    await reviewTasksInNotes(notes, options)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
