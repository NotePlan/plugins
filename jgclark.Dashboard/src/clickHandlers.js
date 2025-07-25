// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for some dashboard clicks that come over the bridge.
// There are 4+ other clickHandler files now.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2025-07-11 for v2.3.0.b, @jgclark
//-----------------------------------------------------------------------------
import moment from 'moment/min/moment-with-locales'
// import pluginJson from '../plugin.json'
import { getDashboardSettings, getDashboardSettingsDefaults, handlerResult, makeDashboardParas, setPluginData } from './dashboardHelpers'
import { setDashPerspectiveSettings } from './perspectiveClickHandlers'
import { getActivePerspectiveDef, getPerspectiveSettings, cleanDashboardSettingsInAPerspective } from './perspectiveHelpers'
import { validateAndFlattenMessageObject } from './shared'
import type { MessageDataObject, TBridgeClickHandlerResult, TDashboardSettings } from './types'
import { getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer, compareObjects } from '@helpers/dev'
import { coreAddChecklistToNoteHeading, coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import { getSettings, saveSettings } from '@helpers/NPConfiguration'
import { openNoteByFilename } from '@helpers/NPnote'
import { cancelItem, completeItem, completeItemEarlier, deleteItem, findParaFromStringAndFilename, highlightParagraphInEditor } from '@helpers/NPParagraph'
import { unscheduleItem } from '@helpers/NPScheduleItems'
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

    // We should have the text to add already, but if not, prompt the user for it
    const content = text ?? (await CommandBar.showInput(`Type the ${todoType} text to add`, `Add ${todoType} '%@' to ${calNoteDateStr}`))
    const destNote = DataStore.noteByFilename(toFilename, 'Calendar')
    if (!destNote) throw new Error(`doAddItem: No note found for ${toFilename}`)

    // Add text to the new location in destination note
    const newHeadingLevel = config.newTaskSectionHeadingLevel
    const headingToUse = heading ? await processChosenHeading(destNote, newHeadingLevel, heading || '') : config.newTaskSectionHeading

    if (actionType === 'addTask') {
      coreAddTaskToNoteHeading(destNote, headingToUse, content, newHeadingLevel, true)
    } else {
      coreAddChecklistToNoteHeading(destNote, headingToUse, content, newHeadingLevel, true)
    }
    // Note: updateCache is now done in previous function call

    // update just the section we've added to
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: sectionCodes })
  } catch (err) {
    logError('doAddItem', err.message)
    return handlerResult(false, [], { errorMsg: err.message })
  }
}

/**
 * Add a new item anywhere, using the /quickAddTaskUnderHeading command from Quick Capture plugin.
 * Note: this uses the Quick Capture plugin's command, as it was available.
 * Ideally it would use a DynamicDialog instead, as that's more flexible and looks nicer, but we don't necessarily have a dropbdown-select component that can scale to 1,000s of items.
 * Calls the doAddItem logic, once new filename is worked out.
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
 * Add a new item to a future date, using the date and text provided.
 * Calls the doAddItem logic, once new filename is worked out.
 * @param {MessageDataObject} {date: .data.data.data, text: .data.data.}
 * @returns {TBridgeClickHandlerResult} result to be used by click result handler
 */
export async function doAddItemToFuture(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  clo(data, `doAddItemToFuture starting with data`)
  const { userInputObj } = data // "date": "2024-12-04T08:00:00.000Z",
  if (!userInputObj) return handlerResult(false)
  const { date, text } = userInputObj
  if (!text) return handlerResult(false, [], { errorMsg: `No text was provided to addItemToFuture` })
  if (!date) return handlerResult(false, [], { errorMsg: `No date was provided to addItemToFuture` })
  const extension = DataStore.defaultFileExtension
  const filename = `${moment(date).format(`YYYYMMDD`)}.${extension}`
  data.toFilename = filename
  data.actionType = 'addTask'
  return await doAddItem(data)
}

/**
 * Complete the task in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteTask(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const completedParagraph = await completeItem(filename, content)
  // clo(completedParagraph, `doCompleteTask -> completedParagraph`)

  if (typeof completedParagraph !== 'boolean') {
    logDebug('doCompleteTask', `-> {${completedParagraph.content}}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON', 'INCREMENT_DONE_COUNT'], { updatedParagraph: completedParagraph })
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
export async function doCompleteTaskThen(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = await completeItemEarlier(filename, content)
  if (typeof updatedParagraph !== 'boolean') {
    logDebug('doCompleteTaskThen', `-> {${updatedParagraph.content}}`)
    return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
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
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
}

/**
 * Complete the checklist in the actual Note.
 * @param {MessageDataObject} data - The data object containing information for content update.
 * @returns {TBridgeClickHandlerResult} The result of the content update operation.
 */
export async function doCompleteChecklist(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content } = validateAndFlattenMessageObject(data)
  const updatedParagraph = await completeItem(filename, content)
  // clo(updatedParagraph, `doCompleteChecklist -> updatedParagraph`)
  // clo(updatedParagraph.note.filename, `doCompleteChecklist -> updatedParagraph.note.filename`)
  return handlerResult(Boolean(updatedParagraph), ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
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
  return handlerResult(true, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
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
  return handlerResult(res, ['REMOVE_LINE_FROM_JSON'], { updatedParagraph })
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

  return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
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
    return handlerResult(true, ['REFRESH_SECTION_IN_JSON'], { updatedParagraph: updatedParagraph, sectionCodes: sectionCodes })
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
  const { filename, content, sectionCodes } = validateAndFlattenMessageObject(data)
  const updatedContent = unscheduleItem(filename, content)
  logDebug('doUnscheduleItem', `-> ${String(updatedContent)}`)

  // find the updated para
  const updatedParagraph: TParagraph | boolean = findParaFromStringAndFilename(filename, updatedContent)
  if (typeof updatedParagraph === 'boolean') {
    logError(`doUnscheduleItem`, `couldn't find para for filename ${filename} and content ${updatedContent}. Will update current section ${sectionCodes}`)

    return handlerResult(false, ['REFRESH_SECTION_IN_JSON'], { sectionCodes: sectionCodes })
  } else {
    logDebug('doUnscheduleItem', `- found updated paragraph, and will update display of the item and section ${sectionCodes}`)
    // Now ask to update this line in the display
    // sendToHTMLWindow(windowId, 'unscheduleItem', data)
    return handlerResult(true, ['UPDATE_LINE_IN_JSON', 'REFRESH_SECTION_IN_JSON'], { updatedParagraph: makeDashboardParas([updatedParagraph])[0], sectionCodes: sectionCodes })
  }
}

// Send a request to cyclePriorityStateUp to plugin
export function doCyclePriorityStateUp(data: MessageDataObject): TBridgeClickHandlerResult {
  const { filename, content } = validateAndFlattenMessageObject(data)

  // Get full TParagraph to work on
  const para = findParaFromStringAndFilename(filename, content)
  if (para && typeof para !== 'boolean') {
    // logDebug('doCyclePriorityStateUp', `will cycle priority on para {${paraContent}}`)
    // Note: next 2 lines have to be this way around, otherwise a race condition
    // const newPriority = (getTaskPriority(paraContent) + 1) % 5
    const updatedContent = cyclePriorityStateUp(para)
    para.content = updatedContent
    logDebug('doCyclePriorityStateUp', `cycling priority -> {${JSP(updatedContent)}}`)

    // Now ask to update this line in the display
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
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
    return handlerResult(true, ['UPDATE_LINE_IN_JSON'], { updatedParagraph: makeDashboardParas([para])[0] })
  } else {
    logWarn('doCyclePriorityStateDown', `-> unable to find para {${content}} in filename ${filename}`)
    return handlerResult(false, [], { errorMsg: `unable to find para "${content}" in filename: "${filename}"` })
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
    }
    return handlerResult(rect ? true : false)
  }
  return handlerResult(false)
}

// Handle a show note call simply by opening the note in the main Editor.
// Note: use the showLine... variant of this (below) where possible
export async function doShowNoteInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, modifierKey } = data
  if (!filename) throw 'doShowNoteInEditorFromFilename: No filename: stopping'
  const note = await openNoteByFilename(filename, { newWindow: modifierKey === 'meta', splitView: modifierKey === 'alt' })
  Editor.focus()
  return handlerResult(note ? true : false)
}

// Handle a show note call simply by opening the note in the main Editor
// Note: use the showLine... variant of this (below) where possible
export async function doShowNoteInEditorFromTitle(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename } = validateAndFlattenMessageObject(data)
  // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
  const wantedTitle = filename
  // TODO(@EduardMe): this might not work for Teamspace notes
  const note = await Editor.openNoteByTitle(wantedTitle)
  if (note) {
    Editor.focus()
    logDebug('doShowNoteInEditorFromTitle', `-> successful call to open title ${wantedTitle} in Editor`)
    return handlerResult(true)
  } else {
    logWarn('doShowNoteInEditorFromTitle', `-> failed to open title ${wantedTitle} in Editor`)
    return handlerResult(false)
  }
}

/**
 * Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line.
 * If ⌘ (command) key is clicked, then open in a new floating window.
 * If option key is clicked, then open in a new split view.
 * Note: Handles Teamspace notes from b1375 (v3.17.0).
 * @param {MessageDataObject} data with details of item
 * @returns {TBridgeClickHandlerResult} how to handle this result
 */
export async function doShowLineInEditorFromFilename(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  const { filename, content, modifierKey } = validateAndFlattenMessageObject(data)
  const note = await Editor.openNoteByFilename(filename, modifierKey === 'meta', 0, 0, modifierKey === 'alt')
  if (note) {
    const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
    logDebug(
      'doShowLineInEditorFromFilename',
      `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
    )
    return handlerResult(true)
  } else {
    logWarn('doShowLineInEditorFromFilename', `-> failed to open filename ${filename} in Editor.`)
    return handlerResult(false)
  }
}

/**
 * Update a single key in Dashboard part of DataStore.settings.
 * Note: See doPerspectiveSettingsChanged() for updating perspectiveSettings.
 * @param {MessageDataObject} data - a MDO that should have a key "settings" with the items to be set to the settingName key
 * @param {string} settingName - the single key to set to the value of data.settings
 * @returns {TBridgeClickHandlerResult}
 * @author @dwertheimer
 */
export async function doDashboardSettingsChanged(data: MessageDataObject, settingName: string): Promise<TBridgeClickHandlerResult> {
  clo(data, `doDashboardSettingsChanged() starting with data = `)
  // $FlowFixMe[incompatible-type]
  const newSettings: Partial<TDashboardSettings> = data.settings
  if (!DataStore.settings || !newSettings) {
    return handlerResult(false, [], { errorMsg: `doDashboardSettingsChanged: newSettings is null or undefined.` })
  }
  // If we are saving the dashboardSettings, and the perspectiveSettings are not being sent, then we need to save the active perspective settings
  let perspectivesToSave = settingName === 'dashboardSettings' ? data.perspectiveSettings : Array.isArray(newSettings) ? newSettings : []
  if (settingName === 'dashboardSettings' && !data.perspectiveSettings) {
    let needToSetDash = false
    const perspectiveSettings = await getPerspectiveSettings()
    if (newSettings.usePerspectives) {
      // All changes to dashboardSettings should be saved in the "-" perspective (changes to perspectives are not saved until Save... is selected)
      const activePerspDef = getActivePerspectiveDef(perspectiveSettings)
      logDebug(`doDashboardSettingsChanged`, `activePerspDef.name=${String(activePerspDef?.name || '')} Array.isArray(newSettings)=${String(Array.isArray(newSettings))}`)
      if (activePerspDef && activePerspDef.name !== '-' && !Array.isArray(newSettings)) {
        // Clean up the settings before then comparing them with the active perspective settings
        const dashboardSettingsDefaults = getDashboardSettingsDefaults()
        const newSettingsWithDefaults = { ...dashboardSettingsDefaults, ...newSettings }
        const activePerspDefDashboardSettingsWithDefaults = { ...dashboardSettingsDefaults, ...activePerspDef.dashboardSettings }
        // $FlowIgnore[prop-missing]
        // $FlowIgnore[incompatible-call]
        const cleanedSettings = cleanDashboardSettingsInAPerspective(newSettingsWithDefaults)
        const diff = compareObjects(activePerspDefDashboardSettingsWithDefaults, cleanedSettings, ['lastModified', 'lastChange', 'usePerspectives'])
        clo(diff, `doDashboardSettingsChanged: diff`)
        // if !diff or  all the diff keys start with FFlag, then return
        if (!diff || Object.keys(diff).length === 0) return handlerResult(true)
        if (Object.keys(diff).every((d) => d.startsWith('FFlag'))) {
          logDebug(`doDashboardSettingsChanged`, `Was just a FFlag change. Saving dashboardSettings to DataStore.settings`)
          const res = await saveSettings(pluginID, { ...(await getSettings('jgclark.Dashboard')), dashboardSettings: JSON.stringify(newSettings) })
          return handlerResult(res)
        } else {
          clo(diff, `doDashboardSettingsChanged: Setting perspective.isModified because of changes to settings: ${Object.keys(diff).length} keys: ${Object.keys(diff).join(', ')}`)
        }
        // ignore dashboard changes in the perspective definition until it is saved explicitly
        // but we need to set the isModified flag on the perspective
        logDebug(`doDashboardSettingsChanged`, `Setting isModified to true for perspective ${activePerspDef.name}`)
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
        logError(`doDashboardSettingsChanged`, `newSettings is not an object: ${JSP(newSettings)}`)
      }
    }
  }

  const combinedUpdatedSettings = { ...(await getSettings('jgclark.Dashboard')), [settingName]: JSON.stringify(newSettings) }

  if (perspectivesToSave) {
    const debugInfo = perspectivesToSave
      .map((ps) => `${ps.name} excludedFolders=[${String(ps.dashboardSettings?.excludedFolders) ?? ''} ${ps.isModified ? 'modified' : ''} ${ps.isActive ? '<active>' : ''}`)
      .join(`\n\t`)
    logDebug(`doDashboardSettingsChanged`, `Saving perspectiveSettings also\n\t${debugInfo}`)

    combinedUpdatedSettings.perspectiveSettings = JSON.stringify(perspectivesToSave)
  }

  const res = await saveSettings(pluginID, combinedUpdatedSettings)
  const updatedPluginData = { [settingName]: newSettings } // was also: pushFromServer: { [settingName]: true }
  if (perspectivesToSave) {
    // $FlowFixMe(incompatible-type)
    updatedPluginData.perspectiveSettings = perspectivesToSave
  }
  await setPluginData(updatedPluginData, `_Updated ${settingName} in global pluginData`)
  const refreshes = settingName === 'dashboardSettings' ? ['REFRESH_ALL_ENABLED_SECTIONS'] : [] // don't refresh if we were saving just perspectiveSettings
  return handlerResult(res, refreshes)
}

export async function doCommsBridgeTest(_data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  // send a banner message by failing the handler
  return await handlerResult(false, [], { errorMsg: `Success: This was sent from the plugin. Round trip works 5x5.` })
}
