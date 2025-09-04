// @flow
// ----------------------------------------------------------------------------
// Inbox command for QuickCapture plugin
// by Jonathan Clark
// last update 2025-08-25 for v1.0.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getQuickCaptureSettings } from './quickCaptureHelpers'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import {getNoteFromParamOrUser, getOrMakeCalendarNote } from '@helpers/NPnote'
import { smartCreateSectionsAndPara } from '@helpers/paragraph'
import {  showMessage} from '@helpers/userInput'

// ---------------------------------------------------------------------------
// Exported functions

/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation')
 * - append or prepend to the inbox note (default: append)
 * Can be used from x-callback with two passed arguments.
 * @author @jgclark
 * @param {string?} taskContentArg
 * @param {string?} inboxTitleArg
 * @param {string?} inboxHeadingArg (if not given, will use setting 'inboxHeading')
 */
export async function addTaskToInbox(
  taskContentArg?: string = '',
  inboxTitleArg?: string = '',
  inboxHeading?: string = '',
): Promise<void> {
  try {
    await addItemToInbox('task', taskContentArg, inboxTitleArg, inboxHeading)
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
 * @param {string?) textContentArg
 * @param {string?) inboxTitleArg
 * @param {string?} inboxHeadingArg (if not given, will use setting 'inboxHeading')
 */
export async function addJotToInbox(
  textContentArg?: string = '',
  inboxTitleArg?: string = '',
  inboxHeading?: string = '',
): Promise<void> {
  try {
    await addItemToInbox('jot', textContentArg, inboxTitleArg, inboxHeading)
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

// ---------------------------------------------------------------------------
// Private function

/**
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation') or to arg2 (if given)
 * - append or prepend to the inbox note (default: append)
 * Note: Internal function used by exported functions above.
 * @author @jgclark
 * @param {string?} itemType: 'task' (default) or 'jot' (i.e. text)
 * @param {string} itemContentArg (if empty, will ask user)
 * @param {string} inboxTitleArg (if empty, will ask user)
 * @param {string} inboxHeadingArg (if empty, will use setting 'inboxHeading')
 */
async function addItemToInbox(
  itemType: string,
  itemContentArg: string,
  inboxTitleArg: string,
  inboxHeadingArg: string,
): Promise<void> {
  try {
    // If this is a task, then type is 'open', otherwise treat as 'text'
    const paraType = itemType === 'task' ? 'open' : 'text' 
    const config = await getQuickCaptureSettings()
    logDebug(pluginJson, `addItemToInbox(): starting for ${itemType} (= paraType ${paraType}) with ${String(config.inboxLocation ?? 'undefined') ?? 'undefined'}`)
    const textToAppend = (config.textToAppendToTasks && itemType === 'task')
      ? ` ${config.textToAppendToTasks}`
      : (config.textToAppendToJots && itemType === 'jot')
        ? ` ${config.textToAppendToJots}`
        : ''
    const inboxHeading = (inboxHeadingArg !== '')
      ? inboxHeadingArg
      : (config.inboxHeading && config.inboxHeading !== '')
        ? config.inboxHeading :
        ''

    // Use of these args
    let inboxTitleToUse = ''
    if (inboxTitleArg !== '') {
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
    let itemText = (itemContentArg != null && itemContentArg !== '')
      ? itemContentArg
      : await CommandBar.showInput(`Type the ${itemType} to add to ${displayTitle(inboxNote)}`, `Add ${itemType} '%@'${textToAppend}`)
    if (itemType === 'jot') {
      itemText += textToAppend
    }

    if (config.addInboxPosition === 'append') {
      smartCreateSectionsAndPara(inboxNote, itemText, paraType, [inboxHeading], config.headingLevel, true)
      logDebug(pluginJson, `- appended to note '${displayTitle(inboxNote)}'`)
    } else {
      smartCreateSectionsAndPara(inboxNote, itemText, paraType, [inboxHeading], config.headingLevel, false)
      logDebug(pluginJson, `- prepended to note '${displayTitle(inboxNote)}'`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
