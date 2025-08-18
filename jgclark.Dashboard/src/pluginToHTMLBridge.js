// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Dashboard plugin
// Last updated 2025-07-08 for v2.3.0.b4
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  doAddItem,
  doAddItemToFuture,
  doAddTaskAnywhere,
  doCancelChecklist,
  doCancelTask,
  doContentUpdate,
  doCommsBridgeTest,
  doCompleteTask,
  doCompleteTaskThen,
  doCompleteChecklist,
  doCyclePriorityStateDown,
  doCyclePriorityStateUp,
  doDeleteItem,
  doEvaluateString,
  doDashboardSettingsChanged,
  doShowNoteInEditorFromFilename,
  doShowNoteInEditorFromTitle,
  doShowLineInEditorFromFilename,
  doToggleType,
  doUnscheduleItem,
  doWindowResized,
} from './clickHandlers'
import { allCalendarSectionCodes, allSectionCodes, WEBVIEW_WINDOW_ID } from './constants'
import {
  doAddNewPerspective,
  doCopyPerspective,
  doDeletePerspective,
  doRenamePerspective,
  doSavePerspective,
  doSwitchToPerspective,
  doPerspectiveSettingsChanged,
} from './perspectiveClickHandlers'
import { incrementallyRefreshSomeSections, refreshSomeSections } from './refreshClickHandlers'
import {
  doAddProgressUpdate,
  doCancelProject,
  doCompleteProject,
  doTogglePauseProject,
  doReviewFinished,
  doSetNewReviewInterval,
  doSetNextReviewDate,
  doStartReviews,
} from './projectClickHandlers'
import { doMoveFromCalToCal, doMoveToNote, doRescheduleItem } from './moveClickHandlers'
import { scheduleAllOverdueOpenToToday, scheduleAllTodayTomorrow, scheduleAllYesterdayOpenToToday } from './moveDayClickHandlers'
import { scheduleAllLastWeekThisWeek, scheduleAllThisWeekNextWeek } from './moveWeekClickHandlers'
import { findSectionItems, getDashboardSettings, getListOfEnabledSections, getSectionCodeFromItemID, makeDashboardParas, setPluginData } from './dashboardHelpers'
// import { showDashboardReact } from './reactMain' // Note: fixed circ dep here by changing to using an x-callback instead 😫
import { copyUpdatedSectionItemData } from './dataGeneration'
import { externallyStartSearch } from './dataGenerationSearch'
import type { MessageDataObject, TActionType, TBridgeClickHandlerResult, TParagraphForDashboard, TPluginCommandSimplified, TSection, TSectionItem } from './types'
import { setNestedValue } from '@helpers/dataManipulation'
import { clo, clof, logDebug, logError, logInfo, logWarn, JSP, logTimer } from '@helpers/dev'
import { sendToHTMLWindow, getGlobalSharedData, sendBannerMessage, themeHasChanged } from '@helpers/HTMLView'
import { getNoteByFilename } from '@helpers/note'
import { formatReactError } from '@helpers/react/reactDev'

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
    const startTime = new Date()

    // const ID = data.item?.ID ?? '<no ID found>'
    const actionType: TActionType = data.actionType
    const logMessage = data.logMessage ?? ''
    const filename = data.item?.para?.filename ?? '<no filename found>'
    let content = data.item?.para?.content ?? '<no content found>'
    const updatedContent = data.updatedContent ?? ''
    // set default return value for each call; mostly overridden below with success
    let result: TBridgeClickHandlerResult = { success: false }

    logInfo(`************* bridgeClickDashboardItem: ${actionType}${logMessage ? `: "${logMessage}"` : ''} *************`)
    // clo(data, 'bridgeClickDashboardItem received data object; data=')
    if (!actionType === 'refreshEnabledSections' && (!content || !filename)) throw new Error('No content or filename provided for refresh')

    // Allow for a combination of button click and a content update
    if (updatedContent && data.actionType !== 'updateItemContent') {
      logDebug('bCDI', `content updated with another button press; need to update content first; new content: "${updatedContent}"`)
      // $FlowIgnore[incompatible-call]
      result = doContentUpdate(data)
      if (result.success) {
        // update the content so it can be found in the cache now that it's changed - this is for all the cases below that don't use data for the content - TODO(later): ultimately delete this
        content = result.updatedParagraph?.content ?? ''
        // update the data object with the new content so it can be found in the cache now that it's changed - this is for jgclark's new handlers that use data instead
        data.item?.para?.content ? (data.item.para.content = content) : null
        logDebug('bCDI / updateItemContent', `-> successful call to doContentUpdate()`)
        // The following line is important because it updates the React window with the changed content before the next action is taken
        // This will help Dashboard find the item to update in the JSON with the revised content
        await updateReactWindowFromLineChange(result, data, ['para.content'])
      }
    }

    switch (actionType) {
      case 'refreshEnabledSections': {
        const sectionCodesToUse = data.sectionCodes ? data.sectionCodes : allSectionCodes
        logInfo('bCDI / refreshEnabledSections', `sectionCodesToUse: ${String(sectionCodesToUse)}`)

        result = await incrementallyRefreshSomeSections({ ...data, sectionCodes: sectionCodesToUse }, false, true)
        result = { success: true }
        break
      }
      case 'refreshSomeSections': {
        result = await refreshSomeSections(data)
        break
      }
      case 'incrementallyRefreshSomeSections': {
        // Note: Only used by Dashboard after first section loaded.
        logInfo('bCDI / incrementallyRefreshSomeSections', `calling incrementallyRefreshSomeSections with data.sectionCodes = ${String(data.sectionCodes)} ...`)
        result = await incrementallyRefreshSomeSections(data)
        break
      }
      case 'windowReload': {
        // Used by 'Hard Refresh' button for devs
        const useDemoData = false
        // Using Plugin command invocation rather than `await showDashboardReact('full', useDemoData)` to avoid circular dependency
        DataStore.invokePluginCommandByName('Show Dashboard', 'jgclark.Dashboard', ['full', useDemoData])
        result = { success: true }
        return
      }
      case 'completeTask': {
        result = await doCompleteTask(data)
        break
      }
      case 'completeTaskThen': {
        result = await doCompleteTaskThen(data)
        break
      }
      case 'cancelTask': {
        result = doCancelTask(data)
        break
      }
      case 'completeChecklist': {
        result = await doCompleteChecklist(data)
        break
      }
      case 'cancelChecklist': {
        result = doCancelChecklist(data)
        break
      }
      case 'deleteItem': {
        result = await doDeleteItem(data)
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
      case 'startReviews': {
        result = await doStartReviews()
        break
      }
      case 'cancelProject': {
        result = await doCancelProject(data)
        break
      }
      case 'completeProject': {
        result = await doCompleteProject(data)
        break
      }
      case 'togglePauseProject': {
        result = await doTogglePauseProject(data)
        break
      }
      case 'setNewReviewInterval': {
        result = await doSetNewReviewInterval(data)
        break
      }
      case 'addProgress': {
        result = await doAddProgressUpdate(data)
        break
      }
      case 'evaluateString': {
        result = await doEvaluateString(data)
        break
      }
      case 'windowResized': {
        result = await doWindowResized()
        break
      }
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
      case 'moveToNote': {
        result = await doMoveToNote(data)
        break
      }
      case 'moveFromCalToCal': {
        result = await doMoveFromCalToCal(data)
        break
      }
      case 'rescheduleItem': {
        result = await doRescheduleItem(data)
        break
      }
      case 'dashboardSettingsChanged': {
        result = await doDashboardSettingsChanged(data, 'dashboardSettings')
        break
      }
      case 'perspectiveSettingsChanged': {
        result = await doPerspectiveSettingsChanged(data)
        break
      }
      case 'addNewPerspective': {
        result = await doAddNewPerspective(data)
        break
      }
      case 'copyPerspective': {
        result = await doCopyPerspective(data)
        break
      }
      case 'deletePerspective': {
        result = await doDeletePerspective(data)
        break
      }
      case 'switchToPerspective': {
        result = await doSwitchToPerspective(data)
        break
      }
      case 'savePerspective': {
        result = await doSavePerspective(data)
        break
      }
      case 'savePerspectiveAs': {
        result = await doAddNewPerspective(data)
        break
      }
      case 'renamePerspective': {
        result = await doRenamePerspective(data)
        break
      }
      // case 'setSpecificDate': {
      //   result = await doSetSpecificDate(data)
      //   break
      // }
      case 'addChecklist': {
        result = await doAddItem(data)
        break
      }
      case 'addTask': {
        result = await doAddItem(data)
        break
      }
      case 'addTaskAnywhere': {
        // Note: calls Quick Capture plugin /qath command which doesn't return anything
        await doAddTaskAnywhere()
        result = { success: true }
        break
      }
      case 'addTaskToFuture': {
        result = await doAddItemToFuture(data)
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
      case 'moveAllLastWeekThisWeek': {
        result = await scheduleAllLastWeekThisWeek(data)
        break
      }
      case 'moveAllThisWeekNextWeek': {
        result = await scheduleAllThisWeekNextWeek(data)
        break
      }
      case 'commsBridgeTest': {
        result = await doCommsBridgeTest(data)
        break
      }
      case 'startSearch': {
        console.log(`pluginToHTMLBridge: startSearch: data:${JSP(data)}`)
        await externallyStartSearch(data.stringToEvaluate ?? '')
        result = {
          success: true,
          sectionCodes: ['SEARCH'],
          actionsOnSuccess: [],
          errorMsg: '',
        }
        break
      }
      case 'closeSection': {
        result = {
          success: true,
          sectionCodes: ['SEARCH'],
          actionsOnSuccess: ['CLOSE_SECTION'],
          errorMsg: '',
        }
        break
      }
      default: {
        logWarn('bridgeClickDashboardItem', `bridgeClickDashboardItem: can't yet handle type ${actionType}`)
      }
    }
    logTimer('bridgeClickDashboardItem', startTime, `for bridgeClickDashboardItem: "${data.actionType}" before processActionOnReturn()`, 1000)
    if (result) {
      await processActionOnReturn(result, data) // process all actions based on result of handler
    } else {
      logWarn('bCDI', `false result from call`)
    }
    logTimer('bridgeClickDashboardItem', startTime, `total runtime for bridgeClickDashboardItem: "${data.actionType}"`, 1000)
  } catch (error) {
    logError(pluginJson, `pluginToHTMLBridge / bridgeClickDashboardItem: ${JSP(error)}`)
  }
}

/**
 * One function to handle all actions on return from the various handlers.
 * @param {TBridgeClickHandlerResult} handlerResult
 * @param {MessageDataObject} data
 */
async function processActionOnReturn(handlerResultIn: TBridgeClickHandlerResult, data: MessageDataObject) {
  try {
    // check to see if the theme has changed and if so, update it
    const config: any = await getDashboardSettings()
    const themeChanged = await themeHasChanged(WEBVIEW_WINDOW_ID, config.dashboardTheme)
    if (themeChanged) {
      logDebug('processActionOnReturn', `Theme changed; forcing a refresh of the dashboard`)
      DataStore.invokePluginCommandByName('showDashboardReact', 'jgclark.Dashboard', ['full'])
    }
    if (!handlerResultIn) return
    const handlerResult = handlerResultIn
    const { success, updatedParagraph } = handlerResult
    const enabledSections = getListOfEnabledSections(config)

    if (!success) {
      logDebug('processActionOnReturn', `-> failed handlerResult(false) ${handlerResult.errorMsg || ''}`)
      await sendBannerMessage(
        WEBVIEW_WINDOW_ID,
        `Action processing failed for "${data.actionType}" ${handlerResult.errorMsg || ''}.\nCheck the Plugin Console for more details (after turning on DEBUG logging).`,
      )
      return
    }

    // Handle the different success cases
    const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
    if (actionsOnSuccess.length === 0) {
      logDebug('processActionOnReturn', `note: no post process actions to perform`)
      return
    }
    const isProject = data.item?.itemType === 'project'
    const actsOnALine = actionsOnSuccess.some((str) => str.includes('LINE'))

    const filename: string = isProject ? data.item?.project?.filename ?? '' : data.item?.para?.filename ?? ''
    logDebug('processActionOnReturn',
      isProject ? `item.ID: ${data.item?.ID ?? '?'} = PROJECT: ${data.item?.project?.title || 'no project title'}` : `item.ID: ${data.item?.ID ?? '?'} = TASK: updatedParagraph "${updatedParagraph?.content ?? 'N/A'}"`,
    )
    if (actsOnALine && filename === '') {
      logWarn('processActionOnReturn', `Starting with no filename`)
    }
    if (filename !== '') {
      // update the cache for the note, as it might have changed
      const thisNote = getNoteByFilename(filename)
      if (thisNote) {
        const res = await DataStore.updateCache(thisNote, false) /* Note: added await in case Eduard makes it an async at some point */
      }
    }

    if (actionsOnSuccess.includes('REMOVE_LINE_FROM_JSON')) {
      const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      const sections = reactWindowData.pluginData.sections
      logDebug('processActionOnReturn', `Starting REMOVE_LINE_FROM_JSON with active sections: ${String(sections.map((s) => s.sectionCode).join(','))}`)

      if (isProject) {
        const thisProject = data.item?.project
        const projFilename = data.item?.project?.filename
        if (!projFilename) throw new Error(`unable to find data.item.project.filename`)
        logDebug('processActionOnReturn', `REMOVE_LINE_FROM_JSON: for ID:${data?.item?.ID || ''} project:"${thisProject?.title || '?'}"`)
        // Find the item(s) from its filename.
        // Note: currently this will only update 1 project item. But leaving this multi-item code here for now.
        const indexes = findSectionItems(sections,
          ['itemType', 'project.filename'],
          { itemType: 'project', 'project.filename': projFilename })
        logDebug('processActionOnReturn', `-> found ${indexes.length} items to remove: ${String(indexes.map((i) => `s[${i.sectionIndex}_${sections[i.sectionIndex].sectionCode}]:si[${i.itemIndex}]`).join(', '))}`)
        indexes.reverse().forEach((index) => {
          const { sectionIndex, itemIndex } = index
          sections[sectionIndex].sectionItems.splice(itemIndex, 1)
          // clo(sections[sectionIndex],`processActionOnReturn After splicing sections[${sectionIndex}]`)
        })
      } else {
        // Handle Task or Message types
        const { content: oldContent = '', filename: oldFilename = '' } = data.item?.para ?? { content: 'error', filename: 'error' }

        // Find all references to this content (could be in multiple sections)
        const indexes = findSectionItems(sections, ['itemType', 'para.filename', 'para.content'], {
          itemType: /open|checklist/,
          'para.filename': oldFilename,
          'para.content': oldContent,
        })

        if (indexes.length) {
          logInfo('processActionOnReturn', `-> found ${indexes.length} items to remove: ${String(indexes.map((i) => `s[${i.sectionIndex}_${sections[i.sectionIndex].sectionCode}]:si[${i.itemIndex}]`).join(', '))}`)
          indexes.reverse().forEach((index) => {
            const { sectionIndex, itemIndex } = index
            logDebug('processActionOnReturn', `-> removing item ${data.item?.ID || '?'} from sections[${sectionIndex}].sectionItems[${itemIndex}]`)
            sections[sectionIndex].sectionItems.splice(itemIndex, 1)
          })
        } else {
          logWarn('processActionOnReturn', `-> no items found to remove for content="${oldContent}" filename="${oldFilename}"`)
        }
      }
      logDebug('processActionOnReturn', `-> NOT asking for any further refresh: hopefully React will do its stuff!`)

      // Send the updated data to React window
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Removed item ${data.item?.ID || '?'}`)
    }

    if (actionsOnSuccess.includes('UPDATE_LINE_IN_JSON')) {
      if (isProject) {
        // For Project items
        logDebug('processActionOnReturn', `UPDATE_LINE_IN_JSON for Project '${filename}': calling updateReactWindowFromLineChange()`)
        await updateReactWindowFromLineChange(handlerResult, data, ['filename', 'itemType', 'project'])
      } else {
        // Handle Task or Message types
        // Find all references to this content (could be in multiple sections)
        const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
        let sections = reactWindowData.pluginData.sections
        const { content: oldContent = '', filename: oldFilename = '' } = data.item?.para ?? { content: 'error', filename: 'error' }
        const indexes = findSectionItems(sections, ['itemType', 'para.filename', 'para.content'], {
          itemType: /open|checklist/,
          'para.filename': oldFilename,
          'para.content': oldContent,
        })

        if (indexes.length) {
          const itemsToUpdateStr = indexes.map((i) => `s[${i.sectionIndex}_${sections[i.sectionIndex].sectionCode}]:si[${i.itemIndex}]`).join(', ')
          logInfo('processActionOnReturn', `-> found ${indexes.length} items to update: ${itemsToUpdateStr}`)
          indexes.reverse().forEach((index) => {
            const { sectionIndex, itemIndex } = index
            logDebug('processActionOnReturn', `-> updating item sections[${sectionIndex}].sectionItems[${itemIndex}]`)
            console.log(`before: ${JSP(sections[sectionIndex].sectionItems[itemIndex])}`)
            console.log(`updatedParagraph: ${JSP(updatedParagraph)}`)
            // Note: simpler methods don't work here; need to use copyUpdatedSectionItemData()
            const fieldPathsToUpdate = ['itemType', 'para.content', 'para.rawContent', 'para.type', 'para.priority']
            sections = copyUpdatedSectionItemData(indexes, fieldPathsToUpdate, { para: updatedParagraph }, sections)
            console.log(`after: ${JSP(sections[sectionIndex].sectionItems[itemIndex])}`)
          })
          await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Updated items ${itemsToUpdateStr} following change in  ${data.item?.ID || '?'}`)
        } else {
          logWarn('processActionOnReturn', `-> no items found to update for content="${oldContent}" filename="${oldFilename}"`)
        }

      }
    }

    if (actionsOnSuccess.includes('CLOSE_SECTION')) {
      const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      // Remove the search section from the sections array
      const sections = reactWindowData.pluginData.sections
      logDebug('processActionOnReturn', `Starting CLOSE_SECTION with ${sections.length} sections: ${String(sections.map((s) => s.sectionCode).join(','))}.`)
      const sectionIndex = sections.findIndex((section) => section.sectionCode === 'SEARCH')
      logDebug('processActionOnReturn', `CLOSE_SECTION for section #${String(sectionIndex)}`)
      sections.splice(sectionIndex, 1)
      logDebug('processActionOnReturn', `Closed search section -> ${sections.length} sections: ${String(sections.map((s) => s.sectionCode).join(','))}.`)

      // Set showSearchSection to false
      reactWindowData.pluginData.showSearchSection = false
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Closed Search Section`)
    }

    if (actionsOnSuccess.includes('INCREMENT_DONE_COUNT')) {
      const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      const incrementedCount = reactWindowData.pluginData.totalDoneCount + 1
      logDebug('processActionOnReturn', `INCREMENT_DONE_COUNT to ${String(incrementedCount)}`)
      reactWindowData.pluginData.totalDoneCount = incrementedCount
      await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Incrementing done counts (ahead of proper background refresh)`)
    }

    if (actionsOnSuccess.includes('REFRESH_ALL_ENABLED_SECTIONS')) {
      logDebug('processActionOnReturn', `REFRESH_ALL_ENABLED_SECTIONS: calling incrementallyRefreshSomeSections (for ${String(enabledSections)}) ...`)
      await incrementallyRefreshSomeSections({ ...data, sectionCodes: enabledSections })
    } else if (actionsOnSuccess.includes('PERSPECTIVE_CHANGED')) {
      logDebug('processActionOnReturn', `PERSPECTIVE_CHANGED: calling incrementallyRefreshSomeSections (for ${String(enabledSections)}) ...`)
      await setPluginData({ perspectiveChanging: true }, `Starting perspective change`)
      await incrementallyRefreshSomeSections({ ...data, sectionCodes: enabledSections })
      logDebug('processActionOnReturn', `PERSPECTIVE_CHANGED finished (should hide modal spinner)`)
      await setPluginData({ perspectiveChanging: false }, `Ending perspective change`)
    } else if (actionsOnSuccess.includes('REFRESH_ALL_SECTIONS')) {
      logDebug('processActionOnReturn', `REFRESH_ALL_SECTIONS: calling incrementallyRefreshSomeSections ...`)
      await incrementallyRefreshSomeSections({ ...data, sectionCodes: allSectionCodes })
    } else if (actionsOnSuccess.includes('REFRESH_ALL_CALENDAR_SECTIONS')) {
      logDebug('processActionOnReturn', `REFRESH_ALL_CALENDAR_SECTIONS: calling incrementallyRefreshSomeSections (for ${String(allCalendarSectionCodes)}) ..`)
      for (const sectionCode of allCalendarSectionCodes) {
        // await refreshSomeSections({ ...data, sectionCodes: [sectionCode] })
        await incrementallyRefreshSomeSections({ ...data, sectionCodes: [sectionCode] })
      }
    } else {
      // At least update TB section (if enabled) to make sure its as up to date as possible
      if (enabledSections.includes('TB')) {
        logDebug('processActionOnReturn', `Adding REFRESH_SECTION_IN_JSON for TB ...`)
        if (!actionsOnSuccess.includes('REFRESH_SECTION_IN_JSON')) {
          actionsOnSuccess.push('REFRESH_SECTION_IN_JSON')
          if (!handlerResult.sectionCodes) {
            handlerResult.sectionCodes = []
          }
          if (!handlerResult.sectionCodes.includes('TB')) {
            handlerResult.sectionCodes?.push('TB')
          }
        }
        logDebug('processActionOnReturn', `... -> ${String(handlerResult.sectionCodes)}`)
      }
    }

    if (actionsOnSuccess.includes('REFRESH_SECTION_IN_JSON')) {
      const wantedsectionCodes = handlerResult.sectionCodes ?? []
      if (!wantedsectionCodes?.length) logError('processActionOnReturn', `REFRESH_SECTION_IN_JSON: no sectionCodes provided`)
      logDebug('processActionOnReturn', `REFRESH_SECTION_IN_JSON: calling getSomeSectionsData (for ['${String(wantedsectionCodes)}']) ...`)
      await incrementallyRefreshSomeSections({ ...data, sectionCodes: wantedsectionCodes })
    }

    if (actionsOnSuccess.includes('START_DELAYED_REFRESH_TIMER')) {
      // TEST: turning this off for now
      logDebug('processActionOnReturn', `START_DELAYED_REFRESH_TIMER: 😳 NOT NOW setting startDelayedRefreshTimer in pluginData`)
      // const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      // reactWindowData.pluginData.startDelayedRefreshTimer = true
      // await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Setting startDelayedRefreshTimer`)
    }

  } catch (error) {
    logError('processActionOnReturn', `error: ${JSP(error)}: \n${JSP(formatReactError(error))}`)
    clo(data.item, `- data.item at error:`)
  }
}

/**
 * Update React window data based on the result of handling item content update.
 * Purpose: provides a more responsive user experience, by updating the React window's data structure to reflect changes made to individual items without requiring a full refresh of all sections.
 * Called from processActionOnReturn() function following:
 * - Content Updates (Most Common)
 * - Item Type Changes
 * - Project Updates
 *
 * Note: REMOVE_LINE_FROM_JSON is now handled entirely in processActionOnReturn() to avoid duplication.
 *
 * @param {TBridgeClickHandlerResult} handlerResult The result of handling item content update.
 * @param {MessageDataObject} data The data of the item that was updated.
 * @param {Array<string>} fieldPathsToUpdate The field paths to update in React window data -- paths are in SectionItem fields (e.g. "ID" or "para.content")
 */
export async function updateReactWindowFromLineChange(handlerResult: TBridgeClickHandlerResult, data: MessageDataObject, fieldPathsToUpdate: Array<string>): Promise<void> {
  try {
    clo(handlerResult, 'updateReactWindowFLC: handlerResult')
    const { errorMsg, success, updatedParagraph } = handlerResult
    const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
    const { ID } = data.item ?? { ID: '?' }
    if (!success) {
      throw new Error(`handlerResult indicates failure with item: ID ${ID}, so won't update window. ${errorMsg || ''}`)
    }
    const isProject = data.item?.itemType === 'project'
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    let sections = reactWindowData.pluginData.sections

    logDebug('updateReactWindowFLC', `for item ID: ${ID} will do [${String(actionsOnSuccess)}] ...`)

    if (updatedParagraph) {
      logDebug(`updateReactWindowFLC`, ` -> updatedParagraph: "${updatedParagraph.content}"`)
      const { content: oldContent = '', filename: oldFilename = '' } = data.item?.para ?? { content: 'error', filename: 'error' }
      // TEST:
      // const newPara: TParagraphForDashboard = makeDashboardParas([updatedParagraph])[0]
      const newPara: TParagraphForDashboard = updatedParagraph
      // get a reference so we can overwrite it later
      // find all references to this content (could be in multiple sections)
      const indexes = findSectionItems(sections, ['itemType', 'para.filename', 'para.content'], {
        itemType: /open|checklist/,
        'para.filename': oldFilename,
        'para.content': oldContent,
      })

      if (indexes.length) {
        logInfo('updateReactWindowFLC', `-> found ${indexes.length} items to update: ${String(indexes.map((i) => `s[${i.sectionIndex}_${sections[i.sectionIndex].sectionCode}]:si[${i.itemIndex}]`).join(', '))}`)
        // Apply the update to all the found sectionItems
        sections = copyUpdatedSectionItemData(indexes, fieldPathsToUpdate, { itemType: newPara.type, para: newPara }, sections)
        clo(reactWindowData.pluginData.sections[0]?.sectionItems[0], 'updateReactWindowFLC: NEW reactWindow JSON sectionItem before sendToHTMLWindow()')
      } else {
        throw new Error(`updateReactWindowFLC: unable to find item to update: ID ${ID} was looking for: content="${oldContent}" filename="${oldFilename}" : ${errorMsg || ''}`)
      }
    } else if (isProject) {
      // For Project items
      const { filename = '' } = data.item?.project ?? { filename: 'error' }
      logInfo('updateReactWindowFLC', `UPDATE_LINE_IN_JSON for '${ID}' = Project '${filename}'. Will sendToHTMLWindow()`)
    } else {
      // No updatedParagraph provided - this should only happen for project updates or other special cases
      throw new Error(`no updatedParagraph param was given, and its not a Project update. So cannot update react window content for: ID=${ID}. errorMsg=${errorMsg || '-'}`)
    }
    await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Single item updated on ID ${ID}`)
  } catch (error) {
    logError('updateReactWindowFLC', error.message)
    clo(data.item, `- data.item at error:`)
  }
}
