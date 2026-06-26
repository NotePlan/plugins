// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for some dashboard clicks that come over the bridge.
// There are 4+ other clickHandler files now.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-06-13 for v2.4.0.b46 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import {
  allCalendarSectionCodes,
  allSectionDetails,
  DASHBOARD_SETTING_KEYS_NOT_REQUIRING_DISPLAY_OR_CONTENT_REFRESH,
  SECTIONS_TO_REFRESH_AFTER_CHANGE_OF_VISIBILITY_OF_CALENDAR_SECTIONS,
  WEBVIEW_WINDOW_ID,
} from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import {
  cloneDashboardSettingsBeforeSave,
  getDashboardSettings,
  getDashboardSettingsDefaults,
  handlerResult,
  makeDashboardParas,
  setPluginData,
} from './dashboardHelpers'
import { prepareDashboardSettingsForSave } from './dashboardSettingsClean'
import { normaliseDashboardNumberSettings } from './dashboardSettings'
import { resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload } from './perspectiveSettingsOnDashboardSave'
import { validateAndFlattenMessageObject } from './shared'
import { dashboardFolderFilterSettingsChanged } from './reviewsListSync'
import type { MessageDataObject, TActionOnReturn, TBridgeClickHandlerResult, TDashboardSettings, TSectionCode } from './types'
import { getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer, compareObjects } from '@helpers/dev'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { coreAddChecklistToNoteHeading, coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import { smartOpenNoteInEditorFromFilename, smartShowLineInEditorFromFilename } from '@helpers/NPEditor'
import { cancelItem, completeItem, completeItemEarlier, deleteItem, findParaFromStringAndFilename } from '@helpers/NPParagraph'
import { unscheduleItem } from '@helpers/NPScheduleItems'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { getWindowFromCustomId, getLiveWindowRectFromWin, rectToString, storeWindowRect } from '@helpers/NPWindows'
import { cyclePriorityStateDown, cyclePriorityStateUp } from '@helpers/paragraph'
import { processChosenHeading } from '@helpers/userInput'

/****************************************************************************************************************************
 *                             NOTES
 ****************************************************************************************************************************
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.

/****************************************************************************************************************************
 *                             Data types + constants
 ****************************************************************************************************************************/

const pluginID = 'jgclark.Dashboard' // pluginJson['plugin.id']
const windowCustomId = `${pluginID}.main`

/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/

/**
 * Evaluate JS string and return result
 * WARNING: DO NOT USE THIS FOR ANYTHING OTHER THAN TESTING.
 * @param {MessageDataObject} data
 * @returns
 */
export async function doEvaluateString(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { stringToEvaluate } = data
  if (!stringToEvaluate) {
    logError('doEvaluateString', 'No stringToEvaluate provided')
    return handlerResult(false, [], { errorMsg: 'No stringToEvaluate provided', errorMessageLevel: 'ERROR' })
  }
  logDebug('doEvaluateString', `Evaluating string: "${stringToEvaluate}"`)
  // use JS eval to evaluate the string
  try {
    const result = await eval(stringToEvaluate)
    return handlerResult(true, [], { result })
  } catch (error) {
    logError('doEvaluateString', error.message)
    return handlerResult(false, [], { errorMsg: error.message })
  }
}

/**
 * Prepend an open task to 'toFilename' Calendar note, using text we prompt the user for.
 * Note: It only writes to Calendar notes, as that's only what Dashboard needs.
 * @param {MessageDataObject} {actionType: addTask|addChecklist etc., toFilename:xxxxx}
 * @returns {TBridgeClickHandlerResult} result to be used by click result handler
 */
export async function doAddItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const config = await getDashboardSettings()
    // clo(data, 'data for doAddItem', 2)
    const { actionType, toFilename, userInputObj, sectionCodes } = data
    const { text, heading } = userInputObj || {}

    logDebug('doAddItem', `- actionType: ${actionType} to ${toFilename || ''} in section [${String(sectionCodes)}]]`)
    if (!toFilename) {
      throw new Error('doAddItem: No toFilename provided')
    }
    const todoType = actionType === 'addTask' ? 'task' : 'checklist'

    const calNoteDateStr = getDateStringFromCalendarFilename(toFilename, true)
    // logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined for ${toFilename}`)
    }

    // We should have the text to add already, but if not, prompt the user for it
    const content = text ?? (await CommandBar.showInput(`Type the ${todoType} text to add`, `Add ${todoType} '%@' to ${calNoteDateStr}`))
    const destNote = DataStore.noteByFilename(toFilename, 'Calendar')
    if (!destNote) throw new Error(`doAddItem: No note found for ${toFilename}`)

    // Add text to the new location in destination note
    const newHeadingLevel = config.newTaskSectionHeadingLevel
    const headingToUse = heading ? await processChosenHeading(destNote, heading || '', newHeadingLevel) : config.newTaskSectionHeading

    if (actionType === 'addTask') {
      coreAddTaskToNoteHeading(destNote, headingToUse, content, newHeadingLevel, true)
    } else {
      coreAddChecklistToNoteHeading(destNote, headingToUse, content, newHeadingLevel, true)
    }
    // Note: updateCache is now done in previous function call

    // update just the section we've added to (expect a single-item array)
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: sectionCodes })
  } catch (err) {
    logError('doAddItem', err.message)
    return handlerResult(false, [], { errorMsg: err.message })
  }
}

/**
 * Add a new item anywhere, using the /quickAddTaskUnderHeading command from Quick Capture plugin.
 * Note: this uses the Quick Capture plugin's command, as it was available.
 * Ideally it would use a DynamicDialog instead, as that's more flexible and looks nicer, but we don't necessarily have a dropdown-select component that can scale to 1,000s of items.
 * Calls the doAddItem logic, once new filename is worked out.
 * Note: Ideally make it smarter than refreshing all enabled sections. But we have no feedback from the Quick Capture plugin so have nothing to go on.
 * @param {MessageDataObject} {date: .data.data.data, text: .data.data.}
 * @returns {TBridgeClickHandlerResult} result to be used by click result handler
 */
export async function doAddTaskAnywhere(): Promise<TBridgeClickHandlerResult> {
  logDebug('doAddTaskAnywhere', `starting. Just calling addTaskToNoteHeading().`)
  const res = await DataStore.invokePluginCommandByName('quick add task under heading', 'jgclark.QuickCapture') // with no args, this will prompt for the note, heading and text
  // we don't get a return value from the command, so we just return true
  return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'], {})
}

/**
 * TEST: removed this as it was not hooked up to any UI element
 * Add a new item to a future date, using the date and text provided.
 * Calls the doAddItem logic, once new filename is worked out.
 * @param {MessageDataObject} {date: .data.data.data, text: .data.data.}
 * @returns {TBridgeClickHandlerResult} result to be used by click result handler
 */
// export async function doAddItemToFuture(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
//   try {
//     clo(data, `doAddItemToFuture starting with data`)
//     const { userInputObj } = data // "date": "2024-12-04T08:00:00.000Z",
//     if (!userInputObj) throw new Error('No userInputObj provided')
//     const { date, text } = userInputObj
//     if (!text) throw new Error(`No text was provided to addItemToFuture`)
//     if (!date) throw new Error(`No date was provided to addItemToFuture`)
//     const extension = DataStore.defaultFileExtension
//     const filename = `${moment(date).format(`YYYYMMDD`)}.${extension}`
//     data.toFilename = filename
//     data.actionType = 'addTask'
//     return await doAddItem(data)
//   } catch (error) {
//     logError('doAddItemToFuture', error.message)
//     return handlerResult(false, [], { errorMsg: error.message })
//   }
// }

/** After REMOVE_LINE_FROM_JSON, optionally ask the bridge to drop empty SEARCH/SAVEDSEARCH section objects. */
function removeLineSuccessActionsForSection(sectionCode: TSectionCode, ...extras: Array<TActionOnReturn>): Array<TActionOnReturn> {
  const actions: Array<TActionOnReturn> = ['REMOVE_LINE_FROM_JSON']
  if (sectionCode === 'SEARCH' || sectionCode === 'SAVEDSEARCH') {
    actions.push('REMOVE_SECTION_IF_EMPTY')
  }
  actions.push(...extras)
  return actions
}

/**
 * Complete the task in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteTask(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, item, sectionCode } = validateAndFlattenMessageObject(data)
  // clo(item, `doCompleteTask -> item`)
  const completedParagraph = await completeItem(filename, content)
  // clo(completedParagraph, `doCompleteTask -> completedParagraph`)

  if (typeof completedParagraph === 'boolean') {
    logWarn('doCompleteTask', `-> failed. Perhaps the task was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't complete task. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  } else {
    // Update the done count for the section
    await updateDoneCountsFromChangedNotes(`In doCompleteTask() for item ${item?.ID || 'unknown'}`)

    // Send instructions to update the window
    logDebug('doCompleteTask', `done for ${item?.ID || 'unknown'} in section ${item?.sectionCode || 'unknown'}`)
    return handlerResult(true, removeLineSuccessActionsForSection(sectionCode, 'INCREMENT_DONE_COUNT'), { updatedParagraph: completedParagraph, sectionCodes: [sectionCode] })
  }
}

/**
 * Complete the task in the actual Note, but with the date it was scheduled for.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteTaskThen(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, item, sectionCode } = validateAndFlattenMessageObject(data)
  const completedParagraph = await completeItemEarlier(filename, content)
  if (typeof completedParagraph === 'boolean') {
    logWarn('doCompleteTaskThen', `-> failed. Perhaps the task was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't complete the task. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  } else {
    logDebug('doCompleteTaskThen', `done for ${item?.ID || 'unknown'} in section ${item?.sectionCode || 'unknown'}`)
    // Send instructions to update the window
    return handlerResult(true, removeLineSuccessActionsForSection(sectionCode), { updatedParagraph: completedParagraph, sectionCodes: [sectionCode] })
  }
}

/**
 * Cancel the task in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCancelTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, item, sectionCode } = validateAndFlattenMessageObject(data)
  let res = cancelItem(filename, content)
  let updatedParagraph = null
  const possiblePara = findParaFromStringAndFilename(filename, content)
  if (typeof possiblePara === 'boolean') {
    res = false
    logWarn('doCancelTask', `-> failed. Perhaps the task was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't cancel task. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  } else {
    updatedParagraph = possiblePara || {}
    logDebug('doCancelTask', `done for ${item?.ID || 'unknown'} in section ${item?.sectionCode || 'unknown'}`)
    // Send instructions to update the window
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph, sectionCodes: [sectionCode] })
  }
}

/**
 * Complete the checklist in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteChecklist(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, item, sectionCode } = validateAndFlattenMessageObject(data)
  const updatedParagraph = await completeItem(filename, content)
  if (typeof updatedParagraph === 'boolean') {
    logWarn('doCompleteChecklist', `-> failed. Perhaps the checklist was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't complete checklist. I will refresh this Section; please then try again.`, errorMessageLevel: 'WARN' })
  } else {
    logDebug('doCompleteChecklist', `done for ${item?.ID || 'unknown'} in section ${item?.sectionCode || 'unknown'}`)
    // Send instructions to update the window
    return handlerResult(true, removeLineSuccessActionsForSection(sectionCode), { updatedParagraph: updatedParagraph || {}, sectionCodes: [sectionCode] })
  }
}

/**
 * Delete the item in the actual Note.
 * TODO: extend to delete sub-items as well if wanted.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doDeleteItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)
  // logDebug('doDeleteItem', `Starting with "${String(content)}" and will ideally update section ${String(sectionCode)}`)
  // Grab a copy of the paragraph before deleting it, so React can remove the right line. (It's not aware the paragraph has disappeared on the back end.)
  const updatedParagraph = findParaFromStringAndFilename(filename, content)
  const res = await deleteItem(filename, content)
  if (res) {
    logDebug('doDeleteItem', `-> success`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph: updatedParagraph || {}, sectionCodes: [sectionCode] })
  } else {
    logWarn('doDeleteItem', `-> failed. Perhaps the item was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't delete item. I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  }
}

/**
 * Cancel the checklist in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCancelChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)
  let res = cancelItem(filename, content)
  let updatedParagraph = null
  const possiblePara = findParaFromStringAndFilename(filename, content)
  if (typeof possiblePara === 'boolean') {
    res = false
    logWarn('doCancelChecklist', `-> failed. Perhaps the checklist was modified in NotePlan since the last time the Dashboard was refreshed?`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Couldn't cancel checklist. I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  } else {
    updatedParagraph = possiblePara || {}
    logDebug('doCancelChecklist', `-> success`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph, sectionCodes: [sectionCode] })
  }
}

/**
 * Updates content based on provided data.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result
 */
export function doContentUpdate(data: MessageDataObject): TBridgeClickHandlerResult {
  try {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const { updatedContent } = data
    logDebug('doContentUpdate', `updatedContent: {${updatedContent || ''}}`)
  if (!updatedContent) {
    throw new Error(`Trying to updateItemContent but no updatedContent was passed`)
  }

    const para = findParaFromStringAndFilename(filename, content)
  if (!para) {
    throw new Error(`No para found for filename '${filename}' and content {${content}}`)
  }

  para.content = updatedContent
  if (para.note) {
    para.note.updateParagraph(para)
  } else {
    throw new Error(`No para.note found for filename '${filename}' and content {${content}}`)
  }

    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
  } catch (error) {
    logError('doContentUpdate', error.message)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [error.cause.sectionCode], errorMsg: `${error.message}. I will refresh this Section; please then try again.`, errorMessageLevel: 'ERROR' })
  }
}

/**
 * Send a request to toggleType to plugin
 * @param {MessageDataObject} data - The data object containing item info
 * @returns{TBridgeClickHandlerResult} The result
 */
export function doToggleType(data: MessageDataObject): TBridgeClickHandlerResult {
  try {
    const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)
    logDebug('doToggleType', `starting for "${content}" in filename: ${filename} for section ${sectionCode}`)

    // V1: original from v0.x
    // const updatedType = doToggleType(filename, content)

    // V2: move most of doToggleType() into here, as we need access to the full para
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('doToggleType: no para found', { cause: { filename, content, sectionCode } })
    }

    // Get the paragraph to change
    const updatedParagraph = possiblePara
    const thisNote = updatedParagraph.note
    if (!thisNote) throw new Error(`Could not get note for filename ${filename}`, { cause: { filename, content, sectionCode } })
    const existingType = updatedParagraph.type
    logDebug('doToggleType', `toggling type from ${existingType} in filename: ${filename}`)
    const updatedType = existingType === 'checklist' ? 'open' : 'checklist'
    updatedParagraph.type = updatedType
    logDebug('doToggleType', `-> ${updatedType}`)
    thisNote.updateParagraph(updatedParagraph)
    DataStore.updateCache(thisNote, false)

    // Refresh the whole section, as we might want to filter out the new item type from the display
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { updatedParagraph: updatedParagraph, sectionCodes: [sectionCode] })
  } catch (error) {
    logError('doToggleType', error.message)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [error.cause.sectionCode], errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}

/**
 * Send a request to unscheduleItem to plugin
 * @param {MessageDataObject} data - The data object containing item info
 * @returns {TBridgeClickHandlerResult} The result
 */
export function doUnscheduleItem(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)
  const updatedContent = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedContent)}`)

  // find the updated para
  const updatedParagraph: TParagraph | boolean = findParaFromStringAndFilename(filename, updatedContent)
  if (typeof updatedParagraph === 'boolean') {
    logError(`doUnscheduleItem`, `couldn't find para for filename ${filename} and content ${updatedContent}. Will update current section ${sectionCode}`)

    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Unable to find para "${content}" in filename: "${filename}". I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  } else {
    logDebug('doUnscheduleItem', `- found updated paragraph, and will update display of the item and section ${sectionCode}`)
    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON', 'REFRESH_SECTION_IN_JSON'], { updatedParagraph: makeDashboardParas([updatedParagraph])[0], sectionCodes: [sectionCode] })
  }
}

// Send a request to cyclePriorityStateUp to plugin
export function doCyclePriorityStateUp(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)

  // Get full TParagraph to work on
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    // logDebug('doCyclePriorityStateUp', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    const updatedContent = cyclePriorityStateUp(para)
    para.content = updatedContent
    logDebug('doCyclePriorityStateUp', `cycling priority -> {${JSP(updatedContent)}}`)

    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
  } else {
    logWarn('doCyclePriorityStateUp', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Unable to find para "${content}" in filename: "${filename}". I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  }
}

// Send a request to cyclePriorityStateDown to plugin
export function doCyclePriorityStateDown(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, sectionCode } = validateAndFlattenMessageObject(data)
  // Get para
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    // const paraContent = para.content ?? 'error'
    // logDebug('doCyclePriorityStateDown', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    // const newPriority = (getTaskPriority(paraContent) - 1) % 5
    const updatedContent = cyclePriorityStateDown(para)
    para.content = updatedContent
    logDebug('doCyclePriorityStateDown', `cycling priority -> {${updatedContent}}`)

    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
  } else {
    logWarn('doCyclePriorityStateDown', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `Unable to find para "${content}" in filename: "${filename}". I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  }
}

export function doWindowResized(): TBridgeClickHandlerResult {
  logDebug('doWindowResized', `windowResized triggered on plugin side (hopefully for '${windowCustomId}')`)
  const thisWin = getWindowFromCustomId(windowCustomId)
  if (thisWin !== false) {
    const rect = getLiveWindowRectFromWin(thisWin)
    if (rect) {
      logDebug('doWindowResized/windowResized', `-> saving rect: ${rectToString(rect)} to pref`)
      storeWindowRect(windowCustomId)
      return handlerResult(rect ? true : false)
    }
  }
  return handlerResult(false, [], { errorMsg: 'Could not get window from customId', errorMessageLevel: 'ERROR' })
}

/** 
 * Handle a show note call by opening the note in the main Editor, and returning success details.
 * Note: use the showLine... variant of this (below) where possible
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
*/
export async function doShowNoteInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, modifierKey } = validateAndFlattenMessageObject(data)
  const result = await smartOpenNoteInEditorFromFilename(filename, modifierKey === 'alt' ? 'split' : 'window')
  return handlerResult(result)
}

/**
 * Handle a show note call simply by opening the note in the main Editor
 * Note: use the showLine... variant of this (below) where possible
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
*/
export async function doShowNoteInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const result = await smartOpenNoteInEditorFromFilename(filename, 'window')
  return handlerResult(result)
}

/**
 * Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line.
 * If ⌘ (command) key is clicked, then open in a new floating window.
 * If option key is clicked, then open in a new split view.
 * Note: Handles Teamspace notes from b1375 (v3.17.0).
 * FIXME: Needs to work when running in the main/split window, as well as in a separate window.
 * @param {MessageDataObject} data with details of item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doShowLineInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // const { filename, content, modifierKey } = validateAndFlattenMessageObject(data)
  // const note = await Editor.openNoteByFilename(filename, modifierKey === 'meta', 0, 0, modifierKey === 'alt')
  // if (note) {
  //   // $FlowIgnore[prop-missing]
  //   // $FlowIgnore[incompatible-call]
  //   const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
  //   logDebug('doShowLineInEditorFromFilename', `-> opened filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph`,)
  //   return handlerResult(true)
  // } else {
  //   logWarn('doShowLineInEditorFromFilename', `-> failed to open filename ${filename} in Editor.`)
  //   return handlerResult(false, [], { errorMsg: `Failed to open filename ${filename} in Editor.`, errorMessageLevel: 'WARN' })
  // }

  // V2
  const { filename, content, sectionCode, modifierKey } = validateAndFlattenMessageObject(data)
  logDebug('doShowLineInEditorFromFilename', `starting for filename ${filename} with content {${content}} and modifierKey ${modifierKey}`)
  const result = await smartShowLineInEditorFromFilename(filename, content, modifierKey === 'alt' ? 'split' : 'window')
  if (result) {
    logDebug('doShowLineInEditorFromFilename', `-> opened filename ${filename} in Editor, followed by ${result ? 'succesful' : 'unsuccessful'} call to highlight the paragraph`,)
    return handlerResult(true)
  } else {
    logWarn('doShowLineInEditorFromFilename', `-> failed to open filename ${filename} in Editor.`)
    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: [sectionCode], errorMsg: `-> failed to open line in Editor for filename ${filename}. I will refresh this section, then please try again.`, errorMessageLevel: 'WARN' })
  }
}

/**
 * Show-setting keys that correspond to calendar period sections (DT through Y) only.
 * @author @Cursor
 * @returns {Set<string>}
 */
function getCalendarSectionVisibilitySettingNames(): Set<string> {
  return new Set(
    allSectionDetails
      .filter((d) => allCalendarSectionCodes.includes(d.sectionCode))
      .map((d) => d.showSettingName)
      .filter(Boolean),
  )
}

/**
 * Return which of SECTIONS_TO_REFRESH_AFTER_CHANGE_OF_VISIBILITY_OF_CALENDAR_SECTIONS are enabled in merged dashboard settings.
 * @author @Cursor
 * @param {{ [key: string]: any }} mergedSettings
 * @returns {Array<TSectionCode>}
 */
function getEnabledSectionCodesAmongCalendarVisibilityRefreshList(mergedSettings: { [key: string]: any }): Array<TSectionCode> {
  return SECTIONS_TO_REFRESH_AFTER_CHANGE_OF_VISIBILITY_OF_CALENDAR_SECTIONS.filter((code) => {
    const detail = allSectionDetails.find((s) => s.sectionCode === code)
    if (!detail?.showSettingName) return false
    // $FlowIgnore[invalid-computed-prop]
    return mergedSettings[detail.showSettingName] !== false
  })
}

/**
 * Top-level keys from a `compareObjects` diff (object form only).
 * @author @Cursor
 * @param {any} diff
 * @returns {Array<string>}
 */
function getDiffTopLevelKeys(diff: any): Array<string> {
  if (diff == null) return []
  if (typeof diff !== 'object' || Array.isArray(diff)) return []
  return Array.from(Object.keys(diff))
}

/**
 * Regenerate dashboard theme CSS and send CHANGE_THEME to the WebView (stylesheet swap, not a section refresh).
 * @param {string} themeName - dashboardTheme setting value
 * @returns {Promise<boolean>} true if CHANGE_THEME was sent successfully
 */
export async function applyDashboardThemeToWebView(themeName: string): Promise<boolean> {
  const name = String(themeName ?? '')
  try {
    const themeCSS = generateCSSFromTheme(name)
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'CHANGE_THEME', { themeCSS }, `Dashboard theme changed to '${name}'`)
    logDebug('applyDashboardThemeToWebView', `Sent CHANGE_THEME for theme '${name}'`)
    return true
  } catch (error) {
    logError('applyDashboardThemeToWebView', `Failed to update theme CSS: ${error.message}`)
    return false
  }
}

/**
 * Decide incremental section refresh actions after dashboard settings were merged (pre vs post snapshot).
 * @param {{ [string]: any }} priorDashboardSettingsSnapshot
 * @param {mixed} settingsToSave
 * @returns {{ resultsToHandle: Array<TActionOnReturn>, resultExtra: { sectionCodes?: Array<TSectionCode>, dashboardThemeName?: string } }}
 */
function planSectionRefreshAfterDashboardSettingsChange(
  priorDashboardSettingsSnapshot: { [string]: any },
  settingsToSave: mixed,
): { resultsToHandle: Array<TActionOnReturn>, resultExtra: { sectionCodes?: Array<TSectionCode>, dashboardThemeName?: string } } {
  const resultsToHandle: Array<TActionOnReturn> = ['CLOSE_UNNEEDED_SECTIONS']
  let resultExtra: { sectionCodes?: Array<TSectionCode>, dashboardThemeName?: string } = {}
  const defaults = getDashboardSettingsDefaults()
  // $FlowIgnore[prop-missing]
  // $FlowIgnore[cannot-spread-indexer]
  const prevMerged: { [string]: any } = { ...defaults, ...priorDashboardSettingsSnapshot }
  // $FlowIgnore[prop-missing]
  // $FlowIgnore[cannot-spread-indexer]
  const nextMerged: { [string]: any } = { ...defaults, ...(settingsToSave || {}) }
  const oldTheme = String(prevMerged.dashboardTheme ?? '')
  const newTheme = String(nextMerged.dashboardTheme ?? '')
  if (oldTheme !== newTheme) {
    resultsToHandle.push('APPLY_THEME')
    resultExtra.dashboardThemeName = newTheme
    logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: dashboardTheme changed ('${oldTheme}' -> '${newTheme}'); will APPLY_THEME`)
  }
  const diff = compareObjects(prevMerged, nextMerged, ['lastModified', 'lastChange', 'usePerspectives'])
  const diffKeys = getDiffTopLevelKeys(diff)
  const calendarVisibilityKeys = getCalendarSectionVisibilitySettingNames()

  if (diffKeys.length === 0) {
    logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: no differing keys after merge (or non-object diff); incremental section refresh from settings: none (TB still refreshed if enabled, via processActionOnReturn)`,
    )
  } else {
    const onlyCalendarVisibility = diffKeys.every((k) => calendarVisibilityKeys.has(k))

    if (onlyCalendarVisibility) {
      const eligible = getEnabledSectionCodesAmongCalendarVisibilityRefreshList(nextMerged)
      if (eligible.length > 0) {
        resultsToHandle.push('REFRESH_SECTION_IN_JSON')
        resultExtra = { sectionCodes: eligible }
        logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: only calendar section visibility changed (keys: ${diffKeys.join(', ')}); incremental refresh: [${eligible.join(', ',
          )}] (enabled among ${SECTIONS_TO_REFRESH_AFTER_CHANGE_OF_VISIBILITY_OF_CALENDAR_SECTIONS.join(', ')}); TB appended when enabled in processActionOnReturn`,
        )
      } else {
        logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: only calendar section visibility changed (keys: ${diffKeys.join(', ')}); incremental refresh from Wins/Priority/Overdue list: none (all off)`,
        )
      }
    } else {
      const keysNeedingContentRefresh = diffKeys.filter((k) => !DASHBOARD_SETTING_KEYS_NOT_REQUIRING_DISPLAY_OR_CONTENT_REFRESH.has(k))
      if (keysNeedingContentRefresh.length > 0) {
        resultsToHandle.push('REFRESH_ALL_ENABLED_SECTIONS')
        logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: content-affecting settings changed (keys: ${keysNeedingContentRefresh.join(', ')}); will REFRESH_ALL_ENABLED_SECTIONS`)
      }
      if (dashboardFolderFilterSettingsChanged(diffKeys)) {
        resultsToHandle.push('ACTIVE_PERSPECTIVE_DEFINITION_CHANGED')
        logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: folder filter settings changed; will ACTIVE_PERSPECTIVE_DEFINITION_CHANGED when Rich list is open`)
      }
      if (diffKeys.length > 0 && keysNeedingContentRefresh.length === 0) {
        logInfo('doSaveDashboardSettingsFromBridge', `Section refresh plan: settings changed but excluded from section refresh (keys: ${diffKeys.join(', ')}); incremental section refresh: none`)
      }
    }
  }
  return { resultsToHandle, resultExtra }
}

/**
 * Save settings from the React bridge into DataStore, update the WebView pluginData, and return post-save actions.
 * For `dashboardSettings` without a full `perspectiveSettings` payload, see `resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload`.
 * @param {MessageDataObject} data - MDO with `settings` (and optionally `perspectiveSettings` from the client)
 * @param {string} settingName - DataStore key to update (`dashboardSettings` or `perspectiveSettings`)
 * @returns {TBridgeClickHandlerResult}
 * @author @dwertheimer + @Cursor
 */
export async function doSaveDashboardSettingsFromBridge(data: MessageDataObject, settingName: string): Promise<TBridgeClickHandlerResult> {
  try {
    // clo(data, `doSaveDashboardSettingsFromBridge() starting with data = `)
    // $FlowFixMe[incompatible-type]
    const settingsFromBridge: Partial<TDashboardSettings> = data.settings
    // DataStore.settings is not reliable in HTMLView JSContexts; use the settings helpers instead.
    if (!settingsFromBridge) {
      throw new Error(`settingsFromBridge is null or undefined.`)
    }
    const isDashboardSettings = settingName === 'dashboardSettings'
    const normalizedDashboardSettings: Partial<TDashboardSettings> = isDashboardSettings
      ? (normaliseDashboardNumberSettings(settingsFromBridge): any)
      : settingsFromBridge

    // Client may send only dashboardSettings; derive perspective defs (e.g. set isModified on active perspective).
    let perspectivesToSave = settingName === 'dashboardSettings' ? data.perspectiveSettings : Array.isArray(settingsFromBridge) ? settingsFromBridge : []
    if (settingName === 'dashboardSettings' && !data.perspectiveSettings) {
      const resolved = await resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload(normalizedDashboardSettings, settingsFromBridge)
      if (resolved.kind === 'done') {
        return resolved.result
      }
      perspectivesToSave = resolved.perspectivesToSave
    }

    const pluginSettingsBeforeSave = await loadDashboardPluginSettings()
    // Deep snapshot before save: `saveSettings` / shared caches may mutate `pluginSettingsBeforeSave.dashboardSettings` in place, which made `compareObjects(prevMerged, nextMerged)` falsely empty (e.g. `winsPriorityMarker` >> !!!)
    const priorDashboardSettingsSnapshot: { [string]: any } = cloneDashboardSettingsBeforeSave(pluginSettingsBeforeSave?.dashboardSettings)
    const settingsToSave = isDashboardSettings
      ? prepareDashboardSettingsForSave(priorDashboardSettingsSnapshot, normalizedDashboardSettings, { mergeDefaults: true })
      : settingsFromBridge
    const pluginSettingsToWrite = { ...pluginSettingsBeforeSave, [settingName]: settingsToSave }

    if (perspectivesToSave && Array.isArray(perspectivesToSave)) {
      const debugInfo = perspectivesToSave.map(
        (ps) => `${ps.name} excludedFolders=[${String(ps.dashboardSettings?.excludedFolders) ?? ''} ${ps.isModified ? 'modified' : ''} ${ps.isActive ? '<active>' : ''}`)
        .join(`\n\t`)
      logDebug(`doSaveDashboardSettingsFromBridge`, `Saving perspectiveSettings also\n\t${debugInfo}`)

      pluginSettingsToWrite.perspectiveSettings = perspectivesToSave
    }

    const saveOk = await saveDashboardPluginSettings(pluginSettingsToWrite)
    const pushFromServer: { [string]: boolean } = { [settingName]: true }
    if (perspectivesToSave) {
      pushFromServer.perspectiveSettings = true
    }
    const pluginDataPatch: { [string]: any } = { [settingName]: settingsToSave, pushFromServer }
    if (perspectivesToSave) {
      // FlowFixMe(incompatible-type)
      pluginDataPatch.perspectiveSettings = perspectivesToSave
    }
    await setPluginData(pluginDataPatch, `_Updated ${settingName} in global pluginData`)

    let resultsToHandle: Array<TActionOnReturn> = ['CLOSE_UNNEEDED_SECTIONS']
    let resultExtra: { sectionCodes?: Array<TSectionCode>, dashboardThemeName?: string } = {}
    if (settingName === 'dashboardSettings') {
      const sectionRefreshPlan = planSectionRefreshAfterDashboardSettingsChange(priorDashboardSettingsSnapshot, settingsToSave)
      resultsToHandle = sectionRefreshPlan.resultsToHandle
      resultExtra = sectionRefreshPlan.resultExtra
    }

    return handlerResult(saveOk, resultsToHandle, resultExtra)
  } catch (error) {
    logError('doSaveDashboardSettingsFromBridge', error.message)
    return handlerResult(false, [], { errorMsg: `When trying to save settings, an error occurred: ${error.message}`, errorMessageLevel: 'ERROR' })
  }
}
