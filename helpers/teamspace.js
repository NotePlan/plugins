// @flow
//-------------------------------------------------------------------------------
// Functions that help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'
import { RE_DAILY_NOTE_FILENAME, RE_WEEKLY_NOTE_FILENAME, RE_MONTHLY_NOTE_FILENAME, RE_QUARTERLY_NOTE_FILENAME, RE_YEARLY_NOTE_FILENAME } from './dateTime'

//-----------------------------------------------------------
// CONSTANTS

export const TEAMSPACE_FA_ICON = 'fa-regular fa-screen-users'

// Match the filename for a Teamspace note (updated for v3.17.0)
// Note: should really be using NotePlan.environment.teamspaceFilenamePrefix as part of the regex, but this needs to be available where NotePlan.environment is not available.
export const RE_TEAMSPACE_NOTE_FILEPATH: RegExp = new RegExp(`^%%NotePlanCloud%%\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/`, 'i')
export const RE_TEAMSPACE_NOTE_FILENAME: RegExp = new RegExp(`/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/`, 'i')

//-----------------------------------------------------------
// FUNCTIONS

/**
 * Check whether a filename is a Teamspace note.
 * @param {string} filenameIn - The full filename to check
 * @returns {boolean}
 */
export function isTeamspaceNoteFromFilename(filenameIn: string): boolean {
  const match = filenameIn.match(RE_TEAMSPACE_NOTE_FILEPATH)
  return match !== null
}

/**
 * Check whether a filename is from a teamspace note and extract the relevant parts.
 * If it is not a teamspace note, then return the filename unchanged.
 * The meaning of the returned object's fields:
 * - filename: the full filename of the note (but without any Teamspace ID)
 * - filepath: the filepath of the note, without the filename or Teamspace ID. Doesn't include trailing '/', except for the root folder.
 * - isTeamspace: true if the note is a Teamspace note, false otherwise
 * - teamspaceID: the ID of the teamspace if the note is a Teamspace note, undefined otherwise
 * Note: this deliberately doesn't use DataStore.* calls; another simpler function could be written that does.
 * Note: 'filename' is a rather odd thing for Teamspace regular notes: they are just are a UUID, without file extension
 * @param {string} filenameIn - The full filename to check
 * @returns {{ filename: string, filepath: string, isTeamspace: boolean, teamspaceID?: string }}
 */
export function parseTeamspaceFilename(filenameIn: string): { filename: string, filepath: string, isTeamspace: boolean, teamspaceID?: string } {

  const possibleTeamspaceFilename = filenameIn.match(RE_TEAMSPACE_NOTE_FILEPATH)
  // Get the part after the last '/'
  const lastPartOfFilename = filenameIn.substring(filenameIn.lastIndexOf('/') + 1)
  // Note: could use DataStore.noteByFilename(filenameIn, 'Calendar'), and then note.type, but this method doesn't require a DataStore call
  const isCalendarNote = new RegExp(RE_DAILY_NOTE_FILENAME).test(lastPartOfFilename)
    || new RegExp(RE_WEEKLY_NOTE_FILENAME).test(lastPartOfFilename)
    || new RegExp(RE_MONTHLY_NOTE_FILENAME).test(lastPartOfFilename)
    || new RegExp(RE_QUARTERLY_NOTE_FILENAME).test(lastPartOfFilename)
    || new RegExp(RE_YEARLY_NOTE_FILENAME).test(lastPartOfFilename)

  if (possibleTeamspaceFilename) {
    const teamspaceID = possibleTeamspaceFilename[1]
    // Get everything after the second '/'
    const afterSecondSlash = filenameIn.split('/').slice(2).join('/')

    if (isCalendarNote) {
      const filename = afterSecondSlash
      logDebug('parseTeamspaceFilename', `Teamspace filename: ${filename} / teamspaceID: ${teamspaceID} (from ${filenameIn})`)
      return { filename: filename, filepath: '', isTeamspace: true, teamspaceID }
    } else {
      // The final part of the filename is just a UUID, though you can get folder names before it.
      const filepath = afterSecondSlash.replace(lastPartOfFilename, '')
      let filepathToUse = (filepath.endsWith('/')) ? filepath.slice(0, filepath.length - 1) : filepath
      filepathToUse = filepathToUse !== '' ? filepathToUse : '/'
      return { filename: afterSecondSlash, filepath: filepathToUse, isTeamspace: true, teamspaceID }
    }
  } else {
    // logDebug('parseTeamspaceFilename', `filename ${filenameIn} is not a teamspace note`)
    const lastPartOfFilename = filenameIn.substring(filenameIn.lastIndexOf('/') + 1)
    const filepath = filenameIn.replace(lastPartOfFilename, '')
    let filepathToUse = (filepath.endsWith('/')) ? filepath.slice(0, filepath.length - 1) : filepath
    filepathToUse = filepathToUse !== '' ? filepathToUse : '/'
    return { filename: filenameIn, filepath: filepathToUse, isTeamspace: false }
  }
}
