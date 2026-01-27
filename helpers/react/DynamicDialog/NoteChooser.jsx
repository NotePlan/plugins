// @flow
//--------------------------------------------------------------------------
// NoteChooser Component
// Allows users to select a note by typing to filter choices
//--------------------------------------------------------------------------

import React, { useMemo, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { truncateText, calculatePortalPosition } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { getNoteDecorationForReact, TEAMSPACE_ICON_COLOR } from '@helpers/NPnote.js'
import { getFolderFromFilename } from '@helpers/folders.js'
import { parseTeamspaceFilename, getFilenameWithoutTeamspaceID } from '@helpers/teamspace.js'
import './NoteChooser.css'

// Regex to match relative notes that are available in teamspaces (currently only daily and weekly)
// This may change in the future as more relative note types become available in teamspaces
const TEAMSPACES_INCLUDE_REGEX = /today|week/

export type NoteOption = {
  title: string,
  filename: string,
  type?: string, // 'Notes' or 'Calendar'
  frontmatterAttributes?: { [key: string]: any },
  isTeamspaceNote?: boolean,
  teamspaceID?: string,
  teamspaceTitle?: string,
  changedDate?: number,
}

export type NoteChooserProps = {
  label?: string,
  value?: string, // The note title or filename
  notes: Array<NoteOption>, // Array of note options with title and filename (all notes, will be filtered)
  onChange: (noteTitle: string, noteFilename: string) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
  // Filter options - each NoteChooser filters the notes array based on its own options
  includeCalendarNotes?: boolean, // Include calendar notes (default: false)
  includePersonalNotes?: boolean, // Include personal/project notes (default: true)
  includeRelativeNotes?: boolean, // Include relative notes like <today>, <thisweek>, etc. (default: false)
  includeTeamspaceNotes?: boolean, // Include teamspace notes (default: true)
  includeTemplatesAndForms?: boolean, // Include notes from @Templates and @Forms folders (default: false)
  showValue?: boolean, // If true, display the selected value below the input
  includeNewNoteOption?: boolean, // If true, add a 'New Note' option that allows creating a new note
  dependsOnFolderKey?: string, // Key of a folder-chooser field to filter notes by folder
  folderFilter?: ?string, // Current folder value from dependsOnFolderKey field (for filtering notes) - can be null
  startFolder?: ?string, // Start folder to filter notes (e.g., '@Templates/Forms')
  filterByType?: ?(string | Array<string>), // Filter notes by frontmatter type (e.g., 'forms-processor' or ['forms-processor', 'template-runner'])
  allowBackwardsCompatible?: boolean, // If true, allow notes that don't match filters if they match the current value
  spaceFilter?: ?string, // Space ID to filter by (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request note creation from plugin
  onNotesChanged?: () => void, // Callback to request note list reload after creating a note
  onOpen?: () => void, // Callback when dropdown opens (for lazy loading) - can be async internally
  isLoading?: boolean, // If true, show loading indicator
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
  showTitleOnly?: boolean, // If true, show only the note title in the label (not "path / title") (default: false)
  showCalendarChooserIcon?: boolean, // If true, show a calendar button next to the chooser (default: true)
  allowMultiSelect?: boolean, // If true, enable multi-select mode using ContainedMultiSelectChooser (default: false)
  noteOutputFormat?: 'raw-url' | 'wikilink' | 'pretty-link' | 'title' | 'filename', // Output format for both single and multi-select (default: 'wikilink' for multi-select, 'title' for single-select)
  noteSeparator?: 'space' | 'comma' | 'newline', // For multi-select, separator between notes (default: 'space')
  singleSelectOutputFormat?: 'title' | 'filename', // DEPRECATED: Use noteOutputFormat instead. Kept for backwards compatibility only.
  includeRegex?: ?string, // Regex pattern to include notes (applied to filename or title)
  excludeRegex?: ?string, // Regex pattern to exclude notes (applied to filename or title)
}

/**
 * NoteChooser Component
 * A searchable dropdown for selecting notes
 * @param {NoteChooserProps} props
 * @returns {React$Node}
 */
/**
 * Get note decoration using shared helper from @helpers/NPnote.js
 * This mirrors chooseNoteV2 decoration logic exactly
 */
const getNoteDecoration = (note: NoteOption): { icon: string, color: string, shortDescription: ?string } => {
  // Use the shared helper that works with both TNote and NoteOption
  // $FlowFixMe[incompatible-call] - NoteOption is compatible with the union type TNote | NoteOption
  return getNoteDecorationForReact(note)
}

export function NoteChooser({
  label,
  value = '',
  notes = [],
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search note titles...',
  width,
  includeCalendarNotes = false,
  includePersonalNotes = true,
  includeRelativeNotes = false,
  includeTeamspaceNotes = true,
  includeTemplatesAndForms = false,
  showValue = false,
  includeNewNoteOption = false,
  dependsOnFolderKey: _dependsOnFolderKey, // eslint-disable-line no-unused-vars
  folderFilter,
  startFolder,
  filterByType,
  allowBackwardsCompatible = false,
  spaceFilter,
  requestFromPlugin,
  onNotesChanged,
  onOpen,
  isLoading = false,
  shortDescriptionOnLine2 = false,
  showTitleOnly = false,
  showCalendarChooserIcon = true,
  allowMultiSelect = false,
  noteOutputFormat,
  noteSeparator = 'space',
  singleSelectOutputFormat, // DEPRECATED: kept for backwards compatibility
  includeRegex,
  excludeRegex,
}: NoteChooserProps): React$Node {
  // Determine effective output format with backwards compatibility
  // For backwards compatibility: check singleSelectOutputFormat first, then noteOutputFormat
  // For single-select: if format is wikilink/pretty-link/raw-url, treat as 'title' (those formats don't make sense for single-select)
  const effectiveOutputFormat = useMemo(() => {
    if (allowMultiSelect) {
      // Multi-select: use noteOutputFormat, default to 'wikilink'
      return noteOutputFormat || 'wikilink'
    } else {
      // Single-select: check deprecated singleSelectOutputFormat first for backwards compatibility
      if (singleSelectOutputFormat) {
        return singleSelectOutputFormat
      }
      // Then check noteOutputFormat
      if (noteOutputFormat) {
        // For single-select, only 'title' and 'filename' make sense
        // If format is wikilink/pretty-link/raw-url, treat as 'title'
        if (noteOutputFormat === 'title' || noteOutputFormat === 'filename') {
          return noteOutputFormat
        } else {
          // wikilink, pretty-link, or raw-url -> treat as 'title' for single-select
          return 'title'
        }
      }
      // Default to 'title' for single-select
      return 'title'
    }
  }, [allowMultiSelect, noteOutputFormat, singleSelectOutputFormat])

  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [calendarPosition, setCalendarPosition] = useState<{ top: number, left: number } | null>(null)
  const calendarButtonRef = useRef<?HTMLButtonElement>(null)
  const calendarPickerRef = useRef<?HTMLDivElement>(null)

  // Handle creating a new note
  const handleCreateNote = async (noteTitle: string, folder: string = '/') => {
    if (!requestFromPlugin || !noteTitle || !noteTitle.trim()) {
      logError('NoteChooser', 'Cannot create note: missing title or requestFromPlugin')
      return
    }

    try {
      setIsCreatingNote(true)
      logDebug('NoteChooser', `Creating note "${noteTitle}" in "${folder || '/'}"`)

      // requestFromPlugin resolves with just the data (filename) on success, or rejects on error
      const createdFilename = await requestFromPlugin('createNote', {
        noteTitle: noteTitle.trim(),
        folder: folder || '/',
      })

      if (createdFilename && typeof createdFilename === 'string') {
        logDebug('NoteChooser', `Successfully created note: "${createdFilename}"`)

        // Close the dialog and clear form
        setShowCreateDialog(false)
        setNewNoteTitle('')

        // Request note list reload so the new note appears
        if (onNotesChanged) {
          onNotesChanged()
        }

        // Select the newly created note
        // Use setTimeout to ensure notes are reloaded first
        setTimeout(() => {
          // Get the note title from the filename
          const noteTitleFromFilename = createdFilename.split('/').pop()?.replace(/\.md$/, '') || noteTitle.trim()
          onChange(noteTitleFromFilename, createdFilename)
        }, 100)
      } else {
        logError('NoteChooser', `Failed to create note: Invalid response format`)
        alert(`Failed to create note: Invalid response format`)
      }
    } catch (error) {
      logError('NoteChooser', `Error creating note: ${error.message}`)
      alert(`Error creating note: ${error.message}`)
    } finally {
      setIsCreatingNote(false)
    }
  }

  // Handle selecting "New Note" option
  const handleNewNoteClick = () => {
    setShowCreateDialog(true)
    setNewNoteTitle('')
  }

  /**
   * Check if a value is a date string (YYYYMMDD format)
   * @param {string} value - The value to check
   * @returns {boolean}
   */
  const isDateString = (value: string): boolean => {
    return /^\d{8}$/.test(value)
  }

  /**
   * Check if a value is an ISO date string (YYYY-MM-DD format)
   * @param {string} value - The value to check
   * @returns {boolean}
   */
  const isISODateString = (value: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
  }

  /**
   * Format a date string (YYYYMMDD or YYYY-MM-DD) for display using moment
   * @param {string} dateStr - Date string in YYYYMMDD or YYYY-MM-DD format
   * @returns {string} - ISO 8601 date string (YYYY-MM-DD) for display
   */
  const formatDateStringForDisplay = (dateStr: string): string => {
    // If already in ISO format, return as-is (user wants ISO format, not formatted date)
    if (isISODateString(dateStr)) {
      return dateStr
    }
    // If in YYYYMMDD format, convert to ISO format
    if (isDateString(dateStr)) {
      try {
        const year = dateStr.substring(0, 4)
        const month = dateStr.substring(4, 6)
        const day = dateStr.substring(6, 8)
        return `${year}-${month}-${day}`
      } catch (error) {
        logError('NoteChooser', `Error formatting date: ${error.message}`)
        return dateStr
      }
    }
    return dateStr
  }

  /**
   * Convert a Date object to calendar note filename (YYYYMMDD.md)
   * @param {Date} date - The date to convert
   * @returns {string} - Calendar note filename
   */
  const dateToCalendarFilename = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}.md`
  }

  /**
   * Convert a Date object to ISO 8601 format (YYYY-MM-DD) in local timezone
   * @param {Date} date - The date to convert
   * @returns {string} - ISO 8601 date string
   */
  const dateToISOString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Format a note based on output format
   * @param {NoteOption} note - The note to format
   * @param {string} format - Output format: 'raw-url', 'wikilink', 'pretty-link', 'title', or 'filename'
   * @returns {string} - Formatted note string
   */
  const formatNote = useCallback(
    (note: NoteOption, format: 'raw-url' | 'wikilink' | 'pretty-link' | 'title' | 'filename'): string => {
      const noteTitle = note.title || note.filename || ''
      const noteFilename = note.filename || ''
      logDebug('NoteChooser', `formatNote: noteTitle="${noteTitle}", noteFilename="${noteFilename}", format="${format}"`)

      switch (format) {
        case 'raw-url':
          // Return the noteplan:// URL format
          return `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(noteTitle)}`
        case 'wikilink':
          // Return [[note title]] format
          return `[[${noteTitle}]]`
        case 'pretty-link':
          // Return [note title](noteplan://...) format
          return `[${noteTitle}](noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(noteTitle)})`
        case 'title':
          // Return just the note title
          return noteTitle
        case 'filename':
          // Return just the filename
          return noteFilename
        default:
          return noteTitle
      }
    },
    [],
  )

  /**
   * Format multiple notes with separator
   * @param {Array<NoteOption>} notes - Array of notes to format
   * @param {string} format - Output format
   * @param {string} separator - Separator between notes
   * @returns {string} - Formatted string
   */
  const formatNotes = useCallback(
    (notes: Array<NoteOption>, format: 'raw-url' | 'wikilink' | 'pretty-link' | 'title' | 'filename', separator: 'space' | 'comma' | 'newline'): string => {
      const formatted = notes.map((note) => formatNote(note, format))
      const sep = separator === 'space' ? ' ' : separator === 'comma' ? ', ' : '\n'
      return formatted.join(sep)
    },
    [formatNote],
  )

  /**
   * Parse formatted value back to note filenames
   * @param {string} formattedValue - Formatted string value
   * @param {string} format - Output format used
   * @param {string} separator - Separator used
   * @returns {Array<string>} - Array of note titles or filenames (for matching)
   */
  const parseFormattedValue = useCallback(
    (formattedValue: string, format: 'raw-url' | 'wikilink' | 'pretty-link' | 'title' | 'filename', separator: 'space' | 'comma' | 'newline'): Array<string> => {
      if (!formattedValue) return []

      const sep = separator === 'space' ? ' ' : separator === 'comma' ? ',' : '\n'
      const parts = formattedValue.split(sep).map((s) => s.trim()).filter((s) => s.length > 0)
      logDebug('NoteChooser', `parseFormattedValue: formattedValue="${formattedValue}", format="${format}", separator="${separator}", parts=[${String(parts)}]`)

      switch (format) {
        case 'wikilink':
          // Extract titles from [[title]] format
          return parts.map((part) => part.replace(/^\[\[|\]\]$/g, ''))
        case 'pretty-link':
          // Extract titles from [title](url) format
          return parts.map((part) => {
            const match = part.match(/^\[([^\]]+)\]/)
            return match ? match[1] : part
          })
        case 'raw-url':
          // Extract titles from noteplan:// URLs
          return parts.map((part) => {
            const match = part.match(/noteTitle=([^&]+)/)
            return match ? decodeURIComponent(match[1]) : part
          })
        case 'title':
        case 'filename':
          // For 'title' and 'filename' formats, return parts as-is (they're already plain values)
          return parts
        default:
          return parts
      }
    },
    [],
  )

  /**
   * Handle calendar date selection
   * @param {?Date} date - Selected date
   */
  const handleCalendarDateSelect = useCallback(
    (date: ?Date) => {
      if (!date) {
        logDebug('NoteChooser', 'handleCalendarDateSelect: date is null/undefined')
        return
      }

      logDebug('NoteChooser', `handleCalendarDateSelect: date=${date.toISOString()}`)

      const calendarFilename = dateToCalendarFilename(date)
      // Use ISO 8601 format (YYYY-MM-DD) for consistency, regardless of whether note exists
      const dateISO = dateToISOString(date)

      logDebug('NoteChooser', `handleCalendarDateSelect: calendarFilename="${calendarFilename}", dateISO="${dateISO}"`)

      // Find the note in the notes array or create a new option
      const existingNote = notes.find((note) => note.filename === calendarFilename || note.filename.endsWith(`/${calendarFilename}`))

      logDebug('NoteChooser', `handleCalendarDateSelect: existingNote=${existingNote ? `found: ${existingNote.title}` : 'not found'}`)

      if (existingNote) {
        // Use ISO 8601 format for consistency, even if note exists
        logDebug(
          'NoteChooser',
          `handleCalendarDateSelect: calling onChange with existingNote filename but ISO date format: title="${dateISO}", filename="${existingNote.filename}"`,
        )
        onChange(dateISO, existingNote.filename)
      } else {
        // If note doesn't exist, use ISO 8601 format
        logDebug('NoteChooser', `handleCalendarDateSelect: calling onChange with new note: title="${dateISO}", filename="${calendarFilename}"`)
        onChange(dateISO, calendarFilename)
      }

      setShowCalendarPicker(false)
    },
    [notes, onChange],
  )

  /**
   * Toggle calendar picker and calculate position
   */
  const handleCalendarIconClick = useCallback(() => {
    if (!calendarButtonRef.current) return

    const newShowState = !showCalendarPicker
    setShowCalendarPicker(newShowState)

    if (newShowState && calendarButtonRef.current) {
      // Calculate position for calendar picker
      const position = calculatePortalPosition({
        referenceElement: calendarButtonRef.current,
        elementWidth: 280, // Approximate width of DayPicker
        elementHeight: 300, // Approximate height of DayPicker
        preferredPlacement: 'below',
        preferredAlignment: 'start',
        offset: 5,
        viewportPadding: 10,
      })

      if (position) {
        setCalendarPosition({ top: position.top, left: position.left })
      }
    } else {
      setCalendarPosition(null)
    }
  }, [showCalendarPicker])

  // Update calendar position on scroll/resize - use refs to prevent infinite loops
  const calendarPositionRef = useRef<?{ top: number, left: number }>(null)
  React.useEffect(() => {
    if (!showCalendarPicker || !calendarButtonRef.current) {
      calendarPositionRef.current = null
      return
    }

    const updatePosition = () => {
      if (!calendarButtonRef.current) return
      const position = calculatePortalPosition({
        referenceElement: calendarButtonRef.current,
        elementWidth: 280,
        elementHeight: 300,
        preferredPlacement: 'below',
        preferredAlignment: 'start',
        offset: 5,
        viewportPadding: 10,
      })

      if (position) {
        // Only update if position actually changed to prevent infinite loops
        const newPos = { top: position.top, left: position.left }
        if (!calendarPositionRef.current || calendarPositionRef.current.top !== newPos.top || calendarPositionRef.current.left !== newPos.left) {
          calendarPositionRef.current = newPos
          setCalendarPosition(newPos)
        }
      }
    }

    // Initial position calculation
    updatePosition()

    // Throttle scroll/resize events to prevent excessive updates
    let timeoutId: ?number = null
    const throttledUpdate = () => {
      if (timeoutId) return
      timeoutId = window.setTimeout(() => {
        updatePosition()
        timeoutId = null
      }, 50) // Throttle to max once per 50ms
    }

    window.addEventListener('scroll', throttledUpdate, true)
    window.addEventListener('resize', throttledUpdate)

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
      calendarPositionRef.current = null
    }
  }, [showCalendarPicker])

  // Filter notes based on this field's options and folder filter
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Check if note is a calendar note
      const isCalendarNote = note.type === 'Calendar'

      // Check if note is a teamspace note
      const isTeamspaceNote = note.isTeamspaceNote === true

      // Check if note is a relative note (filename starts with '<')
      const isRelativeNote = typeof note.filename === 'string' && note.filename.startsWith('<')

      // Backwards compatibility: if allowBackwardsCompatible and value matches this note, always include it
      if (allowBackwardsCompatible && value) {
        const noteMatchesValue = note.title === value || note.filename === value
        if (noteMatchesValue) {
          return true // Always include backwards-compatible matches
        }
      }

      // Filter out @Templates and @Forms unless includeTemplatesAndForms is true
      if (!includeTemplatesAndForms && !isRelativeNote) {
        const noteFolder = getFolderFromFilename(note.filename)
        // Check if the folder path contains @Templates or @Forms
        if (noteFolder.includes('@Templates') || noteFolder.includes('@Forms')) {
          return false
        }
      }

      // Filter by startFolder if provided
      if (startFolder && !isRelativeNote) {
        const noteFolder = getFolderFromFilename(note.filename)
        const normalizeFolder = (folder: string): string => {
          if (folder === '/') return '/'
          return folder.replace(/\/+$/, '')
        }
        const normalizedStart = normalizeFolder(startFolder)
        const normalizedNoteFolder = normalizeFolder(noteFolder)
        const folderMatches = normalizedNoteFolder === normalizedStart || normalizedNoteFolder.startsWith(`${normalizedStart}/`)
        if (!folderMatches) {
          return false
        }
      }

      // Filter by type if filterByType is provided (supports string or array of strings)
      if (filterByType && !isRelativeNote) {
        const noteType = note.frontmatterAttributes?.type
        // Support both single string and array of strings
        const allowedTypes = Array.isArray(filterByType) ? filterByType : [filterByType]
        if (!allowedTypes.includes(noteType)) {
          return false
        }
      }

      // Filter by folder if folderFilter is provided
      if (folderFilter && !isRelativeNote) {
        // Get the folder path from the note's filename
        const noteFolder = getFolderFromFilename(note.filename)

        // Normalize folder paths for comparison
        // Remove trailing slashes and ensure consistent format
        const normalizeFolder = (folder: string): string => {
          if (folder === '/') return '/'
          return folder.replace(/\/+$/, '') // Remove trailing slashes
        }

        const normalizedFilter = normalizeFolder(folderFilter)
        const normalizedNoteFolder = normalizeFolder(noteFolder)

        // Check if note is in the selected folder
        // For exact match or if note folder starts with filter folder + '/'
        const folderMatches = normalizedNoteFolder === normalizedFilter || normalizedNoteFolder.startsWith(`${normalizedFilter}/`)

        if (!folderMatches) {
          return false // Exclude notes not in the selected folder
        }
      }

      // Determine if this note should be included based on type
      let shouldInclude = false

      // Check calendar vs personal vs relative
      if (isRelativeNote) {
        shouldInclude = includeRelativeNotes
      } else if (isCalendarNote) {
        shouldInclude = includeCalendarNotes
      } else {
        shouldInclude = includePersonalNotes
      }

      // Check teamspace
      if (shouldInclude && !includeTeamspaceNotes && isTeamspaceNote) {
        shouldInclude = false
      }

      // Filter by space if spaceFilter is provided
      if (shouldInclude && spaceFilter !== null && spaceFilter !== undefined) {
        if (isRelativeNote) {
          // For relative notes: only include if Private space (empty string) or if it matches teamspace regex
          if (spaceFilter === '') {
            // Private space - include all relative notes
            shouldInclude = true
          } else {
            // Teamspace - only include relative notes that match the teamspace regex (e.g., <today>, <thisweek>)
            const noteTitle = note.title || note.filename || ''
            shouldInclude = TEAMSPACES_INCLUDE_REGEX.test(noteTitle)
          }
        } else {
          // For regular notes: filter by teamspace ID
          const noteTeamspaceID = note.teamspaceID || null
          if (spaceFilter === '') {
            // Private space filter - only include private notes (non-teamspace)
            if (isTeamspaceNote) {
              shouldInclude = false
            }
          } else {
            // Specific teamspace filter - only include notes from that teamspace
            if (spaceFilter !== noteTeamspaceID) {
              shouldInclude = false
            }
          }
        }
      }

      // Filter by includeRegex if provided
      if (shouldInclude && includeRegex) {
        try {
          const regex = new RegExp(includeRegex, 'i') // Case-insensitive
          const matchesFilename = regex.test(note.filename || '')
          const matchesTitle = regex.test(note.title || '')
          if (!matchesFilename && !matchesTitle) {
            shouldInclude = false
          }
        } catch (error) {
          // Invalid regex - log error but don't filter (fail open)
          logError('NoteChooser', `Invalid includeRegex pattern: ${includeRegex}, error: ${error.message}`)
        }
      }

      // Filter by excludeRegex if provided
      if (shouldInclude && excludeRegex) {
        try {
          const regex = new RegExp(excludeRegex, 'i') // Case-insensitive
          const matchesFilename = regex.test(note.filename || '')
          const matchesTitle = regex.test(note.title || '')
          if (matchesFilename || matchesTitle) {
            shouldInclude = false
          }
        } catch (error) {
          // Invalid regex - log error but don't filter (fail open)
          logError('NoteChooser', `Invalid excludeRegex pattern: ${excludeRegex}, error: ${error.message}`)
        }
      }

      return shouldInclude
    })
  }, [
    notes,
    includeCalendarNotes,
    includePersonalNotes,
    includeRelativeNotes,
    includeTeamspaceNotes,
    includeTemplatesAndForms,
    folderFilter,
    startFolder,
    filterByType,
    allowBackwardsCompatible,
    value,
    spaceFilter,
    includeRegex,
    excludeRegex,
  ])

  // Add "New Note" option to items if includeNewNoteOption is true
  const itemsWithNewNote = useMemo(() => {
    if (!includeNewNoteOption) {
      return filteredNotes
    }
    // Add a special "New Note" option at the beginning
    const newNoteOption: NoteOption = {
      title: 'New Note',
      filename: '__NEW_NOTE__',
      type: 'Notes',
    }
    return [newNoteOption, ...filteredNotes]
  }, [filteredNotes, includeNewNoteOption])

  // Configure the generic SearchableChooser for notes
  const config: ChooserConfig = {
    items: itemsWithNewNote,
    filterFn: (note: NoteOption, searchTerm: string) => {
      // Always show "New Note" option if it exists, regardless of search term
      if (note.filename === '__NEW_NOTE__') {
        return true
      }
      const term = searchTerm.toLowerCase()
      return note.title.toLowerCase().includes(term) || note.filename.toLowerCase().includes(term)
    },
    getDisplayValue: (note: NoteOption) => {
      if (note.filename === '__NEW_NOTE__') {
        return 'New Note'
      }
      return note.title
    },
    getOptionText: (note: NoteOption) => {
      // Handle "New Note" option
      if (note.filename === '__NEW_NOTE__') {
        return 'New Note'
      }
      // If showTitleOnly is true, always return just the title
      if (showTitleOnly) {
        return note.title
      }
      // If shortDescription is being used (folder path is shown there), only show title
      // Otherwise, show "path / title" format for backward compatibility
      const decoration = getNoteDecoration(note)
      if (decoration.shortDescription) {
        // Folder path is shown in shortDescription, so only show title here
        return note.title
      }
      // For personal/project notes, show "path / title" format to match native chooser
      // For calendar notes, show just the title
      if (note.type === 'Notes' || !note.type) {
        // Parse teamspace info to get clean folder path
        const possTeamspaceDetails = parseTeamspaceFilename(note.filename)
        let folder = getFolderFromFilename(note.filename)

        // Strip teamspace prefix from folder path for display
        if (possTeamspaceDetails.isTeamspace) {
          folder = getFilenameWithoutTeamspaceID(folder) || '/'
        }

        // Format as "path / title" (or just "title" if folder is root)
        if (folder === '/' || !folder) {
          return note.title
        }

        // Check if the title already contains the folder path to avoid duplication
        // Some notes (like folder links) have titles that include the folder path
        const folderWithoutSlash = folder.replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
        const titleContainsFolder = note.title.includes(folderWithoutSlash) || note.title.includes(folder)

        if (titleContainsFolder) {
          // Title already contains folder path, just return the title
          return note.title
        }

        return `${folder} / ${note.title}`
      } else if (note.type === 'Calendar') {
        // For calendar notes, show just the title (which should already include date info)
        return note.title
      }
      // Fallback to just title
      return note.title
    },
    getOptionTitle: (note: NoteOption) => {
      const decoration = getNoteDecoration(note)
      // If shortDescriptionOnLine2 is true, the folder path is already shown on line 2,
      // so don't duplicate it in the tooltip - just show filename and title
      if (shortDescriptionOnLine2 && decoration.shortDescription) {
        return `${note.title} (${note.filename})`
      }
      // Otherwise, show filename and shortDescription if available
      return decoration.shortDescription ? `${note.filename} - ${decoration.shortDescription}` : note.filename
    },
    truncateDisplay: truncateText,
    onSelect: (note: NoteOption) => {
      if (note.filename === '__NEW_NOTE__') {
        handleNewNoteClick()
      } else {
        // Use effectiveOutputFormat to determine what to output
        // For single-select, effectiveOutputFormat will be 'title' or 'filename'
        const outputValue = effectiveOutputFormat === 'filename' ? note.filename : note.title
        onChange(outputValue, note.filename)
      }
    },
    emptyMessageNoItems: 'No notes found',
    emptyMessageNoMatch: 'No notes match',
    classNamePrefix: 'note-chooser',
    iconClass: 'fa-file-lines',
    fieldType: 'note-chooser',
    debugLogging: false,
    maxResults: 999999, // Show all items - use very large number instead of undefined to avoid default parameter issue
    inputMaxLength: 100, // Large value - CSS handles most truncation based on actual width
    dropdownMaxLength: 80, // Large value for dropdown - only truncate very long items
    getOptionIcon: (note: NoteOption) => {
      if (note.filename === '__NEW_NOTE__') return 'file-circle-plus'
      return getNoteDecoration(note).icon
    },
    getOptionColor: (note: NoteOption) => {
      if (note.filename === '__NEW_NOTE__') return 'orange-500'
      return getNoteDecoration(note).color
    },
    getOptionShortDescription: (note: NoteOption) => getNoteDecoration(note).shortDescription,
    shortDescriptionOnLine2,
  }

  // Format value for display if it's a date string (YYYYMMDD or YYYY-MM-DD format)
  const displayValue = useMemo(() => {
    if (value && (isDateString(value) || isISODateString(value))) {
      return formatDateStringForDisplay(value)
    }
    return value
  }, [value])

  // For multi-select mode: parse value to get selected note filenames
  // Use noteOutputFormat directly for multi-select (effectiveOutputFormat will match it for multi-select)
  const selectedNoteFilenames: Array<string> = useMemo(() => {
    if (!allowMultiSelect || !value) return ([]: Array<string>)
    // For multi-select, use noteOutputFormat directly (defaults to 'wikilink')
    const multiSelectFormat = noteOutputFormat || 'wikilink'
    const parsedValues = parseFormattedValue(value, multiSelectFormat, noteSeparator)
    // Find notes matching the parsed values (could be titles or filenames depending on format)
    return filteredNotes
      .filter((note) => {
        if (multiSelectFormat === 'filename') {
          return parsedValues.includes(note.filename)
        } else {
          // For other formats, match by title or filename
          return parsedValues.includes(note.title) || parsedValues.includes(note.filename)
        }
      })
      .map((note) => note.filename)
  }, [allowMultiSelect, value, noteOutputFormat, noteSeparator, filteredNotes, parseFormattedValue])

  // Handle multi-select onChange
  const handleMultiSelectChange = useCallback(
    (selectedFilenames: string | Array<string>) => {
      logDebug('NoteChooser', `handleMultiSelectChange called with selectedFilenames=${JSON.stringify(selectedFilenames)}`)
      const filenamesArray = Array.isArray(selectedFilenames) ? selectedFilenames : [selectedFilenames]
      logDebug('NoteChooser', `handleMultiSelectChange: filenamesArray=${JSON.stringify(filenamesArray)}, filteredNotes.length=${filteredNotes.length}`)
      // Find notes by filename
      const selectedNotes: Array<NoteOption> = []
      filenamesArray.forEach((filename) => {
        const note = filteredNotes.find((n) => n.filename === filename)
        if (note != null) {
          selectedNotes.push(note)
        } else {
          logDebug('NoteChooser', `handleMultiSelectChange: Note not found for filename="${filename}"`)
        }
      })

      logDebug('NoteChooser', `handleMultiSelectChange: selectedNotes.length=${selectedNotes.length}`)
      if (selectedNotes.length > 0) {
        // For multi-select, use noteOutputFormat directly (defaults to 'wikilink')
        const multiSelectFormat = noteOutputFormat || 'wikilink'
        const formatted = formatNotes(selectedNotes, multiSelectFormat, noteSeparator)
        logDebug('NoteChooser', `handleMultiSelectChange: formatted="${formatted}"`)
        // Call parent onChange with formatted string as title and empty string as filename
        onChange(formatted, '')
      } else {
        logDebug('NoteChooser', `handleMultiSelectChange: No notes selected, calling onChange('', '')`)
        // No notes selected
        onChange('', '')
      }
    },
    [filteredNotes, formatNotes, noteOutputFormat, noteSeparator, onChange],
  )

  // If multi-select mode, render ContainedMultiSelectChooser
  // Explicitly check for true (not just truthy) to avoid string "true" issues
  if (allowMultiSelect === true) {
    const allowMultiSelectStr = allowMultiSelect ? 'true' : 'false'
    logDebug('NoteChooser', `Multi-select mode enabled: allowMultiSelect=${allowMultiSelectStr} (type: ${typeof allowMultiSelect}), filteredNotes.length=${filteredNotes.length}`)
    // Get note filenames as items for ContainedMultiSelectChooser
    const noteFilenames = filteredNotes.map((note) => note.filename)
    logDebug('NoteChooser', `Rendering ContainedMultiSelectChooser with ${noteFilenames.length} items, selectedNoteFilenames=${JSON.stringify(selectedNoteFilenames)}`)

    return (
      <ContainedMultiSelectChooser
        label={label}
        value={selectedNoteFilenames}
        onChange={handleMultiSelectChange}
        disabled={disabled}
        compactDisplay={compactDisplay}
        placeholder={placeholder}
        items={noteFilenames}
        returnAsArray={true}
        getItemDisplayLabel={(filename: string) => {
          const note = filteredNotes.find((n) => n.filename === filename)
          if (!note) return filename
          // Use the same display logic as single-select mode
          if (showTitleOnly) {
            return note.title || filename
          }
          const decoration = getNoteDecoration(note)
          if (decoration.shortDescription) {
            return note.title || filename
          }
          if (note.type === 'Notes' || !note.type) {
            const possTeamspaceDetails = parseTeamspaceFilename(note.filename)
            let folder = getFolderFromFilename(note.filename)
            if (possTeamspaceDetails.isTeamspace) {
              folder = getFilenameWithoutTeamspaceID(folder) || '/'
            }
            if (folder === '/' || !folder) {
              return note.title || filename
            }
            const folderWithoutSlash = folder.replace(/^\/+|\/+$/g, '')
            const titleContainsFolder = note.title.includes(folderWithoutSlash) || note.title.includes(folder)
            if (titleContainsFolder) {
              return note.title || filename
            }
            return `${folder} / ${note.title || filename}`
          }
          return note.title || filename
        }}
        maxHeight="200px"
        width={width}
        fieldType="note-chooser"
        allowCreate={false}
        fieldKey={label ? `note-chooser-${label}` : undefined}
        emptyMessageNoItems="No notes available"
        emptyMessageNoMatch="No notes match your search"
      />
    )
  }

  // Single-select mode: render SearchableChooser (existing behavior)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <SearchableChooser
            label={label}
            value={displayValue}
            disabled={disabled}
            compactDisplay={compactDisplay}
            placeholder={placeholder}
            showValue={showValue}
            width={width}
            config={config}
            onOpen={onOpen}
            isLoading={isLoading}
          />
        </div>
        {showCalendarChooserIcon && !disabled && !allowMultiSelect && (
          <button
            ref={calendarButtonRef}
            type="button"
            onClick={handleCalendarIconClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'calc(0.85rem * 1.2 + 8px)', // Match input field height exactly
              height: 'calc(0.85rem * 1.2 + 8px)', // Match input field height: font-size * line-height + vertical padding
              padding: 0,
              border: '1px solid var(--divider-color, #CDCFD0)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-main-color, #eff1f5)',
              color: 'var(--tint-color, #dc8a78)', // Use tint-color for icon
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Select date"
          >
            <i className="fa-regular fa-calendar" style={{ fontSize: '0.85rem' }} />
          </button>
        )}
      </div>
      {showCalendarPicker &&
        calendarPosition &&
        (() => {
          const body = document.body
          if (!body) return null
          // $FlowFixMe[incompatible-call] - document.body is checked for null above
          return createPortal(
            <div
              ref={calendarPickerRef}
              className="dayPicker-container"
              style={{
                position: 'fixed',
                top: `${calendarPosition.top}px`,
                left: `${calendarPosition.left}px`,
                zIndex: 10000,
                backgroundColor: 'var(--bg-main-color, #eff1f5)',
              }}
            >
              <DayPicker
                mode="single"
                selected={
                  value && (isDateString(value) || isISODateString(value))
                    ? new Date(formatDateStringForDisplay(value))
                    : null
                }
                onSelect={handleCalendarDateSelect}
                numberOfMonths={1}
                fixedHeight
                className="calendarPickerCustom"
              />
            </div>,
            body,
          )
        })()}
    </>
  )
}

export default NoteChooser
