// @flow
//---------------------------------------------------------------
// Various open window/split functions for WindowTools plugin
// Jonathan Clark
// last update 2025-11-30 for v1.5.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getPluginSettings } from './WTHelpers'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { chooseNoteV2, getNoteFromIdentifier } from '@helpers/NPnote'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { openNoteInNewWindow } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'

/**
 * Open a user-selected note in a new window.
 * If 'noteTitle' is passed use that; if that is empty, or can't be found, ask user instead.
 * Note: identifier will be unencoded, as it can be passed in through x-callback
 * @author @jgclark
 * @param {string} encodedNoteIdentifier: project note title, or date interval (e.g.'{-1d}'), or NotePlan's (internal) calendar date string. Will need to be 
 */
export async function openNoteNewWindow(encodedNoteIdentifier: string = ''): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      await showMessage(`This command can only run on macOS. Stopping.`, 'OK', 'Error')
      return
    }
    let note: ?TNote
    if (encodedNoteIdentifier !== '') {
      note = getNoteFromIdentifier(decodeURIComponent(encodedNoteIdentifier))
    }
    // Ask for the note we want to open
    if (!note) {
      note = await chooseNoteV2(`Select note to open in new window`, DataStore.projectNotes, true, true, false, true)
    }
    if (note) {
      const filename = note.filename
      const config = await getPluginSettings()

      // Up to v1.2.x ...
      // work out where start of main content of the note is
      // const startOfMainContentLine = findStartOfActivePartOfNote(note)
      // const startOfMainContentCharIndex = (startOfMainContentLine > 0)
      //   ? note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
      //   : 0
      // open note, moving cursor to start of main content
      // const res = await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)

      // From v1.5.0 ...
      // open note, using smart features to place the window on the screen
      if (config.useSmartPlacement) {
        const res = await openNoteInNewWindow(filename, config.defaultEditorWidth ?? 0, false, true)
      } else {
        const res = await openNoteInNewWindow(filename, config.defaultEditorWidth ?? 0, true, false)
      }
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
    if (NotePlan.environment.platform !== 'macOS') {
      await showMessage(`This command can only run on macOS. Stopping.`, 'OK', 'Error')
      return
    }
    let note: ?TNote
    if (encodedNoteIdentifier !== '') {
      note = getNoteFromIdentifier(decodeURIComponent(encodedNoteIdentifier))
    }
    // Ask for the note we want to open
    if (!note) {
      note = await chooseNoteV2(`Select note to open in new split window`, DataStore.projectNotes, true, true, false, true)
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
    if (NotePlan.environment.platform !== 'macOS') {
      await showMessage(`This command can only run on macOS. Stopping.`, 'OK', 'Error')
      return
    }
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
    if (NotePlan.environment.platform !== 'macOS') {
      await showMessage(`This command can only run on macOS. Stopping.`, 'OK', 'Error')
      return
    }
    const { note, filename } = Editor
    if (note == null || filename == null) {
      // No note open, so don't do anything.
      logError('openCurrentNoteNewSplit()', 'No note open. Stopping.')
      return
    }
    const config = await getPluginSettings()
    // Up to v1.2.x ...
    // work out where start of main content of the note is
    // const startOfMainContentLine = findStartOfActivePartOfNote(note)
    // const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
    // open note, moving cursor to start of main content
    // await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)

    // From v1.5.0 ...
    // open note, using smart features to place the window on the screen
    if (config.useSmartPlacement) {
      const res = await openNoteInNewWindow(filename, config.defaultEditorWidth ?? 0, false, true)
    } else {
      const res = await openNoteInNewWindow(filename, config.defaultEditorWidth ?? 0, true, false)
    }
  } catch (err) {
    logError('openCurrentNoteNewWindow()', err.message)
  }
}
