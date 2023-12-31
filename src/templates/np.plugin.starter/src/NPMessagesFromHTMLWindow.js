// @flow
/**
 * This file receives and processes messages from the HTML view
 * You can ignore it if you are not going to use any HTML popup windows
 * If you do want to use HTML windows, read the notes at the top of _requiredFiles/html-plugin-comms.js
 *
 * The function onClickStatus below is just an example of a function that could be called from the HTML view
 */

import pluginJson from '../plugin.json'

// ID needs match the custom id you pass when you open the window
const WINDOW_CUSTOM_ID = `${pluginJson['plugin.id']} HTML Window` // change if you want to use multiple html windows

// import { getWindowIdFromCustomId } from '@helpers/NPWindows'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { getParagraphFromStaticObject } from '@helpers/NPParagraph'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

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
    logDebug(pluginJson, `onMessageFromHTMLView running with args:${JSP(data)}`)
    switch (type) {
      case 'onClickStatus':
        onClickStatus(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
    }
    return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

type ClickStatus = { filename: string, lineIndex: number, statusWas: string, lineID: string }

/**
 * Somebody clicked on a status icon in the HTML view
 * (this is just a sample function called by the router - onMessageFromHTMLView() above)
 * @param {ClickStatus} data - details of the item clicked
 */
export function onClickStatus(data: ClickStatus) {
  const { filename, lineIndex, statusWas, lineID } = data
  logDebug(pluginJson, `Plugin: onClickStatus running with statusWas:${statusWas}, filename:${filename}, lineIndex:${lineIndex}, statusWas:${statusWas}`)
  const para = getParagraphFromStaticObject(data, ['filename', 'lineIndex'])
  if (para) {
    // you can do whatever you want here. For example, you could change the status of the paragraph
    // to done depending on whether it was an open task or a checklist item
    para.type = statusWas === 'open' ? 'done' : 'checklistDone'
    para.note?.updateParagraph(para)
    const newDivContent = `<td>"${para.type}"</td><td>Paragraph status was updated by the plugin!</td>`
    if (WINDOW_CUSTOM_ID) {
      sendToHTMLWindow(WINDOW_CUSTOM_ID, 'updateDiv', { divID: lineID, html: newDivContent, innerText: false })
    }
    // NOTE: in this particular case, it might have been easier to just call the refresh-page command, but I thought it worthwhile
    // to show how to update a single div in the HTML view
  } else {
    logError(pluginJson, `onClickStatus: could not find paragraph for filename:${filename}, lineIndex:${lineIndex}`)
  }
}
