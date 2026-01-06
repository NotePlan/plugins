// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getHashtags
// Returns list of all hashtags from DataStore
//--------------------------------------------------------------------------

import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get all hashtags from DataStore
 * @param {Object} _params - Not used, kept for consistency
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse} Array of hashtags (without # prefix)
 */
export function getHashtags(_params: Object = {}, pluginJson: any): RequestResponse {
  try {
    // DataStore.hashtags returns items without # prefix
    const hashtags = DataStore.hashtags || []
    logDebug(pluginJson, `[np.Shared/requestHandlers] getHashtags: returning ${hashtags.length} hashtags`)
    return {
      success: true,
      data: hashtags,
    }
  } catch (error) {
    logError(pluginJson, `[np.Shared/requestHandlers] getHashtags error: ${error.message}`)
    return {
      success: false,
      message: error.message,
      data: [],
    }
  }
}



