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
import { createPortal } from 'react-dom'
import { type PassedData } from '../shared/types.js'
import { AppProvider } from './AppContext.jsx'
import FormErrorBanner from './FormErrorBanner.jsx'
import DynamicDialog from '@helpers/react/DynamicDialog'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { clo, logDebug, logError } from '@helpers/react/reactDev.js'
import './FormView.css'

/** Commands that load data for choosers; suppressed during submit to avoid storm of REQUESTS that can cause freeze */
const DATA_LOAD_COMMANDS = ['getFolders', 'getTeamspaces', 'getNotes', 'getHashtags', 'getMentions', 'getEvents', 'getFrontmatterKeyValues']

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

  /** When true, requestFromPlugin skips data-load commands (getFolders, getNotes, etc.) to avoid storm of REQUESTS during submit that can cause freeze */
  const suppressDataRequestsRef = useRef<boolean>(false)

  // State for dynamically loaded folders and notes (loaded on demand, or pre-loaded from pluginData if available)
  // Check if preloaded data exists in pluginData (for static HTML testing with preloadChooserData: true)
  const [folders, setFolders] = useState<Array<string>>(() => {
    // Initialize from preloaded data if available
    const preloadedFolders = pluginData?.folders
    if (Array.isArray(preloadedFolders) && preloadedFolders.length > 0) {
      logDebug('FormView', `Using preloaded folders: ${preloadedFolders.length} folders`)
      return preloadedFolders
    }
    logDebug('FormView', `No preloaded folders found, will load dynamically (folders type: ${typeof preloadedFolders}, length: ${preloadedFolders?.length || 0})`)
    return []
  })
  const [notes, setNotes] = useState<Array<NoteOption>>(() => {
    // Initialize from preloaded data if available
    const preloadedNotes = pluginData?.notes
    if (Array.isArray(preloadedNotes) && preloadedNotes.length > 0) {
      logDebug('FormView', `Using preloaded notes: ${preloadedNotes.length} notes`)
      return preloadedNotes
    }
    logDebug('FormView', `No preloaded notes found, will load dynamically (notes type: ${typeof preloadedNotes}, length: ${preloadedNotes?.length || 0})`)
    return []
  })
  // Check if preloaded data exists (for setting loaded flags)
  const hasPreloadedFolders = Array.isArray(pluginData?.folders) && pluginData.folders.length > 0
  const hasPreloadedNotes = Array.isArray(pluginData?.notes) && pluginData.notes.length > 0
  const [foldersLoaded, setFoldersLoaded] = useState<boolean>(hasPreloadedFolders) // If preloaded, mark as loaded
  const [notesLoaded, setNotesLoaded] = useState<boolean>(hasPreloadedNotes) // If preloaded, mark as loaded
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
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      // During submit, skip data-load requests so fields don't storm the bridge and cause freeze
      if (suppressDataRequestsRef.current && DATA_LOAD_COMMANDS.includes(command)) {
        logDebug('FormView', `[DIAG] requestFromPlugin SKIP (submitting): command="${command}"`)
        if (!Promise.resolve) {
          logError('FormView', `[DIAG] Promise.resolve is not defined, this is a critical error`)
          throw new Error('Promise.resolve is not defined, this is a critical error')
        }
        return Promise.resolve([])
      }

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const requestStartTime = performance.now()
      const pendingCount = pendingRequestsRef.current.size

      logDebug('FormView', `[DIAG] requestFromPlugin START: command="${command}", correlationId="${correlationId}", pendingRequests=${pendingCount}`)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // CRITICAL: Check if component is still mounted before accessing refs and rejecting
          if (!isMountedRef.current) {
            logDebug('FormView', `[DIAG] requestFromPlugin TIMEOUT skipped - component unmounted: command="${command}", correlationId="${correlationId}"`)
            return
          }
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
            `[DIAG] requestFromPlugin REJECTED: command="${command}", correlationId="${correlationId}", elapsed=${elapsed.toFixed(2)}ms, error="${
              error.message
            }", pendingRequests=${pendingRequestsRef.current.size}`,
          )
          throw error
        })
    },
    [dispatch, pluginData?.windowId],
  ) // Memoize to prevent infinite loops - only recreate if dispatch or windowId changes

  // Load folders on demand when needed (matching FormBuilder pattern)
  // Always load all folders (space: null) so folder-choosers with space dependencies can filter client-side
  const loadFolders = useCallback(async () => {
    if (foldersLoaded || loadingFolders || !needsFolders) return

    try {
      setLoadingFolders(true)
      logDebug('FormView', 'Loading folders on demand... (all spaces)')
      // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
      // Pass space: null to get all folders from all spaces (FolderChooser will filter client-side based on spaceFilter prop)
      const foldersData = await requestFromPlugin('getFolders', { excludeTrash: true, space: null })
      if (Array.isArray(foldersData)) {
        setFolders(foldersData)
        setFoldersLoaded(true)
        logDebug('FormView', `Loaded ${foldersData.length} folders (all spaces)`)
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
  // Always load all folders (space: null) so folder-choosers with space dependencies can filter client-side
  const reloadFolders = useCallback(async () => {
    try {
      setLoadingFolders(true)
      setFoldersLoaded(false) // Reset to allow reload
      logDebug('FormView', 'Reloading folders after folder creation... (all spaces)')
      // Pass space: null to get all folders from all spaces
      const foldersData = await requestFromPlugin('getFolders', { excludeTrash: true, space: null })
      if (Array.isArray(foldersData)) {
        setFolders(foldersData)
        setFoldersLoaded(true)
        logDebug('FormView', `Reloaded ${foldersData.length} folders (all spaces)`)
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

  // Inject custom CSS from pluginData if provided
  useEffect(() => {
    const customCSS = pluginData?.customCSS || ''
    if (!customCSS || typeof document === 'undefined') return

    // $FlowFixMe[incompatible-use] - document.head is checked for null
    const head = document.head
    if (!head) return

    // Create a style element with a unique ID to avoid duplicates
    const styleId = 'form-custom-css'
    let styleElement = document.getElementById(styleId)

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      // $FlowFixMe[incompatible-use] - head is checked for null above
      head.appendChild(styleElement)
    }

    if (styleElement) {
      styleElement.textContent = customCSS
    }

    // Cleanup: remove style element when component unmounts or CSS changes
    return () => {
      const element = document.getElementById(styleId)
      if (element) {
        element.remove()
      }
    }
  }, [pluginData?.customCSS])

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
          const { correlationId, success, data: responseData, error: responseError } = payload
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
            // Resolve with responseData for success; for failure, pass __error + message so handleSave can show it without wiping state
            // (when backend returns success=false, data is often null—resolving with null and skipping dispatch hid the error)
            const valueToResolve = success
              ? responseData
              : responseData && typeof responseData === 'object'
              ? responseData
              : { __error: true, message: responseError || 'Request failed' }
            requestAnimationFrame(() => {
              const resolveElapsed = performance.now() - resolveStartTime
              logDebug(
                'FormView',
                `[DIAG] handleResponse RESOLVING AFTER RAF: correlationId="${correlationId}", success=${String(success)}, resolveElapsed=${resolveElapsed.toFixed(2)}ms`,
              )
              pending.resolve(valueToResolve)
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
    setIsSubmitting(false) // Hide overlay if canceling during submission
    setFormSubmitted(false) // Reset submitted state
    sendActionToPlugin(onSubmitOrCancelCallFunctionNamed, { type: 'cancel' })
    closeDialog()
  }

  // Track if form was submitted to handle delayed closing
  const [formSubmitted, setFormSubmitted] = useState<boolean>(false)
  // Track if form is currently submitting (for showing loading overlay)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Debug counters (tracked via refs to avoid re-renders)
  const debugCountersRef = useRef<{ renders: number, setDataReceived: number, handleSaveCalls: number }>({ renders: 0, setDataReceived: 0, handleSaveCalls: 0 })
  const handleSaveCallCountRef = useRef<number>(0)
  const setDataReceivedCountRef = useRef<number>(0)
  /** Blocks double-submit; set sync in handleSave, cleared in deferred state update (avoids re-render blocking getGlobalSharedData) */
  const submissionInProgressRef = useRef<boolean>(false)
  // Ref to track if component is mounted (prevents callbacks after unmount) - declared early so it's available to all setTimeout callbacks
  const isMountedRef = useRef<boolean>(true)

  // Close dialog after submission if there's no AI analysis result
  // GUARD: Use ref to prevent this effect from running multiple times with same data
  const formSubmittedEffectRunRef = useRef<string>('')
  // Ref to track timeout ID for proper cleanup (prevents race condition crash)
  const closeDialogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to track effect instance ID (increments each time effect runs, prevents stale callback execution)
  const effectInstanceIdRef = useRef<number>(0)
  useEffect(() => {
    // Clear any existing timeout when effect runs (cleanup from previous effect run)
    if (closeDialogTimeoutRef.current != null) {
      clearTimeout(closeDialogTimeoutRef.current)
      closeDialogTimeoutRef.current = null
    }
    // Increment instance ID to invalidate any pending callbacks from previous effect runs
    const currentInstanceId = ++effectInstanceIdRef.current

    if (formSubmitted) {
      // Create a signature for this effect run to prevent duplicate processing
      const signature = `${String(!!pluginData?.aiAnalysisResult)}-${String(!!pluginData?.formSubmissionError)}`
      if (formSubmittedEffectRunRef.current === signature) {
        // Already processed this state, skip to prevent loops
        return
      }
      formSubmittedEffectRunRef.current = signature
      // Check if there's an AI analysis result
      const hasAiAnalysis = pluginData?.aiAnalysisResult && typeof pluginData.aiAnalysisResult === 'string' && pluginData.aiAnalysisResult.includes('==**Templating Error Found**')
      logDebug(
        'FormView',
        `[AI ANALYSIS] formSubmitted=${String(formSubmitted)}, hasAiAnalysis=${String(hasAiAnalysis)}, aiAnalysisResult exists=${String(!!pluginData?.aiAnalysisResult)}, length=${
          pluginData?.aiAnalysisResult?.length || 0
        }`,
      )

      const hasFormSubmissionError = pluginData?.formSubmissionError && typeof pluginData.formSubmissionError === 'string'

      // Hide submitting overlay and allow resubmit if we received an error or AI analysis result
      if (hasAiAnalysis || hasFormSubmissionError) {
        setIsSubmitting(false)
        setFormSubmitted(false) // Allow user to click Submit again when error/AI analysis banner is shown
        suppressDataRequestsRef.current = false // Allow data-load requests again when keeping dialog open for error
        submissionInProgressRef.current = false // Ensure guard allows next submit (belt-and-suspenders)
        formSubmittedEffectRunRef.current = '' // So next effect run (after second submit) doesn't skip due to signature match
      }

      if (!hasAiAnalysis && !hasFormSubmissionError) {
        // No AI analysis result and no form submission error - close the dialog after a short delay to allow data to update
        logDebug('FormView', `[AI ANALYSIS] No AI analysis result, no form submission error, will close dialog after 500ms delay`)
        // Capture instance ID in closure for the timeout callback
        const callbackInstanceId = currentInstanceId
        // Capture current timeout ref to verify it hasn't been cleared
        const timeoutRef = closeDialogTimeoutRef
        closeDialogTimeoutRef.current = setTimeout(() => {
          try {
            // CRITICAL: Check if component is still mounted, effect instance is still current, and timeout hasn't been cleared
            // This prevents crashes when the component unmounts or effect re-runs while callback is executing
            const isUnmounted = !isMountedRef.current
            const instanceChanged = effectInstanceIdRef.current !== callbackInstanceId
            const timeoutCleared = timeoutRef.current === null
            if (isUnmounted || instanceChanged || timeoutCleared) {
              logDebug('FormView', `[AI ANALYSIS] Timeout callback skipped - unmounted=${String(isUnmounted)}, instance changed (${callbackInstanceId} -> ${effectInstanceIdRef.current}), timeout cleared=${String(timeoutCleared)}`)
              return
            }
            // Double-check there's still no AI analysis result or form submission error
            // Access pluginData safely - it might be stale but that's okay for this check
            const stillNoAiAnalysis = !pluginData?.aiAnalysisResult || !pluginData.aiAnalysisResult.includes('==**Templating Error Found**')
            const stillNoFormError = !pluginData?.formSubmissionError
            logDebug('FormView', `[AI ANALYSIS] After 500ms delay, stillNoAiAnalysis=${String(stillNoAiAnalysis)}, stillNoFormError=${String(stillNoFormError)}, closing dialog`)
            if (stillNoAiAnalysis && stillNoFormError) {
              setIsSubmitting(false) // Hide overlay before closing
              suppressDataRequestsRef.current = false // Allow data-load requests again after submit completes
              closeDialog()
              setFormSubmitted(false)
            }
          } catch (err) {
            // Defensive: catch any errors to prevent crashes during cleanup
            logDebug('FormView', `[AI ANALYSIS] Error in timeout callback (likely component unmounted): ${String(err)}`)
          }
        }, 500) // Wait 500ms for SET_DATA message to arrive
      } else {
        logDebug('FormView', `[AI ANALYSIS] AI analysis result or form submission error detected, keeping dialog open`)
        // If there's an AI analysis result or form submission error, keep the dialog open (don't close)
      }
    }

    // Cleanup function: clear timeout
    return () => {
      if (closeDialogTimeoutRef.current != null) {
        clearTimeout(closeDialogTimeoutRef.current)
        closeDialogTimeoutRef.current = null
      }
    }
  }, [formSubmitted, pluginData?.aiAnalysisResult, pluginData?.formSubmissionError])

  // Track mount state to prevent callbacks after unmount
  useEffect(() => {
    isMountedRef.current = true
    
    // CRITICAL: Handle window/page replacement (when NotePlan reuses window with new content)
    // When the window content is replaced, React may not get a chance to unmount properly
    // This ensures cleanup happens even if React's unmount lifecycle doesn't complete
    const handlePageUnload = () => {
      logDebug('FormView', '[CLEANUP] Page unloading - clearing all pending timeouts and marking as unmounted')
      isMountedRef.current = false
      // Clear all pending timeouts
      if (closeDialogTimeoutRef.current != null) {
        clearTimeout(closeDialogTimeoutRef.current)
        closeDialogTimeoutRef.current = null
      }
      // Clear any pending requests
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
    
    // Listen for page unload events (fires when window content is replaced)
    window.addEventListener('beforeunload', handlePageUnload)
    window.addEventListener('pagehide', handlePageUnload)
    // Also listen for visibility change as a fallback
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden - might be replaced soon, but don't clear yet
        // Just log for debugging
        logDebug('FormView', '[CLEANUP] Page visibility changed to hidden')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      isMountedRef.current = false
      // Clear any pending timeout on unmount
      if (closeDialogTimeoutRef.current != null) {
        clearTimeout(closeDialogTimeoutRef.current)
        closeDialogTimeoutRef.current = null
      }
      // Remove event listeners
      window.removeEventListener('beforeunload', handlePageUnload)
      window.removeEventListener('pagehide', handlePageUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  /**
   * Submit form via REQUEST/RESPONSE so errors (formSubmissionError, aiAnalysisResult) are returned
   * and shown before the dialog closes. Uses requestFromPlugin('submitForm', payload) per REQUEST_COMMUNICATIONS_AND_ROUTING.
   */
  const handleSave = useCallback(
    (formValues: Object, windowId?: string) => {
      // GUARD: Prevent multiple submissions (critical for preventing loops)
      if (submissionInProgressRef.current || isSubmitting || formSubmitted) {
        logDebug(
          'FormView',
          `[GUARD] handleSave: Already submitting (inProgress=${String(submissionInProgressRef.current)}, isSubmitting=${String(isSubmitting)}, formSubmitted=${String(
            formSubmitted,
          )}), ignoring duplicate call`,
        )
        return
      }
      submissionInProgressRef.current = true
      suppressDataRequestsRef.current = true // Skip data-load requestFromPlugin during submit to avoid storm of REQUESTS

      handleSaveCallCountRef.current += 1
      debugCountersRef.current.handleSaveCalls = handleSaveCallCountRef.current

      clo(formValues, 'DynamicDialog: handleSave: formValues')
      logDebug(
        'FormView',
        `[FRONT-END] handleSave called (#${handleSaveCallCountRef.current}) - form submission starting, isSubmitting=${String(isSubmitting)}, formSubmitted=${String(
          formSubmitted,
        )}`,
      )
      logDebug('FormView', `[FRONT-END] Sending submitForm REQUEST to back-end (plugin)`)
      const receivingTemplateTitleFromForm = formValues?.receivingTemplateTitle || ''
      const receivingTemplateTitleFromPluginData = pluginData['receivingTemplateTitle'] || ''
      const receivingTemplateTitle = receivingTemplateTitleFromForm || receivingTemplateTitleFromPluginData

      const payload = {
        type: 'submit',
        formValues,
        windowId: windowId || pluginData.windowId || '',
        formTemplateFilename: pluginData?.templateFilename || '',
        processingMethod: pluginData['processingMethod'] || (receivingTemplateTitle ? 'form-processor' : 'write-existing'),
        receivingTemplateTitle: receivingTemplateTitle,
        getNoteTitled: pluginData['getNoteTitled'] || '',
        location: pluginData['location'] || 'append',
        writeUnderHeading: pluginData['writeUnderHeading'] || '',
        replaceNoteContents: pluginData['replaceNoteContents'] || false,
        createMissingHeading: pluginData['createMissingHeading'] !== false,
        newNoteTitle: pluginData['newNoteTitle'] || '',
        newNoteFolder: pluginData['newNoteFolder'] || '',
        space: pluginData['space'] || '',
      }

      // Persist current data so plugin sees latest when it calls getGlobalSharedData (passthrough vars updated by sendActionToPlugin elsewhere)
      dispatch('UPDATE_DATA', data)

      // Show overlay only; do NOT set formSubmitted until we have the submitForm RESPONSE (otherwise the
      // formSubmitted effect runs with stale pluginData and incorrectly schedules "close after 500ms" while backend is still processing).
      requestAnimationFrame(() => {
        setIsSubmitting(true)
        submissionInProgressRef.current = false
      })

      // Use 30s timeout so backend's getRenderContext (20s) can complete; if backend hangs, user sees "Request timeout" and overlay clears.
      const SUBMIT_TIMEOUT_MS = 30000
      requestFromPlugin('submitForm', payload, SUBMIT_TIMEOUT_MS)
        .then((result: any) => {
          // result is response.data from backend: { formSubmissionError?, aiAnalysisResult? }, or { __error, message } on failure
          if (result && result.__error === true && typeof result.message === 'string') {
            const errorData = {
              ...data,
              pluginData: { ...(data.pluginData || {}), formSubmissionError: result.message },
            }
            dispatch('UPDATE_DATA', errorData)
          } else if (result && typeof result === 'object' && !result.__error) {
            // Merge submission result (formSubmissionError, aiAnalysisResult) into pluginData; do not replace full data
            const basePluginData = data.pluginData || {}
            const mergedPluginData = { ...basePluginData }
            if ('formSubmissionError' in result) {
              mergedPluginData.formSubmissionError = result.formSubmissionError
            }
            if ('aiAnalysisResult' in result) {
              mergedPluginData.aiAnalysisResult = result.aiAnalysisResult
            }
            dispatch('UPDATE_DATA', { ...data, pluginData: mergedPluginData })
          }
          setIsSubmitting(false)
          setFormSubmitted(true) // Only now: effect runs with real pluginData and decides close vs keep-open
        })
        .catch((error: Error) => {
          logDebug('FormView', `[FRONT-END] submitForm REQUEST failed: ${error.message}`)
          suppressDataRequestsRef.current = false
          setIsSubmitting(false)
          const errorData = {
            ...data,
            pluginData: { ...(data.pluginData || {}), formSubmissionError: error.message || 'Form submission failed' },
          }
          dispatch('UPDATE_DATA', errorData)
          setFormSubmitted(true) // Effect runs, sees formSubmissionError, keeps dialog open
        })
    },
    [data, pluginData, isSubmitting, formSubmitted, dispatch, requestFromPlugin, onSubmitOrCancelCallFunctionNamed],
  )

  // Return true if the string is 'true' (case insensitive), otherwise return false (blank or otherwise)
  const isTrueString = (value: string): boolean => (value ? /true/i.test(value) : false)

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * Scroll the .dynamic-dialog-content element to top on mount
   * The scrolling element is .dynamic-dialog-content inside .template-form, not the window
   */
  useEffect(() => {
    // Function to find and scroll the dialog content element
    const scrollDialogContentToTop = () => {
      // CRITICAL: Check if component is still mounted before accessing DOM
      if (!isMountedRef.current) {
        return null
      }
      // Try multiple selectors to find the scrolling element
      const selectors = ['.template-form .dynamic-dialog-content', '.dynamic-dialog.template-form .dynamic-dialog-content', '.dynamic-dialog-content']

      for (const selector of selectors) {
        const element = document.querySelector(selector)
        if (element) {
          const scrollTop = element.scrollTop
          element.scrollTop = 0
          logDebug('FormView', `[SCROLL] Found ${selector}, scrollTop was ${scrollTop}, set to 0`)
          return element
        }
      }
      logDebug('FormView', `[SCROLL] Could not find dialog content element`)
      return null
    }

    // Try immediately
    scrollDialogContentToTop()

    // Try again after a short delay to catch it after React renders
    const timeout1 = setTimeout(() => {
      if (isMountedRef.current) {
        scrollDialogContentToTop()
      }
    }, 50)

    // Try again after a longer delay
    const timeout2 = setTimeout(() => {
      if (isMountedRef.current) {
        scrollDialogContentToTop()
      }
    }, 200)

    // Final attempt after everything should be rendered
    const timeout3 = setTimeout(() => {
      if (isMountedRef.current) {
        scrollDialogContentToTop()
      }
    }, 500)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
    }
  }, []) // Only run once on mount

  /**
   * When the data changes, restore scroll position if provided
   * Fires after components draw
   */
  useEffect(() => {
    if (data?.passThroughVars?.lastWindowScrollTop !== undefined && data.passThroughVars.lastWindowScrollTop !== window.scrollY) {
      logDebug('FormView', `[SCROLL] Restoring scroll position to ${data.passThroughVars.lastWindowScrollTop}`)
      window.scrollTo(0, data.passThroughVars.lastWindowScrollTop)
    }
  }, [data])

  // Load folders/notes automatically when fields change and they're needed (matching FormBuilder pattern)
  // Load folders/notes with delay to yield to TOC rendering
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (needsFolders && !foldersLoaded && !loadingFolders) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        // CRITICAL: Check if component is still mounted before calling state setters
        if (isMountedRef.current) {
          loadFolders()
        }
      }, 200) // 200ms delay to yield to TOC rendering

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [needsFolders, foldersLoaded, loadingFolders, loadFolders])

  useEffect(() => {
    if (needsNotes && !notesLoaded && !loadingNotes) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        // CRITICAL: Check if component is still mounted before calling state setters
        if (isMountedRef.current) {
          loadNotes()
        }
      }, 200) // 200ms delay to yield to TOC rendering

      return () => {
        clearTimeout(timeoutId)
      }
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
  // Diagnostic: Log render timing (runs on every render to track re-renders)
  // Note: Re-renders from autosave completion are expected (autosave updates state → re-render)
  const renderCountRef = useRef<number>(0)
  const lastPluginDataRef = useRef<string>('')
  useEffect(() => {
    renderCountRef.current += 1
    const renderStartTime = performance.now()

    // Track pluginData changes to detect SET_DATA messages from back-end
    const currentPluginDataStr = JSON.stringify(pluginData)
    const pluginDataChanged = currentPluginDataStr !== lastPluginDataRef.current
    if (pluginDataChanged) {
      lastPluginDataRef.current = currentPluginDataStr
      setDataReceivedCountRef.current += 1
      debugCountersRef.current.setDataReceived = setDataReceivedCountRef.current
      // Don't update state here - would cause infinite loop. Only update when handleSave is called.
      logDebug(
        'FormView',
        `[FRONT-END] SET_DATA received from back-end (#${setDataReceivedCountRef.current}) - pluginData changed, triggering re-render #${renderCountRef.current}`,
      )
      // Log what changed
      const hasError = pluginData?.formSubmissionError || pluginData?.aiAnalysisResult
      if (hasError) {
        logDebug('FormView', `[FRONT-END] SET_DATA contains error: formSubmissionError=${!!pluginData?.formSubmissionError}, aiAnalysisResult=${!!pluginData?.aiAnalysisResult}`)
      }
    }

    // Update render counter in ref only (don't trigger state update - that would cause infinite loop!)
    debugCountersRef.current.renders = renderCountRef.current

    // Only log first few renders and then periodically to reduce noise
    // But always log when pluginData changes (back-end activity)
    const shouldLog = pluginDataChanged || renderCountRef.current <= 3 || renderCountRef.current % 10 === 0
    if (shouldLog) {
      logDebug(
        'FormView',
        `[FRONT-END] FormView RENDER #${renderCountRef.current}: formFields=${formFields.length}, folders=${folders.length}, notes=${notes.length}, pluginDataChanged=${String(
          pluginDataChanged,
        )}`,
      )
    }

    requestAnimationFrame(() => {
      const renderElapsed = performance.now() - renderStartTime
      if (shouldLog) {
        logDebug('FormView', `[FRONT-END] FormView RENDER #${renderCountRef.current} AFTER RAF: elapsed=${renderElapsed.toFixed(2)}ms`)
      }
    })
  })

  // Check for AI analysis result in pluginData
  const aiAnalysisResult = pluginData?.aiAnalysisResult || ''

  // Check for form submission error in pluginData
  const formSubmissionError = pluginData?.formSubmissionError || ''

  return (
    <>
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
          <div
            style={{
              maxWidth: '100vw',
              width: '100vw',
              paddingTop: aiAnalysisResult || formSubmissionError ? '4rem' : '0',
            }}
          >
            <FormErrorBanner aiAnalysisResult={aiAnalysisResult} formSubmissionError={formSubmissionError} requestFromPlugin={requestFromPlugin} />
            <DynamicDialog
              isOpen={true}
              title={pluginData?.formTitle || ''}
              windowTitle={pluginData?.windowTitle || ''}
              items={formFields}
              onSave={handleSave}
              onCancel={handleCancel}
              allowEmptySubmit={isTrueString(pluginData.allowEmptySubmit)}
              hideDependentItems={isTrueString(pluginData.hideDependentItems)}
              folders={folders}
              notes={notes}
              requestFromPlugin={requestFromPlugin}
              windowId={pluginData.windowId} // Pass windowId to DynamicDialog
              defaultValues={pluginData?.defaultValues || {}} // Pass default values for form pre-population
              templateFilename={pluginData?.templateFilename || ''} // Pass template filename for autosave
              templateTitle={pluginData?.templateTitle || ''} // Pass template title for autosave
              preloadedTeamspaces={pluginData?.preloadedTeamspaces || []} // Preloaded teamspaces for static HTML testing
              preloadedMentions={pluginData?.preloadedMentions || []} // Preloaded mentions for static HTML testing
              preloadedHashtags={pluginData?.preloadedHashtags || []} // Preloaded hashtags for static HTML testing
              preloadedEvents={pluginData?.preloadedEvents || []} // Preloaded events for static HTML testing
              preloadedFrontmatterValues={pluginData?.preloadedFrontmatterValues || {}} // Preloaded frontmatter key values for static HTML testing
              onFoldersChanged={() => {
                reloadFolders()
              }}
              onNotesChanged={() => {
                reloadNotes()
              }}
              className="template-form"
              style={{
                content: { paddingLeft: '1.5rem', paddingRight: '1.5rem' },
                '--template-form-compact-label-width': pluginData?.compactLabelWidth || undefined,
                '--template-form-compact-input-width': pluginData?.compactInputWidth || undefined,
              }}
            />
          </div>
          {/* end of replace */}
        </div>
        {/* Submitting overlay - rendered via portal to document.body to appear above everything */}
        {isSubmitting && typeof document !== 'undefined' && document.body
          ? createPortal(
              <div className="form-submitting-overlay">
                <div className="form-submitting-message">
                  <div>Submitting Form...</div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </AppProvider>
      {/* Submitting overlay - rendered via portal to document.body to appear above everything */}
      {isSubmitting && typeof document !== 'undefined' && document.body
        ? createPortal(
            <div className="form-submitting-overlay">
              <div className="form-submitting-message">
                <div>Submitting Form...</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
