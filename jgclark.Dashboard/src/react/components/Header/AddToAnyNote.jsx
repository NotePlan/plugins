// @flow
// --------------------------------------------------------------------------
// AddToAnyNote Component - One dialog to add a task, checklist, or reminder
// Last updated: 2026-10-30 by @CursorAI
// --------------------------------------------------------------------------

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import './AddToAnyNote.css' // Import CSS for dialog positioning
import { useAppContext } from '../AppContext'
import { REMINDER_ADD_REFRESH_SECTIONS } from '../../../reminderAddForm'
import type { TSectionCode } from '../../../types'
import { registerOpenAddDialog, type TOpenAddDialogOptions } from './openAddDialog'
import { logDebug, logError } from '@helpers/dev'
import { pluginEnvelopeFromResponsePayload, unwrapPluginRequestData } from '@helpers/react/pluginRequestEnvelope'
import { getElementCoordinates } from '@helpers/react/reactUtils.js'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog'
import DropdownSelect, { type Option } from '@helpers/react/DynamicDialog/DropdownSelect.jsx'
import type { NoteOption } from '@helpers/react/DynamicDialog/NoteChooser'

type Props = {
  sendActionToPlugin: (actionType: string, dataToSend?: any, message?: string, isUrgent?: boolean) => void,
}

/**
 * AddToAnyNote Component
 * Handles the "Add task to any note" dialog with space/note/heading selection
 * Memoized to prevent unnecessary re-renders when context changes
 * @param {Props} props
 * @returns {React.Node}
 */
const AddToAnyNoteComponent = ({ sendActionToPlugin }: Props): React.Node => {
    const { dispatch, pluginData } = useAppContext()
    // ----------------------------------------------------------------------
    // State
    // ----------------------------------------------------------------------
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [dialogSession, setDialogSession] = useState(0) // bumps so a new open remounts the dialog with fresh defaults
    const [itemKind, setItemKind] = useState<'task' | 'checklist' | 'reminder'>('task')
    const [presetNote, setPresetNote] = useState<string>('') // calendar note filename from a section button; empty means today
    const [presetHeading, setPresetHeading] = useState<string>('')
    // null = not loaded yet (still show Reminder). false = hide it.
    const [canAddReminder, setCanAddReminder] = useState<?boolean>(null)
    const [reminderListTitles, setReminderListTitles] = useState<Array<string>>([])
    const [notes, setNotes] = useState<Array<NoteOption>>([])
    const [notesLoaded, setNotesLoaded] = useState(false)
    const [loadingNotes, setLoadingNotes] = useState(false)
    const [errorMessage, setErrorMessage] = useState<?string>(null)
    const [dialogStyle, setDialogStyle] = useState<{ [key: string]: string }>({}) // CSS variables for dialog positioning
    const [fieldLoadingStates, setFieldLoadingStates] = useState<{ [fieldKey: string]: boolean }>({}) // Track loading state for note-chooser field
    const currentSpaceRef = useRef<?string>(null) // Track current space for note chooser lazy loading
    const buttonRef = useRef<?HTMLButtonElement>(null) // Ref to the button that opens the dialog
    const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void, reject: (error: Error) => void, timeoutId: TimeoutID }>>(new Map())
    const reminderListTitlesRef = useRef<?Array<string>>(null) // null until getReminderAddOptions returns
    const reminderListsPromiseRef = useRef<?Promise<Array<string>>>(null) // shared so Reminder click waits for the open-dialog fetch
    const sectionCodesRef = useRef<?Array<TSectionCode>>(null) // sections to refresh after a task/checklist save opened from a section button

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

          // REQUEST calls should not update Dashboard global data before the response returns.
          sendActionToPlugin(command, requestData, `AddToAnyNote: requestFromPlugin: ${String(command)}`, false)
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
          const { correlationId } = eventData.payload

          if (correlationId && typeof correlationId === 'string') {
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              pending.resolve(pluginEnvelopeFromResponsePayload(eventData.payload))
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

        try {
          setLoadingNotes(true)

          await new Promise((resolve) => setTimeout(resolve, 0))

          const requestParams: any = {
            includeCalendarNotes: true,
            includePersonalNotes: true,
            includeRelativeNotes: true,
            includeTeamspaceNotes: true,
            includeDecoration: false, // NoteChooser derives display decoration client-side; backend decoration is too slow for calendar-note lists.
          }

          // Note: np.Shared getNotes expects:
          // - empty string ('') for Private space only
          // - teamspace ID (UUID string) for a specific teamspace
          // - '__all__' for private + teamspace notes (respecting includeTeamspaceNotes)
          if (space !== null && space !== undefined) {
            if (space === '__all__') {
              requestParams.space = '__all__'
            } else if (space === '' || space === 'Private') {
              requestParams.space = ''
            } else {
              requestParams.space = space
            }
          } else {
            requestParams.space = ''
          }

          const notesData = unwrapPluginRequestData(await requestFromPlugin('getNotes', requestParams))

          if (Array.isArray(notesData)) {
            setNotes(notesData)
            setNotesLoaded(true)
          } else {
            logError('AddToAnyNote', `Failed to load notes: Invalid response format`)
            setNotesLoaded(true)
          }
        } catch (error) {
          logError('AddToAnyNote', `Error loading notes: ${error.message}`)
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
      const space = currentSpaceRef.current

      if (!notesLoaded && !loadingNotes) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        await loadNotes(false, space)
      }
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

      // Position dialog so its CENTER aligns with the button's centerX
      // This provides better balance and prevents left-alignment issues
      const buttonCenterX = coords.centerX

      // Calculate where dialog center should be (button's centerX)
      const dialogCenterX = buttonCenterX
      
      // Calculate dialog's left edge if centered on button
      const dialogLeftEdgeIfCentered = dialogCenterX - estimatedDialogWidth / 2
      const dialogRightEdgeIfCentered = dialogCenterX + estimatedDialogWidth / 2
      
      // Calculate distanceFromRight for centered position
      let distanceFromRight = window.innerWidth - dialogRightEdgeIfCentered

      // Calculate where dialog's left edge would be with centered positioning
      let dialogLeftEdge = dialogLeftEdgeIfCentered
      let dialogRightEdge = dialogRightEdgeIfCentered
      
      // Ensure dialog doesn't go off the left or right edge of screen
      // If dialog would extend past either edge, shift it to fit while trying to maintain centering
      const minLeftPadding = 10 // Minimum padding from left edge
      const minRightPadding = 10 // Minimum padding from right edge
      
      if (dialogLeftEdge < minLeftPadding) {
        dialogLeftEdge = minLeftPadding
        dialogRightEdge = dialogLeftEdge + estimatedDialogWidth
        distanceFromRight = window.innerWidth - dialogRightEdge
      } else if (dialogRightEdge > window.innerWidth - minRightPadding) {
        dialogRightEdge = window.innerWidth - minRightPadding
        dialogLeftEdge = dialogRightEdge - estimatedDialogWidth
        distanceFromRight = minRightPadding
      }

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
      }

      // Return CSS variables for positioning (CSS will use these to position the dialog)
      const positionStyle = {
        '--add-dialog-top': `${finalTop}px`,
        '--add-dialog-right': `${distanceFromRight}px`,
      }
      return positionStyle
    }, [])

    // ----------------------------------------------------------------------
    // Dialog handlers
    // ----------------------------------------------------------------------
    /**
     * Open the dialog for the header button or a section button.
     * A new session remounts the form so the note, heading, and kind are the ones just requested.
     */
    const beginAddDialog = useCallback(
      (opts: TOpenAddDialogOptions) => {
        currentSpaceRef.current = null
        reminderListTitlesRef.current = null
        reminderListsPromiseRef.current = null
        sectionCodesRef.current = opts.sectionCodes || null
        setItemKind(opts.itemKind)
        setPresetNote(opts.noteFilename || '')
        setPresetHeading(opts.defaultHeading || '')
        setCanAddReminder(null)
        setErrorMessage(null)
        setDialogSession((session) => session + 1)
        const button = buttonRef.current
        setDialogStyle(button ? calculateDialogPosition(button) : {})
        setIsDialogOpen(true)
      },
      [calculateDialogPosition],
    )

    const handleOpenDialog = useCallback(() => {
      beginAddDialog({ itemKind: 'task' })
    }, [beginAddDialog])

    useEffect(() => {
      return registerOpenAddDialog(beginAddDialog)
    }, [beginAddDialog])

    /**
     * Handle closing the add task dialog
     */
    const handleCloseDialog = useCallback(() => {
      setIsDialogOpen(false)
      setDialogStyle({})
    }, [])

    /**
     * Reminder list titles for this Perspective. Reuses an in-flight request so the Reminder click
     * does not start a second one that the plugin never answers.
     */
    const loadReminderListTitles = useCallback(async (): Promise<Array<string>> => {
      if (reminderListTitlesRef.current) return reminderListTitlesRef.current
      if (reminderListsPromiseRef.current) return reminderListsPromiseRef.current

      const pending = requestFromPlugin('getReminderAddOptions', { demoMode: Boolean(pluginData.demoMode) })
        .then((envelope) => {
          const data = unwrapPluginRequestData(envelope)
          const titles = data && Array.isArray(data.listTitles) ? data.listTitles.filter((title) => typeof title === 'string' && title !== '') : []
          const canAdd = Boolean(data && data.canAdd) && titles.length > 0
          reminderListTitlesRef.current = canAdd ? titles : null
          setReminderListTitles(canAdd ? titles : [])
          setCanAddReminder(canAdd)
          return canAdd ? titles : []
        })
        .catch((error) => {
          reminderListsPromiseRef.current = null
          throw error
        })
      reminderListsPromiseRef.current = pending
      return pending
    }, [pluginData.demoMode, requestFromPlugin])

    /**
     * Load Reminder list titles while the add dialog is open so the Reminder choice can be hidden when unsupported.
     */
    useEffect(() => {
      if (!isDialogOpen) return
      let cancelled = false
      loadReminderListTitles()
        .then((titles) => {
          if (cancelled) return
          setCanAddReminder(titles.length > 0)
        })
        .catch((error) => {
          if (cancelled) return
          logError('AddToAnyNote', `Failed to load reminder lists: ${error.message}`)
          setReminderListTitles([])
          setCanAddReminder(false)
        })
      return () => {
        cancelled = true
      }
    }, [isDialogOpen, loadReminderListTitles])

    useEffect(() => {
      if (canAddReminder === false && itemKind === 'reminder') setItemKind('task')
    }, [canAddReminder, itemKind])

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
        const task = formValues.task || ''
        const kindToSave = itemKind === 'checklist' ? 'checklist' : itemKind === 'reminder' ? 'reminder' : 'task'
        const kindLabel = kindToSave === 'checklist' ? 'Checklist' : kindToSave === 'reminder' ? 'Reminder' : 'Task'

        if (kindToSave === 'reminder') {
          const listName = String(formValues.list || '').trim()
          logDebug('AddToAnyNote', `Add reminder save: text="${task}", list="${listName}"`)
          if (!task.trim()) {
            setErrorMessage('❌ Reminder text is required')
            return
          }
          if (!listName) {
            setErrorMessage('❌ Reminder list is required')
            return
          }
          const rawReminderDate = formValues.date
          let reminderDateLabel = ''
          if (rawReminderDate instanceof Date && !isNaN(rawReminderDate.getTime())) {
            reminderDateLabel = dateToCalendarFilename(rawReminderDate)
          } else if (typeof rawReminderDate === 'string' && rawReminderDate.trim() !== '') {
            reminderDateLabel = rawReminderDate.trim()
          }
          const reminderTimeLabel = typeof formValues.time === 'string' ? formValues.time.trim() : ''
          let reminderToast = `Reminder added to "${listName}"`
          if (reminderDateLabel) reminderToast += ` on ${reminderDateLabel}`
          if (reminderTimeLabel) reminderToast += ` at ${reminderTimeLabel}`
          setIsDialogOpen(false)
          sendActionToPlugin(
            'addReminder',
            {
              actionType: 'addReminder',
              userInputObj: {
                text: task.trim(),
                list: listName,
                date: formValues.date || '',
                time: formValues.time || '',
              },
              sectionCodes: REMINDER_ADD_REFRESH_SECTIONS,
            },
            'Add reminder',
            false,
          )
          dispatch('SHOW_TOAST', {
            type: 'success',
            msg: reminderToast,
            timeout: 5000,
          })
          return
        }

        const space = formValues.space || ''
        let note = formValues.note || ''
        const date = formValues.date // Date object from calendar picker
        const heading = formValues.heading || ''

        logDebug(
          'AddToAnyNote',
          `Add task dialog save: space="${space}", note="${note}", date="${
            date ? (date instanceof Date ? dateToCalendarFilename(date) : String(date)) : ''
          }", task="${task}", heading="${heading}", itemKind="${kindToSave}"`,
        )

        // Validation errors - show to user and don't close dialog
        if (!task.trim()) {
          const errorMsg = `${kindLabel} text is required`
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
            itemKind: kindToSave,
          }
          const envelope = await requestFromPlugin('addTaskToNote', taskData)

          logDebug('AddToAnyNote', `Add task envelope: ${JSON.stringify(envelope)}`)

          if (envelope.success) {
            const result = envelope.data
            const successMsg =
              envelope.message ||
              (result && typeof result === 'object' && typeof result.filename === 'string' ? `Task added to ${result.filename}` : 'Task added successfully')
            dispatch('SHOW_TOAST', {
              type: 'success',
              msg: successMsg,
              timeout: 5000,
            })
            const codesToRefresh = sectionCodesRef.current
            if (codesToRefresh && codesToRefresh.length > 0) {
              sendActionToPlugin(
                'refreshSomeSections',
                { actionType: 'refreshSomeSections', sectionCodes: codesToRefresh },
                'Refresh after add',
                false,
              )
            }
          } else {
            dispatch('SHOW_BANNER', {
              type: 'error',
              msg: envelope.message || 'Unknown error',
            })
          }
        } catch (error) {
          logError('AddToAnyNote', `Failed to add ${kindToSave}: ${error.message}`)
          // Show error banner
          dispatch('SHOW_BANNER', {
            type: 'error',
            msg: `❌ Failed to add ${kindToSave}: ${error.message}`,
          })
        }
      },
      [requestFromPlugin, dispatch, itemKind, sendActionToPlugin],
    )

    // ----------------------------------------------------------------------
    // Form fields definition
    // ----------------------------------------------------------------------
    const showReminderChoice = canAddReminder !== false
    const textLabel = itemKind === 'checklist' ? 'Checklist' : itemKind === 'reminder' ? 'Reminder' : 'Task'
    const dialogTitle = itemKind === 'checklist' ? 'Add a new checklist' : itemKind === 'reminder' ? 'Add a new reminder' : 'Add a new task'
    const textPlaceholder =
      itemKind === 'checklist' ? 'Enter checklist text...' : itemKind === 'reminder' ? 'Enter reminder text...' : 'Enter task text...'

    const kindOptions: Array<string | Option> = useMemo(() => {
      const options: Array<string | Option> = [
        { label: 'Task', value: 'task' },
        { label: 'Checklist', value: 'checklist' },
      ]
      if (showReminderChoice) options.push({ label: 'Reminder', value: 'reminder' })
      return options
    }, [showReminderChoice])

    /**
     * Stay in this dialog for Task, Checklist, and Reminder so the choice can be changed either way.
     */
    const handleKindChange = useCallback((option: Option) => {
      if (option.value === 'task' || option.value === 'checklist' || option.value === 'reminder') {
        setItemKind(option.value)
        setErrorMessage(null)
      }
    }, [])

    /**
     * Shared text field, then note fields or reminder fields for the current kind.
     * The text key stays the same so typed text survives a kind switch.
     */
    const addTaskFormFields: Array<TSettingItem> = useMemo(() => {
      const textField: TSettingItem = {
        type: 'input',
        key: 'task',
        label: textLabel,
        placeholder: textPlaceholder,
        focus: true,
        required: true,
        gatesSubmit: true,
        debounceOnChange: false,
        value: '',
      }
      if (itemKind === 'reminder') {
        if (reminderListTitles.length === 0) return [textField]
        return [
          textField,
          {
            type: 'dropdown-select',
            label: 'Reminder List',
            key: 'list',
            // Order matches Reminder Lists to Use (NotePlan's order when that setting is blank). First list is selected.
            options: (reminderListTitles: any),
            noWrapOptions: true,
            value: reminderListTitles[0] || '',
          },
          { type: 'calendarpicker', label: 'Date (optional)', key: 'date', dateFormat: 'YYYY-MM-DD', rowGroup: 'when' },
          { type: 'input', label: 'Time (optional, HH:MM)', key: 'time', rowGroup: 'when' },
        ]
      }
      return [
        textField,
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
          value: presetNote || getTodaysDateISO(), // Section button filename, or today from the header button
          compactDisplay: false,
          noteOutputFormat: 'filename', // Return filename so addTaskToNote receives note path
        },
        {
          type: 'heading-chooser',
          key: 'heading',
          label: 'Under Heading',
          placeholder: 'Select heading...',
          sourceNoteKey: 'note', // Get headings from selected note
          value: presetHeading,
        },
      ]
    }, [handleNoteChooserOpen, itemKind, presetHeading, presetNote, reminderListTitles, textLabel, textPlaceholder])

    // ----------------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------------
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
          const button = buttonRef.current
          if (button) {
            const positionStyle = calculateDialogPosition(button)
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
        <button ref={buttonRef} accessKey="a" className="buttonsWithoutBordersOrBackground add-to-any-note-button" title="Add task, checklist, or reminder" onClick={handleOpenDialog}>
          <i className="fa-solid fa-circle-plus"></i>
        </button>

        {/* Render the Add Task Dialog */}
        {isDialogOpen && (
          <DynamicDialog
            key={dialogSession}
            isOpen={isDialogOpen}
            title={dialogTitle}
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
          >
            <DropdownSelect
              className="add-kind-choice"
              label="Item type"
              appearance="popup"
              options={kindOptions}
              controlledValue={itemKind}
              onChange={handleKindChange}
            />
          </DynamicDialog>
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
const AddToAnyNote: React.ComponentType<Props> = React.memo(AddToAnyNoteComponent, arePropsEqual)

AddToAnyNote.displayName = 'AddToAnyNote'

export default AddToAnyNote
