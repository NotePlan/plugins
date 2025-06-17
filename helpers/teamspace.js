// @flow
//-------------------------------------------------------------------------------
// Functions that help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'

//-----------------------------------------------------------
// CONSTANTS

export const TEAMSPACE_FA_ICON = 'fa-regular fa-screen-users'

// Match the filename for a Teamspace note (updated for v3.17.0)
// Note: should really be using NotePlan.environment.teamspaceFilenamePrefix as part of the regex, but this needs to be available where NotePlan.environment is not available.
export const RE_TEAMSPACE_NOTE_FILENAME: RegExp = new RegExp(`^%%NotePlanCloud%%\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/`, 'i')

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
  const isPossibleTeamspaceFilename = filenameIn.match(RE_TEAMSPACE_NOTE_FILENAME)

  if (isPossibleTeamspaceFilename) {
    const filename = filenameIn.split('/')[2]
    const teamspaceID = isPossibleTeamspaceFilename[1]
    logDebug('parseTeamspaceFilename', `Teamspace filename: ${filename} / teamspaceID: ${teamspaceID} (from ${filenameIn})`)
    return { filename: filename, isTeamspace: true, teamspaceID }
  } else {
    // logDebug('parseTeamspaceFilename', `filename ${filenameIn} is not a teamspace note`)
    return { filename: filenameIn, isTeamspace: false }
  }
}
