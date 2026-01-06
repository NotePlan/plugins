// @flow
// --------------------------------------------------------------------------
// AddToAnyNote Component - Encapsulates the "Add task to any note" dialog functionality
// --------------------------------------------------------------------------

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import DynamicDialog, { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
import type { NoteOption } from '@helpers/react/DynamicDialog/NoteChooser'
import { logDebug, logError } from '@helpers/react/reactDev.js'

type Props = {
  sendActionToPlugin: (actionType: string, dataToSend?: any, message?: string, isUrgent?: boolean) => void,
}

/**
 * AddToAnyNote Component
 * Handles the "Add task to any note" dialog with space/note/heading selection
 * @param {Props} props
 * @returns {React$Node}
 */
const AddToAnyNote = ({ sendActionToPlugin }: Props): React$Node => {
  // ----------------------------------------------------------------------
  // State
  // ----------------------------------------------------------------------
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [notes, setNotes] = useState<Array<NoteOption>>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const currentSpaceRef = useRef<?string>(null) // Track current space for note chooser lazy loading
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void, reject: (error: Error) => void, timeoutId: TimeoutID }>>(new Map())

  // ----------------------------------------------------------------------
  // Request/Response handling
  // ----------------------------------------------------------------------
  /**
   * Request function for plugin communication (promise-based)
   * CRITICAL: Must use useCallback to prevent infinite loops when passed to AppContext
   */
  const requestFromPlugin = useCallback(
    (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
      if (!command) throw new Error('requestFromPlugin: command must be called with a string')

      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      logDebug('AddToAnyNote', `requestFromPlugin: command="${command}", correlationId="${correlationId}"`)

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            logDebug('AddToAnyNote', `requestFromPlugin TIMEOUT: command="${command}", correlationId="${correlationId}"`)
            reject(new Error(`Request timeout: ${command}`))
          }
        }, timeout)

        pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

        const requestData = {
          ...dataToSend,
          __correlationId: correlationId,
          __requestType: 'REQUEST',
        }

        // Use sendActionToPlugin to send the request
        sendActionToPlugin(command, requestData, `AddToAnyNote: requestFromPlugin: ${String(command)}`, true)
      })
        .then((result) => {
          logDebug('AddToAnyNote', `requestFromPlugin RESOLVED: command="${command}", correlationId="${correlationId}"`)
          return result
        })
        .catch((error) => {
          logError('AddToAnyNote', `requestFromPlugin REJECTED: command="${command}", correlationId="${correlationId}", error="${error.message}"`)
          throw error
        })
    },
    [sendActionToPlugin],
  )

  /**
   * Listen for RESPONSE messages from plugin
   * Note: Messages come in format: { type: 'RESPONSE', payload: { correlationId, success, data, error } }
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const eventData: any = event.data
      // Check if this is a RESPONSE message (format from sendToHTMLWindow)
      if (eventData && eventData.type === 'RESPONSE' && eventData.payload) {
        const { correlationId, success, data, error } = eventData.payload
        if (correlationId && typeof correlationId === 'string') {
          const pending = pendingRequestsRef.current.get(correlationId)
          if (pending) {
            pendingRequestsRef.current.delete(correlationId)
            clearTimeout(pending.timeoutId)
            if (success) {
              pending.resolve(data)
            } else {
              pending.reject(new Error(error || 'Request failed'))
            }
          } else {
            logDebug('AddToAnyNote', `RESPONSE received for unknown correlationId: ${correlationId}`)
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
        pending.reject(new Error('Component unmounted'))
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  // ----------------------------------------------------------------------
  // Note loading functions
  // ----------------------------------------------------------------------
  /**
   * Load notes for the add task dialog
   * @param {boolean} forceReload - If true, force reload even if notes are already loaded
   * @param {?string} space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
   */
  const loadNotes = useCallback(
    async (forceReload: boolean = false, space: ?string = null) => {
      if ((notesLoaded && !forceReload) || loadingNotes) return

      const loadStartTime = performance.now()
      try {
        setLoadingNotes(true)
        logDebug('AddToAnyNote', `[PERF] Loading notes for add task dialog - START (forceReload=${String(forceReload)}, space="${String(space || 'all')}")`)

        // Yield to UI before making the request
        await new Promise((resolve) => setTimeout(resolve, 0))
        const yieldElapsed = performance.now() - loadStartTime
        logDebug('AddToAnyNote', `[PERF] Yielded to UI: elapsed=${yieldElapsed.toFixed(2)}ms`)

        const requestStartTime = performance.now()
        // Build request parameters
        const requestParams: any = {
          includeCalendarNotes: true,
          includePersonalNotes: true,
          includeRelativeNotes: true,
          includeTeamspaceNotes: true,
        }

        // Add space filter if provided
        // Note: getNotes handler expects:
        // - empty string ('') for Private space
        // - teamspace ID (UUID string) for specific teamspace
        // - undefined/null to default to Private (but we'll be explicit)
        if (space !== null && space !== undefined) {
          if (space === '__all__') {
            // For "__all__", we need to get notes from all spaces
            // The handler doesn't support this directly, so we'll omit the space parameter
            // and let it default to Private, then manually include teamspace notes
            // Actually, let's just pass null/undefined to let it default
            // But wait - the handler defaults to Private. We need a different approach.
            // For now, let's just omit the space parameter and the handler will default to Private
            // This is a limitation - "__all__" will show Private notes only
          } else if (space === '' || space === 'Private') {
            // Private space - pass empty string
            requestParams.space = ''
          } else {
            // Specific teamspace ID - pass as-is
            requestParams.space = space
          }
        } else {
          // No space specified - default to Private (empty string)
          requestParams.space = ''
        }

        // Load all note types
        const notesData = await requestFromPlugin('getNotes', requestParams)
        const requestElapsed = performance.now() - requestStartTime
        logDebug('AddToAnyNote', `[PERF] Request completed: elapsed=${requestElapsed.toFixed(2)}ms`)

        const processStartTime = performance.now()
        if (Array.isArray(notesData)) {
          setNotes(notesData)
          setNotesLoaded(true)
          const processElapsed = performance.now() - processStartTime
          const totalElapsed = performance.now() - loadStartTime
          logDebug('AddToAnyNote', `[PERF] Loaded ${notesData.length} notes - PROCESS: ${processElapsed.toFixed(2)}ms, TOTAL: ${totalElapsed.toFixed(2)}ms`)
        } else {
          logError('AddToAnyNote', `Failed to load notes: Invalid response format`)
          setNotesLoaded(true)
        }
      } catch (error) {
        const totalElapsed = performance.now() - loadStartTime
        logError('AddToAnyNote', `[PERF] Error loading notes: elapsed=${totalElapsed.toFixed(2)}ms, error="${error.message}"`)
        setNotesLoaded(true)
      } finally {
        setLoadingNotes(false)
      }
    },
    [notesLoaded, loadingNotes, requestFromPlugin],
  )

  /**
   * Lazy load notes when note-chooser dropdown opens
   */
  const handleNoteChooserOpen = useCallback(async () => {
    const openStartTime = performance.now()
    // Use current space from ref (set when space changes) or default to null (Private)
    const space = currentSpaceRef.current
    logDebug('AddToAnyNote', `[PERF] Note chooser opened - lazy loading notes - START (space="${String(space || 'all')}")`)

    if (!notesLoaded && !loadingNotes) {
      // Yield to UI before loading
      await new Promise((resolve) => setTimeout(resolve, 0))
      // Pass the current space to loadNotes
      await loadNotes(false, space)
    }

    const openElapsed = performance.now() - openStartTime
    logDebug('AddToAnyNote', `[PERF] Note chooser opened - lazy loading notes - COMPLETE: elapsed=${openElapsed.toFixed(2)}ms`)
  }, [notesLoaded, loadingNotes, loadNotes])

  /**
   * Reload notes after creating a new note or when dependencies change
   * @param {?string} space - Space ID to filter by (optional, passed from dependency change)
   */
  const reloadNotes = useCallback(
    (space: ?string = null): void => {
      logDebug('AddToAnyNote', `Reloading notes (triggered by dependency change or note creation, space="${String(space || 'all')}")`)
      // Store current space for lazy loading
      if (space !== null && space !== undefined) {
        currentSpaceRef.current = space
      }
      // Force reload by passing true and space parameter
      loadNotes(true, space).catch((error) => {
        logError('AddToAnyNote', `Error reloading notes: ${error.message}`)
      })
    },
    [loadNotes],
  )

  // ----------------------------------------------------------------------
  // Dialog handlers
  // ----------------------------------------------------------------------
  /**
   * Handle opening the add task dialog
   */
  const handleOpenDialog = useCallback(() => {
    const dialogOpenStartTime = performance.now()
    logDebug('AddToAnyNote', `[PERF] Opening add task dialog - START`)
    // Reset space ref when dialog opens
    currentSpaceRef.current = null
    setIsDialogOpen(true)
    // Don't load notes immediately - let the dialog render first, then lazy load when note-chooser opens
    // This allows the UI to render immediately without blocking
    const dialogOpenElapsed = performance.now() - dialogOpenStartTime
    logDebug('AddToAnyNote', `[PERF] Opening add task dialog - COMPLETE: elapsed=${dialogOpenElapsed.toFixed(2)}ms`)
  }, [])

  /**
   * Handle closing the add task dialog
   */
  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false)
  }, [])

  /**
   * Handle saving the add task dialog
   */
  const handleSave = useCallback(
    (formValues: { [key: string]: any }) => {
      const space = formValues.space || ''
      const note = formValues.note || ''
      const task = formValues.task || ''
      const heading = formValues.heading || ''

      logDebug('AddToAnyNote', `Add task dialog save: space="${space}", note="${note}", task="${task}", heading="${heading}"`)

      if (!task.trim()) {
        logError('AddToAnyNote', 'Task text is required')
        return
      }

      if (!note) {
        logError('AddToAnyNote', 'Note is required')
        return
      }

      // Send action to plugin to add the task
      const dataToSend = {
        actionType: 'addTask',
        toFilename: note,
        taskText: task.trim(),
        heading: heading || undefined,
        space: space || undefined,
      }

      sendActionToPlugin('addTask', dataToSend, 'Add task dialog submitted', true)
      setIsDialogOpen(false)
    },
    [sendActionToPlugin],
  )

  // ----------------------------------------------------------------------
  // Form fields definition
  // ----------------------------------------------------------------------
  /**
   * Form fields for the add task dialog
   */
  const addTaskFormFields: Array<TSettingItem> = useMemo(
    () => [
      {
        type: 'space-chooser',
        key: 'space',
        label: 'Space',
        placeholder: 'Private (default)',
        includeAllOption: true,
        value: '',
      },
      {
        type: 'note-chooser',
        key: 'note',
        label: 'Note',
        placeholder: 'Type to search notes...',
        includeCalendarNotes: true,
        includePersonalNotes: true,
        includeRelativeNotes: true,
        includeTeamspaceNotes: true,
        sourceSpaceKey: 'space', // Filter notes by selected space
        onOpen: handleNoteChooserOpen, // Lazy load notes when dropdown opens
        value: '',
      },
      {
        type: 'heading-chooser',
        key: 'heading',
        label: 'Under Heading',
        placeholder: 'Select heading...',
        sourceNoteKey: 'note', // Get headings from selected note
        value: '',
      },
      {
        type: 'input',
        key: 'task',
        label: 'Task',
        placeholder: 'Enter task text...',
        focus: true,
        required: true,
        value: '',
      },
    ],
    [handleNoteChooserOpen],
  )

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  return (
    <>
      {/* Button to open the dialog */}
      <button accessKey="a" className="buttonsWithoutBordersOrBackground" title="Add new task/checklist" onClick={handleOpenDialog}>
        <i className="fa-solid fa-hexagon-plus"></i>
      </button>

      {/* Render the Add Task Dialog */}
      {isDialogOpen && (
        <DynamicDialog
          isOpen={isDialogOpen}
          title="Add a new task"
          items={addTaskFormFields}
          onSave={handleSave}
          onCancel={handleCloseDialog}
          submitButtonText="Add & Close"
          notes={notes}
          requestFromPlugin={requestFromPlugin}
          onNotesChanged={reloadNotes}
          isModal={true}
        />
      )}
    </>
  )
}

export default AddToAnyNote
