// @flow

/**
 * Helper functions for converting NotePlan notes to React-compatible format
 * Uses native decoration functions from @helpers to ensure consistency
 *
 * @author @dwertheimer
 */

import { getNoteDecoration } from '@helpers/NPnote'
import { logDebug } from '@helpers/dev'

/**
 * Type definition for note options used in React components
 */
export type NoteOption = {
  title: string,
  filename: string,
  type: string, // 'Notes' or 'Calendar'
  frontmatterAttributes: { [key: string]: any },
  isTeamspaceNote: boolean,
  teamspaceID: ?string,
  teamspaceTitle: ?string,
  changedDate: ?number,
  // Decoration info from native getNoteDecoration (optional, can be added later)
  decoration?: {
    icon: string,
    color: string,
    shortDescription: ?string,
  },
}

/**
 * Convert a single TNote to NoteOption format for React components
 * Uses native getNoteDecoration for consistent decoration
 * @param {TNote} note - The NotePlan note to convert
 * @param {string} overrideType - Optional type override (e.g., 'Calendar' for calendar notes)
 * @param {boolean} includeDecoration - Whether to include decoration info (default: false, can be added by React components as needed)
 * @returns {?NoteOption} The converted note option, or null if note is invalid
 */
export function convertNoteToOption(note: TNote, overrideType?: ?string, includeDecoration: boolean = false): ?NoteOption {
  if (!note || !note.title || !note.filename) {
    return null
  }

  const option: NoteOption = {
    title: note.title,
    filename: note.filename,
    type: overrideType || note.type || 'Notes',
    frontmatterAttributes: note.frontmatterAttributes || {},
    isTeamspaceNote: note.isTeamspaceNote || false,
    teamspaceID: note.teamspaceID || null,
    teamspaceTitle: note.teamspaceTitle || null,
    changedDate: typeof note.changedDate === 'number' ? note.changedDate : note.changedDate instanceof Date ? note.changedDate.getTime() : null,
  }

  // Optionally include decoration from native helper
  if (includeDecoration) {
    try {
      const decoration = getNoteDecoration(note)
      if (decoration && decoration.icon && decoration.color) {
        option.decoration = {
          icon: decoration.icon,
          color: decoration.color,
          shortDescription: decoration.shortDescription || null,
        }
      }
    } catch (error) {
      // If decoration fails, continue without it
      const noteTitle = note?.title || 'unknown'
      logDebug('noteHelpers', `Failed to get decoration for note "${noteTitle}": ${error.message}`)
    }
  }

  return option
}

/**
 * Convert an array of TNote objects to NoteOption format
 * Filters out invalid notes and sorts by changedDate (most recent first)
 * Uses native getNoteDecoration for consistent decoration
 * @param {$ReadOnlyArray<TNote>} notes - Array of NotePlan notes to convert
 * @param {string} overrideType - Optional type override for all notes
 * @param {boolean} includeDecoration - Whether to include decoration info from native helpers (default: true)
 * @returns {Array<NoteOption>} Array of converted note options, sorted by changedDate
 */
export function convertNotesToOptions(notes: $ReadOnlyArray<TNote>, overrideType?: ?string, includeDecoration: boolean = true): Array<NoteOption> {
  if (!Array.isArray(notes) || notes.length === 0) {
    return []
  }

  const converted: Array<NoteOption> = []
  for (const note of notes) {
    const option = convertNoteToOption(note, overrideType, includeDecoration)
    if (option != null) {
      converted.push(option)
    }
  }

  // Sort by changedDate (most recent first)
  converted.sort((a: NoteOption, b: NoteOption) => {
    const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
    const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
    return bDate - aDate
  })

  return converted
}

/**
 * Get all project notes converted to NoteOption format
 * Uses native getNoteDecoration for consistent decoration
 * @param {boolean} includeCalendarNotes - Whether to include calendar notes (default: false)
 * @param {boolean} includeDecoration - Whether to include decoration info from native helpers (default: true)
 * @returns {Array<NoteOption>} Array of converted note options
 */
export function getAllNotesAsOptions(includeCalendarNotes: boolean = false, includeDecoration: boolean = true): Array<NoteOption> {
  const notes: Array<NoteOption> = []

  // Get all project notes
  const projectNotes = DataStore.projectNotes || []
  notes.push(...convertNotesToOptions(projectNotes, undefined, includeDecoration))

  // Optionally include calendar notes
  if (includeCalendarNotes) {
    const calendarNotes = DataStore.calendarNotes || []
    notes.push(...convertNotesToOptions(calendarNotes, 'Calendar', includeDecoration))
  }

  // Re-sort all notes together by changedDate (most recent first)
  notes.sort((a: NoteOption, b: NoteOption) => {
    const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
    const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
    return bDate - aDate
  })

  return notes
}
