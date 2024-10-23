// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin function to find and track tasks completed today in non-calendar notes
// Last updated 2024-07-25 for v2.0.4 by @jgclark
//-----------------------------------------------------------------------------
import type { TDoneCount, TDoneTodayNotes, TSection } from './types'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { getDateStringFromCalendarFilename, getTodaysDateHyphenated, toLocaleDateTimeString } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logTimer, timer } from '@helpers/dev'

//-----------------------------------------------------------------
// functions

/**
 * Updates the total count of completed tasks and checklists by adding the counts from all available sections.
 * @param {Array<TSection>} sections
 */
export function getTotalDoneCounts(sections: Array<TSection>): TDoneCount {
  let numDoneTasks = 0
  const startTime = new Date()
  let latestDate: Date = new Date(0)
  let codeStr = ''
  for (const thisSection of sections) {
    codeStr += `${thisSection.sectionCode}-`
    const thisDC = thisSection.doneCounts
    if (thisDC) {
      numDoneTasks += thisDC.completedTasks
      // numDoneChecklists += thisDC.completedChecklists
      if (thisDC.lastUpdated > latestDate) latestDate = thisDC.lastUpdated
    }
  }
  logTimer('getTotalDoneCounts', startTime, `to total ${numDoneTasks} done tasks from ${codeStr} / latestDate = ${latestDate.toLocaleTimeString()}`)
  return {
    completedTasks: numDoneTasks,
    // completedChecklists: numDoneChecklists,
    lastUpdated: latestDate,
  }
}

/**
 * Return number of completed tasks in the note
 * @param {string} filename
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
export function getNumCompletedTasksTodayFromNote(filename: string, useEditorWherePossible?: boolean): TDoneCount {
  try {
    let parasToUse: $ReadOnlyArray<TParagraph>
    // Note: This is a quick operation, so no longer needing to time
    // const startTime = new Date()

    //------------------------------------------------
    // Get paras from the note
    if (useEditorWherePossible && Editor && Editor?.note?.filename === filename) {
      // If note of interest is open in editor, then use latest version available, as the DataStore could be stale.
      parasToUse = Editor.paragraphs
      // logDebug('getNumCompletedTasksTodayFromNote', `Using EDITOR (${Editor.filename}) for note '${filename}`)
    } else {
      // read note from DataStore in the usual way
      let note = DataStore.projectNoteByFilename(filename)
      if (!note) {
        note = DataStore.calendarNoteByDateString(getDateStringFromCalendarFilename(filename))
      }
      if (!note) throw new Error(`Note not found: ${filename}`)
      parasToUse = note.paragraphs
      // logDebug('getNumCompletedTasksTodayFromNote', `Processing ${note.filename}`)
    }

    // Calculate the number of closed items
    const todayHyphenated = getTodaysDateHyphenated()
    const RE_DONE_TODAY = new RegExp(`@done\\(${todayHyphenated}.*\\)`)
    const numCompletedTasks = parasToUse.filter((p) => p.type === 'done' && RE_DONE_TODAY.test(p.content)).length

    const outputObject: TDoneCount = {
      completedTasks: numCompletedTasks,
      // completedChecklists: numCompletedChecklists,
      lastUpdated: new Date(),
    }
    return outputObject
  } catch (error) {
    logError('getNumCompletedTasksTodayFromNote', error.message)
    return {
      completedTasks: 0,
      // completedChecklists: 0,
      lastUpdated: new Date(),
    }
  }
}

/**
 * Build a list of ordinary (non-calendar) notes that have tasks completed today
 * @returns {Array<TDoneTodayNotes>}
 */
export function buildListOfDoneTasksToday(): Array<TDoneTodayNotes> {
  try {
    const startTime = new Date()
    const outputArr: Array<TDoneTodayNotes> = []
    // logDebug('buildListOfDoneTasksToday', `Starting at ${String(startTime)}`)

    // Get list of non-calendar notes _updated today_ to check
    const notesChangedToday: Array<TNote> = getNotesChangedInInterval(0, ['Notes'])
    // logDebug('buildListOfDoneTasksToday', `- after getNotesChangedInInterval(0) ${notesChangedToday.length} notes in ${timer(startTime)}`)

    let total = 0
    for (const note of notesChangedToday) {
      const doneCounts = getNumCompletedTasksTodayFromNote(note.filename, false)
      const numDoneToday = doneCounts.completedTasks
      // logTimer('buildListOfDoneTasksToday', startTime, `- found ${String(numDoneToday)} done in '${note.filename}' changed ${toLocaleDateTimeString(note.changedDate)}`)
      if (numDoneToday > 0) {
        total += numDoneToday
        outputArr.push({
          filename: note.filename,
          counts: {
            completedTasks: numDoneToday,
            lastUpdated: note.changedDate,
          },
        })
      }
    }
    logTimer('buildListOfDoneTasksToday', startTime, `=> to find ${total} done tasks today in ordinary notes`)
    return outputArr
  } catch (err) {
    logError('buildListOfDoneTasksToday', err.message)
    return []
  }
}

/**
 * Summarise (roll up) the doneCounts, from both available Types of done count, into a single TDoneCount.
 * Note: we're not yet using the 'lastUpdated' information, but I was planning to.
 * @param {Array<TDoneCount>} countsArr
 * @param {Array<TDoneTodayNotes>} countsNotesArr
 * @returns {TDoneCount}
 */
export function rollUpDoneCounts(countsArr: Array<TDoneCount>, countsNotesArr: Array<TDoneTodayNotes>): TDoneCount {
  try {
    const summary: TDoneCount = {
      completedTasks: 0,
      lastUpdated: new Date(0),
    }
    for (const thisCount of countsArr) {
      summary.completedTasks += thisCount.completedTasks
      if (thisCount.lastUpdated > summary.lastUpdated) summary.lastUpdated = thisCount.lastUpdated
    }
    for (const thisCount of countsNotesArr) {
      summary.completedTasks += thisCount.counts.completedTasks
      if (thisCount.counts.lastUpdated > summary.lastUpdated) summary.lastUpdated = thisCount.counts.lastUpdated
    }
    return summary
  } catch (err) {
    logError('buildListOfDoneTasks', err.message)
    return { completedTasks: 0, lastUpdated: new Date(0) }
  }
}
