// @flow
//--------------------------------------------------------------------------
// NoteChooser Component
// Allows users to select a note by typing to filter choices
//--------------------------------------------------------------------------

import React, { useMemo, useState } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { TEAMSPACE_ICON_COLOR, defaultNoteIconDetails, noteIconsToUse } from '@helpers/NPnote.js'
import { getFolderFromFilename, getFolderDisplayName } from '@helpers/folders.js'
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
  // Filter options - each NoteChooser filters the notes array based on its own options
  includeCalendarNotes?: boolean, // Include calendar notes (default: false)
  includePersonalNotes?: boolean, // Include personal/project notes (default: true)
  includeRelativeNotes?: boolean, // Include relative notes like <today>, <thisweek>, etc. (default: false)
  includeTeamspaceNotes?: boolean, // Include teamspace notes (default: true)
  showValue?: boolean, // If true, display the selected value below the input
  includeNewNoteOption?: boolean, // If true, add a 'New Note' option that allows creating a new note
  dependsOnFolderKey?: string, // Key of a folder-chooser field to filter notes by folder
  folderFilter?: ?string, // Current folder value from dependsOnFolderKey field (for filtering notes) - can be null
  startFolder?: ?string, // Start folder to filter notes (e.g., '@Templates/Forms')
  filterByType?: ?string, // Filter notes by frontmatter type (e.g., 'forms-processor')
  allowBackwardsCompatible?: boolean, // If true, allow notes that don't match filters if they match the current value
  spaceFilter?: ?string, // Space ID to filter by (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request note creation from plugin
  onNotesChanged?: () => void, // Callback to request note list reload after creating a note
  onOpen?: () => void, // Callback when dropdown opens (for lazy loading) - can be async internally
  isLoading?: boolean, // If true, show loading indicator
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
}

/**
 * NoteChooser Component
 * A searchable dropdown for selecting notes
 * @param {NoteChooserProps} props
 * @returns {React$Node}
 */
/**
 * Get note decoration using shared helpers from @helpers/NPnote.js
 * Adapted to work with NoteOption instead of TNote
 */
const getNoteDecoration = (note: NoteOption): { icon: string, color: string, shortDescription: ?string } => {
  // Use shared helper to parse teamspace info
  const possTeamspaceDetails = parseTeamspaceFilename(note.filename)

  // Work out which icon to use for this note (using shared constants)
  const FMAttributes = note.frontmatterAttributes || {}
  const userSetIcon = FMAttributes['icon']
  const userSetIconColor = FMAttributes['icon-color']

  // Determine note type for icon (using shared helper)
  // For teamspace notes, strip the teamspace prefix first
  let folderPath = getFolderFromFilename(note.filename)
  if (possTeamspaceDetails.isTeamspace) {
    folderPath = getFilenameWithoutTeamspaceID(folderPath) || '/'
  }
  let noteTypeForIcon = folderPath.split('/')[0] || '/'
  if (note.type === 'Calendar') {
    // Simplified calendar note type detection (could be enhanced to detect week/month/quarter/year)
    // For now, assume daily - could check filename pattern for more precision
    const basename = note.filename.split('/').pop() || ''
    if (/^\d{8}\.md$/.test(basename) || /^\d{4}-\d{2}-\d{2}\.md$/.test(basename)) {
      noteTypeForIcon = '<DAY>' // Could enhance to detect week/month/quarter/year
    }
  }

  // Use shared noteIconsToUse array to find matching icon
  const folderIconDetails = noteIconsToUse.find((details) => details.firstLevelFolder === noteTypeForIcon) ?? defaultNoteIconDetails

  // Determine color (using shared constant for teamspace)
  const color = possTeamspaceDetails.isTeamspace || note.isTeamspaceNote ? TEAMSPACE_ICON_COLOR : userSetIconColor || folderIconDetails.color

  // Short description: show teamspace name if it's a teamspace note, otherwise show folder path
  let shortDescription: ?string = null
  if (possTeamspaceDetails.isTeamspace && note.teamspaceTitle) {
    shortDescription = note.teamspaceTitle
  } else if (folderPath && folderPath !== '/') {
    // Show folder path as short description for non-teamspace notes
    shortDescription = folderPath
  }

  return {
    icon: userSetIcon || folderIconDetails.icon,
    color,
    shortDescription,
  }
}

export function NoteChooser({
  label,
  value = '',
  notes = [],
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search notes...',
  includeCalendarNotes = false,
  includePersonalNotes = true,
  includeRelativeNotes = false,
  includeTeamspaceNotes = true,
  showValue = false,
  includeNewNoteOption = false,
  dependsOnFolderKey,
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
}: NoteChooserProps): React$Node {
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')

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

      // Filter by startFolder if provided
      if (startFolder && !isRelativeNote) {
        const noteFolder = getFolderFromFilename(note.filename)
        const normalizeFolder = (folder: string): string => {
          if (folder === '/') return '/'
          return folder.replace(/\/+$/, '')
        }
        const normalizedStart = normalizeFolder(startFolder)
        const normalizedNoteFolder = normalizeFolder(noteFolder)
        const folderMatches = normalizedNoteFolder === normalizedStart || normalizedNoteFolder.startsWith(normalizedStart + '/')
        if (!folderMatches) {
          return false
        }
      }

      // Filter by type if filterByType is provided
      if (filterByType && !isRelativeNote) {
        const noteType = note.frontmatterAttributes?.type
        if (noteType !== filterByType) {
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
        const folderMatches = normalizedNoteFolder === normalizedFilter || normalizedNoteFolder.startsWith(normalizedFilter + '/')

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

      return shouldInclude
    })
  }, [notes, includeCalendarNotes, includePersonalNotes, includeRelativeNotes, includeTeamspaceNotes, folderFilter, startFolder, filterByType, allowBackwardsCompatible, value, spaceFilter])

  // Add "New Note" option to items if includeNewNoteOption is true
  const itemsWithNewNote = useMemo(() => {
    if (!includeNewNoteOption) {
      return filteredNotes
    }
    // Add a special "New Note" option at the beginning
    const newNoteOption: NoteOption = {
      title: '➕ New Note',
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
        return '➕ New Note'
      }
      return note.title
    },
    getOptionText: (note: NoteOption) => {
      // Handle "New Note" option
      if (note.filename === '__NEW_NOTE__') {
        return '➕ New Note'
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
      return decoration.shortDescription ? `${note.filename} - ${decoration.shortDescription}` : note.filename
    },
    truncateDisplay: truncateText,
    onSelect: (note: NoteOption) => {
      if (note.filename === '__NEW_NOTE__') {
        handleNewNoteClick()
      } else {
        onChange(note.title, note.filename)
      }
    },
    emptyMessageNoItems: 'No notes found',
    emptyMessageNoMatch: 'No notes match',
    classNamePrefix: 'note-chooser',
    iconClass: 'fa-file-lines',
    fieldType: 'note-chooser',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 100, // Large value - CSS handles most truncation based on actual width
    dropdownMaxLength: 80, // Large value for dropdown - only truncate very long items
    getOptionIcon: (note: NoteOption) => getNoteDecoration(note).icon,
    getOptionColor: (note: NoteOption) => getNoteDecoration(note).color,
    getOptionShortDescription: (note: NoteOption) => getNoteDecoration(note).shortDescription,
    shortDescriptionOnLine2,
  }

  return (
    <SearchableChooser
      label={label}
      value={value}
      disabled={disabled}
      compactDisplay={compactDisplay}
      placeholder={placeholder}
      showValue={showValue}
      config={config}
      onOpen={onOpen}
      isLoading={isLoading}
    />
  )
}

export default NoteChooser
