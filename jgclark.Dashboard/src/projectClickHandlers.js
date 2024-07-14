// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 20.6.2024 for v2.0.0-b10 by @jgclark
//-----------------------------------------------------------------------------

// import pluginJson from '../plugin.json'
import {
  cancelProject, cancelProjectByFilename,
  completeProject, completeProjectByFilename,
  togglePauseProject, togglePauseProjectByFilename,
  addProgressUpdate
} from '../../jgclark.Reviews/src/projects'
import {
  finishReviewForNote,
  setNewReviewInterval,
  skipReviewForNote,
  startReviews,
} from '../../jgclark.Reviews/src/reviews'
import {
  handlerResult,
} from './dashboardHelpers'
import {
  type MessageDataObject,
  type TBridgeClickHandlerResult,
} from './types'
import { validateAndFlattenMessageObject } from './shared'
import { RE_DATE, RE_DATE_INTERVAL } from '@helpers/dateTime'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  // sendToHTMLWindow,
  // getGlobalSharedData,
} from '@helpers/HTMLView'
import { logWindowsList } from '@helpers/NPWindows'

/****************************************************************************************************************************
 *                             NOTES
 ****************************************************************************************************************************
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON'

/****************************************************************************************************************************
 *                             Data types + constants
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/

/** 
 * Complete the project in the actual Note
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteProject(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // await completeProjectByFilename(filename)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    await completeProject(note)
    logDebug('doCompleteProject', `-> likely success (no error)`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doCompleteProject', `-> couldn't get note from filename ${filename} to get project to ask to complete`)
    return handlerResult(false)
  }
}

/** 
 * Cancel the Project in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCancelProject(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // await cancelProjectByFilename(filename)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    await cancelProject(note)
    logDebug('doCompleteProject', `-> likely success (no error)`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doCompleteProject', `-> couldn't get note from filename ${filename} to get project to ask to complete`)
    return handlerResult(false)
  }
}

/** 
 * Toggle pausing the Project in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doTogglePauseProject(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // await togglePauseProjectByFilename(filename)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    await togglePauseProject(note)
    logDebug('doCompleteProject', `-> likely success (no error)`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doCompleteProject', `-> couldn't get note from filename ${filename} to get project to ask to complete`)
    return handlerResult(false)
  }
}

// Mimic the /skip review command
export async function doSetNextReviewDate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    if (!data.controlStr) throw 'doSetNextReviewDate: No controlStr: stopping'
    const thisControlStr = data.controlStr

    // Either we have a date interval prefixed with 'nr' ...
    const period = thisControlStr.replace('nr', '')
    if (period.match(RE_DATE_INTERVAL)) {
      logDebug('doSetNextReviewDate', `-> will skip review by '${period}' for filename ${filename}.`)
      skipReviewForNote(note, period)
      // Or have an ISO date
    } else if (thisControlStr.match(RE_DATE)) {
      logDebug('doSetNextReviewDate', `-> will skip review to date '${thisControlStr}' for filename ${filename}.`)
      skipReviewForNote(note, period)
    } else {
      throw `doSetNextReviewDate: invalid controlStr ${thisControlStr}: stopping`
    }

    // Now remove the line from the display
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'REFRESH_SECTION_IN_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doSetNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
    return handlerResult(false)
  }
}

// Call Reviews plugin function to set new review interval
export async function doSetNewReviewInterval(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    await setNewReviewInterval(note)

    // Now update this section in the display, hoping we don't hit race condition when update full review list
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doSetNewReviewInterval', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
    return handlerResult(false)
  }
}

// Mimic the /finish review command.
export async function doReviewFinished(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    logDebug('doReviewFinished', `-> starting on item ID ${data.item?.ID ?? '<no ID found>'} in filename ${filename}`)
    // update this to actually take a note to work on
    finishReviewForNote(note)
    logDebug('doReviewFinished', `-> after finishReview`)

    // Now ask to update this line in the display
    // TODO: ideally do 'REFRESH_SECTION_IN_JSON' as well, but this looks to have a race condition.
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doReviewFinished', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
    return handlerResult(false)
  }
}

// Mimic the /start reviews command.
export async function doStartReviews(): Promise<TBridgeClickHandlerResult> {
  // update this to actually take a note to work on
  await startReviews()
  logDebug('doStartReviews', `-> after startReviews`)
  // Now update this section in the display, hoping we don't hit race condition with the updated full review list
  return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: ['PROJ'] })
}

// Mimic the /add progress update command.
export async function doAddProgressUpdate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    logDebug('doAddProgressUpdate', `-> doAddProgressUpdate on item ID ${data.item?.ID ?? '<no ID found>'} in filename ${filename}`)
    // ask user and add
    await addProgressUpdate(note)
    logDebug('doAddProgressUpdate', `-> added`)

    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { sectionCodes: ['PROJ'] })
  } else {
    logWarn('doAddProgressUpdate', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
    return handlerResult(false)
  }
}