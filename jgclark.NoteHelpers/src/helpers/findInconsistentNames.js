// @flow

// import pluginJson from '../../plugin.json'
import { getSettings } from '../noteHelpers'
import { clo, logDebug, logWarn } from '@helpers/dev'
import { getRegularNotesInFolder } from '@helpers/note'
import { getFSSafeFilenameFromNoteTitle } from '@helpers/NPnote'

/**
 * Finds notes where the filename doesn't match what it should be based on the note's title.
 * For example, if a note has title "Meeting Notes" but filename "meeting-notes.md", this would be considered inconsistent.
 * 
 * @param {string} folder - Optional folder path to limit the search. If empty string or '/', checks all folders
 * @returns {Array<TNote>} Array of notes where the current filename differs from what it should be
 */
export async function findInconsistentNames(folder: string = ''): Promise<Array<TNote>> {
  // Work out what files to check, taking note of any folders to ignore
  const settings = await getSettings()
  const foldersToIgnoreSetting = settings.foldersToIgnore ?? ''
  const foldersToIgnore = foldersToIgnoreSetting.split(',').map((folder) => folder.trim())
  let filesToCheck = getRegularNotesInFolder(folder, foldersToIgnore, true)
  logDebug('findInconsistentNames', `Will check ${filesToCheck.length} notes in folder '${folder}' and its sub-folders, ignoring [${foldersToIgnore.join(', ')}] folders`)

  filesToCheck = filesToCheck
    .filter((note) => {
      const currentFullFilename = note.filename
      const idealFullFilename = getFSSafeFilenameFromNoteTitle(note)
      // return currentFullFilename !== idealFullFilename

      // Normalize both strings to handle accented characters consistently
      const normalizedCurrent = currentFullFilename.normalize('NFD')
      const normalizedIdeal = idealFullFilename.normalize('NFD')
      return normalizedCurrent !== normalizedIdeal
    })
    .sort()
  logDebug('findInconsistentNames', `Found ${filesToCheck.length} inconsistent notes:`)
  filesToCheck.forEach((note) => {
    logDebug('findInconsistentNames', `- ${note.filename} ${note.filename.length} ${note.filename.normalize('NFD')} // ${getFSSafeFilenameFromNoteTitle(note)} ${getFSSafeFilenameFromNoteTitle(note).length} ${getFSSafeFilenameFromNoteTitle(note).normalize('NFD')}`)
  })
  return filesToCheck
}
