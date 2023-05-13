// @flow
// ----------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update v0.13.0, 23.3.2023 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getTodaysDateUnhyphenated,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
} from '@helpers/dateTime'
import { clo, logInfo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged, calendarNotesSortedByChanged, projectNotesSortedByChanged, weeklyNotesSortedByChanged } from '@helpers/note'
import {
  findEndOfActivePartOfNote,
  findHeadingStartsWith,
  smartAppendPara,
  smartPrependPara
} from '@helpers/paragraph'
import {
  chooseFolder, chooseHeading, showMessage
} from '@helpers/userInput'

export type QCConfigType = {
  inboxLocation: string,
  inboxTitle: string,
  textToAppendToTasks: string,
  addInboxPosition: string,
  journalHeading: string,
  shouldAppend: boolean, // special case set in getQuickCaptureSettings()
  _logLevel: string,
}

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

/** /qpt
 * Prepend a task to a (project) note the user picks
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments. (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} noteTitleArg project note title
 * @param {string?} textArg text to add
 */
export async function prependTaskToNote(
  noteTitleArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  try {
    logDebug(pluginJson, `starting /qpt`)
    const config: QCConfigType = await getQuickCaptureSettings()
    let note: TNote

    if (noteTitleArg != null && noteTitleArg !== '') {
      // Check this is a valid note first
      const wantedNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
      if (wantedNotes != null && wantedNotes.length > 0) {
        note = wantedNotes[0]
      } else {
        logError(pluginJson, `- Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select note to prepend')
      note = notes[re.index]
    }

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Prepend '%@' ${config.textToAppendToTasks}`)

    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    logDebug(pluginJson, `- Prepending task '${text}' to '${displayTitle(note)}'`)
    smartPrependPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `- ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qat
 * Append a task to a (project) note the user picks
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments. (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} noteTitleArg project note title
 * @param {string?} textArg text to add
 */
export async function appendTaskToNote(
  noteTitleArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  logDebug(pluginJson, `starting /qat`)
  try {
    const config: QCConfigType = await getQuickCaptureSettings()
    let note: TNote
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Check this is a valid note first
      const wantedNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
      if (wantedNotes != null && wantedNotes.length > 0) {
        note = wantedNotes[0]
      } else {
        logError(pluginJson, `- Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
        return
      }
    } else {
      const notes = projectNotesSortedByChanged()

      const re = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select note to append')
      note = notes[re.index]
    }

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Append '%@' ${config.textToAppendToTasks}`)

    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
    logDebug(pluginJson, `- Appending task '${text}' to '${displayTitle(note)}'`)
    // note.appendTodo(text)
    smartAppendPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `- ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qath
 * Add a task to a (regular or calendar) note and heading the user picks.
 * Extended in v0.9 to allow use from x-callback with three passed arguments.
 * Extended in v0.12 to allow use from x-callback with some empty arguments: now asks users to supply missing arguments.
 * Note: duplicate headings not properly handled, due to NP architecture.
 * @author @jgclark
 * @param {string?} noteTitleArg note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string?} headingArg
 * @param {string?} textArg
 */
export async function addTaskToNoteHeading(
  noteTitleArg?: string = '',
  headingArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  try {
    logDebug(pluginJson, `starting /qath with arg0 '${noteTitleArg}' arg1 '${headingArg}' arg2 ${textArg != null ? '<text defined>' : '<text undefined>'}`)
    const config = await getQuickCaptureSettings()
    const notes: Array<TNote> = allNotesSortedByChanged()
    let note: TNote | null

    // First get note from arg0 or User
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Check this is a valid note title first.
      // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
      const noteTitleToMatch = noteTitleArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(noteTitleArg)
        : noteTitleArg // for regular note titles, and weekly notes
      const wantedNotes = allNotesSortedByChanged().filter((n) => displayTitle(n) === noteTitleToMatch)
      note = wantedNotes != null ? wantedNotes[0] : null
      if ((note != null) && (wantedNotes.length > 1)) {
        logWarn('addTaskToNoteHeading', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
      }
    }
    // If we don't have a note by now, ask user to select one
    if (note == null) {
      // NB: CommandBar.showOptions only takes [string] as input
      const res = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select note for new task')
      note = notes[res.index]
    }
    // Double-check this is a valid note
    if (note == null) {
      logError('addTaskToNoteHeading', `- Problem getting note`)
      return
    } else {
      logDebug('addTaskToNoteHeading', `- note = '${displayTitle(note)}'`)
    }

    // Get text details from arg2 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Add task '%@' ${config.textToAppendToTasks}`)
    const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()

    // Get heading details from arg1 or user
    // If we're asking user, we use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg != null && headingArg !== '')
      ? headingArg
      : await chooseHeading(note, true, true, false)
    // Add todo to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading !== '') {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('addTaskToNoteHeading', `Adding task '${taskText}' to '${displayTitle(note)}' below '${heading}'`)
      note.addTodoBelowHeadingTitle(
        taskText,
        (matchedHeading !== '') ? matchedHeading : heading,
        config.shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
        true, // create heading if needed (possible if supplied via headingArg)
      )
    } else {
      logDebug('addTaskToNoteHeading', `Adding task '${taskText}' to end of '${displayTitle(note)}'`)
      note.insertTodo(taskText, findEndOfActivePartOfNote(note))
    }
  } catch (err) {
    logError('addTaskToNoteHeading', `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qalh
 * FIXME(@EduardMe): adding a line after an earlier non-heading line with same text as the heading line? Raised as bug https://github.com/NotePlan/plugins/issues/429.
 * TODO: When fixed check using index.js::tempAddParaTest()
 *
 * Add general text to a regular note's heading the user picks.
 * Extended in v0.9 to allow use from x-callback with three passed arguments.
 * Extended in v0.10 to allow use from x-callback with some empty arguments: now asks users to supply missing arguments.
 * Note: duplicate headings not properly handled, due to NP architecture.
 * @author @jgclark
 * @param {string?} noteTitleArg note title to use (can be YYYY-MM-DD or YYYYMMDD)
 * @param {string?} headingArg
 * @param {string?} textArg
 */
export async function addTextToNoteHeading(
  noteTitleArg?: string = '',
  headingArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  try {
    // $FlowFixMe[incompatible-type]
    logDebug(pluginJson, `starting /qalh with arg0 '${noteTitleArg}' arg1 '${headingArg}' arg2 ${textArg != null ? '<text defined>' : '<text undefined>'}`)
    const config = await getQuickCaptureSettings()
    const notes: Array<TNote> = allNotesSortedByChanged()
    let note: TNote | null

    // First get note from arg0 or User
    if (noteTitleArg != null && noteTitleArg !== '') {
      // Check this is a valid note title first.
      // Note: Because of NP architecture, it's possible to have several notes with the same title; the first match is used.
      const noteTitleToMatch = noteTitleArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(noteTitleArg)
        : noteTitleArg // for regular note titles, and weekly notes
      const wantedNotes = allNotesSortedByChanged().filter((n) => displayTitle(n) === noteTitleToMatch)
      note = wantedNotes != null ? wantedNotes[0] : null
      if ((note != null) && (wantedNotes.length > 1)) {
        logWarn('addTextToNoteHeading', `Found ${wantedNotes.length} matching notes with title '${noteTitleArg}'. Will use most recently changed note.`)
      }
    }
    // If we don't have a note by now, ask user to select one
    if (note == null) {
      // NB: CommandBar.showOptions only takes [string] as input
      const res = await CommandBar.showOptions(notes.map((n) => displayTitle(n)).filter(Boolean), 'Select note for new text')
      note = notes[res.index]
    }
    // Double-check this is a valid note
    if (note == null) {
      logError('addTextToNoteHeading', `- Problem getting note`)
      return
    } else {
      // logDebug('addTextToNoteHeading', `- note = '${displayTitle(note)}'`)
    }

    // Get text details from arg2 or user
    const textToAdd = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@' ${config.textToAppendToTasks}`)

    // Get heading details from arg1 or user
    // If we're asking user, we use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg != null && headingArg !== '')
      ? headingArg
      : await chooseHeading(note, true, true, false)
    // Add todo to the heading in the note, or if blank heading,
    // then then user has chosen to append to end of note, without a heading
    if (heading !== '') {
      const matchedHeading = findHeadingStartsWith(note, heading)
      logDebug('addTextToNoteHeading', `Adding line '${textToAdd}' to '${displayTitle(note)}' below matchedHeading '${matchedHeading}' (heading was '${heading}')`)
      note.addParagraphBelowHeadingTitle(
        textToAdd,
        'text',
        (matchedHeading !== '') ? matchedHeading : heading,
        config.shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
        true, // create heading if needed (possible if supplied via headingArg)
      )
    } else {
      logDebug('addTextToNoteHeading', `Adding line '${textToAdd}' to end of '${displayTitle(note)}'`)
      note.insertParagraph(textToAdd, findEndOfActivePartOfNote(note), 'text')
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qpc (was /qpd)
 * Prepend a task to a calendar note
 * Extended in v0.9.0 to allow use from x-callback with two passed arguments. (Needs both arguments to be valid; if some but not all given then will attempt to log error.)
 * @author @jgclark
 * @param {string?} dateArg the usual calendar titles, plus YYYYMMDD
 * @param {string?} textArg text to prepend
 */
export async function prependTaskToCalendarNote(
  dateArg: string = '',
  textArg: string = ''
): Promise<void> {
  logDebug(pluginJson, `starting /qpc`)
  try {
    const config = await getQuickCaptureSettings()
    let note: ?TNote
    let dateStr = ''

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Add task '%@' ${config.textToAppendToTasks}`)

    // Get calendar note to use
    if (dateArg != null && dateArg !== '') {
      const dateArgToMatch = dateArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(dateArg)
        : dateArg // for regular note titles, and weekly notes
      note = DataStore.calendarNoteByDateString(dateArgToMatch)
    }
    if (note != null) {
      logDebug('prependTaskToCalendarNote', `- from dateArg, daily note = '${displayTitle(note)}'`)
    } else {
      // Get details interactively from user
      const calendarNoteTitles = calendarNotesSortedByChanged().map((f) => f.filename) ?? ['error: no calendar notes found']
      const res = await CommandBar.showOptions(calendarNoteTitles, 'Select calendar note for new todo')
      dateStr = res.value
      note = DataStore.calendarNoteByDateString(dateStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      logDebug('prependTaskToCalendarNote', `- Prepending task '${text}' to '${displayTitle(note)}'`)
      smartPrependPara(note, text, 'open')
      // note.prependTodo(text)
    } else {
      logError('prependTaskToCalendarNote', `- Can't get calendar note ${dateArg}`)
    }
  } catch (err) {
    logError('prependTaskToCalendarNote', `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qac (was /qad)
 * Append to a Calendar note
 * Extended in v0.9.0 to allow use from x-callback with single passed argument. Helpfully, doesn't fail if extra arguments passed
 * @author @jgclark
 * @param {string?} dateArg the usual calendar titles, plus YYYYMMDD
 * @param {string?} textArg text to add
 */
export async function appendTaskToCalendarNote(
  dateArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  logDebug(pluginJson, `starting /qac`)
  try {
    const config = await getQuickCaptureSettings()
    let note: ?TNote
    let dateStr = ''

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Add task '%@' ${config.textToAppendToTasks}`)

    // Get daily note to use
    if (dateArg != null && dateArg !== '') {
      const dateArgToMatch = dateArg.match(RE_ISO_DATE) // for YYYY-MM-DD change to YYYYMMDD
        ? unhyphenateString(dateArg)
        : dateArg // for regular note titles, and weekly notes
      note = DataStore.calendarNoteByDateString(dateArgToMatch)
    }
    if (note != null) {
      logDebug(pluginJson, `- from dateArg, daily note = '${displayTitle(note)}'`)
    } else {
      // Get details interactively from user
      const calendarNoteTitles = calendarNotesSortedByChanged().map((f) => f.filename) ?? ['error: no calendar notes found']
      const res = await CommandBar.showOptions(calendarNoteTitles, 'Select calendar note for new todo')
      dateStr = res.value
      note = DataStore.calendarNoteByDateString(dateStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      logDebug(pluginJson, `- Appending task '${text}' to ${displayTitle(note)}`)
      smartAppendPara(note, text, 'open')
      // note.appendTodo(text)
    } else {
      logError(pluginJson, `- Can't get daily note for ${dateStr}`)
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qaw
 * Quickly add to Weekly note
 * Added in v0.10.0, but then hidden in v0.13.0 as all calendar notes can already be added to in /qac
 * @author @jgclark
 * @param {string?} dateArg week date (YYYY-Wnn)
 * @param {string?} textArg text to add
 */
export async function appendTaskToWeeklyNote(
  dateArg?: string = '',
  textArg?: string = ''
): Promise<void> {
  logDebug(pluginJson, `starting /qaw`)
  try {
    const config = await getQuickCaptureSettings()
    let note: ?TNote
    let weekStr = ''

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Add task '%@' ${config.textToAppendToTasks}`)

    // Get weekly note to use
    if (dateArg != null && dateArg !== '') {
      note = DataStore.calendarNoteByDateString(dateArg)
    }
    if (note != null) {
      logDebug(pluginJson, `- from dateArg, weekly note = '${displayTitle(note)}'`)
    } else {
      // Get details interactively from user
      const weeklyNoteTitles = weeklyNotesSortedByChanged().map((f) => f.filename) ?? ['error: no weekly notes found']
      const res = await CommandBar.showOptions(weeklyNoteTitles, 'Select weekly note for new todo')
      weekStr = res.value
      note = DataStore.calendarNoteByDateString(weekStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      logDebug(pluginJson, `- appending task '${text}' to ${displayTitle(note)}`)
      smartAppendPara(note, text, 'open')
      // note.appendTodo(text)
    } else {
      logError(pluginJson, `- can't get weekly note for ${weekStr}`)
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qajd
 * Quickly append text to today's journal
 * Extended in v0.9.0 to allow use from x-callback with single passed argument
 * Helpfully, doesn't fail if extra arguments passed
 * @author @jgclark
 * @param {string?} textArg
 */
export async function appendTextToDailyJournal(textArg?: string = ''): Promise<void> {
  logDebug(pluginJson, `starting /qaj with arg0='${textArg}'`)
  try {
    const todaysDateStr = getTodaysDateUnhyphenated()
    const config = await getQuickCaptureSettings()

    // Get input either from passed argument or ask user
    const text = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${todaysDateStr}`)

    const note = DataStore.calendarNoteByDate(new Date(), 'day')
    if (note != null) {
      const matchedHeading = findHeadingStartsWith(note, config.journalHeading)
      logDebug(pluginJson, `Adding '${text}' to ${displayTitle(note)} under matchedHeading '${matchedHeading}'`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', matchedHeading ? matchedHeading : config.journalHeading, true, true)
    } else {
      logError(pluginJson, `Cannot find daily note for ${todaysDateStr}`)
    }
  } catch (err) {
    logWarn(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qajw
 * Quickly append text to this week's journal
 * @author @jgclark
 * @param {string?} textArg
 */
export async function appendTextToWeeklyJournal(textArg?: string = ''): Promise<void> {
  logDebug(pluginJson, `starting /qajw with arg0='${textArg}'`)
  try {
    const todaysDateStr = getTodaysDateUnhyphenated()
    const config = await getQuickCaptureSettings()

    // Get input either from passed argument or ask user
    const text = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${todaysDateStr}`)

    const note = DataStore.calendarNoteByDate(new Date(), 'week')
    if (note != null) {
      const matchedHeading = findHeadingStartsWith(note, config.journalHeading)
      logDebug(pluginJson, `Adding '${text}' to ${displayTitle(note)} under matchedHeading '${matchedHeading}'`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', matchedHeading ? matchedHeading : config.journalHeading, true, true)
    } else {
      logError(pluginJson, `Cannot find daily note for ${todaysDateStr}`)
    }
  } catch (err) {
    logWarn(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
