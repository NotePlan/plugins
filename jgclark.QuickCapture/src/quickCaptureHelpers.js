// @flow
// ----------------------------------------------------------------------------
// Helpers for QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 17.8.2023 for v0.14.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  RE_ISO_DATE,
  unhyphenateString,
} from '@helpers/dateTime'
import { getRelativeDates } from '@helpers/NPdateTime'
import { clo, logInfo, logDebug, logError, logWarn } from '@helpers/dev'
import { allNotesSortedByChanged, calendarNotesSortedByChanged } from '@helpers/note'
import {
  displayTitleWithRelDate,
  showMessage,
} from '@helpers/userInput'

//----------------------------------------------------------------------------
// helpers

export type QCConfigType = {
  inboxLocation: string,
  inboxTitle: string,
  textToAppendToTasks: string,
  addInboxPosition: string,
  journalHeading: string,
  shouldAppend: boolean, // special case set in getQuickCaptureSettings()
  _logLevel: string,
}

const relativeDates = getRelativeDates()

/**
 * Get config settings
 * @author @jgclark
 */
export async function getQuickCaptureSettings(): Promise<any> {
  try {
    // Get settings
    const config: QCConfigType = await DataStore.loadJSON('../jgclark.QuickCapture/settings.json')

    if (config == null || Object.keys(config).length === 0) {
      await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // Additionally set 'shouldAppend' from earlier setting 'addInboxPosition'
      config.shouldAppend = (config.addInboxPosition === 'append')
      // clo(config, `QuickCapture Settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/**
 * Returns TNote from DataStore matching 'noteTitleArg' (if given) to titles, or else ask User to select from all note titles.
 * Now first matches against special 'relative date' (e.g. 'last month', 'next week', defined above).
 * @param {string} purpose to show to user
 * @param {string?} noteTitleArg
 * @param {boolean?} justCalendarNotes? (default: false)
 * @returns {TNote} note
 */
export async function getNoteFromParamOrUser(
  purpose: string,
  noteTitleArg?: string = '',
  justCalendarNotes: boolean = false
): Promise<TNote | null> {
  try {
    let note: TNote | null

    // First get note from arg or User
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Is this a note title from arg?
      // First check if its a special 'relative date'
      for (const rd of relativeDates) {
        if (noteTitleArg === rd.relName) {
          logDebug('getNoteFromParamOrUser', `- Found match with ${rd.relName}`)
          note = rd.note
        }
      }

      if (!note) {
        // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
        // First change YYYY-MM-DD to YYYYMMDD format if needed.
        const noteTitleToMatch = noteTitleArg.match(RE_ISO_DATE)
          ? unhyphenateString(noteTitleArg)
          : noteTitleArg // for regular note titles, and weekly notes
        const wantedNotes = allNotesSortedByChanged().filter((n) => displayTitleWithRelDate(n) === noteTitleToMatch)
        note = wantedNotes != null ? wantedNotes[0] : null
        if (note != null) {
          if (wantedNotes.length > 1) {
            logWarn('getNoteFromParamOrUser', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
          }
        }
      }
    }

    // We don't have a note by now, so ask user to select one
    if (note == null) {
      logWarn('getNoteFromParamOrUser', `Couldn't find note with title '${noteTitleArg}'. Will prompt user instead.`)
      let repeatLoop: boolean
      const allNotes: Array<TNote> = allNotesSortedByChanged()
      const calendarNotes: Array<TNote> = calendarNotesSortedByChanged()

      do {
        repeatLoop = false
        // NB: CommandBar.showOptions only takes [string] as input
        let notesList = (justCalendarNotes)
          ? calendarNotes.map((n) => displayTitleWithRelDate(n, true)).filter(Boolean)
          : allNotes.map((n) => displayTitleWithRelDate(n, true)).filter(Boolean)
        // notesList.unshift('➡️ relative dates (will open new list)')
        const res1 = await CommandBar.showOptions(notesList, 'Select note for new ' + purpose)
        if (res1.index > 0) {
          note = (justCalendarNotes)
            ? calendarNotes[res1.index]
            : allNotes[res1.index]

          // Note: Had tried a sub-menu for relative dates
          //   note = allNotes[res1.index - 1]
          // } else if (res1.index === 0) {
          //   // Now ask user to select which relative date they'd like
          //   notesList = relativeDates.map((n) => n.relName)
          //   notesList.unshift('⬅️ back to main notes list')
          //   const res2 = await CommandBar.showOptions(notesList, 'Select relative date for new text')
          //   if (res2.index > 0) {
          //     note = relativeDates[res2.index - 1].note
          //   } else {
          //     // go back to main list by setting repeatLoop to true
          //     repeatLoop = true
          //   }
        }
      } while (repeatLoop)
    }
    // Double-check this is a valid note
    if (note == null) {
      throw new Error("Couldn't get note")
    } else {
      logDebug('getNoteFromParamOrUser', `-> note '${displayTitleWithRelDate(note)}'`)
    }
    return note
  } catch (error) {
    logError('getNoteFromParamOrUser', error.message)
    return null
  }
}
