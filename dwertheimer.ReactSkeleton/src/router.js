// @flow
//--------------------------------------------------------------------------
// ReactSkeleton Router
// Routes actions from React components to appropriate handlers
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { handleRequest } from './requestHandlers'
import { createRouter, type RequestResponse } from '@helpers/react/routerUtils'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { logDebug, logError, logWarn, clo } from '@helpers/dev'
import { type PassedData } from './reactMain'

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} React Window`

/**
 * Route REQUEST type actions to appropriate handlers
 * 
 * This function is called when React sends a request using the request/response pattern
 * (via requestFromPlugin). It routes the request to the appropriate handler in requestHandlers.js.
 *
 * @param {string} actionType - The action/command type (e.g., 'getFolders', 'getTeamspaces')
 * @param {any} data - Request data with parameters
 * @returns {Promise<RequestResponse>} - Standardized response from handler
 */
async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  // Route to request handlers
  return await handleRequest(actionType, data)
}

/**
 * Handle non-REQUEST actions (legacy action-based pattern)
 * 
 * This function is called when React sends an action using sendActionToPlugin (not requestFromPlugin).
 * These are fire-and-forget actions that don't need a response, or actions that update the React window
 * by sending new data back via sendToHTMLWindow.
 *
 * Examples:
 * - 'onSubmitClick' - User clicked a submit button
 * - 'cancel' - User cancelled the window
 * - 'updateData' - Update some data in the window
 *
 * @param {string} actionType - The action type (usually the command name like 'onMessageFromHTMLView')
 * @param {any} data - Action data, may contain an actual action type in data.type
 * @returns {Promise<any>} - Usually returns empty object
 */
async function handleNonRequestAction(actionType: string, data: any): Promise<any> {
  logDebug(pluginJson, `handleNonRequestAction: actionType="${actionType}"`)
  clo(data, `handleNonRequestAction: data=`)

  // Get window ID from data (passed from React), or fall back to default
  const windowId = data?.__windowId || WEBVIEW_WINDOW_ID
  logDebug(pluginJson, `handleNonRequestAction: Using windowId="${windowId}"`)

  // Get current window data
  let reactWindowData: PassedData | null = null
  try {
    reactWindowData = await getGlobalSharedData(windowId)
  } catch (e) {
    logError(pluginJson, `handleNonRequestAction: Could not get window data for windowId: ${windowId}`)
    return {}
  }

  // Handle passthrough variables (e.g., scroll position)
  if (data?.passThroughVars && reactWindowData) {
    reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
  }

  // The actual action type might be in data.type (if React sent { type: 'onSubmitClick', ... })
  // or it might be the actionType itself
  const actualActionType = data?.type || actionType

  // Route to appropriate handler based on action type
  switch (actualActionType) {
    case 'onSubmitClick':
      reactWindowData = await handleSubmitButtonClick(data, reactWindowData)
      break
    case 'cancel':
      logDebug(pluginJson, `handleNonRequestAction: User cancelled, closing window`)
      closeWindowFromCustomId(windowId)
      return {}
    default:
      logWarn(pluginJson, `handleNonRequestAction: Unknown action type: "${actualActionType}"`)
      await sendBannerMessage(
        windowId,
        `Plugin received an unknown actionType: "${actualActionType}" command with data:\n${JSON.stringify(data)}`,
        'ERROR',
      )
      break
  }

  // If window data was updated, send it back to React to trigger re-render
  if (reactWindowData) {
    const updateText = `After ${actualActionType}, data was updated`
    clo(reactWindowData, `handleNonRequestAction: Updated reactWindowData=`)
    sendToHTMLWindow(windowId, 'SET_DATA', reactWindowData, updateText)
  }

  return {}
}

/**
 * Example handler for submit button click
 * 
 * This is an example handler that demonstrates how to handle non-REQUEST actions.
 * Replace this with your own handlers based on your plugin's needs.
 *
 * @param {any} data - The data sent from React (e.g., { index: 0 })
 * @param {PassedData} reactWindowData - The current data in the React window
 * @returns {Promise<PassedData>} - Updated window data to send back to React
 */
async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<PassedData> {
  const { index: clickedIndex } = data

  await sendBannerMessage(
    WEBVIEW_WINDOW_ID,
    `Plugin received an actionType: "onSubmitClick" command with data:<br/>${JSON.stringify(data)}.<br/>Plugin then fired this message over the bridge to the React window and changed the data in the React window.`,
    'INFO',
    2000,
  )

  clo(reactWindowData, `handleSubmitButtonClick: reactWindowData BEFORE update`)

  // Example: Update the data in the React window for the row that was clicked
  if (reactWindowData.pluginData?.tableRows) {
    const index = reactWindowData.pluginData.tableRows.findIndex((row: any) => row.id === clickedIndex)
    if (index >= 0) {
      reactWindowData.pluginData.tableRows[index].textValue = `Item ${clickedIndex} was updated by the plugin (see changed data in the debug section below)`
    }
  }

  return reactWindowData
}

/**
 * Handle actions from React components
 * 
 * This is the main router function that handles both REQUEST and non-REQUEST actions.
 * It uses the createRouter utility from @helpers/react/routerUtils to handle the routing logic.
 *
 * REQUEST PATTERN (requestFromPlugin):
 * - React calls: await requestFromPlugin('getFolders', { excludeTrash: true })
 * - Router routes to: routeRequest('getFolders', { excludeTrash: true, __correlationId: '...', ... })
 * - Handler returns: { success: true, data: [...] }
 * - Router sends RESPONSE message back to React
 * - React's promise resolves with the data
 *
 * ACTION PATTERN (sendActionToPlugin):
 * - React calls: sendActionToPlugin('onSubmitClick', { index: 0 })
 * - Router routes to: handleNonRequestAction('onMessageFromHTMLView', { type: 'onSubmitClick', index: 0 })
 * - Handler updates window data and sends it back via sendToHTMLWindow
 * - React re-renders with new data
 *
 * @param {string} actionType - The action/command type
 * @param {any} data - Request/action data with optional __requestType, __correlationId, __windowId
 * @returns {Promise<any>} - Empty object (responses are sent via sendToHTMLWindow)
 */
export const onMessageFromHTMLView: (actionType: string, data: any) => Promise<any> = createRouter({
  routerName: 'onMessageFromHTMLView',
  defaultWindowId: WEBVIEW_WINDOW_ID,
  routeRequest: routeRequest,
  handleNonRequestAction: handleNonRequestAction,
  pluginJson: pluginJson,
})




