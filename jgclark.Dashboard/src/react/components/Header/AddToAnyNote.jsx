// @flow
// --------------------------------------------------------------------------
// AddToAnyNote Component - Encapsulates the "Add task to any note" dialog functionality
// --------------------------------------------------------------------------

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useAppContext } from '../AppContext.jsx'
import { logTimer } from '@helpers/dev'
import DynamicDialog, { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
import type { NoteOption } from '@helpers/react/DynamicDialog/NoteChooser'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { getElementCoordinates } from '@helpers/react/reactUtils.js'
import './AddToAnyNote.css' // Import CSS for dialog positioning

type Props = {
  sendActionToPlugin: (actionType: string, dataToSend?: any, message?: string, isUrgent?: boolean) => void,
}

/**
 * AddToAnyNote Component
 * Handles the "Add task to any note" dialog with space/note/heading selection
 * Memoized to prevent unnecessary re-renders when context changes
 * @param {Props} props
 * @returns {React$Node}
 */
const AddToAnyNoteComponent = ({ sendActionToPlugin }: Props): React$Node => {
    const { dispatch } = useAppContext()
    // ----------------------------------------------------------------------
    // State
    // ----------------------------------------------------------------------
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [notes, setNotes] = useState<Array<NoteOption>>([])
    const [notesLoaded, setNotesLoaded] = useState(false)
    const [loadingNotes, setLoadingNotes] = useState(false)
    const [errorMessage, setErrorMessage] = useState<?string>(null)
    const [dialogStyle, setDialogStyle] = useState<{ [key: string]: string }>({}) // CSS variables for dialog positioning
    const [fieldLoadingStates, setFieldLoadingStates] = useState<{ [fieldKey: string]: boolean }>({}) // Track loading state for note-chooser field
    const currentSpaceRef = useRef<?string>(null) // Track current space for note chooser lazy loading
    const buttonRef = useRef<?HTMLButtonElement>(null) // Ref to the button that opens the dialog
    const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void, reject: (error: Error) => void, timeoutId: TimeoutID }>>(new Map())

    // ----------------------------------------------------------------------
    // Request/Response handling
    // ----------------------------------------------------------------------
    /**
     * Request function for plugin communication (promise-based)
     * CRITICAL: Must use useCallback to prevent unnecessary re-renders and dependency changes.
     * This function is used as a dependency in other hooks (loadNotes, handleSave) and passed
     * to DynamicDialog, so it needs a stable reference to avoid recreating dependent functions.
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
            return result
          })
          .catch((error) => {
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
                // Resolve with just the data (matching pattern used in np.Shared and other components)
                // The router sends: { correlationId, success, data, error }
                // We extract just the data to match the expected pattern where requestFromPlugin resolves with result.data
                pending.resolve(data)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
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
      (space: ?string = null): Promise<void> => {
        logDebug('AddToAnyNote', `Reloading notes (triggered by dependency change or note creation, space="${String(space || 'all')}")`)
        // Store current space for lazy loading
        if (space !== null && space !== undefined) {
          currentSpaceRef.current = space
        }

        // Set loading state for note-chooser field
        setFieldLoadingStates((prev) => ({ ...prev, note: true }))

        // Yield to UI first to allow dialog to render, then load notes asynchronously
        // This prevents blocking the dialog from appearing
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await loadNotes(true, space)
              // Clear loading state when done
              setFieldLoadingStates((prev) => ({ ...prev, note: false }))
              resolve()
            } catch (error) {
              logError('AddToAnyNote', `Error reloading notes: ${error.message}`)
              // Clear loading state on error
              setFieldLoadingStates((prev) => ({ ...prev, note: false }))
              resolve() // Resolve anyway to clear loading state
            }
          }, 0)
        })
      },
      [loadNotes],
    )

    /**
     * Handle field changes in the dialog (for watching space changes and triggering reloads)
     */
    const handleFieldChange = useCallback(
      (key: string, value: any, _allValues: { [key: string]: any }) => {
        // If space field changed, reload notes
        if (key === 'space') {
          logDebug('AddToAnyNote', `Space field changed to "${String(value || 'Private')}" - reloading notes`)
          reloadNotes(value || null).catch((error) => {
            logError('AddToAnyNote', `Error reloading notes after space change: ${error.message}`)
          })
        }
      },
      [reloadNotes],
    )

    // ----------------------------------------------------------------------
    // Dialog positioning
    // ----------------------------------------------------------------------
    /**
     * Calculate dialog position based on button coordinates
     * Extracted into a separate function so it can be reused for resize handling
     * @param {HTMLElement} button - The button element to position relative to
     * @returns {Object} CSS variables object with --add-dialog-top and --add-dialog-right
     */
    const calculateDialogPosition = useCallback((button: HTMLElement): { [string]: string } => {
      const coords = getElementCoordinates(button)

      if (!coords) {
        logError('AddToAnyNote', 'Failed to get button coordinates')
        return {}
      }

      // Check if button is visible (not off-screen)
      if (coords.right < 0 || coords.left > window.innerWidth || coords.bottom < 0 || coords.top > window.innerHeight) {
        logDebug('AddToAnyNote', `[POSITION] Button is off-screen, using fallback centered position`)
        // Fallback: center the dialog horizontally with some right padding
        const dialogMaxWidth = 700
        const dialogMinWidth = 380
        const dialogPercentWidth = window.innerWidth * 0.86
        const estimatedDialogWidth = Math.min(dialogMaxWidth, Math.max(dialogMinWidth, dialogPercentWidth))
        return {
          '--add-dialog-top': '50px',
          '--add-dialog-right': `${Math.max(20, (window.innerWidth - estimatedDialogWidth) / 2)}px`,
        }
      }

      // Estimate dialog width (matches DynamicDialog.css: clamp(380px, 86%, 700px))
      // Recalculate on each call to account for viewport changes
      const dialogMaxWidth = 700
      const dialogMinWidth = 380
      const dialogPercentWidth = window.innerWidth * 0.86
      const estimatedDialogWidth = Math.min(dialogMaxWidth, Math.max(dialogMinWidth, dialogPercentWidth))
      logDebug(
        'AddToAnyNote',
        `[POSITION] Dialog width calculation: viewportWidth=${window.innerWidth}px, 86%=${dialogPercentWidth.toFixed(2)}px, clamped=${estimatedDialogWidth.toFixed(2)}px (min=${dialogMinWidth}px, max=${dialogMaxWidth}px)`,
      )

      // Position dialog so its CENTER aligns with the button's centerX
      // This provides better balance and prevents left-alignment issues
      const buttonRightEdge = coords.right
      const buttonCenterX = coords.centerX
      const buttonLeftEdge = coords.left

      // Calculate where dialog center should be (button's centerX)
      const dialogCenterX = buttonCenterX
      
      // Calculate dialog's left edge if centered on button
      const dialogLeftEdgeIfCentered = dialogCenterX - estimatedDialogWidth / 2
      const dialogRightEdgeIfCentered = dialogCenterX + estimatedDialogWidth / 2
      
      // Calculate distanceFromRight for centered position
      let distanceFromRight = window.innerWidth - dialogRightEdgeIfCentered
      logDebug(
        'AddToAnyNote',
        `[POSITION] Button coordinates: left=${buttonLeftEdge.toFixed(2)}px, centerX=${buttonCenterX.toFixed(2)}px, right=${buttonRightEdge.toFixed(2)}px, distanceFromRight=${coords.distanceFromRight.toFixed(2)}px`,
      )
      logDebug(
        'AddToAnyNote',
        `[POSITION] Centered calculation: dialogCenterX=${dialogCenterX.toFixed(2)}px, dialogLeftIfCentered=${dialogLeftEdgeIfCentered.toFixed(2)}px, dialogRightIfCentered=${dialogRightEdgeIfCentered.toFixed(2)}px, distanceFromRight=${distanceFromRight.toFixed(2)}px`,
      )

      // Calculate where dialog's left edge would be with centered positioning
      let dialogLeftEdge = dialogLeftEdgeIfCentered
      let dialogRightEdge = dialogRightEdgeIfCentered
      
      logDebug(
        'AddToAnyNote',
        `[POSITION] Dialog position BEFORE adjustments (centered on button): leftEdge=${dialogLeftEdge.toFixed(2)}px, rightEdge=${dialogRightEdge.toFixed(2)}px, width=${estimatedDialogWidth.toFixed(2)}px, centerX=${dialogCenterX.toFixed(2)}px (should match button centerX=${buttonCenterX.toFixed(2)}px)`,
      )
      logDebug(
        'AddToAnyNote',
        `[POSITION] Space distribution: leftSpace=${dialogLeftEdge.toFixed(2)}px, dialogWidth=${estimatedDialogWidth.toFixed(2)}px, rightSpace=${distanceFromRight.toFixed(2)}px, total=${(dialogLeftEdge + estimatedDialogWidth + distanceFromRight).toFixed(2)}px (should equal viewport=${window.innerWidth}px)`,
      )

      // Ensure dialog doesn't go off the left or right edge of screen
      // If dialog would extend past either edge, shift it to fit while trying to maintain centering
      const minLeftPadding = 10 // Minimum padding from left edge
      const minRightPadding = 10 // Minimum padding from right edge
      
      if (dialogLeftEdge < minLeftPadding) {
        // Dialog would go off left edge - shift it right just enough to fit
        const shiftAmount = minLeftPadding - dialogLeftEdge
        const oldDialogLeftEdge = dialogLeftEdge
        const oldDialogRightEdge = dialogRightEdge
        dialogLeftEdge = minLeftPadding
        dialogRightEdge = dialogLeftEdge + estimatedDialogWidth
        distanceFromRight = window.innerWidth - dialogRightEdge
        logDebug(
          'AddToAnyNote',
          `[POSITION] LEFT EDGE ADJUSTMENT: Dialog would go off left edge (leftEdge=${oldDialogLeftEdge.toFixed(2)}px < minPadding=${minLeftPadding}px), shifting right by ${shiftAmount.toFixed(2)}px`,
        )
        logDebug(
          'AddToAnyNote',
          `[POSITION] LEFT EDGE ADJUSTMENT: leftEdge ${oldDialogLeftEdge.toFixed(2)}px -> ${dialogLeftEdge.toFixed(2)}px, rightEdge ${oldDialogRightEdge.toFixed(2)}px -> ${dialogRightEdge.toFixed(2)}px, distanceFromRight -> ${distanceFromRight.toFixed(2)}px`,
        )
      } else if (dialogRightEdge > window.innerWidth - minRightPadding) {
        // Dialog would go off right edge - shift it left just enough to fit
        const shiftAmount = dialogRightEdge - (window.innerWidth - minRightPadding)
        const oldDialogLeftEdge = dialogLeftEdge
        const oldDialogRightEdge = dialogRightEdge
        dialogRightEdge = window.innerWidth - minRightPadding
        dialogLeftEdge = dialogRightEdge - estimatedDialogWidth
        distanceFromRight = minRightPadding
        logDebug(
          'AddToAnyNote',
          `[POSITION] RIGHT EDGE ADJUSTMENT: Dialog would go off right edge (rightEdge=${oldDialogRightEdge.toFixed(2)}px > viewport-${minRightPadding}px=${(window.innerWidth - minRightPadding).toFixed(2)}px), shifting left by ${shiftAmount.toFixed(2)}px`,
        )
        logDebug(
          'AddToAnyNote',
          `[POSITION] RIGHT EDGE ADJUSTMENT: leftEdge ${oldDialogLeftEdge.toFixed(2)}px -> ${dialogLeftEdge.toFixed(2)}px, rightEdge ${oldDialogRightEdge.toFixed(2)}px -> ${dialogRightEdge.toFixed(2)}px, distanceFromRight -> ${distanceFromRight.toFixed(2)}px`,
        )
      } else {
        logDebug('AddToAnyNote', `[POSITION] No edge adjustment needed (leftEdge=${dialogLeftEdge.toFixed(2)}px >= minLeftPadding=${minLeftPadding}px, rightEdge=${dialogRightEdge.toFixed(2)}px <= viewport-minRightPadding=${(window.innerWidth - minRightPadding).toFixed(2)}px)`)
      }

      // Final position after edge adjustments
      const finalDialogLeftEdge = dialogLeftEdge
      const finalDialogRightEdge = dialogRightEdge
      const finalSpaceOnRight = distanceFromRight
      const finalSpaceOnLeft = dialogLeftEdge
      
      logDebug(
        'AddToAnyNote',
        `[POSITION] After edge adjustments: finalLeftEdge=${finalDialogLeftEdge.toFixed(2)}px, finalRightEdge=${finalDialogRightEdge.toFixed(2)}px, spaceOnLeft=${finalSpaceOnLeft.toFixed(2)}px, spaceOnRight=${finalSpaceOnRight.toFixed(2)}px`,
      )

      // Ensure dialog doesn't go off the bottom of screen
      // Estimate dialog height (header ~80px + content ~300px + padding ~40px = ~420px max)
      // If dialog would extend past bottom, adjust top position
      const estimatedDialogHeight = 420 // Conservative estimate
      const dialogTop = coords.bottom
      const dialogBottom = dialogTop + estimatedDialogHeight
      const minBottomPadding = 20 // Minimum padding from bottom edge
      let finalTop = dialogTop

      if (dialogBottom > window.innerHeight - minBottomPadding) {
        // Dialog would go off bottom - adjust to fit
        finalTop = window.innerHeight - estimatedDialogHeight - minBottomPadding
        // Don't let it go above the button though (would look weird)
        if (finalTop < coords.top) {
          finalTop = coords.top
        }
        logDebug(
          'AddToAnyNote',
          `[POSITION] Dialog would go off bottom (bottom=${dialogBottom}px > viewport=${window.innerHeight}px - padding=${minBottomPadding}px), adjusting top: ${dialogTop}px -> ${finalTop}px`,
        )
      }

      // Return CSS variables for positioning (CSS will use these to position the dialog)
      const positionStyle = {
        '--add-dialog-top': `${finalTop}px`,
        '--add-dialog-right': `${distanceFromRight}px`,
      }
      logDebug(
        'AddToAnyNote',
        `[POSITION] FINAL RESULT: Button coords: top=${coords.top.toFixed(2)}px, bottom=${coords.bottom.toFixed(2)}px, left=${coords.left.toFixed(2)}px, right=${coords.right.toFixed(2)}px, width=${coords.width.toFixed(2)}px, height=${coords.height.toFixed(2)}px, centerX=${coords.centerX.toFixed(2)}px, centerY=${coords.centerY.toFixed(2)}px, distanceFromRight=${coords.distanceFromRight.toFixed(2)}px`,
      )
      logDebug(
        'AddToAnyNote',
        `[POSITION] FINAL RESULT: Dialog: width=${estimatedDialogWidth.toFixed(2)}px, height=${estimatedDialogHeight}px, top=${finalTop.toFixed(2)}px, leftEdge=${finalDialogLeftEdge.toFixed(2)}px, rightEdge=${finalDialogRightEdge.toFixed(2)}px, distanceFromRight=${distanceFromRight.toFixed(2)}px`,
      )
      logDebug(
        'AddToAnyNote',
        `[POSITION] FINAL RESULT: Viewport: width=${window.innerWidth}px, height=${window.innerHeight}px, Space distribution: left=${finalSpaceOnLeft.toFixed(2)}px, dialog=${estimatedDialogWidth.toFixed(2)}px, right=${finalSpaceOnRight.toFixed(2)}px, total=${(finalSpaceOnLeft + estimatedDialogWidth + finalSpaceOnRight).toFixed(2)}px (should equal ${window.innerWidth}px)`,
      )
      logDebug(
        'AddToAnyNote',
        `[POSITION] FINAL RESULT: CSS variables: --add-dialog-top=${finalTop.toFixed(2)}px, --add-dialog-right=${distanceFromRight.toFixed(2)}px`,
      )
      return positionStyle
    }, [])

    // ----------------------------------------------------------------------
    // Dialog handlers
    // ----------------------------------------------------------------------
    /**
     * Handle opening the add task dialog
     */
    const handleOpenDialog = useCallback(
      (event: ?SyntheticEvent<HTMLButtonElement>) => {
        const dialogOpenStartTime = new Date()
        logDebug('AddToAnyNote', `[PERF] Opening add task dialog - START`)

        // Calculate CSS variables for dialog positioning
        // Align top-right of dialog with bottom-middle of button
        if (event && event.currentTarget) {
          const positionStyle = calculateDialogPosition(event.currentTarget)
          setDialogStyle(positionStyle)
        } else {
          setDialogStyle({})
        }

        // Reset space ref and error message when dialog opens
        const resetStartTime = performance.now()
        currentSpaceRef.current = null
        setErrorMessage(null)
        const resetElapsed = performance.now() - resetStartTime
        logDebug('AddToAnyNote', `[PERF] Reset state: elapsed=${resetElapsed.toFixed(2)}ms`)

        // Set dialog open - this triggers React rendering
        const setStateStartTime = performance.now()
        setIsDialogOpen(true)

        // Load notes automatically when dialog opens (after rendering)
        setTimeout(async () => {
          await reloadNotes(null) // Load notes for default space (Private)
        }, 150)

        // Note: setIsDialogOpen is async - React will batch updates
        // We yield immediately to allow React to start rendering
        setTimeout(() => {
          const setStateElapsed = performance.now() - setStateStartTime
          logTimer(
            'AddToAnyNote/handleOpenDialog',
            dialogOpenStartTime,
            `Dialog state set, React rendering should start (setState took ${setStateElapsed.toFixed(2)}ms)`,
            100, // Warn if dialog opening takes > 100ms
          )
        }, 0)

        logDebug('AddToAnyNote', `[PERF] Opening add task dialog - state set, yielding to React`)
      },
      [reloadNotes, calculateDialogPosition],
    )

    /**
     * Handle closing the add task dialog
     */
    const handleCloseDialog = useCallback(() => {
      setIsDialogOpen(false)
      setDialogStyle({})
    }, [])

    /**
     * Convert a Date object to calendar note filename format (YYYY-MM-DD)
     * @param {Date} date - The date to convert
     * @returns {string} Calendar note filename format (e.g., "2026-01-06")
     */
    const dateToCalendarFilename = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    /**
     * Get today's date in ISO 8601 format (YYYY-MM-DD)
     * @returns {string} Today's date in ISO format
     */
    const getTodaysDateISO = (): string => {
      const today = new Date()
      return dateToCalendarFilename(today)
    }

    /**
     * Handle saving the add task dialog
     * Uses request/response pattern to get result and show toast
     */
    const handleSave = useCallback(
      async (formValues: { [key: string]: any }) => {
        const space = formValues.space || ''
        let note = formValues.note || ''
        const date = formValues.date // Date object from calendar picker
        const task = formValues.task || ''
        const heading = formValues.heading || ''

        logDebug(
          'AddToAnyNote',
          `Add task dialog save: space="${space}", note="${note}", date="${
            date ? (date instanceof Date ? dateToCalendarFilename(date) : String(date)) : ''
          }", task="${task}", heading="${heading}"`,
        )

        // Validation errors - show to user and don't close dialog
        if (!task.trim()) {
          const errorMsg = 'Task text is required'
          logError('AddToAnyNote', errorMsg)
          setErrorMessage(`❌ ${errorMsg}`)
          return
        }

        // If date is selected but no note, convert date to calendar note filename
        // Handle date as Date object or string
        let selectedDate: ?Date = null
        if (date) {
          if (date instanceof Date) {
            selectedDate = date
          } else if (typeof date === 'string') {
            // Try to parse string date
            selectedDate = new Date(date)
            if (isNaN(selectedDate.getTime())) {
              selectedDate = null
            }
          }
        }

        if (selectedDate && !note) {
          note = dateToCalendarFilename(selectedDate)
          logDebug('AddToAnyNote', `Converted date to calendar note filename: "${note}"`)
        }

        if (!note) {
          const errorMsg = 'Note or date is required'
          logError('AddToAnyNote', errorMsg)
          setErrorMessage(`❌ ${errorMsg}`)
          return
        }

        // Close the dialog immediately for better UX
        setIsDialogOpen(false)

        try {
          // Use request/response pattern to add the task and get result
          const taskData = {
            filename: note || '',
            taskText: task.trim() || '',
            heading: heading || null,
            space: space || null,
          }
          const result = await requestFromPlugin('addTaskToNote', taskData)

          logDebug('AddToAnyNote', `Add task result: ${JSON.stringify(result)}`)

          // Show toast for success, banner for failure
          // The backend will return a message indicating implementation status
          if (result.success) {
            // Success: show toast
            dispatch('SHOW_TOAST', {
              type: 'success',
              msg: result.message || 'Task added successfully',
              timeout: 5000,
            })
          } else {
            // Failure: show banner
            dispatch('SHOW_BANNER', {
              type: 'error',
              msg: result.message || result.error || 'Unknown error',
            })
          }
        } catch (error) {
          logError('AddToAnyNote', `Failed to add task: ${error.message}`)
          // Show error banner
          dispatch('SHOW_BANNER', {
            type: 'error',
            msg: `❌ Failed to add task: ${error.message}`,
          })
        }
      },
      [requestFromPlugin, dispatch],
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
          type: 'input',
          key: 'task',
          label: 'Task',
          placeholder: 'Enter task text...',
          focus: true,
          required: true,
          value: '',
        },
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
          includeTemplatesAndForms: false,
          sourceSpaceKey: 'space', // Filter notes by selected space
          onOpen: handleNoteChooserOpen, // Lazy load notes when dropdown opens
          value: getTodaysDateISO(), // Default to today's date in ISO 8601 format (YYYY-MM-DD)
          compactDisplay: false,
          noteOutputFormat: 'filename', // Return filename so addTaskToNote receives note path
        },
        {
          type: 'heading-chooser',
          key: 'heading',
          label: 'Under Heading',
          placeholder: 'Select heading...',
          sourceNoteKey: 'note', // Get headings from selected note
          value: '',
        },
      ],
      [handleNoteChooserOpen],
    )

    // ----------------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------------
    // Track when dialog rendering starts and verify actual positioning
    useEffect(() => {
      if (isDialogOpen) {
        const renderStartTime = new Date()
        logDebug('AddToAnyNote', `[PERF] Dialog render START - isDialogOpen=${String(isDialogOpen)}`)
        // Log after React has rendered (on next tick)
        setTimeout(() => {
          logTimer(
            'AddToAnyNote/render',
            renderStartTime,
            `Dialog rendered in DOM (isDialogOpen=${String(isDialogOpen)}, notes.length=${notes.length}, notesLoaded=${String(notesLoaded)})`,
            200, // Warn if rendering takes > 200ms
          )

          // Verify actual dialog position after render
          const dialogElement = document.querySelector('.add-to-any-note-dialog.dynamic-dialog')
          if (dialogElement) {
            const dialogRect = dialogElement.getBoundingClientRect()
            const computedStyle = window.getComputedStyle(dialogElement)
            const cssTop = computedStyle.getPropertyValue('top')
            const cssRight = computedStyle.getPropertyValue('right')
            const cssVarTop = computedStyle.getPropertyValue('--add-dialog-top')
            const cssVarRight = computedStyle.getPropertyValue('--add-dialog-right')

            logDebug(
              'AddToAnyNote',
              `[POSITION-VERIFY] Actual dialog position after render: top=${dialogRect.top}px, left=${dialogRect.left}px, right=${dialogRect.right}px, bottom=${dialogRect.bottom}px, width=${dialogRect.width}px, height=${dialogRect.height}px`,
            )
            logDebug('AddToAnyNote', `[POSITION-VERIFY] CSS computed: top="${cssTop}", right="${cssRight}", --add-dialog-top="${cssVarTop}", --add-dialog-right="${cssVarRight}"`)
          } else {
            logDebug('AddToAnyNote', `[POSITION-VERIFY] Dialog element not found in DOM`)
          }
        }, 100) // Wait 100ms for CSS to be applied
      }
    }, [isDialogOpen, notes.length, notesLoaded])

    // Sync CSS variables directly to DOM element whenever dialogStyle changes
    // This ensures CSS variables update immediately, even if React hasn't re-rendered
    useEffect(() => {
      if (!isDialogOpen || Object.keys(dialogStyle).length === 0) return

      // Use requestAnimationFrame to ensure DOM is ready
      const updateCSSVars = () => {
        const dialogElement = document.querySelector('.add-to-any-note-dialog.dynamic-dialog')
        if (dialogElement instanceof HTMLElement) {
          Object.keys(dialogStyle).forEach((key) => {
            dialogElement.style.setProperty(key, dialogStyle[key])
          })
          logDebug('AddToAnyNote', `[SYNC] Updated CSS variables on dialog element: ${JSON.stringify(dialogStyle)}`)
        }
      }

      // Update immediately and also after a short delay to catch any timing issues
      updateCSSVars()
      const timeoutId = setTimeout(updateCSSVars, 50)

      return () => clearTimeout(timeoutId)
    }, [isDialogOpen, dialogStyle])

    // Handle window resize to reposition dialog
    useEffect(() => {
      if (!isDialogOpen || !buttonRef.current) return

      let resizeTimeout: TimeoutID
      const handleResize = () => {
        // Debounce resize events to avoid excessive recalculations
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          if (buttonRef.current) {
            logDebug('AddToAnyNote', '[RESIZE] Window resized, recalculating dialog position')
            const positionStyle = calculateDialogPosition(buttonRef.current)
            setDialogStyle(positionStyle)
            // CSS variables will be synced by the useEffect above
          }
        }, 100) // 100ms debounce
      }

      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
        clearTimeout(resizeTimeout)
      }
    }, [isDialogOpen, calculateDialogPosition])

    return (
      <>
        {/* Button to open the dialog */}
        <button ref={buttonRef} accessKey="a" className="buttonsWithoutBordersOrBackground add-to-any-note-button" title="Add new task/checklist" onClick={handleOpenDialog}>
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
            onFieldChange={handleFieldChange}
            isModal={true}
            errorMessage={errorMessage}
            className="add-to-any-note-dialog"
            style={dialogStyle}
            fieldLoadingStates={fieldLoadingStates}
          />
        )}
      </>
    )
}

// Custom comparison function for memoization
const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  // Only re-render if sendActionToPlugin reference changes
  // This prevents re-renders when parent re-renders but props haven't changed
  return prevProps.sendActionToPlugin === nextProps.sendActionToPlugin
}

// Memoize the component with custom comparison function
const AddToAnyNote: React$ComponentType<Props> = React.memo(AddToAnyNoteComponent, arePropsEqual)

AddToAnyNote.displayName = 'AddToAnyNote'

export default AddToAnyNote
