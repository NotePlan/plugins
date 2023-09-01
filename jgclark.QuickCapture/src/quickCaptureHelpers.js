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
import { displayTitle } from '@helpers/general'
import { clo, logInfo, logDebug, logError, logWarn, timer } from '@helpers/dev'
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
 * Now first matches against special 'relative date' (e.g. 'last month', 'next week', defined above) as well as YYYY-MM-DD (etc.) calendar dates.
 * Note: Send param 'allNotesIn' if the generation of that list can be more efficiently done before now. Otherwise it will generated a sorted list of all notes.
 * @param {string} purpose to show to user
 * @param {string?} noteTitleArg
 * @param {boolean?} justCalendarNotes? (default: false)
 * @param {Array<TNote>?} allNotesIn
 * @returns {TNote} note
 */
export async function getNoteFromParamOrUser(
  purpose: string,
  noteTitleArg?: string = '',
  justCalendarNotes: boolean = false,
  allNotesIn?: Array<TNote>
): Promise<TNote | null> {
  try {
    let startTime = new Date()
    let note: TNote | null

    // Preferably use 4th parameter, but if not calculate the list [This is the lengthy bit: ~1020ms for me]
    let allNotes: Array<TNote> = []
    if (allNotesIn) {
      allNotes = allNotesIn
    }
    else {
      allNotes = allNotesSortedByChanged()
      logDebug('getNoteFromParamOrUser', `Got large note array: ${timer(startTime)})`)
    }
    logDebug('getNoteFromParamOrUser', `allNotes has ${allNotes.length ?? '?'} entries`)

    // First get note from arg or User
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Is this a note title from arg?
      // First check if its a special 'relative date'
      for (const rd of relativeDates) {
        if (noteTitleArg === rd.relName) {
          note = rd.note
          logDebug('getNoteFromParamOrUser', `found match with relative date '${rd.relName}' = filename ${note.filename}`)
        }
      }

      if (!note && allNotes) {
        // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
        const noteTitleToMatch = noteTitleArg
        logDebug('getNoteFromParamOrUser', `noteTitleToMatch = ${noteTitleToMatch}`)
        // Change YYYY-MM-DD to YYYYMMDD format if needed.
        const wantedNotes = allNotes.filter((n) => displayTitleWithRelDate(n, false) === noteTitleToMatch)
        // logDebug('getNoteFromParamOrUser', `matchingNotes: ${String(wantedNotes.map((n) => displayTitleWithRelDate(n)))}`)
        note = wantedNotes != null ? wantedNotes[0] : null
        if (note != null) {
          if (wantedNotes.length > 1) {
            logDebug('getNoteFromParamOrUser', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
          } else if (wantedNotes.length === 0) {
            logWarn('getNoteFromParamOrUser', `Couldn't find note with title '${noteTitleArg}'. Will prompt user instead.`)
          }
        }
      }
    }

    // We don't have a note by now, so ask user to select one
    if (!note && allNotes) {
      logDebug('getNoteFromParamOrUser', 'No note found. Prompting user to select one.')
      const calendarNotes: Array<TNote> = allNotes.filter((n) => n.type === "Calendar")

      let notesList = (justCalendarNotes)
        ? calendarNotes.map((n) => displayTitleWithRelDate(n)).filter(Boolean)
        : allNotes.map((n) => displayTitleWithRelDate(n)).filter(Boolean)
      // notesList.unshift('➡️ relative dates (will open new list)')
      const res1 = await CommandBar.showOptions(notesList, 'Select note for new ' + purpose)
      if (typeof res1 !== 'boolean') {
        note = (justCalendarNotes)
          ? calendarNotes[res1.index]
          : allNotes[res1.index]
      }
    }
    // Double-check this is a valid note
    if (note == null) {
      throw new Error("Couldn't get note")
    } else {
      logDebug('getNoteFromParamOrUser', `-> note '${displayTitleWithRelDate(note)}'`)
    }
    return note
  } catch (error) {
    logError(pluginJson, `getNoteFromParamOrUser: ${error.message}`)
    return null
  }
}
