// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 2024-10-07 for v1.1.0+
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFolderFromFilename } from '@np/helpers/folders'
import { logDebug, logError, logWarn } from '@np/helpers/dev'
import { displayTitle } from '@np/helpers/general'

//-----------------------------------------------------------------------------

/**
 * Archive a note using its current folder, replicating the folder structure if needed. If no TNote object is passed in, then archive the note in the open Editor.
 * Added 'archiveRootFolder', which if supplied, archives under that folder, otherwise defaults to the special @Archive folder.
 * TODO: As this is used by Filer and Reviews plugins, this should be moved to helpers/NPnote.js
 * @param {TNote?} noteIn (optional)
 * @returns {string | void} newFilename, if success
 * @returns {string?} archiveRootFolder (optional)
 */
export function archiveNoteUsingFolder(noteIn?: TNote, archiveRootFolder?: string): string | void {
  try {
    let note: TNote | null
    if (noteIn && (typeof noteIn === "object")) {
      // A note was passed in, so use it
      note = noteIn
      logDebug('archiveNoteUsingFolder', `Note passed in: ${note.filename}`)
    } else {
      logDebug(pluginJson, `archiveNoteUsingFolder(): starting for note open in Editor`)
      note = Editor.note ?? null
    }

    if (!note) {
      // No note open, so don't do anything.
      logWarn(pluginJson, 'archiveNoteUsingFolder(): No note passed or open in the Editor, so stopping.')
      return
    } else if (note.type === 'Calendar') {
      // Can't archive a Calendar note
      logWarn(pluginJson, 'archiveNoteUsingFolder(): Cannot archive a Calendar note, so stopping.')
      return
    }
    logDebug('archiveNoteUsingFolder', `- will archive Note '${displayTitle(note)} created at ${String(note.createdDate)}`)

    // Get note's current folder
    const currentFilename = note.filename
    const currentFolder = getFolderFromFilename(currentFilename)
    logDebug('archiveNoteUsingFolder', `- currentFolder: ${currentFolder}`)
    // Work out requested archived filename
    const archiveFolderToMoveTo = archiveRootFolder ? `${archiveRootFolder}/${currentFolder}` : `@Archive/${currentFolder}`
    logDebug('archiveNoteUsingFolder', `- archiveFolderToMoveTo: ${archiveFolderToMoveTo}`)

    // Check if this folder structure is already set up under @Archive

    // Move note to this new location.
    // (Handily, NP does the work of creating any necessary missing folders. No need to use DataStore.moveFolder here.)
    // Good news: creation date now doesn't change here
    const newFilename = DataStore.moveNote(currentFilename, archiveFolderToMoveTo)
    if (newFilename) {
      logDebug('archiveNoteUsingFolder', `- Note -> ${newFilename}`)
      return newFilename
    } else {
      throw new Error(`archiveNoteUsingFolder(): Failed when moving '${displayTitle(note)}' to folder ${archiveFolderToMoveTo}`)
    }
  }
  catch (error) {
    logError(pluginJson, error.message)
    return
  }
}
