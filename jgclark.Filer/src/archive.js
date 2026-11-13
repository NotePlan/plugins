// @flow
// ----------------------------------------------------------------------------
// Smarter archiving commands, part of Filer plugin
// Jonathan Clark
// last updated 2026-11-13 for v1.7.0, by @CursorAI
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { reportFiler, resolveNoteArgument } from './filerHelpers'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteFromEditorWindow } from '@helpers/NPEditor'
import { archiveNoteUsingFolder, isNoteAlreadyUnderArchiveRoot } from '@helpers/NPnote'

//-----------------------------------------------------------------------------

/**
 * Archive a note using its current folder, replicating the folder structure if needed. If no TNote object is passed in, then archive the note in the open Editor.
 * If 'archiveRootFolder' is supplied, archive under that folder, otherwise default to the built-in @Archive folder.
 * A string `noteIn` (including '') is an x-callback or template argument: no dialogs. A TNote keeps the dialogs used by in-plugin callers.
 * @param {TNote | string} noteIn optional note object, or a filename / title / date phrase. Empty string uses the open Editor note.
 * @param {string?} archiveRootFolder optional; empty or omitted uses the built-in @Archive folder
 * @returns {?string} newFilename, if success
 */
export async function archiveNote(noteIn?: TNote | string, archiveRootFolder?: string): Promise<?string> {
  try {
    let fromXCallback = false
    // An empty folder argument means the default @Archive root.
    const archiveRoot = typeof archiveRootFolder === 'string' && archiveRootFolder.trim() === '' ? undefined : archiveRootFolder
    let note: CoreNoteFields | null
    if (noteIn && (typeof noteIn === "object")) {
      // A note was passed in, so use it
      note = noteIn
      logDebug('archiveNote', `Note passed in: ${note.filename}`)
    } else if (typeof noteIn === 'string') {
      fromXCallback = true
      logInfo(pluginJson, `archiveNote(): x-callback note '${noteIn}', archive root '${archiveRoot ?? '@Archive'}'`)
      note = resolveNoteArgument(noteIn)
    } else {
      logDebug(pluginJson, `archiveNote(): starting for note open in Editor`)
      note = getNoteFromEditorWindow(Editor) ?? null
    }
    if (!note) {
      const named = fromXCallback && typeof noteIn === 'string' && noteIn.trim() !== ''
      throw new Error(named ? `Couldn't find note '${String(noteIn)}', so stopping.` : "Couldn't get note, so stopping.")
    }
    if (isNoteAlreadyUnderArchiveRoot(note.filename, archiveRoot)) {
      const root = (archiveRoot ?? '').trim()
      const where = root.length === 0 || root === '@Archive' ? 'the Archive' : `'${root}'`
      await reportFiler(!fromXCallback, `'${displayTitle(note)}' is already in ${where}, so cannot archive it.`, 'Archive Note', 'OK, thanks')
      return null
    }
    const newFilename = archiveNoteUsingFolder(note, archiveRoot)
    if (newFilename) {
      logInfo(pluginJson, `archiveNote(): '${displayTitle(note)}' -> ${newFilename}`)
      logDebug('archiveNote', `- Note -> ${newFilename}`)
      return newFilename
    } else {
      await reportFiler(!fromXCallback, `Failed to move '${displayTitle(note)}' to the Archive. Please see log for details.`, 'Archive Note', 'OK, thanks')
      throw new Error(`Failed when archiving '${displayTitle(note)}' to ${archiveRoot ?? '@Archive'} folder.`)
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
 * A string `noteIn` (including '') is an x-callback or template argument: no dialogs. A TNote keeps the dialogs used by in-plugin callers.
 * @param {TNote | string} noteIn optional note object, or a filename / title / date phrase. Empty string uses the open Editor note.
 * @returns {?string} newFilename, if success
 */
export async function unarchiveNote(noteIn?: TNote | string): Promise<?string> {
  try {
    let fromXCallback = false
    let note: CoreNoteFields | null
    if (noteIn && (typeof noteIn === 'object')) {
      // A note was passed in, so use it
      note = noteIn
      logDebug('unarchiveNote', `Note passed in: ${note.filename}`)
    } else if (typeof noteIn === 'string') {
      fromXCallback = true
      logInfo(pluginJson, `unarchiveNote(): x-callback note '${noteIn}'`)
      note = resolveNoteArgument(noteIn)
    } else {
      logDebug(pluginJson, `unarchiveNote(): starting for note open in Editor`)
      note = getNoteFromEditorWindow(Editor) ?? null
    }
    if (!note) {
      const named = fromXCallback && typeof noteIn === 'string' && noteIn.trim() !== ''
      throw new Error(named ? `Couldn't find note '${String(noteIn)}', so stopping.` : "Couldn't get note, so stopping.")
    }
    if (note.type === 'Calendar') {
      logWarn(pluginJson, 'unarchiveNote(): Cannot unarchive a Calendar note, so stopping.')
      return null
    }

    const currentFilename = note.filename
    if (!currentFilename.startsWith('@Archive/')) {
      await reportFiler(!fromXCallback, `'${displayTitle(note)}' is not in the Archive, so cannot unarchive it.`, 'Unarchive Note', 'OK, thanks')
      throw new Error(`'${displayTitle(note)}' is not in @Archive, so cannot unarchive it.`)
    }

    const filenameWithoutArchive = currentFilename.replace(/^@Archive\//, '')
    const destinationFolder = filenameWithoutArchive.includes('/') ? filenameWithoutArchive.split('/').slice(0, -1).join('/') : ''
    const newFilename = DataStore.moveNote(currentFilename, destinationFolder)
    if (newFilename) {
      logInfo(pluginJson, `unarchiveNote(): '${displayTitle(note)}' -> ${newFilename}`)
      logDebug('unarchiveNote', `- Note -> ${newFilename}`)
      return newFilename
    } else {
      await reportFiler(!fromXCallback, `Failed to move '${displayTitle(note)}' out of the Archive. Please see log for details.`, 'Unarchive Note', 'OK, thanks')
      throw new Error(`unarchiveNote(): Failed when unarchiving '${displayTitle(note)}' from @Archive`)
    }
  }
  catch (error) {
    logError(pluginJson, `unarchiveNote(): ${JSP(error)}`)
    return null
  }
}
