// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Dashboard plugin
// Last updated 4.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'

// import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
// import { finishReviewForNote, skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import {
  doCancelChecklist,
  doCancelTask,
  doContentUpdate,
  doCompleteTask,
  doCompleteTaskThen,
  doCompleteChecklist,
  doCyclePriorityStateDown,
  doCyclePriorityStateUp,
  doToggleType,
  doUnscheduleItem,
  doSetNextReviewDate,
  doReviewFinished,
  doShowNoteInEditorFromFilename,
  doShowNoteInEditorFromTitle,
  doShowLineInEditorFromFilename,
  doShowLineInEditorFromTitle,
  doMoveToNote,
  doMoveFromCalToCal,
  doUpdateTaskDate,
  refreshAllSections,
  refreshSomeSections,
  doReactSettingsChanged,
  doSetSpecificDate,
} from './clickHandlers'
// import { getSettings, moveItemBetweenCalendarNotes } from './dashboardHelpers'
// import { showDashboardReact } from './reactMain'
import { copyUpdatedSectionItemData, findSectionItems, getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import type { TActionType, TActionOnReturn, TBridgeClickHandlerResult, MessageDataObject } from './types'
import { getSettingFromAnotherPlugin } from '@helpers/NPConfiguration'
import { calcOffsetDateStr, getDateStringFromCalendarFilename, getTodaysDateHyphenated, RE_DATE_INTERVAL, RE_NP_WEEK_SPEC, replaceArrowDatesInString } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { sendToHTMLWindow, getGlobalSharedData, updateGlobalSharedData } from '@helpers/HTMLView'
import { projectNotesSortedByChanged, getNoteByFilename } from '@helpers/note'
import { cyclePriorityStateDown, cyclePriorityStateUp, getTaskPriority } from '@helpers/paragraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import { cancelItem, findParaFromStringAndFilename, highlightParagraphInEditor, toggleTaskChecklistParaType, unscheduleItem } from '@helpers/NPParagraph'
import { getLiveWindowRectFromWin, getWindowFromCustomId, logWindowsList, storeWindowRect } from '@helpers/NPWindows'
// import { decodeRFC3986URIComponent } from '@helpers/stringTransforms'

//-----------------------------------------------------------------
// Data types + constants

type SettingDataObject = { settingName: string, state: string }

const windowCustomId = `${pluginJson['plugin.id']} React Window` // TODO(later): update me
const WEBVIEW_WINDOW_ID = windowCustomId

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
// export async function onMessageFromHTMLView(actionType: string, data: any): any {
//   try {
//     logDebug(pluginJson, `onMessageFromHTMLView dispatching data to ${actionType}:`)
//     // clo(data, 'onMessageFromHTMLView dispatching data object:')

//     if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }

//     switch (actionType) {
//       case 'onClickDashboardItem':
//         await bridgeClickDashboardItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
//         break
//       case 'onChangeCheckbox':
//         await bridgeChangeCheckbox(data) // data is a string
//         break
//       case 'refresh':
//         logWarn('onMessageFromHTMLView', `'refresh' is currently turned off in onMessageFromHTMLView to avoid circular dependency`)
//         // await showDashboardReact() // no await needed, I think
//         break
//       case 'runPluginCommand':
//         await runPluginCommand(data) // no await needed, I think
//         break
//       default:
//         logError(pluginJson, `onMessageFromHTMLView(): unknown ${actionType} cannot be dispatched`)
//         break
//     }

//     // TEST: New things for React copied from @DW version
//     const reactWindowData = await refreshDashboardData()
//     if (reactWindowData) {
//       const updateText = `After ${actionType}, data was updated` /* this is just a string for debugging so you know what changed in the React Window */
//       clo(reactWindowData, `Plugin onMessageFromHTMLView after updating window data,reactWindowData=`)
//       sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
//     }

//     return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
//   } catch (error) {
//     logError(pluginJson, JSP(error))
//   }
// }

/**
 * HTML View requests running a plugin command
 * @param {any} data object TODO: Type me
 */
export async function runPluginCommand(data: any) {
  try {
    // clo(data, 'runPluginCommand received data object')
    logDebug('pluginToHTMLBridge/runPluginCommand', `running ${data.commandName} in ${data.pluginID}`)
    await DataStore.invokePluginCommandByName(data.commandName, data.pluginID, data.commandArgs)
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
    // clo(data, 'bridgeChangeCheckbox received data object')
    const { settingName, state } = data
    logDebug('pluginToHTMLBridge/bridgeChangeCheckbox', `- settingName: ${settingName}, state: ${state}`)
    DataStore.setPreference('Dashboard-filterPriorityItems', state)
    // having changed this pref, refresh the dashboard
    // await showDashboardReact()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a something in the HTML view
 * NOTE: processActionOnReturn will be called for each item after the CASES based on TBridgeClickHandlerResult
 * @param {MessageDataObject} data - details of the item clicked
 */
export async function bridgeClickDashboardItem(data: MessageDataObject) {
  try {
    // const windowId = getWindowIdFromCustomId(windowCustomId);
    // const windowId = windowCustomId // note that this is not used and should be deleted
    // if (!windowId) {
    //   logError('bridgeClickDashboardItem', `Can't find windowId for ${windowCustomId}`)
    //   return
    // }

    // const ID = data.item?.ID ?? '<no ID found>'
    const actionType: TActionType = data.actionType
    // const filename = data.item?.para?.filename ?? '<no filename found>'
    let content = data.item?.para?.content ?? '<no content found>'
    const updatedContent = data.updatedContent ?? ''
    let result: TBridgeClickHandlerResult = { success: false } // use this for each call and return a TBridgeClickHandlerResult object

    logDebug('', `------------------- bridgeClickDashboardItem: ${actionType} -------------------`)
    logDebug(
      'bridgeClickDashboardItem',
      `item ID: ${data.item?.ID ?? '<no ID found>'}, actionType: ${actionType}, filename: ${data.item?.para?.filename ?? '<no filename found>'}, content: ${
        data.item?.para?.content ?? '<no content found>'
      }`,
    )
    // if (!actionType === 'refresh' && (!content || !filename)) throw new Error('No content or filename provided for refresh')
    // clo(data, 'bridgeClickDashboardItem received data object')

    // TODO: move this to a function
    // Allow for a combination of button click and a content update
    if (updatedContent && data.actionType !== 'updateItemContent') {
      logDebug('bCDI', `content updated with another button press; need to update content first; new content: "${updatedContent}"`)
      // $FlowIgnore[incompatible-call]
      result = doContentUpdate(data)
      if (result.success) {
        content = result.updatedParagraph.content // update the content so it can be found in the cache now that it's changed - this is for all the cases below that don't use data for the content - ultimately delete this
        data.item.para.content = content
        // data.item.para.content = content // update the data object with the new content so it can be found in the cache now that it's changed - this is for jgclark's new handlers that use data instead
        logDebug('bCDI / updateItemContent', `-> successful call to doContentUpdate()`)
        // await updateReactWindowFromLineChange(result, data, ['para.content'])
      }
    }
    //TODO: implement the buttons addTask, addChecklist etc.
    // the payload looks like this {actionType: 'addTask', toFilename: '2024-05-04.md'}
    //
    switch (actionType) {
      case 'refresh': {
        await refreshAllSections()
        return
      }
      case 'completeTask': {
        result = doCompleteTask(data) // , windowId
        break
      }
      case 'completeTaskThen': {
        result = doCompleteTaskThen(data) // , windowId
        break
      }
      case 'cancelTask': {
        result = doCancelTask(data) // , windowId
        break
      }
      case 'completeChecklist': {
        result = doCompleteChecklist(data) // , windowId
        break
      }
      case 'cancelChecklist': {
        result = doCancelChecklist(data) // , windowId
        break
      }
      case 'unscheduleItem': {
        result = await doUnscheduleItem(data)
        break
      }
      case 'updateItemContent': {
        result = doContentUpdate(data)
        break
      }
      case 'toggleType': {
        result = await doToggleType(data)
        break
      }
      case 'cyclePriorityStateUp': {
        result = await doCyclePriorityStateUp(data)
        break
      }
      case 'cyclePriorityStateDown': {
        result = await doCyclePriorityStateDown(data)
        break
      }
      case 'setNextReviewDate': {
        result = await doSetNextReviewDate(data)
        break
      }
      case 'reviewFinished': {
        result = await doReviewFinished(data)
        break
      }
      // case 'windowResized': {
      //   result = await doWindowResized()
      //   break
      // }
      case 'showNoteInEditorFromFilename': {
        result = await doShowNoteInEditorFromFilename(data)
        break
      }
      case 'showNoteInEditorFromTitle': {
        result = await doShowNoteInEditorFromTitle(data)
        break
      }
      case 'showLineInEditorFromFilename': {
        result = await doShowLineInEditorFromFilename(data)
        break
      }
      case 'showLineInEditorFromTitle': {
        result = await doShowLineInEditorFromTitle(data)
        break
      }
      case 'moveToNote': {
        result = await doMoveToNote(data)
        break
      }
      case 'moveFromCalToCal': {
        result = await doMoveFromCalToCal(data)
        break
      }
      case 'updateTaskDate': {
        result = await doUpdateTaskDate(data)
        break
      }
      case 'reactSettingsChanged': {
        result = await doReactSettingsChanged(data)
        break
      }
      case 'setSpecificDate': {
        result = await doSetSpecificDate(data)
        break
      }
      default: {
        logWarn('bridgeClickDashboardItem', `bridgeClickDashboardItem: can't yet handle type ${actionType}`)
      }
    }

    if (result) {
      await processActionOnReturn(result, data) // process all actions based on result of handler
    } else {
      logWarn('bCDI', `false result from call`)
    }

    logDebug(pluginJson, `pluginToHTML bridge: RUNNING TEMPORARY FULL REFRESH OF JSON AFTER ANY COMMANDS WITHOUT A RETURN STATEMENT`)
    // await refreshData()

    // Other info from DW:
    // const para = getParagraphFromStaticObject(data, ['filename', 'lineIndex'])
    // if (para) {
    //   // you can do whatever you want here. For example, you could change the status of the paragraph
    //   // to done depending on whether it was an open task or a checklist item
    //   para.type = statusWas === 'open' ? 'done' : 'checklistDone'
    //   para.note?.updateParagraph(para)
    //   const newDivContent = `<td>"${para.type}"</td><td>Paragraph status was updated by the plugin!</td>`
    //   sendToHTMLWindow(windowId,'updateDiv', { divID: lineID, html: newDivContent, innerText: false })
    //   // NOTE: in this particular case, it might have been easier to just call the refresh-page command, but I thought it worthwhile
    //   // to show how to update a single div in the HTML view
    // } else {
    //   logError('bridgeClickDashboardItem', `onClickStatus: could not find paragraph for filename:${filename}, lineIndex:${lineIndex}`)
    // }
  } catch (error) {
    logError(pluginJson, `pluginToHTMLBridge / bridgeClickDashboardItem: ${JSP(error)}`)
  }
}

/**
 * One function to handle all actions on return from the various handlers
 * An attempt to reduce duplicated code in each
 * @param {TBridgeClickHandlerResult} handlerResult
 * @param {MessageDataObject} data
 */
async function processActionOnReturn(handlerResult: TBridgeClickHandlerResult, data: MessageDataObject) {
  try {
    const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
    const { success, updatedParagraph } = handlerResult
    const filename: string = data.item?.para?.filename ?? ''
    if (filename === '') throw new Error(`Cannot find filename in passed data`)

    const thisNote = getNoteByFilename(filename)
    clo(handlerResult, `processActionOnReturn: handlerResult for ${filename}`)
    // always update the cache for the note, as it might have changed
    const changedNote = DataStore.updateCache(thisNote)

    if (success) {
      // const { filename, content } = data.item.para
      const updatedNote = DataStore.updateCache(getNoteByFilename(filename), false)

      if (actionsOnSuccess.includes('REMOVE_LINE_FROM_JSON')) {
        logDebug('bCDI / processActionOnReturn', `REMOVE_LINE_FROM_JSON ..`)
        await updateReactWindowFromLineChange(handlerResult, data, [])
      }
      if (actionsOnSuccess.includes('UPDATE_LINE_IN_JSON')) {
        logDebug('bCDI / processActionOnReturn', `UPDATE_CONTENT to {${updatedParagraph?.content ?? '(error)'}}: calling updateReactWindow..()`)
        await updateReactWindowFromLineChange(handlerResult, data, ['para.content', 'para.type'])
      }
      if (actionsOnSuccess.includes('REFRESH_ALL_SECTIONS')) {
        logDebug('bCDI / processActionOnReturn', `REFRESH_ALL_SECTIONS: calling refreshData()`)
        await refreshAllSections()
      }
      if (actionsOnSuccess.includes('REFRESH_ALL_CALENDAR_SECTIONS')) {
        const wantedsectionCodes = ['DT', 'DY', 'DO', 'W', 'M', 'Q']
        logDebug('bCDI / processActionOnReturn', `REFRESH_ALL_CALENDAR_SECTIONS: calling getSomeSectionsData(['${String(wantedsectionCodes)}']`)
        const someNewSectionsData = getSomeSectionsData(wantedsectionCodes)

        // TODO: Swap out old JSON sections with new sections: see updateReactWindow...
      }
      if (actionsOnSuccess.includes('REFRESH_SECTION_IN_JSON')) {
        const wantedsectionCodes = handlerResult.sectionCodes ?? []
        logDebug('bCDI / processActionOnReturn', `REFRESH_SECTION_IN_JSON: calling getSomeSectionsData(['${String(wantedsectionCodes)}']`)
        const someNewSectionsData = getSomeSectionsData(wantedsectionCodes)

        // TODO: Swap out old JSON sections with new sections: see updateReactWindow...
      }
    } else {
      logDebug('processActionOnReturn', `-> failed handlerResult`)
    }
  } catch (error) {
    logError(`processActionOnReturn`, error.message)
  }
}

/**
 * Update React window data based on the result of handling item content update.
 * @param {TBridgeClickHandlerResult} res The result of handling item content update.
 * @param {MessageDataObject} data The data of the item that was updated.
 * @param {string[]} fieldPathsToUpdate The field paths to update in React window data -- paths are in SectionItem fields (e.g. "ID" or "para.content")
 * @returns {Promise<void>} A Promise that resolves once the update is done.
 */
export async function updateReactWindowFromLineChange(res: TBridgeClickHandlerResult, data: MessageDataObject, fieldPathsToUpdate: string[]): Promise<void> {
  clo(res, 'updateReactWindow: res')
  const { errorMsg, success, updatedParagraph } = res
  const actionsOnSuccess = res.actionsOnSuccess ?? []
  const shouldRemove = actionsOnSuccess.includes('REMOVE_LINE_FROM_JSON')
  const { ID } = data.item ?? { ID: '?' }
  const { content: oldContent = '', filename: oldFilename = '' } = data.item?.para ?? { content: 'error', filename: 'error' }
  clo(res.updatedParagraph, 'updateReactWindow: res.updatedParagraph:')
  if (success) {
    const newPara = updatedParagraph || ''
    const newParaContent = updatedParagraph?.content ?? ''
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    let sections = reactWindowData.pluginData.sections // this is a reference so we can overwrite it later
    const indexes = findSectionItems(sections, ['itemType', 'para.filename', 'para.content'], {
      itemType: /open|checklist/,
      'para.filename': oldFilename,
      'para.content': oldContent,
    }) // find all references to this content (could be in multiple sections)
    clo(indexes, 'updateReactWindow: matching indexes found')

    if (indexes.length) {
      const { sectionIndex, itemIndex } = indexes[0]
      clo(indexes, 'updateReactWindow: indexes to update')
      clo(sections[sectionIndex].sectionItems[itemIndex], `updateReactWindow old JSON item ${ID} sections[${sectionIndex}].sectionItems[${itemIndex}]`)
      logDebug('updateReactWindow', `should update sections[${sectionIndex}].sectionItems[${itemIndex}] to "${newParaContent}"`)
      if (shouldRemove) {
        // TEST:
        indexes.forEach((index) => {
          const { sectionIndex, itemIndex } = index
          // FIXME: 'undefined' error here when cancelling a task. In log above sectionIndex=1, itemIndex=1, newParaContent=''
          sections[sectionIndex].items.splice(itemIndex, 1)
        })
      } else {
        sections = copyUpdatedSectionItemData(indexes, fieldPathsToUpdate, { para: newPara }, sections)
      }
      clo(sections[sectionIndex].sectionItems[itemIndex], `updateReactWindow new JSON item ${ID} sections[${sectionIndex}].sectionItems[${itemIndex}]`)
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Single item updated on ID ${ID}`)
    } else {
      logError('updateReactWindow', errorMsg)
      throw `updateReactWindow: unable to find item to update: ID ${ID} : ${errorMsg || ''}`
    }
    // update ID in data object
  } else {
    logError('updateReactWindow', errorMsg)
    throw `updateReactWindow: failed to update item: ID ${ID}: ${errorMsg || ''}`
  }
}
