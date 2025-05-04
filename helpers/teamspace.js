// @flow
//-------------------------------------------------------------------------------
// Functions that help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------
import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'

//-----------------------------------------------------------
// CONSTANTS

export const TEAMSPACE_FA_ICON = 'fa-regular fa-screen-users'

// Match the filename for a Teamspace note
// Note: this is correct as of v3.17.0 build 1371. It is expected that this will change in future versions.
// Note: should really be using NotePlan.environment.teamspaceFilenamePrefix as part of the regex, but this needs to be available where NotePlan.environment is not available.
export const RE_TEAMSPACE_NOTE_FILENAME: RegExp = new RegExp(`^(%%Supabase%%|%%NotePlanCloud%%)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/`, 'i')

//-----------------------------------------------------------
// FUNCTIONS

/**
 * Check whether a filename is a Teamspace note.
 * @param {string} filenameIn - The full filename to check
 * @returns {boolean}
 */
export function isTeamspaceNoteFromFilename(filenameIn: string): boolean {
  const match = filenameIn.match(RE_TEAMSPACE_NOTE_FILENAME)
  return match !== null
}

/**
 * Check whether a filename is from a teamspace note and extract the relevant parts.
 * If it is not a teamspace note, then return the filename unchanged.
 * @param {string} filenameIn - The full filename to check
 * @returns {{ filename: string, isTeamspace: boolean, teamspaceID?: string }}
 */
export function parseTeamspaceFilename(filenameIn: string): { filename: string, isTeamspace: boolean, teamspaceID?: string } {
  const match = filenameIn.match(RE_TEAMSPACE_NOTE_FILENAME)

  if (match) {
    const filename = filenameIn.split('/')[2]
    const teamspaceID = match[2]
    logDebug('parseTeamspaceFilename', `Teamspace note, with calendar part: ${filename} for teamspaceID ${teamspaceID}`)
    return { filename: filename, isTeamspace: true, teamspaceID }
  } else {
    // logDebug('parseTeamspaceFilename', `Non-teamspace note with filename ${filenameIn}`)
    return { filename: filenameIn, isTeamspace: false }
  }
}
