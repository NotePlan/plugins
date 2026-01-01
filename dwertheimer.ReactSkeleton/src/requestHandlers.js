// @flow

/**
 * Request Handlers for ReactSkeleton Plugin
 *
 * This file contains handlers for request/response pattern communication from React to NotePlan.
 * Each handler should return a standardized response object with:
 * - success: boolean
 * - message: string (optional, for error messages or informational messages)
 * - data: any (the actual response data)
 *
 * ORGANIZATION:
 * - Keep handlers organized by functionality (e.g., note operations, folder operations, etc.)
 * - Add JSDoc comments explaining what each handler does
 * - Use descriptive function names that match the request type (e.g., getNotes, getFolders)
 * - Always return the standardized RequestResponse type
 *
 * @author @dwertheimer
 */

import pluginJson from '../plugin.json'
import { logDebug, logError, logInfo } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'

/**
 * Standardized response type for all request handlers
 */
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of folders (excluding trash by default)
 * 
 * This handler returns a list of all folders in the project, optionally excluding trash.
 * Useful for populating folder choosers in React components.
 *
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude trash folder (default: true)
 * @returns {Promise<RequestResponse>} - Response with folders array
 */
export async function getFolders(params: { excludeTrash?: boolean } = {}): Promise<RequestResponse> {
  try {
    const { excludeTrash = true } = params
    logDebug(pluginJson, `getFolders: excludeTrash=${String(excludeTrash)}`)

    const folders = getFoldersMatching([], excludeTrash)
    logDebug(pluginJson, `getFolders: Found ${folders.length} folders`)

    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    logError(pluginJson, `getFolders: Error: ${error.message}`)
    return {
      success: false,
      message: `Error getting folders: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get list of teamspaces
 * 
 * This handler returns a list of all teamspaces available in NotePlan.
 * Useful for populating teamspace choosers in React components.
 *
 * @param {Object} params - Request parameters (currently unused, but kept for consistency)
 * @returns {Promise<RequestResponse>} - Response with teamspaces array
 */
export async function getTeamspaces(params: any = {}): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `getTeamspaces: Starting`)

    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspaceList = teamspaces.map((ts) => ({
      id: ts.id,
      title: ts.title,
    }))
    logDebug(pluginJson, `getTeamspaces: Found ${teamspaceList.length} teamspaces`)

    return {
      success: true,
      data: teamspaceList,
    }
  } catch (error) {
    logError(pluginJson, `getTeamspaces: Error: ${error.message}`)
    return {
      success: false,
      message: `Error getting teamspaces: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Example handler: Get sample data
 * 
 * This is an example handler that returns sample data.
 * Replace this with your own handlers based on your plugin's needs.
 *
 * @param {Object} params - Request parameters
 * @param {string} params.filter - Optional filter string
 * @returns {Promise<RequestResponse>} - Response with sample data
 */
export async function getSampleData(params: { filter?: string } = {}): Promise<RequestResponse> {
  try {
    const { filter } = params
    logDebug(pluginJson, `getSampleData: filter="${filter || 'none'}"`)

    // Example: Return sample data
    const sampleData = {
      items: [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 },
      ],
      timestamp: new Date().toISOString(),
    }

    // Apply filter if provided
    let filteredData = sampleData
    if (filter) {
      filteredData = {
        ...sampleData,
        items: sampleData.items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())),
      }
    }

    return {
      success: true,
      data: filteredData,
    }
  } catch (error) {
    logError(pluginJson, `getSampleData: Error: ${error.message}`)
    return {
      success: false,
      message: `Error getting sample data: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Route request to appropriate handler based on action type
 * 
 * This is the main routing function that dispatches requests to the correct handler.
 * Add new cases here as you add new request handlers.
 *
 * @param {string} requestType - The request type (e.g., 'getFolders', 'getTeamspaces')
 * @param {any} params - Request parameters
 * @returns {Promise<RequestResponse>} - Response from the handler
 */
export async function handleRequest(requestType: string, params: any): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleRequest: requestType="${requestType}"`)

    switch (requestType) {
      case 'getFolders':
        return await getFolders(params)
      case 'getTeamspaces':
        return await getTeamspaces(params)
      case 'getSampleData':
        return await getSampleData(params)
      default:
        logError(pluginJson, `handleRequest: Unknown request type: "${requestType}"`)
        return {
          success: false,
          message: `Unknown request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `handleRequest: Error handling request "${requestType}": ${error.message}`)
    return {
      success: false,
      message: `Error handling request: ${error.message}`,
      data: null,
    }
  }
}

