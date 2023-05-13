// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 27.3.2023 for v0.3.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { getNPWeekStr, getTodaysDateUnhyphenated, RE_DATE_TIME } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { completeItem, getParagraphFromStaticObject, highlightParagraphInEditor } from '@helpers/NPParagraph'

//-----------------------------------------------------------------
// Data types

type MessageDataObject = { itemID: string, type: string, filename: string, rawContent: string }

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export function onMessageFromHTMLView(type: string, data: MessageDataObject): any {
  try {
    logDebug(pluginJson, `onMessageFromHTMLView dispatching data to ${type}`)
    switch (type) {
      case 'onClickDashboardItem':
        onClickDashboardItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
    }
    return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a something in the HTML view
 * @param {MessageDataObject} data - details of the item clicked
 * onClickDashboardItem: invalid data:
 */
export async function onClickDashboardItem(data: MessageDataObject) {
  try {
    const { itemID, type, filename, rawContent } = data
    logDebug(pluginJson, `pluginToHTMLBridge/onClickDashboardItem starting with type: ${type}, itemID: ${itemID}, filename: ${filename}, rawContent: <${rawContent}>`)
    if (type === 'open') {
      const res = completeItem(filename, rawContent)
      if (res) {
        logDebug(pluginJson, `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
        sendToHTMLWindow('completeTask', data)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
        await showDashboardHTML()
      }
    }
    else if (type === 'todoCancel') {
      const res = cancelItem(filename, rawContent)
      if (res) {
        logDebug(pluginJson, `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
        sendToHTMLWindow('todoChecklist', data)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
        await showDashboardHTML()
      }
    }
    else if (type === 'checklist') {
      const res = completeItem(filename, rawContent)
      if (res) {
        logDebug(pluginJson, `-> successful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
        sendToHTMLWindow('completeChecklist', data)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to completeItem(). Will trigger a refresh of the dashboard.`)
        await showDashboardHTML()
      }
    }
    else if (type === 'checklistCancel') {
      const res = cancelItem(filename, rawContent)
      if (res) {
        logDebug(pluginJson, `-> successful call to cancelItem(), so will now attempt to remove the row in the displayed table too`)
        sendToHTMLWindow('cancelChecklist', data)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to cancelItem(). Will trigger a refresh of the dashboard.`)
        await showDashboardHTML()
      }
    }
    else if (type === 'review') {
      // Handle a review call simply by opening the note in the main Editor. Later it might get more interesting!
      const note = await Editor.openNoteByFilename(filename)
      if (note) {
        logDebug(pluginJson, `-> successful call to open filename ${filename} in Editor`)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to open filename ${filename} in Editor`)
      }
    }
    else if (type === 'windowResized') {
      logDebug(pluginJson, `windowResized triggered on plugin side`)
      // TODO: something more useful
    }
    else if (type === 'showNoteInEditorFromFilename') {
      // Handle a show note call simply by opening the note in the main Editor.
      const note = await Editor.openNoteByFilename(filename)
      if (note) {
        logDebug(pluginJson, `-> successful call to open filename ${filename} in Editor`)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to open filename ${filename} in Editor`)
      }
    }
    else if (type === 'showNoteInEditorFromTitle') {
      // Handle a show note call simply by opening the note in the main Editor
      // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
      const wantedTitle = decodeURIComponent(filename)
      const note = await Editor.openNoteByTitle(wantedTitle)
      if (note) {
        logDebug(pluginJson, `-> successful call to open title ${wantedTitle} in Editor`)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to open title ${wantedTitle} in Editor`)
      }
    }
    else if (type === 'showLineInEditorFromFilename') {
      // Handle a show line call simply by opening the note in the main Editor, and then finding and highlighting the line.
      const note = await Editor.openNoteByFilename(filename)
      if (note) {
        // decode rawContent and pass to highlightParagraphInEditor()
        logDebug(pluginJson, `raw in ${data.rawContent}`)
        const decodedRawContent = decodeURIComponent(data.rawContent)
        logDebug(pluginJson, `raw decoded ${decodedRawContent}`)
        const res = highlightParagraphInEditor({ filename: filename, rawContent: decodedRawContent })
        logDebug(pluginJson, `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`)
      }
    }
    else if (type === 'showLineInEditorFromTitle') {
      // Handle a show line call simply by opening the note in the main Editor, and then finding and highlighting the line.
      // Note: different from above as the third parameter is overloaded to pass wanted note title (encoded)
      const wantedTitle = decodeURIComponent(filename)
      const note = await Editor.openNoteByTitle(wantedTitle)
      if (note) {
        // decode rawContent and pass to highlightParagraphInEditor()
        logDebug(pluginJson, `raw in ${data.rawContent}`)
        const decodedRawContent = decodeURIComponent(data.rawContent)
        logDebug(pluginJson, `raw decoded ${decodedRawContent}`)
        const res = highlightParagraphInEditor({ filename: note.filename, rawContent: decodedRawContent })
        logDebug(pluginJson, `-> successful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccessful'} call to highlight the paragraph in the editor`)
      } else {
        logWarn(pluginJson, `-> unsuccessful call to open title ${wantedTitle} in Editor`)
      }
    } else {
      logWarn(pluginJson, `onClickDashboardItem: can't yet handle type ${type}`)
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
  //   logError(pluginJson, `onClickStatus: could not find paragraph for filename:${filename}, lineIndex:${lineIndex}`)
  // }
  } catch (error) {
    logError(pluginJson, 'onClickDashboardItem:' + JSP(error))
  }
}
