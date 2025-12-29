/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT
 * This is your top-level React component. All other React components should be imported and included below
 ****************************************************************************************************************************/
// @flow

/**
 * IMPORTANT
 * YOU MUST ROLL UP THESE FILES INTO A SINGLE FILE IN ORDER TO USE IT IN THE PLUGIN
 * RUN FROM THE SHELL: node 'dwertheimer.ReactSkeleton/src/react/support/performRollup.node.js' --watch
 */

type Props = {
  data: any /* passed in from the plugin as globalSharedData */,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
}
/****************************************************************************************************************************
 *                             NOTES
 * WebView should act as a "controlled component", as far as the data from the plugin is concerned.
 * Plugin-related data is always passed in via props, and never stored in state in this component
 *
 * FYI, if you do use state, it is highly recommended when setting state with hooks to use the functional form of setState
 * e.g. setTodos((prevTodos) => [...prevTodos, newTodo]) rather than setTodos([...todos, newTodo])
 * This has cost me a lot of time in debugging stale state issues
 */

/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import React, { useEffect, useCallback, useRef, type Node } from 'react'
import { type PassedData } from '../../reactMain.js'
import { AppProvider } from './AppContext.jsx'
import CompositeLineExample from './CompositeLineExample.jsx'
import Button from './Button.jsx'
import { clo, logDebug, timer } from '@helpers/react/reactDev'
/**
 * Root element for the Plugin's React Tree
 * @param {any} data
 * @param {Function} dispatch - function to send data back to the Root Component and plugin
 */
export function WebView({ data, dispatch, reactSettings, setReactSettings }: Props): Node {
  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/

  // GENERALLY SPEAKING YOU DO NOT WANT TO USE STATE HOOKS IN THE WEBVIEW COMPONENT
  // because the plugin may need to know what changes were made so when it updates data, it will be consistent
  // otherwise when the plugin updates data, it will overwrite any changes made locally in the Webview
  // instead of using hooks here, save updates to data using:
  // dispatch('UPDATE_DATA', {...data,changesToData})
  // this will save the data at the Root React Component level, which will give the plugin access to this data also
  // sending this dispatch will re-render the Webview component with the new data

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/

  // destructure all the startup data we expect from the plugin
  const { pluginData, debug } = data
  const { tableRows } = pluginData

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /**
   * Request data from the plugin using request/response pattern
   * Returns a Promise that resolves with the response data or rejects with an error
   * CRITICAL: Must use useCallback to prevent infinite loops when passed to AppContext
   * @param {string} command - The command/request type (e.g., 'getData')
   * @param {any} dataToSend - Request parameters
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<any>}
   */
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    if (!command) throw new Error('requestFromPlugin: command must be called with a string')

    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = pendingRequestsRef.current.get(correlationId)
        if (pending) {
          pendingRequestsRef.current.delete(correlationId)
          reject(new Error(`Request timeout: ${command}`))
        }
      }, timeout)

      pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

      const requestData = {
        ...dataToSend,
        __correlationId: correlationId,
        __requestType: 'REQUEST',
        // NOTE: __windowId is automatically injected by Root.jsx if not present
        // Root.jsx extracts it from globalSharedData.pluginData?.windowId for ALL SEND_TO_PLUGIN dispatches
      }

      dispatch('SEND_TO_PLUGIN', [command, requestData], `WebView: requestFromPlugin: ${String(command)}`)
    })
      .then((result) => {
        return result
      })
      .catch((error) => {
        throw error
      })
  }, [dispatch]) // Minimal dependencies - only recreate if dispatch changes (__windowId is handled by Root.jsx)

  /**
   * Submit button on the page was clicked
   * (sample handler for a button in the react window)
   * @param {any} e - the event object
   * @param {number} index - the index of the button that was clicked
   */
  const onSubmitClick = (e: any, index: number) => {
    logDebug(`Webview: onSubmitClick: ${e.type || ''} click on index: ${index}`)
    sendActionToPlugin('onSubmitClick', { index: index })
  }

  // A sample function that does something interactive in the window using React
  // you will delete this
  const scrambleLines = () => {
    logDebug(`Webview: scrambleLines: click`)
    // in this example, we are not going to send any data back to the plugin, everything is local
    // we are just randomly reordering the lines just for demonstration purposes
    const newTableRows = [...tableRows]
    newTableRows.sort(() => Math.random() - 0.5)
    const newData = { ...data, pluginData: { ...data.pluginData, tableRows: newTableRows } }
    dispatch('UPDATE_DATA', newData) // save the data at the Root React Component level, which will give the plugin access to this data also
    // this will cause this component to re-render with the new data
    // will never reach anything below this line because the component will re-render
    dispatch('SHOW_BANNER', {
      msg: 'FYI: Page automatically re-rendered locally after pluginData was changed at Root component level. Did not call the plugin.',
      color: 'blue',
      border: 'blue',
    })
  }

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * Listen for RESPONSE messages from Root and resolve pending requests
   * This handles the request/response pattern communication
   */
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
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
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

  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    logDebug(`Webview: useEffect: data changed. data: ${JSON.stringify(data)}`)
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      debug && logDebug(`Webview: useEffect: data changed. Scrolling to ${String(data.lastWindowScrollTop)}`)
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    }
  }, [data])

  /****************************************************************************************************************************
   *                             FUNCTIONS
   ****************************************************************************************************************************/
  /**
   * Helper function to remove HTML entities from a string. Not used in this example but leaving here because it's useful
   * if you want to allow people to enter text in an HTML field
   * @param {string} text
   * @returns {string} cleaned text without HTML entities
   */
  // eslint-disable-next-line no-unused-vars
  function decodeHTMLEntities(text: string): string {
    const textArea = document.createElement('textarea')
    textArea.innerHTML = text
    const decoded = textArea.value
    return decoded
  }

  /**
   * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
   * Because any data change coming from the plugin will force a React re-render, we can use this to store data that we want to persist
   * (e.g. lastWindowScrollTop)
   * @param {*} data
   * @returns
   */
  const addPassthroughVars = (data: PassedData): PassedData => {
    const newData = { ...data }
    if (!newData.passThroughVars) newData.passThroughVars = { lastWindowScrollTop: 0 }
    newData.passThroughVars.lastWindowScrollTop = window.scrollY
    return newData
  }

  /**
   * Send data back to the plugin to update the data in the plugin
   * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
   * In that case, don't call this directly, use sendActionToPlugin() instead
   * CRITICAL: Must use useCallback to prevent infinite loops when passed to AppContext
   * 
   * NOTE: __windowId is automatically injected by Root.jsx if not present, so you don't need to add it manually.
   * Root.jsx extracts it from globalSharedData.pluginData?.windowId.
   * 
   * @param {string} command - The command to send
   * @param {any} dataToSend - The data to send
   * @param {string} additionalDetails - Optional additional details for logging
   */
  const sendToPlugin = useCallback((command: string, dataToSend: any, additionalDetails: string = '') => {
    if (!command) throw new Error('sendToPlugin: command must be called with a string')
    logDebug(`Webview: sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, dataToSend, additionalDetails)
    if (!dataToSend) throw new Error('sendToPlugin: data must be called with an object')
    // NOTE: __windowId is automatically injected by Root.jsx if not present
    dispatch('SEND_TO_PLUGIN', [command, dataToSend], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`)
  }, [dispatch])

  /**
   * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
   * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
   * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
   * CRITICAL: Must use useCallback to prevent infinite loops when passed to AppContext
   * 
   * NOTE: __windowId is automatically injected by Root.jsx if not present, so you don't need to add it manually.
   * Root.jsx extracts it from globalSharedData.pluginData?.windowId.
   * 
   * @param {string} command
   * @param {any} dataToSend
   */
  const sendActionToPlugin = useCallback((command: string, dataToSend: any, additionalDetails: string = '') => {
    logDebug(`Webview: sendActionToPlugin: ${command} ${additionalDetails}`, dataToSend)
    const newData: PassedData = addPassthroughVars(data) // save scroll position and other data in data object at root level
    dispatch('UPDATE_DATA', newData) // save the data at the Root React Component level, which will give the plugin access to this data also
    // NOTE: __windowId is automatically injected by Root.jsx if not present
    sendToPlugin(command, dataToSend, additionalDetails) // send action to plugin
  }, [dispatch, data, sendToPlugin]) // Include sendToPlugin since it's used inside

  /**
   * Updates the pluginData with the provided new data (must be the whole pluginData object)
   *
   * @param {Object} newData - The new data to update the plugin with,
   * @param {string} messageForLog - An optional message to log with the update
   * @throws {Error} Throws an error if newData is not provided or if it does not have more keys than the current pluginData.
   * @return {void}
   */
  const updatePluginData = (newData: Object, messageForLog?: string) => {
    if (!newData) {
      throw new Error('updatePluginData: newData must be called with an object')
    }
    if (Object.keys(newData).length < Object.keys(pluginData).length) {
      throw new Error('updatePluginData: newData must be called with an object that has more keys than the current pluginData. You must send a full pluginData object')
    }
    const newFullData = { ...data, pluginData: newData }
    dispatch('UPDATE_DATA', newFullData, messageForLog) // save the data at the Root React Component level, which will give the plugin access to this data also
  }
  if (!pluginData.reactSettings) pluginData.reactSettings = {}

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <AppProvider
      sendActionToPlugin={sendActionToPlugin}
      sendToPlugin={sendToPlugin}
      requestFromPlugin={requestFromPlugin}
      dispatch={dispatch}
      pluginData={pluginData}
      updatePluginData={updatePluginData}
      reactSettings={reactSettings}
      setReactSettings={setReactSettings}
    >
      <div className={`webview ${pluginData.platform || ''}`}>
        {/* replace all this code with your own component(s) */}
        <div style={{ maxWidth: '100%', width: '100%' }}>
          <Button onClick={scrambleLines} className="w3-light-blue">
            Randomize Lines Locally in React (without calling Plugin)
          </Button>
          <div className="w3-container w3-green w3-margin-top">
            <div className="w3-cell-row" style={{ fontWeight: 'bold' }}>
              <div className="w3-cell">Text</div>
              <div className="w3-cell">Submit Change to Plugin</div>
            </div>
          </div>
          {tableRows.map((row) => (
            <CompositeLineExample index={row.id} onSubmitClick={onSubmitClick} key={row.id} textValue={row.textValue} buttonText={row.buttonText} />
          ))}
        </div>
        {/* end of replace */}
      </div>
    </AppProvider>
  )
}
