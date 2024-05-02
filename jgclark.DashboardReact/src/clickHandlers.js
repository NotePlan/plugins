// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()

// @flow
/* eslint-disable require-await */

// import pluginJson from '../plugin.json'
import { type TBridgeClickHandlerResult, type TActionOnReturn, type MessageDataObject, type TSectionItem } from './types'
import { log, logError, logWarn, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { cancelItem, completeItem, completeItemEarlier, findParaFromStringAndFilename } from '@helpers/NPParagraph'
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

// Complete the task in the actual Note, but with the date it was scheduled for
export async function doCompleteTaskThen(data: MessageDataObject): Promise<void> {
  const { filename, content } = validateData(data)
  const res = completeItemEarlier(filename, content)
  // Ask for cache refresh for this note
  DataStore.updateCache(getNoteByFilename(filename), false)

  // Update display in Dashboard too
  if (res) {
    logDebug('bCDI / completeTaskThen', `-> successful call to completeItemEarlier(), so will now attempt to remove the row in the displayed table too`)
  } else {
    logWarn('bCDI / completeTaskThen', `-> unsuccessful call to completeItemEarlier(). Will trigger a refresh of the dashboard.`)
    // logWarn('bCDI', '------- refresh turned off at the moment ---------------')
  }
}

// Cancel the task in the actual Note
export async function doCancelTask(data: MessageDataObject): Promise<void> {
  const { filename, content } = validateData(data)
  const res = cancelItem(filename, content)

  // Update display in Dashboard too
  if (res) {
    logDebug('bCDI / cancelTask', `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
  } else {
    logWarn('bCDI / cancelTask', `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
    // logWarn('bCDI', '------- refresh turned off at the moment ---------------')
  }
}

// Complete the checklist in the actual Note
export async function doCompleteChecklist(data: MessageDataObject): Promise<void> {
  const { filename, content } = validateData(data)
  const res = completeItem(filename, content)

  // Update display in Dashboard too
  if (res) {
    logDebug('bCDI / completeChecklist', `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
  } else {
    logWarn('bCDI / completeChecklist', `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
    // logWarn('bCDI', '------- refresh turned off at the moment ---------------')
  }
}
