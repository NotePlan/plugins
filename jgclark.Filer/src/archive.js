// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 18.4.2023 for v1.1.0-beta
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings } from './filerHelpers'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'

//-----------------------------------------------------------------------------

/**
 * Add a 'blockId' to current line, and ask which note's heading (section)
 * to also add it to.
 */
export function archiveNoteUsingFolder(): string | void {
  try {
    const { note } = Editor
    if (!note) {
      // No note open, so don't do anything.
      logWarn(pluginJson, 'archiveNoteUsingFolder(): No note open, so stopping.')
      return
    } else if (note.type === 'Calendar') {
      // Can't archive a Calendar note
      logWarn(pluginJson, 'archiveNoteUsingFolder(): Cannot archive a Calendar note, so stopping.')
      return
    }
    logDebug(pluginJson, `archiveNoteUsingFolder(): starting for Note '${displayTitle(note)} created at ${String(note.createdDate)}`)

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
    const newFilename = DataStore.moveNote(currentFilename, archiveFolderToMoveTo)
    if (newFilename) {
      logDebug('archiveNoteUsingFolder', `- Note -> ${newFilename}`)

      // Check creation date hasn't changed. 
      // Good news: it doesn't change. TODO: remove next time.
      // const archivedNote = DataStore.projectNoteByFilename(newFilename)
      // const archivedNoteCreationDateStr = String(note.createdDate)
      // logDebug('archiveNoteUsingFolder', `- archivedNoteCreationDateStr: ${archivedNoteCreationDateStr}`)

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
