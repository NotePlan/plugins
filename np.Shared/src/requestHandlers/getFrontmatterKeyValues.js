// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getFrontmatterKeyValues
// Returns all values for a frontmatter key from DataStore
//--------------------------------------------------------------------------

import { getValuesForFrontmatterTag } from '@helpers/NPFrontMatter'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get all values for a frontmatter key from DataStore
 * @param {Object} params - Request parameters
 * @param {string} params.frontmatterKey - The frontmatter key to get values for
 * @param {'Notes' | 'Calendar' | 'All'} params.noteType - Type of notes to search (default: 'All')
 * @param {boolean} params.caseSensitive - Whether to perform case-sensitive search (default: false)
 * @param {string} params.folderString - Folder to limit search to (optional)
 * @param {boolean} params.fullPathMatch - Whether to match full path (default: false)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {Promise<RequestResponse>} Array of values (as strings)
 */
export async function getFrontmatterKeyValues(
  params: {
    frontmatterKey: string,
    noteType?: 'Notes' | 'Calendar' | 'All',
    caseSensitive?: boolean,
    folderString?: string,
    fullPathMatch?: boolean,
  },
  pluginJson: any,
): Promise<RequestResponse> {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[np.Shared/requestHandlers] getFrontmatterKeyValues START: frontmatterKey="${params.frontmatterKey}"`)

    if (!params.frontmatterKey) {
      return {
        success: false,
        message: 'Frontmatter key is required',
        data: [],
      }
    }

    const noteType = params.noteType || 'All'
    const caseSensitive = params.caseSensitive || false
    const folderString = params.folderString || ''
    const fullPathMatch = params.fullPathMatch || false

    // Get values using the helper function
    const values = await getValuesForFrontmatterTag(params.frontmatterKey, noteType, caseSensitive, folderString, fullPathMatch)

    // Convert all values to strings (frontmatter values can be various types)
    let stringValues = values.map((v: any) => String(v))

    // Filter out templating syntax values (containing "<%") - these are template code, not actual values
    // This prevents templating errors when forms load and process frontmatter
    const beforeFilterCount = stringValues.length
    stringValues = stringValues.filter((v: string) => !v.includes('<%'))
    if (beforeFilterCount !== stringValues.length) {
      logDebug(pluginJson, `[np.Shared/requestHandlers] getFrontmatterKeyValues: Filtered out ${beforeFilterCount - stringValues.length} templating syntax values`)
    }

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getFrontmatterKeyValues COMPLETE: totalElapsed=${totalElapsed}ms, found=${stringValues.length} values for key "${params.frontmatterKey}"`)

    return {
      success: true,
      data: stringValues,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getFrontmatterKeyValues ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get frontmatter key values: ${error.message}`,
      data: [],
    }
  }
}



