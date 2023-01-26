// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'

/**
 * Message action types
 * SET_TITLE - update the title of the HTML window (send {title: 'new title'} in the payload)
 * SHOW_BANNER - display a message in the top of the page (use the helper sendBannerMessage('message'))
 * SET_DATA - tell the HTML window to update its state with the data passed
 */

/**
 * Send some data to the HTML window (to be written to globalSharedData) using postMessage message passing
 * Note: we can (and do) write to globalSharedData directly, but we should try to use this function
 * to do so, because it will allow us to use message passing to update the state in the HTML window
 * which gives us more visibility into what's happening on the HTML side
 * @param {string - see above} actionType - the reducer-type action to be dispatched (tells the app how to act on the data passed)
 * @param {any} data - the data to be passed to the app (and ultimately to be written to globalSharedData)
 * @return {any} - the result of the runJavaScript call (should be unimportant in this case -- undefined is ok)
 * @author @dwertheimer
 */
export async function sendToHTMLWindow(actionType: string, data: any = {}): any {
  try {
    logDebug(`Bridge::sendToHTMLWindow`, `sending "${actionType}" data=${JSON.stringify(data)}`)
    const dataWithUpdated = { ...data, lastUpdated: { msg: actionType, date: new Date().toLocaleString() } }
    const result = await HTMLView.runJavaScript(`window.postMessage(
        { 
          type: '${actionType}', 
          payload: ${JSON.stringify(dataWithUpdated)} 
        }, 
        '*'
      );`)
    // logDebug(`Bridge::sendToHTMLWindow`, `result from the window: ${JSON.stringify(result)}`)
    return result
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Get the current state of globalSharedData from the HTML window (SHARED DATA MUST BE OBJECTS)
 * Returns actual object or undefined if the global var doesn't exist (along with some noisy log errors)
 * See notes above
 * NOTE: this function should only be called after the window has fully set up, the global var has been set
 * @param {string} varName - the name of the global variable to be updated (by default "globalSharedData")
 * @author @dwertheimer
 * @returns {Object} - the current state of globalSharedData
 */
export async function getGlobalSharedData(varName: string = 'globalSharedData'): any {
  try {
    const currentValue = await HTMLView.runJavaScript(`${varName};`)
    if (currentValue !== undefined) logDebug(`getGlobalSharedData`, `got ${varName}: ${JSON.stringify(currentValue)}`)
    return currentValue
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Generally, we will try not to update the global shared object directly, but instead use message passing
 * to let React update the state. But there will be times we need to update the state
 * from here (e.g. when we hit limits of message passing)
 * @param {any} data - the full object to be written to globalSharedData (SHARED DATA MUST BE OBJECTS)
 * @param {boolean} mergeData - if true (default), will merge the new data with the existing data, if false, will fully overwrite
 * @param {string} varName - the name of the global variable to be updated (by default "globalSharedData")
 * @author @dwertheimer
 * @returns {any} returns the result of the runJavaScript call, which in this case is typically identical to the data passed
 * ...and so can probably be ignored
 */
export async function updateGlobalSharedData(data: any, mergeData: boolean = true, varName: string = 'globalSharedData'): any {
  let newData
  const currentData = await getGlobalSharedData(varName)
  if (currentData === undefined) {
    logDebug(`updateGlobalSharedData`, `Variable ${varName} was not defined (creating it now)...ignore the WebView error above ^^^`)
    await HTMLView.runJavaScript(`let ${varName} = {};`) // create the global var if it doesn't exist
  }
  if (mergeData) {
    newData = { ...currentData, ...data }
  } else {
    newData = data
  }
  logDebug(`updateGlobalSharedData`, `writing globalSharedData (merged=${String(mergeData)}) to ${JSON.stringify(newData)}`)
  return await HTMLView.runJavaScript(`${varName} = JSON.parse(\`${JSON.stringify(newData)}\`);`)
}

/**
 * Send a warning message to the HTML window (displays a warning message at the top of page)
 * @param {string} message
 * @param {string} color https://www.w3schools.com/w3css/w3css_colors.asp
 * @param {string} border (left vertical stripe border of box) https://www.w3schools.com/w3css/w3css_colors.asp
 */
export async function sendBannerMessage(message: string, color: string = 'w3-pale-red', border: string = 'w3-border-red'): Promise<any> {
  return await sendToHTMLWindow('SHOW_BANNER', { warn: true, msg: message, color, border })
}

/**
 * Callback: Receives data from the HTML window (via postMessage message passing)
 * (assumes this function name was passed in the creation of the HTML window) using helpers/HTMLView.getCallbackCodeString()
 * Plugin entrypoint for "/onMessageFromHTMLView (callback from html)"
 * @author @dwertheimer
 */
export async function onMessageFromHTMLView(actionType: string = '', ...args: any): Promise<any> {
  try {
    clo(args, `onMessageFromHTMLView::received data from HTMLView; actionType:${actionType}`)
    // await showMessage(`onMessageFromHTMLView::incoming data: ${actionType}: ${args}`)

    // TODO: remove the following test code
    const newData = { title: `David\'s App updated ${new Date().toISOString()}`, startupData: { todos: ['todo1', 'todo2', 'todo3'] } }
    logDebug(`onMessageFromHTMLView`, `responding to HTML window with data ${JSON.stringify(newData)}`)
    // TODO: decide if we want to update the global shared data directly or use message passing
    // the following two lines will end up doing the same thing
    // await updateGlobalSharedData(newData, true)
    // await updateGlobalSharedData(newData, true)
    await sendBannerMessage(
      `onMessageFromHTMLView: Plugin received a message ("${actionType}") and sent back this message to the HTML window. (this is to demonstrate the round-trip)`,
    )
    // HTMLView.runJavaScript(`
    //   NPData = ${JSON.stringify(newData)};
    //   window.postMessage({ type: 'DATA_SET', NPData }, '*'})
    //   window.dispatchEvent(new Event('incomingData'));
    // `)
    return { message: 'onMessageFromHTMLView::return statement after runJavascript data blah blah blah' }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
