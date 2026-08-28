// @flow
//-----------------------------------------------------------------------------
// Priority note-index cache for Dashboard PRIORITY section
// Last updated 2026-08-27 for v2.5.0.b2 by @CursorAI
//-----------------------------------------------------------------------------
// Cache structure (JSON file):
// {
//   generatedAt: ISO UTC string,
//   lastUpdated: ISO UTC string,
//   version: 1,
//   regularNotes: ['note1.md', ...],
//   calendarNotes: ['20240101.md', ...],
// }
// Indexes notes that contain at least one open, unscheduled, priority>0 item.
// Folder filters are applied at query time so one cache serves all perspectives.
// Calendar notes are indexed broadly; Priority query restricts to past calendar notes.
// Rebuild every PRIORITY_CACHE_GENERATE_INTERVAL_DAYS (default 5) days, or on demand if the user has requested it.
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { WEBVIEW_WINDOW_ID } from './constants'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { sendBannerMessage } from '@helpers/HTMLView'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { getNoteByFilename, pastCalendarNotes } from '@helpers/note'
import { getNumericPriorityFromPara } from '@helpers/sorting'
import { isOpenNotScheduled } from '@helpers/utils'

//--------------------------------------------------------------------------
// Constants

const priorityNoteIndexCacheFile = 'priorityNoteIndexCache.json'
const lastTimeThisWasRunPref = 'jgclark.Dashboard.priorityNoteIndexCache.lastTimeUpdated'
const regeneratePriorityNoteIndexCachePref = 'jgclark.Dashboard.priorityNoteIndexCache.regenerate'
const PRIORITY_CACHE_UPDATE_INTERVAL_HOURS = 1
const PRIORITY_CACHE_GENERATE_INTERVAL_DAYS = 5
const PRIORITY_CACHE_VERSION = 1

export type TPriorityNoteIndexCache = {
  generatedAt: string,
  lastUpdated: string,
  version: number,
  regularNotes: Array<string>,
  calendarNotes: Array<string>,
}

//-----------------------------------------------------------------
// Timestamp / pref helpers

/**
 * Serialize a cache timestamp as ISO 8601 UTC.
 * @param {Date} when
 * @returns {string}
 */
function serializePriorityCacheTimestamp(when: Date): string {
  return when.toISOString()
}

/**
 * Parse generatedAt / lastUpdated from cache file or preference.
 * @param {Date | string | null | void} value
 * @returns {Date | null}
 */
function parsePriorityCacheTimestamp(value: ?(Date | string)): ?Date {
  if (value == null || value === '') return null
  const m = moment(value)
  if (!m.isValid()) return null
  return m.toDate()
}

/**
 * Record when the priority note-index cache was last built or updated.
 * @param {Date} when
 */
function recordPriorityCacheLastRunTime(when: Date): void {
  DataStore.setPreference(lastTimeThisWasRunPref, when)
  logDebug('recordPriorityCacheLastRunTime', `set ${lastTimeThisWasRunPref} to ${when.toISOString()} (local ${moment(when).format()})`)
}

/**
 * Resolve last-run instant from the newer of file lastUpdated and preference.
 * @param {Object} cache
 * @returns {{ lastRun: Date | null, source: string }}
 */
function getPriorityCacheLastRunInfo(cache: Object): { lastRun: ?Date, source: string } {
  const fromPref = parsePriorityCacheTimestamp((DataStore.preference(lastTimeThisWasRunPref): any))
  const fromFile = parsePriorityCacheTimestamp(cache?.lastUpdated)
  if (fromPref == null && fromFile == null) {
    return { lastRun: null, source: 'none' }
  }
  if (fromPref == null) {
    return { lastRun: fromFile, source: 'cache.lastUpdated' }
  }
  if (fromFile == null) {
    return { lastRun: fromPref, source: 'pref' }
  }
  if (fromFile.getTime() > fromPref.getTime()) {
    return { lastRun: fromFile, source: 'cache.lastUpdated (newer than pref)' }
  }
  if (fromPref.getTime() > fromFile.getTime()) {
    return { lastRun: fromPref, source: 'pref (newer than cache.lastUpdated)' }
  }
  return { lastRun: fromFile, source: 'cache.lastUpdated and pref' }
}

function clearPriorityNoteIndexCacheGenerationPref(): void {
  logDebug('clearPriorityNoteIndexCacheGenerationPref', `Clearing priority note-index cache generation pref.`)
  DataStore.setPreference(regeneratePriorityNoteIndexCachePref, null)
}

//-----------------------------------------------------------------
// Membership / note helpers

/**
 * True if the note has at least one open, unscheduled paragraph with priority > 0.
 * Same rule as Priority section discovery (`getOpenPriorityItems`).
 * @param {TNote} note
 * @returns {boolean}
 */
export function noteHasOpenUnscheduledPriorityItems(note: TNote): boolean {
  if (!note || !note.paragraphs) return false
  for (const paragraph of note.paragraphs) {
    if (isOpenNotScheduled(paragraph) && getNumericPriorityFromPara(paragraph) > 0) {
      return true
    }
  }
  return false
}

/**
 * Cheap content probe before paragraph scan during full generate.
 * @param {TNote} note
 * @returns {boolean}
 */
export function noteMayContainPriorityMarkers(note: TNote): boolean {
  const content = note.content ?? ''
  return content.includes('!') || content.includes('>>')
}

/**
 * @param {TNote} note
 * @returns {boolean}
 */
function isNonBlankMarkdownNote(note: TNote): boolean {
  if (!note.filename || !note.filename.match(/(.txt|.md)$/)) return false
  return Boolean(note.content && !isNaN(note.content.length) && note.content.length >= 1)
}

//-----------------------------------------------------------------
// Cache mutate helpers

/**
 * Remove a filename from the given notes array (mutates).
 * @param {Array<string>} filenames
 * @param {string} filename
 */
function removeFilenameFromList(filenames: Array<string>, filename: string): void {
  const idx = filenames.indexOf(filename)
  if (idx >= 0) filenames.splice(idx, 1)
}

/**
 * Remove a note from both regular and calendar lists in the cache object.
 * @param {TPriorityNoteIndexCache} cache
 * @param {string} filename
 * @param {boolean} isCalendarNote
 */
function removeNoteFromPriorityCache(cache: TPriorityNoteIndexCache, filename: string, isCalendarNote: boolean): void {
  if (isCalendarNote) {
    removeFilenameFromList(cache.calendarNotes, filename)
  } else {
    removeFilenameFromList(cache.regularNotes, filename)
  }
}

/**
 * Add a note filename to the appropriate list if not already present.
 * @param {TPriorityNoteIndexCache} cache
 * @param {string} filename
 * @param {boolean} isCalendarNote
 */
function addNoteToPriorityCache(cache: TPriorityNoteIndexCache, filename: string, isCalendarNote: boolean): void {
  const list = isCalendarNote ? cache.calendarNotes : cache.regularNotes
  if (!list.includes(filename)) {
    list.push(filename)
  }
}

/**
 * Scan notes and collect filenames that match the Priority membership rule.
 * @param {$ReadOnlyArray<TNote>} notes
 * @returns {{ filenames: Array<string>, matchingNoteCount: number, notesSkippedByPrefilter: number }}
 */
function processNotesForPriorityIndex(
  notes: $ReadOnlyArray<TNote>,
): { filenames: Array<string>, matchingNoteCount: number, notesSkippedByPrefilter: number } {
  const filenames: Array<string> = []
  let matchingNoteCount = 0
  let notesSkippedByPrefilter = 0

  for (const note of notes) {
    if (!isNonBlankMarkdownNote(note)) {
      notesSkippedByPrefilter++
      continue
    }
    if (!noteMayContainPriorityMarkers(note)) {
      notesSkippedByPrefilter++
      continue
    }
    if (noteHasOpenUnscheduledPriorityItems(note)) {
      filenames.push(note.filename)
      matchingNoteCount++
    }
  }

  return { filenames, matchingNoteCount, notesSkippedByPrefilter }
}

//-----------------------------------------------------------------
// Exported availability / schedule

/**
 * @returns {boolean}
 */
export function isPriorityNoteIndexCacheAvailable(): boolean {
  return DataStore.fileExists(priorityNoteIndexCacheFile)
}

/**
 * @returns {boolean}
 */
export function isPriorityNoteIndexCacheGenerationScheduled(): boolean {
  return DataStore.preference(regeneratePriorityNoteIndexCachePref) === true
}

/**
 * Schedule a full regeneration of the priority note-index cache.
 */
export function schedulePriorityNoteIndexCacheGeneration(): void {
  logInfo('schedulePriorityNoteIndexCacheGeneration', `Scheduling priority note-index cache generation.`)
  DataStore.setPreference(regeneratePriorityNoteIndexCachePref, true)
}

/**
 * True when a scheduled full regenerate should actually run.
 * Skips leftover schedule flags when a fresh-enough cache file already exists
 * (e.g. after a prior generate that saved the file but never cleared the pref).
 * @returns {boolean}
 */
export function shouldRunScheduledPriorityNoteIndexCacheGeneration(): boolean {
  if (!isPriorityNoteIndexCacheGenerationScheduled()) return false
  const cache = loadPriorityNoteIndexCache()
  if (!cache || !cache.generatedAt) return true
  const diffHours = moment().diff(moment(cache.generatedAt), 'hours', true)
  if (diffHours < PRIORITY_CACHE_GENERATE_INTERVAL_DAYS * 24) {
    logInfo(
      'shouldRunScheduledPriorityNoteIndexCacheGeneration',
      `Schedule flag set, but cache is only ${diffHours.toFixed(3)} hours old (< ${String(PRIORITY_CACHE_GENERATE_INTERVAL_DAYS)} days) - clearing flag and skipping full regenerate`,
    )
    clearPriorityNoteIndexCacheGenerationPref()
    return false
  }
  return true
}

/**
 * Schedule regeneration if the cache is older than PRIORITY_CACHE_GENERATE_INTERVAL_DAYS.
 * @param {string} generatedAtStr
 */
export function schedulePriorityNoteIndexCacheGenerationIfTooOld(generatedAtStr: string): void {
  const nowMom = moment()
  const generatedAtMom = moment(generatedAtStr)
  const diffHours = nowMom.diff(generatedAtMom, 'hours', true)
  if (diffHours >= PRIORITY_CACHE_GENERATE_INTERVAL_DAYS * 24) {
    logInfo('schedulePriorityNoteIndexCacheGenerationIfTooOld', `Priority note-index cache is too old (${diffHours.toFixed(3)} hours), so scheduling a regeneration.`)
    schedulePriorityNoteIndexCacheGeneration()
  } else {
    logDebug('schedulePriorityNoteIndexCacheGenerationIfTooOld', `Priority note-index cache is not too old (${diffHours.toFixed(3)} hours).`)
  }
}

/**
 * Load and parse the cache file, or null if missing/invalid.
 * @returns {TPriorityNoteIndexCache | null}
 */
export function loadPriorityNoteIndexCache(): ?TPriorityNoteIndexCache {
  try {
    if (!isPriorityNoteIndexCacheAvailable()) return null
    const data = DataStore.loadData(priorityNoteIndexCacheFile, true) ?? ''
    const cache = JSON.parse(data)
    if (!cache || !Array.isArray(cache.regularNotes) || !Array.isArray(cache.calendarNotes)) {
      logWarn('loadPriorityNoteIndexCache', `Invalid cache shape in ${priorityNoteIndexCacheFile}`)
      return null
    }
    return cache
  } catch (err) {
    logError('loadPriorityNoteIndexCache', JSP(err))
    return null
  }
}

//-----------------------------------------------------------------
// Generate / update

/**
 * Generate the priority note-index cache from scratch.
 * Scans all non-@ regular notes and all calendar notes on the **main thread**
 * (same lesson as tagMentionCache: async-thread regenerations have stalled without saving).
 * Progress uses the Dashboard WebView banner (`sendBannerMessage`), same as tag/mention cache generation.
 * @param {string} generationReason
 * @returns {Promise<void>}
 */
export async function generatePriorityNoteIndexCache(generationReason: string = 'Triggered by external call'): Promise<void> {
  const startTime = new Date()
  let progressBannerShown = false
  try {
    logInfo('generatePriorityNoteIndexCache', `Starting for ${generationReason}`)

    const allCalNotes = DataStore.calendarNotes
    const allRegularNotes = DataStore.projectNotes.filter((note) => !note.filename.startsWith('@'))

    await sendBannerMessage(
      WEBVIEW_WINDOW_ID,
      `${generationReason}: generating Priority note-index cache from ${String(allCalNotes.length)} calendar + ${String(allRegularNotes.length)} regular notes ...`,
      'INFO',
    )
    progressBannerShown = true
    logInfo('generatePriorityNoteIndexCache', `- processing ${String(allCalNotes.length)} calendar + ${String(allRegularNotes.length)} regular notes ...`)

    logInfo('generatePriorityNoteIndexCache', `- scanning ${String(allCalNotes.length)} calendar notes ...`)
    const calResult = processNotesForPriorityIndex(allCalNotes)
    logDebug('generatePriorityNoteIndexCache', `  - pre-filter skipped ${String(calResult.notesSkippedByPrefilter)} calendar notes`)

    logInfo('generatePriorityNoteIndexCache', `- scanning ${String(allRegularNotes.length)} regular notes ...`)
    const regResult = processNotesForPriorityIndex(allRegularNotes)
    logDebug('generatePriorityNoteIndexCache', `  - pre-filter skipped ${String(regResult.notesSkippedByPrefilter)} regular notes`)

    const elapsedSecs = Math.max(((new Date(): any) - startTime) / 1000, 0.001)
    const notesChecked = allCalNotes.length + allRegularNotes.length - calResult.notesSkippedByPrefilter - regResult.notesSkippedByPrefilter
    const notesPerSec = (notesChecked / elapsedSecs).toFixed(3)
    const totalMatching = calResult.matchingNoteCount + regResult.matchingNoteCount
    logInfo(
      'generatePriorityNoteIndexCache',
      `-> found ${String(calResult.matchingNoteCount)} calendar + ${String(regResult.matchingNoteCount)} regular notes with open unscheduled priority items`,
    )
    logTimer('generatePriorityNoteIndexCache', startTime, `-> finished cache generation at ${String(notesPerSec)} checked notes/second`)

    const cacheTimestamp = serializePriorityCacheTimestamp(startTime)
    const cache: TPriorityNoteIndexCache = {
      generatedAt: cacheTimestamp,
      lastUpdated: cacheTimestamp,
      version: PRIORITY_CACHE_VERSION,
      regularNotes: regResult.filenames,
      calendarNotes: calResult.filenames,
    }

    DataStore.saveData(JSON.stringify(cache), priorityNoteIndexCacheFile, true)
    logTimer('generatePriorityNoteIndexCache', startTime, `- after saving ${String(totalMatching)} note filenames to ${priorityNoteIndexCacheFile}`)

    recordPriorityCacheLastRunTime(startTime)
    // Clear the schedule flag before any WebView banner await, so a hung banner cannot leave regen permanently scheduled
    clearPriorityNoteIndexCacheGenerationPref()

    // Replace progress banner with a timed completion message (progress banners have no timeout and would persist otherwise)
    await sendBannerMessage(
      WEBVIEW_WINDOW_ID,
      `Priority note-index cache re-generated; it contains ${String(totalMatching)} notes with raised-priority items`,
      'INFO',
      5000,
    )
    progressBannerShown = false
  } catch (err) {
    logError('generatePriorityNoteIndexCache', JSP(err))
    if (progressBannerShown) {
      await sendBannerMessage(WEBVIEW_WINDOW_ID, '', 'REMOVE')
      const errMessage = err instanceof Error ? err.message : String(err)
      await sendBannerMessage(WEBVIEW_WINDOW_ID, `Priority note-index cache generation failed: ${errMessage}`, 'ERROR', 5000)
      progressBannerShown = false
    }
  } finally {
    if (progressBannerShown) {
      logWarn('generatePriorityNoteIndexCache', `- removing progress banner`)
      await sendBannerMessage(WEBVIEW_WINDOW_ID, '', 'REMOVE')
    }
  }
}

/**
 * Incrementally update the priority note-index for notes changed since last run.
 * @returns {Promise<void>}
 */
// eslint-disable-next-line require-await
export async function updatePriorityNoteIndexCache(): Promise<void> {
  try {
    const startTime = new Date()
    logDebug('updatePriorityNoteIndexCache', `About to read ${priorityNoteIndexCacheFile} ...`)
    if (!isPriorityNoteIndexCacheAvailable()) {
      logWarn('updatePriorityNoteIndexCache', `${priorityNoteIndexCacheFile} file does not exist, so will schedule a re-generation of the cache from scratch.`)
      schedulePriorityNoteIndexCacheGeneration()
      return
    }

    const cache = loadPriorityNoteIndexCache()
    if (!cache) {
      schedulePriorityNoteIndexCacheGeneration()
      return
    }

    const { lastRun, source } = getPriorityCacheLastRunInfo(cache)
    if (lastRun == null) {
      logWarn('updatePriorityNoteIndexCache', `No valid last-run timestamp (pref or cache.lastUpdated); treating cache as stale`)
    }
    const momPrevious = lastRun != null ? moment(lastRun) : moment(0)
    const momNow = moment()
    const fileAgeMins = momNow.diff(momPrevious, 'minutes', true)
    logDebug(
      'updatePriorityNoteIndexCache',
      `Last updated ${fileAgeMins.toFixed(3)} mins ago (source: ${source}; previous: ${momPrevious.format()} / now: ${momNow.format()})`,
    )
    if (lastRun != null && momNow.diff(momPrevious, 'seconds') < 5) {
      logInfo('updatePriorityNoteIndexCache', `- Not updating cache as it was updated less than 5 seconds ago`)
      return
    }

    const jsdateToStartLooking = momPrevious.toDate()
    const numDaysBack = momPrevious.diff(momNow, 'days', true)
    const recentlychangedNotes = getNotesChangedInInterval(numDaysBack).filter((n) => n.changedDate >= jsdateToStartLooking)
    logTimer('updatePriorityNoteIndexCache', startTime, `Found ${recentlychangedNotes.length} changed notes in that time`)

    let c = 0
    for (const note of recentlychangedNotes) {
      const isCalendarNote = note.type === 'Calendar'
      removeNoteFromPriorityCache(cache, note.filename, isCalendarNote)
      if (isNonBlankMarkdownNote(note) && noteHasOpenUnscheduledPriorityItems(note)) {
        addNoteToPriorityCache(cache, note.filename, isCalendarNote)
        c++
      }
    }
    logTimer('updatePriorityNoteIndexCache', startTime, `-> ${c} recently changed notes still with priority items`)

    cache.lastUpdated = serializePriorityCacheTimestamp(startTime)
    cache.version = PRIORITY_CACHE_VERSION

    DataStore.saveData(JSON.stringify(cache), priorityNoteIndexCacheFile, true)
    logTimer('updatePriorityNoteIndexCache', startTime, `- after saving to ${priorityNoteIndexCacheFile}`)

    recordPriorityCacheLastRunTime(startTime)
    logTimer('updatePriorityNoteIndexCache', startTime, `total runtime`, 1000)
  } catch (err) {
    logError('updatePriorityNoteIndexCache', JSP(err))
  }
}

/**
 * Update the cache if last update is older than PRIORITY_CACHE_UPDATE_INTERVAL_HOURS.
 * @returns {Promise<boolean>} True if an update ran
 */
export async function updatePriorityNoteIndexCacheIfTooOld(): Promise<boolean> {
  const cache = loadPriorityNoteIndexCache()
  if (!cache) return false
  const { lastRun } = getPriorityCacheLastRunInfo(cache)
  if (lastRun == null) {
    await updatePriorityNoteIndexCache()
    return true
  }
  const diffHours = moment().diff(moment(lastRun), 'hours', true)
  if (diffHours >= PRIORITY_CACHE_UPDATE_INTERVAL_HOURS) {
    logInfo('updatePriorityNoteIndexCacheIfTooOld', `Priority note-index last update is too old (${diffHours.toFixed(3)} hours), so will now update it ...`)
    await updatePriorityNoteIndexCache()
    return true
  }
  logDebug('updatePriorityNoteIndexCacheIfTooOld', `Priority note-index last update is not too old (${diffHours.toFixed(3)} hours).`)
  return false
}

//-----------------------------------------------------------------
// Query path for Priority section

/**
 * Resolve candidate notes for Priority generation from the index.
 * Applies past-calendar filter at query time; folder filters remain in getRelevantPriorityTasks.
 * Ensures an incremental update when the cache is older than the update interval, and schedules
 * full regen when generatedAt is too old.
 * @returns {Promise<Array<TNote> | null>} Candidate notes, or null if cache unavailable (caller should full-scan)
 */
export async function getNotesFromPriorityNoteIndexCache(): Promise<?Array<TNote>> {
  try {
    const startTime = new Date()
    if (!isPriorityNoteIndexCacheAvailable()) {
      logInfo('getNotesFromPriorityNoteIndexCache', `Cache file missing; scheduling generation and returning null (caller will full-scan)`)
      schedulePriorityNoteIndexCacheGeneration()
      return null
    }

    await updatePriorityNoteIndexCacheIfTooOld()

    const cache = loadPriorityNoteIndexCache()
    if (!cache) {
      schedulePriorityNoteIndexCacheGeneration()
      return null
    }

    schedulePriorityNoteIndexCacheGenerationIfTooOld(cache.generatedAt)
    // If we have a usable cache, drop any leftover regenerate flag from a prior interrupted generate
    if (isPriorityNoteIndexCacheGenerationScheduled()) {
      const diffHours = moment().diff(moment(cache.generatedAt), 'hours', true)
      if (diffHours < PRIORITY_CACHE_GENERATE_INTERVAL_DAYS * 24) {
        clearPriorityNoteIndexCacheGenerationPref()
      }
    }

    const pastCalFilenames = new Set(pastCalendarNotes().map((n) => n.filename))
    const candidateFilenames: Array<string> = cache.regularNotes.concat(cache.calendarNotes.filter((fn) => pastCalFilenames.has(fn)))

    const notes: Array<TNote> = []
    for (const filename of candidateFilenames) {
      const note = getNoteByFilename(filename)
      if (note && isNonBlankMarkdownNote(note)) {
        notes.push(note)
      }
    }

    logTimer(
      'getNotesFromPriorityNoteIndexCache',
      startTime,
      `-> ${notes.length} candidate notes from cache (${cache.regularNotes.length} regular + ${cache.calendarNotes.length} calendar indexed; past-calendar filter applied)`,
    )
    return notes
  } catch (err) {
    logError('getNotesFromPriorityNoteIndexCache', JSP(err))
    return null
  }
}

/**
 * Return markdown lines for the Priority note-index cache section in diagnostics.
 * @param {any} dashboardSettings
 * @returns {Array<string>}
 */
export function getPriorityNoteIndexCacheDiagnosticsLines(dashboardSettings: any): Array<string> {
  const lines: Array<string> = []
  const cacheFileExists = isPriorityNoteIndexCacheAvailable()
  const generationScheduled = isPriorityNoteIndexCacheGenerationScheduled()
  const lastRunPref = DataStore.preference(lastTimeThisWasRunPref)
  const cache = loadPriorityNoteIndexCache()

  lines.push('### Settings')
  const flag = dashboardSettings?.FFlag_UsePriorityCache
  lines.push(`- FFlag_UsePriorityCache: ${flag === undefined ? 'not set (so, cache enabled)' : String(flag)}`)
  lines.push(`- Update interval: ${String(PRIORITY_CACHE_UPDATE_INTERVAL_HOURS)} hour(s)`)
  lines.push(`- Full regenerate interval: ${String(PRIORITY_CACHE_GENERATE_INTERVAL_DAYS)} day(s)`)
  lines.push(`- Cache file exists: ${String(cacheFileExists)}`)
  lines.push(`- Generation scheduled: ${String(generationScheduled)}`)
  lines.push(`- Pref lastTimeUpdated: ${lastRunPref != null ? String(lastRunPref) : '(none)'}`)

  lines.push('### Cache contents')
  if (cache) {
    lines.push(`- version: ${String(cache.version)}`)
    lines.push(`- generatedAt: ${cache.generatedAt}`)
    lines.push(`- lastUpdated: ${cache.lastUpdated}`)
    lines.push(`- regularNotes: ${String(cache.regularNotes.length)}`)
    lines.push(`- calendarNotes: ${String(cache.calendarNotes.length)}`)
  } else {
    lines.push('- (no valid cache loaded)')
  }

  return lines
}
