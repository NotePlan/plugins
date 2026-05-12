// @flow
//--------------------------------------------------------------------------
// Shared Request Router
// Routes requests to appropriate shared handlers from requestHandlers folder
// This is called by the fallback mechanism in newCommsRouter when a plugin doesn't have its own handler
//--------------------------------------------------------------------------

import { getTeamspaces } from './requestHandlers/getTeamspaces'
import { getFolders } from './requestHandlers/getFolders'
import { getNotes } from './requestHandlers/getNotes'
import { getHashtags } from './requestHandlers/getHashtags'
import { getMentions } from './requestHandlers/getMentions'
import { getFrontmatterKeyValues } from './requestHandlers/getFrontmatterKeyValues'
import { getHeadings } from './requestHandlers/getHeadings'
import { getEvents } from './requestHandlers/getEvents'
import { getAvailableCalendars } from './requestHandlers/getAvailableCalendars'
import { getAvailableReminderLists } from './requestHandlers/getAvailableReminderLists'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Route request to appropriate shared handler
 * This is called by the fallback mechanism in newCommsRouter when a plugin doesn't have its own handler
 * @param {string} requestType - The type of request (e.g., 'getTeamspaces', 'getNotes', etc.)
 * @param {Object} params - Request parameters
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {Promise<RequestResponse>}
 */
export async function handleSharedRequest(requestType: string, params: Object = {}, pluginJson: any): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `[np.Shared/sharedRequestRouter] handleSharedRequest: requestType="${requestType}"`)

    switch (requestType) {
      case 'getTeamspaces':
        return getTeamspaces(params, pluginJson)
      case 'getFolders':
        return getFolders(params, pluginJson)
      case 'getNotes':
        return getNotes(params, pluginJson)
      case 'getHashtags':
        return getHashtags(params, pluginJson)
      case 'getMentions':
        return getMentions(params, pluginJson)
      case 'getFrontmatterKeyValues':
        return await getFrontmatterKeyValues(params, pluginJson)
      case 'getHeadings':
        return getHeadings(params, pluginJson)
      case 'getEvents':
        return await getEvents(params, pluginJson)
      case 'getAvailableCalendars':
        return getAvailableCalendars(params, pluginJson)
      case 'getAvailableReminderLists':
        return getAvailableReminderLists(params, pluginJson)
      default:
        logDebug(pluginJson, `[np.Shared/sharedRequestRouter] handleSharedRequest: Unknown request type "${requestType}", returning error`)
        return {
          success: false,
          message: `Unknown shared request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `[np.Shared/sharedRequestRouter] handleSharedRequest ERROR: requestType="${requestType}", error="${error.message}"`)
    return {
      success: false,
      message: `Error handling shared request "${requestType}": ${error.message}`,
      data: null,
    }
  }
}

