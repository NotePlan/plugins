// @flow
//--------------------------------------------------------------------------
// Router for REQUEST/RESPONSE pattern from React
// Routes requests to appropriate handlers in requestHandlers folder
// Uses newCommsRouter from @helpers/react/routerUtils for shared scaffolding
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { WEBVIEW_WINDOW_ID } from './constants'
import { addTaskToNote } from './requestHandlers/addTaskToNote'
import { bridgeClickDashboardItem } from './pluginToHTMLBridge'
import { getGlobalSharedData, sendToHTMLWindow } from '@helpers/HTMLView'
import { logDebug, logError } from '@helpers/dev'
import { newCommsRouter } from '@helpers/react/routerUtils'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Route REQUEST type actions to appropriate handlers
 * Uses async/await pattern - handlers can return values directly (no Promise.resolve needed)
 * Use await to support both sync and async handlers
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data
 * @returns {Promise<RequestResponse>}
 */
async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `[Dashboard/routeRequestsFromReact] routeRequest: actionType="${actionType}"`)

    switch (actionType) {
      case 'addTaskToNote': {
        return await addTaskToNote(data, pluginJson)
      }
      default: {
        // Return "not found" to trigger shared handler fallback
        return {
          success: false,
          message: `Unknown request type: "${actionType}"`,
          data: null,
        }
      }
    }
  } catch (error) {
    logError(pluginJson, `[Dashboard/routeRequestsFromReact] routeRequest ERROR: actionType="${actionType}", error="${error.message}"`)
    return {
      success: false,
      message: `Error handling request: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle non-REQUEST actions (using sendActionToPlugin)
 * @param {string} actionType - The action type
 * @param {any} data - Action data
 * @returns {Promise<any>}
 */
async function handleNonRequestAction(actionType: string, data: any): Promise<any> {
  try {
    // For non-REQUEST actions, use the existing bridgeClickDashboardItem pattern
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID) // get the current data from the React Window
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    const dataToSend = { ...data }
    if (!dataToSend.actionType) dataToSend.actionType = actionType
    switch (actionType) {
      case 'SHOW_BANNER': {
        await sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SHOW_BANNER', dataToSend)
        break
      }
      // Note: SO THAT JGCLARK DOESN'T HAVE TO RE-INVENT THE WHEEL HERE, WE WILL JUST CALL THE PRE-EXISTING FUNCTION bridgeDashboardItem
      // every time
      default: {
        const _newData = (await bridgeClickDashboardItem(dataToSend)) || reactWindowData // the processing function can update the reactWindowData object and return it
        break
      }
    }

    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, `[Dashboard/routeRequestsFromReact] handleNonRequestAction ERROR: actionType="${actionType}", error="${error.message}"`)
    return {}
  }
}

/**
 * Router function that receives requests from the React Window and routes them to the appropriate function
 * Uses newCommsRouter for shared REQUEST/RESPONSE handling with automatic fallback to np.Shared handlers
 * @author @dwertheimer
 */
export const onMessageFromHTMLView: (actionType: string, data: any) => Promise<any> = newCommsRouter({
  routerName: 'Dashboard/routeRequestsFromReact',
  defaultWindowId: WEBVIEW_WINDOW_ID,
  routeRequest: routeRequest,
  handleNonRequestAction: handleNonRequestAction,
  pluginJson: pluginJson,
  useSharedHandlersFallback: true, // Enable automatic fallback to np.Shared handlers
})
