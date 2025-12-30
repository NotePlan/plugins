// @flow
//--------------------------------------------------------------------------
// FormBuilderView - React WebView wrapper for FormBuilder
//--------------------------------------------------------------------------

import React, { useEffect, useRef, useCallback, type Node } from 'react'
import { type PassedData } from '../shared/types.js'
import { AppProvider } from './AppContext.jsx'
import FormBuilder from './FormBuilder.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import { FORMBUILDER_WINDOW_ID } from '../shared/constants.js'
import './FormBuilder.css'

type Props = {
  data: any,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
  onSubmitOrCancelCallFunctionNamed: string,
}

/**
 * Root element for the FormBuilder's React Tree
 * NOTE: Even though we have named this FormBuilderView.jsx, it is exported as WebView because that is what Root expects to load dynamically
 */
export function WebView({ data, dispatch, reactSettings, setReactSettings, onSubmitOrCancelCallFunctionNamed = 'onFormBuilderAction' }: Props): Node {
  const { pluginData } = data
  const formFields = pluginData.formFields || []
  const receivingTemplateTitle = pluginData.receivingTemplateTitle || ''
  const windowTitle = pluginData.windowTitle || ''
  const formTitle = pluginData.formTitle || ''
  const allowEmptySubmit = pluginData.allowEmptySubmit || false
  const hideDependentItems = pluginData.hideDependentItems || false
  const width = pluginData.width
  const height = pluginData.height
  const x = pluginData.x
  const y = pluginData.y
  const isNewForm = pluginData.isNewForm || false
  const templateTitle = pluginData.templateTitle || ''
  const launchLink = pluginData.launchLink || ''
  const templateFilename = pluginData.templateFilename || ''

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())
  
  // Store windowId in a ref so requestFromPlugin doesn't need to depend on pluginData
  const windowIdRef = useRef<?string>(pluginData?.windowId || FORMBUILDER_WINDOW_ID)
  
  // Update windowId ref when pluginData changes
  useEffect(() => {
    windowIdRef.current = pluginData?.windowId || FORMBUILDER_WINDOW_ID
  }, [pluginData?.windowId])

  // Listen for RESPONSE messages from Root and resolve pending requests
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      // $FlowFixMe[incompatible-type] - eventData can be various types
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        // $FlowFixMe[prop-missing] - payload structure is validated above
        const payload = eventData.payload
        // $FlowFixMe[prop-missing] - payload structure is validated above
        if (payload && typeof payload === 'object') {
          const correlationId = (payload: any).correlationId
          const success = (payload: any).success
          logDebug('FormBuilderView', `handleResponse: Received RESPONSE with correlationId="${String(correlationId || '')}", success=${String(success || false)}`)
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              logDebug('FormBuilderView', `handleResponse: Resolving request for correlationId="${correlationId}", success=${String(success || false)}`)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            } else {
              logDebug('FormBuilderView', `handleResponse: No pending request found for correlationId="${correlationId}"`)
            }
          }
        }
      }
    }

    window.addEventListener('message', handleResponse)
    return () => {
      window.removeEventListener('message', handleResponse)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  const sendActionToPlugin = (command: string, dataToSend: any) => {
    logDebug('FormBuilderView', `sendActionToPlugin: command="${command}"`)
    clo(dataToSend, `FormBuilderView: sendActionToPlugin dataToSend`)
    logDebug('FormBuilderView', `sendActionToPlugin: About to dispatch SEND_TO_PLUGIN with command="${command}", data.type="${dataToSend?.type || 'MISSING'}"`)
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FormBuilderView: ${command}`)
    logDebug('FormBuilderView', `sendActionToPlugin: dispatch called for command="${command}"`)
  }

  /**
   * Request data from the plugin using request/response pattern
   * Returns a Promise that resolves with the response data or rejects with an error
   * Memoized with useCallback to prevent recreation on every render (fixes infinite loop issues)
   * Uses refs for windowId to avoid dependency on pluginData
   * @param {string} command - The command/request type (e.g., 'getFolders', 'getNotes')
   * @param {any} dataToSend - Request parameters
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<any>}
   */
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    if (!command) throw new Error('requestFromPlugin: command must be called with a string')

    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (pendingRequestsRef.current.has(correlationId)) {
          pendingRequestsRef.current.delete(correlationId)
          reject(new Error(`Request timeout after ${timeout}ms: ${command}`))
        }
      }, timeout)

      pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

      // Send request with correlation ID and request type marker
      // Use ref for windowId to avoid dependency on pluginData
      const requestData = {
        ...dataToSend,
        __correlationId: correlationId,
        __requestType: 'REQUEST',
        __windowId: windowIdRef.current, // Include windowId in request for reliable response routing
      }

      logDebug('FormBuilderView', `requestFromPlugin: Sending request "${command}" with correlationId="${correlationId}", windowId="${String(windowIdRef.current || '')}"`)
      dispatch('SEND_TO_PLUGIN', [command, requestData], `FormBuilderView: requestFromPlugin: ${String(command)}`)
    })
  }, [dispatch]) // Only depend on dispatch, which should be stable from useReducer

  const handleSave = async (fields: Array<any>, frontmatter: any): Promise<{ success: boolean, message?: string }> => {
    clo(fields, 'FormBuilderView: handleSave fields')
    clo(frontmatter, 'FormBuilderView: handleSave frontmatter')
    try {
      const result = await requestFromPlugin(onSubmitOrCancelCallFunctionNamed, {
        type: 'save',
        fields,
        frontmatter,
        templateFilename: pluginData.templateFilename || '',
        templateTitle: pluginData.templateTitle || '',
      })
      return { success: true, message: result?.message || 'Form saved successfully' }
    } catch (error) {
      logError('FormBuilderView', `handleSave error: ${error.message}`)
      return { success: false, message: error.message || 'Failed to save form' }
    }
  }

  const handleCancel = () => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, { type: 'cancel' })
  }

  const handleOpenForm = (templateTitle: string) => {
    logDebug('FormBuilderView', `handleOpenForm: called with templateTitle="${templateTitle}"`)
    logDebug('FormBuilderView', `handleOpenForm: onSubmitOrCancelCallFunctionNamed="${onSubmitOrCancelCallFunctionNamed}"`)
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'openForm',
      templateTitle: templateTitle,
      __windowId: windowIdRef.current, // Include windowId so plugin knows which FormBuilder window initiated this
    })
    logDebug('FormBuilderView', `handleOpenForm: sendActionToPlugin called with windowId="${String(windowIdRef.current || '')}"`)
  }

  return (
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendActionToPlugin}
      requestFromPlugin={requestFromPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={(newData) => {
        const newFullData = { ...data, pluginData: newData }
        dispatch('UPDATE_DATA', newFullData)
      }}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
    >
      <div className={`webview ${pluginData.platform || ''}`}>
        <div style={{ maxWidth: '100vw', width: '100vw', height: '100vh' }}>
          <FormBuilder
            initialFields={formFields}
            receivingTemplateTitle={receivingTemplateTitle}
            windowTitle={windowTitle}
            formTitle={formTitle}
            allowEmptySubmit={allowEmptySubmit}
            hideDependentItems={hideDependentItems}
            templateRunnerArgs={pluginData.templateRunnerArgs || {}}
            width={width}
            height={height}
            x={x}
            y={y}
            templateBody={pluginData.templateBody || ''} // Load from codeblock
            customCSS={pluginData.customCSS || ''} // Load from codeblock
            isNewForm={isNewForm}
            templateTitle={templateTitle}
            templateFilename={templateFilename}
            launchLink={launchLink}
            onSave={handleSave}
            onCancel={handleCancel}
            onOpenForm={handleOpenForm}
          />
        </div>
      </div>
    </AppProvider>
  )
}

export default WebView
