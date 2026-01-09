// @flow
//--------------------------------------------------------------------------
// Router Utilities
// Shared scaffolding for handling REQUEST/RESPONSE pattern in routers
//--------------------------------------------------------------------------

import { sendToHTMLWindow } from '../HTMLView'
import { logDebug, logError, clo, JSP, logTimer, timer } from '@helpers/dev'

/**
 * Get shared handlers from np.Shared
 * Uses DataStore.invokePluginCommandByName to call np.Shared's handleSharedRequest function
 * @param {string} requestType - The request type
 * @param {Object} params - Request parameters
 * @param {Object} pluginJson - Plugin JSON for logging
 * @returns {Promise<RequestResponse>}
 */
async function callSharedHandler(requestType: string, params: Object, pluginJson: any): Promise<RequestResponse> {
  try {
    // Check if np.Shared is installed and accessible
    if (!DataStore.isPluginInstalledByID('np.Shared')) {
      logDebug(pluginJson, `[routerUtils] np.Shared not installed, cannot use shared handlers`)
      return {
        success: false,
        message: 'np.Shared plugin not installed',
        data: null,
      }
    }

    logDebug(pluginJson, `[routerUtils] Attempting to call np.Shared handler for "${requestType}"`)

    // Use DataStore.invokePluginCommandByName to call np.Shared's handleSharedRequest
    // This requires np.Shared to have handleSharedRequest registered in plugin.json
    const result = await DataStore.invokePluginCommandByName('handleSharedRequest', 'np.Shared', [requestType, params, pluginJson])

    if (result && typeof result === 'object' && 'success' in result) {
      logDebug(pluginJson, `[routerUtils] np.Shared handler result for "${requestType}": success=${String(result.success)}`)
      return result
    } else {
      logError(pluginJson, `[routerUtils] np.Shared handler returned invalid result for "${requestType}"`)
      return {
        success: false,
        message: `Invalid response from np.Shared handler`,
        data: null,
      }
    }
  } catch (error) {
    logError(pluginJson, `[routerUtils] Error calling shared handler for "${requestType}": ${error.message}`)
    return {
      success: false,
      message: `Error calling shared handler: ${error.message}`,
      data: null,
    }
  }
}

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
 * @param {Object} options.pluginJson - Plugin JSON object for logging
 * @returns {Promise<any>} - Empty object (response is sent via sendToHTMLWindow)
 */
export async function handleRequestResponse({
  actionType,
  data,
  routerName,
  defaultWindowId,
  routeRequest,
  getWindowId,
  pluginJson,
}: {
  actionType: string,
  data: any,
  routerName: string,
  defaultWindowId: string,
  routeRequest: (actionType: string, data: any) => Promise<RequestResponse>,
  getWindowId?: (data: any) => Promise<string> | string,
  pluginJson: any,
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

    const dataToSend = result.data

    // Send response back to React
    sendToHTMLWindow(windowId, 'RESPONSE', {
      correlationId: data.__correlationId,
      success: result.success,
      data: dataToSend,
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
 * Includes automatic fallback to np.Shared handlers if plugin doesn't have its own handler
 *
 * RESPONSE PATTERN:
 * - Handlers return { success: boolean, data?: any, message?: string }
 * - Router sends RESPONSE message: { correlationId, success, data, error }
 * - React resolves promise with payload.data (just the data, not the wrapper)
 *
 * FALLBACK PATTERN:
 * - If routeRequest returns a response with success=false and message indicating "not found" or "unknown",
 *   the router will automatically try np.Shared handlers as a fallback
 * - This allows plugins to use common chooser handlers (getTeamspaces, getFolders, etc.) without implementing them
 *
 * @param {Object} options - Configuration options
 * @param {string} options.routerName - Name of the router (for logging)
 * @param {string} options.defaultWindowId - Default window ID
 * @param {Function} options.routeRequest - Function to route REQUEST type actions
 * @param {Function} options.handleNonRequestAction - Optional function to handle non-REQUEST actions
 * @param {Function} options.getWindowId - Optional function to get window ID (for complex lookup)
 * @param {Object} options.pluginJson - Plugin JSON object for logging
 * @param {boolean} options.useSharedHandlersFallback - If true, fallback to np.Shared handlers (default: true)
 * @returns {Function} - Router function
 */
export function newCommsRouter({
  routerName,
  defaultWindowId,
  routeRequest,
  handleNonRequestAction,
  getWindowId,
  pluginJson,
  useSharedHandlersFallback = true,
}: {
  routerName: string,
  defaultWindowId: string,
  routeRequest: (actionType: string, data: any) => Promise<RequestResponse>,
  handleNonRequestAction?: (actionType: string, data: any) => Promise<any>,
  getWindowId?: (data: any) => Promise<string> | string,
  pluginJson: any,
  useSharedHandlersFallback?: boolean,
}): (actionType: string, data: any) => Promise<any> {
  return async function router(actionType: string, data: any = null): Promise<any> {
    const requestStartTime = new Date() // Start timing when request is received
    try {
      logDebug(pluginJson, `${routerName} received actionType="${actionType}"`)
      clo(data, `${routerName} data=`)

      // Check if this is a request that needs a response
      if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
        // Create a wrapper routeRequest that includes fallback logic
        const routeRequestWithFallback = async (actionType: string, data: any): Promise<RequestResponse> => {
          // First, try the plugin's own routeRequest
          logDebug(pluginJson, `[${routerName}] Attempting plugin handler for "${actionType}"`)
          const pluginResult = await routeRequest(actionType, data)

          // Check if plugin handler succeeded or explicitly handled the request
          // If success is true, or if the error message doesn't indicate "not found", use plugin result
          const message = pluginResult.message || ''
          const isNotFound =
            !pluginResult.success &&
            message &&
            (message.toLowerCase().includes('unknown') || message.toLowerCase().includes('not found') || message.toLowerCase().includes('no handler'))

          if (pluginResult.success || !isNotFound) {
            logDebug(pluginJson, `[${routerName}] Using plugin handler result for "${actionType}": success=${String(pluginResult.success)}`)
            return pluginResult
          }

          // Plugin handler didn't handle it - try shared handlers if enabled
          if (useSharedHandlersFallback) {
            logDebug(pluginJson, `[${routerName}] Plugin handler not found for "${actionType}", attempting np.Shared fallback`)
            try {
              logDebug(pluginJson, `[${routerName}] Calling np.Shared handler for "${actionType}"`)
              const sharedResult = await callSharedHandler(actionType, data, pluginJson)
              logDebug(
                pluginJson,
                `[${routerName}] np.Shared handler result for "${actionType}": success=${String(sharedResult.success)}, message="${sharedResult.message || 'none'}"`,
              )
              return sharedResult
            } catch (error) {
              logError(pluginJson, `[${routerName}] Error calling shared handler for "${actionType}": ${error.message}`)
              // Return plugin result on error (which indicates not found)
              return pluginResult
            }
          } else {
            logDebug(pluginJson, `[${routerName}] Shared handlers fallback disabled, returning plugin result`)
            return pluginResult
          }
        }

        const result = await handleRequestResponse({
          actionType,
          data,
          routerName,
          defaultWindowId,
          routeRequest: routeRequestWithFallback,
          getWindowId,
          pluginJson,
        })
        logDebug(pluginJson, `[PERF] ${routerName} request/response completed for actionType="${actionType}" in ${timer(requestStartTime)}`)
        // Log timing when request/response is complete
        logTimer(
          `${routerName}/router`,
          requestStartTime,
          `REQUEST/RESPONSE completed for actionType="${actionType}", correlationId="${data?.__correlationId || 'none'}"`,
          1000, // Warn if takes longer than 1 second
        )
        return result
      }

      // For non-REQUEST actions, call the optional handler
      if (handleNonRequestAction) {
        const result = await handleNonRequestAction(actionType, data)
        logTimer(
          `${routerName}/router`,
          requestStartTime,
          `Non-REQUEST action completed for actionType="${actionType}"`,
          1000, // Warn if takes longer than 1 second
        )
        return result
      }

      // Default: return empty object
      logTimer(
        `${routerName}/router`,
        requestStartTime,
        `Default (empty) response for actionType="${actionType}"`,
        100, // Quick operation, warn if > 100ms
      )
      return {}
    } catch (error) {
      logError(pluginJson, `${routerName} error: ${JSP(error)}`)
      logTimer(
        `${routerName}/router`,
        requestStartTime,
        `ERROR occurred for actionType="${actionType}": ${error.message}`,
        100, // Log errors immediately
      )
      return {}
    }
  }
}
