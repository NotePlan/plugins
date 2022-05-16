// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update v0.9.1+, 12.5.2022 by @jgclark
// --------------------------------------------------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getISODateStringFromYYYYMMDD,
  getTodaysDateUnhyphenated,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
} from '../../helpers/dateTime'
import { clo, JSP, log, logError, logWarn } from '../../helpers/dev'
import { displayTitle } from '../../helpers/general'
import {
  allNotesSortedByChanged,
  calendarNotesSortedByChanged,
  projectNotesSortedByChanged
} from '../../helpers/note'
import { findEndOfActivePartOfNote, smartPrependPara } from '../../helpers/paragraph'
import { askForFutureISODate, chooseFolder, chooseHeading, showMessage, } from '../../helpers/userInput'

const configKey = "inbox"

type inboxConfigType = {
  inboxTitle: string,
  addInboxPosition: string,
  textToAppendToTasks: string
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 * Updated for #ConfigV2
 * @author @jgclark
 */
async function getInboxSettings(): Promise<any> {
  log(pluginJson, `Start of getInboxSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: inboxConfigType = await DataStore.loadJSON("../jgclark.QuickCapture/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    }  else {
      // clo(v2Config, `${configKey} settings from V2:`)
      return v2Config
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qpt
 * Prepend a task to a note the user picks
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments.
 * (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} noteTitleArg
 * @param {string?} textArg
 */
export async function prependTaskToNote(noteTitleArg?: string, textArg?: string): Promise<void> {
  try {
    const config: inboxConfigType = await getInboxSettings()
    let note: TNote
    let taskText = ''

    if ((noteTitleArg !== undefined || textArg !== undefined)
      && (noteTitleArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough arguments supplied. Stopping.`)
      return
    }

    // If we have arguments supplied, then use those
    if (noteTitleArg !== undefined && textArg !== undefined) {
      // But check this is a valid note first
      const wantedNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
      if (wantedNotes != null && wantedNotes.length > 0) {
        note = wantedNotes[0]
        log(pluginJson, `2 args given; note = '${displayTitle(note)}'`)
      } else {
        logError(pluginJson, `Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Otherwise ask user for details
      taskText = await CommandBar.showInput(
        `Type the task`,
        `Prepend '%@' ${config.textToAppendToTasks}`,
      )
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(
        notes.map((n) => n.title).filter(Boolean),
        'Select note to prepend',
      )
      note = notes[re.index]
    }
    let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    log(pluginJson, `Prepending task '${text}' to '${displayTitle(note)}'`)
    smartPrependPara(note, text, 'open')
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qat
 * Append a task to a note the user picks
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments.
 * (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} noteTitleArg
 * @param {string?} textArg
 */
export async function appendTaskToNote(noteTitleArg?: string, textArg?: string): Promise<void> {
  try {
    const config: inboxConfigType = await getInboxSettings()
    let note: TNote
    let taskText = ''

    if ((noteTitleArg !== undefined || textArg !== undefined)
      && (noteTitleArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough arguments supplied. Stopping.`)
      return
    }

    // If we have arguments supplied, then use those
    if (noteTitleArg !== undefined && textArg !== undefined) {
      // But check this is a valid note first
      const wantedNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
      if (wantedNotes != null && wantedNotes.length > 0) {
        note = wantedNotes[0]
        taskText = textArg
        log(pluginJson, `2 args given; note = '${displayTitle(note)}'`)
      } else {
        logError(pluginJson, `Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Otherwise ask user for details
      taskText = await CommandBar.showInput(
        `Type the task`,
        `Prepend '%@' ${config.textToAppendToTasks}`,
      )
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(
        notes.map((n) => n.title).filter(Boolean),
        'Select note to prepend',
      )
      note = notes[re.index]
    }
    let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    log(pluginJson, `Appending task '${text}' to '${displayTitle(note)}'`)
    note.appendTodo(text)
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qath
 * Add a task to a (regular or calendar) note and heading the user picks.
 * Extended in v0.9.0 to allow use from x-callback with three passed arguments.
 * (Needs all three arguments to be valid; if some but not all given then will attempt to log error.)
 * NB: note that duplicate headings not properly handled.
 * @author @jgclark
 * @param {string?} noteTitleArg note title to use (can be YYYY-MM-DD or YYYYMMDD)
 * @param {string?} headingArg
 * @param {string?} textArg
 */
export async function addTaskToNoteHeading(noteTitleArg?: string, headingArg?: string, textArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()
    let notes: TNote[] = allNotesSortedByChanged()

    // If we have arguments supplied, check we have the right number
    if ((noteTitleArg !== undefined || headingArg !== undefined || textArg !== undefined)
      && (noteTitleArg === undefined || headingArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough valid arguments supplied. Stopping.`)
      return
    }

    // If we have all 3 arguments, then use those
    if (noteTitleArg !== undefined && headingArg !== undefined && textArg !== undefined) {
      // But check this is a valid note title first.
      // Note: If noteTitleArg is for a calendar note, it has to be in the form YYYY-MM-DD here.
      // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
      const noteTitleToMatch = (noteTitleArg.match(RE_ISO_DATE)) // for YYYY-MM-DD
        ? (noteTitleArg)
        : (noteTitleArg.match(RE_YYYYMMDD_DATE)) // for YYYYMMDD
          ? getISODateStringFromYYYYMMDD(noteTitleArg)
          : noteTitleArg // for regular note title
      const wantedNotes = notes.filter((n) => n.title === noteTitleToMatch)
      let note = (wantedNotes != null) ? wantedNotes[0] : null
      if (note != null) {
        if (wantedNotes.length > 1) {
          logWarn(pluginJson, `More than 1 matching note found with title '${noteTitleArg}'`)
        }
        log(pluginJson, `3 args given; note = '${displayTitle(note)}'`)
        note.addTodoBelowHeadingTitle(
          `${textArg} ${config.textToAppendToTasks}`,
          headingArg, //.content,
          false,
          true
        )
      } else {
        logError(pluginJson, `Problem getting note '${noteTitleArg}' from x-callback args`)
      }
      // Finish
      return
    }

    // Otherwise ask user for details
    const taskText = await CommandBar.showInput(
      `Type the task to add`,
      `Add task '%@' ${config.textToAppendToTasks}`
    )

    // Then ask for the note we want to add the task
    // CommandBar.showOptions only takes [string] as input
    const re = await CommandBar.showOptions(
      notes.map((n) => n.title).filter(Boolean),
      'Select note for new todo',
    )
    const note = notes[re.index]

    // Finally, ask to which heading to add the task
    // (use function that first allows us to add a new heading at start/end of note as well)
    const heading = await chooseHeading(note, true, true, false)
    let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()

    // Add todo to the heading in the note, or if blank heading, then append to note
    if (heading !== '') {
      log(pluginJson, `Adding task '${text}' to '${displayTitle(note)}' below '${heading}'`)
      note.addTodoBelowHeadingTitle(
        text,
        heading, //.content,
        false, // TODO: should this use a setting?
        false // don't create missing heading: this should have been done by chooseHeading if needed
      )
    } else {
      log(pluginJson, `Adding task '${text}' to end of '${displayTitle(note)}'`)
      note.insertTodo(text, findEndOfActivePartOfNote(note))
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qalh
 * Add general text to a note's heading the user picks.
 * Extended in v0.9.0 to allow use from x-callback with three passed arguments.
 * (Needs all three arguments to be valid; if some but not all given then will attempt to log error.)
 * NB: duplicate headings are not properly handled.
 * @author @jgclark
 * @param {string?} noteTitleArg
 * @param {string?} headingArg
 * @param {string?} textArg
 */
export async function addTextToNoteHeading(noteTitleArg?: string, headingArg?: string, textArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()
    const notes: TNote[] = allNotesSortedByChanged()

    // If we have arguments supplied, check we have the right number
    if ((noteTitleArg !== undefined || headingArg !== undefined || textArg !== undefined)
      && (noteTitleArg === undefined || headingArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough valid arguments supplied. Stopping.`)
      return
    }

    // If we have all 3 arguments, then use those
    if (noteTitleArg !== undefined && headingArg !== undefined && textArg !== undefined) {
      // But check this is a valid note title first.
      // Note: If noteTitleArg is for a calendar note, it has to be in the form YYYY-MM-DD here.
      // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
      const noteTitleToMatch = (noteTitleArg.match(RE_ISO_DATE)) // for YYYY-MM-DD
        ? (noteTitleArg)
        : (noteTitleArg.match(RE_YYYYMMDD_DATE)) // for YYYYMMDD
          ? getISODateStringFromYYYYMMDD(noteTitleArg)
          : noteTitleArg // for regular note title
      const wantedNotes = notes.filter((n) => n.title === noteTitleToMatch)
      let note = (wantedNotes != null) ? wantedNotes[0] : null
      if (note != null) {
        if (wantedNotes.length > 1) {
          logWarn(pluginJson, `More than 1 matching note found with title '${noteTitleArg}'`)
        }
        log(pluginJson, `3 args given; note = '${displayTitle(note)}'`)
        note.addParagraphBelowHeadingTitle(
          `${textArg} ${config.textToAppendToTasks}`,
          'empty',
          headingArg, //.content,
          false, // TODO: should this use a setting?
          true
        )
      } else {
        logError(pluginJson, `Problem getting note '${noteTitleArg}' from x-callback args`)
      }
      // Finish
      return
    }

    // Otherwise get all details from user
    const taskText = await CommandBar.showInput(
      'Type the text to add',
      `Add text '%@' ${config.textToAppendToTasks}`
    )

    // Then ask for the note we want to add the text
    // NB: CommandBar.showOptions only takes [string] as input
    const res = await CommandBar.showOptions(
      notes.map((n) => n.title).filter(Boolean),
      'Select note for new text',
    )
    const note = notes[res.index]

    // Finally, ask to which heading to add the text
    // use function that allows us to add a new heading at start/end of note first
    const heading = await chooseHeading(note, true, true, false)
    let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()

    // Add todo to the heading in the note, or if blank heading, then append to note
    if (heading !== '') {
      log(pluginJson, `Adding line '${text}' to '${displayTitle(note)}' below '${heading}'`)
      note.addParagraphBelowHeadingTitle(
        text,
        'empty',
        heading, //.content,
        false,
        false,
      )
    } else {
      log(pluginJson, `Adding line '${text}' to end of '${displayTitle(note)}'`)
      note.insertParagraph(text, findEndOfActivePartOfNote(note), 'text')
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qpd
 * Quickly prepend a task to a daily note
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments.
 * (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} dateArg
 * @param {string?} textArg
 */
export async function prependTaskToDailyNote(dateArg?: string, textArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()
    let note: ?TNote
    let taskText = ''

    if ((dateArg !== undefined || textArg !== undefined)
      && (dateArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough arguments supplied. Stopping.`)
      return
    }

    // If we both arguments, then use those
    if (dateArg !== undefined && textArg !== undefined) {
      // But check this is a valid note daily note first; if it isn't, 
      // fall back to using current open note
      note = DataStore.calendarNoteByDateString(dateArg)
      if (note != null) {
        log(pluginJson, `2 args given; note = '${displayTitle(note)}'`)
        taskText = textArg
      } else {
        logError(pluginJson, `Problem getting daily note '${dateArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Get details interactively from user
      // Start with task text
      taskText = await CommandBar.showInput(
        `Type the task to add`,
        `Add task '%@' ${config.textToAppendToTasks}`
      )

      // Then ask for the daily note we want to add the todo
      const notes = calendarNotesSortedByChanged()
      const res = await CommandBar.showOptions(
        notes.map((n) => displayTitle(n)).filter(Boolean),
        'Select daily note for new todo',
      )
      note = notes[res.index]
    }

    if (note != null) {
      let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      log(pluginJson, `Prepending task '${text}' to '${displayTitle(note)}'`)
      note.prependTodo(text)
    } else {
      logError(pluginJson, `Can't get calendar note`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qad
 * Quickly add to daily note
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * Helpfully, doesn't fail if extra arguments passed
 * @author @jgclark
 * @param {string?) dateArg
 * @param {string?) textArg
 */
export async function appendTaskToDailyNote(dateArg?: string, textArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()
    let note: ?TNote
    let taskText = ''
    let dateStr = ''

    if ((dateArg !== undefined || textArg !== undefined)
      && (dateArg === undefined || textArg === undefined)) {
      logError(pluginJson, `Not enough arguments supplied. Stopping.`)
      return
    }

    // If we both arguments, then use those
    if (dateArg !== undefined && textArg !== undefined) {
      // But check this is a valid note daily note first; if it isn't, 
      // fall back to using current open note
      note = DataStore.calendarNoteByDateString(dateArg)
      if (note != null) {
        log(pluginJson, `2 args given; note = '${displayTitle(note)}'`)
        taskText = textArg
      } else {
        logError(pluginJson, `Problem getting daily note '${dateArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Get details interactively from user
      // Start with task text
      taskText = await CommandBar.showInput(
          `Type the task to add`,
          `Add task '%@' ${config.textToAppendToTasks}`)

      // Then ask for the daily note we want to add the todo
      dateStr = await askForFutureISODate('Select daily note for new todo')
      note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))
    }

    if (note != null) {
      let text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      log(pluginJson, `Appending task '${text}' to ${displayTitle(note)}`)
      note.appendTodo(text)
    } else {
      logError(pluginJson, `Can't get calendar note for ${dateStr}`)
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qaj
 * Quickly append text to today's journal
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * Helpfully, doesn't fail if extra arguments passed
 * @author @jgclark
 * @param {string?) textArg
 */
export async function appendTextToDailyJournal(textArg?: string): Promise<void> {
  try {
    const todaysDateStr = getTodaysDateUnhyphenated()

    // Get input either from passed argument or ask user
    const text = (textArg === undefined)
      ? await CommandBar.showInput(
        'Type the text to add',
        `Add text '%@' to ${todaysDateStr}`)
      : textArg

    const note = DataStore.calendarNoteByDateString(todaysDateStr)
    if (note != null) {
      log(pluginJson, `Adding '${text}' to ${displayTitle(note)}`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(
        text,
        'empty',
        'Journal',
        true,
        true,
      )
    } else {
      logError(pluginJson, `Cannot find daily note for ${todaysDateStr}`)
    }
  } catch (err) {
    logWarn(pluginJson, `${err.name}: ${err.message}`)
  }
}
  
/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - append or prepend to the inbox note (default: append)
 * - add to the particular named note, or if empty, to today's daily note
 * - if config section is missing, offer to add it
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * @author @jgclark
 * @param {string?) taskArg
 */
export async function addTaskToInbox(taskArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()

    // Get or setup the inbox note from the Datastore
    let newFilename: string
    let inboxNote: ?TNote
    if (config.inboxTitle !== '') {
      const matchingNotes = DataStore.projectNoteByTitleCaseInsensitive(config.inboxTitle) ?? []
      inboxNote = matchingNotes[0] ?? null
      // Create the inbox note if not existing, ask the user which folder
      if (inboxNote == null) {
        const folder = await chooseFolder(
          'Choose a folder for your inbox note (or cancel [ESC])',
        )
        newFilename = DataStore.newNote(config.inboxTitle, folder) ?? ''
        // NB: this returns a filename not of our choosing
        if (newFilename != null && newFilename !== '') {
          log(pluginJson, `made new inbox note, filename = ${newFilename}`)
          inboxNote = DataStore.projectNoteByFilename(newFilename)
        }
      }
    } else {
      inboxNote = DataStore.calendarNoteByDateString(getTodaysDateUnhyphenated())
    }

    if (inboxNote != null) {
      // Get task title either from passed argument or ask user
      let taskText = (taskArg === undefined)
        ? await CommandBar.showInput(
          `Type the task to add to ${displayTitle(inboxNote)}`,
          `Add task '%@' ${config.textToAppendToTasks}`,
        )
        : taskArg
      taskText += ` ${config.textToAppendToTasks}`

      if (config.addInboxPosition === 'append') {
        log(pluginJson, `append to note '${displayTitle(inboxNote)}'`)
        // $FlowIgnore[incompatible-use]
        inboxNote.appendTodo(taskText)
      } else {
        log(pluginJson, `prepend to note '${displayTitle(inboxNote)}'`)
        // $FlowIgnore[incompatible-use]
        inboxNote.prependTodo(taskText)
      }
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}
