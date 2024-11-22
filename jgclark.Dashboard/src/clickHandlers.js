// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for some dashboard clicks that come over the bridge.
// There are 4+ other clickHandler files now.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated for v2.1.0.a
//-----------------------------------------------------------------------------
import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { allCalendarSectionCodes, WEBVIEW_WINDOW_ID } from './constants'
import {
  getTotalDoneCountsFromSections,
  updateDoneCountsFromChangedNotes,
} from './countDoneTasks'
import {
  getDashboardSettings,
  getNotePlanSettings,
  handlerResult,
  mergeSections,
  moveItemToRegularNote,
  setPluginData,
} from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import { setDashPerspectiveSettings } from './perspectiveClickHandlers'
import {
  addNewPerspective,
  deletePerspective,
  getActivePerspectiveDef,
  getPerspectiveSettings,
  replacePerspectiveDef,
  cleanDashboardSettings,
  switchToPerspective,
} from './perspectiveHelpers'
import { validateAndFlattenMessageObject } from './shared'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings, TPluginData, TPerspectiveSettings } from './types'
import {
  cancelItem,
  completeItem,
  completeItemEarlier,
  deleteItem,
  findParaFromStringAndFilename,
  highlightParagraphInEditor,
  scheduleItem,
  unscheduleItem,
} from '@helpers/NPParagraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import { openNoteByFilename } from '@helpers/NPnote'
import { calcOffsetDateStr, getDateStringFromCalendarFilename, getTodaysDateHyphenated, RE_DATE, RE_DATE_INTERVAL } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer, dt } from '@helpers/dev'
import { getGlobalSharedData } from '@helpers/HTMLView'
import { cyclePriorityStateDown, cyclePriorityStateUp } from '@helpers/paragraph'
import { showMessage, processChosenHeading } from '@helpers/userInput'

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
    return handlerResult(false)
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
 * Prepend an open task to 'calNoteFilename' calendar note, using text we prompt the user for.
 * Note: It only writes to Calendar notes, as that's only what Dashboard needs.
 * @param {MessageDataObject} {actionType: addTask|addChecklist etc., toFilename:xxxxx}
 * @returns {TBridgeClickHandlerResult} result to be used by click result handler
 */
export async function doAddItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const config = await getDashboardSettings()
    clo(data, 'data for doAddItem', 2)
    const { actionType, toFilename, sectionCodes, userInputObj } = data
    const { text, heading } = userInputObj || {}

    logDebug('doAddItem', `- actionType: ${actionType} to ${toFilename || ''} in section ${String(sectionCodes)}`)
    if (!toFilename) {
      throw new Error('doAddItem: No toFilename provided')
    }
    const todoType = actionType === 'addTask' ? 'task' : 'checklist'

    const calNoteDateStr = getDateStringFromCalendarFilename(toFilename, true)
    // logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined for ${toFilename}`)
    }

    const content = text ?? (await CommandBar.showInput(`Type the ${todoType} text to add`, `Add ${todoType} '%@' to ${calNoteDateStr}`))
    const note = DataStore.noteByFilename(toFilename, 'Calendar')
    if (!note) throw new Error(`doAddItem: No note found for ${toFilename}`)
    // Add text to the new location in destination note

    const newHeadingLevel = config.newTaskSectionHeadingLevel

    const headingToUse = heading ? await processChosenHeading(note, newHeadingLevel, heading || '') : config.newTaskSectionHeading

    if (actionType === 'addTask') {
      addTaskToNoteHeading(calNoteDateStr, headingToUse, content, newHeadingLevel)
    } else {
      addChecklistToNoteHeading(calNoteDateStr, headingToUse, content, newHeadingLevel)
    }
    // TEST: update cache
    DataStore.updateCache(note, true)

    // update just the section we've added to
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { sectionCodes: sectionCodes })
  } catch (err) {
    logError('doAddItem', err.message)
    return { success: false }
  }
}

/**
 * Complete the task in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCompleteTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content, item } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItem(filename, content)
  // clo(updatedParagraph, `doCompleteTask -> updatedParagraph`)

  if (typeof updatedParagraph !== 'boolean') {
    logDebug('doCompleteTask', `-> {${updatedParagraph.content}}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'INCREMENT_DONE_COUNT', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
  } else {
    logWarn('doCompleteTask', `-> failed`)
    return handlerResult(false)
  }
}

/**
 * Complete the task in the actual Note, but with the date it was scheduled for.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCompleteTaskThen(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItemEarlier(filename, content)
  if (typeof updatedParagraph !== 'boolean') {
    logDebug('doCompleteTaskThen', `-> {${updatedParagraph.content}}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
  } else {
    logWarn('doCompleteTaskThen', `-> failed`)
    return handlerResult(false)
  }
}

/**
 * Cancel the task in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCancelTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  let res = cancelItem(filename, content)
  let updatedParagraph = null
  const possiblePara = findParaFromStringAndFilename(filename, content)
  if (typeof possiblePara === 'boolean') {
    res = false
  } else {
    updatedParagraph = possiblePara || {}
  }
  logDebug('doCancelTask', `-> ${res ? 'success' : 'failed'}`)
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
}

/**
 * Complete the checklist in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCompleteChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItem(filename, content)
  // clo(updatedParagraph, `doCompleteChecklist -> updatedParagraph`)
  // clo(updatedParagraph.note.filename, `doCompleteChecklist -> updatedParagraph.note.filename`)
  return handlerResult(Boolean(updatedParagraph), ['REMOVE_LINE_FROM_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
}

/**
 * Delete the item in the actual Note.
 * TODO: extend to delete sub-items as well if wanted.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doDeleteItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, sectionCodes } = validateAndFlattenMessageObject(data)
  logDebug('doDeleteItem', `Starting with "${String(content)}" and will ideally update sectionCodes ${String(sectionCodes)}`)
  // Grab a copy of the paragraph before deleting it, so React can remove the right line. (It's not aware the paragraph has disappeared on the back end.)
  const updatedParagraph = findParaFromStringAndFilename(filename, content)
  const res = await deleteItem(filename, content)
  logDebug('doDeleteItem', `-> ${res ? 'success' : 'failed'}`)
  return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
}

/**
 * Cancel the checklist in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export function doCancelChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  let res = cancelItem(filename, content)
  let updatedParagraph = null
  const possiblePara = findParaFromStringAndFilename(filename, content)
  if (typeof possiblePara === 'boolean') {
    res = false
  } else {
    updatedParagraph = possiblePara || {}
  }
  logDebug('doCancelChecklist', `-> ${res ? 'success' : 'failed'}`)
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph })
}

/**
 * Updates content based on provided data.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result
 */
export function doContentUpdate(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
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

  return handlerResult(true, ['UPDATE_LINE_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph: para })
}

/**
 * Send a request to toggleType to plugin
 * @param {MessageDataObject} data - The data object containing item info
 * @returns{TBridgeClickHandlerResult} The result
 */
export function doToggleType(data: MessageDataObject): TBridgeClickHandlerResult {
  try {
    const { filename, content, sectionCodes } = validateAndFlattenMessageObject(data)
    logDebug('toggleTaskChecklistParaType', `starting for "${content}" in filename: ${filename} with sectionCodes ${String(sectionCodes)}`)

    // V1: original from v0.x
    // const updatedType = toggleTaskChecklistParaType(filename, content)

    // V2: move most of toggleTaskChecklistParaType() into here, as we need access to the full para
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('toggleTaskChecklistParaType: no para found')
    }
    // logDebug('toggleTaskChecklistParaType', `toggling type for "${content}" in filename: ${filename}`)
    // Get the paragraph to change
    const updatedParagraph = possiblePara
    const thisNote = updatedParagraph.note
    if (!thisNote) throw new Error(`Could not get note for filename ${filename}`)
    const existingType = updatedParagraph.type
    logDebug('toggleTaskChecklistParaType', `toggling type from ${existingType} in filename: ${filename}`)
    const updatedType = existingType === 'checklist' ? 'open' : 'checklist'
    updatedParagraph.type = updatedType
    logDebug('doToggleType', `-> ${updatedType}`)
    thisNote.updateParagraph(updatedParagraph)
    DataStore.updateCache(thisNote, false)
    // Refresh the whole section, as we might want to filter out the new item type from the display
    // return handlerResult(true, ['UPDATE_LINE_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph: updatedParagraph })
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { sectionCodes: sectionCodes })
  } catch (error) {
    logError('doToggleType', error.message)
    return handlerResult(false)
  }
}

/**
 * Send a request to unscheduleItem to plugin
 * @param {MessageDataObject} data - The data object containing item info
 * @returns {TBridgeClickHandlerResult} The result
 */
export function doUnscheduleItem(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedParagraph)}`)

  // logDebug('doUnscheduleItem', `  -> result ${String(res)}`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'unscheduleItem', data)
  return handlerResult(true, ['UPDATE_LINE_IN_JSON', 'START_DELAYED_REFRESH_TIMER'], { updatedParagraph: updatedParagraph })
}

// Send a request to cyclePriorityStateUp to plugin
export function doCyclePriorityStateUp(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)

  // Get para
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    // const paraContent = para.content ?? 'error'
    // logDebug('doCyclePriorityStateUp', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    // const newPriority = (getTaskPriority(paraContent) + 1) % 5
    const updatedContent = cyclePriorityStateUp(para)
    para.content = updatedContent
    logDebug('doCyclePriorityStateUp', `cycling priority -> {${JSP(updatedContent)}}`)

    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: para })
  } else {
    logWarn('doCyclePriorityStateUp', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false, [], { errorMsg: `unable to find para "${content}" in filename: "${filename}"` })
  }
}

// Send a request to cyclePriorityStateDown to plugin
export function doCyclePriorityStateDown(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
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
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: para })
  } else {
    logWarn('doCyclePriorityStateDown', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false, [], { errorMsg: `unable to find para "${content}" in filename: "${filename}"` })
  }
}

// TODO(later): get working or remove
// export function dowindowResized(data: MessageDataObject): TBridgeClickHandlerResult {
//   logDebug('bCDI / windowResized', `windowResized triggered on plugin side (hopefully for '${windowCustomId}')`)
//   const thisWin = getWindowFromCustomId(windowCustomId)
//   const rect = getLiveWindowRectFromWin(thisWin)
//   if (rect) {
//     // logDebug('bCDI / windowResized/windowResized', `-> saving rect: ${rectToString(rect)} to pref`)
//     storeWindowRect(windowCustomId)
//   }
// }

// Handle a show note call simply by opening the note in the main Editor.
// Note: use the showLine... variant of this (below) where possible
export async function doShowNoteInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, modifierKey } = data
  if (!filename) throw 'doShowNoteInEditorFromFilename: No filename: stopping'
  const note = await openNoteByFilename(filename, { newWindow: modifierKey === 'meta', splitView: modifierKey === 'alt' })
  return handlerResult(note ? true : false)
}

// Handle a show note call simply by opening the note in the main Editor
// Note: use the showLine... variant of this (below) where possible
export async function doShowNoteInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
  const wantedTitle = filename
  const note = await Editor.openNoteByTitle(wantedTitle)
  if (note) {
    logDebug('bridgeClickDashboardItem', `-> successful call to open title ${wantedTitle} in Editor`)
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> failed to open title ${wantedTitle} in Editor`)
    return handlerResult(false)
  }
}

/**
 * Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line.
 * If ⌘ (command) key is clicked, then open in a new floating window.
 * If option key is clicked, then open in a new split view.
 * @param {MessageDataObject} data with details of item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doShowLineInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, modifierKey } = validateAndFlattenMessageObject(data)
  // logDebug('showLineInEditorFromFilename', `${filename} /  ${content}`)
  const note = await Editor.openNoteByFilename(filename, modifierKey === 'meta', 0, 0, modifierKey === 'alt')
  if (note) {
    const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
    logDebug(
      'bridgeClickDashboardItem',
      `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
    )
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> failed to open filename ${filename} in Editor`)
    return handlerResult(false)
  }
}

// Note: not currently used
// Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line
// export async function doShowLineInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
//   // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
//   const { title, filename, content } = validateAndFlattenMessageObject(data)
//   const note = await Editor.openNoteByTitle(title)
//   if (note) {
//     const res = highlightParagraphInEditor({ filename: note.filename, content: content }, true)
//     logDebug(
//       'bridgeClickDashboardItem',
//       `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
//     )
//     return handlerResult(true)
//   } else {
//     logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title '${title}' in Editor`)
//     return handlerResult(false)
//   }
// }

// Instruction to move task from a note to a project note.
// Note: Requires user input, so most of the work is done in moveItemToRegularNote() on plugin side.
export async function doMoveToNote(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, itemType, para } = validateAndFlattenMessageObject(data)
  logDebug('doMoveToNote', `starting -> ${filename} / ${content} / ${itemType}`)
  const newNote: TNote | null | void = await moveItemToRegularNote(filename, content, itemType)
  if (newNote) {
    logDebug('doMoveToNote', `Success: moved to -> "${newNote?.title || ''}"`)
    logDebug('doMoveToNote', `- now needing to find the TPara for ${para.type}:"${content}" ...`)
    // updatedParagraph (below) is an actual NP object (TParagraph) not a TParagraphForDashboard, so we need to go and find it again
    const updatedParagraph = newNote.paragraphs.find((p) => p.content === content && p.type === para.type)
    if (updatedParagraph) {
      logDebug('doMoveToNote', `- Sending update line request $JSP(updatedParagraph)`)
      return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph })
    } else {
      logWarn('doMoveToNote', `Couldn't find updated paragraph. Resorting to refreshing all enabled sections :-(`)
      return handlerResult(true, ['REFRESH_ALL_ENABLED_SECTIONS'], { sectionCodes: allCalendarSectionCodes })
    }
  } else {
    return handlerResult(false)
  }
}

/**
 * Reschedule (i.e. update the >date) an item in place.
 * The new date is indicated by the controlStr ('t' or date interval),
 * or failing that the dateString (an NP date).
 * Note: now defaults to changing the item to being type 'rescheduled' or 'checklistScheduled', as well as
 * @param {MessageDataObject} data for the item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doRescheduleItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const config: TDashboardSettings = await getDashboardSettings()
  // logDebug('doRescheduleItem', `- config.rescheduleNotMove = ${config.rescheduleNotMove}`)
  logDebug('doRescheduleItem', `Starting with filename: ${filename}, content: "${content}", controlStr: ${controlStr}`)
  const dateOrInterval = String(controlStr)
  // const dateInterval = controlStr || ''
  let startDateStr = ''
  let newDateStr = ''

  const thePara = findParaFromStringAndFilename(filename, content)
  if (typeof thePara === 'boolean') {
    logWarn('doRescheduleItem', `- note ${filename} doesn't seem to contain {${content}}`)
    clo(data, `doRescheduleItem -> data`)
    await showMessage(`Note ${filename} doesn't seem to contain "{${content}}"`)
    return handlerResult(false)
  }

  if (dateOrInterval === 't') {
    // Special case to change to '>today' (or the actual date equivalent)
    newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
    logDebug('doRescheduleItem', `- move task in ${filename} -> 'today'`)
  } else if (dateOrInterval.match(RE_DATE_INTERVAL)) {
    const dateInterval = dateOrInterval
    const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character
    // Get today's date, ignoring current date on task. Note: this means we always start with a *day* base date, not week etc.
    startDateStr = getTodaysDateHyphenated()
    // Get the new date, but output using the longer of the two types of dates given
    newDateStr = calcOffsetDateStr(startDateStr, dateInterval, 'longer')

    // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week'
    if (offsetUnit === 'w') {
      const offsetNum = Number(dateInterval.substr(0, dateInterval.length - 1)) // return all but last character
      // $FlowFixMe(incompatible-type)
      const NPWeekData: NotePlanWeekInfo = getNPWeekData(startDateStr, offsetNum, 'week')
      // clo(NPWeekData, "NPWeekData:")
      newDateStr = NPWeekData.weekString
      logDebug('doRescheduleItem', `- used NPWeekData instead -> ${newDateStr}`)
    }
  } else if (dateOrInterval.match(RE_DATE)) {
    newDateStr = controlStr
    logDebug('doRescheduleItem', `- newDateStr ${newDateStr} from controlStr`)
  } else {
    logError('doRescheduleItem', `bad move date/interval: ${dateOrInterval}`)
    return handlerResult(false)
  }
  logDebug('doRescheduleItem', `change due date on task from ${startDateStr} -> ${newDateStr}`)

  // Make the actual change to reschedule the item
  // v1:
  // const theLine = thePara.content
  // const changedLine = replaceArrowDatesInString(thePara.content, `>${newDateStr}`)
  // logDebug('doRescheduleItem', `Found line "${theLine}" -> changed line: "${changedLine}"`)
  // thePara.content = changedLine
  // v2:
  const res = scheduleItem(thePara, newDateStr, config.useRescheduleMarker)
  const thisNote = thePara.note
  if (thisNote) {
    thisNote.updateParagraph(thePara)
    logDebug('doRescheduleItem', `- appeared to update line OK -> {${thePara.content}}`)

    // Ask for cache refresh for this note
    DataStore.updateCache(thisNote, false)

    // refresh whole display, as we don't know which if any section the moved task might need to be added to
    // logDebug('doRescheduleItem', `------------ refresh ------------`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'REFRESH_ALL_SECTIONS'], { updatedParagraph: thePara })
  } else {
    logWarn('doRescheduleItem', `- some other failure`)
    return handlerResult(false)
  }
}

/**
 * Update a single key in DataStore.settings
 * @param {MessageDataObject} data - a MDO that should have a key "settings" with the items to be set to the settingName key
 * @param {string} settingName - the single key to set to the value of data.settings
 * @returns {TBridgeClickHandlerResult}
 */
export async function doSettingsChanged(data: MessageDataObject, settingName: string): Promise<TBridgeClickHandlerResult> {
  clo(data, `doSettingsChanged() starting with data = `)
  const newSettings = data.settings
  if (!DataStore.settings || !newSettings) {
    throw new Error(`doSettingsChanged newSettings: ${JSP(newSettings)} or settings is null or undefined.`)
  }
  // If we are saving the dashboardSettings, and the perspectiveSettings are not being sent, then we need to save the active perspective settings
  let perspectivesToSave = data.perspectiveSettings
  if (settingName === 'dashboardSettings' && !data.perspectiveSettings) {
    let needToSetDash = false
    const perspectiveSettings = await getPerspectiveSettings()
    if (newSettings.perspectivesEnabled) {
      // All changes to dashboardSettings should be saved in the "-" perspective (changes to perspectives are not saved until Save... is selected)
      const activePerspDef = getActivePerspectiveDef(perspectiveSettings)
      logDebug(`doSettingsChanged`, `activePerspDef.name=${String(activePerspDef?.name || '')}`)
      if (activePerspDef && activePerspDef.name !== '-') {
        // ignore dashboard changes in the perspective definition until it is saved explicitly
        // but we need to set the isModified flag on the perspective
        logDebug(`doSettingsChanged`, `Setting isModified to true for perspective ${activePerspDef.name}`)
        perspectivesToSave = perspectiveSettings.map((p) => (p.name === activePerspDef.name ? { ...p, isModified: true } : { ...p, isModified: false }))
      } else {
        needToSetDash = true
      }
    } else {
      needToSetDash = true
    }
    if (needToSetDash) {
      if (typeof newSettings === 'object' && newSettings !== null && !Array.isArray(newSettings)) {
        perspectivesToSave = setDashPerspectiveSettings(newSettings, perspectiveSettings)
      } else {
        logError(`doSettingsChanged`, `newSettings is not an object: ${JSP(newSettings)}`)
      }
    }
  }

  settingName === 'dashboardSettings' &&
    logDebug(`doSettingsChanged`, `TOP saving: excluded (in the main dashboard settings)=${newSettings.excludedFolders} filterPriorityItems=${newSettings.filterPriorityItems}`)

  const combinedUpdatedSettings = { ...DataStore.settings, [settingName]: JSON.stringify(newSettings) }

  if (perspectivesToSave) {
    const debugInfo = perspectivesToSave
      .map(
        (ps) =>
          `${ps.name} excludedFolders=[${ps.dashboardSettings?.excludedFolders && ps.dashboardSettings?.excludedFolders?.toString()}] ${ps.isModified ? 'modified' : ''} ${
            ps.isActive ? '<active>' : ''
          }`,
      )
      .join(`\n\t`)
    logDebug(`doSettingsChanged`, `Saving perspectiveSettings also\n\t${debugInfo}`)

    combinedUpdatedSettings.perspectiveSettings = JSON.stringify(perspectivesToSave)
  }

  DataStore.settings = combinedUpdatedSettings
  const updatedPluginData = { [settingName]: newSettings, serverPush: { [settingName]: true } }
  if (perspectivesToSave) {
    updatedPluginData.serverPush.perspectiveSettings = true
    // $FlowFixMe(incompatible-type)
    updatedPluginData.perspectiveSettings = perspectivesToSave
  }
  await setPluginData(updatedPluginData, `_Updated ${settingName} in global pluginData`)
  const refreshes = settingName === 'dashboardSettings' ? ['REFRESH_ALL_SECTIONS'] : [] // don't refresh if we were saving just perspectiveSettings
  return handlerResult(true, ['REFRESH_ALL_SECTIONS'])
}

export async function doCommsBridgeTest(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // send a banner message by failing the handler
  return await handlerResult(false, [], { errorMsg: `Success: This was sent from the plugin. Round trip works 5x5.` })
}
