// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin function to find and track tasks completed today in non-calendar notes
// Last updated for v2.1.0.a
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDoneCount, TDoneTodayNotes, TSection } from './types'
import { getDateStringFromCalendarFilename, getTodaysDateHyphenated } from '@np/helpers/dateTime'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logTimer, logWarn } from '@np/helpers/dev'
import { getNotesChangedInInterval } from '@np/helpers/NPnote'

//--------------------------------------------------------------------------

const changedNoteFile = 'todaysChangedNoteList.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.lastTimeThisWasRunPref'

//-----------------------------------------------------------------
// functions

/**
 * Note: replaced by final function below.
 * TODO: However, this could still make the overall work quicker by writing to the same JSON note that does.
 * @param {Array<TSection>} sections
 */
export function getTotalDoneCountsFromSections(sections: Array<TSection>): TDoneCount {
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
  logTimer('getTotalDoneCountsFromSections', startTime, `to total ${numDoneTasks} done tasks from ${codeStr} / latestDate = ${latestDate.toLocaleTimeString()}`)
  return {
    completedTasks: numDoneTasks,
    // completedChecklists: numDoneChecklists,
    lastUpdated: latestDate,
  }
}

/**
 * Return number of completed tasks in the given (calendar or regular) note
 * @param {string} filename
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open
 * @returns {TDoneCount} {completedTasks, lastUpdated}
 */
export function getNumCompletedTasksTodayFromNote(filename: string, useEditorWherePossible?: boolean): TDoneCount {
  try {
    let parasToUse: ReadonlyArray<TParagraph>
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
  } catch (error: any) {
    logError('getNumCompletedTasksTodayFromNote', error.message)
    return {
      completedTasks: 0,
      // completedChecklists: 0,
      lastUpdated: new Date(),
    }
  }
}

/**
 * Note: now not used
 * Build a list of ordinary (non-calendar) notes that have tasks completed today
 * @returns {Array<TDoneTodayNotes>}
 */
export function buildListOfDoneTasksToday(): Array<TDoneTodayNotes> {
  try {
    const startTime = new Date()
    const outputArr: Array<TDoneTodayNotes> = []
    // logDebug('buildListOfDoneTasksToday', `Starting at ${String(startTime)}`)

    // Get list of regular (non-calendar) notes _updated today_ to check
    const notesChangedToday: Array<TNote> = getNotesChangedInInterval(0, ['Notes'])
    // logDebug('buildListOfDoneTasksToday', `- after getNotesChangedInInterval(0) ${notesChangedToday.length} notes in ${timer(startTime)}`)

    let total = 0
    for (const note of notesChangedToday) {
      const doneCounts = getNumCompletedTasksTodayFromNote(note.filename, false)
      const numDoneToday = doneCounts.completedTasks
      logTimer('buildListOfDoneTasksToday', startTime, `- found ${String(numDoneToday)} done in '${note.filename}' changed ${moment(note.changedDate).format()}`)
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
    for (const thisDC of countsArr) {
      summary.completedTasks += thisDC.completedTasks
      if (thisDC.lastUpdated > summary.lastUpdated) summary.lastUpdated = thisDC.lastUpdated
    }
    for (const thisDC of countsNotesArr) {
      summary.completedTasks += thisDC.counts.completedTasks
      if (thisDC.counts.lastUpdated > summary.lastUpdated) summary.lastUpdated = thisDC.counts.lastUpdated
    }
    return summary
  } catch (err) {
    logError('rollUpDoneCounts', err.message)
    return { completedTasks: 0, lastUpdated: new Date(0) } // to pacify flow
  }
}

/**
 * Returns a count of all completed tasks today.
 * It does this by keeping and updating a list of all notes changed today, and the number of completed tasks it contains.
 * It works smartly: it only recalculates notes that have been updated since the last time this was run, according to JS date saved in 'lastTimeThisWasRunPref'.
 * @param {string?} reason for calling this
 * @returns {TDoneCount} An object containing the total number of completed tasks and the last updated date.
 */
export function updateDoneCountsFromChangedNotes(reason: string = ''): number {
  try {
    const changedNoteMap: Map<string, TDoneCount> = new Map()
    let momPrevious
    const momNow = new moment()
    const startTime = new Date() // just for timing this function

    // Read current list from todaysChangedNoteList.json, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    logInfo('updateDoneCountsFromChangedNotes', `Starting: ${reason}`)
    // logDebug('updateDoneCountsFromChangedNotes', `About to read ${changedNoteFile} ...`)
    if (DataStore.fileExists(changedNoteFile)) {
      const data = DataStore.loadData(changedNoteFile, true) ?? ''
      const parsedData = JSON.parse(data)
      parsedData.forEach(item => {
        changedNoteMap.set(item.filename, {
          lastUpdated: new Date(item.lastUpdated),
          completedTasks: item.completedTasks
        })
      })
      logDebug('updateDoneCountsFromChangedNotes', `Loaded ${parsedData.length} items from ${changedNoteFile}`)

      // Get last updated time from special preference
      const previousJSDate = DataStore.preference(lastTimeThisWasRunPref) ?? null
      momPrevious = moment(previousJSDate)
    } else {
      logDebug('updateDoneCountsFromChangedNotes', `${changedNoteFile} does not exist, so starting a new list from start of today.`)
      momPrevious = momNow.startOf('day')
    }
    const fileAgeMins = momNow.diff(momPrevious, 'minutes')
    logDebug('updateDoneCountsFromChangedNotes', `Last updated ${fileAgeMins} mins ago (previous time: ${momPrevious.format()} / now time: ${momNow.format()})`)

    // If we're now in a different day, empty the list
    if (momNow.format('DDMMYYYY') !== momPrevious.format('DDMMYYYY')) {
      logInfo(`updateDoneCountsFromChangedNotes`, `Now in a different day (${momNow.format('DDMMYYYY')} after ${momPrevious.format('DDMMYYYY')}), so emptying changedNote list`)
      changedNoteMap.clear()
    }

    // Find all notes updated since the last time
    // First get all notes changed today, and filter down further
    const jsdateToStartLooking = momPrevious.toDate()
    const recentlychangedNotes = getNotesChangedInInterval(0).filter((n) => n.changedDate >= jsdateToStartLooking)

    // For each note, calculate done task count
    logDebug(`updateDoneCountsFromChangedNotes`, `Checking notes for completed tasks today:`)
    recentlychangedNotes.forEach(note => {
      const doneTaskCount: TDoneCount = getNumCompletedTasksTodayFromNote(note.filename, false)
      // logDebug(`updateDoneCountsFromChangedNotes`, `- ${note.filename} -> ${String(doneTaskCount.completedTasks)} done`)
      // Update the map with the filename as key and an object with lastUpdated and doneCount as value
      changedNoteMap.set(note.filename, doneTaskCount)
    })
    logDebug('updateDoneCountsFromChangedNotes', `=> checked ${recentlychangedNotes.length} updated notes`)

    // Sum the completedTasks from all map entries
    let totalCompletedTasks = 0
    changedNoteMap.forEach(value => {
      totalCompletedTasks += value.completedTasks
    })
    logInfo(`updateDoneCountsFromChangedNotes`, `=> there are now ${changedNoteMap.size} notes changed today in the map and ${String(totalCompletedTasks)} total completed tasks`)
    logTimer(`in`, startTime, ``)

    // Serialise this to the JSON note, first converting Map to a full array of objects
    const mapArray = Array.from(changedNoteMap.entries()).map(([key, value]) => ({
      filename: key, completedTasks: value.completedTasks,
      lastUpdated: value.lastUpdated
    }))
    const res = DataStore.saveData(JSON.stringify(mapArray), changedNoteFile, true)

    // Update the preference for current time
    DataStore.setPreference(lastTimeThisWasRunPref, new Date())
    // logDebug('updateDoneCountsFromChangedNotes', `pref is now ${moment(DataStore.preference(lastTimeThisWasRunPref)).format()}`)

    return totalCompletedTasks
  } catch (err) {
    logError('updateDoneCountsFromChangedNotes', err.message)
    return 0
  }
}