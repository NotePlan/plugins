// @flow
//-----------------------------------------------------------------------------
// Shared rolling cache of notes changed in the last N calendar days (owned by np.Shared)
// last updated 2026-09-18 for v1.3.0 by @CursorAI, guided by @jgclark
// Plan: np.Shared/PLAN-notes-changed-recently-cache.md
//-----------------------------------------------------------------------------
// Cache body (`notesChangedRecently.json`):
// {
//   generatedAt: ISO UTC string,
//   lastUpdated: ISO UTC string,
//   windowDays: 7,
//   notes: [{ filename, noteType: 'Notes'|'Calendar', changedAt: ISO UTC string }],
// }
// Does not store done counts, tags, or project metadata -- change membership only.
//
// Note: for @jgclark generate only takes 800ms, and update <500ms.
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getNotesChangedInLastCalendarDays } from '@helpers/NPnote'
import { noteType } from '@helpers/note'
import { runSyncWorkOnAsyncThread } from '@helpers/NPThreads'

//--------------------------------------------------------------------------
// Constants

const SHARED_PLUGIN_ID = 'np.Shared'

/** Fully specified so any plugin context can read/write Shared's data folder */
export const NOTES_CHANGED_RECENTLY_CACHE_FILE = `../../data/${SHARED_PLUGIN_ID}/notesChangedRecently.json`

const lastUpdatedPref = 'np.Shared.notesChangedRecently.lastUpdated'
const regeneratePref = 'np.Shared.notesChangedRecently.regenerate'

/** Calendar days in the rolling window (today + 6 prior). */
export const NOTES_CHANGED_RECENTLY_WINDOW_DAYS = 7

/** Default max age before `updateNotesChangedRecentlyCacheIfTooOld` runs an incremental update. */
export const NOTES_CHANGED_RECENTLY_UPDATE_INTERVAL_HOURS = 1

/** Schedule a full regenerate when `generatedAt` is older than this many days. */
export const NOTES_CHANGED_RECENTLY_GENERATE_INTERVAL_DAYS = 7

const SKIP_UPDATE_IF_NEWER_THAN_SECONDS = 5

let notesChangedRecentlyGenerationInProgress = false

//--------------------------------------------------------------------------
// Types

export type TNotesChangedRecentlyNoteType = 'Notes' | 'Calendar'

export type TNotesChangedRecentlyEntry = {
  filename: string,
  noteType: TNotesChangedRecentlyNoteType,
  changedAt: string,
}

export type TNotesChangedRecentlyCache = {
  generatedAt: string,
  lastUpdated: string,
  windowDays: number,
  notes: Array<TNotesChangedRecentlyEntry>,
}

export type TNotesChangedRecentlyOptions = {
  noteTypes?: Array<TNotesChangedRecentlyNoteType>,
}

//--------------------------------------------------------------------------
// Timestamp / window helpers (exported for tests)

/**
 * Serialize a cache timestamp as ISO 8601 UTC.
 * @param {Date} when
 * @returns {string}
 */
export function serializeNotesChangedRecentlyTimestamp(when: Date): string {
  return when.toISOString()
}

/**
 * Parse a cache / preference timestamp. Returns null if missing/invalid.
 * @param {mixed} value
 * @returns {Date | null}
 */
export function parseNotesChangedRecentlyTimestamp(value: mixed): ?Date {
  if (value == null || value === '') return null
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null
  const m = moment(value)
  if (!m.isValid()) return null
  return m.toDate()
}

/**
 * Start of the rolling window: start of (today - (windowDays - 1)) in local timezone.
 * @param {number} windowDays - calendar days including today (default NOTES_CHANGED_RECENTLY_WINDOW_DAYS)
 * @param {Date} [now]
 * @returns {Date}
 */
export function getNotesChangedRecentlyWindowStart(windowDays: number = NOTES_CHANGED_RECENTLY_WINDOW_DAYS, now: Date = new Date()): Date {
  const days = Math.max(1, Math.floor(windowDays))
  return moment(now).startOf('day').subtract(days - 1, 'days').toDate()
}

/**
 * Minimal note fields needed to build a cache entry (avoids requiring a full TNote in tests/callers).
 */
export type TNotesChangedRecentlyNoteLike = {
  filename: string,
  type?: string,
  changedDate: ?Date | string,
}

/**
 * Map a note-like object to a cache entry. Uses note.type when present, else filename heuristics.
 * @param {TNotesChangedRecentlyNoteLike} note
 * @returns {TNotesChangedRecentlyEntry | null}
 */
export function noteToNotesChangedRecentlyEntry(note: TNotesChangedRecentlyNoteLike): ?TNotesChangedRecentlyEntry {
  if (note == null || typeof note.filename !== 'string' || note.filename === '') return null
  const changed = note.changedDate
  if (changed == null || changed === '') return null
  const changedDate = changed instanceof Date ? changed : new Date(changed)
  if (Number.isNaN(changedDate.getTime())) return null
  const rawType = note.type === 'Calendar' || note.type === 'Notes' ? note.type : noteType(note.filename)
  const resolvedType: TNotesChangedRecentlyNoteType = rawType === 'Calendar' ? 'Calendar' : 'Notes'
  return {
    filename: note.filename,
    noteType: resolvedType,
    changedAt: serializeNotesChangedRecentlyTimestamp(changedDate),
  }
}

/**
 * Drop entries whose changedAt is before the window start.
 * @param {Array<TNotesChangedRecentlyEntry>} notes
 * @param {Date} windowStart
 * @returns {Array<TNotesChangedRecentlyEntry>}
 */
export function pruneNotesChangedRecentlyEntries(
  notes: Array<TNotesChangedRecentlyEntry>,
  windowStart: Date,
): Array<TNotesChangedRecentlyEntry> {
  const startMs = windowStart.getTime()
  return notes.filter((entry) => {
    const when = parseNotesChangedRecentlyTimestamp(entry.changedAt)
    return when != null && when.getTime() >= startMs
  })
}

/**
 * Filter entries by optional noteTypes.
 * @param {Array<TNotesChangedRecentlyEntry>} notes
 * @param {TNotesChangedRecentlyOptions} [options]
 * @returns {Array<TNotesChangedRecentlyEntry>}
 */
export function filterNotesChangedRecentlyEntries(
  notes: Array<TNotesChangedRecentlyEntry>,
  options: TNotesChangedRecentlyOptions = {},
): Array<TNotesChangedRecentlyEntry> {
  const wanted = options.noteTypes
  if (wanted == null || wanted.length === 0) return notes
  const wantedSet = new Set(wanted)
  return notes.filter((entry) => wantedSet.has(entry.noteType))
}

/**
 * Parse cache JSON. Returns null if missing/invalid (not an empty usable cache).
 * @param {string} raw
 * @returns {TNotesChangedRecentlyCache | null}
 */
export function parseNotesChangedRecentlyCacheJson(raw: string): ?TNotesChangedRecentlyCache {
  try {
    if (raw == null || raw === '') return null
    const parsed = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.notes)) return null
    const notes: Array<TNotesChangedRecentlyEntry> = []
    for (const item of parsed.notes) {
      if (item == null || typeof item.filename !== 'string' || item.filename === '') continue
      const nt = item.noteType === 'Calendar' ? 'Calendar' : 'Notes'
      const changedAt =
        typeof item.changedAt === 'string' && item.changedAt !== ''
          ? item.changedAt
          : serializeNotesChangedRecentlyTimestamp(new Date(0))
      notes.push({ filename: item.filename, noteType: nt, changedAt })
    }
    return {
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      lastUpdated: typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : '',
      windowDays: typeof parsed.windowDays === 'number' ? parsed.windowDays : NOTES_CHANGED_RECENTLY_WINDOW_DAYS,
      notes,
    }
  } catch (err) {
    return null
  }
}

//--------------------------------------------------------------------------
// Pref / schedule

/**
 * Record last update time in preference (mirrors cache.lastUpdated).
 * @param {Date} when
 * @returns {void}
 */
function recordNotesChangedRecentlyLastUpdated(when: Date): void {
  DataStore.setPreference(lastUpdatedPref, when)
}

/**
 * Clear the scheduled-regeneration preference.
 * @returns {void}
 */
export function clearNotesChangedRecentlyGenerationSchedule(): void {
  logDebug('clearNotesChangedRecentlyGenerationSchedule', `Clearing notes-changed-recently regeneration pref`)
  DataStore.setPreference(regeneratePref, null)
}

/**
 * Schedule a full regenerate (clients run generate when ready).
 * @returns {void}
 */
export function scheduleNotesChangedRecentlyCacheGeneration(): void {
  logInfo('scheduleNotesChangedRecentlyCacheGeneration', `Scheduling notes-changed-recently cache generation`)
  DataStore.setPreference(regeneratePref, true)
}

/**
 * Whether a full regenerate is scheduled.
 * @returns {boolean}
 */
export function isNotesChangedRecentlyCacheGenerationScheduled(): boolean {
  return DataStore.preference(regeneratePref) === true
}

/**
 * Schedule regenerate if generatedAt is older than NOTES_CHANGED_RECENTLY_GENERATE_INTERVAL_DAYS.
 * @param {string} generatedAtStr
 * @returns {void}
 */
export function scheduleNotesChangedRecentlyCacheGenerationIfTooOld(generatedAtStr: string): void {
  const generatedAt = parseNotesChangedRecentlyTimestamp(generatedAtStr)
  if (generatedAt == null) {
    scheduleNotesChangedRecentlyCacheGeneration()
    return
  }
  const diffDays = moment().diff(moment(generatedAt), 'days', true)
  if (diffDays >= NOTES_CHANGED_RECENTLY_GENERATE_INTERVAL_DAYS) {
    logInfo(
      'scheduleNotesChangedRecentlyCacheGenerationIfTooOld',
      `Cache generatedAt is too old (${diffDays.toFixed(2)} days), scheduling regeneration`,
    )
    scheduleNotesChangedRecentlyCacheGeneration()
  }
}

/**
 * Newer of preference and cache.lastUpdated.
 * @param {TNotesChangedRecentlyCache} cache
 * @returns {{ lastRun: ?Date, source: string }}
 */
function getNotesChangedRecentlyLastRunInfo(cache: TNotesChangedRecentlyCache): { lastRun: ?Date, source: string } {
  const fromPref = parseNotesChangedRecentlyTimestamp(DataStore.preference(lastUpdatedPref))
  const fromCache = parseNotesChangedRecentlyTimestamp(cache.lastUpdated)
  if (fromPref != null && fromCache != null) {
    if (fromPref.getTime() >= fromCache.getTime()) {
      return { lastRun: fromPref, source: 'pref' }
    }
    return { lastRun: fromCache, source: 'cache.lastUpdated' }
  }
  if (fromPref != null) return { lastRun: fromPref, source: 'pref' }
  if (fromCache != null) return { lastRun: fromCache, source: 'cache.lastUpdated' }
  return { lastRun: null, source: 'none' }
}

//--------------------------------------------------------------------------
// Load / save

/**
 * True when the cache file exists and parses as a valid body.
 * @returns {boolean}
 */
export function isNotesChangedRecentlyCacheAvailable(): boolean {
  if (!DataStore.fileExists(NOTES_CHANGED_RECENTLY_CACHE_FILE)) return false
  const raw = DataStore.loadData(NOTES_CHANGED_RECENTLY_CACHE_FILE, true) ?? ''
  return parseNotesChangedRecentlyCacheJson(raw) != null
}

/**
 * Load cache from disk, or null if missing/corrupt.
 * @returns {TNotesChangedRecentlyCache | null}
 */
function loadNotesChangedRecentlyCache(): ?TNotesChangedRecentlyCache {
  if (!DataStore.fileExists(NOTES_CHANGED_RECENTLY_CACHE_FILE)) return null
  const raw = DataStore.loadData(NOTES_CHANGED_RECENTLY_CACHE_FILE, true) ?? ''
  return parseNotesChangedRecentlyCacheJson(raw)
}

/**
 * Persist cache body and lastUpdated preference.
 * @param {TNotesChangedRecentlyCache} cache
 * @returns {void}
 */
function saveNotesChangedRecentlyCache(cache: TNotesChangedRecentlyCache): void {
  DataStore.saveData(JSON.stringify(cache), NOTES_CHANGED_RECENTLY_CACHE_FILE, true)
  const when = parseNotesChangedRecentlyTimestamp(cache.lastUpdated) ?? new Date()
  recordNotesChangedRecentlyLastUpdated(when)
}

/**
 * INFO-level duration log for generate/update.
 * @param {string} fnName
 * @param {Date} startTime
 * @param {string} verb
 * @param {string} [detail]
 * @returns {void}
 */
function logNotesChangedRecentlyDuration(fnName: string, startTime: Date, verb: string, detail: string = ''): void {
  const suffix = detail !== '' ? ` ${detail}` : ''
  logDebug(fnName, `notes-changed-recently cache ${verb} in ${timer(startTime)}${suffix}`)
}

//--------------------------------------------------------------------------
// Sync read APIs (never scan the vault)

/**
 * All entries from disk, optionally filtered by noteTypes. Returns [] if missing/corrupt.
 * @param {TNotesChangedRecentlyOptions} [options]
 * @returns {Array<TNotesChangedRecentlyEntry>}
 */
export function getNotesChangedRecently(options: TNotesChangedRecentlyOptions = {}): Array<TNotesChangedRecentlyEntry> {
  const cache = loadNotesChangedRecentlyCache()
  if (cache == null) return []
  return filterNotesChangedRecentlyEntries(cache.notes, options)
}

/**
 * Filenames from the full window (optionally filtered by noteTypes).
 * @param {TNotesChangedRecentlyOptions} [options]
 * @returns {Array<string>}
 */
export function getFilenamesChangedRecently(options: TNotesChangedRecentlyOptions = {}): Array<string> {
  return getNotesChangedRecently(options).map((entry) => entry.filename)
}

/**
 * Filenames with changedAt >= sinceDate (and optional noteTypes filter).
 * @param {Date} sinceDate
 * @param {TNotesChangedRecentlyOptions} [options]
 * @returns {Array<string>}
 */
export function getFilenamesChangedSince(sinceDate: Date, options: TNotesChangedRecentlyOptions = {}): Array<string> {
  const sinceMs = sinceDate.getTime()
  return getNotesChangedRecently(options)
    .filter((entry) => {
      const when = parseNotesChangedRecentlyTimestamp(entry.changedAt)
      return when != null && when.getTime() >= sinceMs
    })
    .map((entry) => entry.filename)
}

/**
 * Filenames changed on the current calendar day (local timezone), optional noteTypes filter.
 * @param {TNotesChangedRecentlyOptions} [options]
 * @returns {Array<string>}
 */
export function getFilenamesChangedToday(options: TNotesChangedRecentlyOptions = {}): Array<string> {
  const todayStart = moment().startOf('day').toDate()
  return getFilenamesChangedSince(todayStart, options)
}

//--------------------------------------------------------------------------
// Generate / update

/**
 * Build cache entries from a note list (upsert by filename; later wins).
 * @param {Array<TNote>} notes
 * @returns {Array<TNotesChangedRecentlyEntry>}
 */
function entriesFromNotes(notes: Array<TNote>): Array<TNotesChangedRecentlyEntry> {
  const byFilename: Map<string, TNotesChangedRecentlyEntry> = new Map()
  for (const note of notes) {
    const entry = noteToNotesChangedRecentlyEntry({
      filename: note.filename,
      type: note.type,
      changedDate: note.changedDate,
    })
    if (entry != null) byFilename.set(entry.filename, entry)
  }
  return Array.from(byFilename.values())
}

/**
 * Full rebuild of the 7-calendar-day cache via getNotesChangedInLastCalendarDays.
 * Vault scan stays on the main thread; entry build/prune uses `runSyncWorkOnAsyncThread` when available.
 * @param {string} [reason]
 * @returns {Promise<void>}
 */
export async function generateNotesChangedRecentlyCache(reason: string = ''): Promise<void> {
  const startTime = new Date()
  try {
    if (notesChangedRecentlyGenerationInProgress) {
      logWarn('generateNotesChangedRecentlyCache', `Generation already in progress; skipping (${reason})`)
      return
    }
    notesChangedRecentlyGenerationInProgress = true
    logInfo('generateNotesChangedRecentlyCache', `Starting full rebuild${reason !== '' ? ` (${reason})` : ''}`)

    // DataStore note-list scan on main thread (same pattern as tagMentionCache).
    const changedNotes = getNotesChangedInLastCalendarDays(NOTES_CHANGED_RECENTLY_WINDOW_DAYS)
    logTimer('generateNotesChangedRecentlyCache', startTime, `scan returned ${changedNotes.length} notes`)

    const windowStart = getNotesChangedRecentlyWindowStart(NOTES_CHANGED_RECENTLY_WINDOW_DAYS, startTime)
    // Side-channel: do not return large arrays from runOnAsyncThread (can hang the Promise).
    let notesHolder: ?Array<TNotesChangedRecentlyEntry> = null
    await runSyncWorkOnAsyncThread('generateNotesChangedRecentlyCache build', () => {
      notesHolder = pruneNotesChangedRecentlyEntries(entriesFromNotes(changedNotes), windowStart)
      return true
    })
    const notes: Array<TNotesChangedRecentlyEntry> =
      notesHolder != null
        ? notesHolder
        : pruneNotesChangedRecentlyEntries(entriesFromNotes(changedNotes), windowStart)
    if (notesHolder == null) {
      logWarn('generateNotesChangedRecentlyCache', `- async build result missing; built entries on main thread`)
    }

    const stamp = serializeNotesChangedRecentlyTimestamp(startTime)
    const cache: TNotesChangedRecentlyCache = {
      generatedAt: stamp,
      lastUpdated: stamp,
      windowDays: NOTES_CHANGED_RECENTLY_WINDOW_DAYS,
      notes,
    }
    saveNotesChangedRecentlyCache(cache)
    clearNotesChangedRecentlyGenerationSchedule()
    logNotesChangedRecentlyDuration(
      'generateNotesChangedRecentlyCache',
      startTime,
      'rebuilt',
      `(${String(notes.length)} notes in ${String(NOTES_CHANGED_RECENTLY_WINDOW_DAYS)}-day window)`,
    )
  } catch (err) {
    logError('generateNotesChangedRecentlyCache', JSP(err))
  } finally {
    notesChangedRecentlyGenerationInProgress = false
  }
}

/**
 * Incremental update: upsert notes changed since last run; prune outside window.
 * If the cache file is missing or corrupt, runs a full `generateNotesChangedRecentlyCache` immediately
 * (build/prune on async thread when available).
 * @returns {Promise<void>}
 */
export async function updateNotesChangedRecentlyCache(): Promise<void> {
  const startTime = new Date()
  try {
    if (!isNotesChangedRecentlyCacheAvailable()) {
      logWarn(
        'updateNotesChangedRecentlyCache',
        `${NOTES_CHANGED_RECENTLY_CACHE_FILE} missing or corrupt; generating now`,
      )
      await generateNotesChangedRecentlyCache('missing or corrupt cache from update')
      return
    }

    const existing = loadNotesChangedRecentlyCache()
    if (existing == null) {
      logWarn('updateNotesChangedRecentlyCache', `Cache parse failed; generating now`)
      await generateNotesChangedRecentlyCache('unparseable cache from update')
      return
    }

    const { lastRun, source } = getNotesChangedRecentlyLastRunInfo(existing)
    const momPrevious = lastRun != null ? moment(lastRun) : moment(0)
    const momNow = moment(startTime)
    if (lastRun != null && momNow.diff(momPrevious, 'seconds') < SKIP_UPDATE_IF_NEWER_THAN_SECONDS) {
      logInfo('updateNotesChangedRecentlyCache', `- Not updating; last run < ${String(SKIP_UPDATE_IF_NEWER_THAN_SECONDS)}s ago (source: ${source})`)
      logNotesChangedRecentlyDuration('updateNotesChangedRecentlyCache', startTime, 'updated', `(skipped; updated less than ${String(SKIP_UPDATE_IF_NEWER_THAN_SECONDS)}s ago)`)
      return
    }

    // Full window scan then filter to lastRun -- avoids signed numDaysBack pitfalls; cost is one interval scan.
    const windowNotes = getNotesChangedInLastCalendarDays(NOTES_CHANGED_RECENTLY_WINDOW_DAYS)
    const jsdateToStartLooking = lastRun != null ? lastRun : getNotesChangedRecentlyWindowStart(NOTES_CHANGED_RECENTLY_WINDOW_DAYS, startTime)
    const recentlyChanged = windowNotes.filter((n) => n.changedDate != null && n.changedDate >= jsdateToStartLooking)
    logTimer(
      'updateNotesChangedRecentlyCache',
      startTime,
      `Found ${recentlyChanged.length} notes changed since last run (source: ${source}; window scan ${windowNotes.length})`,
    )

    const existingNotes = existing.notes
    const existingGeneratedAt = existing.generatedAt
    let notesHolder: ?Array<TNotesChangedRecentlyEntry> = null
    const windowStart = getNotesChangedRecentlyWindowStart(NOTES_CHANGED_RECENTLY_WINDOW_DAYS, startTime)
    await runSyncWorkOnAsyncThread('updateNotesChangedRecentlyCache merge', () => {
      const byFilename: Map<string, TNotesChangedRecentlyEntry> = new Map()
      for (const entry of existingNotes) {
        byFilename.set(entry.filename, entry)
      }
      for (const note of recentlyChanged) {
        const entry = noteToNotesChangedRecentlyEntry({
          filename: note.filename,
          type: note.type,
          changedDate: note.changedDate,
        })
        if (entry != null) byFilename.set(entry.filename, entry)
      }
      notesHolder = pruneNotesChangedRecentlyEntries(Array.from(byFilename.values()), windowStart)
      return true
    })
    let notes: Array<TNotesChangedRecentlyEntry> = notesHolder != null ? notesHolder : []
    if (notesHolder == null) {
      logWarn('updateNotesChangedRecentlyCache', `- async merge result missing; merging on main thread`)
      const byFilename: Map<string, TNotesChangedRecentlyEntry> = new Map()
      for (const entry of existingNotes) {
        byFilename.set(entry.filename, entry)
      }
      for (const note of recentlyChanged) {
        const entry = noteToNotesChangedRecentlyEntry({
          filename: note.filename,
          type: note.type,
          changedDate: note.changedDate,
        })
        if (entry != null) byFilename.set(entry.filename, entry)
      }
      notes = pruneNotesChangedRecentlyEntries(Array.from(byFilename.values()), windowStart)
    }

    const stamp = serializeNotesChangedRecentlyTimestamp(startTime)
    const cache: TNotesChangedRecentlyCache = {
      generatedAt: existingGeneratedAt !== '' ? existingGeneratedAt : stamp,
      lastUpdated: stamp,
      windowDays: NOTES_CHANGED_RECENTLY_WINDOW_DAYS,
      notes,
    }
    saveNotesChangedRecentlyCache(cache)

    if (cache.generatedAt !== '') {
      scheduleNotesChangedRecentlyCacheGenerationIfTooOld(cache.generatedAt)
    }

    logNotesChangedRecentlyDuration(
      'updateNotesChangedRecentlyCache',
      startTime,
      'updated',
      `(${String(notes.length)} notes after upsert/prune; ${String(recentlyChanged.length)} touched since last run)`,
    )
  } catch (err) {
    logError('updateNotesChangedRecentlyCache', JSP(err))
  }
}

/**
 * Run incremental update when lastUpdated is older than maxAgeHours (default 1).
 * If the cache is missing/corrupt, generates immediately.
 * @param {number} [maxAgeHours]
 * @returns {Promise<boolean>} true if update or generate was run
 */
export async function updateNotesChangedRecentlyCacheIfTooOld(
  maxAgeHours: number = NOTES_CHANGED_RECENTLY_UPDATE_INTERVAL_HOURS,
): Promise<boolean> {
  try {
    if (!isNotesChangedRecentlyCacheAvailable()) {
      logWarn('updateNotesChangedRecentlyCacheIfTooOld', `Cache not available; generating now`)
      await generateNotesChangedRecentlyCache('missing cache from updateIfTooOld')
      return true
    }
    const cache = loadNotesChangedRecentlyCache()
    if (cache == null) {
      logWarn('updateNotesChangedRecentlyCacheIfTooOld', `Cache unparseable; generating now`)
      await generateNotesChangedRecentlyCache('unparseable cache from updateIfTooOld')
      return true
    }
    const { lastRun } = getNotesChangedRecentlyLastRunInfo(cache)
    if (lastRun == null) {
      await updateNotesChangedRecentlyCache()
      return true
    }
    const diffHours = moment().diff(moment(lastRun), 'hours', true)
    if (diffHours >= maxAgeHours) {
      logInfo(
        'updateNotesChangedRecentlyCacheIfTooOld',
        `Last update too old (${diffHours.toFixed(3)}h >= ${String(maxAgeHours)}h); updating`,
      )
      await updateNotesChangedRecentlyCache()
      return true
    }
    logDebug('updateNotesChangedRecentlyCacheIfTooOld', `Last update fresh enough (${diffHours.toFixed(3)}h)`)
    if (cache.generatedAt !== '') {
      scheduleNotesChangedRecentlyCacheGenerationIfTooOld(cache.generatedAt)
    }
    return false
  } catch (err) {
    logError('updateNotesChangedRecentlyCacheIfTooOld', JSP(err))
    return false
  }
}
