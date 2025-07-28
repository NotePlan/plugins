// @flow
// ----------------------------------------------------------------------------
// Inbox command for QuickCapture plugin
// by Jonathan Clark
// last update 2025-07-28 for v0.17.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getNoteFromParamOrUser,
  getQuickCaptureSettings,
  // type QCConfigType,
} from './quickCaptureHelpers'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { smartCreateSectionsAndPara } from '@helpers/paragraph'
import {
  // chooseFolder, chooseHeading,
  showMessage
} from '@helpers/userInput'

/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation')
 * - append or prepend to the inbox note (default: append)
 * Can be used from x-callback with two passed arguments.
 * @author @jgclark
 * @param {string?) taskArg
 * @param {string?) inboxTitleArg
 */
export async function addTaskToInbox(
  taskArg?: string = '',
  inboxTitleArg?: string = '',
): Promise<void> {
  try {
    await addItemToInbox('task', taskArg, inboxTitleArg)
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /jot
 * This adds a quick 'jot' note to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation')
 * - append or prepend to the inbox note (default: append)
 * Can be used from x-callback with two passed arguments.
 * @author @jgclark
 * @param {string?) textArg
 * @param {string?) inboxTitleArg
 */
export async function addJotToInbox(
  textArg?: string = '',
  inboxTitleArg?: string = '',
): Promise<void> {
  try {
    await addItemToInbox('jot', textArg, inboxTitleArg)
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/**
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation') or to arg2 (if given)
 * - append or prepend to the inbox note (default: append)
 * Note: Internal function used by exported functions above.
 * @author @jgclark
 * @param {string?} itemType: 'task' (default) or 'jot' (i.e. text)
 * @param {string?} taskArg (if not given, will ask user)
 * @param {string?} inboxTitleArg (if not given, will ask user)
 */
async function addItemToInbox(
  itemType: string = 'task',
  itemArg?: string = '',
  inboxTitleArg?: string = '',
): Promise<void> {
  try {
    // If this is a task, then type is 'open', otherwise treat as 'text'
    const paraType = itemType === 'task' ? 'open' : 'text' 
    const config = await getQuickCaptureSettings()
    logDebug(pluginJson, `addItemToInbox(): starting for ${itemType} (= paraType ${paraType}) with ${config.inboxLocation}`)
    const textToAppend = (config.textToAppendToTasks && itemType === 'task')
      ? ` ${config.textToAppendToTasks}`
      : (config.textToAppendToJots && itemType === 'jot')
        ? ` ${config.textToAppendToJots}`
        : ''
    const inboxHeading = (config.inboxHeading && config.inboxHeading !== '') ? config.inboxHeading : ''

    // TEST: Extra possible arg
    // let inboxNote: ?TNote
    let inboxTitleToUse = ''
    if (inboxTitleArg && inboxTitleArg !== '') {
      inboxTitleToUse = inboxTitleArg
      logDebug('addItemToInbox', `Title arg given: inboxTitleToUse=${inboxTitleToUse}`)
    } else {
      switch (config.inboxLocation) {
        case "Daily": {
          inboxTitleToUse = 'today'
          break
        }

        case "Weekly": {
          inboxTitleToUse = 'this week'
          break
        }

        default: {
          if (!config.inboxTitle || config.inboxTitle === '') {
            throw new Error("Quick Capture to Inbox: please set the title of your chosen fixed Inbox note in Quick Capture preferences.")
          } else {
            inboxTitleToUse = config.inboxTitle
          }
          break
        }
      }
      logDebug('addItemToInbox', `No title arg given: inboxTitleToUse=${inboxTitleToUse}`)
    }

    const inboxNote = await getNoteFromParamOrUser(`Inbox ${itemType}`, inboxTitleToUse)
    if (!inboxNote) {
      throw new Error("Quick Add to Inbox: Couldn't get or make valid Inbox note.")
    }

    // Get item title either from passed argument or ask user
    let itemText = (itemArg != null && itemArg !== '')
      ? itemArg
      : await CommandBar.showInput(`Type the ${itemType} to add to ${displayTitle(inboxNote)}`, `Add ${itemType} '%@'${textToAppend}`)
    if (itemType === 'jot') {
      itemText += textToAppend
    }

    if (config.addInboxPosition === 'append') {
      // inboxNote.appendTodo(itemText)
      smartCreateSectionsAndPara(inboxNote, itemText, paraType, [inboxHeading], config.headingLevel, true)
      logDebug(pluginJson, `- appended to note '${displayTitle(inboxNote)}'`)
    } else {
      // inboxNote.prependTodo(itemText)
      smartCreateSectionsAndPara(inboxNote, itemText, paraType, [inboxHeading], config.headingLevel, false)
      logDebug(pluginJson, `- prepended to note '${displayTitle(inboxNote)}'`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
