// @flow
//-----------------------------------------------------------------------------
// Weekly per-folder area/project progress stats written to CSV in @Reviews
// Writes the weekly progress of projects and areas to a CSV in @Reviews, with a structure:
// - First table: notes-per-week (distinct notes with at least one completed task)
// - Second table: tasks-per-week (total completed tasks)
// Columns: successive week labels (e.g. 2026-W06)
// Rows: folder names in alphabetical order
//
// Last updated 2026-02-06 for v1.3.0.b5 by @jgclark (spec) + @cursor (implementation)
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import {
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  convertISOToYYYYMMDD,
  YYYYMMDDDateStringFromDate,
} from '@helpers/dateTime'
import { getNPWeekData, pad } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, timer } from '@helpers/dev'
import { getRegularNotesFromFilteredFolders, getFolderFromFilename } from '@helpers/folders'
import { isDone } from '@helpers/utils'

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const DEFAULT_NUM_WEEKS: number = 26
const PROJECT_FOLDER_MATCHERS: Array<string> = ['area', 'project']
const PROGRESS_PER_FOLDER_FILENAME: string = 'progress-per-folder.csv'
const TASK_COMPLETION_PER_FOLDER_FILENAME: string = 'task-completion-per-folder.csv'

//-----------------------------------------------------------------------------
// Types

type WeekInfo = {
  label: string, // e.g. 2026-W06
  startDate: Date,
  endDate: Date,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Compute the last N NotePlan weeks (including the current week) using getNPWeekData().
 * Returns an array ordered from oldest to newest, each with a week label and JS start/end dates.
 * @author @cursor
 *
 * @param {number} numWeeks
 * @returns {Array<WeekInfo>}
 */
export function getLastNWeeks(numWeeks: number = DEFAULT_NUM_WEEKS): Array<WeekInfo> {
  try {
    const weeks: Array<WeekInfo> = []
    const today = new Date()

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekData = getNPWeekData(today, -i, 'week')
      if (!weekData) {
        logError(pluginJson, `getLastNWeeks: getNPWeekData() returned null for offset ${String(-i)}`)
        continue
      }
      const label = `${String(weekData.weekYear)}-W${pad(weekData.weekNumber)}`
      weeks.push({
        label,
        startDate: weekData.startDate,
        endDate: weekData.endDate,
      })
    }

    logDebug(pluginJson, `getLastNWeeks: generated ${String(weeks.length)} weeks`)
    return weeks
  } catch (error) {
    logError(pluginJson, `getLastNWeeks: ${error.message}`)
    return []
  }
}

/**
 * Does a folder name count as an Area/Project folder? (case-insensitive substring match)
 * @param {string} folderName
 * @returns {boolean}
 */
function isAreaOrProjectFolder(folderName: string): boolean {
  const lc = folderName.toLowerCase()
  return PROJECT_FOLDER_MATCHERS.some((matcher) => lc.includes(matcher))
}

/**
 * Determine which week (if any) a given ISO date string (YYYY-MM-DD) falls into.
 * Returns the week label or empty string if not in range.
 * @param {string} isoDate
 * @param {Array<WeekInfo>} weeks
 * @returns {string}
 */
function getWeekLabelForISODate(isoDate: string, weeks: Array<WeekInfo>): string {
  if (!isoDate || weeks.length === 0) return ''
  const yyyymmdd = convertISOToYYYYMMDD(isoDate)
  for (const w of weeks) {
    const startStr = YYYYMMDDDateStringFromDate(w.startDate)
    const endStr = YYYYMMDDDateStringFromDate(w.endDate)
    if (yyyymmdd >= startStr && yyyymmdd <= endStr) {
      return w.label
    }
  }
  return ''
}

/**
 * Helper to build a folder/week key for Maps.
 * @param {string} folder
 * @param {string} weekLabel
 * @returns {string}
 */
function makeFolderWeekKey(folder: string, weekLabel: string): string {
  return `${folder}::${weekLabel}`
}

/**
 * Parse a @done(YYYY-MM-DD ...) date from paragraph content.
 * Returns the ISO date part or empty string.
 * @param {string} content
 * @returns {string}
 */
function getDoneISODateFromContent(content: string): string {
  if (!content || !content.match(RE_DONE_DATE_OPT_TIME)) return ''
  const reReturnArray = content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
  const doneDate = reReturnArray[1]
  return typeof doneDate === 'string' ? doneDate : ''
}

/**
 * Generate weekly Project/Area progress stats per relevant folder for the last N weeks. Returns two arrays of strings:
 * - First array: notes-per-week (distinct notes with at least one completed task)
 * - Second array: tasks-per-week (total completed tasks)
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<Array<string>>}
 */
async function generateProjectsWeeklyProgressLines(): Promise<[Array<string>, Array<string>]>
{
  try {
    logDebug(pluginJson, `generateProjectsWeeklyProgressLines: starting`)
    const startTime = new Date()
    const config: ReviewConfig = await getReviewSettings()
    const foldersToExclude = config.foldersToIgnore ?? []

    // 1. Week range (last 12 weeks, including current)
    const weeks: Array<WeekInfo> = getLastNWeeks(DEFAULT_NUM_WEEKS)
    if (weeks.length === 0) {
      throw new Error('No week range could be calculated')
    }
    const weekLabels: Array<string> = weeks.map((w) => w.label)

    // 2. Get all regular notes from filtered folders (respecting existing Summaries exclusions)
    const allNotes = getRegularNotesFromFilteredFolders(foldersToExclude, true)
    logDebug(pluginJson, `projectsWeeklyProgressCSV: considering ${String(allNotes.length)} regular notes`)

    // 3. Filter notes to those whose folder name contains 'Area' or 'Project'
    const folderSet: Set<string> = new Set()
    const notesInTargetFolders = allNotes.filter((n) => {
      const folderPath = getFolderFromFilename(n.filename)
      // const baseFolder = folderPath === '/' ? '/' : folderPath.split('/').pop() ?? folderPath
      if (isAreaOrProjectFolder(folderPath)) {
        folderSet.add(folderPath)
        return true
      }
      return false
    })
    const folders: Array<string> = Array.from(folderSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    logInfo(pluginJson, `projectsWeeklyProgressCSV: found ${String(folders.length)} Area/Project folders and ${String(notesInTargetFolders.length)} notes in them`)

    if (folders.length === 0) {
      logInfo(pluginJson, `projectsWeeklyProgressCSV: no Area/Project folders found – nothing to write`)
      return [[], []]
    }

    // 4. Aggregation structures
    const notesPerWeekMap: Map<string, Set<string>> = new Map() // key: folder::week -> set of note filenames
    const tasksPerWeekMap: Map<string, number> = new Map() // key: folder::week -> task count

    // 5. Scan notes and paragraphs
    for (const note of notesInTargetFolders) {
      const folderPath = getFolderFromFilename(note.filename)
      const baseFolder = folderPath === '/' ? '/' : folderPath.split('/').pop() ?? folderPath

      for (const p of note.paragraphs) {
        if (!isDone(p)) continue
        const doneISO = getDoneISODateFromContent(p.content)
        if (!doneISO) continue

        const weekLabel = getWeekLabelForISODate(doneISO, weeks)
        if (!weekLabel) continue

        const key = makeFolderWeekKey(baseFolder, weekLabel)

        // tasks-per-week
        const currentTasks = tasksPerWeekMap.get(key) ?? 0
        tasksPerWeekMap.set(key, currentTasks + 1)

        // notes-per-week (distinct notes)
        const noteSet = notesPerWeekMap.get(key) ?? new Set()
        noteSet.add(note.filename)
        notesPerWeekMap.set(key, noteSet)
      }
    }

    // 6. Build CSV tables
    const notesRows: Array<string> = [
      ['Folder / Notes progressed per week', ...weekLabels].join(','),
    ]
    const tasksRows: Array<string> = [
      ['Folder / Tasks completed per week', ...weekLabels].join(','),
    ]

    for (const folderName of folders) {
      const noteCounts: Array<string> = []
      const taskCounts: Array<string> = []

      for (const weekLabel of weekLabels) {
        const key = makeFolderWeekKey(folderName, weekLabel)
        const noteSet = notesPerWeekMap.get(key)
        const noteCount = noteSet ? noteSet.size : 0
        const taskCount = tasksPerWeekMap.get(key) ?? 0
        noteCounts.push(String(noteCount))
        taskCounts.push(String(taskCount))
      }

      // Note: surround folder name with quotes in case folder name contains commas
      notesRows.push([`"${folderName}"`].concat(noteCounts).join(','))
      tasksRows.push([`"${folderName}"`].concat(taskCounts).join(','))
    }
    logInfo(pluginJson, `projectsWeeklyProgressCSV: generated ${String(notesRows.length)} notes rows and ${String(tasksRows.length)} tasks rows in ${timer(startTime)}`)
    return [notesRows, tasksRows]
  } catch (error) {
    logError(pluginJson, `projectsWeeklyProgressCSV: ${error.message}`)
    throw error
  }
}

//-----------------------------------------------------------------------------
// Main command

/**
 * Generate weekly Area/Project folder progress stats for the last N weeks and write them as CSV to two fixed notes in the (hidden) plugin data folder.
 * The two notes are:
 * - First note: notes-per-week (distinct notes with at least one completed task)
 * - Second note: tasks-per-week (total completed tasks)
 *
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<void>}
 */
export async function writeProjectsWeeklyProgressToCSV(): Promise<void> {
  try {
    logDebug(pluginJson, `projectsWeeklyProgressCSV: starting`)

    const [notesRows, tasksRows] = await generateProjectsWeeklyProgressLines()

    // First prepare and write the notes-per-week CSV
    const notesCsvString = notesRows.join('\n')
    await DataStore.saveData(notesCsvString, PROGRESS_PER_FOLDER_FILENAME, true)

    // Then prepare and write the tasks-per-week CSV
    const tasksCsvString = tasksRows.join('\n')
    await DataStore.saveData(tasksCsvString, TASK_COMPLETION_PER_FOLDER_FILENAME, true)

    logInfo(pluginJson, `projectsWeeklyProgressCSV: written weekly progress CSV to '${PROGRESS_PER_FOLDER_FILENAME}' and '${TASK_COMPLETION_PER_FOLDER_FILENAME}'`)
  } catch (error) {
    logError(pluginJson, `projectsWeeklyProgressCSV: ${error.message}`)
    throw error
  }
}
