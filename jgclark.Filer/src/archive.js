// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 18.4.2023 for v1.1.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings } from './filerHelpers'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'

//-----------------------------------------------------------------------------

/**
 * Archive a note using its current folder, replicating the folder structure if needed.
 * @param {TNote?} noteIn (optional)
 * @returns {string | void} newFilename, if success
 */
export function archiveNoteUsingFolder(noteIn?: TNote): string | void {
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
    const archiveFolderToMoveTo = '@Archive/' + currentFolder
    logDebug('archiveNoteUsingFolder', `- archiveFolderToMoveTo: ${archiveFolderToMoveTo}`)

    // Check if this folder structure is already set up under @Archive

    // Use DataStore.createFolder to create these folders

    // Move note to this new location.
    // (Handily, NP does the work of creating any necessary missing folders.)
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
