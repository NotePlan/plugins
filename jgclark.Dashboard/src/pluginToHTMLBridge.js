// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 14.6.2023 for v0.5.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { getNPWeekStr, getTodaysDateUnhyphenated, RE_DATE_TIME } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { cancelItem, completeItem, getParagraphFromStaticObject, highlightParagraphInEditor } from '@helpers/NPParagraph'
import { decodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { applyRectToWindow, getLiveWindowRectFromWin, getWindowFromCustomId, logWindowsList, rectToString } from '@helpers/NPWindows'

//-----------------------------------------------------------------
// Data types + constants

type MessageDataObject = { itemID: string, type: string, encodedFilename: string, encodedContent: string }
type SettingDataObject = { settingName: string, state: string }

const windowCustomId = 'Dashboard'

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export function onMessageFromHTMLView(type: string, data: any): any {
  try {
    logDebug(pluginJson, `onMessageFromHTMLView dispatching data to ${type}:`)
    // clo(data, 'onMessageFromHTMLView dispatching data object:')
    switch (type) {
      case 'onClickDashboardItem':
        bridgeClickDashboardItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
      case 'onChangeCheckbox':
        bridgeChangeCheckbox(data) // data is a string
        break
      case 'refresh':
        showDashboardHTML() // TEST: no await needed?
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
    clo(data, 'bridgeChangeChecbox received data object')
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
    const ID = data.itemID
    const type = data.type
    const filename = decodeRFC3986URIComponent(data.encodedFilename)
    const content = decodeRFC3986URIComponent(data.encodedContent)
    logDebug('bridgeClickDashboardItem', `- ID: ${ID}, type: ${type}, filename: ${filename}, content: <${content}>`)
    switch (type) {
      case 'completeTask': {
        const res = completeItem(filename, content)
        if (res) {
          logDebug('bridgeClickDashboardItem', `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow('completeTask', data)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
          await showDashboardHTML()
        }
        break
      }
      case 'cancelTask': {
        const res = cancelItem(filename, content)
        if (res) {
          logDebug('bridgeClickDashboardItem', `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow('cancelTask', data)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
          await showDashboardHTML()
        }
        break
      }
      case 'completeChecklist': {
        const res = completeItem(filename, content)
        if (res) {
          logDebug('bridgeClickDashboardItem', `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow('completeChecklist', data)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
          await showDashboardHTML()
        }
        break
      }
      case 'cancelChecklist': {
        const res = cancelItem(filename, content)
        if (res) {
          logDebug('bridgeClickDashboardItem', `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
          sendToHTMLWindow('cancelChecklist', data)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
          await showDashboardHTML()
        }
        break
      }
      case 'review': {
        // Handle a review call simply by opening the note in the main Editor. Later it might get more interesting!
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          logDebug('bridgeClickDashboardItem', `-> successful call to open filename ${filename} in Editor`)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open filename ${filename} in Editor`)
        }
        break
      }
      case 'windowResized': {
        // logWindowsList()
        logDebug('bridgeClickDashboardItem', `windowResized triggered on plugin side (hopefully for '${windowCustomId}')`)
        clo(data)
        const thisWin = getWindowFromCustomId(windowCustomId)
        // const rect = getLiveWindowRectFromWin(thisWin)
        const rect: Rect = JSON.parse(content)
        clo(rect)
        if (rect) {
          logDebug('oCDI/windowResized', rectToString(rect))
          applyRectToWindow(rect)
        }
        break
      }
      case 'showNoteInEditorFromFilename': {
        // Handle a show note call simply by opening the note in the main Editor.
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
        // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
        // TEST: decoding not needed now? 7.6.23
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
        // Handle a show line call simply by opening the note in the main Editor, and then finding and highlighting the line.
        const note = await Editor.openNoteByFilename(filename)
        if (note) {
          // decode content and pass to highlightParagraphInEditor()
          // TEST: decoding not needed now? 7.6.23
          logDebug('bridgeClickDashboardItem', `raw decoded ${content}`)
          const res = highlightParagraphInEditor({ filename: filename, content: content })
          logDebug('bridgeClickDashboardItem', `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`)
        }
        break
      }
      case 'showLineInEditorFromTitle': {
        // Handle a show line call simply by opening the note in the main Editor, and then finding and highlighting the line.
        // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
        const wantedTitle = decodeURIComponent(filename)
        const note = await Editor.openNoteByTitle(wantedTitle)
        if (note) {
          // decode content and pass to highlightParagraphInEditor()
          // TEST: decoding not needed now? 7.6.23
          logDebug('bridgeClickDashboardItem', `raw decoded ${content}`)
          const res = highlightParagraphInEditor({ filename: note.filename, content: content })
          logDebug('bridgeClickDashboardItem', `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`)
        } else {
          logWarn('bridgeClickDashboardItem', `-> unsuccessful call to open title ${wantedTitle} in Editor`)
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
    //   sendToHTMLWindow('updateDiv', { divID: lineID, html: newDivContent, innerText: false })
    //   // NOTE: in this particular case, it might have been easier to just call the refresh-page command, but I thought it worthwhile
    //   // to show how to update a single div in the HTML view
    // } else {
    //   logError('bridgeClickDashboardItem', `onClickStatus: could not find paragraph for filename:${filename}, lineIndex:${lineIndex}`)
    // }
  } catch (error) {
    logError(pluginJson, 'pluginToHTMLBridge / bridgeClickDashboardItem:' + error.message)
  }
}
