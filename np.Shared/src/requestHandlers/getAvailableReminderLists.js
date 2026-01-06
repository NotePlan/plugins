// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getAvailableReminderLists
// Returns list of available reminder list titles
//--------------------------------------------------------------------------

import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of available reminder list titles
 * @param {Object} _params - Request parameters (currently unused)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getAvailableReminderLists(_params: Object = {}, pluginJson: any): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[np.Shared/requestHandlers] getAvailableReminderLists START`)

    // NOTE: Calendar.availableReminderListTitles() may return an empty array if the user
    // has no reminder lists configured in NotePlan. This is not an error condition.
    const reminderLists = Calendar.availableReminderListTitles()

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getAvailableReminderLists COMPLETE: totalElapsed=${totalElapsed}ms, found=${reminderLists.length} reminder lists`)

    if (reminderLists.length === 0) {
      logDebug(pluginJson, `[np.Shared/requestHandlers] getAvailableReminderLists: Empty result - user may not have any reminder lists configured in NotePlan`)
    }

    return {
      success: true,
      data: reminderLists,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getAvailableReminderLists ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get reminder lists: ${error.message}`,
      data: null,
    }
  }
}



