// @flow
//--------------------------------------------------------------------------
// Shared Chooser Request Handlers
// Common handlers for DynamicDialog choosers (space-chooser, note-chooser, etc.)
// These handlers can be used by any plugin via fallback routing in newCommsRouter
//--------------------------------------------------------------------------

import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get teamspace definitions for space chooser
 * @param {Object} params - Request parameters (currently unused)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getTeamspaces(_params: Object = {}, pluginJson: any): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[np.Shared/chooserHandlers] getTeamspaces START`)

    const teamspacesStartTime: number = Date.now()
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspacesElapsed: number = Date.now() - teamspacesStartTime
    logDebug(pluginJson, `[np.Shared/chooserHandlers] getTeamspaces getAllTeamspaceIDsAndTitles: elapsed=${teamspacesElapsed}ms, found=${teamspaces.length} teamspaces`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/chooserHandlers] getTeamspaces COMPLETE: totalElapsed=${totalElapsed}ms, found=${teamspaces.length} teamspaces`)

    return {
      success: true,
      data: teamspaces,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/chooserHandlers] getTeamspaces ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get teamspaces: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Route request to appropriate shared handler
 * This is called by the fallback mechanism in newCommsRouter when a plugin doesn't have its own handler
 * @param {string} requestType - The type of request (e.g., 'getTeamspaces')
 * @param {Object} params - Request parameters
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {Promise<RequestResponse>}
 */
export async function handleSharedRequest(requestType: string, params: Object = {}, pluginJson: any): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `[np.Shared/chooserHandlers] handleSharedRequest: requestType="${requestType}"`)

    switch (requestType) {
      case 'getTeamspaces':
        return getTeamspaces(params, pluginJson)
      // Add more shared handlers here as they are implemented:
      // case 'getFolders':
      //   return getFolders(params, pluginJson)
      // case 'getNotes':
      //   return getNotes(params, pluginJson)
      // case 'getHashtags':
      //   return getHashtags(params, pluginJson)
      // case 'getMentions':
      //   return getMentions(params, pluginJson)
      // case 'getFrontmatterKeyValues':
      //   return getFrontmatterKeyValues(params, pluginJson)
      // case 'getHeadings':
      //   return getHeadings(params, pluginJson)
      // case 'getEvents':
      //   return getEvents(params, pluginJson)
      default:
        logDebug(pluginJson, `[np.Shared/chooserHandlers] handleSharedRequest: Unknown request type "${requestType}", returning error`)
        return {
          success: false,
          message: `Unknown shared request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `[np.Shared/chooserHandlers] handleSharedRequest ERROR: requestType="${requestType}", error="${error.message}"`)
    return {
      success: false,
      message: `Error handling shared request "${requestType}": ${error.message}`,
      data: null,
    }
  }
}

