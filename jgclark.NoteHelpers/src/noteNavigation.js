// @flow
//-----------------------------------------------------------------------------
// Navigation functions for Note Helpers plugin for NotePlan
// Jonathan Clark
// Last updated 12.6.2023 for v0.17.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings } from './noteHelpers'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getParaFromContent, findStartOfActivePartOfNote } from '@helpers/paragraph'
import {
  chooseHeading,
  showMessage
} from '@helpers/userInput'
import { findURLsInNote, findURLsInText, type LinkObject } from '@helpers/urls'

//-----------------------------------------------------------------

/**
 * Open a user-selected note in a new window.
 * @author @jgclark
 */
export async function openNoteNewWindow(): Promise<void> {
  try {
    // Ask for the note we want to open
    const notes = allNotesSortedByChanged()
    const re = await CommandBar.showOptions(
      notes.map((n) => displayTitle(n)),
      'Select note to open in new window',
    )
    const note = notes[re.index]
    const filename = note.filename
    // work out where start of main content of the note is
    const startOfMainContentLine = findStartOfActivePartOfNote(note)
    const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
    // open note, moving cursor to start of main content
    await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)
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
    const notes = allNotesSortedByChanged()
    const re = await CommandBar.showOptions(
      notes.map((n) => displayTitle(n)),
      'Select note to open in new split window',
    )
    const note = notes[re.index]
    const filename = note.filename
    // work out where start of main content of the note is
    const startOfMainContentLine = findStartOfActivePartOfNote(note)
    const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
    // open note, moving cursor to start of main content
    await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
  } catch (e) {
    logError('openNoteNewSplit()', e.message)
  }
}

/**
 * Open the current note in a new split of the main window.
 * Note: uses API option only available on macOS and from v3.4.
 * It falls back to opening in a new window on unsupported versions.
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
 * Jumps the cursor to the heading of the current note that the user selects
 * @author @jgclark
 * @param {?string} heading to jump to
 */
export async function jumpToHeading(heading?: string): Promise<void> {
  try {
    const { paragraphs, note } = Editor
    if (note == null || paragraphs == null) {
      // No note open, or no content
      return
    }

    const headingStr = heading ?? (await chooseHeading(note, false, false, true))
    // find out position of this heading, ready to set insertion point
    // (or 0 if it can't be found)
    const startPos = getParaFromContent(note, headingStr)?.contentRange?.start ?? 0
    logDebug('noteHelpers / jumpToHeading', `for '${headingStr}' at position ${startPos} max ${String(note.content?.length)}`)
    Editor.select(startPos, 0)
  } catch (e) {
    logError('jumpToHeading()', e.message)
  }
}

/**
 * Jumps the cursor to the heading of the current note that the user selects
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export async function jumpToNoteHeading(): Promise<void> {
  try {
    // first jump to the note of interest, then to the heading
    const notesList = allNotesSortedByChanged()
    const re = await CommandBar.showOptions(
      notesList.map((n) => displayTitle(n)),
      'Select note to jump to',
    )
    const note = notesList[re.index]

    // Open the note in the Editor
    if (note != null && note.title != null) {
      await Editor.openNoteByTitle(note.title)
    } else {
      logError("Couldn't open selected note")
      return
    }

    // Now jump to the heading
    await jumpToHeading()
  } catch (e) {
    logError('jumpToNoteHeading()', e.message)
  }
}

/**
 * Jump cursor to the '## Done' heading in the current file
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export function jumpToDone(): void {
  try {
    const paras = Editor?.paragraphs
    if (paras == null) {
      // No note open
      return
    }

    // Find the 'Done' heading of interest from all the paragraphs
    const matches = paras.filter((p) => p.headingLevel === 2).filter((q) => q.content.startsWith('Done')) // startsWith copes with Done section being folded

    if (matches != null) {
      const startPos = matches[0].contentRange?.start ?? 0
      logDebug('jumpToDone()', `Jumping to '## Done' at position ${startPos}`)
      // Editor.renderedSelect(startPos, 0) // sometimes doesn't work
      Editor.select(startPos, 0)

      // Earlier version
      // Editor.highlight(p)
    } else {
      logWarn('jumpToDone()', "Couldn't find a '## Done' section. Stopping.")
    }
  } catch (e) {
    logError('jumpToDone()', e.message)
  }
}

/**
 * Open a URL present in a note. The user is offered a list of all URLs found.
 * @author @jgclark
 */
export async function openURLFromANote(): Promise<void> {
  try {
    const config = await getSettings()
    // first jump to the note of interest, then to the heading
    const notesList = allNotesSortedByChanged()
    const re = await CommandBar.showOptions(
      notesList.map((n) => displayTitle(n)),
      'Select note',
    )
    const note = notesList[re.index]

    // Find all URLs in the Note
    const linkObjects = findURLsInNote(note, false, true, config.ignoreCompletedItems)
    // const linkObjects = findURLsInText(note.content ?? '', false)

    if (linkObjects.length === 0) {
      logWarn(pluginJson, `Sorry: I couldn't find any URLs in note '${displayTitle(note)}'`)
      await showMessage('Sorry: I couldn\'t find any URLs in note')
      return
    }

    // Ask user to pick a URL to open
    const foundURLs = linkObjects.map((lo) => lo.name ?? lo.url)
    clo(foundURLs)
    const res = await CommandBar.showOptions(foundURLs, 'Select URL to open')
    if (!res) {
      logInfo('openURLFromANote()', 'User cancelled operation')
      return
    }

    // Now open it
    const chosenURL = linkObjects[res.index].url
    logDebug('openURLFromANote()', `Opening URL '${chosenURL}'`)
    await NotePlan.openURL(chosenURL)
  } catch (e) {
    logError('openURLFromANote()', e.message)
  }
}
