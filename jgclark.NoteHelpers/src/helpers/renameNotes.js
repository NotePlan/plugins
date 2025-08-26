// @flow
// --------------------------------------------------------------
// Originally by Leo Melo, with bug fixes by @jgclark
// Last updated 2025-08-23 for v1.2.0 by @jgclark
// --------------------------------------------------------------

import pluginJson from '../../plugin.json'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  doesFilenameExistInFolderWithDifferentCase,
  doesFilenameHaveInvalidCharacters
} from '@helpers/folders'
import { getFSSafeFilenameFromNoteTitle } from '@helpers/NPnote'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { showMessage, showMessageYesNoCancel } from '@helpers/userInput'

/**
 * Renames a note to the title of the note.
 * Note: this cannot work on Calendar notes, or those in Teamspaces.
 * @param {Note} note - The note to rename.
 * @param {boolean} shouldPromptBeforeRenaming - Whether to prompt the user before renaming.
 * @returns {Promise<boolean>} - Whether the note was renamed.
 */
export async function renameNoteToTitle(
  note: Note,
  shouldPromptBeforeRenaming: boolean = true
): Promise<boolean> {
  try {
    if (note == null || note.paragraphs.length < 1) {
      // No note open, so don't do anything.
      logDebug(pluginJson, 'No note open, or no content. Stopping.')
      return false
    }
    // Won't work on Calendar notes
    if (note.type === 'Calendar') {
      throw new Error('Sorry, Calendar notes cannot be renamed.')
    }
    // Won't work on Teamspace notes
    const teamspaceDetailsFromFilename = parseTeamspaceFilename(note.filename)
    if (teamspaceDetailsFromFilename.isTeamspace) {
      throw new Error('Sorry, Teamspace notes cannot be renamed.')
    }

    const title = note.title
    const currentFilepath = note.filename
    let newFilepath = getFSSafeFilenameFromNoteTitle(note)

    if (newFilepath === '' || title === '') {
      // No title found, so don't do anything.
      logWarn(pluginJson, 'renameNoteToTitle(): No title found. Stopping.')
      return false
    }

    if (currentFilepath === newFilepath) {
      // No need to rename
      logDebug(pluginJson, 'renameNoteToTitle(): Current path is the same as the new path. Stopping.')
      await showMessage('The filename is already consistent with the note name.')
      return false
    }

    if (doesFilenameHaveInvalidCharacters(newFilepath)) {
      logWarn(pluginJson, `renameNoteToTitle(): Invalid filename "${newFilepath}". Stopping.`)
      throw new Error(`The filename "${newFilepath}" is not valid. Please check the title and try again.`)
    }

    // Check to see if the wanted filename already exists in the same folder.
    // If it does, append _1 etc. until we find a filename that doesn't exist.
    let testNewFilepath = newFilepath
    let i = 0
    while (doesFilenameExistInFolderWithDifferentCase(testNewFilepath)) {
      i++

      // Insert _${i} before the extension in the filename
      testNewFilepath = newFilepath.replace(/(\.[^./\\]+)$/, `_${i}$1`)
      logInfo(pluginJson, `The filename "${testNewFilepath}" already exists. Will try to rename to '${testNewFilepath}' instead.`)
    }
    newFilepath = testNewFilepath

    logInfo(pluginJson, `renameNoteToTitle(): New filename will be "${newFilepath}"`)

    if (shouldPromptBeforeRenaming) {
      const currentFilename = currentFilepath.split('/').pop()
      // $FlowIgnore[incompatible-type]
      const promptResponse = await showMessageYesNoCancel(`Would you like to rename "${currentFilename}" to match the note title "${title}"?

  Current path: ${currentFilepath}

  New path: ${newFilepath}
  `)

      if (promptResponse === 'Cancel') {
        logDebug(pluginJson, `renameNoteToTitle(): User cancelled`)
        return false
      } else if (promptResponse === 'No') {
        logDebug(pluginJson, 'renameNoteToTitle(): User chose not to rename.')
        return true
      }
    }

    // Rename the note
    const newFilename = note.rename(newFilepath)
    logDebug(pluginJson, `renameNoteToTitle(): ${currentFilepath} -> ${newFilename}`)
    return true
  } catch (err) {
    logError(pluginJson, `renameNoteToTitle(): ${err.message}`)
    await showMessage(err.message)
    return false
  }
}
