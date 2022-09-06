// @flow

import pluginJson from '../plugin.json'
import { JSP, clo, log, logError, logWarn, logDebug } from '@helpers/dev'
import { findNotesWithOverdueTasksAndMakeToday } from '@helpers/NPnote'
import { chooseFolder } from '@helpers/userInput'

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
    await findNotesWithOverdueTasksAndMakeToday({
      openOnly: datePlusOpenOnly,
      foldersToIgnore: datePlusFoldersToIgnore,
      datePlusOnly: true,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: false,
      singleNote: null,
      noteFolder: false,
      replaceDate,
    })
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
    await findNotesWithOverdueTasksAndMakeToday({
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: true,
      singleNote: null,
      noteFolder: false,
      replaceDate,
    })
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
    await findNotesWithOverdueTasksAndMakeToday({
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: false,
      noteFolder: false,
      singleNote: false,
      replaceDate,
    })
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find and update all overdue tasks, including >date and >date+ in Active Note in Editor
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks (by Task)")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksInNote(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksInNote: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    await findNotesWithOverdueTasksAndMakeToday({
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: true,
      replaceDate,
      noteFolder: false,
      singleNote: true,
    })
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Find and update all overdue tasks, including >date and >date+ in a folder chosen by user
 *  DISPLAY EACH NOTE'S TASK FIRST, WITH OPTION TO EXPLORE EACH TASK
 * (plugin entry point for "/Review overdue tasks in <Choose Folder>")
 * @param {string} incoming - comes from xcallback - any string runs this command silently
 */
export async function reviewOverdueTasksInFolder(incoming: string): Promise<void> {
  try {
    logDebug(pluginJson, `reviewOverdueTasksInFolder: incoming="${incoming}" typeof=${typeof incoming}`)
    const confirmResults = incoming ? false : true
    const { overdueOpenOnly, overdueFoldersToIgnore, showUpdatedTask, replaceDate } = DataStore.settings
    await findNotesWithOverdueTasksAndMakeToday({
      openOnly: overdueOpenOnly,
      foldersToIgnore: overdueFoldersToIgnore,
      datePlusOnly: false,
      confirm: confirmResults,
      showUpdatedTask,
      showNote: true,
      replaceDate,
      singleNote: false,
      noteFolder: await chooseFolder('Choose Folder to Search for Overdue Tasks'),
    })
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
