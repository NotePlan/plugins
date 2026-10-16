// @flow
//-------------------------------------------------------------------------------
// Functions (that require NP v3.17.0 or later) to help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'

//-----------------------------------------------------------
// FUNCTIONS

/**
 * Get the teamspace root identifier.
 * Note: Can't be used in HTML/React components because it requires NotePlan.environment.
 * @returns {string}
 */
export function getTeamspaceRootIdentifier(): string {
  return NotePlan.environment.teamspaceFilenamePrefix ?? '%%Supabase%%'
}

/**
 * Get the regular expression for a Teamspace note filename
 * @returns {RegExp}
 * Note: Can't be used in HTML/React components because it requires NotePlan.environment.
 */
export function getTeamspaceNoteFilenameRegex(): RegExp {
  return new RegExp(`^${getTeamspaceRootIdentifier()}\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/`, 'i')
}

/**
 * Get all teamspace IDs and titles.
 * Note: requires NotePlan v3.17.0 or later.
 * @returns {Array<TTeamspace>}
 */
export function getAllTeamspaceIDsAndTitles(): Array<TTeamspace> {
  const outputList = DataStore.teamspaces?.map((teamspace) => ({ id: teamspace.filename.split('/')[1], title: teamspace.title || '(unknown)' })) ?? []
  // clo(outputList, 'getAllTeamspaceIDsAndTitles')
  return outputList
}

/**
 * Get the title of a teamspace from its ID.
 * `private` is the non-teamspace space and returns "Private" (never with the emoji).
 * @param {string} id - The ID of the teamspace, or `private`.
 * @param {boolean} [includeEmoji=false] - When true, prefix a real teamspace title with 👥.
 * @returns {string} The title of the teamspace (or 'Unknown Teamspace' if not found).
 */
export function getTeamspaceTitleFromID(id: string, includeEmoji: boolean = false): string {
  if (id === 'private') return 'Private'
  const allTeamspaceTitles = getAllTeamspaceIDsAndTitles()
  const title = allTeamspaceTitles.find((teamspace) => teamspace.id === id)?.title ?? 'Unknown Teamspace'
  return includeEmoji ? `👥 ${title}` : title
}

export function getTeamspaceTitleFromNote(note: TNote): string {
  return note.teamspaceTitle ?? ''
}
