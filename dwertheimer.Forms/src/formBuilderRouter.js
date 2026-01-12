// @flow
//--------------------------------------------------------------------------
// Form Builder Router
// Routes actions from FormBuilderView React component to appropriate handlers
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { handleRequest } from './requestHandlers' // For shared requests like getFolders, getNotes, getTeamspaces
import { handleSaveRequest, handleCreateProcessingTemplate, handleOpenNote, handleCopyFormUrl, handleDuplicateForm } from './formBuilderHandlers'
import { openFormBuilderWindow, FORMBUILDER_WINDOW_ID } from './windowManagement'
import { openTemplateForm } from './NPTemplateForm'
import { newCommsRouter, type RequestResponse } from '@helpers/react/routerUtils'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { getNoteByFilename } from '@helpers/note'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString } from '@helpers/stringTransforms'
import { logDebug, logError, logWarn } from '@helpers/dev'

/**
 * Route request to appropriate handler based on action type
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data
 * @returns {Promise<RequestResponse>}
 */
async function routeFormBuilderRequest(actionType: string, data: any): Promise<RequestResponse> {
  // Add immediate logging to catch hangs
  console.log(`[routeFormBuilderRequest] Called with actionType="${actionType}", data.type="${data?.type || 'none'}"`)
  console.log(`[routeFormBuilderRequest] data.fields type: ${Array.isArray(data?.fields) ? 'array' : typeof data?.fields}, length: ${data?.fields?.length || 0}`)
  if (data?.fields?.length > 0) {
    console.log(`[routeFormBuilderRequest] First field type: ${typeof data.fields[0]}, is string: ${typeof data.fields[0] === 'string'}`)
  }
  
  // Handle save action as a special case (it's not a standard request)
  const actualActionType = data?.type
  console.log(`[routeFormBuilderRequest] actualActionType="${actualActionType}"`)
  if (actualActionType === 'save') {
    console.log(`[routeFormBuilderRequest] Routing to handleSaveRequest with fields type: ${typeof data.fields}, isArray: ${Array.isArray(data.fields)}`)
    console.log(`[routeFormBuilderRequest] About to call handleSaveRequest`)
    const result = await handleSaveRequest(data)
    console.log(`[routeFormBuilderRequest] handleSaveRequest returned, success: ${result?.success}`)
    return result
  }

  // Route to form builder specific handlers
  switch (actionType) {
    case 'createProcessingTemplate':
      return await handleCreateProcessingTemplate(data)
    case 'openNote':
      return handleOpenNote(data)
    case 'copyFormUrl':
      return handleCopyFormUrl(data)
    case 'duplicateForm':
      return await handleDuplicateForm(data)
    default:
      // For shared requests (getFolders, getNotes, getTeamspaces, etc.), use the shared request handler
      return await handleRequest(actionType, data)
  }
}

/**
 * Handle non-REQUEST actions (legacy action-based pattern)
 * @param {string} actionType - The action type
 * @param {any} data - Request data
 * @returns {Promise<any>}
 */
async function handleFormBuilderNonRequestAction(_actionType: string, data: any): Promise<any> {
  // The data structure from React is: { type: 'save'|'cancel'|'openForm', fields: [...], templateFilename: ..., templateTitle: ... }
  // actionType will be "onFormBuilderAction" (the command name), and the actual action is in data.type
  const actualActionType = data?.type
  logDebug(pluginJson, `onFormBuilderAction: actualActionType="${actualActionType}"`)
  logDebug(pluginJson, `onFormBuilderAction: data keys: ${Object.keys(data || {}).join(', ')}`)
  if (actualActionType === 'openForm') {
    logDebug(pluginJson, `onFormBuilderAction: openForm detected, data.templateTitle="${data?.templateTitle || 'MISSING'}"`)
  }

  // Get window ID from data (passed from React), or fall back to default
  const windowId = data?.__windowId || FORMBUILDER_WINDOW_ID
  logDebug(pluginJson, `onFormBuilderAction: Using windowId="${windowId}"`)

  if (actualActionType === 'cancel') {
    logDebug(pluginJson, `onFormBuilderAction: User cancelled, closing window`)
    closeWindowFromCustomId(windowId)
  } else if (actualActionType === 'openForm' && data?.templateTitle) {
    logDebug(pluginJson, `onFormBuilderAction: Opening form with templateTitle="${data.templateTitle}"`)
    logDebug(pluginJson, `onFormBuilderAction: Calling openTemplateForm with templateTitle="${data.templateTitle}"`)
    try {
      await openTemplateForm(data.templateTitle)
      logDebug(pluginJson, `onFormBuilderAction: openTemplateForm completed successfully`)
    } catch (error) {
      logError(pluginJson, `onFormBuilderAction: Error in openTemplateForm: ${error.message}`)
      logError(pluginJson, `onFormBuilderAction: Error stack: ${error.stack || 'No stack trace'}`)
      throw error
    }
  } else if (actualActionType === 'duplicateForm' && data?.newTemplateFilename) {
    // After duplicating, open the new form in Form Builder
    logDebug(pluginJson, `onFormBuilderAction: Opening duplicated form with filename="${data.newTemplateFilename}"`)
    const newNote = await getNoteByFilename(data.newTemplateFilename)
    if (newNote) {
      const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(newNote, 'formfields', pluginJson.id, parseObjectString)
      const formFields = loadedFormFields || []
      await openFormBuilderWindow({
        formFields,
        templateFilename: data.newTemplateFilename,
        templateTitle: data.newTemplateTitle || newNote.title || '',
        initialReceivingTemplateTitle: data.newReceivingTemplateTitle,
      })
    }
  } else {
    logWarn(pluginJson, `onFormBuilderAction: Unknown actualActionType="${actualActionType}" or missing fields/data`)
    logWarn(pluginJson, `onFormBuilderAction: data.keys=${Object.keys(data || {}).join(', ')}`)
  }

  return {}
}

/**
 * Handle actions from FormBuilderView React component
 * Routes requests to appropriate handlers and sends responses back
 * @param {string} actionType - The action/command type
 * @param {any} data - Request data with optional __requestType, __correlationId, __windowId
 * @returns {Promise<any>}
 */
export const onFormBuilderAction: (actionType: string, data: any) => Promise<any> = newCommsRouter({
  routerName: 'onFormBuilderAction',
  defaultWindowId: FORMBUILDER_WINDOW_ID,
  routeRequest: routeFormBuilderRequest,
  handleNonRequestAction: handleFormBuilderNonRequestAction,
  pluginJson: pluginJson,
  useSharedHandlersFallback: true, // Forms uses shared handlers for choosers
})
