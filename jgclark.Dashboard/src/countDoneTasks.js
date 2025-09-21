// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin function to find and track tasks completed today in non-calendar notes
// Last updated 2025-09-03 for v2.3.0
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDoneCount, TDoneTodayNotes, TSection } from './types'
import { todaysDateISOString } from '@helpers/dateTime'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getNotesChangedInInterval, getNoteFromFilename, getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { smartPrependPara } from '@helpers/paragraph'

//--------------------------------------------------------------------------

const changedNoteFile = '../../data/jgclark.Dashboard/todaysChangedNoteList.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.todayDoneCountsList.lastTimeThisWasRunPref'

//-----------------------------------------------------------------
// functions

/**
 * Note: replaced by final function below (updateDoneCountsFromChangedNotes())
 * TODO: However, this could still make the overall work quicker by writing to the same JSON note that does.
 * @param {Array<TSection>} sections
 */
// export function getTotalDoneCountsFromSections(sections: Array<TSection>): TDoneCount {
//   let numDoneTasks = 0
//   const startTime = new Date()
//   let latestDate: Date = new Date(0)
//   let codeStr = ''
//   for (const thisSection of sections) {
//     codeStr += `${thisSection.sectionCode}-`
//     const thisDC = thisSection.doneCounts
//     if (thisDC) {
//       numDoneTasks += thisDC.completedTasks
//       // numDoneChecklists += thisDC.completedChecklists
//       if (thisDC.lastUpdated > latestDate) latestDate = thisDC.lastUpdated
//     }
//   }
//   logTimer('getTotalDoneCountsFromSections', startTime, `to total ${numDoneTasks} done tasks from ${codeStr} / latestDate = ${latestDate.toLocaleTimeString()}`)
//   return {
//     completedTasks: numDoneTasks,
//     // completedChecklists: numDoneChecklists,
//     lastUpdated: latestDate,
//   }
// }

/**
 * Return number of completed tasks in the given (calendar or regular) note
 * @param {string} filename
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open (default: true)
 * @param {boolean} onlyCountTasksCompletedToday? only count tasks in the note completed today (default: true)
 * @returns {TDoneCount} {completedTasks, lastUpdated}
 */
export function getNumCompletedTasksFromNote(filename: string, useEditorWherePossible: boolean = true, onlyCountTasksCompletedToday: boolean = true): TDoneCount {
  try {
    // Note: This is a quick operation, so no longer needing to time
    let parasToUse: $ReadOnlyArray<TParagraph>

    //------------------------------------------------
    // Get paras from the note

    // If note of interest is open in editor, then use latest version available, as the DataStore could be stale.
    if (useEditorWherePossible && Editor && Editor.note?.filename === filename) {
      parasToUse = Editor.paragraphs
      // logDebug('getNumCompletedTasksFromNote', `Using EDITOR (${Editor.filename}) for note '${filename}`)
    } else {
      // Note: Reads note using the helper, which will work for both private and Teamspace notes
      const note = getNoteFromFilename(filename)

      if (!note) throw new Error(`Note not found: ${filename}`)
      parasToUse = note.paragraphs
      // logDebug('getNumCompletedTasksFromNote', `Processing ${note.filename}`)
    }

    // Calculate the number of closed items
    // const todaysDateISOString = todaysDateISOString()
    const RE_DONE_TODAY = new RegExp(`@done\\(${todaysDateISOString}.*\\)`)
    const RE_DONE_ANY_TIME = new RegExp(`@done\\(.*\\)`)
    const numCompletedTasks = onlyCountTasksCompletedToday
      ? parasToUse.filter((p) => p.type === 'done' && RE_DONE_TODAY.test(p.content)).length
      : parasToUse.filter((p) => p.type === 'done' && RE_DONE_ANY_TIME.test(p.content)).length

    const outputObject: TDoneCount = {
      completedTasks: numCompletedTasks,
      // completedChecklists: numCompletedChecklists,
      lastUpdated: new Date(),
    }
    // logDebug('getNumCompletedTasksFromNote', `- ${filename} -> ${String(numCompletedTasks)} done`)
    return outputObject
  } catch (error) {
    logError('getNumCompletedTasksFromNote', error.message)
    return {
      completedTasks: 0,
      lastUpdated: new Date(),
    }
  }
}

/**
 * Note: now not used
 * Build a list of ordinary (non-calendar) notes that have tasks completed today
 * @returns {Array<TDoneTodayNotes>}
 */
// export function buildListOfDoneTasksToday(): Array<TDoneTodayNotes> {
//   try {
//     const startTime = new Date()
//     const outputArr: Array<TDoneTodayNotes> = []
//     logDebug('buildListOfDoneTasksToday', `Starting at ${String(startTime)}`)

//     // Get list of regular (non-calendar) notes _updated today_ to check
//     const notesChangedToday: Array<TNote> = getNotesChangedInInterval(0, ['Notes'])
//     logDebug('buildListOfDoneTasksToday', `- after getNotesChangedInInterval(0) ${notesChangedToday.length} notes in ${timer(startTime)}`)

//     let total = 0
//     for (const note of notesChangedToday) {
//       const doneCounts = getNumCompletedTasksFromNote(note.filename, false, true)
//       const numDoneToday = doneCounts.completedTasks
//       // logTimer('buildListOfDoneTasksToday', startTime, `- found ${String(numDoneToday)} done in '${note.filename}' changed ${moment(note.changedDate).format()}`)
//       if (numDoneToday > 0) {
//         total += numDoneToday
//         outputArr.push({
//           filename: note.filename,
//           counts: {
//             completedTasks: numDoneToday,
//             lastUpdated: note.changedDate,
//           },
//         })
//       }
//     }
//     logTimer('buildListOfDoneTasksToday', startTime, `=> to find ${total} done tasks today in ordinary notes`)
//     logInfo('buildListOfDoneTasksToday', `Output:\n${outputArr.map((o) => `${o.filename} -> ${o.counts.completedTasks}`).join('\n')}\n`)
//     return outputArr
//   } catch (err) {
//     logError('buildListOfDoneTasksToday', err.message)
//     return []
//   }
// }

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
 * @param {boolean} keepPreviousData? if true, keep a copy of the previous data in a special note.  TODO: remove me later.
 */
export async function updateDoneCountsFromChangedNotes(reason: string = '', keepPreviousData: boolean = false): Promise<number> {
  try {
    const changedNoteMap: Map<string, TDoneCount> = new Map()
    let momPrevious
    const momNow = new moment()
    const startTime = new Date() // just for timing this function

    // Read current list from todaysChangedNoteList.json, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    logDebug('updateDoneCountsFromChangedNotes', `Starting: ${reason}. About to read ${changedNoteFile} ...`)
    if (DataStore.fileExists(changedNoteFile)) {
      const data = DataStore.loadData(changedNoteFile, true) ?? '{}'
      const parsedData = JSON.parse(data)
      if (parsedData.length > 0) {
        parsedData.forEach((item) => {
          changedNoteMap.set(item.filename, {
            lastUpdated: new Date(item.lastUpdated),
            completedTasks: item.completedTasks,
          })
        })
        logDebug('updateDoneCountsFromChangedNotes', `Loaded ${parsedData.length} items from ${changedNoteFile}`)
      }

      // Get last updated time from special preference
      const previousJSDate = DataStore.preference(lastTimeThisWasRunPref) ?? null
      momPrevious = previousJSDate
        ? moment(previousJSDate)
        : momNow.startOf('day') // fallback to start of today
    } else {
      logDebug('updateDoneCountsFromChangedNotes', `${changedNoteFile} does not exist, so starting a new list from start of today.`)
      momPrevious = momNow.startOf('day')
    }
    const fileAgeMins = momNow.diff(momPrevious, 'minutes')
    logDebug('updateDoneCountsFromChangedNotes', `Last updated ${fileAgeMins} mins ago (previous time: ${momPrevious.format()} / now time: ${momNow.format()})`)

    // If we're now in a different day, empty the list
    if (momNow.format('DDMMYYYY') !== momPrevious.format('DDMMYYYY')) {
      // But first, let's save a copy of this to a special note, if requested. TODO: remove me later.
      if (keepPreviousData) {
        const logNote = await getOrMakeRegularNoteInFolder('Dashboard changed note data', '@Meta')
        const noteChangesSummary = Array.from(changedNoteMap.entries()).map(([key, value]) => `- ${key} -> ${value.completedTasks}`).join('\n')
        const newLogLine = `${new Date().toLocaleString()}:\n${noteChangesSummary}`
        smartPrependPara(logNote, newLogLine, 'text')
      }
      logInfo(`updateDoneCountsFromChangedNotes`, `Now in a different day (${momNow.format('DDMMYYYY')} after ${momPrevious.format('DDMMYYYY')}), so emptying changedNote list`)
      changedNoteMap.clear()
    }

    // Find all notes updated since the last time
    // First get all notes changed today
    const recentlychangedNotes = getNotesChangedInInterval(0)

    // For each note, calculate done task count
    recentlychangedNotes.forEach((note) => {
      const doneTaskCount: TDoneCount = getNumCompletedTasksFromNote(note.filename, false, true)
      logDebug(`updateDoneCountsFromChangedNotes`, `- ${note.filename} -> ${String(doneTaskCount.completedTasks)} done`)
      // Update the map with the filename as key and an object with lastUpdated and doneCount as value
      changedNoteMap.set(note.filename, doneTaskCount)
    })
    // logDebug('updateDoneCountsFromChangedNotes', `=> checked ${recentlychangedNotes.length} updated notes`)

    // Sum the completedTasks from all map entries
    let totalCompletedTasks = 0
    changedNoteMap.forEach((value) => {
      totalCompletedTasks += value.completedTasks
    })
    logDebug(`updateDoneCountsFromChangedNotes`, `=> there are now ${changedNoteMap.size} notes changed today in the map and ${String(totalCompletedTasks)} total completed tasks`)

    // Serialise this to the JSON note, first converting Map to a full array of objects
    const mapArray = Array.from(changedNoteMap.entries()).map(([key, value]) => ({
      filename: key,
      completedTasks: value.completedTasks,
      lastUpdated: value.lastUpdated,
    }))
    const res = DataStore.saveData(JSON.stringify(mapArray), changedNoteFile, true)
    // logDebug('updateDoneCountsFromChangedNotes', `Output:\n${mapArray.map((o) => `${o.filename} -> ${o.completedTasks}`).join('\n')}\n`)

    // Update the preference for current time
    DataStore.setPreference(lastTimeThisWasRunPref, new Date())
    // logDebug('updateDoneCountsFromChangedNotes', `pref is now ${moment(DataStore.preference(lastTimeThisWasRunPref)).format()}`)

    logTimer(`updateDoneCountsFromChangedNotes`, startTime, `total runtime for updateDoneCountsFromChangedNotes`, 1000)
    return totalCompletedTasks
  } catch (err) {
    logError('updateDoneCountsFromChangedNotes', err.message)
    return 0
  }
}
