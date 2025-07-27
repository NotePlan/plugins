// @flow
// ----------------------------------------------------------------------------
// Helpers for QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 2025-07-28 for v0.17.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { isValidCalendarNoteTitleStr } from '@helpers/dateTime'
import { getRelativeDates } from '@helpers/NPdateTime'
import { clo, logInfo, logDebug, logError, logTimer, logWarn } from '@helpers/dev'
import { getOrMakeCalendarNote } from '@helpers/NPnote'
import { chooseNoteV2, displayTitleWithRelDate, showMessage } from '@helpers/userInput'

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
      config.shouldAppend = config.addInboxPosition === 'append'
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
 * If a desired Calendar note doesn't already exist this now attempts to create it first.
 * Note: Send param 'allNotesIn' if the generation of that list can be more efficiently done before now. Otherwise it will generated a sorted list of all notes.
 * Note: There's deliberately no try/catch so that failure can stop processing.
 * TODO: Move this to helpers/NPNote.
 * See https://discord.com/channels/763107030223290449/1243973539296579686
 * TODO(Later): Hopefully @EM will allow future calendar notes to be created, and then some of this handling won't be needed.
 * @param {string} purpose to show to user in dialog title 'Select note for new X'
 * @param {string?} noteTitleArg to match against note titles. If not given, will ask user to select from all note titles (excluding the Trash).
 * @param {Array<TNote>?} notesIn
 * @returns {TNote} note
 */
export async function getNoteFromParamOrUser(
  purpose: string,
  noteTitleArg: string = '',
  notesIn?: Array<TNote>,
): Promise<TNote | null> {
  // Note: deliberately no try/catch so that failure can stop processing
  const startTime = new Date()
  let note: TNote | null
  let noteTitleArgIsCalendarNote: boolean = false

  // First try getting note from arg
  if (noteTitleArg != null && noteTitleArg !== '') {
    // Is this a note title from arg?
    // First check if its a special 'relative date', e.g. 'next month'
    for (const rd of relativeDates) {
      if (noteTitleArg === rd.relName) {
        noteTitleArgIsCalendarNote = true
        note = rd.note
        logDebug('getNoteFromParamOrUser', `Found match with relative date '${rd.relName}' = filename ${note.filename}`)
        break
      }
    }
    // If this has already found a note, return it
    if (note) {
      logDebug('getNoteFromParamOrUser', `- Found note from noteTitleArg '${noteTitleArg}'`)
      return note
    }

    // Now check to see if the noteTitleArg is of the *form* of a Calendar note string
    if (isValidCalendarNoteTitleStr(noteTitleArg)) {
      noteTitleArgIsCalendarNote = true
      logDebug('getNoteFromParamOrUser', `- Note is of the form of a Calendar note string. Will attempt to create it.`)

      // Test to see if we can get this calendar note
      // $FlowIgnore[incompatible-type] straight away test for null return
      note = getOrMakeCalendarNote(noteTitleArg)
      if (!note) {
        logWarn('getNoteFromParamOrUser', `Couldn't find or make Calendar note with title '${noteTitleArg}'. Will suggest a work around to user.`)
        throw new Error(
          `I can't find Calendar note '${noteTitleArg}', and unfortunately I have tried and failed to create it for you.\nPlease create it by navigating to it, and adding any content, and then re-run this command.`,
        )
      }
    }

    // Now try to find wanted regular note
    // logDebug('getNoteFromParamOrUser', `- Couldn't find note with title '${noteTitleArg}'.`)

    // Preferably we'll use the last parameter, but if not calculate the list of notes to check
    const notesToCheck = getNotesToCheck(notesIn)

    const matchingNotes = notesToCheck.filter((n) => n.title?.toLowerCase() === noteTitleArg.toLowerCase())
    logDebug('getNoteFromParamOrUser', `Found ${matchingNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
    note = matchingNotes[0]

  } else {
    // We need to ask user to select from all notes
    // Preferably we'll use the last parameter, but if not calculate the list of notes to check
    const notesToCheck = getNotesToCheck(notesIn)
    const result = await chooseNoteV2(`Select note for new ${purpose}`, notesIn, true, true, false, false)
    if (typeof result === 'boolean') {
      note = notesToCheck[result.index]
    }
  }
  // Double-check this is a valid note
  if (!note) {
    throw new Error("Couldn't get note for a reason I can't understand.")
  }

  logTimer('getNoteFromParamOrUser', startTime, `-> note '${displayTitleWithRelDate(note)}'`)
  return note
}

function getNotesToCheck(notesIn?: Array<TNote>): Array<TNote> {
  if (notesIn) {
    return notesIn
  }
  return DataStore.projectNotes.filter((n) => !n.filename.startsWith('@Trash'))
}