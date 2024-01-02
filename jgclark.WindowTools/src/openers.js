// @flow
//---------------------------------------------------------------
// Various open window/split functions for WindowTools plugin
// Jonathan Clark
// last update 2.1.2024 for v1.0.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { allNotesSortedByChanged } from '@helpers/note'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { chooseNote } from '@helpers/userInput'

/**
 * Open a user-selected note in a new window.
 * @author @jgclark
 */
export async function openNoteNewWindow(): Promise<void> {
  try {
    // Ask for the note we want to open
    const notes = allNotesSortedByChanged()
    // const re = await CommandBar.showOptions(
    //   notes.map((n) => displayTitle(n)),
    //   'Select note to open in new window',
    // )
    // const note = notes[re.index]
    const note = await chooseNote(true, true, [], 'Select note to open in new window', false)
    if (note) {
      const filename = note.filename
      // work out where start of main content of the note is
      const startOfMainContentLine = findStartOfActivePartOfNote(note)
      const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
      // open note, moving cursor to start of main content
      const res = await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)
    }
  } catch (e) {
    logError('openNoteNewWindow()', e.message)
  }
}

/**
 * Open a user-selected note in a new split of the main window.
 * Note: uses API option only available on macOS and from v3.4.
 * It falls back to opening in a new window on unsupported versions.
 * @author @jgclark
 */
export async function openNoteNewSplit(): Promise<void> {
  try {
    // Ask for the note we want to open
    // const notes = allNotesSortedByChanged()
    // const re = await CommandBar.showOptions(
    //   notes.map((n) => displayTitle(n)),
    //   'Select note to open in new split window',
    // )
    // const note = notes[re.index]
    const note = await chooseNote(true, true, [], 'Select note to open in new split window', false)
    if (note) {
      const filename = note.filename
      // work out where start of main content of the note is
      const startOfMainContentLine = findStartOfActivePartOfNote(note)
      const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
      // open note, moving cursor to start of main content
      const res = await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
    }
  } catch (e) {
    logError('openNoteNewSplit()', e.message)
  }
}

/**
 * Open the current note in a new split of the main window.
 * @author @jgclark
 */
export async function openCurrentNoteNewSplit(): Promise<void> {
  try {
    const { note, filename } = Editor
    if (note == null || filename == null) {
      // No note open, so don't do anything.
      logError('openCurrentNoteNewSplit()', 'No note open. Stopping.')
      return
    }
    // work out where start of main content of the note is
    const startOfMainContentLine = findStartOfActivePartOfNote(note)
    const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
    // open note, moving cursor to start of main content
    await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
  } catch (e) {
    logError('openCurrentNoteNewSplit()', e.message)
  }
}

/**
 * Open the current note in a new floating window.
 * @author @jgclark
 */
export async function openCurrentNoteNewWindow(): Promise<void> {
  try {
    const { note, filename } = Editor
    if (note == null || filename == null) {
      // No note open, so don't do anything.
      logError('openCurrentNoteNewSplit()', 'No note open. Stopping.')
      return
    }
    // work out where start of main content of the note is
    const startOfMainContentLine = findStartOfActivePartOfNote(note)
    const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
    // open note, moving cursor to start of main content
    await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)
  } catch (e) {
    logError('openCurrentNoteNewSplit()', e.message)
  }
}

