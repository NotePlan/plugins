// @flow

import { makeNoteTitleMatchFilename } from '../../helpers/makeNoteTitleMatchFilename'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'

/**
 * Renames the current note to match its title.
 * @returns void
 */
export async function filenameToTitle(): Promise<void> {
  try {
    const { note } = Editor

    if (note) {
      await makeNoteTitleMatchFilename(note)
    }
  } catch (error) {
    logError(error)
  }
}
