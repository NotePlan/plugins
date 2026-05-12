// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getNotes
// Returns list of notes with filtering options
//--------------------------------------------------------------------------

import { convertNotesToOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { logError } from '@helpers/dev'
import { parseTeamspaceFilename } from '@helpers/teamspace'

export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Return the teamspace ID for a note using either NotePlan metadata or the filename prefix.
 * @param {TNote} note - NotePlan note to inspect
 * @returns {?string} Teamspace ID, or null for Private notes
 */
function getNoteTeamspaceID(note: TNote): ?string {
  if (note?.teamspaceID) {
    return note.teamspaceID
  }

  const parsed = parseTeamspaceFilename(note?.filename || '')
  return parsed.teamspaceID || null
}

/**
 * Check whether a raw NotePlan note belongs in the requested space before converting it for React.
 * Filtering before conversion avoids decorating every note in the database for one space-specific chooser.
 * @param {TNote} note - NotePlan note to inspect
 * @param {boolean} includeAllSpaces - Whether all spaces are requested
 * @param {string} spaceId - Requested space ID, or empty string for Private
 * @param {boolean} includeTeamspaceNotes - Whether teamspace notes are allowed
 * @returns {boolean} true if the note should be included
 */
function noteMatchesSpace(note: TNote, includeAllSpaces: boolean, spaceId: string, includeTeamspaceNotes: boolean): boolean {
  const noteTeamspaceID = getNoteTeamspaceID(note)
  const isTeamspaceNote = note.isTeamspaceNote === true || noteTeamspaceID != null

  if (!(includeTeamspaceNotes || !isTeamspaceNote)) {
    return false
  }

  if (includeAllSpaces) {
    return true
  }

  if (spaceId !== '') {
    return spaceId === noteTeamspaceID
  }

  return !isTeamspaceNote
}

/**
 * Get list of notes with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.includeCalendarNotes - Include calendar notes (default: false)
 * @param {boolean} params.includePersonalNotes - Include personal/project notes (default: true)
 * @param {boolean} params.includeRelativeNotes - Include relative notes like <today>, <thisweek>, etc. (default: false)
 * @param {boolean} params.includeTeamspaceNotes - Include teamspace notes (default: true)
 * @param {boolean} params.includeDecoration - Include note decoration metadata (default: true)
 * @param {string} params.space - Space ID to filter by: empty string / omitted = Private only; teamspace UUID = that space; `'__all__'` = all accessible spaces (private + teamspaces per flags below)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getNotes(
  params: {
    includeCalendarNotes?: boolean,
    includePersonalNotes?: boolean,
    includeRelativeNotes?: boolean,
    includeTeamspaceNotes?: boolean,
    includeDecoration?: boolean,
    space?: string, // Space ID ('' = Private, UUID = teamspace, '__all__' = all spaces)
  } = {},
  pluginJson: any,
): RequestResponse {
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true
    const includeDecoration = params.includeDecoration ?? true
    const includeAllSpaces = params.space === '__all__'
    const spaceId: string = includeAllSpaces ? '' : params.space ?? ''

    const allNotes: Array<any> = []

    if (includePersonalNotes) {
      const projectNotesRaw = DataStore.projectNotes || []
      const projectNotesRawFiltered = projectNotesRaw.filter((note: TNote) => noteMatchesSpace(note, includeAllSpaces, spaceId, includeTeamspaceNotes))
      const projectNotes = convertNotesToOptions(projectNotesRawFiltered, undefined, includeDecoration)
      allNotes.push(...projectNotes)
    }

    if (includeCalendarNotes) {
      const calendarNotesRaw = DataStore.calendarNotes || []
      const calendarNotesRawFiltered = calendarNotesRaw.filter((note: TNote) => noteMatchesSpace(note, includeAllSpaces, spaceId, includeTeamspaceNotes))
      const calendarNotes = convertNotesToOptions(calendarNotesRawFiltered, 'Calendar', includeDecoration)
      allNotes.push(...calendarNotes)
    }

    if (includeRelativeNotes) {
      const relativeNotes = getRelativeNotesAsOptions(includeDecoration)
      allNotes.push(...relativeNotes)
    }

    allNotes.sort((a: any, b: any) => {
      const aIsRelative = typeof a.filename === 'string' && a.filename.startsWith('<')
      const bIsRelative = typeof b.filename === 'string' && b.filename.startsWith('<')

      if (aIsRelative && !bIsRelative) return -1
      if (!aIsRelative && bIsRelative) return 1

      const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
      const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
      return bDate - aDate
    })

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    logError(pluginJson, `[np.Shared/requestHandlers] getNotes ERROR: error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  }
}



