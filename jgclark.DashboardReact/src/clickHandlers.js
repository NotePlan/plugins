// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { finishReviewForNote, skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import { getSettings, moveItemBetweenCalendarNotes } from './dashboardHelpers'
import { copyUpdatedSectionItemData, findSectionItems, getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import { type TBridgeClickHandlerResult, type TActionOnReturn, type MessageDataObject, type TSectionItem, type TSectionCode } from './types'
import { validateAndFlattenMessageObject } from './shared'
import { getSettingFromAnotherPlugin } from '@helpers/NPConfiguration'
import { calcOffsetDateStr, getDateStringFromCalendarFilename, getTodaysDateHyphenated, RE_DATE_INTERVAL, RE_NP_WEEK_SPEC, replaceArrowDatesInString } from '@helpers/dateTime'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { sendToHTMLWindow, getGlobalSharedData, updateGlobalSharedData } from '@helpers/HTMLView'
import { projectNotesSortedByChanged, getNoteByFilename } from '@helpers/note'
import {
  cancelItem,
  completeItem,
  completeItemEarlier,
  findParaFromStringAndFilename,
  highlightParagraphInEditor,
  toggleTaskChecklistParaType,
  unscheduleItem,
} from '@helpers/NPParagraph'
import { cyclePriorityStateDown, cyclePriorityStateUp, getTaskPriority } from '@helpers/paragraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import { getLiveWindowRectFromWin, getWindowFromCustomId, logWindowsList, storeWindowRect } from '@helpers/NPWindows'
import { chooseHeading, showMessage } from '@helpers/userInput'

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

const windowCustomId = `${pluginJson['plugin.id']} React Window`
const WEBVIEW_WINDOW_ID = windowCustomId

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

/**
 * Merge existing sections data with replacement data
 * If the section existed before, it will be replaced with the new data
 * If the section did not exist before, it will be added to the end of sections
 * @param {Array<TSectionItem>} existingSections 
 * @param {Array<TSectionItem>} newSections 
 * @returns {Array<TSectionItem>} - merged sections
 */
function mergeSections(existingSections: Array<TSectionItem>, newSections: Array<TSectionItem>): Array<TSectionItem> {
  newSections.forEach((newSection) => {
    const existingIndex = existingSections.findIndex((existingSection) => existingSection.ID === newSection.ID)
    if (existingIndex > -1) {
      existingSections[existingIndex] = newSection
    } else {
      existingSections.push(newSection)
    }
  })
  return existingSections
}

/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/

/**
 * Refresh the data in the HTML view - JSON only
 * And tell the React window to update the data
 */
export async function refreshAllSections(): Promise<void> {
  // TODO(@dwertheimer): I'm not sure that ...global... is the best name. Can we discuss?
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  reactWindowData.pluginData.sections = await getAllSectionsData(reactWindowData.demoMode)
  reactWindowData.pluginData.lastFullRefresh = new Date().toLocaleString()
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for all sections`)
}

/**
 * Refresh the data in the HTML view - JSON only
 * And tell the React window to update the data
 */
export async function refreshSomeSections(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const start = new Date()
  const {sectionCodes} = data
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  reactWindowData.pluginData.refreshing = true // show refreshing message until done
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data for sections ${String(sectionCodes)}`)
  const existingSections = reactWindowData.pluginData.sections
  const newSections = await getSomeSectionsData(sectionCodes, reactWindowData.demoMode,true) // force the section refresh for the wanted sections
  reactWindowData.pluginData.sections = mergeSections(existingSections, newSections)
  reactWindowData.pluginData.lastFullRefresh = new Date().toLocaleString()
  reactWindowData.pluginData.refreshing = false // show refreshing message until done
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshed JSON data for sections ${String(sectionCodes)}`)
  logDebug(`refreshSomeSections ${sectionCodes.toString()} took ${timer(start)}`)
  return handlerResult(true)
}

// Complete the task in the actual Note
export function doCompleteTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = completeItem(filename, content)
  logDebug('doCompleteTask', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE_FROM_JSON'], { updatedPara })
}

// Complete the task in the actual Note, but with the date it was scheduled for
export function doCompleteTaskThen(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = completeItemEarlier(filename, content)
  logDebug('doCompleteTaskThen', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE_FROM_JSON'], { updatedPara })
}

// Cancel the task in the actual Note
export function doCancelTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = cancelItem(filename, content)
  logDebug('doCancelTask', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE_FROM_JSON'], { updatedPara })
}

// Complete the checklist in the actual Note
export function doCompleteChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = completeItem(filename, content)
  logDebug('doCompleteChecklist', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE_FROM_JSON'], { updatedPara })
}

// Cancel the checklist in the actual Note
export function doCancelChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = cancelItem(filename, content)
  logDebug('doCancelChecklist', `-> ${String(updatedPara)}`)
  return handlerResult(Boolean(updatedPara), ['REMOVE_LINE_FROM_JSON'], { updatedPara })
}

/**
 * Updates content based on provided data.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
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

  return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: para })
}

// Send a request to toggleType to plugin
export function doToggleType(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedType = toggleTaskChecklistParaType(filename, content)
  logDebug('doToggleType', `-> ${updatedType}`)
  return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedType: updatedType })

  // logDebug('bCDI / toggleType', `-> new type '${String(res)}'`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'toggleType', data)
  // Only use if necessary:
  // Warnbug('bCDI', '------- refreshturned off at the moment ---------------')
  // await showDashboardReact('refresh')
}

// Send a request to unscheduleItem to plugin
export function doUnscheduleItem(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedPara = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedPara)}`)

  // logDebug('doUnscheduleItem', `  -> result ${String(res)}`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'unscheduleItem', data)
  return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: updatedPara })
}

// Send a request to cyclePriorityStateUp to plugin
export function doCyclePriorityStateUp(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)

  // Get para
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    const paraContent = para.content ?? 'error'
    // logDebug('doCyclePriorityStateUp', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    const newPriority = (getTaskPriority(paraContent) + 1) % 5
    const updatedContent = cyclePriorityStateUp(para)
    logDebug('doCyclePriorityStateUp', `cycling priority -> {${updatedContent}}`)

    // Ideally we would update the content in place, but so much of the logic for this is unhelpfully on the plugin side (HTMLGeneratorGrid::) it is simpler to ask for a refresh. = await showDashboardReact('refresh')
    // Note: But this doesn't work, because of race condition.
    // So we better try that logic after all.
    // const updatedData = {
    //   itemID: ID,
    //   newContent: updatedContent,
    //   newPriority: newPriority,
    // }
    // sendToHTMLWindow(windowId, 'cyclePriorityStateUp', updatedData)
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedContent: updatedContent })
  } else {
    logWarn('doCyclePriorityStateUp', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false)
  }
}

// Send a request to cyclePriorityStateDown to plugin
export function doCyclePriorityStateDown(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  // Get para
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    const paraContent = para.content ?? 'error'
    // logDebug('doCyclePriorityStateDown', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    const newPriority = (getTaskPriority(paraContent) - 1) % 5
    const updatedContent = cyclePriorityStateDown(para)
    logDebug('doCyclePriorityStateDown', `cycling priority -> {${updatedContent}}`)

    // Update the content in place
    // const updatedData = {
    //   itemID: ID,
    //   newContent: updatedContent,
    //   newPriority: newPriority,
    // }
    // sendToHTMLWindow(windowId, 'cyclePriorityStateDown', updatedData)
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedContent: updatedContent })
  } else {
    logWarn('doCyclePriorityStateDown', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false)
  }
}

// Mimic the /skip review command.
export async function doSetNextReviewDate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    const period = data.controlStr.replace('nr', '')
    logDebug('bCDI / setNextReviewDate', `-> will skip review by '${period}' for filename ${filename}.`)
    skipReviewForNote(note, period)
    // Now send a message for the dashboard to update its display
    // sendToHTMLWindow(windowId, 'removeItem', data)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'])
  } else {
    logWarn('bCDI / setNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
    return handlerResult(false)
  }
}

// Mimic the /finish review command.
export async function doReviewFinished(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    logDebug('bCDI / review', `-> reviewFinished on item ID ${data.item?.ID ?? '<no ID found>'} in filename ${filename}`)
    // update this to actually take a note to work on
    finishReviewForNote(note)
    logDebug('bCDI / review', `-> after finishReview`)
    // sendToHTMLWindow(windowId, 'removeItem', data)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'])
  } else {
    logWarn('bCDI / review', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
    return handlerResult(false)
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
export async function doShowNoteInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // Note: use the showLine... variant of this (below) where possible
  const note = await Editor.openNoteByFilename(filename)
  if (note) {
    logDebug('bridgeClickDashboardItem', `-> successful call to open filename ${filename} in Editor`)
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open filename ${filename} in Editor`)
    return handlerResult(false)
  }
}

// Handle a show note call simply by opening the note in the main Editor
export async function doShowNoteInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // Note: use the showLine... variant of this (below) where possible
  // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
  const wantedTitle = filename
  const note = await Editor.openNoteByTitle(wantedTitle)
  if (note) {
    logDebug('bridgeClickDashboardItem', `-> successful call to open title ${wantedTitle} in Editor`)
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title ${wantedTitle} in Editor`)
    return handlerResult(false)
  }
}

// Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line
export async function doShowLineInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  // logDebug('showLineInEditorFromFilename', `${filename} /  ${content}`)
  const note = await Editor.openNoteByFilename(filename)
  if (note) {
    const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
    logDebug(
      'bridgeClickDashboardItem',
      `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
    )
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open filename ${filename} in Editor`)
    return handlerResult(false)
  }
}

// Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line
export async function doShowLineInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
  const { filename, content } = validateAndFlattenMessageObject(data)
  const wantedTitle = decodeURIComponent(filename)
  const note = await Editor.openNoteByTitle(wantedTitle)
  if (note) {
    const res = highlightParagraphInEditor({ filename: note.filename, content: content }, true)
    logDebug(
      'bridgeClickDashboardItem',
      `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
    )
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title ${wantedTitle} in Editor`)
    return handlerResult(false)
  }
}

// Instruction to move task from a note to a project note.
// Note: Requires user input
// FIXME: Therefore probably makes sense to move this back to the plugin side.
// Note: Therefore this button is currently turned off
export async function doMoveToNote(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  logInfo('moveToNote', 'Note: doMoveToNote not yet fully implemented; stopping.')
  return handlerResult(false)

  // const itemType = data.itemType
  // logDebug('moveToNote', `starting with itemType: ${itemType}`)

  // // Start by getting settings from *Filer plugin*
  // // const config = await getFilerSettings() ?? { whereToAddInSection: 'start', allowNotePreambleBeforeHeading: true }

  // // const startDateStr = getDateStringFromCalendarFilename(filename, true)

  // // Ask user for destination project note
  // const allNotes = projectNotesSortedByChanged()

  // const res = await CommandBar.showOptions(
  //   allNotes.map((n) => n.title ?? 'untitled'),
  //   `Select note to move this ${itemType} to`,
  // )
  // const destNote = allNotes[res.index]

  // // Ask to which heading to add the selectedParas
  // // FIXME: this calls getRelativeDates(), which calls DataStore.
  // const headingToFind = await chooseHeading(destNote, true, true, false)
  // logDebug('moveToNote', `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

  // // Add text to the new location in destination note
  // // Use 'headingLevel' ("Heading level for new Headings") from the setting in QuickCapture if present (or default to 2)
  // const newHeadingLevel = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'headingLevel', 2)
  // logDebug('moveToNote', `newHeadingLevel: ${newHeadingLevel}`)
  // if (itemType === 'task') {
  //   addTaskToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
  // } else {
  //   addChecklistToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
  // }
  // // Ask for cache refresh for this note
  // DataStore.updateCache(destNote, false)

  // // delete from existing location
  // const origNote = getNoteByFilename(filename)
  // const origPara = findParaFromStringAndFilename(filename, content)
  // if (origNote && origPara) {
  //   logDebug('moveToNote', `- Removing 1 para from original note ${filename}`)
  //   origNote.removeParagraph(origPara)
  // } else {
  //   logWarn('moveToNote', `couldn't remove para {${content}} from original note ${filename} because note or paragraph couldn't be found`)
  // }
  // // Send a message to update the row in the dashboard
  // logDebug('moveToNote', `- Sending request to window to update`)
  // // sendToHTMLWindow(windowId, 'updatefilename', { itemID: ID, filename: destNote.filename })
  // return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: updatedPara })

  // // Ask for cache refresh for this note
  // DataStore.updateCache(origNote, false)
}

// Instruction from a 'moveButton' to move task from calendar note to a different calendar note.
export async function doMoveFromCalToCal(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // Note: Overloads ID with the dateInterval to use
  const { filename, content } = validateAndFlattenMessageObject(data)
  const config = await getSettings()
  const dateInterval = data.controlStr
  let startDateStr = ''
  let newDateStr = ''
  if (dateInterval !== 't' && !dateInterval.match(RE_DATE_INTERVAL)) {
    logError('moveFromCalToCal', `bad move date interval: ${dateInterval}`)
    return handlerResult(false)
  }
  if (dateInterval === 't') {
    // Special case to change to '>today'

    startDateStr = getDateStringFromCalendarFilename(filename, true)
    newDateStr = getTodaysDateHyphenated()
    logDebug('moveFromCalToCal', `move task from ${startDateStr} -> 'today'`)
  } else if (dateInterval.match(RE_DATE_INTERVAL)) {
    const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character

    // Get the (ISO) current date on the task
    startDateStr = getDateStringFromCalendarFilename(filename, true)
    newDateStr = calcOffsetDateStr(startDateStr, dateInterval, 'offset') // 'longer'

    // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week' but startDateStr is not of type 'week'
    if (offsetUnit === 'w' && !startDateStr.match(RE_NP_WEEK_SPEC)) {
      const offsetNum = Number(dateInterval.substr(0, dateInterval.length - 1)) // return all but last character
      const NPWeekData = getNPWeekData(startDateStr, offsetNum, 'week')
      if (NPWeekData) {
        newDateStr = NPWeekData.weekString
        logDebug('moveFromCalToCal', `- used NPWeekData instead -> ${newDateStr}`)
      } else {
        throw new Error(`Can't get NPWeekData for '${String(offsetNum)}w' when moving task from ${filename} (${startDateStr})`)
      }
    }
    logDebug('moveFromCalToCal', `move task from ${startDateStr} -> ${newDateStr}`)
  }
  // Do the actual move
  const res = await moveItemBetweenCalendarNotes(startDateStr, newDateStr, content, config.newTaskSectionHeading ?? '')
  if (res) {
    logDebug('moveFromCalToCal', `-> appeared to move item succesfully`)
    // Unfortunately we seem to have a race condition here, as the following doesn't remove the item
    // await showDashboardReact()
    // So instead send a message to delete the row in the dashboard
    // sendToHTMLWindow(windowId, 'removeItem', { itemID: ID })
    return handlerResult(true, ['REFRESH_ALL_CALENDAR_SECTIONS'])
  } else {
    logWarn('moveFromCalToCal', `-> moveFromCalToCal to ${newDateStr} not successful`)
    return handlerResult(false)
  }
}

// Instruction from a 'changeDateButton' to change date on a task (in a project note or calendar note)
export async function doUpdateTaskDate(data: MessageDataObject, dateString: string = ''): Promise<TBridgeClickHandlerResult> {
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const dateInterval = controlStr || ''
  const config = await getSettings()
  // const startDateStr = ''
  let newDateStr = dateString || ''
  if (dateInterval !== 't' && !dateString && !dateInterval.match(RE_DATE_INTERVAL)) {
    logError('doUpdateTaskDate', `bad move date interval: ${dateInterval}`)
    return handlerResult(false)
  }
  if (dateInterval === 't') {
    // Special case to change to '>today' (or the actual date equivalent)
    newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
    logDebug('doUpdateTaskDate', `move task in ${filename} -> 'today'`)
  } else if (dateInterval.match(RE_DATE_INTERVAL)) {
    const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character
    // Get today's date, ignoring current date on task. Note: this means we always start with a *day* base date, not week etc.
    const startDateStr = getTodaysDateHyphenated()
    // Get the new date, but output using the longer of the two types of dates given
    newDateStr = calcOffsetDateStr(startDateStr, dateInterval, 'longer')

    // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week'
    if (offsetUnit === 'w') {
      const offsetNum = Number(dateInterval.substr(0, dateInterval.length - 1)) // return all but last character
      // $FlowFixMe(incompatible-type)
      const NPWeekData: NotePlanWeekInfo = getNPWeekData(startDateStr, offsetNum, 'week')
      // clo(NPWeekData, "NPWeekData:")
      newDateStr = NPWeekData.weekString
      logDebug('doUpdateTaskDate', `- used NPWeekData instead -> ${newDateStr}`)
    }
    logDebug('doUpdateTaskDate', `change due date on task from ${startDateStr} -> ${newDateStr}`)
  }
  // Make the actual change
  const thePara = findParaFromStringAndFilename(filename, content)
  if (typeof thePara !== 'boolean') {
    const theLine = thePara.content
    const changedLine = replaceArrowDatesInString(thePara.content, `>${newDateStr}`)
    logDebug('doUpdateTaskDate', `Found line {${theLine}}\n-> changed line: {${changedLine}}`)
    thePara.content = changedLine
    const thisNote = thePara.note
    if (thisNote) {
      thisNote.updateParagraph(thePara)
      logDebug('doUpdateTaskDate', `- appeared to update line OK -> {${changedLine}}`)

      // Ask for cache refresh for this note
      DataStore.updateCache(thisNote, false)

      // refresh whole display, as we don't know which if any section the moved task might need to be added to
      logDebug('doUpdateTaskDate', `------------ refresh ------------`)
      return handlerResult(true, ['REFRESH_ALL_SECTIONS'])
      // await showDashboardReact()
    } else {
      logWarn('doUpdateTaskDate', `- can't find note to update to {${changedLine}}`)
      return handlerResult(false)
    }
  } else {
    logWarn('doUpdateTaskDate', `- some other failure`)
    return handlerResult(false)
  }
}

export function doSettingsChanged(data: MessageDataObject,settingName:string): TBridgeClickHandlerResult {
  const settings = DataStore.settings
  const newSettings = data.settings
  if (!settings || !newSettings) {
    throw new Error(`Error validating data: newSettings: ${JSP(newSettings)} or settings is null or undefined.`)
  }
  DataStore.settings = { ...DataStore.settings, [settingName]: newSettings }
  logDebug('doSettingsChanged', `${settingName} updated`)
  return handlerResult(true, [])
}

export async function doSetSpecificDate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { dateString } = validateAndFlattenMessageObject(data)
  return await doUpdateTaskDate(data, dateString)
}
