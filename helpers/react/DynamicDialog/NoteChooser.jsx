// @flow
//--------------------------------------------------------------------------
// NoteChooser Component
// Allows users to select a note by typing to filter choices
//--------------------------------------------------------------------------

import React, { useMemo } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug } from '@helpers/react/reactDev.js'
import { TEAMSPACE_ICON_COLOR, defaultNoteIconDetails, noteIconsToUse } from '@helpers/NPnote.js'
import { getFolderFromFilename, getFolderDisplayName } from '@helpers/folders.js'
import { parseTeamspaceFilename } from '@helpers/teamspace.js'
import './NoteChooser.css'

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
  let noteTypeForIcon = getFolderFromFilename(note.filename).split('/')[0] || '/'
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

  // Short description: folder display name for regular notes (using shared helper)
  const shortDescription = note.type === 'Notes' || !note.type ? getFolderDisplayName(getFolderFromFilename(note.filename) || '') : ''

  return {
    icon: userSetIcon || folderIconDetails.icon,
    color,
    shortDescription: shortDescription || null,
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
}: NoteChooserProps): React$Node {
  // Filter notes based on this field's options
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Check if note is a calendar note
      const isCalendarNote = note.type === 'Calendar'

      // Check if note is a teamspace note
      const isTeamspaceNote = note.isTeamspaceNote === true

      // Check if note is a relative note (filename starts with '<')
      const isRelativeNote = typeof note.filename === 'string' && note.filename.startsWith('<')

      // Determine if this note should be included
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

      return shouldInclude
    })
  }, [notes, includeCalendarNotes, includePersonalNotes, includeRelativeNotes, includeTeamspaceNotes])

  // Configure the generic SearchableChooser for notes
  const config: ChooserConfig = {
    items: filteredNotes,
    filterFn: (note: NoteOption, searchTerm: string) => {
      const term = searchTerm.toLowerCase()
      return note.title.toLowerCase().includes(term) || note.filename.toLowerCase().includes(term)
    },
    getDisplayValue: (note: NoteOption) => note.title,
    getOptionText: (note: NoteOption) => {
      // For personal/project notes, show "path / title" format to match native chooser
      // For calendar notes, show just the title
      if (note.type === 'Notes' || !note.type) {
        // Get folder path from filename
        const folder = getFolderFromFilename(note.filename)
        // Log detailed info for debugging
        logDebug('NoteChooser', `getOptionText: filename="${note.filename}", title="${note.title}", extractedFolder="${folder}"`)
        
        // Format as "path / title" (or just "title" if folder is root)
        if (folder === '/' || !folder) {
          logDebug('NoteChooser', `getOptionText: root folder, returning title only: "${note.title}"`)
          return note.title
        }
        const result = `${folder} / ${note.title}`
        logDebug('NoteChooser', `getOptionText: formatted result: "${result}"`)
        return result
      } else if (note.type === 'Calendar') {
        // For calendar notes, show just the title (which should already include date info)
        logDebug('NoteChooser', `getOptionText: calendar note, returning title: "${note.title}"`)
        return note.title
      }
      // Fallback to just title
      logDebug('NoteChooser', `getOptionText: fallback, returning title: "${note.title}"`)
      return note.title
    },
    getOptionTitle: (note: NoteOption) => {
      const decoration = getNoteDecoration(note)
      return decoration.shortDescription ? `${note.filename} - ${decoration.shortDescription}` : note.filename
    },
    truncateDisplay: truncateText,
    onSelect: (note: NoteOption) => onChange(note.title, note.filename),
    emptyMessageNoItems: 'No notes found',
    emptyMessageNoMatch: 'No notes match',
    classNamePrefix: 'note-chooser',
    iconClass: 'fa-file-lines',
    fieldType: 'note-chooser',
    debugLogging: true,
    maxResults: 10,
    inputMaxLength: 100, // Large value - CSS handles most truncation based on actual width
    dropdownMaxLength: 80, // Large value for dropdown - only truncate very long items
    getOptionIcon: (note: NoteOption) => getNoteDecoration(note).icon,
    getOptionColor: (note: NoteOption) => getNoteDecoration(note).color,
    getOptionShortDescription: (note: NoteOption) => getNoteDecoration(note).shortDescription,
  }

  return <SearchableChooser label={label} value={value} disabled={disabled} compactDisplay={compactDisplay} placeholder={placeholder} showValue={showValue} config={config} />
}

export default NoteChooser

