// @flow
//---------------------------------------------------------------
// Various open window/split functions for WindowTools plugin
// Jonathan Clark
// last update 2.1.2024 for v1.1.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@np/helpers/dev'
import { allNotesSortedByChanged } from '@np/helpers/note'
import { getNoteFromIdentifier } from '@np/helpers/NPnote'
import { findStartOfActivePartOfNote } from '@np/helpers/paragraph'
import { chooseNote } from '@np/helpers/userInput'

/**
 * Open a user-selected note in a new window.
 * If 'noteTitle' is passed use that; if that is empty, or can't be found, ask user instead.
 * Note: identifier will be unencoded, as it can be passed in through x-callback
 * @author @jgclark
 * @param {string} encodedNoteIdentifier: project note title, or date interval (e.g.'{-1d}'), or NotePlan's (internal) calendar date string. Will need to be 
 */
export async function openNoteNewWindow(encodedNoteIdentifier: string = ''): Promise<void> {
  try {
    let note: TNote | null
    if (encodedNoteIdentifier !== '') {
      note = getNoteFromIdentifier(decodeURIComponent(encodedNoteIdentifier))
    }
    // Ask for the note we want to open
    if (!note) {
      note = await chooseNote(true, true, [], 'Select note to open in new window', false)
    }
    if (note) {
      const filename = note.filename
      // work out where start of main content of the note is
      const startOfMainContentLine = findStartOfActivePartOfNote(note)
      const startOfMainContentCharIndex = (startOfMainContentLine > 0)
        ? note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
        : 0
      // open note, moving cursor to start of main content
      const res = await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)
    } else {
      logWarn(pluginJson, `openNoteNewWindow: Couldn't find note to open`)
    }
  } catch (err) {
    logError('openNoteNewWindow()', err.message)
  }
}

/**
 * Open a user-selected note in a new split of the main window.
 * If 'noteTitle' is passed use that; if that is empty, or can't be found, ask user instead.
 * Note: identifier will be unencoded, as it can be passed in through x-callback
 * @author @jgclark
 * @param {string} encodedNoteIdentifier: project note title, or date interval (e.g.'{-1d}'), or NotePlan's (internal) calendar date string. Will need to be 
 */
export async function openNoteNewSplit(encodedNoteIdentifier: string = ''): Promise<void> {
  try {
    let note: TNote | null
    if (encodedNoteIdentifier !== '') {
      note = getNoteFromIdentifier(decodeURIComponent(encodedNoteIdentifier))
    }
    // Ask for the note we want to open
    if (!note) {
      note = await chooseNote(true, true, [], 'Select note to open in new split window', false)
    }
    if (note) {
      const filename = note.filename
      // work out where start of main content of the note is
      const startOfMainContentLine = findStartOfActivePartOfNote(note)
      const startOfMainContentCharIndex = (startOfMainContentLine > 0)
        ? note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
        : 0
      // open note, moving cursor to start of main content
      const res = await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
    } else {
      logWarn(pluginJson, `openNoteNewSplit: Couldn't find note to open`)
    }
  } catch (err) {
    logError('openNoteNewSplit()', err.message)
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

