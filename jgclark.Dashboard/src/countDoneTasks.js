// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin functions to count tasks completed today, across all notes,
// and to count the tasks completed in a particular note.
// Last updated 2026-08-19 for v2.4.0.b65 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import type { TDoneCount, TDoneDateFilter, TDoneTodayNotes } from './types'
import {
  findScheduledDates,
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getNPYearStr,
  getPeriodOfNPDateStr,
  RE_DAILY_NOTE_FILENAME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  RE_MONTHLY_NOTE_FILENAME,
  RE_QUARTERLY_NOTE_FILENAME,
  RE_WEEKLY_NOTE_FILENAME,
  RE_YEARLY_NOTE_FILENAME,
  todaysDateISOString,
  weekStartDateStr,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { sendBannerMessage } from '@helpers/HTMLView'
import { getNotesChangedInInterval, getNoteFromFilename } from '@helpers/NPnote'
import { getNumericPriorityFromPara } from '@helpers/sorting'

//--------------------------------------------------------------------------

/**
 * Design Assumptions on done tasks:
 *
 * Section doneCounts are not scoped to "items that would appear in this section under the current perspective."
 *
 * Classification axes for a completed paragraph:
 * - completedOn: date from @done(YYYY-MM-DD)
 * - periodAffinity: remaining >schedule tag, else calendar-note placement, else other/unscheduled
 * - isWin: paragraph priority vs configured winsPriorityMarker
 *
 * Header totalDoneCount (from updateDoneCountsFromChangedNotes) = all tasks completed today anywhere
 * (notes changed today), not perspective-scoped. Includes project notes.
 *
 * Timing: updateDoneCountsFromChangedNotes walks every note changed today (getNotesChangedInInterval(0)
 * is typically >1s) and is synchronous. Do not call it before the React window is shown. Seed the header
 * from getCachedHeaderDoneCount() (JSON read only) and run the full recount after sections have been sent.
 *
 * DT section progress (getDoneCountsForToday) uses forToday affinity + @done(today), not the global total.
 * The same JSON also exposes forOtherPeriod and completedWins.
 *
 * DY / W / LW / M / Q / Y use getNumCompletedTasksFromCalendarNote: completions in that calendar note
 * whose @done date falls inside the period covered by the note (yesterday for DY, week range for W/LW, etc.).
 *
 * WINS remains a React-only synthetic section of open win items. Completed-win counts come from
 * completedWins on the today breakdown (attached to WINS when injected).
 */

//--------------------------------------------------------------------------

const CHANGED_NOTE_FILE = '../../data/jgclark.Dashboard/todaysChangedNoteList.json'
const LAST_TIME_THIS_WAS_RUN_PREF = 'jgclark.Dashboard.todayDoneCountsList.lastTimeThisWasRunPref'

/** Period affinity for a completed task relative to "now". */
export type TPeriodAffinity = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'other'

//-----------------------------------------------------------------
// Private helpers

/**
 * Map winsPriorityMarker to NotePlan numeric priority.
 * @param {string} marker - '>>' | '!!!' | '!!'
 * @returns {number}
 */
export function getPriorityLevelForWinsMarker(marker: string): number {
  switch (marker) {
    case '!!!':
      return 3
    case '!!':
      return 2
    case '>>':
    default:
      return 4
  }
}

/**
 * Read winsPriorityMarker from DataStore.settings synchronously (default '>>').
 * @returns {number} NotePlan priority level for wins
 */
function getWinsPriorityLevelFromSettings(): number {
  try {
    const raw = DataStore.settings?.dashboardSettings
    if (!raw) return 4
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return getPriorityLevelForWinsMarker(parsed?.winsPriorityMarker || '>>')
  } catch (err) {
    logWarn('getWinsPriorityLevelFromSettings', err.message)
    return 4
  }
}

/**
 * Extract @done(YYYY-MM-DD) date from paragraph content, or null.
 * @param {string} content
 * @returns {string | null}
 */
export function getDoneDateFromContent(content: string): string | null {
  const match = content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE)
  return match && match[1] ? match[1] : null
}

/**
 * Calendar timeframe from filename alone (no note.type required).
 * @param {string} filename
 * @returns {false | 'day' | 'week' | 'month' | 'quarter' | 'year'}
 */
export function getCalendarTimeframeFromFilename(filename: string): false | 'day' | 'week' | 'month' | 'quarter' | 'year' {
  if (new RegExp(RE_DAILY_NOTE_FILENAME).test(filename)) return 'day'
  if (new RegExp(RE_WEEKLY_NOTE_FILENAME).test(filename)) return 'week'
  if (new RegExp(RE_MONTHLY_NOTE_FILENAME).test(filename)) return 'month'
  if (new RegExp(RE_QUARTERLY_NOTE_FILENAME).test(filename)) return 'quarter'
  if (new RegExp(RE_YEARLY_NOTE_FILENAME).test(filename)) return 'year'
  return false
}

/**
 * Inclusive ISO date range covered by a calendar note filename, or null if not a calendar note.
 * @param {string} filename
 * @returns {{ start: string, end: string } | null}
 */
export function getCompletedDateRangeForCalendarNote(filename: string): { start: string, end: string } | null {
  try {
    const timeframe = getCalendarTimeframeFromFilename(filename)
    if (!timeframe) return null

    if (timeframe === 'day') {
      const iso = getDateStringFromCalendarFilename(filename, true)
      if (!iso || iso.startsWith('(invalid')) return null
      return { start: iso, end: iso }
    }

    if (timeframe === 'week') {
      const weekStr = getDateStringFromCalendarFilename(filename)
      const startYYYYMMDD = weekStartDateStr(weekStr)
      if (!startYYYYMMDD || startYYYYMMDD.startsWith('(error') || startYYYYMMDD.length < 8) return null
      const startISO = `${startYYYYMMDD.slice(0, 4)}-${startYYYYMMDD.slice(4, 6)}-${startYYYYMMDD.slice(6, 8)}`
      const endISO = moment(startISO).add(6, 'days').format('YYYY-MM-DD')
      return { start: startISO, end: endISO }
    }

    if (timeframe === 'month') {
      const monthStr = getDateStringFromCalendarFilename(filename) // YYYY-MM
      const start = moment(`${monthStr}-01`)
      if (!start.isValid()) return null
      return { start: start.format('YYYY-MM-DD'), end: start.clone().endOf('month').format('YYYY-MM-DD') }
    }

    if (timeframe === 'quarter') {
      const quarterStr = getDateStringFromCalendarFilename(filename) // YYYY-Qn
      const year = Number(quarterStr.slice(0, 4))
      const q = Number(quarterStr.slice(-1))
      if (!year || q < 1 || q > 4) return null
      const start = moment({ year, month: (q - 1) * 3, day: 1 })
      return { start: start.format('YYYY-MM-DD'), end: start.clone().add(2, 'months').endOf('month').format('YYYY-MM-DD') }
    }

    if (timeframe === 'year') {
      const yearStr = getDateStringFromCalendarFilename(filename) // YYYY
      return { start: `${yearStr}-01-01`, end: `${yearStr}-12-31` }
    }

    return null
  } catch (err) {
    logError('getCompletedDateRangeForCalendarNote', err.message)
    return null
  }
}

/**
 * Classify period affinity for a completed paragraph (schedule tag, else calendar note, else other).
 * @param {string} content
 * @param {string} filename
 * @returns {TPeriodAffinity}
 */
export function classifyPeriodAffinity(content: string, filename: string): TPeriodAffinity {
  const todayISO = todaysDateISOString
  const todayDate = moment(todayISO).toDate()
  const yesterdayISO = moment(todayISO).subtract(1, 'day').format('YYYY-MM-DD')
  const thisWeek = getNPWeekStr(todayDate)
  const thisMonth = getNPMonthStr(todayDate)
  const thisQuarter = getNPQuarterStr(todayDate)
  const thisYear = getNPYearStr(todayDate)

  // 1. Remaining >schedule tags
  const scheduledDates = findScheduledDates(content)
  for (const dateStr of scheduledDates) {
    if (dateStr === 'today' || dateStr === todayISO) return 'today'
    if (dateStr === yesterdayISO) return 'yesterday'
    const period = getPeriodOfNPDateStr(dateStr)
    if (period === 'day') {
      // Specific day that is not today/yesterday
      return 'other'
    }
    if (period === 'week') return dateStr === thisWeek ? 'week' : 'other'
    if (period === 'month') return dateStr === thisMonth ? 'month' : 'other'
    if (period === 'quarter') return dateStr === thisQuarter ? 'quarter' : 'other'
    if (period === 'year') return dateStr === thisYear ? 'year' : 'other'
  }

  // 2. Calendar-note placement
  const timeframe = getCalendarTimeframeFromFilename(filename)
  if (timeframe === 'day') {
    const noteISO = getDateStringFromCalendarFilename(filename, true)
    if (noteISO === todayISO) return 'today'
    if (noteISO === yesterdayISO) return 'yesterday'
    return 'other'
  }
  if (timeframe === 'week') {
    const weekStr = getDateStringFromCalendarFilename(filename)
    return weekStr === thisWeek ? 'week' : 'other'
  }
  if (timeframe === 'month') {
    const monthStr = getDateStringFromCalendarFilename(filename)
    return monthStr === thisMonth ? 'month' : 'other'
  }
  if (timeframe === 'quarter') {
    const quarterStr = getDateStringFromCalendarFilename(filename)
    return quarterStr === thisQuarter ? 'quarter' : 'other'
  }
  if (timeframe === 'year') {
    const yearStr = getDateStringFromCalendarFilename(filename)
    return yearStr === thisYear ? 'year' : 'other'
  }

  // 3. Project / unscheduled
  return 'other'
}

/**
 * Whether a done-date ISO string passes the filter.
 * @param {string | null} doneDateISO
 * @param {TDoneDateFilter} doneDateFilter
 * @returns {boolean}
 */
function doneDateMatchesFilter(doneDateISO: string | null, doneDateFilter: TDoneDateFilter): boolean {
  if (!doneDateISO) return false
  if (doneDateFilter === true) {
    return doneDateISO === todaysDateISOString
  }
  if (doneDateFilter === false) {
    return true
  }
  if (typeof doneDateFilter === 'string') {
    return doneDateISO === doneDateFilter
  }
  // Range
  return doneDateISO >= doneDateFilter.start && doneDateISO <= doneDateFilter.end
}

/**
 * Load paragraphs for a note (Editor if open and requested).
 * @param {string} filename
 * @param {boolean} useEditorWherePossible
 * @returns {$ReadOnlyArray<TParagraph>}
 */
function getParasForNote(filename: string, useEditorWherePossible: boolean): $ReadOnlyArray<TParagraph> {
  if (useEditorWherePossible && Editor && Editor.note?.filename === filename) {
    return Editor.paragraphs
  }
  const note = getNoteFromFilename(filename)
  if (!note) throw new Error(`Note not found: ${filename}`)
  return note.paragraphs
}

/**
 * Empty TDoneCount with optional zeros for breakdown fields.
 * @param {boolean} withBreakdown
 * @returns {TDoneCount}
 */
function emptyDoneCount(withBreakdown: boolean = false): TDoneCount {
  const base: TDoneCount = { completedTasks: 0, lastUpdated: new Date() }
  if (withBreakdown) {
    base.forToday = 0
    base.forOtherPeriod = 0
    base.completedWins = 0
  }
  return base
}

//-----------------------------------------------------------------
// Public functions

/**
 * Return number of completed tasks in the single given (calendar or regular) note.
 *
 * Note: This does *not* filter out tasks that would not match the current perspectives/settings. And it does not count checklist items.
 * @param {string} filename
 * @param {boolean} useEditorWherePossible? use the open Editor to read from if it happens to be open (default: true)
 * @param {TDoneDateFilter} doneDateFilter? true = today only (default); false = any @done; ISO string = that day; {start,end} = inclusive range
 * @param {number} winsPriorityLevel when set, additionally return completedWins at this NotePlan priority (e.g. 4 for `>>`). Default is 0 (no win count).
 * @returns {TDoneCount} {completedTasks, completedWins?, lastUpdated}
 */
export function getNumCompletedTasksFromNote(
  filename: string,
  useEditorWherePossible: boolean = true,
  doneDateFilter: TDoneDateFilter = true,
  winsPriorityLevel: number = 0,
): TDoneCount {
  try {
    const parasToUse = getParasForNote(filename, useEditorWherePossible)

    const completedTasks = parasToUse.filter((p) => {
      if (p.type !== 'done') return false
      const doneDate = getDoneDateFromContent(p.content)
      return doneDateMatchesFilter(doneDate, doneDateFilter)
    })

    const numCompletedTasks = completedTasks.length
    let completedWins = 0
    if (winsPriorityLevel > 0) {
      completedWins = completedTasks.filter((p) => getNumericPriorityFromPara(p) === winsPriorityLevel).length
    }

    const outputObject: TDoneCount = {
      completedTasks: numCompletedTasks,
      completedWins,
      lastUpdated: new Date(),
    }
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
 * Count completed tasks in a calendar note whose @done date falls inside that note's period.
 * Falls back to "any @done" if the filename is not recognised as a calendar note.
 * @param {string} filename
 * @param {boolean} useEditorWherePossible?
 * @param {number} winsPriorityLevel?
 * @returns {TDoneCount}
 */
export function getNumCompletedTasksFromCalendarNote(
  filename: string,
  useEditorWherePossible: boolean = true,
  winsPriorityLevel: number = 0,
): TDoneCount {
  const range = getCompletedDateRangeForCalendarNote(filename)
  if (range) {
    return getNumCompletedTasksFromNote(filename, useEditorWherePossible, range, winsPriorityLevel)
  }
  return getNumCompletedTasksFromNote(filename, useEditorWherePossible, false, winsPriorityLevel)
}

/**
 * Count @done(today) tasks in a note and classify by period affinity + wins.
 * Unscheduled / project completions (no period affinity) count toward completedTasks only.
 * @param {string} filename
 * @param {number} winsPriorityLevel - NotePlan priority for wins (e.g. 4 for `>>`)
 * @param {boolean} useEditorWherePossible?
 * @returns {TDoneCount} with forToday / forOtherPeriod / completedWins filled
 */
export function getCompletedTaskBreakdownFromNote(
  filename: string,
  winsPriorityLevel: number = 4,
  useEditorWherePossible: boolean = false,
): TDoneCount {
  try {
    const parasToUse = getParasForNote(filename, useEditorWherePossible)
    let forToday = 0
    let forOtherPeriod = 0
    let otherCompleted = 0
    let completedWins = 0

    for (const p of parasToUse) {
      if (p.type !== 'done') continue
      const doneDate = getDoneDateFromContent(p.content)
      if (!doneDate || doneDate !== todaysDateISOString) continue

      const affinity = classifyPeriodAffinity(p.content, filename)
      if (affinity === 'today') {
        forToday += 1
      } else if (affinity === 'other') {
        otherCompleted += 1
      } else {
        forOtherPeriod += 1
      }

      if (winsPriorityLevel > 0 && getNumericPriorityFromPara(p) === winsPriorityLevel) {
        completedWins += 1
      }
    }

    const completedTasks = forToday + forOtherPeriod + otherCompleted
    return {
      completedTasks,
      completedWins,
      forToday,
      forOtherPeriod,
      lastUpdated: new Date(),
    }
  } catch (error) {
    logError('getCompletedTaskBreakdownFromNote', error.message)
    return emptyDoneCount(true)
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
      if (typeof thisDC.forToday === 'number') summary.forToday = (summary.forToday || 0) + thisDC.forToday
      if (typeof thisDC.forOtherPeriod === 'number') summary.forOtherPeriod = (summary.forOtherPeriod || 0) + thisDC.forOtherPeriod
      if (typeof thisDC.completedWins === 'number') summary.completedWins = (summary.completedWins || 0) + thisDC.completedWins
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
 * Read completedWins from a JSON map item, accepting legacy completedTasksAtPriority.
 * @param {any} item
 * @returns {number}
 */
function readCompletedWinsFromJsonItem(item: any): number {
  if (typeof item.completedWins === 'number') return item.completedWins
  // Legacy field from before the collapse to completedWins
  if (typeof item.completedTasksAtPriority === 'number') return item.completedTasksAtPriority
  return 0
}

/**
 * Read the CHANGED_NOTE_FILE note and summarise today's done counts with affinity breakdown.
 * DT section progress uses forToday (tasks for today completed today).
 * Header total still comes from updateDoneCountsFromChangedNotes (all completed today).
 * @returns {TDoneCount} completedTasks = forToday for DT progress; also forOtherPeriod, completedWins
 */
export function getDoneCountsForToday(): TDoneCount {
  try {
    const changedNoteData = DataStore.loadData(CHANGED_NOTE_FILE, true) ?? '{}'
    if (!changedNoteData) {
      throw new Error(`CHANGED_NOTE_FILE file ${CHANGED_NOTE_FILE} empty or does not exist`)
    }
    const parsedData = JSON.parse(changedNoteData)
    let forToday = 0
    let forOtherPeriod = 0
    let completedWins = 0
    let lastUpdated = new Date(0)
    if (parsedData.length > 0) {
      parsedData.forEach((item) => {
        const itemCompleted = typeof item.completedToday === 'number' ? item.completedToday : item.completedTasks || 0
        // Old JSON without buckets: treat completedTasks as forToday so DT display stays stable until refresh
        forToday += typeof item.forToday === 'number' ? item.forToday : itemCompleted
        forOtherPeriod += typeof item.forOtherPeriod === 'number' ? item.forOtherPeriod : 0
        completedWins += readCompletedWinsFromJsonItem(item)
        if (item.lastUpdated > lastUpdated) lastUpdated = item.lastUpdated
      })
    }
    return {
      completedTasks: forToday,
      completedWins,
      forToday,
      forOtherPeriod,
      lastUpdated,
    }
  } catch (err) {
    logError('getDoneCountsForToday', err.message)
    return { completedTasks: 0, lastUpdated: new Date(0) } // to pacify flow
  }
}

/**
 * Cheap header seed: sum completed-today counts already stored in CHANGED_NOTE_FILE.
 * Does not scan notes. Returns 0 if the cache is missing or from a previous day.
 * @returns {number} cached total completed tasks today, or 0
 */
export function getCachedHeaderDoneCount(): number {
  try {
    const previousJSDate = DataStore.preference(LAST_TIME_THIS_WAS_RUN_PREF) ?? null
    if (!previousJSDate || !DataStore.fileExists(CHANGED_NOTE_FILE)) return 0
    if (moment(previousJSDate).format('YYYY-MM-DD') !== todaysDateISOString) return 0

    const raw = DataStore.loadData(CHANGED_NOTE_FILE, true) ?? '[]'
    const parsedData = JSON.parse(raw)
    if (!Array.isArray(parsedData) || parsedData.length === 0) return 0

    return parsedData.reduce((sum, item) => {
      const n = typeof item.completedToday === 'number' ? item.completedToday : item.completedTasks || 0
      return sum + n
    }, 0)
  } catch (err) {
    logWarn('getCachedHeaderDoneCount', err.message)
    return 0
  }
}

/**
 * Returns a count of all completed tasks today (for the header).
 * Keeps and updates CHANGED_NOTE_FILE with per-note affinity breakdowns.
 * Only recalculates notes updated since LAST_TIME_THIS_WAS_RUN_PREF.
 * WARNING: this is synchronous and takes >300ms (and sometimes >1s) from the note-list scan. Call it after the Dashboard window is visible, not during getPluginData.
 * @param {string?} reason for calling this
 * @returns {number} total completed tasks today (all notes / all affinities)
 */
export function updateDoneCountsFromChangedNotes(_reason: string = ''): number {
  try {
    const changedNoteMap: Map<string, TDoneCount> = new Map()
    let momPrevious
    const momNow = new moment()
    const startTime = new Date() // just for timing this function
    const winsPriorityLevel = getWinsPriorityLevelFromSettings()

    // Read current list from todaysChangedNoteList.json, and get time of it.
    // Note: can't get a timestamp from plugin files, so need to use a separate preference
    if (DataStore.fileExists(CHANGED_NOTE_FILE)) {
      const data = DataStore.loadData(CHANGED_NOTE_FILE, true) ?? '{}'
      const parsedData = JSON.parse(data)
      if (parsedData.length > 0) {
        parsedData.forEach((item) => {
          const completedTasks = typeof item.completedToday === 'number' ? item.completedToday : item.completedTasks || 0
          changedNoteMap.set(item.filename, {
            lastUpdated: new Date(item.lastUpdated),
            completedTasks,
            forToday: typeof item.forToday === 'number' ? item.forToday : completedTasks,
            forOtherPeriod: typeof item.forOtherPeriod === 'number' ? item.forOtherPeriod : 0,
            completedWins: readCompletedWinsFromJsonItem(item),
          })
        })
      }

      const previousJSDate = DataStore.preference(LAST_TIME_THIS_WAS_RUN_PREF) ?? null
      momPrevious = previousJSDate
        ? moment(previousJSDate)
        : momNow.startOf('day') // fallback to start of today
    } else {
      logDebug('updateDoneCountsFromChangedNotes', `${CHANGED_NOTE_FILE} does not exist, so starting a new list from start of today.`)
      momPrevious = momNow.startOf('day')
    }

    // If we're now in a different day, empty the list
    if (momNow.format('DDMMYYYY') !== momPrevious.format('DDMMYYYY')) {
      logInfo(`updateDoneCountsFromChangedNotes`, `Now in a different day (${momNow.format('DDMMYYYY')} after ${momPrevious.format('DDMMYYYY')}), so emptying changedNote list`)
      changedNoteMap.clear()
    }

    // Find all notes updated since the last time / changed today
    const recentlychangedNotes = getNotesChangedInInterval(0)

    recentlychangedNotes.forEach((note) => {
      const breakdown: TDoneCount = getCompletedTaskBreakdownFromNote(note.filename, winsPriorityLevel, false)
      changedNoteMap.set(note.filename, breakdown)
    })

    let totalCompletedTasks = 0
    changedNoteMap.forEach((value) => {
      totalCompletedTasks += value.completedTasks
    })
    logDebug(`updateDoneCountsFromChangedNotes`, `=> there are now ${changedNoteMap.size} notes changed today in the map and ${String(totalCompletedTasks)} total completed tasks`)

    const mapArray = Array.from(changedNoteMap.entries()).map(([key, value]) => ({
      filename: key,
      completedTasks: value.completedTasks,
      completedToday: value.completedTasks,
      forToday: value.forToday ?? 0,
      forOtherPeriod: value.forOtherPeriod ?? 0,
      completedWins: value.completedWins ?? 0,
      lastUpdated: value.lastUpdated,
    }))
    DataStore.saveData(JSON.stringify(mapArray), CHANGED_NOTE_FILE, true)

    DataStore.setPreference(LAST_TIME_THIS_WAS_RUN_PREF, new Date())

    logTimer(`updateDoneCountsFromChangedNotes`, startTime, `total runtime for updateDoneCountsFromChangedNotes`, 1000)
    return totalCompletedTasks
  } catch (err) {
    logError('updateDoneCountsFromChangedNotes', err.message)
    return 0
  }
}

/**
 * Test/diagnostic command: load todaysChangedNoteList.json, log the done-count map to the Plugin Console,
 * and show a short INFO banner in the Dashboard window (if open).
* TODO(later): remove me in time
 * @returns {Promise<void>}
 */
export async function logDoneCounts(): Promise<void> {
  try {
    const summary = getDoneCountsForToday()
    let mapItems: Array<any> = []
    if (DataStore.fileExists(CHANGED_NOTE_FILE)) {
      const raw = DataStore.loadData(CHANGED_NOTE_FILE, true) ?? '[]'
      const parsed = JSON.parse(raw)
      mapItems = Array.isArray(parsed) ? parsed : []
    }

    const totalCompleted = mapItems.reduce(
      (sum, item) => sum + (typeof item.completedToday === 'number' ? item.completedToday : item.completedTasks || 0),
      0,
    )
    const totalsLine = `Done counts today: total=${String(totalCompleted)} forToday=${String(summary.forToday || 0)} forOtherPeriod=${String(summary.forOtherPeriod || 0)} completedWins=${String(summary.completedWins || 0)} (${String(mapItems.length)} notes)`

    logDebug('logDoneCounts', totalsLine)
    clo(mapItems, 'logDoneCounts: todaysChangedNoteList.json map')
    mapItems.forEach((item) => {
      logDebug(
        'logDoneCounts',
        `- ${item.filename}: completed=${String(item.completedToday ?? item.completedTasks ?? 0)} forToday=${String(item.forToday ?? '?')} forOtherPeriod=${String(item.forOtherPeriod ?? '?')} wins=${String(item.completedWins ?? item.completedTasksAtPriority ?? 0)}`,
      )
    })

    // Now prepare a banner message
    // const noteLines = mapItems
    //   .slice(0, 12)
    //   .map((item) => `${item.filename}: ${String(item.completedToday ?? item.completedTasks ?? 0)} (T${String(item.forToday ?? 0)}/O${String(item.forOtherPeriod ?? 0)}/W${String(item.completedWins ?? 0)})`)
    // const more = mapItems.length > 12 ? `\n… +${String(mapItems.length - 12)} more notes (see Plugin Console)` : ''
    // const bannerMsg =
    //   mapItems.length === 0
    //     ? `${totalsLine}\n(No notes in todaysChangedNoteList.json yet - refresh Dashboard or run updateDoneCountsFromChangedNotes.)`
    //     : `${totalsLine}\n${noteLines.join('\n')}${more}`
    // await sendBannerMessage(WEBVIEW_WINDOW_ID, bannerMsg, 'INFO', 12000)
  } catch (err) {
    logError('logDoneCounts', err.message)
    await sendBannerMessage(WEBVIEW_WINDOW_ID, `logDoneCounts failed: ${err.message}`, 'ERROR', 8000)
  }
}
