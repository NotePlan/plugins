// @flow
// --------------------------------------------------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update v0.11.0, 15.7.2022 by @jgclark
// --------------------------------------------------------------------------------------------------------------------
// TODO: Work the argument-handling changes in /qalh into rest of functions
// TODO: Allow weekly notes to be specified in relevant arguments
// TODO: Update error handling to use what /int now does
// --------------------------------------------------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getTodaysDateUnhyphenated,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
} from '@helpers/dateTime'
import { log, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged, calendarNotesSortedByChanged, projectNotesSortedByChanged, weeklyNotesSortedByChanged } from '@helpers/note'
import { findEndOfActivePartOfNote, smartPrependPara } from '@helpers/paragraph'
import {
  // askForFutureISODate,
  chooseFolder, chooseHeading, showMessage
} from '@helpers/userInput'

type inboxConfigType = {
  inboxLocation: string,
  inboxTitle: string,
  addInboxPosition: string,
  textToAppendToTasks: string,
}

/**
 * Get config settings using Config V2 system.
 * @author @jgclark
 */
async function getInboxSettings(): Promise<any> {
  try {
    // Get settings using ConfigV2
    const v2Config: inboxConfigType = await DataStore.loadJSON('../jgclark.QuickCapture/settings.json')

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'QuickCapture' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(v2Config, `${configKey} settings from V2:`)
      return v2Config
    }
  } catch (err) {
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
      taskText = await CommandBar.showInput(`Type the task`, `Prepend '%@' ${config.textToAppendToTasks}`)
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(notes.map((n) => n.title).filter(Boolean), 'Select note to prepend')
      note = notes[re.index]
    }
    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    log(pluginJson, `Prepending task '${text}' to '${displayTitle(note)}'`)
    smartPrependPara(note, text, 'open')
  } catch (err) {
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
  log(pluginJson, `starting /qat`)
  try {
    const config: inboxConfigType = await getInboxSettings()
    let note: TNote
    let taskText = ''

    if ((noteTitleArg !== undefined || textArg !== undefined)
      && (noteTitleArg === undefined || textArg === undefined)) {
      logError(pluginJson, `  Not enough arguments supplied. Stopping.`)
      return
    }

    // If we have arguments supplied, then use those
    if (noteTitleArg !== undefined && textArg !== undefined) {
      // But check this is a valid note first
      const wantedNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
      if (wantedNotes != null && wantedNotes.length > 0) {
        note = wantedNotes[0]
        taskText = textArg
        log(pluginJson, `  2 args given; note = '${displayTitle(note)}'`)
      } else {
        logError(pluginJson, `  Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Otherwise ask user for details
      taskText = await CommandBar.showInput(`Type the task`, `Prepend '%@' ${config.textToAppendToTasks}`)
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(notes.map((n) => n.title).filter(Boolean), 'Select note to prepend')
      note = notes[re.index]
    }
    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    log(pluginJson, `  Appending task '${text}' to '${displayTitle(note)}'`)
    note.appendTodo(text)
  } catch (err) {
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
export async function addTaskToNoteHeading(
  noteTitleArg?: string,
  headingArg?: string,
  textArg?: string
): Promise<void> {
  try {
    log(pluginJson, `starting /qath`)
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
      const noteTitleToMatch = noteTitleArg.match(RE_ISO_DATE) // for YYYY-MM-DD
        ? noteTitleArg
        : noteTitleArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
          ? unhyphenateString(noteTitleArg)
        : noteTitleArg // for regular note title
      const wantedNotes = notes.filter((n) => n.title === noteTitleToMatch)
      const note = wantedNotes != null ? wantedNotes[0] : null
      if (note != null) {
        if (wantedNotes.length > 1) {
          logWarn(pluginJson, `More than 1 matching note found with title '${noteTitleArg}'`)
        }
        log(pluginJson, `  3 args given; note = '${displayTitle(note)}'`)
        note.addTodoBelowHeadingTitle(
          `${textArg} ${config.textToAppendToTasks}`,
          headingArg, //.content,
          config.addInboxPosition,
          true,
        )
      } else {
        logError(pluginJson, `  Problem getting note '${noteTitleArg}' from x-callback args`)
      }
      // Finish
      return
    }

    // Otherwise ask user for details
    const taskText = await CommandBar.showInput(`Type the task to add`, `Add task '%@' ${config.textToAppendToTasks}`)

    // Then ask for the note we want to add the task
    // CommandBar.showOptions only takes [string] as input
    const re = await CommandBar.showOptions(notes.map((n) => n.title).filter(Boolean), 'Select note for new todo')
    const note = notes[re.index]

    // Finally, ask to which heading to add the task
    // (use function that first allows us to add a new heading at start/end of note as well)
    const heading = await chooseHeading(note, true, true, false)
    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()

    // Add todo to the heading in the note, or if blank heading, then append to note
    if (heading !== '') {
      log(pluginJson, `  Adding task '${text}' to '${displayTitle(note)}' below '${heading}'`)
      note.addTodoBelowHeadingTitle(
        text,
        heading, //.content,
        config.addInboxPosition,
        false, // don't create missing heading: this should have been done by chooseHeading if needed
      )
    } else {
      log(pluginJson, `  Adding task '${text}' to end of '${displayTitle(note)}'`)
      note.insertTodo(text, findEndOfActivePartOfNote(note))
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qalh
 * Add general text to a regular note's heading the user picks.
 * Extended in v0.9.0 to allow use from x-callback with three passed arguments.
 * Extended in v0.10.0 to allow use from x-callback with some empty arguments: now asks users to supply missing arguments. FIXME(@EduardMe): fix error in x-callback calls with empty arguments.
 * TODO: handle YYYY-Wnn parameter
 * @author @jgclark
 * @param {string?} noteTitleArg
 * @param {string?} headingArg
 * @param {string?} textArg
 */
export async function addTextToNoteHeading(noteTitleArg?: string,
  headingArg?: string,
  textArg?: string
): Promise<void> {
  try {
    log(pluginJson, `starting /qalh with arg0 '${String(noteTitleArg)}' arg1 '${String(headingArg)}' arg2 ${textArg !== undefined ? '<text defined>' : '<text undefined>'}`)
    const config = await getInboxSettings()
    const notes: TNote[] = allNotesSortedByChanged()
    let note: TNote | null

    // Now not checking we have a valid number of arguments.
    // Will use whatever is supplied, and ask for others.

    // // If we have arguments supplied, check we have the right number
    // if ((noteTitleArg !== undefined || headingArg !== undefined || textArg !== undefined) &&
    //   (noteTitleArg === undefined || headingArg === undefined || textArg === undefined)) {
    //   logError(pluginJson, `  Not enough valid arguments supplied. Stopping.`)
    //   return
    // }

    if (noteTitleArg !== undefined) {
      // Check this is a valid note title first.
      // Note: If noteTitleArg is for a calendar note, it has to be in the form YYYY-MM-DD here.
      // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
      const noteTitleToMatch = noteTitleArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(noteTitleArg)
        : noteTitleArg // for regular note titles, and weekly notes
      const wantedNotes = allNotesSortedByChanged().filter((n) => displayTitle(n) === noteTitleToMatch)
      note = wantedNotes != null ? wantedNotes[0] : null
      if ((note != null) && (wantedNotes.length > 1)) {
        logWarn(pluginJson, `  Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
      }
    }

    // // If we have all 3 arguments, then use those
    // if (noteTitleArg !== undefined && headingArg !== undefined && textArg !== undefined) {
    //   if (note != null) {
    //     log(pluginJson, `  3 args given; note = '${displayTitle(note)}'; textArg = '${textArg}'`)
    //     note.addParagraphBelowHeadingTitle(
    //       textArg,
    //       'empty',
    //       headingArg, //.content,
    //       false, // TODO: should this use a setting?
    //       true,
    //     )
    //   } else {
    //     logError(pluginJson, `  Problem getting note '${noteTitleToMatch}' from x-callback args`)
    //   }
    //   // Finish
    //   return
    // }

    // Otherwise get what details from user we need
    const taskText = (textArg !== undefined)
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@' ${config.textToAppendToTasks}`)

    // Then ask for the note we want to add the text
    if (note == null) {
      // NB: CommandBar.showOptions only takes [string] as input
      const res = await CommandBar.showOptions(notes.map((n) => n.title).filter(Boolean), 'Select note for new text')
      note = notes[res.index]
    }

    // Finally, get heading to add the text to
    // If we're asking user, then use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg !== undefined)
      ? headingArg
      : await chooseHeading(note, true, true, false)

    // Add todo to the heading in the note, or if blank heading, then append to note
    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    if (heading !== '') {
      log(pluginJson, `  Adding line '${text}' to '${displayTitle(note)}' below '${heading}'`)
      note.addParagraphBelowHeadingTitle(
        text,
        'empty',
        heading, //.content,
        config.addInboxPosition,
        false,
      )
    } else {
      log(pluginJson, `  Adding line '${text}' to end of '${displayTitle(note)}'`)
      note.insertParagraph(text, findEndOfActivePartOfNote(note), 'text')
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
  }
}

/** /qpd
 * Quickly prepend a task to a daily note
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments.
 * (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} dateArg YYYYMMDD or YYYY-MM-DD
 * @param {string?} textArg
 */
export async function prependTaskToDailyNote(dateArg?: string, textArg?: string): Promise<void> {
  log(pluginJson, `starting /qpd`)
  try {
    const config = await getInboxSettings()
    let note: ?TNote
    let taskText = ''
    let dateArg = ''

    if ((dateArg !== undefined || textArg !== undefined) && (dateArg === undefined || textArg === undefined)) {
      logError(pluginJson, `  Not enough arguments supplied. Stopping.`)
      return
    }

    // If we both arguments, then use those
    if (dateArg !== undefined && textArg !== undefined) {
      const dateArgToMatch = dateArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(dateArg)
        : dateArg // for regular note titles, and weekly notes

      // But check this is a valid note daily note first; if it isn't,
      // fall back to using current open note
      note = DataStore.calendarNoteByDateString(dateArgToMatch)
      if (note != null) {
        log(pluginJson, `  2 args given; note => '${displayTitle(note)}'`)
        taskText = textArg
      } else {
        logError(pluginJson, `  Problem getting daily note '${dateArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Get details interactively from user
      // Start with task text
      taskText = await CommandBar.showInput(`Type the task to add`, `Add task '%@' ${config.textToAppendToTasks}`)

      // Then ask for the daily note we want to add the todo
      const notes = calendarNotesSortedByChanged()
      const res = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select daily note for new todo')
      note = notes[res.index]
      dateArg = displayTitle(note)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      log(pluginJson, `  Prepending task '${text}' to '${displayTitle(note)}'`)
      note.prependTodo(text)
    } else {
      logError(pluginJson, `  Can't get calendar note ${dateArg}`)
    }
  } catch (err) {
    logError(pluginJson, `  ${err.name}: ${err.message}`)
  }
}

/** /qad
 * Quickly add to Daily note
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * Helpfully, doesn't fail if extra arguments passed
 * @author @jgclark
 * @param {string?) dateArg
 * @param {string?) textArg
 */
export async function appendTaskToDailyNote(dateArg?: string, textArg?: string): Promise<void> {
  log(pluginJson, `starting /qad`)
  try {
    const config = await getInboxSettings()
    let note: ?TNote
    let taskText = ''
    let dateStr = ''

    if ((dateArg !== undefined || textArg !== undefined) && (dateArg === undefined || textArg === undefined)) {
      logError(pluginJson, `  Not enough arguments supplied. Stopping.`)
      return
    }

    // If we both arguments, then use those
    if (dateArg !== undefined && textArg !== undefined) {
      // But check this is a valid note daily note first; if it isn't,
      // fall back to using current open note
      note = DataStore.calendarNoteByDateString(dateArg)
      if (note != null) {
        log(pluginJson, `  2 args given; note = '${displayTitle(note)}'`)
        taskText = textArg
      } else {
        logError(pluginJson, `  Problem getting daily note '${dateArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Get details interactively from user
      // Start with task text
      taskText = await CommandBar.showInput(`Type the task to add`, `Add task '%@' ${config.textToAppendToTasks}`)

      // Then ask for the daily note we want to add the todo
      const notes = calendarNotesSortedByChanged()
      const res = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select daily note for new todo')
      note = notes[res.index]
      dateStr = displayTitle(note)
      // Earlier method:
      // const dateStr = await askForFutureISODate('Select daily note for new todo')
      // note = DataStore.calendarNoteByDateString(unhyphenateString(dateStr))
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      log(pluginJson, `  Appending task '${text}' to ${displayTitle(note)}`)
      note.appendTodo(text)
    } else {
      logError(pluginJson, `  Can't get daily note for ${dateStr}`)
    }
  } catch (err) {
    logError(pluginJson, `  ${err.name}: ${err.message}`)
  }
}

/** /qaw
 * Quickly add to Weekly note
 * Added in v0.10.0
 * @author @jgclark
 * @param {string?) dateArg
 * @param {string?) textArg
 */
export async function appendTaskToWeeklyNote(dateArg?: string, textArg?: string): Promise<void> {
  log(pluginJson, `starting /qaw`)
  try {
    const config = await getInboxSettings()
    let note: ?TNote
    let taskText = ''
    let weekStr = ''

    if ((dateArg !== undefined || textArg !== undefined) && (dateArg === undefined || textArg === undefined)) {
      logError(pluginJson, `  Not enough arguments supplied. Stopping.`)
      return
    }

    // If we both arguments, then use those
    if (dateArg !== undefined && textArg !== undefined) {
      // But check this is a valid note daily note first; if it isn't,
      // fall back to using current open note
      note = DataStore.calendarNoteByDateString(dateArg)
      if (note != null) {
        log(pluginJson, `  2 args given; note = '${displayTitle(note)}'`)
        taskText = textArg
      } else {
        logError(pluginJson, `  Problem getting daily note '${dateArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      // Get details interactively from user
      // Start with task text
      taskText = await CommandBar.showInput(`Type the task to add`, `Add task '%@' ${config.textToAppendToTasks}`)

      // Then ask for the weekly note we want to add the todo
      const weeklyNoteTitles = weeklyNotesSortedByChanged().map((f) => f.filename) ?? ['error: no weekly notes found']
      const res = await CommandBar.showOptions(weeklyNoteTitles, 'Select weekly note for new todo')
      weekStr = res.value
      note = DataStore.calendarNoteByDateString(weekStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      log(pluginJson, `  Appending task '${text}' to ${displayTitle(note)}`)
      note.appendTodo(text)
    } else {
      logError(pluginJson, `  Can't get weekly note for ${weekStr}`)
    }
  } catch (err) {
    logError(pluginJson, `  ${err.name}: ${err.message}`)
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
  log(pluginJson, `starting /qaj`)
  try {
    const todaysDateStr = getTodaysDateUnhyphenated()

    // Get input either from passed argument or ask user
    const text = textArg === undefined ? await CommandBar.showInput('Type the text to add', `Add text '%@' to ${todaysDateStr}`) : textArg

    const note = DataStore.calendarNoteByDateString(todaysDateStr)
    if (note != null) {
      log(pluginJson, `  Adding '${text}' to ${displayTitle(note)}`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', 'Journal', true, true)
    } else {
      logError(pluginJson, `  Cannot find daily note for ${todaysDateStr}`)
    }
  } catch (err) {
    logWarn(pluginJson, `  ${err.name}: ${err.message}`)
  }
}

/** /int
 * This adds a task to a special 'inbox' note. Possible configuration:
 * - add to the current Daily or Weekly note, or to a fixed note (through setting 'inboxLocation')
 * - append or prepend to the inbox note (default: append)
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * @author @jgclark
 * @param {string?) taskArg
 */
export async function addTaskToInbox(taskArg?: string): Promise<void> {
  try {
    const config = await getInboxSettings()
    log(pluginJson, `starting /addTaskToInbox with ${config.inboxLocation}`)

    let inboxNote: ?TNote
    switch (config.inboxLocation) {
      case "Daily": {
        inboxNote = DataStore.calendarNoteByDate(new Date(), "day")
        break
      }

      case "Weekly": {
        if (NotePlan.environment.buildVersion < 801) {
          throw new Error("Sorry; adding to Weekly note requires NotePlan v3.6 or newer.")
        }
        inboxNote = DataStore.calendarNoteByDate(new Date(), "week")
        break
      }

      default: {
        // Get or make the inbox note from the Datastore
        let newFilename: string
        if (config.inboxTitle === '') {
          throw new Error("Quick Capture to Inbox: please set the title of your chosen fixed Inbox note in Quick Capture preferences.")
        } else {
          const matchingNotes = DataStore.projectNoteByTitleCaseInsensitive(config.inboxTitle) ?? []
          inboxNote = matchingNotes[0] ?? null

          // Create the inbox note if it doesn't exist, asking the user which folder
          if (inboxNote == null) {
            const folder = await chooseFolder('Choose a folder for your inbox note (or cancel [ESC])')
            newFilename = DataStore.newNote(config.inboxTitle, folder) ?? ''
            // Note: this returns a filename not of our choosing
            if (newFilename != null && newFilename !== '') {
              log(pluginJson, `- made new inbox note, filename = ${newFilename}`)
              inboxNote = DataStore.projectNoteByFilename(newFilename)
            }
          }
        }
        break
      }
    }

    if (inboxNote) {
      // Get task title either from passed argument or ask user
      let taskText =
        taskArg === undefined ? await CommandBar.showInput(`Type the task to add to ${displayTitle(inboxNote)}`, `Add task '%@' ${config.textToAppendToTasks}`) : taskArg
      taskText += ` ${config.textToAppendToTasks}`

      if (config.addInboxPosition === 'append') {
        inboxNote.appendTodo(taskText)
        log(pluginJson, `- appended to note '${displayTitle(inboxNote)}'`)
      } else {
        inboxNote.prependTodo(taskText)
        log(pluginJson, `- prepended to note '${displayTitle(inboxNote)}'`)
      }
    } else {
      throw new Error("Quick Add to Inbox: Couldn't get or make valid Inbox note.")
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
