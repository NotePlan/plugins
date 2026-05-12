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

let sharedRequestSequence: number = 0
let activeSharedRequests: number = 0

/**
 * Route request to appropriate shared handler
 * This is called by the fallback mechanism in newCommsRouter when a plugin doesn't have its own handler
 * @param {string} requestType - The type of request (e.g., 'getTeamspaces', 'getNotes', etc.)
 * @param {Object} params - Request parameters
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {Promise<RequestResponse>}
 */
export async function handleSharedRequest(requestType: string, params: Object = {}, pluginJson: any): Promise<RequestResponse> {
  const requestId = sharedRequestSequence + 1
  sharedRequestSequence = requestId
  activeSharedRequests += 1
  const startedAt = Date.now()
  try {
    logDebug(pluginJson, `[DIAG][np.Shared/sharedRequestRouter][REQUEST#${requestId}] START requestType="${requestType}", active=${activeSharedRequests}, params=${JSON.stringify(params)}`)

    let result: RequestResponse
    switch (requestType) {
      case 'getTeamspaces':
        result = getTeamspaces(params, pluginJson)
        break
      case 'getFolders':
        result = getFolders(params, pluginJson)
        break
      case 'getNotes':
        result = getNotes(params, pluginJson)
        break
      case 'getHashtags':
        result = getHashtags(params, pluginJson)
        break
      case 'getMentions':
        result = getMentions(params, pluginJson)
        break
      case 'getFrontmatterKeyValues':
        result = await getFrontmatterKeyValues(params, pluginJson)
        break
      case 'getHeadings':
        result = getHeadings(params, pluginJson)
        break
      case 'getEvents':
        result = await getEvents(params, pluginJson)
        break
      case 'getAvailableCalendars':
        result = getAvailableCalendars(params, pluginJson)
        break
      case 'getAvailableReminderLists':
        result = getAvailableReminderLists(params, pluginJson)
        break
      default:
        logDebug(pluginJson, `[DIAG][np.Shared/sharedRequestRouter][REQUEST#${requestId}] Unknown request type "${requestType}", returning error`)
        result = {
          success: false,
          message: `Unknown shared request type: "${requestType}"`,
          data: null,
        }
    }

    const count = Array.isArray(result?.data) ? result.data.length : result?.data == null ? 0 : 1
    logDebug(
      pluginJson,
      `[DIAG][np.Shared/sharedRequestRouter][REQUEST#${requestId}] COMPLETE requestType="${requestType}", elapsed=${Date.now() - startedAt}ms, success=${String(
        result?.success,
      )}, dataCount=${count}, active=${activeSharedRequests}`,
    )
    return result
  } catch (error) {
    logError(pluginJson, `[DIAG][np.Shared/sharedRequestRouter][REQUEST#${requestId}] ERROR requestType="${requestType}", elapsed=${Date.now() - startedAt}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Error handling shared request "${requestType}": ${error.message}`,
      data: null,
    }
  } finally {
    activeSharedRequests = Math.max(0, activeSharedRequests - 1)
    logDebug(pluginJson, `[DIAG][np.Shared/sharedRequestRouter][REQUEST#${requestId}] EXIT requestType="${requestType}", active=${activeSharedRequests}`)
  }
}

