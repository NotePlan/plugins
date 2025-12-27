// @flow
//--------------------------------------------------------------------------
// Form Submit Request Handlers
// Handlers for requests from FormView component (form submission)
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { handleSubmitButtonClick } from './formSubmission'
import { WEBVIEW_WINDOW_ID, getFormWindowId, findFormWindowId } from './windowManagement'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { logDebug, logError, clo } from '@helpers/dev'

// RequestResponse type definition (shared with other handler files)
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get window ID for form submission, with fallback strategies
 * @param {Object} data - Request data with optional windowId
 * @returns {Promise<string>} - The window ID to use
 */
export async function getFormWindowIdForSubmission(data: any): Promise<string> {
  // Window ID lookup: Use windowId from data if provided (most reliable), otherwise use fallback strategies
  let windowId = data?.windowId || ''

  // If windowId was provided in data, use it directly
  if (windowId) {
    try {
      await getGlobalSharedData(windowId)
      logDebug(pluginJson, `getFormWindowIdForSubmission: Using windowId from data: ${windowId}`)
      return windowId
    } catch (e) {
      logDebug(pluginJson, `getFormWindowIdForSubmission: Could not get window data with provided windowId: ${windowId}, falling back to search`)
      windowId = '' // Reset to trigger fallback
    }
  }

  // Fallback strategies if windowId not provided or lookup failed
  if (!windowId) {
    // Strategy 1: Try to find window by looking at all open windows (most reliable for dynamic IDs)
    windowId = findFormWindowId() || WEBVIEW_WINDOW_ID

    // Strategy 2: Try to get window data using the found/fallback window ID
    try {
      const reactWindowData = await getGlobalSharedData(windowId)
      // If we got window data, use the windowId from it if available (most reliable)
      if (reactWindowData?.pluginData?.windowId) {
        windowId = reactWindowData.pluginData.windowId
        // Re-fetch with the correct window ID if different
        if (windowId !== WEBVIEW_WINDOW_ID) {
          try {
            await getGlobalSharedData(windowId)
          } catch (e) {
            logDebug(pluginJson, `getFormWindowIdForSubmission: Could not re-fetch with corrected windowId: ${windowId}`)
          }
        }
      } else if (reactWindowData?.pluginData?.formTitle) {
        // Reconstruct window ID from form title if we have it
        const reconstructedId = getFormWindowId(reactWindowData.pluginData.formTitle)
        if (reconstructedId !== windowId) {
          windowId = reconstructedId
          try {
            await getGlobalSharedData(windowId)
          } catch (e) {
            logDebug(pluginJson, `getFormWindowIdForSubmission: Could not fetch with reconstructed windowId: ${windowId}`)
          }
        }
      }
    } catch (e) {
      // Strategy 3: Fallback - try base WEBVIEW_WINDOW_ID for backward compatibility
      if (windowId !== WEBVIEW_WINDOW_ID) {
        try {
          const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
          if (tempWindowData?.pluginData?.windowId) {
            windowId = tempWindowData.pluginData.windowId
            await getGlobalSharedData(windowId)
          } else if (tempWindowData) {
            // Use base ID window data if available
            windowId = WEBVIEW_WINDOW_ID
          }
        } catch (e2) {
          logDebug(pluginJson, `getFormWindowIdForSubmission: Could not get window data with base ID either`)
        }
      }
    }
  }

  return windowId
}

/**
 * Handle form submission action (onSubmitClick)
 * @param {Object} data - Request data
 * @param {Object} reactWindowData - Window data from React
 * @param {string} windowId - Window ID (already determined by router)
 * @returns {Promise<RequestResponse>}
 */
export async function handleFormSubmitAction(data: any, reactWindowData: any, windowId: string): Promise<RequestResponse> {
  try {
    if (!reactWindowData) {
      logError(pluginJson, `handleFormSubmitAction: reactWindowData is required`)
      return {
        success: false,
        message: `reactWindowData is required`,
        data: null,
      }
    }

    // Merge passThroughVars if provided
    if (data.passThroughVars && reactWindowData.passThroughVars) {
      reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    } else if (data.passThroughVars) {
      reactWindowData.passThroughVars = { ...data.passThroughVars }
    }

    const returnValue = await handleSubmitButtonClick(data, reactWindowData)

    // Close the window after successful submission, unless keepOpenOnSubmit is true
    // (e.g., for Form Browser context where we want to keep the browser open)
    if (returnValue !== null && !data.keepOpenOnSubmit) {
      closeWindowFromCustomId(windowId)
    } else if (returnValue !== null && data.keepOpenOnSubmit) {
      logDebug(pluginJson, `handleFormSubmitAction: keepOpenOnSubmit=true, not closing window`)
    }

    // Update window data if it changed
    if (returnValue && returnValue !== reactWindowData) {
      const updateText = `After onSubmitClick, data was updated`
      clo(reactWindowData, `handleFormSubmitAction: after updating window data,reactWindowData=`)
      sendToHTMLWindow(windowId, 'SET_DATA', reactWindowData, updateText)
    }

    return {
      success: returnValue !== null,
      message: returnValue !== null ? 'Form submitted successfully' : 'Form submission failed',
      data: returnValue,
    }
  } catch (error) {
    logError(pluginJson, `handleFormSubmitAction: Error: ${error.message}`)
    return {
      success: false,
      message: `Error submitting form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle unknown action type
 * @param {string} actionType - The unknown action type
 * @param {Object} data - Request data
 * @param {string} windowId - Window ID
 * @returns {Promise<RequestResponse>}
 */
export async function handleUnknownAction(actionType: string, data: any, windowId: string): Promise<RequestResponse> {
  await sendBannerMessage(windowId, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`, 'ERROR')
  return {
    success: false,
    message: `Unknown actionType: "${actionType}"`,
    data: null,
  }
}
