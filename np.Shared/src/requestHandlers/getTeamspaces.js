// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getTeamspaces
// Returns list of available teamspaces for space choosers
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
    logDebug(pluginJson, `[np.Shared/requestHandlers] getTeamspaces START`)

    const teamspacesStartTime: number = Date.now()
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspacesElapsed: number = Date.now() - teamspacesStartTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getTeamspaces getAllTeamspaceIDsAndTitles: elapsed=${teamspacesElapsed}ms, found=${teamspaces.length} teamspaces`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getTeamspaces COMPLETE: totalElapsed=${totalElapsed}ms, found=${teamspaces.length} teamspaces`)

    return {
      success: true,
      data: teamspaces,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getTeamspaces ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get teamspaces: ${error.message}`,
      data: null,
    }
  }
}



