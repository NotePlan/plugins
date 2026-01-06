// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getFolders
// Returns list of folders with optional space filtering
//--------------------------------------------------------------------------

import { getFoldersMatching } from '@helpers/folders'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { logDebug, logError, logInfo } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of folders with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Exclude trash folder (default: true)
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getFolders(params: { excludeTrash?: boolean, space?: ?string } = {}, pluginJson: any): RequestResponse {
  const startTime: number = Date.now()
  try {
    const spaceParam = params.space
    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getFolders START: excludeTrash=${String(params.excludeTrash ?? true)}, space=${spaceParam != null ? String(spaceParam) : 'null/undefined (all spaces)'}`,
    )

    const excludeTrash = params.excludeTrash ?? true
    // Don't default spaceId - if null/undefined, don't filter (show all spaces)
    // Empty string means Private space only, teamspace ID means specific teamspace only
    const spaceId = spaceParam
    const exclusions = excludeTrash ? ['@Trash'] : []

    // Get all folders except exclusions. Include special folders (@Templates, @Archive, etc.) and teamspaces, sorted
    const foldersStartTime: number = Date.now()
    let folders = getFoldersMatching([], false, exclusions, false, true)
    const foldersElapsed: number = Date.now() - foldersStartTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getFolders getFoldersMatching: elapsed=${foldersElapsed}ms, found=${folders.length} folders`)

    // Filter by space if specified (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
    if (spaceId !== null && spaceId !== undefined) {
      folders = folders.filter((folder: string) => {
        // Root folder - only include for Private space
        if (folder === '/') {
          return spaceId === ''
        }

        // Check if folder is a teamspace folder
        if (folder.startsWith('%%NotePlanCloud%%')) {
          const folderDetails = parseTeamspaceFilename(folder)
          if (spaceId === '') {
            // Private space filter - exclude all teamspace folders
            return false
          } else {
            // Specific teamspace filter - only include folders from that teamspace
            return spaceId === folderDetails.teamspaceID
          }
        } else {
          // Regular folder (not teamspace)
          if (spaceId === '') {
            // Private space filter - include regular folders
            return true
          } else {
            // Specific teamspace filter - exclude regular folders
            return false
          }
        }
      })
      logDebug(pluginJson, `[np.Shared/requestHandlers] getFolders FILTERED: ${folders.length} folders after space filter (space=${spaceId || 'Private'})`)
    }

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getFolders COMPLETE: totalElapsed=${totalElapsed}ms, found=${folders.length} folders`)

    if (folders.length === 0) {
      logInfo(pluginJson, `[np.Shared/requestHandlers] getFolders: No folders found, returning root folder only`)
      return {
        success: true,
        message: 'No folders found, returning root folder',
        data: ['/'],
      }
    }

    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getFolders ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get folders: ${error.message}`,
      data: null,
    }
  }
}



