// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Projects plugin
// Last updated 1.4.2024 for v0.14.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  finishReviewForNote,
  makeProjectLists,
  skipReviewForNote,
  toggleDisplayOnlyDue,
  toggleDisplayFinished,
} from './reviews'
import {
  addProgressUpdate,
  cancelProject,
  completeProject,
  togglePauseProject,
} from './projects'
// import { getReviewSettings } from './reviewHelpers'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
// import { displayTitle } from '@helpers/general'
// import { sendToHTMLWindow } from '@helpers/HTMLView'
import {
  getLiveWindowRectFromWin, getWindowFromCustomId,
  logWindowsList,
  storeWindowRect,
} from '@helpers/NPWindows'
import { decodeRFC3986URIComponent } from '@helpers/stringTransforms'

//-----------------------------------------------------------------
// Data types + constants

type MessageDataObject = {
  itemID: string,
  type: string,
  controlStr: string,
  encodedFilename: string,
}
type SettingDataObject = { settingName: string, state: string }

const windowCustomId = `${pluginJson['plugin.id']}.main`

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export async function onMessageFromHTMLView(type: string, data: any): any {
  try {
    logDebug(pluginJson, `onMessageFromHTMLView dispatching data to ${type}:`)
    // clo(data, 'onMessageFromHTMLView dispatching data object:')
    switch (type) {
      case 'onClickProjectListItem':
        await bridgeClickProjectListItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
      case 'onChangeCheckbox':
        await bridgeChangeCheckbox(data) // data is a string
        break
      case 'refresh':
        await makeProjectLists() // no await needed, I think
        break
      case 'runPluginCommand':
        await runPluginCommand(data) // no await needed, I think
        break
      default:
        logError(pluginJson, `onMessageFromHTMLView(): unknown ${type} cannot be dispatched`)
        break
    }
    return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * HTML View requests running a plugin command
 * @param {any} data object
 */
export async function runPluginCommand(data: any) {
  try {
    logDebug(pluginJson, `runPluginCommand: received data: ${JSP(data)}`)
    clo(data, 'runPluginCommand received data object')
    await DataStore.invokePluginCommandByName(data.commandName, data.pluginID, data.commandArgs ?? [])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a checkbox in the HTML view
 * @param {SettingDataObject} data - setting name
 */
export async function bridgeChangeCheckbox(data: SettingDataObject) {
  try {
    // Note: Currently unused so commenting out
    // // clo(data, 'bridgeChangeCheckbox received data object')
    // const { settingName, state } = data
    // logDebug('pluginToHTMLBridge/bridgeChangeCheckbox', `- settingName: ${settingName}, state: ${state}`)
    // DataStore.setPreference('Dashboard-filterPriorityItems', state)
    // // having changed this pref, refresh the window
    // await makeProjectLists()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a something in the HTML view
 * @param {MessageDataObject} data - details of the item clicked
 */
export async function bridgeClickProjectListItem(data: MessageDataObject) {
  try {
    // const windowId = getWindowIdFromCustomId(windowCustomId);
    const windowId = windowCustomId
    if (!windowId) {
      logError('bridgeClickProjectListItem', `Can't find windowId for ${windowCustomId}`)
      return
    }
    const ID = data.itemID
    const type = data.type
    const controlStr = data.controlStr ?? ''
    const filename = decodeRFC3986URIComponent(data.encodedFilename ?? '')
    logDebug('', '-------------------- bridgeClickProjectListItem:')
    logInfo('bridgeClickProjectListItem', `itemID: ${ID}, type: ${type}, filename: ${filename}`)
    // clo(data, 'bridgeClickProjectListItem received data object')
    switch (type) {
      case 'toggleDisplayOnlyDue': {
        await toggleDisplayOnlyDue()
        break
      }
      case 'toggleDisplayFinished': {
        await toggleDisplayFinished()
        break
      }
      case 'completeProject': {
        // Mimic the /complete project command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          completeProject
          logDebug('bCPLI / completeProject', `-> completeProject on filename ${filename} (ID ${ID})`)
          await completeProject(note)
        }
        // This seems to handle a refresh by itself
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'cancelProject': {
        // Mimic the /cancel project command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / cancelProject', `-> cancelProject on filename ${filename} (ID ${ID})`)
          await cancelProject(note)
        }
        // This seems to handle a refresh by itself
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'togglePause': {
        // Mimic the '/pause project toggle' command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / toggleProject', `-> togglePauseProject on filename ${filename} (ID ${ID})`)
          await togglePauseProject(note)
        }
        // This seems to handle a refresh by itself
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'reviewFinished': {
        // Mimic the /finish review command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / reviewFinished', `-> reviewFinished on filename ${filename} (ID ${ID})`)
          // update this to actually take a note to work on
          finishReviewForNote(note)
          logDebug('bCPLI / reviewFinished', `-> after finishReview`)

          // This seems to handle a refresh by itself
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
          // sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCPLI / reviewFinished', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
        }
        break
      }

      case 'setNextReviewDate': {
        // Mimic the /skip review command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          const period = controlStr.replace('nr', '')
          logDebug('bCPLI / setNextReviewDate', `-> will skip review by '${period}' for filename ${filename} (ID ${ID})`)
          skipReviewForNote(note, period)
          logDebug('bCPLI / review', `-> after setNextReviewDate`)

          // TODO: Refresh for now? Or can we actually do this ...?
          await makeProjectLists()
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
          // sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCPLI / setNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
        }
        break
      }
      case 'addProgress': {
        // Mimic the /add progress update command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / addProgress', `-> addProgress on filename ${filename} (ID ${ID})`)
          await addProgressUpdate(note)
          logDebug('bCPLI / addProgress', `-> after addProgressUpdate`)

          // This seems to handle a refresh by itself
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
          // sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCPLI / addProgress', `-> couldn't get filename ${filename} to add progress command.`)
        }
        break
      }
      case 'windowResized': {
        logDebug('bCPLI / windowResized', `windowResized triggered on plugin side (hopefully for '${windowCustomId}')`)
        const thisWin = getWindowFromCustomId(windowCustomId)
        const rect = getLiveWindowRectFromWin(thisWin)
        if (rect) {
          // logDebug('bCPLI / windowResized/windowResized', `-> saving rect: ${rectToString(rect)} to pref`)
          storeWindowRect(windowCustomId)
        }
        break
      }
      case 'showNoteInEditorFromFilename': {
        // Handle a show note call simply by opening the note in the main Editor.
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          logDebug('bridgeClickProjectListItem', `-> successful call to open filename ${filename} in Editor`)
        } else {
          logWarn('bridgeClickProjectListItem', `-> unsuccessful call to open filename ${filename} in Editor`)
        }
        break
      }

      default: {
        logWarn('bridgeClickProjectListItem', `bridgeClickProjectListItem: can't yet handle type ${type}`)
      }
    }
  } catch (error) {
    logError(pluginJson, `pluginToHTMLBridge / bridgeClickProjectListItem: ${JSP(error)}`)
  }
}
