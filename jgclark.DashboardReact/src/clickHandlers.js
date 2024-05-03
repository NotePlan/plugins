//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

// @flow
/* eslint-disable require-await */

// import pluginJson from '../plugin.json'
import { type TBridgeClickHandlerResult, type TActionOnReturn, type MessageDataObject, type TSectionItem } from './types'
import { log, logError, logWarn, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { cancelItem, completeItem, completeItemEarlier, findParaFromStringAndFilename, toggleTaskChecklistParaType, unscheduleItem } from '@helpers/NPParagraph'
import { getNoteByFilename } from '@helpers/note'

/****************************************************************************************************************************
 *                             NOTES
 ****************************************************************************************************************************
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON'

/****************************************************************************************************************************
 *                             SUPPORT FUNCTIONS    
 ****************************************************************************************************************************/

/**
 * Convenience function to create the standardized handler result object
 * @param {boolean} success - whether the action was successful
 * @param {Array<TActionOnReturn>} actionsOnSuccess - actions to be taken if success was true
 * @param {any} otherSettings - an object with any other settings, e.g. updatedParagraph
 * @returns {TBridgeClickHandlerResult}
 */
function handlerResult(success: boolean, actionsOnSuccess?: Array<TActionOnReturn> = [], otherSettings?: any = {}): TBridgeClickHandlerResult {
  return {
    ...otherSettings,
    success,
    actionsOnSuccess,
  }
}

type ValidatedData = {
  filename: string,
  content: any,
  item: TSectionItem,
}

/**
 * Validates the provided MessageDataObject to ensure the basic fields exist
 * so we don't have to write this checking code in every handler
 * You should still check the validity of
 * @param {MessageDataObject} data The data object to validate.
 * @returns {ValidatedData} The validated data.
 * @throws {Error} If the data object is invalid.
 * @example const { filename, content, item } = validateData(data)
 */
function validateData(data: MessageDataObject): ValidatedData {
  const { item } = data
  if (!item?.para) {
    throw new Error(`Error validating data: No item.para was passed: ${JSON.stringify(data)}`)
  }
  const { filename, content } = item?.para || {}
  if (!filename || content === undefined) {
    throw new Error(`Error validating data: No filename/content was passed: ${JSON.stringify(data)}`)
  }
  return { filename, content, item }
}

/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/
/**
 * Handles updating the content of an item.
 * @param {MessageDataObject} data - The filename where the content resides.
 * @param {TNote} note - The note where the content resides.
 * @throws {Error} If the updated content is not provided.
 */

// Complete the task in the actual Note
export async function doCompleteTask(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateData(data)
  const updatedPara = completeItem(filename, content)
  logDebug('doCompleteTask', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE', 'REFRESH_JSON'], { updatedPara })
}

// Complete the task in the actual Note, but with the date it was scheduled for
export async function doCompleteTaskThen(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateData(data)
  const updatedPara = completeItemEarlier(filename, content)
  logDebug('doCompleteTaskThen', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE', 'REFRESH_JSON'], { updatedPara })
}

// Cancel the task in the actual Note
export async function doCancelTask(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateData(data)
  const updatedPara = cancelItem(filename, content)
  logDebug('doCancelTask', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE', 'REFRESH_JSON'], { updatedPara })
}

// Complete the checklist in the actual Note
export async function doCompleteChecklist(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateData(data)
  const updatedPara = completeItem(filename, content)
  logDebug('doCompleteChecklist', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE', 'REFRESH_JSON'], { updatedPara })
}

// Cancel the checklist in the actual Note
export async function doCancelChecklist(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateData(data)
  const updatedPara = cancelItem(filename, content)
  logDebug('doCancelChecklist', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE', 'REFRESH_JSON'], { updatedPara })
}

/**
 * Updates content based on provided data.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doContentUpdate(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateData(data)
  const { updatedContent } = data
  logDebug('doContentUpdate', `${updatedContent || ''}`)
  if (!updatedContent) {
    throw new Error('Trying to updateItemContent but no updatedContent was passed')
  }

  const para = findParaFromStringAndFilename(filename, content)

  if (!para) {
    throw new Error(`updateItemContent: No para found for filename ${filename} and content ${content}`)
  }

  para.content = updatedContent
  if (para.note) {
    para.note.updateParagraph(para)
  } else {
    throw new Error(`updateItemContent: No para.note found for filename ${filename} and content ${content}`)
  }

  return handlerResult(true, ['UPDATE_CONTENT', 'REFRESH_JSON'], { updatedParagraph: para })
}

// Send a request to toggleType to plugin
export function doToggleType(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateData(data)
  const updatedPara = toggleTaskChecklistParaType(filename, content)
  logDebug('doToggleType', `-> ${String(updatedPara)}`)
  return handlerResult(true, ['UPDATE_CONTENT', 'REFRESH_JSON'], { updatedParagraph: updatedPara })

  // logDebug('bCDI / toggleType', `-> new type '${String(res)}'`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'toggleType', data)
  // Only use if necessary:
  // Warnbug('bCDI', '------- refr turned off at the momentesh ---------------')
  // await showDashboardReact('refresh')
}

// Send a request to unscheduleItem to plugin
export function doUnscheduleItem(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateData(data)
  const updatedPara = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedPara)}`)
  return handlerResult(true, ['UPDATE_CONTENT', 'REMOVE_LINE', 'REFRESH_JSON'], { updatedParagraph: updatedPara })

  // logDebug('bCDI / unscheduleItem', `  -> result ${String(res)}`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'unscheduleItem', data)
}