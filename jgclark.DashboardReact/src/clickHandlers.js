// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for dashboard clicks that come over the bridge
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 27.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { finishReviewForNote, skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import { getCombinedSettings, moveItemToRegularNote } from './dashboardHelpers'
import { allCalendarSectionCodes, allSectionCodes } from "./constants"
import {
  getAllSectionsData, getSomeSectionsData
} from './dataGeneration'
import {
  type TBridgeClickHandlerResult, type TActionOnReturn, type MessageDataObject, type TSection, type TSectionItem,
  type TPluginData,
} from './types'
import { validateAndFlattenMessageObject } from './shared'
import {
  calcOffsetDateStr, getDateStringFromCalendarFilename, getTodaysDateHyphenated, RE_DATE_INTERVAL,
  replaceArrowDatesInString
} from '@helpers/dateTime'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  sendToHTMLWindow, getGlobalSharedData,
} from '@helpers/HTMLView'
import {
  cancelItem,
  completeItem,
  completeItemEarlier,
  findParaFromStringAndFilename,
  highlightParagraphInEditor,
  // toggleTaskChecklistParaType,
  unscheduleItem,
} from '@helpers/NPParagraph'
import {
  cyclePriorityStateDown, cyclePriorityStateUp,
  // getTaskPriority
} from '@helpers/paragraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
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

const windowCustomId = `${pluginJson['plugin.id']}.main`
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
export function handlerResult(success: boolean, actionsOnSuccess?: Array<TActionOnReturn> = [], otherSettings?: any = {}): TBridgeClickHandlerResult {
  return {
    ...otherSettings,
    success,
    actionsOnSuccess,
  }
}
/**
 * Convenience function to update the global shared data in the webview window, telling React to update it
 * @param {TAnyObject} changeObject - the fields inside pluginData to update
 * @param {string} changeMessage 
 * @usage await setPluginData({ refreshing: false, lastFullRefresh: new Date() }, 'Finished Refreshing all sections')
 */
export async function setPluginData(changeObject: TAnyObject, changeMessage:string = ""): Promise<void> {
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  reactWindowData.pluginData = { ...reactWindowData.pluginData, ...changeObject }
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, changeMessage)
}

/**
 * Merge existing sections data with replacement data
 * If the section existed before, it will be replaced with the new data
 * If the section did not exist before, it will be added to the end of sections
 * @param {Array<TSection>} existingSections 
 * @param {Array<TSection>} newSections 
 * @returns {Array<TSection>} - merged sections
 */
function mergeSections(existingSections: Array<TSection>, newSections: Array<TSection>): Array<TSection> {
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
 * Tell the React window to update by re-generating all Sections
 */
export async function refreshAllSections(): Promise<void> {
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  // show refreshing message until done
  await setPluginData({ refreshing: true }, 'Starting Refreshing all sections')
  const newSections = await getAllSectionsData(reactWindowData.demoMode, false, false)
  const changedData = { refreshing: false, sections: newSections, lastFullRefresh: new Date() }
  await setPluginData(changedData, 'Finished Refreshing all sections')
}

/**
 * Loop through sectionCodes and tell the React window to update by re-generating a subset of Sections.
 * This is used on first launch to improve the UX and speed of first render.
 * Each section is returned to React as it's generated.
 * Today loads first and then this function is automatically called from a useEffect in 
 * Dashboard.jsx to load the rest.
 * @param {MessageDataObject} data 
 * @param {boolean} calledByTrigger? (default: false)
 * @returns {TBridgeClickHandlerResult}
 */
export async function incrementallyRefreshSections(data: MessageDataObject, calledByTrigger: boolean = false): Promise<TBridgeClickHandlerResult> {
  const { sectionCodes } = data
  if (!sectionCodes) {
    logError('incrementallyRefreshSections', 'No sectionCodes provided')
    return handlerResult(false)
  }
  // loop through sectionCodes
  await setPluginData({ refreshing: true }, `Starting incremental refresh for sections ${String(sectionCodes)}`)
  for (const sectionCode of sectionCodes) {
    const start = new Date()
    await refreshSomeSections({ ...data, sectionCodes: [sectionCode] }, calledByTrigger)
    logDebug(`clickHandlers`, `incrementallyRefreshSections getting ${sectionCode}) took ${timer(start)}`)
  }
  await setPluginData({ refreshing: false }, `Ending incremental refresh for sections ${String(sectionCodes)}`)
  return handlerResult(true)
}

/**
 * Tell the React window to update by re-generating a subset of Sections.
 * Returns them all in one shot vs incrementallyRefreshSections which updates one at a time.
 * @param {MessageDataObject} data 
 * @param {boolean} calledByTrigger? (default: false)
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSomeSections(data: MessageDataObject, calledByTrigger: boolean = false): Promise<TBridgeClickHandlerResult> {
  const start = new Date()
  const { sectionCodes } = data
  if (!sectionCodes) {
    logError('refreshSomeSections', 'No sectionCodes provided')
    return handlerResult(false)
  }
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const pluginData: TPluginData = reactWindowData.pluginData
  // show refreshing message until done
  if (!pluginData.refreshing === true) await setPluginData({ refreshing: sectionCodes }, `Starting refresh for sections ${String(sectionCodes)}`)
  const existingSections = pluginData.sections

  // force the section refresh for the wanted sections
  const newSections = await getSomeSectionsData(sectionCodes, pluginData.demoMode, false, calledByTrigger)
  const mergedSections = mergeSections(existingSections, newSections)
  // pluginData.lastFullRefresh = new Date()
  const updates:TAnyObject = { sections: mergedSections }
  if (!pluginData.refreshing === true) updates.refreshing = false
  await setPluginData(updates, `Finished refresh for sections ${String(sectionCodes)}`)
  logDebug(`refreshSomeSections ${sectionCodes.toString()} took ${timer(start)}`)
  return handlerResult(true)
}

/**
 * Prepend an open task to 'calNoteFilename' calendar note, using text we prompt the user for
 * @param {MessageDataObject} {actionType: addTask|addChecklist etc., toFilename:xxxxx}
 */
export async function doAddItem(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const config = await getCombinedSettings()
    const { actionType, toFilename } = data
    logDebug('doAddItem', `- actionType: ${actionType} to ${toFilename || ''}`)
    if (!toFilename) {
      throw new Error('doAddItem: No toFilename provided')
    }
    const todoType = (actionType === 'addTask') ? 'task' : 'checklist'

    const calNoteDateStr = getDateStringFromCalendarFilename(toFilename, true)
    // logDebug('addTask', `= date ${calNoteDateStr}`)
    if (!calNoteDateStr) {
      throw new Error(`calNoteDateStr isn't defined for ${toFilename}`)
    }

    const content = await CommandBar.showInput(`Type the ${todoType} text to add`, `Add ${todoType} '%@' to ${calNoteDateStr}`)

    // Add text to the new location in destination note
    // Use 'headingLevel' ("Heading level for new Headings") from the setting in QuickCapture if present (or default to 2)
    const newHeadingLevel = config.headingLevel
    const headingToUse = config.newTaskSectionHeading
    // logDebug('doAddItem', `newHeadingLevel: ${newHeadingLevel}`)

    // await prependTodoToCalendarNote('task', calNoteDateStr)
    if (actionType === 'addTask') {
      addTaskToNoteHeading(calNoteDateStr, headingToUse, content, newHeadingLevel)
    } else {
      addChecklistToNoteHeading(calNoteDateStr, headingToUse, content, newHeadingLevel)
    }
    // TODO: updateCache?

    // trigger refresh
    // TODO: pass in just the section we've added to
    const res = await refreshSomeSections({ actionType: actionType, sectionCodes: allCalendarSectionCodes })
    return res
  }
  catch (err) {
    logError('doAddItem', err.message)
    return { success: false }
  }
}

// Complete the task in the actual Note
export function doCompleteTask(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItem(filename, content)
  // clo(updatedParagraph, `doCompleteTask -> updatedParagraph`) // ✅

  if (typeof updatedParagraph !== "boolean") {
    logDebug('doCompleteTask', `-> {${updatedParagraph.content
      }}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
  } else {
    logDebug('doCompleteTask', `-> failed`)
    return handlerResult(false)
  }
}

// Complete the task in the actual Note, but with the date it was scheduled for
export function doCompleteTaskThen(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItemEarlier(filename, content)
  if (typeof updatedParagraph !== "boolean") {
    logDebug('doCompleteTaskThen', `-> {${updatedParagraph.content
      }}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
  } else {
    logDebug('doCompleteTaskThen', `-> failed`)
    return handlerResult(false)
  }
}

// Cancel the task in the actual Note
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
  logDebug('doCancelTask', `-> ${String(res)}`)
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
}

// Complete the checklist in the actual Note
export function doCompleteChecklist(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = completeItem(filename, content)
  // clo(updatedParagraph, `doCompleteChecklist -> updatedParagraph`) // ✅
  // clo(updatedParagraph.note.filename, `doCompleteChecklist -> updatedParagraph.note.filename`)// ✅
  return handlerResult(Boolean(updatedParagraph), ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
}

// Cancel the checklist in the actual Note
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
  logDebug('doCancelChecklist', `-> ${String(res)}`)
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
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
  try {
    const { filename, content } = validateAndFlattenMessageObject(data)

    // V1: original from v0.x
    // const updatedType = toggleTaskChecklistParaType(filename, content)

    // V2: move most of toggleTaskChecklistParaType() into here, as we need access to the full para
    // find para
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(filename, content)
    if (typeof possiblePara === 'boolean') {
      throw new Error('toggleTaskChecklistParaType: no para found')
    }
    // logDebug('toggleTaskChecklistParaType', `toggling type for {${content}} in filename: ${filename}`)
    // Get the paragraph to change
    const updatedParagraph = possiblePara
    const thisNote = updatedParagraph.note
    if (!thisNote) throw new Error(`Could not get note for filename ${filename}`)
    const existingType = updatedParagraph.type
    logDebug('toggleTaskChecklistParaType', `toggling type from ${existingType} in filename: ${filename}`)
    const updatedType = (existingType === 'checklist') ? 'open' : 'checklist'
    updatedParagraph.type = updatedType
    logDebug('doToggleType', `-> ${updatedType}`)
    thisNote.updateParagraph(updatedParagraph)
    DataStore.updateCache(thisNote, false)
    // TODO(later): better to refresh the whole section, as we might want to filter out the new type from the display
    // FIXME: this still isn't updating the window correctly?
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: updatedParagraph })

  } catch (error) {
    logError('doToggleType', error.message)
    return handlerResult(false)
  }
}

// Send a request to unscheduleItem to plugin
export function doUnscheduleItem(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedParagraph)}`)

  // logDebug('doUnscheduleItem', `  -> result ${String(res)}`)
  // Update display in Dashboard too
  // sendToHTMLWindow(windowId, 'unscheduleItem', data)
  return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: updatedParagraph })
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
    return handlerResult(false)
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
    return handlerResult(false)
  }
}

// Mimic the /skip review command.
export async function doSetNextReviewDate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    if (!data.controlStr) throw 'No controlStr: stopping'
    const period = data.controlStr.replace('nr', '')
    logDebug('doSetNextReviewDate', `-> will skip review by '${period}' for filename ${filename}.`)
    skipReviewForNote(note, period)

    // Now remove the line from the display
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'])
  } else {
    logWarn('doSetNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
    return handlerResult(false)
  }
}

// Mimic the /finish review command.
export async function doReviewFinished(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  const note = await DataStore.projectNoteByFilename(filename)
  if (note) {
    logDebug('doReviewFinished', `-> reviewFinished on item ID ${data.item?.ID ?? '<no ID found>'} in filename ${filename}`)
    // update this to actually take a note to work on
    finishReviewForNote(note)
    logDebug('doReviewFinished', `-> after finishReview`)

    // Now ask to update this line in the display
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'])
  } else {
    logWarn('doReviewFinished', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
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
// TODO: is this still needed?
export async function doShowLineInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
  const { title, filename, content } = validateAndFlattenMessageObject(data)
  const note = await Editor.openNoteByTitle(title)
  if (note) {
    const res = highlightParagraphInEditor({ filename: note.filename, content: content }, true)
    logDebug(
      'bridgeClickDashboardItem',
      `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
    )
    return handlerResult(true)
  } else {
    logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title '${title}' in Editor`)
    return handlerResult(false)
  }
}

// Instruction to move task from a note to a project note.
// Note: Requires user input, so most of the work is done in moveItemToRegularNote() on plugin side.
export async function doMoveToNote(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, itemType } = validateAndFlattenMessageObject(data)

  const newFilenameOrEmpty: string = await moveItemToRegularNote(filename, content, itemType)
  if (newFilenameOrEmpty !== '') {
    logDebug('doMoveToNote', `Success: moved -> ${newFilenameOrEmpty}`)
    if (data.item?.para) {
      data.item.para.filename = newFilenameOrEmpty
  // Send a message to update the row in the dashboard
      logDebug('doMoveToNote', `- Sending update line request`)
      // FIXME: following is probably correct, but isn't handled fully yet in handlerResult
      return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: data.item?.para })
    } else {
      logWarn('doMoveToNote', `Couldn't update the para with the new filename. Resorting to refreshing all sections ☹️`)
      return handlerResult(true, ['REFRESH_ALL_SECTIONS'], { sectionCodes: [] })
    }
  } else {
    return handlerResult(false)
  }
}

// Instruction from a 'changeDateButton' to change date on a task (in a project note or calendar note)
export async function doUpdateTaskDate(data: MessageDataObject, dateString: string = ''): Promise<TBridgeClickHandlerResult> {
  const { filename, content, controlStr } = validateAndFlattenMessageObject(data)
  const dateInterval = controlStr || ''
  const config = await getCombinedSettings()
  logDebug('doUpdateTaskDate', `filename: ${filename}, content: ${content}, dateInterval: ${dateInterval}`)
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
    // FIXME: this is only resched not moving. doMoveBetweenCalendar. rescheduleNotMove setting.
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
      return handlerResult(true, ['REMOVE_LINE_FROM_JSON','REFRESH_ALL_SECTIONS'])
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

export function doSettingsChanged(data: MessageDataObject, settingName: string): TBridgeClickHandlerResult {
  const newSettings = data.settings
  if (!DataStore.settings || !newSettings) {
    throw new Error(`doSettingsChanged newSettings: ${JSP(newSettings)} or settings is null or undefined.`)
  }
  DataStore.settings = { ...DataStore.settings, [settingName]: newSettings }
  logDebug('doSettingsChanged', `${settingName} updated`)
  return handlerResult(true, [])
}

export async function doSetSpecificDate(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { dateString } = validateAndFlattenMessageObject(data)
  return await doUpdateTaskDate(data, dateString)
}
