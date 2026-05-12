// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getNotes
// Returns list of notes with filtering options
//--------------------------------------------------------------------------

import { convertNotesToOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { logDebug, logError } from '@helpers/dev'
import { parseTeamspaceFilename } from '@helpers/teamspace'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

let getNotesSequence: number = 0
let activeGetNotesCalls: number = 0

/**
 * Return a successful diagnostic response when the caller wants getNotes to stop before the next risky step.
 * This is intentionally returned to the caller instead of relying on logs, because NotePlan can freeze before flushing buffered logs.
 * @param {number} callId - Diagnostic call sequence number
 * @param {string} checkpoint - Checkpoint that was reached
 * @param {Object} details - Extra diagnostic details to return to the caller
 * @returns {RequestResponse}
 */
function debugStopResponse(callId: number, checkpoint: string, details: Object = {}): RequestResponse {
  return {
    success: true,
    message: `[DIAG][getNotes#${callId}] stopped at checkpoint "${checkpoint}"`,
    data: {
      debugStopped: true,
      checkpoint,
      details,
    },
  }
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
 * @param {string} params.debugStopAfter - TEMP DIAGNOSTIC: return early after this checkpoint instead of continuing
 * @param {number} params.debugCalendarConvertStart - TEMP DIAGNOSTIC: first filtered calendar note index to convert
 * @param {number} params.debugCalendarConvertLimit - TEMP DIAGNOSTIC: max filtered calendar notes to convert
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
    debugStopAfter?: string,
    debugCalendarConvertStart?: number,
    debugCalendarConvertLimit?: number,
    space?: string, // Space ID ('' = Private, UUID = teamspace, '__all__' = all spaces)
  } = {},
  pluginJson: any,
): RequestResponse {
  const startTime: number = Date.now()
  const callId = getNotesSequence + 1
  getNotesSequence = callId
  activeGetNotesCalls += 1
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true
    const includeDecoration = params.includeDecoration ?? true
    const debugStopAfter = params.debugStopAfter ?? ''
    const debugCalendarConvertStart = typeof params.debugCalendarConvertStart === 'number' && params.debugCalendarConvertStart > 0 ? Math.floor(params.debugCalendarConvertStart) : 0
    const debugCalendarConvertLimit = typeof params.debugCalendarConvertLimit === 'number' && params.debugCalendarConvertLimit >= 0 ? Math.floor(params.debugCalendarConvertLimit) : null
    const includeAllSpaces = params.space === '__all__'
    // When not '__all__': empty string / undefined = Private only; non-empty string = that teamspace
    const spaceId: string = includeAllSpaces ? '' : params.space ?? ''

    logDebug(
      pluginJson,
      `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] START active=${activeGetNotesCalls}: includeCalendarNotes=${String(
        includeCalendarNotes,
      )}, includePersonalNotes=${String(includePersonalNotes)}, includeRelativeNotes=${String(
        includeRelativeNotes,
      )}, includeTeamspaceNotes=${String(includeTeamspaceNotes)}, includeDecoration=${String(
        includeDecoration,
      )}, debugStopAfter="${debugStopAfter}", debugCalendarConvertStart=${debugCalendarConvertStart}, debugCalendarConvertLimit=${String(debugCalendarConvertLimit)}, space=${
        includeAllSpaces ? '__all__' : spaceId || 'Private'
      }`,
    )
    if (debugStopAfter === 'after-start') {
      return debugStopResponse(callId, 'after-start', { includeCalendarNotes, includePersonalNotes, includeRelativeNotes, includeTeamspaceNotes, includeDecoration, space: includeAllSpaces ? '__all__' : spaceId })
    }

    const allNotes: Array<any> = []

    // Get project notes and calendar notes separately, then filter
    let projectStartTime: number = Date.now()
    let projectElapsed: number = 0
    let calendarElapsed: number = 0
    let relativeElapsed: number = 0

    // Get project notes (personal notes)
    if (includePersonalNotes) {
      projectStartTime = Date.now()
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] PROJECT RAW ACCESS START`)
      const projectNotesRaw = DataStore.projectNotes || []
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] PROJECT RAW ACCESS COMPLETE raw=${projectNotesRaw.length}, elapsed=${Date.now() - projectStartTime}ms`)
      if (debugStopAfter === 'after-project-raw') {
        return debugStopResponse(callId, 'after-project-raw', { rawCount: projectNotesRaw.length, elapsed: Date.now() - projectStartTime })
      }
      const projectFilterStartTime = Date.now()
      const projectNotesRawFiltered = projectNotesRaw.filter((note: TNote) => noteMatchesSpace(note, includeAllSpaces, spaceId, includeTeamspaceNotes))
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] PROJECT FILTER COMPLETE filtered=${projectNotesRawFiltered.length}, elapsed=${Date.now() - projectFilterStartTime}ms`)
      if (debugStopAfter === 'after-project-filter') {
        return debugStopResponse(callId, 'after-project-filter', { rawCount: projectNotesRaw.length, filteredCount: projectNotesRawFiltered.length, elapsed: Date.now() - projectFilterStartTime })
      }
      const projectConvertStartTime = Date.now()
      const projectNotes = convertNotesToOptions(projectNotesRawFiltered, undefined, includeDecoration, `getNotes#${callId}:project`)
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] PROJECT CONVERT COMPLETE converted=${projectNotes.length}, elapsed=${Date.now() - projectConvertStartTime}ms`)
      if (debugStopAfter === 'after-project-convert') {
        return debugStopResponse(callId, 'after-project-convert', { rawCount: projectNotesRaw.length, filteredCount: projectNotesRawFiltered.length, convertedCount: projectNotes.length, elapsed: Date.now() - projectConvertStartTime })
      }
      projectElapsed = Date.now() - projectStartTime
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] PROJECT: elapsed=${projectElapsed}ms, raw=${projectNotesRaw.length}, filtered=${projectNotesRawFiltered.length}`)

      allNotes.push(...projectNotes)
    }

    // Get calendar notes if requested
    if (includeCalendarNotes) {
      const calendarStartTime: number = Date.now()
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR RAW ACCESS START`)
      const calendarNotesRaw = DataStore.calendarNotes || []
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR RAW ACCESS COMPLETE raw=${calendarNotesRaw.length}, elapsed=${Date.now() - calendarStartTime}ms`)
      if (debugStopAfter === 'after-calendar-raw') {
        return debugStopResponse(callId, 'after-calendar-raw', { rawCount: calendarNotesRaw.length, elapsed: Date.now() - calendarStartTime })
      }
      const calendarFilterStartTime = Date.now()
      const calendarNotesRawFiltered = calendarNotesRaw.filter((note: TNote) => noteMatchesSpace(note, includeAllSpaces, spaceId, includeTeamspaceNotes))
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR FILTER COMPLETE filtered=${calendarNotesRawFiltered.length}, elapsed=${Date.now() - calendarFilterStartTime}ms`)
      if (debugStopAfter === 'after-calendar-filter') {
        return debugStopResponse(callId, 'after-calendar-filter', { rawCount: calendarNotesRaw.length, filteredCount: calendarNotesRawFiltered.length, elapsed: Date.now() - calendarFilterStartTime })
      }
      const calendarConvertStartTime = Date.now()
      const calendarNotesToConvert =
        debugCalendarConvertLimit != null
          ? calendarNotesRawFiltered.slice(debugCalendarConvertStart, debugCalendarConvertStart + debugCalendarConvertLimit)
          : calendarNotesRawFiltered
      if (debugCalendarConvertLimit != null) {
        logDebug(
          pluginJson,
          `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR CONVERT SLICE start=${debugCalendarConvertStart}, limit=${debugCalendarConvertLimit}, sliceCount=${calendarNotesToConvert.length}, filtered=${calendarNotesRawFiltered.length}`,
        )
      }
      const calendarNotes = convertNotesToOptions(calendarNotesToConvert, 'Calendar', includeDecoration, `getNotes#${callId}:calendar`)
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR CONVERT COMPLETE converted=${calendarNotes.length}, elapsed=${Date.now() - calendarConvertStartTime}ms`)
      if (debugStopAfter === 'after-calendar-convert') {
        return debugStopResponse(callId, 'after-calendar-convert', {
          rawCount: calendarNotesRaw.length,
          filteredCount: calendarNotesRawFiltered.length,
          convertedCount: calendarNotes.length,
          debugCalendarConvertStart,
          debugCalendarConvertLimit,
          elapsed: Date.now() - calendarConvertStartTime,
        })
      }
      calendarElapsed = Date.now() - calendarStartTime
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] CALENDAR: elapsed=${calendarElapsed}ms, raw=${calendarNotesRaw.length}, filtered=${calendarNotesRawFiltered.length}`)

      allNotes.push(...calendarNotes)
    }

    logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] FILTERED: ${allNotes.length} notes after filtering`)

    // Get relative notes (like <today>, <thisweek>, etc.)
    if (includeRelativeNotes) {
      const relativeStartTime: number = Date.now()
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] RELATIVE START includeDecoration=${String(includeDecoration)}`)
      const relativeNotes = getRelativeNotesAsOptions(includeDecoration)
      relativeElapsed = Date.now() - relativeStartTime
      logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] RELATIVE: elapsed=${relativeElapsed}ms, found=${relativeNotes.length} relative notes`)
      if (debugStopAfter === 'after-relative') {
        return debugStopResponse(callId, 'after-relative', { relativeCount: relativeNotes.length, elapsed: relativeElapsed })
      }
      allNotes.push(...relativeNotes)
    }

    // Re-sort all notes together by changedDate (most recent first), but put relative notes at the top
    const finalSortStartTime = Date.now()
    logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] FINAL SORT START count=${allNotes.length}`)
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
    logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] FINAL SORT COMPLETE elapsed=${Date.now() - finalSortStartTime}ms`)
    if (debugStopAfter === 'after-final-sort') {
      return debugStopResponse(callId, 'after-final-sort', { totalCount: allNotes.length, elapsed: Date.now() - finalSortStartTime })
    }

    const totalElapsed: number = Date.now() - startTime
    logDebug(
      pluginJson,
      `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] COMPLETE: totalElapsed=${totalElapsed}ms, found=${allNotes.length} total notes (project: ${projectElapsed}ms, calendar: ${calendarElapsed}ms, relative: ${relativeElapsed}ms), active=${activeGetNotesCalls}`,
    )

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  } finally {
    activeGetNotesCalls = Math.max(0, activeGetNotesCalls - 1)
    logDebug(pluginJson, `[DIAG][np.Shared/requestHandlers][getNotes#${callId}] EXIT active=${activeGetNotesCalls}`)
  }
}



