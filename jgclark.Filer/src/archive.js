// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 2026-05-01 for v1.6.0, by @Cursor & @jgclark
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { clo, JSP, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { archiveNoteUsingFolder } from '@helpers/NPnote'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Archive a note using its current folder, replicating the folder structure if needed. If no TNote object is passed in, then archive the note in the open Editor.
 * If 'archiveRootFolder' is supplied, archive under that folder, otherwise default to the built-in @Archive folder.
 * @param {TNote?} noteIn optional; if not given, then use the open Editor's note)
 * @param {string?} archiveRootFolder optional; if not given, then use the built-in @Archive folder)
 * @returns {?string} newFilename, if success
 */
export async function archiveNote(noteIn?: TNote, archiveRootFolder?: string): ?string {
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
      const _res = await showMessage(`Failed to move '${displayTitle(note)}' to the Archive. Please see log for details.`, 'OK, thanks', 'Archive Note')
      throw new Error(`Failed when archiving '${displayTitle(note)}' to ${archiveRootFolder ?? '@Archive'} folder.`)
    }
  }
  catch (error) {
    logError(pluginJson, `archiveNote(): ${JSP(error)}`)
    return null
  }
}

/**
 * Unarchive a note by moving it out of the special @Archive folder and restoring
 * its original folder path. If no TNote object is passed in, then unarchive
 * the note in the open Editor.
 * @param {TNote?} noteIn optional; if not given, then use the open Editor's note)
 * @returns {?string} newFilename, if success
 */
export async function unarchiveNote(noteIn?: TNote): ?string {
  try {
    let note: TNote | null
    if (noteIn && (typeof noteIn === 'object')) {
      // A note was passed in, so use it
      note = noteIn
      logDebug('unarchiveNote', `Note passed in: ${note.filename}`)
    } else {
      logDebug(pluginJson, `unarchiveNote(): starting for note open in Editor`)
      note = Editor.note ?? null
    }
    if (!note) {
      throw new Error("Couldn't get note, so stopping.")
    }
    if (note.type === 'Calendar') {
      logWarn(pluginJson, 'unarchiveNote(): Cannot unarchive a Calendar note, so stopping.')
      return null
    }

    const currentFilename = note.filename
    if (!currentFilename.startsWith('@Archive/')) {
      const _res = await showMessage(`'${displayTitle(note)}' is not in the Archive, so cannot unarchive it.`, 'OK, thanks', 'Unarchive Note')
      throw new Error(`'${displayTitle(note)}' is not in @Archive, so cannot unarchive it.`)
    }

    const filenameWithoutArchive = currentFilename.replace(/^@Archive\//, '')
    const destinationFolder = filenameWithoutArchive.includes('/') ? filenameWithoutArchive.split('/').slice(0, -1).join('/') : ''
    const newFilename = DataStore.moveNote(currentFilename, destinationFolder)
    if (newFilename) {
      logDebug('unarchiveNote', `- Note -> ${newFilename}`)
      return newFilename
    } else {
      throw new Error(`unarchiveNote(): Failed when unarchiving '${displayTitle(note)}' from @Archive`)
    }
  }
  catch (error) {
    logError(pluginJson, `unarchiveNote(): ${JSP(error)}`)
    return null
  }
}
