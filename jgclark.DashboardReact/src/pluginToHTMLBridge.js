// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Dashboard plugin
// Last updated 3.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'

import { addChecklistToNoteHeading, addTaskToNoteHeading } from '../../jgclark.QuickCapture/src/quickCapture'
import { finishReviewForNote, skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import { getSettings, moveItemBetweenCalendarNotes } from './dashboardHelpers'
// import { showDashboardReact } from './reactMain'
import { copyUpdatedSectionItemData, findSectionItems, getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import type { TActionOnReturn, TBridgeClickHandlerResult, MessageDataObject } from './types'
import { doCancelChecklist, doCancelTask, doContentUpdate, doCompleteTask, doCompleteTaskThen, doCompleteChecklist, doToggleType, doUnscheduleItem } from './clickHandlers'
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
import { decodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { chooseHeading } from '@helpers/userInput'
//-----------------------------------------------------------------
// Data types + constants

type SettingDataObject = { settingName: string, state: string }

const windowCustomId = `${pluginJson['plugin.id']} React Window`
const WEBVIEW_WINDOW_ID = windowCustomId

// TEST: New for React
// const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} React Window` // will be used as the customId

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
 * @param {any} data object
 */
export async function runPluginCommand(data: any) {
  try {
    clo(data, 'runPluginCommand received data object')
    // logDebug('pluginToHTMLBridge/runPluginCommand', `- settingName: ${settingName}, state: ${state}`)
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
    const windowId = windowCustomId // note that this is not used and should be deleted
    if (!windowId) {
      logError('bridgeClickDashboardItem', `Can't find windowId for ${windowCustomId}`)
      return
    }
    const ID = data.itemID
    const type = data.type
    let result: TBridgeClickHandlerResult = { success: false } // use this for each call and return a TBridgeClickHandlerResult object

    // These variables are only necessary until the routing is fully refactored to use data instead
    // FIXME: sort flow error as it looks helpful
    // FIXME: refactor the calling code so that we can use data.item?.para?.filename every time
    const filename = data.item?.para?.filename || data.filename || decodeRFC3986URIComponent(data.encodedFilename ?? '')
    let content = data.item?.para?.content || data.content || decodeRFC3986URIComponent(data.encodedContent ?? '')

    logDebug('', `------------------------- bridgeClickDashboardItem: ${type} -------------------------`)
    logDebug('bridgeClickDashboardItem', `itemID: ${ID}, type: ${type}, filename: ${filename}, content: ${content}`)
    if (!type === 'refresh' && (!content || !filename)) throw new Error('No content or filename provided for refresh')
    // clo(data, 'bridgeClickDashboardItem received data object')

    // TODO: move this to a function
    // Allow for a combination of button click and a content update
    if (data.encodedUpdatedContent && data.type !== 'updateItemContent') {
      logDebug('bCDI', `content updated with another button press; need to update content first; new content: "${data.encodedUpdatedContent}"`)
      // $FlowIgnore[incompatible-call]
      result = doContentUpdate(data)
      if (result.success) {
        content = result.updatedParagraph.content // update the content so it can be found in the cache now that it's changed - this is for all the cases below that don't use data for the content - ultimately delete this
        // data.item.para.content = content // update the data object with the new content so it can be found in the cache now that it's changed - this is for jgclark's new handlers that use data instead
        logDebug('bCDI / updateItemContent', `-> successful call to doContentUpdate()`)
        // await updateReactWindowFromHandlerResult(result, data, ['para.content'])
      }
    }

    switch (type) {
      case 'refresh': {
        logDebug(pluginJson, `pluginToHTML bridge: REFRESH RECEIVED`)
        await refreshData()
        return
      }
      case 'completeTask': {
        result = await doCompleteTask(data) // , windowId
        break
      }
      case 'completeTaskThen': {
        result = await doCompleteTaskThen(data) // , windowId
        break
      }
      case 'cancelTask': {
        result = await doCancelTask(data) // , windowId
        break
      }
      case 'completeChecklist': {
        result = await doCompleteChecklist(data) // , windowId
        break
      }
      case 'cancelChecklist': {
        result = await doCancelChecklist(data) // , windowId
        break
      }
      case 'updateItemContent': {
        result = await doContentUpdate(data)
        break
      }
      case 'toggleType': {
        result = await doToggleType(data)
        break
      }
      case 'cyclePriorityStateUp': {
        // Send a request to cyclePriorityStateUp to plugin

        // Get para
        const para = findParaFromStringAndFilename(filename, content)
        if (para && typeof para !== 'boolean') {
          const paraContent = para.content ?? 'error'
          // logDebug('bCDI / cyclePriorityStateUp', `will cycle priority on para {${paraContent}}`)
          // Note: next 2 lines have to be this way around, otherwise a race condition
          const newPriority = (getTaskPriority(paraContent) + 1) % 5
          const updatedContent = cyclePriorityStateUp(para)
          logDebug('bCDI / cyclePriorityStateUp', `cycling priority -> {${updatedContent}}`)

          // Ideally we would update the content in place, but so much of the logic for this is unhelpfully on the plugin side (HTMLGeneratorGrid::) it is simpler to ask for a refresh. = await showDashboardReact('refresh')
          // Note: But this doesn't work, because of race condition.
          // So we better try that logic after all.
          const updatedData = {
            itemID: ID,
            newContent: updatedContent,
            newPriority: newPriority,
          }
          sendToHTMLWindow(windowId, 'cyclePriorityStateUp', updatedData)
        } else {
          logWarn('bCDI / cyclePriorityStateUp', `-> unable to find para {${content}} in filename ${filename}`)
        }
        break
      }
      case 'cyclePriorityStateDown': {
        // Send a request to cyclePriorityStateDown to plugin

        // Get para
        const para = findParaFromStringAndFilename(filename, content)
        if (para && typeof para !== 'boolean') {
          const paraContent = para.content ?? 'error'
          // logDebug('bCDI / cyclePriorityStateDown', `will cycle priority on para {${paraContent}}`)
          // Note: next 2 lines have to be this way around, otherwise a race condition
          const newPriority = (getTaskPriority(paraContent) - 1) % 5
          const updatedContent = cyclePriorityStateDown(para)
          logDebug('bCDI / cyclePriorityStateDown', `cycling priority -> {${updatedContent}}`)

          // Update the content in place
          const updatedData = {
            itemID: ID,
            newContent: updatedContent,
            newPriority: newPriority,
          }
          sendToHTMLWindow(windowId, 'cyclePriorityStateDown', updatedData)
        } else {
          logWarn('bCDI / cyclePriorityStateDown', `-> unable to find para {${content}} in filename ${filename}`)
        }
        break
      }
      case 'unscheduleItem': {
        result = await doUnscheduleItem(data)
        break
      }
      case 'setNextReviewDate': {
        // Mimic the /skip review command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          const period = data.controlStr.replace('nr', '')
          logDebug('bCDI / setNextReviewDate', `-> will skip review by '${period}' for filename ${filename}.`)
          skipReviewForNote(note, period)
          // Now send a message for the dashboard to update its display
          sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCDI / setNextReviewDate', `-> couldn't get filename ${filename} to add a @nextReview() date.`)
        }
        break
      }
      case 'reviewFinished': {
        // Mimic the /finish review command.
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCDI / review', `-> reviewFinished on ID ${ID} in filename ${filename}`)
          // TODO: update this to actually take a note to work on
          finishReviewForNote(note)
          logDebug('bCDI / review', `-> after finishReview`)
          sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCDI / review', `-> couldn't get filename ${filename} to update the @reviewed() date.`)
        }
        break
      }
      case 'windowResized': {
        logDebug('bCDI / windowResized', `windowResized triggered on plugin side (hopefully for '${windowCustomId}')`)
        const thisWin = getWindowFromCustomId(windowCustomId)
        const rect = getLiveWindowRectFromWin(thisWin)
        if (rect) {
          // logDebug('bCDI / windowResized/windowResized', `-> saving rect: ${rectToString(rect)} to pref`)
          storeWindowRect(windowCustomId)
        }
        break
      }
      case 'showNoteInEditorFromFilename': {
        // Handle a show note call simply by opening the note in the main Editor.
        // Note: use the showLine... variant of this (below) where possible
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          logDebug('bridgeClickDashboardItem', `-> successful call to open filename ${filename} in Editor`)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open filename ${filename} in Editor`)
        }
        break
      }
      case 'showNoteInEditorFromTitle': {
        // Handle a show note call simply by opening the note in the main Editor
        // Note: use the showLine... variant of this (below) where possible
        // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
        const wantedTitle = filename
        const note = await Editor.openNoteByTitle(wantedTitle)
        if (note) {
          logDebug('bridgeClickDashboardItem', `-> successful call to open title ${wantedTitle} in Editor`)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title ${wantedTitle} in Editor`)
        }
        break
      }
      case 'showLineInEditorFromFilename': {
        // Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line
        // logDebug('showLineInEditorFromFilename', `${filename} /  ${content}`)
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
          logDebug(
            'bridgeClickDashboardItem',
            `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
          )
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open filename ${filename} in Editor`)
        }
        break
      }
      case 'showLineInEditorFromTitle': {
        // Handle a show line call by opening the note in the main Editor, and then finding and moving the cursor to the start of that line
        // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
        const wantedTitle = decodeURIComponent(filename)
        const note = await Editor.openNoteByTitle(wantedTitle)
        if (note) {
          const res = highlightParagraphInEditor({ filename: note.filename, content: content }, true)
          logDebug(
            'bridgeClickDashboardItem',
            `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`,
          )
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title ${wantedTitle} in Editor`)
        }
        break
      }

      case 'moveToNote': {
        // Instruction to move task from a note to a project note.
        if (!data.itemType) {
          throw new Error(`Trying to moveToNote but no itemType was passed`)
        }

        // Note: Requires user input
        const itemType = data.itemType
        logDebug('moveToNote', `starting with itemType: ${itemType}`)

        // Start by getting settings from *Filer plugin*
        // const config = await getFilerSettings() ?? { whereToAddInSection: 'start', allowNotePreambleBeforeHeading: true }

        // const startDateStr = getDateStringFromCalendarFilename(filename, true)

        // Ask user for destination project note
        const allNotes = projectNotesSortedByChanged()

        const res = await CommandBar.showOptions(
          allNotes.map((n) => n.title ?? 'untitled'),
          `Select note to move this ${itemType} to`,
        )
        const destNote = allNotes[res.index]

        // Ask to which heading to add the selectedParas
        const headingToFind = await chooseHeading(destNote, true, true, false)
        logDebug('moveToNote', `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

        // Add text to the new location in destination note
        // Use 'headingLevel' ("Heading level for new Headings") from the setting in QuickCapture if present (or default to 2)
        const newHeadingLevel = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'headingLevel', 2)
        logDebug('moveToNote', `newHeadingLevel: ${newHeadingLevel}`)
        if (itemType === 'task') {
          addTaskToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
        } else {
          addChecklistToNoteHeading(destNote.title, headingToFind, content, newHeadingLevel)
        }
        // Ask for cache refresh for this note
        DataStore.updateCache(destNote, false)

        // delete from existing location
        const origNote = getNoteByFilename(filename)
        const origPara = findParaFromStringAndFilename(filename, content)
        if (origNote && origPara) {
          logDebug('moveToNote', `- Removing 1 para from original note ${filename}`)
          origNote.removeParagraph(origPara)
        } else {
          logWarn('moveToNote', `couldn't remove para {${content}} from original note ${filename} because note or paragraph couldn't be found`)
        }
        // Send a message to update the row in the dashboard
        logDebug('moveToNote', `- Sending request to window to update`)
        sendToHTMLWindow(windowId, 'updateItemFilename', { itemID: ID, filename: destNote.filename })

        // Ask for cache refresh for this note
        DataStore.updateCache(origNote, false)
        break
      }

      case 'moveFromCalToCal': {
        // Instruction from a 'moveButton' to move task from calendar note to a different calendar note.
        // Note: Overloads ID with the dateInterval to use
        const config = await getSettings()
        const dateInterval = data.controlStr
        let startDateStr = ''
        let newDateStr = ''
        if (dateInterval !== 't' && !dateInterval.match(RE_DATE_INTERVAL)) {
          logError('moveFromCalToCal', `bad move date interval: ${dateInterval}`)
          break
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
          sendToHTMLWindow(windowId, 'removeItem', { itemID: ID })
        } else {
          logWarn('moveFromCalToCal', `-> moveFromCalToCal to ${newDateStr} not successful`)
        }
        break
      }

      case 'updateTaskDate': {
        // Instruction from a 'changeDateButton' to change date on a task (in a project note or calendar note)
        const dateInterval = data.controlStr
        const config = await getSettings()
        // const startDateStr = ''
        let newDateStr = ''
        if (dateInterval !== 't' && !dateInterval.match(RE_DATE_INTERVAL)) {
          logError('bridgeClickDashboardItem', `bad move date interval: ${dateInterval}`)
          break
        }
        if (dateInterval === 't') {
          // Special case to change to '>today' (or the actual date equivalent)
          newDateStr = config.useTodayDate ? 'today' : getTodaysDateHyphenated()
          logDebug('bridgeClickDashboardItem', `move task in ${filename} -> 'today'`)
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
            logDebug('bridgeClickDashboardItem', `- used NPWeekData instead -> ${newDateStr}`)
          }
          logDebug('bridgeClickDashboardItem', `change due date on task from ${startDateStr} -> ${newDateStr}`)
        }
        // Make the actual change
        const thePara = findParaFromStringAndFilename(filename, content)
        if (typeof thePara !== 'boolean') {
          const theLine = thePara.content
          const changedLine = replaceArrowDatesInString(thePara.content, `>${newDateStr}`)
          logDebug('bridgeClickDashboardItem', `Found line {${theLine}}\n-> changed line: {${changedLine}}`)
          thePara.content = changedLine
          const thisNote = thePara.note
          if (thisNote) {
            thisNote.updateParagraph(thePara)
            logDebug('bridgeClickDashboardItem', `- appeared to update line OK -> {${changedLine}}`)

            // Ask for cache refresh for this note
            DataStore.updateCache(thisNote, false)

            // refresh whole display, as we don't know which if any section the moved task might need to be added to
            logDebug('bridgeClickDashboardItem', `------------ refresh ------------`)
            await showDashboardReact()
          } else {
            logWarn('bridgeClickDashboardItem', `- can't find note to update to {${changedLine}}`)
          }
        }
        break
      }
      default: {
        logWarn('bridgeClickDashboardItem', `bridgeClickDashboardItem: can't yet handle type ${type}`)
      }
    }

    if (result) await processActionOnReturn(result, data) // process all actions based on result of handler

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
  const actionsOnSuccess = handlerResult.actionsOnSuccess ?? []
  const { success, updatedParagraph } = handlerResult
  const { filename, itemID } = data // TODO: ?? '<unknown filename>'
  const thisNote = getNoteByFilename(filename)
  clo(handlerResult, 'processActionOnReturn: handlerResult')
  // always update the cache for the note, as it might have changed
  const changedNote = DataStore.updateCache(thisNote)

  if (success) {
    // const { filename, content } = data.item.para
    const { filename } = data
    const updatedNote = DataStore.updateCache(getNoteByFilename(filename), false)

    if (actionsOnSuccess.includes('REMOVE_LINE')) {
      logDebug('bCDI / processActionOnReturn', `REMOVE_LINE ... *not yet implemented*`)
      // TODO: 
    }
    if (actionsOnSuccess.includes('UPDATE_CONTENT')) {
      logDebug('bCDI / processActionOnReturn', `UPDATE_CONTENT to {${updatedParagraph?.content ?? '(error)'}}: calling updateReactWindow..()`)
      await updateReactWindowFromHandlerResult(handlerResult, data, ['para.content'])
    }
    if (actionsOnSuccess.includes('REFRESH_JSON')) {
      // TODO: add sectionType to types?
      const thisSectionType = data.sectionType
      logDebug('bCDI / processActionOnReturn', `REFRESH_JSON: calling getSomeSectionsData(['${thisSectionType}']`)
      const newData = getSomeSectionsData([thisSectionType])
      // TODO(@dwertheimer): what now?
    }
  } else {
    logDebug('bCDI / processActionOnReturn', `-> failed handlerResult: ${JSP(handlerResult)}`)
  }
}

/**
 * Update React window data based on the result of handling item content update.
 * @param {TBridgeClickHandlerResult} res The result of handling item content update.
 * @param {MessageDataObject} data The data of the item that was updated.
 * @param {string[]} fieldPathsToUpdate The field paths to update in React window data -- paths are in SectionItem fields (e.g. "ID" or "para.content")
 * @returns {Promise<void>} A Promise that resolves once the update is done.
 */
export async function updateReactWindowFromHandlerResult(res: TBridgeClickHandlerResult, data: MessageDataObject, fieldPathsToUpdate: string[]): Promise<void> {
  clo(res, 'updateReactWindow: res')
  const { errorMsg, success, updatedParagraph } = res
  const { ID } = data.item
  const { content: oldContent, filename: oldFilename } = data.item.para
  clo(res.updatedParagraph, 'updateReactWindow: res.updatedParagraph:')
  if (success) {
    const newPara = updatedParagraph || ''
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    let sections = reactWindowData.pluginData.sections // this is a reference so we can overwrite it later
    const indexes = findSectionItems(sections, ['itemType', 'itemFilename', 'para.content'], { itemType: /open|checklist/, itemFilename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)
    clo(indexes, 'updateReactWindow: matching indexes found')

    if (indexes.length) {
      const { sectionIndex, itemIndex } = indexes[0]
      clo(indexes, 'updateReactWindow: indexes to update')
      clo(sections[sectionIndex].sectionItems[itemIndex], `updateReactWindow old JSON item ${ID} sections[${sectionIndex}].sectionItems[${itemIndex}]`)
      logDebug('updateReactWindow', `should update sections[${sectionIndex}].sectionItems[${itemIndex}] to "${newPara.content}"`)
      sections = copyUpdatedSectionItemData(indexes, fieldPathsToUpdate, { para: newPara }, sections)
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
/**
 * Refresh the data in the HTML view - JSON only
 * And tell the React window to update the data
 */
export async function refreshData() {
  // TODO(@dwertheimer): I'm not sure that ...global... is the best name. Can we discuss?
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  reactWindowData.pluginData.sections = await getAllSectionsData(reactWindowData.demoMode)
  // TODO(@dwertheimer): Do we need this .lastUpdated as well as TSection.generated?
  reactWindowData.pluginData.lastUpdated = new Date().toLocaleString()
  await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'UPDATE_DATA', reactWindowData, `Refreshing JSON data`)
}
