// @flow
// ----------------------------------------------------------------------------
// QuickCapture plugin for NotePlan
// by Jonathan Clark
// last update 2025-08-25 for v1.0.0 by @jgclark
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getQuickCaptureSettings} from './quickCaptureHelpers'
import {
  getDisplayDateStrFromFilenameDateStr,
  getTodaysDateUnhyphenated,
  // RE_ISO_DATE,
  // convertISODateFilenameToNPDayFilename,
} from '@helpers/dateTime'
import { clo, logInfo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import {
  allNotesSortedByChanged,
  // calendarNotesSortedByChanged,
  projectNotesSortedByChanged, weeklyNotesSortedByChanged
} from '@helpers/note'
import { coreAddChecklistToNoteHeading, coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import {
  displayTitleWithRelDate,
  // getDateStrFromRelativeDateString
} from '@helpers/NPdateTime'
import { chooseNoteV2, getNoteFromParamOrUser, getOrMakeCalendarNote } from '@helpers/NPnote'
import {
  findEndOfActivePartOfNote,
  findHeadingStartsWith,
  findStartOfActivePartOfNote,
  smartAppendPara,
  smartCreateSectionsAndPara,
  smartPrependPara
} from '@helpers/paragraph'
import {chooseHeadingV2,showMessage,} from '@helpers/userInput'

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
    logDebug(pluginJson, `starting /qpt with arg0 '${noteTitleArg != null ? noteTitleArg : '<undefined>'}' arg1 '${textArg != null ? textArg : '<undefined>'}'`)
    let note: ?TNote

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
      const regularNotes = projectNotesSortedByChanged()
      // Ask user to pick a note
      // const re = await CommandBar.showOptions(notes.map((n) => displayTitleWithRelDate(n)).filter(Boolean), 'Select note to prepend')
      // note = notes[re.index]
      note = await chooseNoteV2(`Select note to prepend task to`, regularNotes, true, true, false, false)
    }
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Prepend '%@'`)

    const text = `${taskText}`.trimEnd()
    logDebug('prependTaskToNote', `- Prepending task '${text}' to '${displayTitleWithRelDate(note)}'`)
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
  logDebug(pluginJson, `starting /qat with arg0 '${noteTitleArg != null ? noteTitleArg : '<undefined>'}' arg1 '${textArg != null ? textArg : '<undefined>'}'`)
  try {
    let note: ?TNote

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
      const regularNotes = projectNotesSortedByChanged()

      // const re = await CommandBar.showOptions(regularNotes.map((n) => displayTitleWithRelDate(n)).filter(Boolean), 'Select note to append')
      // note = notes[re.index]
      note = await chooseNoteV2(`Select note to append task to`, regularNotes, true, true, false, false)
    }
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Append '%@'`)

    const text = `${taskText}`.trimEnd()
    logDebug('appendTaskToNote', `- Appending task '${text}' to '${displayTitleWithRelDate(note)}'`)
    // note.appendTodo(text)
    smartAppendPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `appendTaskToNote: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qach
 * Add a checklist to a (regular or calendar) note and heading the user picks.
 * Allows use from x-callback with some empty arguments: now asks users to supply missing arguments.
 * Note: duplicate headings not properly handled, due to NP architecture.
 * @author @jgclark
 * @param {string?} noteTitleArg note title to use (can be YYYYMMDD as well as usual calendar titles)
 * @param {string?} headingArg optional heading to put checklist under
 * @param {string?} textArg optional text to use as checklist
 * @param {string? | number?} headingLevelArg optional heading level 1-5
 */
export async function addChecklistToNoteHeading(
  noteTitleArg?: string = '',
  headingArg?: string = '',
  textArg?: string = '',
  headingLevelArg?: string | number
): Promise<void> {
  try {
    logDebug(pluginJson, `starting /qach with arg0 '${noteTitleArg}' arg1 '${headingArg}' arg2 ${textArg != null ? '<text defined>' : '<text undefined>'}`)
    const config = await getQuickCaptureSettings()
    // Start a longish sort job in the background
    CommandBar.onAsyncThread()
    const regularNotesProm: Array<TNote> = allNotesSortedByChanged() // Note: deliberately no await: this is resolved later
    CommandBar.onMainThread()// no await

    // Get text details from arg2 or user
    let checklistText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the checklist to add${noteTitleArg ? ` to ${noteTitleArg}` : ''}`, `Add checklist '%@'`)
    checklistText = `${checklistText}`.trimEnd()

    // Get heading level details from arg3 (or default to the config setting)
    const headingLevel = (headingLevelArg != null && headingLevelArg !== '' && !isNaN(headingLevelArg))
      ? Number(headingLevelArg)
      : config.headingLevel
    // logDebug('addChecklistToNoteHeading(qach)', `headingLevel: ${String(headingLevel)}`)

    // Get note details from arg0 or user
    const regularNotes = await regularNotesProm // here's where we resolve the promise and have the sorted list
    // V1:
    // let note: TNote
    // if (noteTitleArg != null && noteTitleArg !== '') {
    //   const possDateStr = getDateStrFromRelativeDateString(noteTitleArg)
    //   logDebug('addChecklistToNoteHeading(qach)', `- possDateStr '${possDateStr}' (from relative date string '${noteTitleArg}')`)
    //   if (possDateStr !== '') {
    //     const matchingDateNotes = DataStore.calendarNoteByDateString(possDateStr)
    //     if (matchingDateNotes != null && matchingDateNotes.length > 0) {
    //       note = matchingDateNotes[0]
    //       logDebug('addChecklistToNoteHeading(qach)', `Will use matching calendar note '${possDateStr}' (from relative date string '${noteTitleArg}')`)
    //     } else {
    //       throw new Error(`Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
    //     }
    //   }
    //   const matchingTitleNotes = DataStore.projectNoteByTitle(noteTitleArg, true, false)
    //   if (matchingTitleNotes != null && matchingTitleNotes.length > 0) {
    //     note = matchingTitleNotes[0]
    //     logDebug('addChecklistToNoteHeading(qach)', `Will use first matching note with title '${noteTitleArg}' -> filename '${note.filename}'`)
    //   } else {
    //     throw new Error(`Couldn't find note '${noteTitleArg}' from x-callback args. Stopping.`)
    //   }
    // } else {
    //   const regularNotes = await regularNotesProm // here's where we resolve the promise and have the sorted list
    //   // Ask user to pick a note
    //   note = await chooseNoteV2(`Select note for new checklist`, regularNotes, true, true, false, false)
    // }
    // if (note == null) {
    //   throw new Error(`Couldn't get a valid note, Stopping.`)
    // }
    // V2:
    const note = await getNoteFromParamOrUser('Select note for new checklist', noteTitleArg, regularNotes)
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }
    logDebug('addTaskToNoteHeading(qath)', `Will use note '${displayTitle(note)}' for new checklist`)

    // Get heading details from arg1 or user
    // If we're asking user, we use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg != null && headingArg !== '')
      ? headingArg
      : await chooseHeadingV2(note, true, true, false)

    // Call helper to do the main work
    coreAddChecklistToNoteHeading(note, heading, checklistText, headingLevel, config.shouldAppend)
  } catch (err) {
    logError(pluginJson, `addChecklistToNoteHeading: ${err.name}: ${err.message}`)
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
 * @param {string?} headingArg optional heading to put task under
 * @param {string?} textArg optional task text
 * @param {string? | number?} headingLevelArg optional heading level 1-5
 */
export async function addTaskToNoteHeading(
  noteTitleArg?: string = '',
  headingArg?: string = '',
  textArg?: string = '',
  headingLevelArg?: string | number
): Promise<void> {
  try {
    logDebug(pluginJson, `starting /qath with arg0 '${noteTitleArg != null ? noteTitleArg : '<undefined>'}' arg1 '${headingArg != null ? headingArg : '<undefined>'}' arg2 '${textArg != null ? textArg : '<undefined>'}' arg3 '${headingLevelArg != null ? headingLevelArg : '<undefined>'}'`)
    const config = await getQuickCaptureSettings()

    // Start a longish sort job in the background
    CommandBar.onAsyncThread()
    const regularNotesProm: Array<TNote> = projectNotesSortedByChanged() // Note: deliberately no await: this is resolved later
    CommandBar.onMainThread()// no await

    // Get text details from arg2 or user
    let taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task to add${noteTitleArg ? ` to ${noteTitleArg}` : ''}`, `Add task '%@'`)
    taskText = `${taskText}`.trimEnd()

    // Get heading level details from arg3 (or default to the config setting)
    const headingLevel = (headingLevelArg != null && headingLevelArg !== '' && !isNaN(headingLevelArg))
      ? Number(headingLevelArg)
      : config.headingLevel

    // Get note details from arg0 or user
    const regularNotes = await regularNotesProm // here's where we resolve the promise and have the sorted list
    // V1:
    // const note = await chooseNoteV2(`Select note for new task`, regularNotes, true, true, false, false)
    // V2:
    const note = await getNoteFromParamOrUser('Select note for new task', noteTitleArg, regularNotes)
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }
    logDebug('addTaskToNoteHeading(qath)', `-> '${displayTitle(note)}'`)

    // Get heading details from arg1 or user
    // If we're asking user, we use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg != null && headingArg !== '')
      ? headingArg
      : await chooseHeadingV2(note, true, true, false)

    // Call helper to do the main work
    coreAddTaskToNoteHeading(note, heading, taskText, headingLevel, config.shouldAppend)
  } catch (err) {
    logError(pluginJson, `addTaskToNoteHeading: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qalh
 * Add general text to a regular note's heading the user picks.
 * Extended in v0.9 to allow use from x-callback with three passed arguments.
 * Extended in v0.10 to allow use from x-callback with some empty arguments: now asks users to supply missing arguments.
 * Note: duplicate headings not properly handled, due to NP architecture.
 *
 * @author @jgclark
 * @param {string?} noteTitleArg note title to use (can be YYYY-MM-DD or YYYYMMDD)
 * @param {string?} headingArg
 * @param {string?} textArg
 * @param {string?} headingLevelArg
 */
export async function addTextToNoteHeading(
  noteTitleArg?: string = '',
  headingArg?: string = '',
  textArg?: string = '',
  headingLevelArg?: string = ''
): Promise<void> {
  try {
    logDebug(pluginJson, `starting /qalh with arg0 '${noteTitleArg}' arg1 '${headingArg}' arg2 ${textArg != null ? '<text defined>' : '<text undefined>'} arg3 ${headingLevelArg}`)
    const config = (await getQuickCaptureSettings())||{}

    // Start a longish sort job in the background
    CommandBar.onAsyncThread()
    // logDebug('', `on async thread`)
    const regularNotesProm: Array<TNote> = projectNotesSortedByChanged() // Note: deliberately no await: this is resolved later
    CommandBar.onMainThread()// no await
    // logDebug('', `back on main thread`)

    // Get text details from arg2 or user
    const textToAdd = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@'`)

    // Get heading level details from arg3
    const headingLevel = (headingLevelArg != null && headingLevelArg !== '' && !isNaN(headingLevelArg))
      ? Number(headingLevelArg)
      : config.headingLevel
    logDebug('addTextToNoteHeading(qalh)', `headingLevel: ${String(headingLevel)}`)

    // Get note details from arg0 or user
    const regularNotes = await regularNotesProm // here's where we resolve the promise and have the sorted list
    // V1:
    // const note = await chooseNoteV2(`Select note for new text`, regularNotes, true, true, false, false)
    // V2:
    const note = await getNoteFromParamOrUser('Select note for new text', noteTitleArg, regularNotes)
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }
    logDebug('addTextToNoteHeading(qalh)', `-> '${displayTitle(note)}'`)

    // Get heading details from arg1 or user
    // If we're asking user, we use function that allows us to first add a new heading at start/end of note
    const heading = (headingArg != null && headingArg !== '')
      ? headingArg
      : await chooseHeadingV2(note, true, true, false, headingLevel)

    // Call helper to do the main work
    coreAddTaskToNoteHeading(note, heading, textToAdd, headingLevel, config.shouldAppend)
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
    // Get text to use from arg1 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Prepend task '%@'`)

    // Get note details from arg0 or user
    // V1:
    // let note: ?TNote
    // if (dateArg != null && dateArg !== '') {
    //   // change YYYY-MM-DD to YYYYMMDD, if needed
    //   const dateArgToMatch = dateArg.match(RE_ISO_DATE)
    //     ? convertISODateFilenameToNPDayFilename(dateArg)
    //     : dateArg // for regular note titles, and weekly notes
    //   note = DataStore.calendarNoteByDateString(dateArgToMatch)
    // } else {
    //   note = await chooseNoteV2(`Select note for new task`, [], true, true, false, false)
    // }
    // V2:
    const note = await getOrMakeCalendarNote(dateArg)
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }
    logDebug('addTaskToNoteHeading(qath)', `-> '${displayTitle(note)}'`)

    const text = `${taskText}`.trimEnd()
    logDebug('prependTaskToCalendarNote', `- Prepending task '${text}' to '${displayTitleWithRelDate(note)}'`)
    smartPrependPara(note, text, 'open')
  } catch (err) {
    logError(pluginJson, `prependTaskToCalendarNote: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qac
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
    // Get text to use from arg1 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Append task '%@'`)

    // Get note details from arg0 or user
    // V1:
    // let note: ?TNote
    // if (dateArg != null && dateArg !== '') {
    //   // change YYYY-MM-DD to YYYYMMDD, if needed
    //   const dateArgToMatch = dateArg.match(RE_ISO_DATE)
    //     ? convertISODateFilenameToNPDayFilename(dateArg)
    //     : dateArg // for regular note titles, and weekly notes
    //   note = DataStore.calendarNoteByDateString(dateArgToMatch)
    // } else {
    //   note = await chooseNoteV2(`Select note for new task`, [], true, true, false, false)
    // }
    // V2:
    const note = await getOrMakeCalendarNote(dateArg)
    if (note == null) {
      throw new Error(`Couldn't get a valid note, Stopping.`)
    }
    logDebug('appendTaskToCalendarNote', `- from dateArg, daily note = '${displayTitleWithRelDate(note)}'`)

    const text = `${taskText}`.trimEnd()
    logDebug('appendTaskToCalendarNote', `- Appending task '${text}' to ${displayTitleWithRelDate(note)}`)
    smartAppendPara(note, text, 'open')
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
    let note: ?TNote
    let weekStr = ''

    // Get text to use from arg0 or user
    const taskText = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput(`Type the task`, `Add task '%@'`)

    // Get weekly note to use
    if (dateArg != null && dateArg !== '') {
      note = DataStore.calendarNoteByDateString(dateArg)
    }
    if (note != null) {
      logDebug(pluginJson, `- from dateArg, weekly note = '${displayTitleWithRelDate(note)}'`)
    } else {
      // Get details interactively from user
      const weeklyNoteTitles = weeklyNotesSortedByChanged().map((f) => f.filename) ?? ['error: no weekly notes found']
      const res = await CommandBar.showOptions(weeklyNoteTitles, 'Select weekly note for new todo')
      weekStr = res.value
      note = DataStore.calendarNoteByDateString(weekStr)
    }

    if (note != null) {
      const text = `${taskText}`.trimEnd()
      logDebug(pluginJson, `- appending task '${text}' to ${displayTitleWithRelDate(note)}`)
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
    const journalHeading = config.journalHeading || ''
    logDebug('appendTextToDailyJournal', `journalHeading = ${journalHeading}`)
    // Get input either from passed argument or ask user
    const text = (textArg != null && textArg !== '')
      ? textArg
      : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${todaysDateStr}`)

    const note = DataStore.calendarNoteByDate(new Date(), 'day')
    if (note != null) {
      const matchedHeading = findHeadingStartsWith(note, journalHeading)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      const headingToUse = matchedHeading ? matchedHeading : journalHeading
      logDebug(pluginJson, `Adding '${text}' to ${displayTitleWithRelDate(note)} with matchedHeading '${matchedHeading}' to heading '${headingToUse}' at level ${config.headingLevel}`)
      smartCreateSectionsAndPara(note, text, 'text', [headingToUse], config.headingLevel, config.shouldAppend)
    } else {
      throw new Error(`Cannot find daily note for ${todaysDateStr}`)
    }
  } catch (err) {
    logWarn(pluginJson, `appendTextToDailyJournal: ${err.name}: ${err.message}`)
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
    const note = DataStore.calendarNoteByDate(new Date(), 'week')
    if (note != null) {
      const todaysDateStr = getTodaysDateUnhyphenated()
      const config = await getQuickCaptureSettings()
      const journalHeading = config.journalHeading || ''

      // Get input either from passed argument or ask user
      const text = (textArg != null && textArg !== '')
        ? textArg
        : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${todaysDateStr}`)

      const matchedHeading = findHeadingStartsWith(note, journalHeading)
      logDebug(pluginJson, `Adding '${text}' to ${displayTitleWithRelDate(note)} under matchedHeading '${matchedHeading}'`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', matchedHeading ? matchedHeading : journalHeading, true, true)
    } else {
      throw new Error(`Cannot find current weekly note`)
    }
  } catch (err) {
    logWarn(pluginJson, `appendTextToWeeklyJournal: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qajm
 * Quickly append text to this month's journal
 * @author @jgclark
 * @param {string?} textArg
 */
export async function appendTextToMonthlyJournal(textArg?: string = ''): Promise<void> {
  logDebug(pluginJson, `starting /qajm with arg0='${textArg}'`)
  try {
    const note = DataStore.calendarNoteByDate(new Date(), 'month')
    if (note != null) {
      const dateStr = getDisplayDateStrFromFilenameDateStr(note.filename) ?? ''
      const config = await getQuickCaptureSettings()
      const journalHeading = config.journalHeading || ''

      // Get input either from passed argument or ask user
      const text = (textArg != null && textArg !== '')
        ? textArg
        : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${dateStr}`)

      const matchedHeading = findHeadingStartsWith(note, journalHeading)
      logDebug(pluginJson, `Adding '${text}' to ${displayTitleWithRelDate(note)} under matchedHeading '${matchedHeading}'`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', matchedHeading ? matchedHeading : journalHeading, true, true)
    } else {
      throw new Error(`Cannot find current monthly note`)
    }
  } catch (err) {
    logWarn(pluginJson, `appendTextToMonthlyJournal: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/** /qajy
 * Quickly append text to this year's journal
 * @author @jgclark
 * @param {string?} textArg
 */
export async function appendTextToYearlyJournal(textArg?: string = ''): Promise<void> {
  logDebug(pluginJson, `starting /qajy with arg0='${textArg}'`)
  try {
    const note = DataStore.calendarNoteByDate(new Date(), 'year')
    if (note != null) {
      const dateStr = getDisplayDateStrFromFilenameDateStr(note.filename) ?? ''
      const config = await getQuickCaptureSettings()
      const journalHeading = config.journalHeading || ''
      // Get input either from passed argument or ask user
      const text = (textArg != null && textArg !== '')
        ? textArg
        : await CommandBar.showInput('Type the text to add', `Add text '%@' to ${dateStr}`)

      const matchedHeading = findHeadingStartsWith(note, journalHeading)
      logDebug(pluginJson, `Adding '${text}' to ${displayTitleWithRelDate(note)} under matchedHeading '${matchedHeading}'`)
      // Add text to the heading in the note (and add the heading if it doesn't exist)
      note.addParagraphBelowHeadingTitle(text, 'empty', matchedHeading ? matchedHeading : journalHeading, true, true)
    } else {
      throw new Error(`Cannot find current yearly note`)
    }
  } catch (err) {
    logWarn(pluginJson, `appendTextToYearlyJournal: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}
