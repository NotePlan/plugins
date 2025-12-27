// @flow
//--------------------------------------------------------------------------
// Router Utilities
// Shared scaffolding for handling REQUEST/RESPONSE pattern in routers
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { sendToHTMLWindow } from '../../helpers/HTMLView'
import { logDebug, logError, clo, JSP } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get window ID from request data or use default
 * @param {any} data - Request data with optional __windowId
 * @param {string} defaultWindowId - Default window ID to use if not provided
 * @returns {string} - The window ID to use
 */
function getWindowIdFromRequest(data: any, defaultWindowId: string): string {
  return data?.__windowId || defaultWindowId
}

/**
 * Handle REQUEST/RESPONSE pattern - shared scaffolding for all routers
 *
 * RESPONSE PATTERN:
 * - Handler functions return: { success: boolean, data?: any, message?: string }
 * - This function sends a RESPONSE message to React with: { correlationId, success, data, error }
 * - React's handleResponse extracts payload.data and resolves the promise with just the data
 * - So requestFromPlugin() resolves with result.data (the actual data, not the wrapper object)
 *
 * @param {Object} options - Configuration options
 * @param {string} options.actionType - The action/command type
 * @param {any} options.data - Request data
 * @param {string} options.routerName - Name of the router (for logging)
 * @param {string} options.defaultWindowId - Default window ID
 * @param {Function} options.routeRequest - Function to route the request to appropriate handler
 * @param {Function} options.getWindowId - Optional function to get window ID (for complex lookup)
 * @returns {Promise<any>} - Empty object (response is sent via sendToHTMLWindow)
 */
export async function handleRequestResponse({
  actionType,
  data,
  routerName,
  defaultWindowId,
  routeRequest,
  getWindowId,
}: {
  actionType: string,
  data: any,
  routerName: string,
  defaultWindowId: string,
  routeRequest: (actionType: string, data: any) => Promise<RequestResponse>,
  getWindowId?: (data: any) => Promise<string> | string,
}): Promise<any> {
  try {
    logDebug(pluginJson, `${routerName}: Handling REQUEST type="${actionType}" with correlationId="${data.__correlationId}"`)

    // Route request to appropriate handler
    const result = await routeRequest(actionType, data)
    // Don't log the data if it's an object/array to avoid cluttering logs with [object Object]
    const dataPreview = result.data != null ? (typeof result.data === 'object' ? `[object]` : String(result.data)) : 'null'
    logDebug(pluginJson, `${routerName}: routeRequest result for "${actionType}": success=${String(result.success)}, data type=${typeof result.data}, data="${dataPreview}"`)

    // Get window ID - use custom function if provided, otherwise use default logic
    let windowId: string
    if (getWindowId) {
      // getWindowId can return Promise<string> or string, await handles both
      windowId = await getWindowId(data)
    } else {
      windowId = getWindowIdFromRequest(data, defaultWindowId)
    }
    logDebug(pluginJson, `${routerName}: Using windowId="${windowId}" for RESPONSE`)

    // Send response back to React
    sendToHTMLWindow(windowId, 'RESPONSE', {
      correlationId: data.__correlationId,
      success: result.success,
      data: result.data,
      error: result.message,
    })
    return {}
  } catch (error) {
    logError(pluginJson, `${routerName}: Error handling REQUEST: ${error.message || String(error)}`)
    let windowId: string
    if (getWindowId) {
      // getWindowId can return Promise<string> or string, await handles both
      windowId = await getWindowId(data)
    } else {
      windowId = getWindowIdFromRequest(data, defaultWindowId)
    }
    sendToHTMLWindow(windowId, 'RESPONSE', {
      correlationId: data.__correlationId,
      success: false,
      data: null,
      error: error.message || String(error) || 'Unknown error',
    })
    return {}
  }
}

/**
 * Create a router function with shared REQUEST/RESPONSE handling
 *
 * RESPONSE PATTERN:
 * - Handlers return { success: boolean, data?: any, message?: string }
 * - Router sends RESPONSE message: { correlationId, success, data, error }
 * - React resolves promise with payload.data (just the data, not the wrapper)
 *
 * @param {Object} options - Configuration options
 * @param {string} options.routerName - Name of the router (for logging)
 * @param {string} options.defaultWindowId - Default window ID
 * @param {Function} options.routeRequest - Function to route REQUEST type actions
 * @param {Function} options.handleNonRequestAction - Optional function to handle non-REQUEST actions
 * @param {Function} options.getWindowId - Optional function to get window ID (for complex lookup)
 * @returns {Function} - Router function
 */
export function createRouter({
  routerName,
  defaultWindowId,
  routeRequest,
  handleNonRequestAction,
  getWindowId,
}: {
  routerName: string,
  defaultWindowId: string,
  routeRequest: (actionType: string, data: any) => Promise<RequestResponse>,
  handleNonRequestAction?: (actionType: string, data: any) => Promise<any>,
  getWindowId?: (data: any) => Promise<string> | string,
}): (actionType: string, data: any) => Promise<any> {
  return async function router(actionType: string, data: any = null): Promise<any> {
    try {
      logDebug(pluginJson, `${routerName} received actionType="${actionType}"`)
      clo(data, `${routerName} data=`)

      // Check if this is a request that needs a response
      if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
        return await handleRequestResponse({
          actionType,
          data,
          routerName,
          defaultWindowId,
          routeRequest,
          getWindowId,
        })
      }

      // For non-REQUEST actions, call the optional handler
      if (handleNonRequestAction) {
        return await handleNonRequestAction(actionType, data)
      }

      // Default: return empty object
      return {}
    } catch (error) {
      logError(pluginJson, `${routerName} error: ${JSP(error)}`)
      return {}
    }
  }
}
