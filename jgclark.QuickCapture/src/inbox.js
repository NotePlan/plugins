// @flow
// ----------------------------------------------------------------------------
// Inbox command for QuickCapture plugin
// by Jonathan Clark
// last update v0.12.0, 27.7.2022 by @jgclark
// ----------------------------------------------------------------------------
// TODO: Work the argument-handling changes in /qalh into rest of functions
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getQuickCaptureSettings,
  type QCConfigType,
} from './quickCapture'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
// import { findEndOfActivePartOfNote, smartPrependPara } from '@helpers/paragraph'
import { chooseFolder, chooseHeading, showMessage } from '@helpers/userInput'

/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation')
 * - append or prepend to the inbox note (default: append)
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * @author @jgclark
 * @param {string?) taskArg
 */
export async function addTaskToInbox(taskArg?: string = ''): Promise<void> {
  try {
    const config = await getQuickCaptureSettings()
    logDebug(pluginJson, `starting /addTaskToInbox with ${config.inboxLocation}`)

    let inboxNote: ?TNote
    switch (config.inboxLocation) {
      case "Daily": {
        inboxNote = DataStore.calendarNoteByDate(new Date(), "day")
        break
      }

      case "Weekly": {
        if (NotePlan.environment.buildVersion < 801) {
          throw new Error("Sorry; adding to Weekly note requires NotePlan v3.6 or newer.")
        }
        inboxNote = DataStore.calendarNoteByDate(new Date(), "week")
        break
      }

      default: {
        // Get or make the inbox note from the Datastore
        let newFilename: string
        if (config.inboxTitle === '') {
          throw new Error("Quick Capture to Inbox: please set the title of your chosen fixed Inbox note in Quick Capture preferences.")
        } else {
          const matchingNotes = DataStore.projectNoteByTitleCaseInsensitive(config.inboxTitle) ?? []
          inboxNote = matchingNotes[0] ?? null

          // Create the inbox note if it doesn't exist, asking the user which folder
          if (inboxNote == null) {
            const folder = await chooseFolder('Choose a folder for your inbox note (or cancel [ESC])')
            newFilename = DataStore.newNote(config.inboxTitle, folder) ?? ''
            // Note: this returns a filename not of our choosing
            if (newFilename != null && newFilename !== '') {
              logDebug(pluginJson, `- made new inbox note, filename = ${newFilename}`)
              inboxNote = DataStore.projectNoteByFilename(newFilename)
            }
          }
        }
        break
      }
    }

    if (inboxNote) {
      // Get task title either from passed argument or ask user
      let taskText = (taskArg != null && taskArg != '')
        ? taskArg
        : await CommandBar.showInput(`Type the task to add to ${displayTitle(inboxNote)}`, `Add task '%@' ${config.textToAppendToTasks}`)
      taskText += ` ${config.textToAppendToTasks}`

      if (config.addInboxPosition === 'append') {
        inboxNote.appendTodo(taskText)
        logDebug(pluginJson, `- appended to note '${displayTitle(inboxNote)}'`)
      } else {
        inboxNote.prependTodo(taskText)
        logDebug(pluginJson, `- prepended to note '${displayTitle(inboxNote)}'`)
      }
    } else {
      throw new Error("Quick Add to Inbox: Couldn't get or make valid Inbox note.")
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
