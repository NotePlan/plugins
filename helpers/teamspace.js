// @flow
//-------------------------------------------------------------------------------
// Functions that help us with Teamspace notes
// @jgclark except where shown
//-------------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'
import { RE_DAILY_NOTE_FILENAME, RE_WEEKLY_NOTE_FILENAME, RE_MONTHLY_NOTE_FILENAME, RE_QUARTERLY_NOTE_FILENAME, RE_YEARLY_NOTE_FILENAME } from './dateTime'

//-----------------------------------------------------------
// CONSTANTS

// Match the filename for a Teamspace note (updated for v3.17.0)
// Note: should really be using NotePlan.environment.teamspaceFilenamePrefix as part of the regex, but this needs to be available where NotePlan.environment is not available.
// Following moved from teamspace.js to regex.js to avoid circular dependency
import { RE_TEAMSPACE_INDICATOR_AND_ID, RE_UUID } from './regex'

export const TEAMSPACE_FA_ICON = 'fa-regular fa-screen-users'

//-----------------------------------------------------------
// FUNCTIONS

/**
 * Check whether a filename is a Teamspace note.
 * @param {string} filenameIn - The full filename to check
 * @returns {boolean}
 */
export function isTeamspaceNoteFromFilename(filenameIn: string): boolean {
  const match = filenameIn.match(RE_TEAMSPACE_INDICATOR_AND_ID)
  return match !== null
}

/**
 * Remove the Teamspace ID from a filename, if it has one, and any leading slash.
 * Note: Deliberately not using DataStore calls.
 * @author @jgclark
 * @tests in jest file teamspace.test.js
 * 
 * @param {string} filenameIn
 * @returns {string} filename without Teamspace ID
 */
export function getFilenameWithoutTeamspaceID(filenameIn: string): string {
  const possibleTeamspaceFilename = filenameIn.match(RE_TEAMSPACE_INDICATOR_AND_ID)
  if (possibleTeamspaceFilename) {
    let filenameWithoutTeamspaceID = filenameIn.replace(possibleTeamspaceFilename[0], '')
    // If it starts with a slash, remove it
    if (filenameWithoutTeamspaceID.startsWith('/')) {
      filenameWithoutTeamspaceID = filenameWithoutTeamspaceID.slice(1)
    }
    return filenameWithoutTeamspaceID
  } else {
    return filenameIn
  }
}

/**
 * Return just the Teamspace ID from a filename, if it has one.
 * Note: Deliberately not using DataStore calls.
 * @author @jgclark
 * @tests in jest file teamspace.test.js
 * 
 * @param {string} filenameIn
 * @returns {string} filename without Teamspace ID
 */
export function getTeamspaceIDFromFilename(filenameIn: string): string {
  const possibleTeamspaceMatches = filenameIn.match(RE_TEAMSPACE_INDICATOR_AND_ID)
  if (possibleTeamspaceMatches) {
    return possibleTeamspaceMatches[1]
  } else {
    return ''
  }
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
 * Note: 'filename' is a rather odd thing for Teamspace regular notes: they are just are a UUID, without file extension, but with possible sub-folder path just before it.
 * Note: also works for Teamspace folder paths, returned from `DataStore.folders` call.
 * @author @jgclark
 * @tests in jest file teamspace.test.js
 * 
 * @param {string} filenameIn - The full filename to check
 * @returns {{ filename: string, filepath: string, isTeamspace: boolean, teamspaceID?: string }}
 */
export function parseTeamspaceFilename(filenameIn: string): { filename: string, filepath: string, isTeamspace: boolean, teamspaceID?: string } {

  const possibleTeamspaceFilename = filenameIn.match(RE_TEAMSPACE_INDICATOR_AND_ID)
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
      // logDebug('parseTeamspaceFilename', `Teamspace filename: ${afterSecondSlash} / teamspaceID: ${teamspaceID} (from ${filenameIn})`)
      return { filename: afterSecondSlash, filepath: '', isTeamspace: true, teamspaceID }
    } else {
      // The final part of the filename is just a UUID, though you can get (sub)folder names before it.
      const noteFilenamePart = (RE_UUID.test(lastPartOfFilename))
        ? lastPartOfFilename : ''
      // logDebug('parseTeamspaceFilename', `noteFilenamePart: ${noteFilenamePart} / lastPartOfFilename: ${lastPartOfFilename} / afterSecondSlash: ${afterSecondSlash}`)
      const filepath = (noteFilenamePart === lastPartOfFilename)
        ? afterSecondSlash.replace(lastPartOfFilename, '')
        : afterSecondSlash // deals where filenameIn is a folder path
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
