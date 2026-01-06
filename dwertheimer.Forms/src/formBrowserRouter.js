// @flow
//--------------------------------------------------------------------------
// Form Browser Router
// Routes requests from FormBrowserView React component to appropriate handlers
//--------------------------------------------------------------------------

import { getFormTemplates, getFormFields, handleSubmitForm, handleOpenFormBuilder, handleCreateNewForm, handleOpenNoteByTitle } from './formBrowserHandlers'
import { handleDuplicateForm } from './formBuilderHandlers' // For duplicate functionality
import { handleRequest } from './requestHandlers' // For shared requests like getTeamspaces
import { newCommsRouter, type RequestResponse } from './routerUtils'

const FORM_BROWSER_WINDOW_ID = 'form-browser-window'

/**
 * Route request to appropriate handler based on action type
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data
 * @returns {Promise<RequestResponse>}
 */
async function routeFormBrowserRequest(actionType: string, data: any): Promise<RequestResponse> {
  // Route to form browser specific handlers
  switch (actionType) {
    case 'getFormTemplates':
      return getFormTemplates(data)
    case 'getFormFields':
      return await getFormFields(data)
    case 'submitForm':
      return await handleSubmitForm(data)
    case 'openFormBuilder':
      return await handleOpenFormBuilder(data)
    case 'createNewForm':
      return await handleCreateNewForm(data)
    case 'duplicateForm':
      return await handleDuplicateForm(data)
    case 'openNote':
      return await handleOpenNoteByTitle(data)
    default:
      // For shared requests (getTeamspaces, etc.), use the shared request handler
      return await handleRequest(actionType, data)
  }
}

/**
 * Handle actions from FormBrowserView React component
 * Routes requests to appropriate handlers and sends responses back
 * @param {string} actionType - The action/command type (e.g., 'getFormTemplates', 'getFormFields')
 * @param {any} data - Request data with optional __requestType, __correlationId, __windowId
 * @returns {Promise<any>}
 */
export const onFormBrowserAction: (actionType: string, data: any) => Promise<any> = newCommsRouter({
  routerName: 'onFormBrowserAction',
  defaultWindowId: FORM_BROWSER_WINDOW_ID,
  routeRequest: routeFormBrowserRequest,
  // FormBrowserView primarily uses REQUEST/RESPONSE pattern, no non-REQUEST actions
})
