// @flow
//-----------------------------------------------------------------------------
// Functions to identify and fix where note names and their filenames are inconsistent.
// by Leo Melo, readied for the plugin and maintained by @jgclark
// Last updated 2025-09-14 for v1.2.1 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../../../plugin.json'
import { findInconsistentNames } from '../../helpers/findInconsistentNames'
import { renameNoteToTitle } from '../../helpers/renameNotes'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { chooseFolder, showMessage, showMessageWithList, showMessageYesNoCancel } from '@helpers/userInput'

/**
 * Renames all project notes with inconsistent names (i.e. where the note title and filename are different (apart from case)).
 * Optionally prompts the user before renaming each note.
 * Note: currently only works for private regular notes.
 */
export async function renameInconsistentNames(): Promise<void> {
  try {
    const directory = await chooseFolder('Choose a folder to rename inconsistent notes in', true, false, '', true, true) // exclude Teamspace notes

    if (!directory) {
      logWarn(pluginJson, 'renameInconsistentNames(): No folder chosen. Stopping.')
      return
    }

    logDebug(pluginJson, `renameInconsistentNames(): Chosen folder: ${directory}`)

    const inconsistentNames = await findInconsistentNames(directory, true)
    if (!Array.isArray(inconsistentNames) || inconsistentNames.length < 1) {
      logDebug(pluginJson, 'renameInconsistentNames(): No inconsistent names found. Stopping.')
      showMessage('No inconsistent names found. Well done!', 'OK', 'Rename inconsistent names')
      return
    }

    await showMessageWithList(`Found ${inconsistentNames.length} inconsistent names:`, inconsistentNames.map((note) => `- ${note.filename}`), 'OK', 'Rename inconsistent names')

    const response = await showMessageYesNoCancel(
      `Would you like to be prompted before renaming each of these note filenames?
      (If you choose 'No', the notes will be renamed automatically. 'Cancel' will stop the process.)`,
    )

    if (response === 'Cancel') {
      logDebug(pluginJson, 'renameInconsistentNames(): User chose to cancel.')
      return
    }

    const shouldPromptBeforeRenaming = response === 'Yes'

    for (const note of inconsistentNames) {
      const shouldContinue = await renameNoteToTitle(note, shouldPromptBeforeRenaming)
      if (!shouldContinue) {
        logDebug(pluginJson, 'renameInconsistentNames(): User chose to cancel.')
        return
      }
    }
  } catch (error) {
    logError(pluginJson, `renameInconsistentNames() error: ${error.message}`)
  }
}
