// @flow
//-------------------------------------------------------------------------------
// Functions (that require NP v3.17.0 or later) to help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'

//-----------------------------------------------------------
// FUNCTIONS

/**
 * Get all teamspace IDs and titles.
 * Note: requires NotePlan v3.17.0 or later.
 * @returns {Array<TTeamspace>}
 */
export function getAllTeamspaceIDsAndTitles(): Array<TTeamspace> {
  const outputList = DataStore.teamspaces?.map((teamspace) => ({ id: teamspace.filename.split('/')[1], title: teamspace.title })) ?? []
  clo(outputList, 'getAllTeamspaceIDsAndTitles')
  return outputList
}

/**
 * Get the title of a teamspace from its ID.
 * @param {string} id - The ID of the teamspace.
 * @returns {string} The title of the teamspace (or 'Unknown Teamspace' if not found).
 */
export function getTeamspaceTitleFromID(id: string): string {
  const allTeamspaceTitles = getAllTeamspaceIDsAndTitles()
  return allTeamspaceTitles.find((teamspace) => teamspace.id === id)?.title ?? 'Unknown Teamspace'
}

export function getTeamspaceTitleFromNote(note: TNote): string {
  return note.teamspaceTitle ?? ''
}
