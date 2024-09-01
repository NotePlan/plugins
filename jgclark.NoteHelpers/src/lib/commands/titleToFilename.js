// @flow

import { renameNoteToTitle } from '../../helpers/renameNotes'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'

/**
 * Renames the current note to match its title.
 * @returns void
 */
export async function titleToFilename(): Promise<void> {
  try {
    const { note } = Editor

    if (note) {
      await renameNoteToTitle(note)
    }
  } catch (error) {
    logError(error)
  }
}
