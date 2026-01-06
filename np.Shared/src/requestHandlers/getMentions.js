// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getMentions
// Returns list of all mentions from DataStore
//--------------------------------------------------------------------------

import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get all mentions from DataStore
 * @param {Object} _params - Not used, kept for consistency
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse} Array of mentions (without @ prefix)
 */
export function getMentions(_params: Object = {}, pluginJson: any): RequestResponse {
  try {
    // DataStore.mentions returns items without @ prefix
    const mentions = DataStore.mentions || []
    logDebug(pluginJson, `[np.Shared/requestHandlers] getMentions: returning ${mentions.length} mentions`)
    return {
      success: true,
      data: mentions,
    }
  } catch (error) {
    logError(pluginJson, `[np.Shared/requestHandlers] getMentions error: ${error.message}`)
    return {
      success: false,
      message: error.message,
      data: [],
    }
  }
}



