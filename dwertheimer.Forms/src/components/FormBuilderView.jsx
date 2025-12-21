// @flow
//--------------------------------------------------------------------------
// FormBuilderView - React WebView wrapper for FormBuilder
//--------------------------------------------------------------------------

import React, { useEffect, useRef, type Node } from 'react'
import { type PassedData } from '../NPTemplateForm.js'
import { AppProvider } from './AppContext.jsx'
import FormBuilder from './FormBuilder.jsx'
import { clo, logDebug } from '@helpers/react/reactDev.js'
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
export function WebView({
  data,
  dispatch,
  reactSettings,
  setReactSettings,
  onSubmitOrCancelCallFunctionNamed = 'onFormBuilderAction',
}: Props): Node {
  const { pluginData } = data
  const formFields = pluginData.formFields || []
  const receivingTemplateTitle = pluginData.receivingTemplateTitle || ''
  const windowTitle = pluginData.windowTitle || ''
  const formTitle = pluginData.formTitle || ''
  const allowEmptySubmit = pluginData.allowEmptySubmit || false
  const hideDependentItems = pluginData.hideDependentItems || false
  const width = pluginData.width
  const height = pluginData.height
  const isNewForm = pluginData.isNewForm || false
  const templateTitle = pluginData.templateTitle || ''

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  // Listen for RESPONSE messages from Root and resolve pending requests
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      // $FlowFixMe[incompatible-type] - eventData can be various types
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        // $FlowFixMe[prop-missing] - payload structure is validated above
        const payload = eventData.payload
        if (payload && typeof payload === 'object' && payload.correlationId && typeof payload.correlationId === 'string') {
          const { correlationId, success, data: responseData, error } = payload
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            clearTimeout(pending.timeoutId)
            if (success) {
              pending.resolve(responseData)
            } else {
              pending.reject(new Error(error || 'Request failed'))
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
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `FormBuilderView: ${command}`)
  }

  /**
   * Request data from the plugin using request/response pattern
   * Returns a Promise that resolves with the response data or rejects with an error
   * @param {string} command - The command/request type (e.g., 'getFolders', 'getNotes')
   * @param {any} dataToSend - Request parameters
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<any>}
   */
  const requestFromPlugin = (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
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
      const requestData = {
        ...dataToSend,
        __correlationId: correlationId,
        __requestType: 'REQUEST',
      }
      
      logDebug('FormBuilderView', `requestFromPlugin: Sending request "${command}" with correlationId="${correlationId}"`)
      dispatch('SEND_TO_PLUGIN', [command, requestData], `FormBuilderView: requestFromPlugin: ${String(command)}`)
    })
  }

  const handleSave = (fields: Array<any>, frontmatter: any) => {
    clo(fields, 'FormBuilderView: handleSave fields')
    clo(frontmatter, 'FormBuilderView: handleSave frontmatter')
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'save',
      fields,
      frontmatter,
      templateFilename: pluginData.templateFilename || '',
      templateTitle: pluginData.templateTitle || '',
    })
  }

  const handleCancel = () => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, { type: 'cancel' })
  }

  const handleOpenForm = (templateTitle: string) => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'openForm',
      templateTitle: templateTitle,
    })
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
            width={width}
            height={height}
            isNewForm={isNewForm}
            templateTitle={templateTitle}
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
