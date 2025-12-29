/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT
 * This is your top-level React component. All other React components should be imported and included below
 ****************************************************************************************************************************/
// @flow

/**
 * IMPORTANT
 * YOU MUST ROLL UP THESE FILES INTO A SINGLE FILE IN ORDER TO USE IT IN THE PLUGIN
 * RUN FROM THE SHELL: node 'np.Shared/src/react/support/performRollup.node.js' --watch
 */

type Props = {
  data: any /* passed in from the plugin as globalSharedData */,
  dispatch: Function,
  reactSettings: any,
  setReactSettings: Function,
  onSubmitOrCancelCallFunctionNamed: string,
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

import React, { useEffect, useRef, useState, useCallback, useMemo, type Node } from 'react'
import { type PassedData } from '../shared/types.js'
import { AppProvider } from './AppContext.jsx'
import DynamicDialog from '@helpers/react/DynamicDialog'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import './FormView.css'

/****************************************************************************************************************************
 *                             CONSOLE LOGGING
 ****************************************************************************************************************************/
/**
 * Root element for the Plugin's React Tree
 * @param {any} data
 * @param {Function} dispatch - function to send data back to the Root Component and plugin
 * NOTE: Even though we have named this FormView.jsx, it is exported as WebView because that is what Root expects to load dynamically
 */
export function FormView({ data, dispatch, reactSettings, setReactSettings, onSubmitOrCancelCallFunctionNamed = 'onSubmitClick' }: Props): Node {
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
  const { pluginData } = data
  const formFields = pluginData.formFields || []

  // Map to store pending requests for request/response pattern
  // Key: correlationId, Value: { resolve, reject, timeoutId }
  const pendingRequestsRef = useRef<Map<string, { resolve: (data: any) => void, reject: (error: Error) => void, timeoutId: any }>>(new Map())

  // State for dynamically loaded folders and notes (loaded on demand, not pre-loaded)
  const [folders, setFolders] = useState<Array<string>>([])
  const [notes, setNotes] = useState<Array<NoteOption>>([])
  const [foldersLoaded, setFoldersLoaded] = useState<boolean>(false)
  const [notesLoaded, setNotesLoaded] = useState<boolean>(false)
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false)
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false)

  // Check if form has folder-chooser or note-chooser fields
  const needsFolders = useMemo(() => formFields.some((field) => field.type === 'folder-chooser'), [formFields])
  const needsNotes = useMemo(() => formFields.some((field) => field.type === 'note-chooser'), [formFields])

  /**
   * Request data from the plugin using request/response pattern
   * Returns a Promise that resolves with the response data or rejects with an error
   * Memoized with useCallback to prevent infinite loops in child components
   * @param {string} command - The command/request type (e.g., 'getFolders', 'getNotes')
   * @param {any} dataToSend - Request parameters
   * @param {number} timeout - Timeout in milliseconds (default: 10000)
   * @returns {Promise<any>}
   */
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    if (!command) throw new Error('requestFromPlugin: command must be called with a string')

    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const requestStartTime = performance.now()
    const pendingCount = pendingRequestsRef.current.size

    logDebug('FormView', `[DIAG] requestFromPlugin START: command="${command}", correlationId="${correlationId}", pendingRequests=${pendingCount}`)

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = pendingRequestsRef.current.get(correlationId)
        if (pending) {
          pendingRequestsRef.current.delete(correlationId)
          const elapsed = performance.now() - requestStartTime
          logDebug('FormView', `[DIAG] requestFromPlugin TIMEOUT: command="${command}", correlationId="${correlationId}", elapsed=${elapsed.toFixed(2)}ms`)
          reject(new Error(`Request timeout: ${command}`))
        }
      }, timeout)

      pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

      // Use requestAnimationFrame to yield to browser before dispatching
      requestAnimationFrame(() => {
        const dispatchElapsed = performance.now() - requestStartTime
        logDebug(
          'FormView',
          `[DIAG] requestFromPlugin DISPATCH: command="${command}", correlationId="${correlationId}", pendingRequests=${
            pendingRequestsRef.current.size
          }, dispatchElapsed=${dispatchElapsed.toFixed(2)}ms`,
        )

        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
          __windowId: pluginData?.windowId || '', // Include windowId in request for reliable response routing
        }

        // Dispatch the request
        requestAnimationFrame(() => {
          const dispatchAfterRAFElapsed = performance.now() - requestStartTime
          logDebug(
            'FormView',
            `[DIAG] requestFromPlugin DISPATCH AFTER RAF: command="${command}", correlationId="${correlationId}", dispatchElapsed=${dispatchAfterRAFElapsed.toFixed(2)}ms`,
          )
          dispatch('SEND_TO_PLUGIN', [command, requestData], `WebView: requestFromPlugin: ${String(command)}`)
        })
      })
    })
      .then((result) => {
        const elapsed = performance.now() - requestStartTime
        logDebug(
          'FormView',
          `[DIAG] requestFromPlugin RESOLVED: command="${command}", correlationId="${correlationId}", elapsed=${elapsed.toFixed(2)}ms, pendingRequests=${
            pendingRequestsRef.current.size
          }`,
        )
        return result
      })
      .catch((error) => {
        const elapsed = performance.now() - requestStartTime
        logDebug(
          'FormView',
          `[DIAG] requestFromPlugin REJECTED: command="${command}", correlationId="${correlationId}", elapsed=${elapsed.toFixed(2)}ms, error="${error.message}", pendingRequests=${
            pendingRequestsRef.current.size
          }`,
        )
        throw error
      })
  }, [dispatch, pluginData?.windowId]) // Memoize to prevent infinite loops - only recreate if dispatch or windowId changes

  // Load folders on demand when needed (matching FormBuilder pattern)
  const loadFolders = useCallback(async () => {
    if (foldersLoaded || loadingFolders || !needsFolders) return

    try {
      setLoadingFolders(true)
      logDebug('FormView', 'Loading folders on demand...')
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      const foldersData = await requestFromPlugin('getFolders', { excludeTrash: true })
      if (Array.isArray(foldersData)) {
        setFolders(foldersData)
        setFoldersLoaded(true)
        logDebug('FormView', `Loaded ${foldersData.length} folders`)
      } else {
        logError('FormView', `Failed to load folders: Invalid response format`)
        setFoldersLoaded(true) // Set to true to prevent infinite retries
      }
    } catch (error) {
      logError('FormView', `Error loading folders: ${error.message}`)
      setFoldersLoaded(true) // Set to true to prevent infinite retries
    } finally {
      setLoadingFolders(false)
    }
  }, [foldersLoaded, loadingFolders, needsFolders, requestFromPlugin])

  // Reload folders (used after creating a new folder)
  const reloadFolders = useCallback(async () => {
    try {
      setLoadingFolders(true)
      setFoldersLoaded(false) // Reset to allow reload
      logDebug('FormView', 'Reloading folders after folder creation...')
      const foldersData = await requestFromPlugin('getFolders', { excludeTrash: true })
      if (Array.isArray(foldersData)) {
        setFolders(foldersData)
        setFoldersLoaded(true)
        logDebug('FormView', `Reloaded ${foldersData.length} folders`)
      } else {
        logError('FormView', `Failed to reload folders: Invalid response format`)
        setFoldersLoaded(true)
      }
    } catch (error) {
      logError('FormView', `Error reloading folders: ${error.message}`)
      setFoldersLoaded(true)
    } finally {
      setLoadingFolders(false)
    }
  }, [requestFromPlugin])

  // Reload notes (used after creating a new note)
  const reloadNotes = useCallback(async () => {
    if (!needsNotes) return

    try {
      setLoadingNotes(true)
      setNotesLoaded(false) // Reset to allow reload
      logDebug('FormView', 'Reloading notes after note creation...')

      // Collect note-chooser options from all note-chooser fields (same as loadNotes)
      const noteChooserFields = formFields.filter((field) => field.type === 'note-chooser')
      const includeCalendarNotes = noteChooserFields.some((field) => field.includeCalendarNotes === true)
      const includePersonalNotes = noteChooserFields.some((field) => field.includePersonalNotes === true)
      const includeRelativeNotes = noteChooserFields.some((field) => field.includeRelativeNotes === true)
      const includeTeamspaceNotes = noteChooserFields.some((field) => field.includeTeamspaceNotes === true)

      const notesData = await requestFromPlugin('getNotes', {
        includeCalendarNotes,
        includePersonalNotes,
        includeRelativeNotes,
        includeTeamspaceNotes,
      })
      if (Array.isArray(notesData)) {
        setNotes(notesData)
        setNotesLoaded(true)
        logDebug('FormView', `Reloaded ${notesData.length} notes`)
      } else {
        logError('FormView', `Failed to reload notes: Invalid response format`)
        setNotesLoaded(true)
      }
    } catch (error) {
      logError('FormView', `Error reloading notes: ${error.message}`)
      setNotesLoaded(true)
    } finally {
      setLoadingNotes(false)
    }
  }, [needsNotes, formFields, requestFromPlugin])

  // Load notes on demand when needed (matching FormBuilder pattern)
  const loadNotes = useCallback(async () => {
    if (notesLoaded || loadingNotes || !needsNotes) return

    try {
      setLoadingNotes(true)
      logDebug('FormView', 'Loading notes on demand...')

      // Load all notes with all options enabled (union of all field options)
      // Each NoteChooser component will filter the notes client-side based on its own options
      const noteChooserFields = formFields.filter((field) => field.type === 'note-chooser')
      const includeCalendarNotes = noteChooserFields.some((field) => field.includeCalendarNotes === true)
      // Include personal notes if ANY field wants them (union logic - load all that might be needed)
      // Since personal notes default to true, we include them if any field has it true or undefined
      const includePersonalNotes = noteChooserFields.some((field) => field.includePersonalNotes !== false) // At least one field wants them
      const includeRelativeNotes = noteChooserFields.some((field) => field.includeRelativeNotes === true)
      // Include teamspace notes if ANY field wants them (union logic - load all that might be needed)
      // Since teamspace notes default to true, we include them if any field has it true or undefined
      const includeTeamspaceNotes = noteChooserFields.some((field) => field.includeTeamspaceNotes !== false) // At least one field wants them

      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      // We load with union of all options, then each NoteChooser filters client-side
      const notesData = await requestFromPlugin('getNotes', {
        includeCalendarNotes,
        includePersonalNotes,
        includeRelativeNotes,
        includeTeamspaceNotes,
      })
      if (Array.isArray(notesData)) {
        setNotes(notesData)
        setNotesLoaded(true)
        logDebug('FormView', `Loaded ${notesData.length} notes`)
      } else {
        logError('FormView', `Failed to load notes: Invalid response format`)
        setNotesLoaded(true) // Set to true to prevent infinite retries
      }
    } catch (error) {
      logError('FormView', `Error loading notes: ${error.message}`)
      setNotesLoaded(true) // Set to true to prevent infinite retries
    } finally {
      setLoadingNotes(false)
    }
  }, [notesLoaded, loadingNotes, needsNotes, requestFromPlugin, formFields])

  // Listen for RESPONSE messages from Root and resolve pending requests
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const responseStartTime = performance.now()
      const { data: eventData } = event
      // $FlowFixMe[incompatible-type] - eventData can be various types
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        // $FlowFixMe[prop-missing] - payload structure is validated above
        const payload = eventData.payload
        if (payload && typeof payload === 'object' && payload.correlationId && typeof payload.correlationId === 'string') {
          const { correlationId, success, data: responseData, error } = payload
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            const resolveStartTime = performance.now()
            pendingRequestsRef.current.delete(correlationId)
            clearTimeout(pending.timeoutId)
            const successStr = typeof success === 'boolean' ? String(success) : 'unknown'
            logDebug(
              'FormView',
              `[DIAG] handleResponse RESOLVING: correlationId="${correlationId}", success=${successStr}, pendingRequests=${pendingRequestsRef.current.size}, handlerElapsed=${(
                performance.now() - responseStartTime
              ).toFixed(2)}ms`,
            )

            // Use requestAnimationFrame to yield before resolving
            requestAnimationFrame(() => {
              const resolveElapsed = performance.now() - resolveStartTime
              logDebug('FormView', `[DIAG] handleResponse RESOLVING AFTER RAF: correlationId="${correlationId}", resolveElapsed=${resolveElapsed.toFixed(2)}ms`)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            })
          } else {
            logDebug('FormView', `[DIAG] handleResponse UNKNOWN: correlationId="${correlationId}" not found in pending requests`)
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

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  //
  // Dynamic Dialog
  //
  const closeDialog = () => {
    setReactSettings((prev) => ({ ...prev, dynamicDialog: { isOpen: false } }))
  }

  const handleCancel = () => {
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, { type: 'cancel' })
    closeDialog()
  }

  const handleSave = (formValues: Object, windowId?: string) => {
    clo(formValues, 'DynamicDialog: handleSave: formValues')
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, {
      type: 'submit',
      formValues,
      windowId: windowId || pluginData.windowId || '', // Pass windowId if available from DynamicDialog or pluginData
      processingMethod: pluginData['processingMethod'] || (pluginData['receivingTemplateTitle'] ? 'form-processor' : 'write-existing'),
      receivingTemplateTitle: pluginData['receivingTemplateTitle'] || '',
      // Option A: Write to existing file
      getNoteTitled: pluginData['getNoteTitled'] || '',
      location: pluginData['location'] || 'append',
      writeUnderHeading: pluginData['writeUnderHeading'] || '',
      replaceNoteContents: pluginData['replaceNoteContents'] || false,
      createMissingHeading: pluginData['createMissingHeading'] !== false,
      // Option B: Create new note
      newNoteTitle: pluginData['newNoteTitle'] || '',
      newNoteFolder: pluginData['newNoteFolder'] || '',
    })
    closeDialog()
  }

  // Return true if the string is 'true' (case insensitive), otherwise return false (blank or otherwise)
  const isTrueString = (value: string): boolean => (value ? /true/i.test(value) : false)

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    }
  }, [data])

  // Load folders/notes automatically when fields change and they're needed (matching FormBuilder pattern)
  useEffect(() => {
    if (needsFolders && !foldersLoaded && !loadingFolders) {
      loadFolders()
    }
  }, [needsFolders, foldersLoaded, loadingFolders, loadFolders])

  useEffect(() => {
    if (needsNotes && !notesLoaded && !loadingNotes) {
      loadNotes()
    }
  }, [needsNotes, notesLoaded, loadingNotes, loadNotes])

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
    if (!newData.passThroughVars) newData.passThroughVars = {}
    // $FlowIgnore
    newData.passThroughVars.lastWindowScrollTop = window.scrollY
    return newData
  }

  /**
   * Convenience function to send an action to the plugin and saving any passthrough data first in the Root data store
   * This is useful if you want to save data that you want to persist when the plugin sends data back to the Webview
   * For instance, saving where the scroll position was so that when data changes and the Webview re-renders, it can scroll back to where it was
   * @param {string} command
   * @param {any} dataToSend
   */
  const sendActionToPlugin = (command: string, dataToSend: any, additionalDetails: string = '') => {
    const newData = addPassthroughVars(data) // save scroll position and other data in data object at root level
    dispatch('UPDATE_DATA', newData) // save the data at the Root React Component level, which will give the plugin access to this data also
    sendToPlugin([command, dataToSend, additionalDetails]) // send action to plugin
  }

  /**
   * Send data back to the plugin to update the data in the plugin
   * This could cause a refresh of the Webview if the plugin sends back new data, so we want to save any passthrough data first
   * In that case, don't call this directly, use sendActionToPlugin() instead
   * @param {[command:string,data:any,additionalDetails:string]} param0
   */
  // $FlowIgnore
  const sendToPlugin = ([command: string, data: any, additionalDetails: string = '']) => {
    if (!command) throw new Error('sendToPlugin: command must be called with a string')
    logDebug(`Webview: sendToPlugin: ${JSON.stringify(command)} ${additionalDetails}`, command, data, additionalDetails)
    if (!data) throw new Error('sendToPlugin: data must be called with an object')
    dispatch('SEND_TO_PLUGIN', [command, data], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`)
  }

  /**
   * Updates the pluginData with the provided new data (must be the whole pluginData object)
   *
   * @param {Object} newData - The new data to update the plugin with,
   * @param {string} messageForLog - An optional message to log with the update
   * @throws {Error} Throws an error if newData is not provided or if it does not have more keys than the current pluginData.
   * @return {void}
   */
  const updatePluginData = (newData: any, messageForLog?: string) => {
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

  /**
   * NOTE: THE FOLLOWING CODE DOES NOT DO MUCH, BECAUSE ALL THE MAGIC HAPPENS IN THE DynamicDialog.jsx component
   * WHICH IS OPENED WHEN reactData.dynamicDialog.isOpen is set to true
   * which happens when the useEffect() in this FormView.jsx file opens the dialog on page load
   */
  // Diagnostic: Log render timing
  useEffect(() => {
    const renderStartTime = performance.now()
    logDebug('FormView', `[DIAG] FormView RENDER START: formFields=${formFields.length}, folders=${folders.length}, notes=${notes.length}`)

    requestAnimationFrame(() => {
      const renderElapsed = performance.now() - renderStartTime
      logDebug('FormView', `[DIAG] FormView RENDER AFTER RAF: elapsed=${renderElapsed.toFixed(2)}ms`)
    })
  })

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
        <div style={{ maxWidth: '100vw', width: '100vw' }}>
          <DynamicDialog
            isOpen={true}
            title={pluginData?.formTitle || ''}
            items={formFields}
            onSave={handleSave}
            onCancel={handleCancel}
            allowEmptySubmit={isTrueString(pluginData.allowEmptySubmit)}
            hideDependentItems={isTrueString(pluginData.hideDependentItems)}
            folders={folders}
            notes={notes}
            requestFromPlugin={requestFromPlugin}
            windowId={pluginData.windowId} // Pass windowId to DynamicDialog
            onFoldersChanged={() => {
              reloadFolders()
            }}
            onNotesChanged={() => {
              reloadNotes()
            }}
          />
        </div>
        {/* end of replace */}
      </div>
    </AppProvider>
  )
}
