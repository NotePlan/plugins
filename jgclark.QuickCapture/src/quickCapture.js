// @flow
// ----------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update v0.14.0, 1.8.2023 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment'
import {
  getDateStringFromCalendarFilename,
  getTodaysDateUnhyphenated,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  unhyphenateString,
} from '@helpers/dateTime'
import { getNPWeekData, type NotePlanWeekInfo } from '@helpers/NPdateTime'
import { clo, logInfo, logDebug, logError, logWarn } from '@helpers/dev'
// import { displayTitle } from '@helpers/general' // use local one now
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
 * Get array of relative dates for day, week and month.
 * @author @jgclark
 * @returns {Object} relative date name, relative date string, TNote for that relative date
 */
export function getRelativeDates(): Array<Object> {
  try {
    let relativeDates = []
    const todayMom = moment()

    // Calculate relative dates. Remember to clone todayMom first as moments aren't immutable
    let thisDateStr = moment(todayMom).format('YYYYMMDD')
    relativeDates.push({ relName: 'today', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).subtract(1, 'days').startOf('day').format('YYYYMMDD')
    relativeDates.push({ relName: 'yesterday', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'days').startOf('day').format('YYYYMMDD')
    relativeDates.push({ relName: 'tomorrow', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })

    // can't start with moment as NP weeks count differently
    // $FlowIgnore[incompatible-type]
    let thisNPWeekInfo: NotePlanWeekInfo = getNPWeekData(new Date())
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'this week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), -1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'last week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), 1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'next week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })

    thisDateStr = moment(todayMom).startOf('month').format('YYYY-MM')
    relativeDates.push({ relName: 'this month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).subtract(1, 'month').startOf('month').format('YYYY-MM')
    relativeDates.push({ relName: 'last month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'month').startOf('month').format('YYYY-MM')
    relativeDates.push({ relName: 'next month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })

    thisDateStr = moment(todayMom).startOf('quarter').format('YYYY-[Q]Q')
    relativeDates.push({ relName: 'this quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format('YYYY-[Q]Q')
    relativeDates.push({ relName: 'last quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format('YYYY-[Q]Q')
    relativeDates.push({ relName: 'next quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })

    // for (const rd of relativeDates) {
    //   const noteTitle = (rd.note) ? displayTitle(rd.note) : '(error)'
    //   logDebug('getRelativeDates', `${rd.name ?? ''}: ${rd.dateStr ?? ''} / ${noteTitle}`)
    // }
    return relativeDates
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [{}] // for completeness
  }
}

const relativeDates = getRelativeDates()

/**
 * V2 of displayTitle that optionally adds the relative date string after the calendar note titles, to make it easier to spot last/this/next D/W/M/Q
 * @param {CoreNoteFields} n
 * @param {boolean} showRelativeDates? (default: false)
 * @returns {string}
 */
function displayTitle(n: CoreNoteFields, showRelativeDates: boolean = false): string {
  if (n.type === 'Calendar') {
    let calNoteTitle = getDateStringFromCalendarFilename(n.filename, false) ?? '(error)'
    if (showRelativeDates) {
      for (const rd of relativeDates) {
        if (calNoteTitle === rd.dateStr) {
          // console.log(`Found match with ${rd.relName}`)
          calNoteTitle = `${rd.dateStr}\t(📆 ${rd.relName})`
        }
      }
    }
    return calNoteTitle
  } else {
    return n.title ?? '(error)'
  }
}

/**
 * Select note from matching to 'noteTitleArg' (if given) or else ask User to select from all note titles
 * @param {string} purpose to show to user
 * @param {string?} noteTitleArg
 * @param {boolean?} justCalendarNotes?
 * @returns {TNote} note
 */
async function getNoteFromParamOrUser(
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
        const wantedNotes = allNotesSortedByChanged().filter((n) => displayTitle(n) === noteTitleToMatch)
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
          ? calendarNotes.map((n) => displayTitle(n, true)).filter(Boolean)
          : allNotes.map((n) => displayTitle(n, true)).filter(Boolean)
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
      logDebug('getNoteFromParamOrUser', `-> note '${displayTitle(note)}'`)
    }
    return note
  } catch (error) {
    logError('getNoteFromParamOrUser', error.message)
    return null
  }
}

//----------------------------------------------------------------------------
// callable functions

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
        logError('prependTaskToNote', `- Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
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
    logDebug('prependTaskToNote', `- Prepending task '${text}' to '${displayTitle(note)}'`)
    smartPrependPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `prependTaskToNote: ${err.name}: ${err.message}`)
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
        logError('appendTaskToNote', `- Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
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
    logDebug('appendTaskToNote', `- Appending task '${text}' to '${displayTitle(note)}'`)
    // note.appendTodo(text)
    smartAppendPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `appendTaskToNote: ${err.name}: ${err.message}`)
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

    let note = await getNoteFromParamOrUser('task', noteTitleArg, false)
    if (note == null) {
      return // stop if can't get note
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
    logError(pluginJson, `${err.name}: ${err.message}`)
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
    logDebug(pluginJson, `starting /qalh with arg0 '${noteTitleArg}' arg1 '${headingArg}' arg2 ${textArg != null ? '<text defined>' : '<text undefined>'}`)
    const config = await getQuickCaptureSettings()

    let note = await getNoteFromParamOrUser('text', noteTitleArg, false)
    if (note == null) {
      return // stop if can't get note
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
      note.insertParagraph(textToAdd, findEndOfActivePartOfNote(note) + 1, 'text')
    }
  }
  catch (err) {
    logError(pluginJson, `addTextToNoteHeading: ${err.name}: ${err.message}`)
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
      // change YYYY-MM-DD to YYYYMMDD, if needed
      const dateArgToMatch = dateArg.match(RE_ISO_DATE)
        ? unhyphenateString(dateArg)
        : dateArg // for regular note titles, and weekly notes
      note = DataStore.calendarNoteByDateString(dateArgToMatch)
    }
    if (note != null) {
      logDebug('prependTaskToCalendarNote', `- from dateArg, daily note = '${displayTitle(note)}'`)
    } else {
      // Get details interactively from user
      const allCalNotes = calendarNotesSortedByChanged()
      const calendarNoteTitles = allCalNotes.map((f) => displayTitle(f, true)) ?? ['error: no calendar notes found']
      const res = await CommandBar.showOptions(calendarNoteTitles, 'Select calendar note for new todo')
      dateStr = getDateStringFromCalendarFilename(allCalNotes[res.index].filename)
      note = DataStore.calendarNoteByDateString(dateStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      logDebug('prependTaskToCalendarNote', `- Prepending task '${text}' to '${displayTitle(note)}'`)
      smartPrependPara(note, text, 'open')
    } else {
      logError('prependTaskToCalendarNote', `- Can't get calendar note ${dateArg}`)
    }
  } catch (err) {
    logError(pluginJson, `prependTaskToCalendarNote: ${err.name}: ${err.message}`)
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
      // change YYYY-MM-DD to YYYYMMDD, if needed
      const dateArgToMatch = dateArg.match(RE_ISO_DATE)
        ? unhyphenateString(dateArg)
        : dateArg // for regular note titles, and weekly notes
      note = DataStore.calendarNoteByDateString(dateArgToMatch)
    }
    if (note != null) {
      logDebug('appendTaskToCalendarNote', `- from dateArg, daily note = '${displayTitle(note)}'`)
    } else {
      // Get details interactively from user
      const allCalNotes = calendarNotesSortedByChanged()
      const calendarNoteTitles = allCalNotes.map((f) => displayTitle(f, true)) ?? ['error: no calendar notes found']
      const res = await CommandBar.showOptions(calendarNoteTitles, 'Select calendar note for new todo')
      dateStr = getDateStringFromCalendarFilename(allCalNotes[res.index].filename)
      note = DataStore.calendarNoteByDateString(dateStr)
    }

    if (note != null) {
      const text = `${taskText} ${config.textToAppendToTasks}`.trimEnd()
      logDebug('appendTaskToCalendarNote', `- Appending task '${text}' to ${displayTitle(note)}`)
      smartAppendPara(note, text, 'open')
    } else {
      logError('appendTaskToCalendarNote', `- Can't get calendar note for ${dateStr}`)
    }
  } catch (err) {
    logError(pluginJson, `appendTaskToCalendarNote: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qaw
 * Quickly add to Weekly note
 * Note: Added in v0.10.0, but then hidden in v0.13.0 as all calendar notes can already be added to in /qac
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
  try {
    logDebug(pluginJson, `starting /qaj with arg0='${textArg}'`)
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
