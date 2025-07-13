// @flow
//-----------------------------------------------------------------------------
// Functions to find notes where the filename doesn't match what it should be based on the note's title.
// by Leo Melo, readied for the plugin and maintained by @jgclark
// Last updated 2025-06-13 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

// import pluginJson from '../../plugin.json'
import { getSettings } from '../noteHelpers'
import { clo, logDebug, logWarn } from '@helpers/dev'
import { getRegularNotesInFolder } from '@helpers/folders'
import { getFSSafeFilenameFromNoteTitle } from '@helpers/NPnote'
import { caseInsensitiveMatch } from '@helpers/search'

/**
 * Finds notes where the filename doesn't match what it should be based on the note's title.
 * For example, if a note has title "Meeting Notes" but filename "meeting-notes 2.md", this would be considered inconsistent.
 * 
 * @param {string} folder - Optional folder path to limit the search. If empty string or '/', checks all folders
 * @param {boolean} ignoreCaseDifferences - Whether to ignore case differences when checking for inconsistencies (default: true)
 * @returns {Array<TNote>} Array of notes where the current filename differs from what it should be
 */
export async function findInconsistentNames(
  folder: string = '',
  ignoreCaseDifferences: boolean = true
): Promise<Array<TNote>> {
  // Work out what files to check, taking note of any folders to ignore
  const settings = await getSettings()
  const foldersToIgnoreSetting = settings.foldersToIgnore ?? ''
  const foldersToIgnore = foldersToIgnoreSetting.split(',').map((folder) => folder.trim())
  const filesToCheck = getRegularNotesInFolder(folder, foldersToIgnore, true)
  logDebug('findInconsistentNames', `Will check ${filesToCheck.length} notes in folder '${folder}' and its sub-folders, ignoring [${foldersToIgnore.join(', ')}] folders`)

  const inconsistentFiles = filesToCheck
    .filter((note) => {
      const currentFullFilename = note.filename
      const idealFullFilename = getFSSafeFilenameFromNoteTitle(note)

      // Normalize both strings to handle accented characters consistently      
      const normalizedCurrent = currentFullFilename.normalize('NFD')
      const normalizedIdeal = idealFullFilename.normalize('NFD')
      if (ignoreCaseDifferences) {
        // Note: don't use simple toLowerCase() here, as it breaks in some languages (e.g. Turkish)
        return !caseInsensitiveMatch(normalizedCurrent, normalizedIdeal)
      }
      else {
        return normalizedCurrent !== normalizedIdeal
      }
    })
    .sort()
  logDebug('findInconsistentNames', `Found ${inconsistentFiles.length} inconsistent notes:`)
  inconsistentFiles.forEach((note) => {
    logDebug('findInconsistentNames', `- ${note.filename} // ${getFSSafeFilenameFromNoteTitle(note).normalize('NFD')}`)
  })
  return inconsistentFiles
}
