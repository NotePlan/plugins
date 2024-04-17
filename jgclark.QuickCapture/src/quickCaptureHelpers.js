// @flow
// ----------------------------------------------------------------------------
// Helpers for QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 4.4.2024 for v0.16.0+ by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
// import { RE_ISO_DATE, unhyphenateString } from '@helpers/dateTime'
import { getRelativeDates } from '@helpers/NPdateTime'
// import { displayTitle } from '@helpers/general'
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
  textToAppendToJots: string,
  addInboxPosition: string,
  headingLevel: number,
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
    const startTime = new Date()
    let note: TNote | null

    // First try getting note from arg
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Is this a note title from arg?
      // First check if its a special 'relative date'
      for (const rd of relativeDates) {
        if (noteTitleArg === rd.relName) {
          note = rd.note
          logDebug('getNoteFromParamOrUser', `Found match with relative date '${rd.relName}' = filename ${note.filename}`)
        }
      }
    }

    // If not, form list of notes to check against / offer
    if (!note) {
      let allNotesToUse: Array<TNote> = []
      if (allNotesIn) {
        allNotesToUse
        allNotesToUse = allNotesIn
        logDebug('getNoteFromParamOrUser', `- Used arg3 which has ${allNotesIn.length} entries`)
      }
      else {
        allNotesToUse = justCalendarNotes ? calendarNotesSortedByChanged() : allNotesSortedByChanged()
        logDebug('getNoteFromParamOrUser', `- Got large note array of all ${justCalendarNotes ? 'calendar' : ''} notes`)
      }
      logDebug('getNoteFromParamOrUser', `allNotesToUse has ${allNotesToUse.length ?? '?'} entries (taken ${timer(startTime)} so far)`)

      // Preferably use 4th parameter, but if not calculate the list
      if (!note && allNotesToUse) {
        // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
        const noteTitleToMatch = noteTitleArg
        logDebug('getNoteFromParamOrUser', `- noteTitleToMatch = ${noteTitleToMatch}`)
        // Change YYYY-MM-DD to YYYYMMDD format if needed.
        const wantedNotes = allNotesToUse.filter((n) => displayTitleWithRelDate(n, false) === noteTitleToMatch)
        // logDebug('getNoteFromParamOrUser', `- matchingNotes: ${String(wantedNotes.map((n) => displayTitleWithRelDate(n)))}`)
        note = wantedNotes != null ? wantedNotes[0] : null
        if (note != null) {
          if (wantedNotes.length > 1) {
            logDebug('getNoteFromParamOrUser', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
          } else if (wantedNotes.length === 0) {
            logWarn('getNoteFromParamOrUser', `Couldn't find note with title '${noteTitleArg}'. Will prompt user instead.`)
          }
        }
      }

      logDebug('getNoteFromParamOrUser', `- taken ${timer(startTime)} so far`)

      // If we don't have a note by now, ask user to select one
      if (!note && allNotesToUse) {
        logDebug('getNoteFromParamOrUser', 'No note found. Prompting user to select one.')
        const notesList = allNotesToUse.map((n) => displayTitleWithRelDate(n)).filter(Boolean)
        const result = await CommandBar.showOptions(notesList, `Select note for new ${purpose}`)
        if (typeof res1 !== 'boolean') {
          note = allNotesToUse[result.index]
        }
      }
    }
    // Double-check this is a valid note
    if (note == null) {
      throw new Error("Couldn't get note for some reason")
    } else {
      logDebug('getNoteFromParamOrUser', `-> note '${displayTitleWithRelDate(note)}' (after ${timer(startTime)})`)
    }
    return note
  } catch (error) {
    logError(pluginJson, `getNoteFromParamOrUser: ${error.message}`)
    return null
  }
}
