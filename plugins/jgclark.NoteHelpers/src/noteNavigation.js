// @flow
//-----------------------------------------------------------------------------
// Navigation functions for Note Helpers plugin for NotePlan
// Jonathan Clark
// Last updated 2.1.2024 for v0.19.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings } from './noteHelpers'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getParaFromContent, findStartOfActivePartOfNote } from '@helpers/paragraph'
import {
  chooseHeading,
  chooseNote,
  showMessage
} from '@helpers/userInput'
import { findURLsInNote, findURLsInText, type LinkObject } from '@helpers/urls'

//-----------------------------------------------------------------

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
    // const notesList = allNotesSortedByChanged()
    // const re = await CommandBar.showOptions(
    //   notesList.map((n) => displayTitle(n)),
    //   'Select note to jump to',
    // )
    // const note = notesList[re.index]
    const note = await chooseNote(true, true, [], 'Select note to jump to', false)

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

/**
 * Open current month calendar note in current Editor.
 */
export async function showMonth(): Promise<void> {
  try {
    const res = await Editor.openNoteByDate(new Date(), false, 0, 0, false, "month")
    if (!res) {
      logWarn('showMonth', `Cannot show current month note for some reason`)
    } else {
      logDebug('showMonth', `Opened current month note ${displayTitle(res)}`)
    }
  } catch (err) {
    logError('showMonth()', err.message)
  }
}

/**
 * Open current quarter calendar note in current Editor.
 */
export async function showQuarter(): Promise<void> {
  try {
    const res = await Editor.openNoteByDate(new Date(), false, 0, 0, false, "quarter")
    if (!res) {
      logWarn('showQuarter', `Cannot show current quarter note for some reason`)
    } else {
      logDebug('showQuarter', `Opened current quarter note ${displayTitle(res)}`)
    }
  } catch (err) {
    logError('showQuarter()', err.message)
  }
}

/**
 * Open current year calendar note in current Editor.
 */
export async function showYear(): Promise<void> {
  try {
    const res = await Editor.openNoteByDate(new Date(), false, 0, 0, false, "year")
    if (!res) {
      logWarn('showYear', `Cannot show current year note for some reason`)
    } else {
      logDebug('showYear', `Opened current year note ${displayTitle(res)}`)
    }
  } catch (err) {
    logError('showYear()', err.message)
  }
}