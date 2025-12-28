// @flow
//--------------------------------------------------------------------------
// Favorites Router
// Routes requests from FavoritesView React component to appropriate handlers
//--------------------------------------------------------------------------

import { handleGetFavoriteNotes, handleGetFavoriteCommands, handleOpenNote, handleRunCommand } from './requestHandlers'
import { createRouter, type RequestResponse } from './routerUtils'

const FAVORITES_BROWSER_WINDOW_ID = 'favorites-browser-window'

/**
 * Route request to appropriate handler based on action type
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data
 * @returns {Promise<RequestResponse>}
 */
async function routeFavoritesRequest(actionType: string, data: any): Promise<RequestResponse> {
  switch (actionType) {
    case 'getFavoriteNotes':
      return await handleGetFavoriteNotes(data)
    case 'getFavoriteCommands':
      return await handleGetFavoriteCommands(data)
    case 'openNote':
      return await handleOpenNote(data)
    case 'runCommand':
      return await handleRunCommand(data)
    default:
      return {
        success: false,
        message: `Unknown action type: ${actionType}`,
      }
  }
}

/**
 * Handle actions from FavoritesView React component
 * Routes requests to appropriate handlers and sends responses back
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data with optional __requestType, __correlationId, __windowId
 * @returns {Promise<any>}
 */
export const onFavoritesBrowserAction: (actionType: string, data: any) => Promise<any> = createRouter({
  routerName: 'onFavoritesBrowserAction',
  defaultWindowId: FAVORITES_BROWSER_WINDOW_ID,
  routeRequest: routeFavoritesRequest,
})

