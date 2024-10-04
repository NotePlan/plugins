// @flow
// ----------------------------------------------------------------------------
// Helpers for QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 2024-10-04 for v0.16.0+ by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { isValidCalendarNoteFilenameWithoutExtension } from '@helpers/dateTime'
import { getRelativeDates } from '@helpers/NPdateTime'
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
 * Get QuickCapture settings
 * @param {boolean} useDefaultsIfNecessary?
 * @author @jgclark
 */
export async function getQuickCaptureSettings(useDefaultsIfNecessary: boolean = true): Promise<any> {
  try {
    // Get settings
    let config: QCConfigType = await DataStore.loadJSON('../jgclark.QuickCapture/settings.json')

    if (config == null || Object.keys(config).length === 0) {
      if (useDefaultsIfNecessary) {
        logInfo('QuickCapture', 'No QuickCapture settings found, but will use defaults instead.')
        await showMessage(`Cannot find settings for the 'QuickCapture' plugin. I will use defaults instead, but to avoid this, please install it in the Plugin Preferences.`)
        config = {
          inboxLocation: 'Inbox',
          inboxTitle: 'Inbox',
          textToAppendToTasks: '',
          textToAppendToJots: '',
          addInboxPosition: 'append',
          headingLevel: 2,
          journalHeading: '',
          shouldAppend: false,
          _logLevel: 'info',
        }
      } else {
        logWarn('QuickCapture', 'No QuickCapture settings found')
        await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it in the Plugin Preferences.`)
        return
      }
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
 * TODO(Later): Hopefully @EM will allow future calendar notes to be created, and then some of this handling won't be needed.
 * See https://discord.com/channels/763107030223290449/1243973539296579686
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
  // Note: deliberately no try/catch so that failure can stop processing
  const startTime = new Date()
  let note: TNote | null
  let noteTitleArgIsCalendarNote: boolean = false
    // First try getting note from arg
  if (noteTitleArg != null && noteTitleArg !== '') {
    // Is this a note title from arg?
    // First check if its a special 'relative date'
    for (const rd of relativeDates) {
      if (noteTitleArg === rd.relName) {
        noteTitleArgIsCalendarNote = true
        note = rd.note
        logDebug('getNoteFromParamOrUser', `Found match with relative date '${rd.relName}' = filename ${note.filename}`)
        break
      }
    }

    // Now check to see if it is of the *form* of a Calendar note string
    if (isValidCalendarNoteFilenameWithoutExtension(noteTitleArg)) {
      noteTitleArgIsCalendarNote = true
    }
  }
  logDebug('getNoteFromParamOrUser', `- After startup noteTitleArgIsCalendarNote = ${String(noteTitleArgIsCalendarNote)}`)

  // If not, form list of notes to check against / offer
  if (!note) {
    let allNotesToUse: Array<TNote> = []
    if (allNotesIn) {
      allNotesToUse = allNotesIn
      logDebug('getNoteFromParamOrUser', `- Used 4th param which has ${allNotesIn.length} entries (taken ${timer(startTime)} so far)`)
    }
    else {
      allNotesToUse = justCalendarNotes ? calendarNotesSortedByChanged() : allNotesSortedByChanged()
      logDebug('getNoteFromParamOrUser', `- Got large note array of all ${justCalendarNotes ? 'calendar' : ''} notes (taken ${timer(startTime)} so far)`)
    }

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
          logInfo('getNoteFromParamOrUser', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
        }
      }
    }

    logDebug('getNoteFromParamOrUser', `- taken ${timer(startTime)} so far`)

    if (!note) {
      // Couldn't find the note. 
      // If this looks to be a Calendar note then there's a bad work around for this.
      if (noteTitleArgIsCalendarNote) {
        logWarn('getNoteFromParamOrUser', `Couldn't find Calendar note with title '${noteTitleArg}'. Will suggest a work around to user.`)
        throw Error(`I can't find Calendar note '${noteTitleArg}', and unfortunately I can't create it for you.\nPlease create it by navigating to it, and adding any content, and then re-run this command.`)
      }

      if (noteTitleArg !== '') {
        logWarn('getNoteFromParamOrUser', `Couldn't find regular note with title '${noteTitleArg}'. Will prompt user instead.`)
      }

      const notesList = allNotesToUse.map((n) => displayTitleWithRelDate(n)).filter(Boolean)
      const result = await CommandBar.showOptions(notesList, `Select note for new ${purpose}`)
      if (typeof result !== 'boolean') {
        note = allNotesToUse[result.index]
      }
    }
  }
  // Double-check this is a valid note
  if (note == null) {
    throw new Error("Couldn't get note for a reason I can't understand.")
  } else {
    logDebug('getNoteFromParamOrUser', `-> note '${displayTitleWithRelDate(note)}' (after ${timer(startTime)})`)
  }
  return note
}
