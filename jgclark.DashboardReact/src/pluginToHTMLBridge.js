// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Dashboard plugin
// Last updated 27.5.2024 for v2.0.0 by @dbw
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'

// import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
// import { finishReviewForNote, skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import {
  doAddItem,
  doCancelChecklist,
  doCancelTask,
  doContentUpdate,
  doCompleteTask,
  doCompleteTaskThen,
  doCompleteChecklist,
  doCyclePriorityStateDown,
  doCyclePriorityStateUp,
  doMoveToNote,
  doReviewFinished,
  doSetNextReviewDate,
  doShowNoteInEditorFromFilename,
  doShowNoteInEditorFromTitle,
  doShowLineInEditorFromFilename,
  doShowLineInEditorFromTitle,
  doSettingsChanged,
  doSetSpecificDate,
  doToggleType,
  doUnscheduleItem,
  doUpdateTaskDate,
  refreshAllSections,
  refreshSomeSections,
  incrementallyRefreshSections,
} from './clickHandlers'
import {
  doMoveFromCalToCal,
  scheduleAllOverdueOpenToToday,
  scheduleAllTodayTomorrow,
  scheduleAllYesterdayOpenToToday,
} from './moveClickHandlers'
import { makeDashboardParas } from './dashboardHelpers'
import { showDashboardReact } from './reactMain' // TODO: fix circ dep here
import {
  copyUpdatedSectionItemData, findSectionItems,
} from './dataGeneration'
import type { MessageDataObject, TActionType, TBridgeClickHandlerResult, TParagraphForDashboard, TPluginCommandSimplified } from './types'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import {
  sendToHTMLWindow, getGlobalSharedData,
  // updateGlobalSharedData
} from '@helpers/HTMLView'
import {
  // projectNotesSortedByChanged,
  getNoteByFilename
} from '@helpers/note'
// import { getLiveWindowRectFromWin, getWindowFromCustomId, logWindowsList, storeWindowRect } from '@helpers/NPWindows'
import {formatReactError} from '@helpers/react/reactDev'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'

//-----------------------------------------------------------------
// Data types + constants

type SettingDataObject = { settingName: string, state: string }

const windowCustomId = `${pluginJson['plugin.id']}.main` // TODO(later): update me
const WEBVIEW_WINDOW_ID = windowCustomId

//-----------------------------------------------------------------

/**
 * HTML View requests running a plugin command
 * TODO(@dbw): can this be removed -- there's something with the same name in np.Shared/Root.jsx
 * @param {TPluginCommandSimplified} data object with plugin details
 */
export async function runPluginCommand(data: TPluginCommandSimplified) {
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
 * Somebody clicked on a something in the HTML React view
 * NOTE: processActionOnReturn will be called for each item after the CASES based on TBridgeClickHandlerResult
 * @param {MessageDataObject} data - details of the item clicked
 */
export async function bridgeClickDashboardItem(data: MessageDataObject) {
  try {
    // const windowId = getWindowIdFromCustomId(windowCustomId);
    // if (!windowId) {
    //   logError('bridgeClickDashboardItem', `Can't find windowId for ${windowCustomId}`)
    //   return
    // }

    // const ID = data.item?.ID ?? '<no ID found>'
    const actionType: TActionType = data.actionType
    const filename = data.item?.para?.filename ?? '<no filename found>'
    let content = data.item?.para?.content ?? '<no content found>'
    const updatedContent = data.updatedContent ?? ''
    let result: TBridgeClickHandlerResult = { success: false } // use this for each call and return a TBridgeClickHandlerResult object

    logDebug(`******************** bridgeClickDashboardItem: ${actionType} ********************`)
    // clo(data.item, 'bridgeClickDashboardItem received data object; data.item=')
    if (!actionType === 'refresh' && (!content || !filename)) throw new Error('No content or filename provided for refresh')

    // Allow for a combination of button click and a content update
    if (updatedContent && data.actionType !== 'updateItemContent') {
      logDebug('bCDI', `content updated with another button press; need to update content first; new content: "${updatedContent}"`)
      // $FlowIgnore[incompatible-call]
      result = doContentUpdate(data)
      if (result.success) {
        // update the content so it can be found in the cache now that it's changed - this is for all the cases below that don't use data for the content - TODO(later): ultimately delete this
        content = result.updatedParagraph.content
        // update the data object with the new content so it can be found in the cache now that it's changed - this is for jgclark's new handlers that use data instead
        data.item.para.content = content
        logDebug('bCDI / updateItemContent', `-> successful call to doContentUpdate()`)
        // await updateReactWindowFromLineChange(result, data, ['para.content'])
      }
    }

    switch (actionType) {
      case 'refresh': {
        await refreshAllSections()
        break
      }
      case 'windowReload': {
        // logWarn('windowReload is currently turned off to avoid a circular dependency')
        showDashboardReact()
        return
      }
      case 'completeTask': {
        result = doCompleteTask(data)
        break
      }
      case 'completeTaskThen': {
        result = doCompleteTaskThen(data)
        break
      }
      case 'cancelTask': {
        result = doCancelTask(data)
        break
      }
      case 'completeChecklist': {
        result = doCompleteChecklist(data)
        break
      }
      case 'cancelChecklist': {
        result = doCancelChecklist(data)
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
        result = await doSettingsChanged(data, 'reactSettings')
        break
      }
      case 'sharedSettingsChanged': {
        result = await doSettingsChanged(data, 'sharedSettings')
        break
      }
      case 'setSpecificDate': {
        result = await doSetSpecificDate(data)
        break
      }
      case 'refreshSomeSections': {
        result = await refreshSomeSections(data)
        break
      }
      case 'incrementallyRefreshSections': {
        result = await incrementallyRefreshSections(data)
        break
      }
      case 'addChecklist': {
        result = await doAddItem(data)
        break
      }
      case 'addTask': {
        result = await doAddItem(data)
        break
      }
      case 'moveAllTodayToTomorrow': {
        result = await scheduleAllTodayTomorrow(data)
        break
      }
      case 'moveAllYesterdayToToday': {
        result = await scheduleAllYesterdayOpenToToday(data)
        break
      }
      case 'scheduleAllOverdueToday': {
        result = await scheduleAllOverdueOpenToToday(data)
        break
      }
      default: {
        logWarn('bridgeClickDashboardItem', `bridgeClickDashboardItem: can't yet handle type ${actionType}`)
      }
    }

    if (result) {
      await processActionOnReturn(result, data) // process all actions based on result of handler
      // await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SHOW_BANNER', {msg:"Action processed\n\n\n\n\nYASSSSS" })
    } else {
      logWarn('bCDI', `false result from call`)
    }

    // logDebug(pluginJson, `pluginToHTML bridge: RUNNING TEMPORARY FULL REFRESH OF JSON AFTER ANY COMMANDS WITHOUT A RETURN STATEMENT`)
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
  await checkForThemeChange() // check to see if the theme has changed and if so, update it
  if (!handlerResult) return
  try {
    const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
    if (!actionsOnSuccess.length) {
      logDebug('processActionOnReturn', `note: no post process actions to perform`)
      return
    }
    const { success, updatedParagraph } = handlerResult
    const filename: string = data.item?.para?.filename ?? ''
    if (filename === '') {
      logDebug('processActionOnReturn', `Starting with no filename`)
    } else {
      // always update the cache for the note, as it might have changed
      const thisNote = getNoteByFilename(filename)
      clo(handlerResult, `processActionOnReturn: handlerResult for ${filename}`)
      const _changedNote = DataStore.updateCache(thisNote)
    }

    if (success) {
      if (filename !== '') {
        const _updatedNote = await DataStore.updateCache(getNoteByFilename(filename), false) /* making await in case Eduard makes it an async at some point */
      }

      if (actionsOnSuccess.includes('REMOVE_LINE_FROM_JSON')) {
        logDebug('processActionOnReturn', `REMOVE_LINE_FROM_JSON:`)
        await updateReactWindowFromLineChange(handlerResult, data, [])
      }
      if (actionsOnSuccess.includes('UPDATE_LINE_IN_JSON')) {
        logDebug('processActionOnReturn', `UPDATE_LINE_IN_JSON to {${updatedParagraph?.content ?? '(no content)'}}: calling updateReactWindow..()`)
        await updateReactWindowFromLineChange(handlerResult, data, ['itemType', 'para']) // FIXME: replace the whole paragraph with new data
      }
      if (actionsOnSuccess.includes('REFRESH_ALL_SECTIONS')) {
        logDebug('processActionOnReturn', `REFRESH_ALL_SECTIONS: calling refreshData()`)
        await refreshAllSections()
      }
      if (actionsOnSuccess.includes('REFRESH_ALL_CALENDAR_SECTIONS')) {
        const wantedsectionCodes = ['DT', 'DY', 'DO', 'W', 'M', 'Q']
        for (const sectionCode of wantedsectionCodes) {
          await refreshSomeSections({ ...data, sectionCodes: [sectionCode] })
        }
      }
      if (actionsOnSuccess.includes('REFRESH_SECTION_IN_JSON')) {
        const wantedsectionCodes = handlerResult.sectionCodes ?? []
        logDebug('processActionOnReturn', `REFRESH_SECTION_IN_JSON: calling getSomeSectionsData(['${String(wantedsectionCodes)}']`)
        await refreshSomeSections({ ...data, sectionCodes: wantedsectionCodes })
      }
    } else {
      logDebug('processActionOnReturn', `-> failed handlerResult`)
    }
  } catch (error) {
    clo(data.item, `processActionOnReturn data.item`)
    logError(`processActionOnReturn error:${JSP(error)}`, JSP(formatReactError(error)))
  }
}

/**
 * Update React window data based on the result of handling item content update.
 * @param {TBridgeClickHandlerResult} res The result of handling item content update.
 * @param {MessageDataObject} data The data of the item that was updated.
 * @param {Array<string>} fieldPathsToUpdate The field paths to update in React window data -- paths are in SectionItem fields (e.g. "ID" or "para.content")
 */
export async function updateReactWindowFromLineChange(handlerResult: TBridgeClickHandlerResult, data: MessageDataObject, fieldPathsToUpdate: string[]): Promise<void> {
  clo(handlerResult, 'updateReactWindowFLC: handlerResult')
  const { errorMsg, success, updatedParagraph } = handlerResult
  const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
  const shouldRemove = actionsOnSuccess.includes('REMOVE_LINE_FROM_JSON')
  const { ID } = data.item ?? { ID: '?' }
  const { content: oldContent = '', filename: oldFilename = '' } = data.item?.para ?? { content: 'error', filename: 'error' }
  // clo(handlerResult.updatedParagraph, 'updateReactWindowFLC: handlerResult.updatedParagraph:')
  if (!success) {
    logWarn('updateReactWindowFLC', `failed, so won't update window`)
    throw `updateReactWindowFLC: failed to update item: ID ${ID}: ${errorMsg || ''}`
  }

  if (updatedParagraph) {
    clo(updatedParagraph.note?.filename ?? '<empty>', `updateReactWindowFLC -> updatedParagraph.note.filename`)
    const newPara: TParagraphForDashboard = makeDashboardParas([updatedParagraph])[0]
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    // get a reference so we can overwrite it later
    let sections = reactWindowData.pluginData.sections
    // find all references to this content (could be in multiple sections)
    const indexes = findSectionItems(sections, ['itemType', 'para.filename', 'para.content'], {
      itemType: /open|checklist/,
      'para.filename': oldFilename,
      'para.content': oldContent,
    })

    if (indexes.length) {
      const { sectionIndex, itemIndex } = indexes[0] // GET FIRST ONE FOR CLO DEBUGGING
      clo(indexes, 'updateReactWindowFLC: indexes to update')
      clo(sections[sectionIndex].sectionItems[itemIndex], `updateReactWindowFLC OLD/EXISTING JSON item ${ID} sections[${sectionIndex}].sectionItems[${itemIndex}]`)
      if (shouldRemove) {
        // TEST:
        indexes.reverse().forEach((index) => {
          const { sectionIndex, itemIndex } = index
          sections[sectionIndex].sectionItems.splice(itemIndex, 1)
          clo(sections[sectionIndex],`After splicing sections[${sectionIndex}]`)
        })
      } else {
        sections = copyUpdatedSectionItemData(indexes, fieldPathsToUpdate, { itemType: newPara.type, para: newPara }, sections) 
        clo(reactWindowData.pluginData.sections[sectionIndex].sectionItems[itemIndex], 'updateReactWindowFLC: NEW reactWindow JSON sectionItem before sending to window')
      }
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Single item updated on ID ${ID}`)
    } else {
      logError('updateReactWindowFLC', `unable to find item to update: ID ${ID} : ${errorMsg || ''}`)
      throw `updateReactWindowFLC: unable to find item to update: ID ${ID} : ${errorMsg || ''}`
    }
    // update ID in data object
  } else {
    logWarn('updateReactWindowFLC', `no updated paragraph: ID ${ID}: ${errorMsg || ''}`)
    throw `updateReactWindowFLC: failed to update item: ID ${ID}: ${errorMsg || ''}`
  }

}

/**
 * Check to see if the theme has changed since we initially drew the winodw
 * This can happen when your computer goes from light to dark mode or you change the theme
 * We want the dashboard to always match
 */
export async function checkForThemeChange(): Promise<void> {
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const { pluginData } = reactWindowData
  const { themeName: themeInWindow } = pluginData

  // logDebug('checkForThemeChange', `Editor.currentTheme: ${Editor.currentTheme?.name || '<no theme>'}`)
  // clo(NotePlan.editors.map((e,i)=>`"[${i}]: ${e?.title??''}": "${e.currentTheme.name}"`), 'checkForThemeChange: All NotePlan.editors themes')
  
  const currentTheme = NotePlan.editors[0].currentTheme?.name || '<could not get theme>'
  // logDebug('checkForThemeChange', `currentTheme: "${currentTheme}", themeInReactWindow: "${themeInWindow}"`)
  if (currentTheme !== themeInWindow) {
    logDebug('checkForThemeChange', `theme changed from "${themeInWindow}" to "${currentTheme}"`)
    const themeCSS = generateCSSFromTheme()
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'CHANGE_THEME', {themeCSS}, `Theme CSS Changed`)
    reactWindowData.themeName = currentTheme // save the theme in the reactWindowData
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Theme Changed; Changing reactWindowData.themeName`)
  }
}