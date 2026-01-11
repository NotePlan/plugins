// @flow
//--------------------------------------------------------------------------
// Form Submit Router
// Routes actions from FormView React component (form submission)
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getGlobalSharedData } from '../../helpers/HTMLView'
import { handleRequest } from './requestHandlers' // For shared requests like getFolders, getNotes, getTeamspaces
import { handleFormSubmitAction, handleUnknownAction, getFormWindowIdForSubmission } from './formSubmitHandlers'
import { WEBVIEW_WINDOW_ID, getFormWindowId, findFormWindowId } from './windowManagement'
import { handleRequestResponse, newCommsRouter, type RequestResponse } from '@helpers/react/routerUtils'
import { logDebug, logError, clo, JSP } from '@helpers/dev'

/**
 * Get window ID for form submission (complex lookup with fallbacks)
 * @param {any} data - Request data
 * @returns {Promise<string>} - Window ID
 */
async function getFormSubmitWindowId(data: any): Promise<string> {
  // Get window ID - prioritize windowId from request (most reliable), then try lookup
  let windowId = data?.__windowId || null
  logDebug(pluginJson, `getFormSubmitWindowId: windowId from request: "${windowId || 'NOT PROVIDED'}"`)

  // If windowId was provided in request, use it directly (most reliable)
  if (windowId) {
    logDebug(pluginJson, `getFormSubmitWindowId: Using windowId from request: "${windowId}"`)
    return windowId
  }

  // Fallback: try to find it from open windows or window data
  // For form entry windows, use findFormWindowId() first
  windowId = findFormWindowId() || WEBVIEW_WINDOW_ID
  logDebug(pluginJson, `getFormSubmitWindowId: Fallback - Initial windowId from findFormWindowId: "${windowId}"`)
  try {
    // Try to get window data with the found ID
    const tempWindowData = await getGlobalSharedData(windowId)
    logDebug(
      pluginJson,
      `getFormSubmitWindowId: Got window data for "${windowId}", has pluginData.windowId=${String(!!tempWindowData?.pluginData?.windowId)}, has formTitle=${String(
        !!tempWindowData?.pluginData?.formTitle,
      )}`,
    )
    if (tempWindowData?.pluginData?.windowId) {
      windowId = tempWindowData.pluginData.windowId
      logDebug(pluginJson, `getFormSubmitWindowId: Updated windowId from pluginData.windowId: "${windowId}"`)
    } else if (tempWindowData?.pluginData?.formTitle) {
      windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
      logDebug(pluginJson, `getFormSubmitWindowId: Updated windowId from formTitle "${tempWindowData.pluginData.formTitle}": "${windowId}"`)
    }
  } catch (e) {
    logDebug(pluginJson, `getFormSubmitWindowId: Error getting window data for "${windowId}": ${e.message}, trying WEBVIEW_WINDOW_ID`)
    // If that fails, try the base WEBVIEW_WINDOW_ID
    try {
      const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      logDebug(
        pluginJson,
        `getFormSubmitWindowId: Got window data for WEBVIEW_WINDOW_ID, has pluginData.windowId=${String(!!tempWindowData?.pluginData?.windowId)}, has formTitle=${String(
          !!tempWindowData?.pluginData?.formTitle,
        )}`,
      )
      if (tempWindowData?.pluginData?.windowId) {
        windowId = tempWindowData.pluginData.windowId
        logDebug(pluginJson, `getFormSubmitWindowId: Updated windowId from WEBVIEW_WINDOW_ID data: "${windowId}"`)
      } else if (tempWindowData?.pluginData?.formTitle) {
        windowId = getFormWindowId(tempWindowData.pluginData.formTitle)
        logDebug(pluginJson, `getFormSubmitWindowId: Updated windowId from WEBVIEW_WINDOW_ID formTitle: "${windowId}"`)
      } else {
        windowId = WEBVIEW_WINDOW_ID
        logDebug(pluginJson, `getFormSubmitWindowId: Using WEBVIEW_WINDOW_ID as fallback: "${windowId}"`)
      }
    } catch (e2) {
      // Last resort: use the found ID or base ID
      windowId = findFormWindowId() || WEBVIEW_WINDOW_ID
      logDebug(pluginJson, `getFormSubmitWindowId: Last resort windowId: "${windowId}"`)
    }
  }

  return windowId
}

/**
 * Route request to appropriate handler based on action type
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data
 * @returns {Promise<RequestResponse>}
 */
async function routeFormSubmitRequest(actionType: string, data: any): Promise<RequestResponse> {
  // For shared requests (getFolders, getNotes, getTeamspaces, etc.), use the shared request handler
  return await handleRequest(actionType, data)
}

/**
 * Handle non-REQUEST actions (legacy action-based pattern)
 * @param {string} actionType - The action type
 * @param {any} data - Request data
 * @returns {Promise<any>}
 */
async function handleFormSubmitNonRequestAction(actionType: string, data: any): Promise<any> {
  // For non-REQUEST actions (legacy action-based pattern), route to handlers
  const windowId = await getFormWindowIdForSubmission(data)
  let reactWindowData = null

  try {
    reactWindowData = await getGlobalSharedData(windowId)
  } catch (e) {
    logError(pluginJson, `onFormSubmitFromHTMLView: Could not get window data for windowId: ${windowId}`)
    return {}
  }

  // Route to appropriate handler based on action type
  switch (actionType) {
    case 'onSubmitClick':
      await handleFormSubmitAction(data, reactWindowData, windowId)
      break
    default:
      await handleUnknownAction(actionType, data, windowId)
      break
  }

  return {}
}

/**
 * Handle actions from FormView React component (form submission)
 * Routes requests to appropriate handlers and sends responses back
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data with optional __requestType, __correlationId, __windowId
 * @returns {Promise<any>}
 */
export const onFormSubmitFromHTMLView: (actionType: string, data: any) => Promise<any> = newCommsRouter({
  routerName: 'onFormSubmitFromHTMLView',
  defaultWindowId: WEBVIEW_WINDOW_ID,
  routeRequest: routeFormSubmitRequest,
  handleNonRequestAction: handleFormSubmitNonRequestAction,
  getWindowId: getFormSubmitWindowId,
  pluginJson: pluginJson,
  useSharedHandlersFallback: true, // Forms uses shared handlers for choosers
})
