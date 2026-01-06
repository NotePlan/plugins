// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getNotes
// Returns list of notes with filtering options
//--------------------------------------------------------------------------

import { getAllNotesAsOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of notes with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.includeCalendarNotes - Include calendar notes (default: false)
 * @param {boolean} params.includePersonalNotes - Include personal/project notes (default: true)
 * @param {boolean} params.includeRelativeNotes - Include relative notes like <today>, <thisweek>, etc. (default: false)
 * @param {boolean} params.includeTeamspaceNotes - Include teamspace notes (default: true)
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getNotes(
  params: {
    includeCalendarNotes?: boolean,
    includePersonalNotes?: boolean,
    includeRelativeNotes?: boolean,
    includeTeamspaceNotes?: boolean,
    space?: string, // Space ID (empty string = Private, teamspace ID = specific teamspace)
  } = {},
  pluginJson: any,
): RequestResponse {
  const startTime: number = Date.now()
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true
    const spaceId = params.space ?? '' // Empty string = Private (default)

    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getNotes START: includeCalendarNotes=${String(includeCalendarNotes)}, includePersonalNotes=${String(includePersonalNotes)}, includeRelativeNotes=${String(
        includeRelativeNotes,
      )}, includeTeamspaceNotes=${String(includeTeamspaceNotes)}, space=${spaceId || 'Private'}`,
    )

    const allNotes: Array<any> = []

    // Get project notes and calendar notes separately, then filter
    let projectStartTime: number = Date.now()
    let projectElapsed: number = 0
    let calendarElapsed: number = 0
    let relativeElapsed: number = 0

    // Get project notes (personal notes)
    if (includePersonalNotes) {
      projectStartTime = Date.now()
      const projectNotes = getAllNotesAsOptions(false, true) // Don't include calendar notes here
      projectElapsed = Date.now() - projectStartTime
      logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes PROJECT: elapsed=${projectElapsed}ms, found=${projectNotes.length} project notes`)

      // Filter teamspace notes if needed, and also filter by space if specified
      for (const note of projectNotes) {
        const isTeamspaceNote = note.isTeamspaceNote === true
        const noteTeamspaceID = note.teamspaceID || null

        // First check if we should include teamspace notes at all
        if (includeTeamspaceNotes || !isTeamspaceNote) {
          // If space filter is specified, only include notes from that space
          if (spaceId !== '') {
            // Space filter is set - only include notes from that specific space
            if (spaceId === noteTeamspaceID) {
              allNotes.push(note)
            }
            // Skip notes that don't match the space filter
          } else {
            // No space filter (Private) - only include private notes (non-teamspace)
            if (!isTeamspaceNote) {
              allNotes.push(note)
            }
            // Skip teamspace notes when space filter is Private (empty string)
          }
        }
      }
      logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes PROJECT FILTERED: ${allNotes.length} personal notes after teamspace and space filter`)
    }

    // Get calendar notes if requested
    if (includeCalendarNotes) {
      const calendarStartTime: number = Date.now()
      const calendarNotes = getAllNotesAsOptions(true, true) // Include calendar notes
      const calendarElapsed: number = Date.now() - calendarStartTime
      logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes CALENDAR: elapsed=${calendarElapsed}ms, found=${calendarNotes.length} calendar notes`)

      // Filter teamspace notes if needed, and only include calendar notes (not project notes)
      // Also filter by space if specified
      for (const note of calendarNotes) {
        const isCalendarNote = note.type === 'Calendar'
        const isTeamspaceNote = note.isTeamspaceNote === true
        const noteTeamspaceID = note.teamspaceID || null

        // Only include if it's actually a calendar note (not a project note that got mixed in)
        if (isCalendarNote) {
          // If space filter is specified, only include notes from that space
          if (spaceId !== '') {
            // Space filter is set - only include notes from that specific space
            if (spaceId === noteTeamspaceID) {
              allNotes.push(note)
            }
            // Skip notes that don't match the space filter
          } else {
            // No space filter (Private) - only include private notes (non-teamspace)
            if (!isTeamspaceNote) {
              allNotes.push(note)
            }
            // Skip teamspace notes when space filter is Private (empty string)
          }
        }
      }
      logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes CALENDAR FILTERED: ${allNotes.length} total notes after calendar filter`)
    }

    logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes FILTERED: ${allNotes.length} notes after filtering`)

    // Get relative notes (like <today>, <thisweek>, etc.)
    if (includeRelativeNotes) {
      const relativeStartTime: number = Date.now()
      const relativeNotes = getRelativeNotesAsOptions(true) // Include decoration
      relativeElapsed = Date.now() - relativeStartTime
      logDebug(pluginJson, `[np.Shared/requestHandlers] getNotes RELATIVE: elapsed=${relativeElapsed}ms, found=${relativeNotes.length} relative notes`)
      allNotes.push(...relativeNotes)
    }

    // Re-sort all notes together by changedDate (most recent first), but put relative notes at the top
    allNotes.sort((a: any, b: any) => {
      // Relative notes (those with filename starting with '<') should appear first
      const aIsRelative = typeof a.filename === 'string' && a.filename.startsWith('<')
      const bIsRelative = typeof b.filename === 'string' && b.filename.startsWith('<')

      if (aIsRelative && !bIsRelative) return -1
      if (!aIsRelative && bIsRelative) return 1

      // For non-relative notes, sort by changedDate (most recent first)
      const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
      const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
      return bDate - aDate
    })

    const totalElapsed: number = Date.now() - startTime
    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getNotes COMPLETE: totalElapsed=${totalElapsed}ms, found=${allNotes.length} total notes (project: ${projectElapsed}ms, calendar: ${calendarElapsed}ms, relative: ${relativeElapsed}ms)`,
    )

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getNotes ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  }
}



