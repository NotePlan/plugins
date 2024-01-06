// @flow
//-----------------------------------------------------------------------------
// Bridging functions for Dashboard plugin
// Last updated 4.1.2024 for v0.7.5 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './main'
import { skipReviewForNote } from '../../jgclark.Reviews/src/reviews'
import {
  calcOffsetDateStr,
  getNPWeekStr,
  getDateStringFromCalendarFilename,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  RE_DATE_INTERVAL,
  RE_DATE_TIME,
  RE_NP_WEEK_SPEC,
  replaceArrowDatesInString,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { getNoteByFilename } from '@helpers/note'
import { cyclePriorityState, getTaskPriority } from '@helpers/paragraph'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import {
  cancelItem,
  completeItem,
  completeItemEarlier,
  findParaFromStringAndFilename,
  getParagraphFromStaticObject,
  highlightParagraphInEditor,
  moveItemBetweenCalendarNotes,
  toggleTaskChecklistParaType,
  unscheduleItem,
} from '@helpers/NPParagraph'
import { applyRectToWindow, getLiveWindowRectFromWin, getWindowFromCustomId, logWindowsList, rectToString, storeWindowRect, getWindowIdFromCustomId } from '@helpers/NPWindows'
import { decodeRFC3986URIComponent } from '@helpers/stringTransforms'

//-----------------------------------------------------------------
// Data types + constants

type MessageDataObject = { itemID: string, type: string, encodedFilename: string, encodedContent: string, controlStr: string }
type SettingDataObject = { settingName: string, state: string }

const windowCustomId = pluginJson['plugin.id'] + '.main'

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export async function onMessageFromHTMLView(type: string, data: any): any {
  try {
    logDebug(pluginJson, `onMessageFromHTMLView dispatching data to ${type}:`)
    // clo(data, 'onMessageFromHTMLView dispatching data object:')
    switch (type) {
      case 'onClickDashboardItem':
        await bridgeClickDashboardItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
      case 'onChangeCheckbox':
        await bridgeChangeCheckbox(data) // data is a string
        break
      case 'refresh':
        await showDashboardHTML() // no await needed, I think
        break
      default:
        logError(pluginJson, `onMessageFromHTMLView(): unknown ${type} cannot be dispatched`)
        break
    }
    return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
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
    // clo(data, 'bridgeChangeChecbox received data object')
    const { settingName, state } = data
    logDebug('pluginToHTMLBridge/bridgeChangeCheckbox', `- settingName: ${settingName}, state: ${state}`)
    DataStore.setPreference('Dashboard-filterPriorityItems', state)
    // having changed this pref, refresh the dashboard
    await showDashboardHTML()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a something in the HTML view
 * @param {MessageDataObject} data - details of the item clicked
 */
export async function bridgeClickDashboardItem(data: MessageDataObject) {
  try {
    clo(data, 'bridgeClickDashboardItem received data object')
    // const windowId = getWindowIdFromCustomId(windowCustomId);
    const windowId = windowCustomId
    if (!windowId) {
      logError('bridgeClickDashboardItem', `Can't find windowId for ${windowCustomId}`)
      return
    }
    const ID = data.itemID
    const type = data.type
    const filename = decodeRFC3986URIComponent(data.encodedFilename ?? '')
    const content = decodeRFC3986URIComponent(data.encodedContent ?? '')
    logDebug('', '------------------------- bridgeClickDashboardItem:')
    logInfo('bridgeClickDashboardItem', `ID: ${ID}, type: ${type}, filename: ${filename}, content: {${content}}`)
    switch (type) {
      case 'completeTask': {
        // Complete the task in the actual Note
        const res = completeItem(filename, content)
        // Ask for cache refresh for this note. (Can't now remember why this is needed.)
        DataStore.updateCache(getNoteByFilename(filename), false)

        // Update display in Dashboard too
        if (res) {
          logDebug('bCDI / completeTask', `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow(windowId, 'completeTask', data)
        } else {
          logWarn('bCDI / completeTask', `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
          logDebug('bCDI', '---------------- refresh ---------------')
          await showDashboardHTML()
        }
        break
      }
      case 'completeTaskThen': {
        // Complete the task in the actual Note, but with the date it was scheduled for
        const res = completeItemEarlier(filename, content)
        // Ask for cache refresh for this note
        DataStore.updateCache(getNoteByFilename(filename), false)

        // Update display in Dashboard too
        if (res) {
          logDebug('bCDI / completeTaskThen', `-> successful call to completeItemEarlier(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow(windowId, 'completeTask', data)
        } else {
          logWarn('bCDI / completeTaskThen', `-> unsuccessful call to completeItemEarlier(). Will trigger a refresh of the dashboard.`)
          logDebug('bCDI', '---------------- refresh ---------------')
          await showDashboardHTML('refresh')
        }
        break
      }
      case 'cancelTask': {
        // Cancel the task in the actual Note
        const res = cancelItem(filename, content)
        // Ask for cache refresh for this note
        DataStore.updateCache(getNoteByFilename(filename), false)

        // Update display in Dashboard too
        if (res) {
          logDebug('bCDI / cancelTask', `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow(windowId, 'cancelTask', data)
        } else {
          logWarn('bCDI / cancelTask', `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
          logDebug('bCDI', '---------------- refresh ---------------')
          await showDashboardHTML('refresh')
        }
        break
      }
      case 'completeChecklist': {
        // Complete the checklist in the actual Note
        const res = completeItem(filename, content)
        // Ask for cache refresh for this note
        DataStore.updateCache(getNoteByFilename(filename), false)

        // Update display in Dashboard too
        if (res) {
          logDebug('bCDI / completeChecklist', `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow(windowId, 'completeChecklist', data)
        } else {
          logWarn('bCDI / completeChecklist', `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
          logDebug('bCDI', '---------------- refresh ---------------')
          await showDashboardHTML('refresh')
        }
        break
      }
      case 'cancelChecklist': {
        // Cancel the checklist in the actual Note
        const res = cancelItem(filename, content)
        // Ask for cache refresh for this note
        DataStore.updateCache(getNoteByFilename(filename), false)

        // Update display in Dashboard too
        if (res) {
          logDebug('bCDI / cancelChecklist', `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow(windowId, 'cancelChecklist', data)
        } else {
          logWarn('bCDI / cancelChecklist', `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
          logDebug('bCDI', '---------------- refresh ---------------')
          await showDashboardHTML('refresh')
        }
        break
      }
      case 'toggleType': {
        // Send a request to toggleType to plugin
        // logDebug('bCDI / toggleType', `-> placeholder for toggleType on ID ${ID} in filename ${filename}`)
        const res = toggleTaskChecklistParaType(filename, content)

        // Update display in Dashboard too
        sendToHTMLWindow(windowId, 'toggleType', data)
        break
      }
      case 'cyclePriorityState': {
        // Send a request to cyclePriorityState to plugin

        // Get para
        const para = findParaFromStringAndFilename(filename, content)
        if (para && typeof para !== 'boolean') {
          const paraContent = para.content ?? 'error'
          // logDebug('bCDI / cyclePriorityState', `will cycle priority on para {${paraContent}}`)
          // Note: next 2 lines have to be this way around, otherwise a race condition
          const newPriority = (getTaskPriority(paraContent) + 1) % 5
          const updatedContent = cyclePriorityState(para)
          logDebug('bCDI / cyclePriorityState', `cycling priority -> {${updatedContent}}`)

          // Ideally we would update the content in place, but so much of the logic for this is unhelpfully on the plugin side (main.js::) it is simpler to ask for a refresh. = await showDashboardHTML('refresh')
          // Note: But this doesn't work, because of race condition.
          // So we better try that logic after all.
          const updatedData = {
            itemID: ID,
            newContent: updatedContent,
            newPriority: newPriority
          }
          sendToHTMLWindow(windowId, 'cyclePriorityState', updatedData)
        } else {
          logWarn('bCDI / cyclePriorityState', `-> unable to find para {${content}} in filename ${filename}`)
        }
        break
      }
      case 'unscheduleItem': {
        // Send a request to unscheduleItem to plugin
        logDebug('bCDI / unscheduleItem', `-> unscheduleItem on ID ${ID} in filename ${filename}`)
        const res = unscheduleItem(filename, content)
        logDebug('bCDI / unscheduleItem', `  -> result ${String(res)}`)

        // Update display in Dashboard too
        sendToHTMLWindow(windowId, 'unscheduleItem', data)
        break
      }
      case 'review': {
        // Handle a review call simply by opening the note in the main Editor. Later it might get more interesting!
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          logDebug('bCDI / review', `-> successful call to open filename ${filename} in Editor`)
        } else {
          logWarn('bCDI / review', `-> unsuccessful call to open filename ${filename} in Editor`)
        }
        break
      }
      case 'setNextReviewDate': {
        // Handle a review call simply by opening the note in the main Editor. Later it might get more interesting!
        const note = await DataStore.projectNoteByFilename(filename)
        if (note) {
          logDebug('bCDI / setNextReviewDate', `-> will skip review by '${period}' for filename ${filename}.`)
          let period = data.controlStr.replace('skip', '')
          skipReviewForNote(note, period)
          // Now send a message for the dashboard to update its display
          sendToHTMLWindow(windowId, 'removeItem', data)
        } else {
          logWarn('bCDI / setNextReviewDate', `-> couldn't get filename ${filename} to update next review date.`)
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
        // FIXME: Error in this call?
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

      case 'moveFromCalToCal': {
        // Instruction from a 'moveButton' to move task from calendar note to a different calendar note.
        // Note: Overloads ID with the dateInterval to use
        const dateInterval = data.controlStr
        let startDateStr = ''
        let newDateStr = ''
        if (dateInterval !== 't' && !dateInterval.match(RE_DATE_INTERVAL)) {
          logError('bridgeClickDashboardItem', `bad move date interval: ${dateInterval}`)
          break
        }
        if (dateInterval === 't') {
          // Special case to change to '>today'

          // FIXME: errors reported here from new Overdue section, where we don't have filename?
          startDateStr = getDateStringFromCalendarFilename(filename, true)
          newDateStr = getTodaysDateHyphenated()
          logDebug('bridgeClickDashboardItem', `move task from ${startDateStr} -> 'today'`)
        } else if (dateInterval.match(RE_DATE_INTERVAL)) {
          const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character

          // FIXME: errors reported here from new Overdue section, where we don't have filename?
          // Get the (ISO) current date on the task
          startDateStr = getDateStringFromCalendarFilename(filename, true)
          newDateStr = calcOffsetDateStr(startDateStr, dateInterval, 'offset') // 'longer'

          // But, we now know the above doesn't observe NP week start, so override with an NP-specific function where offset is of type 'week' but startDateStr is not of type 'week'
          // FIXME: can land up as "NaN-W01" because getNPWeekData() doesn't cope with weekly note titles
          if (offsetUnit === 'w' && !startDateStr.match(RE_NP_WEEK_SPEC)) {
            const offsetNum = Number(dateInterval.substr(0, dateInterval.length - 1)) // return all but last character
            // $FlowFixMe(incompatible-type)
            const NPWeekData: NotePlanWeekInfo = getNPWeekData(startDateStr, offsetNum, 'week')
            newDateStr = NPWeekData.weekString
            logDebug('bridgeClickDashboardItem', `- used NPWeekData instead -> ${newDateStr}`)
          }
          logDebug('bridgeClickDashboardItem', `move task from ${startDateStr} -> ${newDateStr}`)
        }
        // Do the actual move
        const res = moveItemBetweenCalendarNotes(startDateStr, newDateStr, content)
        if (res) {
          logDebug('bridgeClickDashboardItem', `-> appeared to move item succesfully`)
          // Unfortunately we seem to have a race condition here, as the following doesn't remove the item
          // await showDashboardHTML()
          // So instead send a message to delete the row in the dashboard
          sendToHTMLWindow(windowId, 'removeItem', { ID: ID })
        } else {
          logWarn('bridgeClickDashboardItem', `-> moveFromCalToCal to ${newDateStr} not successful`)
        }
        break
      }

      case 'updateTaskDate': {
        // Instruction from a 'changeDateButton' to change date on a task (in a project note)
        const dateInterval = data.controlStr
        let startDateStr = ''
        let newDateStr = ''
        if (dateInterval !== 't' && !dateInterval.match(RE_DATE_INTERVAL)) {
          logError('bridgeClickDashboardItem', `bad move date interval: ${dateInterval}`)
          break
        }
        if (dateInterval === 't') {
          // Special case to change to '>today'
          newDateStr = 'today'
          logDebug('bridgeClickDashboardItem', `move task in ${filename} -> 'today'`)
        } else if (dateInterval.match(RE_DATE_INTERVAL)) {
          const offsetUnit = dateInterval.charAt(dateInterval.length - 1) // get last character
          // Get today's date, ignoring current date on task. Note: this means we always start with a *day* base date, not week etc.
          let startDateStr = getTodaysDateHyphenated()
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
            await showDashboardHTML()
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
    logError(pluginJson, `pluginToHTMLBridge / bridgeClickDashboardItem: ${error.message}`)
  }
}
