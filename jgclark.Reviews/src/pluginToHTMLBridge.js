// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Projects plugin (to/from HTML window)
// Last updated 2026-05-18 for v2.0.0.b35, @CursorAI & @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  finishReviewForNote,
  displayProjectLists,
  setNewReviewInterval,
  skipReviewForNote,
  startReviewForNote,
  toggleDisplayOnlyDue,
  toggleDisplayFinished,
  toggleDisplayNextActions,
  saveDisplayFilters,
} from './reviews'
import {
  addProgressUpdate,
  cancelProject,
  completeProject,
  togglePauseProject,
} from './projects'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { smartShowLineInEditorFromFilename } from '@helpers/NPEditor'
import {
  getLiveWindowRectFromWin, getWindowFromCustomId,
  logWindowsList,
  openNoteInSplitViewIfNotOpenAlready,
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
  encodedContent?: string,
  scrollPos?: number,
}
type SettingDataObject = {
  settingName: string,
  state: string,
  scrollPos?: number,
}

const windowCustomId = `${pluginJson['plugin.id']}.main`

//-----------------------------------------------------------------

/**
 * Normalize click payload from HTML: unwrap single-element arrays and resolve type from type or actionType.
 * @param {any} data - payload from sendMessageToPlugin (object or occasional array wrapper)
 * @param {string} [typeOverride] - when actionType is the handler name (e.g. showLineInEditorFromFilename)
 * @returns {MessageDataObject}
 */
function normalizeProjectListClickPayload(data: any, typeOverride?: string): MessageDataObject {
  let payload = data
  if (Array.isArray(data)) {
    payload = data.length === 1 ? data[0] : data.find((d) => d && (d.type || d.actionType)) ?? data[0]
  }
  if (payload == null || typeof payload !== 'object') {
    payload = {}
  }
  const resolvedType = typeOverride ?? payload.type ?? payload.actionType ?? ''
  return {
    itemID: payload.itemID ?? '-',
    type: resolvedType,
    controlStr: payload.controlStr ?? '',
    encodedFilename: payload.encodedFilename ?? '',
    encodedContent: payload.encodedContent,
    scrollPos: payload.scrollPos,
  }
}

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} actionType - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export async function onMessageFromHTMLView(actionType: string, data: any): any {
  try {
    // clo(data, `onMessageFromHTMLView dispatching actionType '${actionType}' with data object:`)
    logDebug(`onMessageFromHTMLView`, `dispatching actionType '${actionType}'`)
    switch (actionType) {
      case 'onClickProjectListItem':
        await bridgeClickProjectListItem(data)
        break
      case 'showNoteInEditorFromFilename':
      case 'showLineInEditorFromFilename':
        // Fallback if HTML sends handler name as actionType instead of onClickProjectListItem wrapper
        await bridgeClickProjectListItem(normalizeProjectListClickPayload(data, actionType))
        break
      case 'onChangeCheckbox':
        await bridgeChangeCheckbox(data)
        break
      case 'refresh': {
        const scrollPos = data && typeof data.scrollPos === 'number' ? data.scrollPos : 0
        logInfo('onMessageFromHTMLView/refresh', `received scrollPos from frontend = ${String(scrollPos)}`)
        await displayProjectLists(null, scrollPos)
        break
      }
      case 'runPluginCommand':
        await runPluginCommand(data)
        break
      case 'saveDisplayFilters':
        await bridgeSaveDisplayFilters(data)
        break
      default:
        logError(pluginJson, `onMessageFromHTMLView(): unknown actionType '${actionType}' cannot be dispatched`)
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
    logDebug(pluginJson, `runPluginCommand: received command '${data.commandName}' with args [${data.commandArgs}]`)
    const scrollPos = data && typeof data.scrollPos === 'number' ? data.scrollPos : 0
    logInfo('runPluginCommand', `received scrollPos from frontend = ${String(scrollPos)} for command '${String(data.commandName)}'`)
    switch (data.commandName) {
      case 'toggleDisplayFinished':
        await toggleDisplayFinished(scrollPos)
        break
      case 'toggleDisplayOnlyDue':
        await toggleDisplayOnlyDue(scrollPos)
        break
      case 'toggleDisplayNextActions':
        await toggleDisplayNextActions(scrollPos)
        break
      case 'project lists':
        // Rich list Refresh uses PCButton → runPluginCommand; must pass scrollPos like the 'refresh' bridge path.
        if (data.pluginID === pluginJson['plugin.id']) {
          const ca = data.commandArgs ?? []
          const argsIn =
            ca.length === 0 || (ca.length === 1 && (ca[0] === '' || ca[0] == null))
              ? null
              : ca[0]
          await displayProjectLists(argsIn, scrollPos)
        } else {
          await DataStore.invokePluginCommandByName(data.commandName, data.pluginID, data.commandArgs ?? [])
        }
        break
      default:
        // clo(data, 'runPluginCommand received data object')
        await DataStore.invokePluginCommandByName(data.commandName, data.pluginID, data.commandArgs ?? [])
        break
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a checkbox in the HTML view
 * Note: Currently unused so commenting out
 * @param {SettingDataObject} data - setting name
 */
// eslint-disable-next-line require-await
export async function bridgeChangeCheckbox(data: SettingDataObject) {
  try {
    clo(data, 'bridgeChangeCheckbox received data object')
    const { settingName, state } = data
    const scrollPos = data && typeof data.scrollPos === 'number' ? data.scrollPos : 0
    logDebug('pluginToHTMLBridge/bridgeChangeCheckbox', `- settingName: ${settingName}, state: ${state}`)
    logInfo('bridgeChangeCheckbox', `received scrollPos from frontend = ${String(scrollPos)} for setting '${String(settingName)}'`)
    switch (settingName) {
      case 'displayFinished': {
        await toggleDisplayFinished(scrollPos)
        break
      }
      case 'displayOnlyDue': {
        await toggleDisplayOnlyDue(scrollPos)
        break
      }
      case 'displayNextActions': {
        await toggleDisplayNextActions(scrollPos)
        break
      }
    }
  } catch (error) {
    logError('bridgeChangeCheckbox', error.message)
  }
}

/**
 * Save display filters from the Display filters dropdown (all three at once).
 * @param {{ displayOnlyDue: boolean, displayFinished: boolean, displayPaused: boolean, displayNextActions: boolean, displayOrder?: string }} data
 */
export async function bridgeSaveDisplayFilters(data: {
  displayOnlyDue: boolean,
  displayFinished: boolean,
  displayPaused: boolean,
  displayNextActions: boolean,
  displayOrder?: string,
  scrollPos?: number,
}): Promise<void> {
  try {
    const scrollPos = data && typeof data.scrollPos === 'number' ? data.scrollPos : 0
    logInfo('bridgeSaveDisplayFilters', `received scrollPos from frontend = ${String(scrollPos)}`)
    const filterData = {
      displayOnlyDue: data.displayOnlyDue,
      displayFinished: data.displayFinished,
      displayPaused: data.displayPaused,
      displayNextActions: data.displayNextActions,
      displayOrder: data.displayOrder,
    }
    await saveDisplayFilters(filterData, scrollPos)
  } catch (error) {
    logError('bridgeSaveDisplayFilters', error.message)
  }
}

/**
 * Somebody clicked on something in the HTML view; find out what, and action it.
 * @param {MessageDataObject} data - details of the item clicked
 */
export async function bridgeClickProjectListItem(data: MessageDataObject | any) {
  try {
    const clickData = normalizeProjectListClickPayload(data)
    // const windowId = getWindowIdFromCustomId(windowCustomId);
    const windowId = windowCustomId
    if (!windowId) {
      logError('bridgeClickProjectListItem', `Can't find windowId for ${windowCustomId}`)
      return
    }
    const ID = clickData.itemID
    const type = clickData.type
    const controlStr = clickData.controlStr ?? ''
    const filename = decodeRFC3986URIComponent(clickData.encodedFilename ?? '')
    const scrollPos = clickData && typeof clickData.scrollPos === 'number' ? clickData.scrollPos : 0
    logDebug('', 'bridgeClickProjectListItem: --------------------')
    logInfo('bridgeClickProjectListItem', `itemID: ${ID}, type: ${type}, filename: ${filename}`)
    // logDebug('bridgeClickProjectListItem', `received scrollPos from frontend = ${String(scrollPos)} for type '${String(type)}'`)
    // clo(data, 'bridgeClickProjectListItem received data object')
    switch (type) {
      case 'completeProject': {
        // Mimic the /complete project command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          completeProject
          logDebug('bCPLI / completeProject', `-> completeProject on filename ${filename} (ID ${ID})`)
          await completeProject(note, scrollPos)
        }
        // The above handles refreshing the allProjects list and display
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'cancelProject': {
        // Mimic the /cancel project command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / cancelProject', `-> cancelProject on filename ${filename} (ID ${ID})`)
          await cancelProject(note, scrollPos)
        }
        // The above handles refreshing the allProjects list and display
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'togglePause': {
        // Mimic the '/pause project toggle' command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / toggleProject', `-> togglePauseProject on filename ${filename} (ID ${ID})`)
          await togglePauseProject(note, scrollPos)
        }
        // The above handles refreshing the allProjects list and display
        // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        // sendToHTMLWindow(windowId, 'updateItem', data)
        break
      }
      case 'startReview': {
        // Mimic the /start review command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / startReview', `-> startReview on filename ${filename} (ID ${ID})`)
          // update this to actually take a note to work on
          await startReviewForNote(note)
          logDebug('bCPLI / startReview', `-> after startReview`)
        } else {
          logWarn('bCPLI / startReview', `-> couldn't get filename ${filename} to start the review.`)
        }
        break
      }
      case 'reviewFinished': {
        // Mimic the /finish review command for the note in question
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / reviewFinished', `-> reviewFinished on filename ${filename} (ID ${ID})`)
          // update this to actually take a note to work on
          await finishReviewForNote(note, scrollPos)
          logDebug('bCPLI / reviewFinished', `-> after finishReview`)

          // The above handles refreshing the allProjects list and display
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        } else {
          logWarn('bCPLI / reviewFinished', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
        }
        break
      }
      case 'setNextReviewDate': {
        // Mimic the '/skip review' command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          const period = controlStr.replace('nr', '')
          logDebug('bCPLI / setNextReviewDate', `-> will skip review by '${period}' for filename ${filename} (ID ${ID})`)
          await skipReviewForNote(note, period, scrollPos)
          logDebug('bCPLI / setNextReviewDate', `-> after setNextReviewDate`)

          // The above handles refreshing the allProjects list and display
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        } else {
          logWarn('bCPLI / setNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
        }
        break
      }
      case 'setNewReviewInterval': {
        // Mimic the '/set new review interval' command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          await setNewReviewInterval(note, scrollPos)
          logDebug('bCPLI / setNewReviewInterval', `-> after setNewReviewInterval`)

          // The above handles refreshing the allProjects list and display
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        } else {
          logWarn('bCPLI / setNewReviewInterval', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
        }
        break
      }
      case 'addProgress': {
        // Mimic the /add progress update command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / addProgress', `-> addProgress on filename ${filename} (ID ${ID})`)
          await addProgressUpdate(note, scrollPos)
          logDebug('bCPLI / addProgress', `-> after addProgressUpdate`)

          // The above handles refreshing the allProjects list and display
          // TODO(later): Do something more clever in future: send a message for the dashboard to update its display
        } else {
          logWarn('bCPLI / addProgress', `-> couldn't get filename ${filename} to add progress command.`)
        }
        break
      }
      case 'quickAddTaskUnderHeading': {
        // Invoke QuickCapture "quick add task under heading" with this project note pre-selected (by title).
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCPLI / quickAddTaskUnderHeading', `-> invoking QuickCapture for note '${note.title ?? filename}' (ID ${ID})`)
          await DataStore.invokePluginCommandByName('quick add task under heading', 'jgclark.QuickCapture', [note.title])
          logDebug('bCPLI / quickAddTaskUnderHeading', `-> after invokePluginCommandByName`)
        } else {
          logWarn('bCPLI / quickAddTaskUnderHeading', `-> couldn't get note for filename ${filename}.`)
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
        // Smart split / focus-if-already-open (same as startReview when Main Window); matches Rich title, dialog note name, review icon, content links.
        if (!filename) {
          logWarn('bridgeClickProjectListItem', `-> showNoteInEditorFromFilename: empty filename after decode`)
          break
        }
        const openedNewSplit = openNoteInSplitViewIfNotOpenAlready(filename, 'bridgeClickProjectListItem')
        if (openedNewSplit) {
          logDebug('bridgeClickProjectListItem', `-> opened or triggered split for filename ${filename}`)
        } else {
          logDebug('bridgeClickProjectListItem', `-> focused existing editor or no-op for filename ${filename}`)
        }
        break
      }
      case 'showLineInEditorFromFilename': {
        // Same approach as Dashboard doShowLineInEditorFromFilename: smartShowLineInEditorFromFilename -> highlightParagraphInEditorByContent.
        // Note: Highlight can fail if the note was not already open or the editor paragraphs are not ready yet; that is accepted.
        const content = decodeRFC3986URIComponent(clickData.encodedContent ?? '')
        if (!filename) {
          logWarn('bridgeClickProjectListItem', `-> showLineInEditorFromFilename: empty filename after decode`)
          break
        }
        if (!content) {
          logWarn('bridgeClickProjectListItem', `-> showLineInEditorFromFilename: empty content after decode for filename ${filename}`)
          break
        }
        const result = await smartShowLineInEditorFromFilename(filename, content, 'split')
        if (result) {
          logDebug('bridgeClickProjectListItem', `-> showLineInEditorFromFilename for filename ${filename}: opened and highlighted`)
        } else {
          logInfo('bridgeClickProjectListItem', `-> showLineInEditorFromFilename for filename ${filename}: note may have opened but line highlight failed`)
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
