// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 2025-09-06 for v1.3.2
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { archiveNoteUsingFolder } from '@helpers/NPnote'

//-----------------------------------------------------------------------------

/**
 * Archive a note using its current folder, replicating the folder structure if needed. If no TNote object is passed in, then archive the note in the open Editor.
 * If 'archiveRootFolder' is supplied, archive under that folder, otherwise default to the built-in @Archive folder.
 * @param {TNote?} noteIn optional; if not given, then use the open Editor's note)
 * @param {string?} archiveRootFolder optional; if not given, then use the built-in @Archive folder)
 * @returns {?string} newFilename, if success
 */
export function archiveNote(noteIn?: TNote, archiveRootFolder?: string): ?string {
  try {
    let note: TNote | null
    if (noteIn && (typeof noteIn === "object")) {
      // A note was passed in, so use it
      note = noteIn
      logDebug('archiveNote', `Note passed in: ${note.filename}`)
    } else {
      logDebug(pluginJson, `archiveNote(): starting for note open in Editor`)
      note = Editor.note ?? null
    }
    if (!note) {
      throw new Error("Couldn't get note, so stopping.")
    }
    const newFilename = archiveNoteUsingFolder(note, archiveRootFolder)
    if (newFilename) {
      logDebug('archiveNote', `- Note -> ${newFilename}`)
      return newFilename
    } else {
      throw new Error(`archiveNote(): Failed when archiving '${displayTitle(note)}' to ${archiveRootFolder ?? '@Archive'}`)
    }
  }
  catch (error) {
    logError(pluginJson, `archiveNote(): ${error.message}`)
    return null
  }
}
