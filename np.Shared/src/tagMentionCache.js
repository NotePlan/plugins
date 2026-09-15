// @flow
//-----------------------------------------------------------------------------
// Shared tag/mention cache for any plugin (owned by np.Shared)
// Written originally by @jgclark for Dashboard plugin.
// last updated 2026-09-15 for v1.1.1 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------
// Cache body (`tagMentionCache.json`):
// {
//   generatedAt: ISO UTC string,
//   lastUpdated: ISO UTC string,
//   wantedItems: ['@Alice', '#project'],
//   regularNotes: [{filename: 'note1.md', items: ['@BOB']}],
//   calendarNotes: [{filename: 'note3.md', items: ['#BOB']}],
// }
//
// Registrations (`wantedTagMentionsList.json`):
// {
//   registrations: { 'jgclark.Dashboard': ['@Alice'], 'jgclark.Reviews': ['#project'] }
// }
// The cache indexes the union of all registrations. A plugin may replace only its own list.
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { CaseInsensitiveSet } from '@helpers/general'
import { noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { RE_NP_HASHTAG_G, RE_NP_MENTION_G } from '@helpers/regex'
import { caseInsensitiveArrayIncludes, caseInsensitiveMatch, caseInsensitiveSubstringMatch, getCorrectedHashtagsFromNote, getCorrectedMentionsFromNote } from '@helpers/search'
import { getHashtagsFromString } from '@helpers/stringTransforms'

//--------------------------------------------------------------------------
// Constants

const SHARED_PLUGIN_ID = 'np.Shared'
const DASHBOARD_PLUGIN_ID = 'jgclark.Dashboard'

// Fully specified so any plugin context can read/write Shared's data folder
const wantedTagMentionsListFile = `../../data/${SHARED_PLUGIN_ID}/wantedTagMentionsList.json`
const tagMentionCacheFile = `../../data/${SHARED_PLUGIN_ID}/tagMentionCache.json`

const lastTimeThisWasRunPref = 'np.Shared.tagMentionCache.lastTimeUpdated'
const regenerateTagMentionCachePref = 'np.Shared.tagMentionCache.regenerateTagMentionCache'

const TAG_CACHE_UPDATE_INTERVAL_HOURS = 1 // how often to update the cache
const TAG_CACHE_GENERATE_INTERVAL_DAYS = 5 // how often to re-generate the cache from scratch
// Skip a second full scan if generate just finished with the same wanted items (same JSContext, no real await).
const TAG_CACHE_SKIP_REDUNDANT_REBUILD_MS = 2 * 60 * 1000

let tagMentionCacheGenerationInProgress = false

// Note: Earlier I tried caching all tags in a note with the blacklist
// EXCLUDED_TAGS_OR_MENTIONS of ['@done', '@start', '@review', '@reviewed', '@completed', '@cancelled'].
// Cache only explicit wanted tags/mentions from the union of per-plugin registrations.
const TAG_CACHE_ONLY_FOR_OPEN_ITEMS = true // Note: if false, then for JGC the cache file is 20x larger.

/**
 * Optional progress hooks for generate (Dashboard banners). Shared itself only uses CommandBar.showLoading.
 */
export type TTagMentionCacheProgress = {
  onProgress?: (message: string) => Promise<void> | void,
  onComplete?: (message: string) => Promise<void> | void,
  onError?: (message: string) => Promise<void> | void,
  onRemoveProgress?: () => Promise<void> | void,
}

export type TTagMentionCacheRegistrations = { [pluginId: string]: Array<string> }

export const WANTED_PARA_TYPES: Array<string> = TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ['open', 'checklist', 'scheduled', 'checklistScheduled'] : []

export type TagMentionLookupContext = {
  wantedItems: Array<string>,
  wantedLower: Set<string>,
  wantedHashtags: Array<string>,
  wantedMentions: Array<string>,
  scanHashtags: boolean,
  scanMentions: boolean,
}

//-----------------------------------------------------------------
// private functions for the cache

function clearTagMentionCacheGenerationPref(): void {
  logDebug('clearTagMentionCacheGenerationPref', `Clearing tag mention cache generation pref.`)
  DataStore.setPreference(regenerateTagMentionCachePref, null)
}

/**
 * Serialize a cache timestamp for `tagMentionCache.json` as ISO 8601 UTC (e.g. `2026-05-31T20:07:41.123Z`).
 * Age comparisons use absolute instants; UTC ISO avoids ambiguity when the file is read back as a string.
 * @param {Date} when
 * @returns {string}
 */
function serializeTagMentionCacheTimestamp(when: Date): string {
  return when.toISOString()
}

/**
 * Parse `generatedAt` / `lastUpdated` from the cache file or from `DataStore.preference`.
 * Accepts `Date` (from preferences) or ISO string (from JSON). Returns null if missing/invalid.
 * @param {Date | string | null | void} value
 * @returns {Date | null}
 */
function parseTagMentionCacheTimestamp(value: ?(Date | string)): ?Date {
  if (value == null || value === '') return null
  const m = moment(value)
  if (!m.isValid()) return null
  return m.toDate()
}

/**
 * Whether two wanted-item lists contain the same tags/mentions (order-independent).
 * @param {Array<string>} a
 * @param {Array<string>} b
 * @returns {boolean}
 */
function cacheHasSameWantedItems(a: Array<string>, b: Array<string>): boolean {
  return a.length === b.length && a.every((item) => b.includes(item)) && b.every((item) => a.includes(item))
}

/**
 * True when the cache file already indexes the same wanted items and was generated within the last couple of minutes.
 * Used so a scheduled generate after a just-finished rebuild does not scan every note again.
 * @param {Array<string>} wantedItems
 * @returns {boolean}
 */
function shouldSkipRedundantCacheRebuild(wantedItems: Array<string>): boolean {
  if (!DataStore.fileExists(tagMentionCacheFile)) return false
  try {
    const parsedCache = JSON.parse(DataStore.loadData(tagMentionCacheFile, true) ?? '') ?? {}
    if (!cacheHasSameWantedItems(parsedCache.wantedItems ?? [], wantedItems)) return false
    const generatedAt = parseTagMentionCacheTimestamp(parsedCache.generatedAt)
    if (generatedAt == null) return false
    return Date.now() - generatedAt.getTime() < TAG_CACHE_SKIP_REDUNDANT_REBUILD_MS
  } catch (err) {
    return false
  }
}

/**
 * Record when the tag mention cache was last built or incrementally updated.
 * Keeps `lastTimeThisWasRunPref` in sync with `cache.lastUpdated` in `tagMentionCache.json`.
 * Both `generateTagMentionCache` and `updateTagMentionCache` must call this after saving the file —
 * otherwise a full rebuild updates the JSON but the next refresh still sees a stale pref age (see updateTagMentionCache log).
 * @param {Date} when
 */
function recordTagMentionCacheLastRunTime(when: Date): void {
  DataStore.setPreference(lastTimeThisWasRunPref, when)
  logDebug('recordTagMentionCacheLastRunTime', `set ${lastTimeThisWasRunPref} to ${when.toISOString()} (local ${moment(when).format()})`)
}

/**
 * INFO-level duration for a tag-mention cache rebuild, incremental update, or access.
 * @param {string} functionName
 * @param {Date} startTime
 * @param {string} operation
 * @param {string} details
 * @returns {void}
 */
function logTagMentionCacheDuration(functionName: string, startTime: Date, operation: string, details: string = ''): void {
  const suffix = details !== '' ? ` ${details}` : ''
  logInfo(functionName, `${operation} in ${timer(startTime)}${suffix}`)
}

/**
 * Read last-run pref from Shared only.
 * @returns {mixed}
 */
function readLastTimeThisWasRunPref(): mixed {
  return DataStore.preference(lastTimeThisWasRunPref)
}

/**
 * Read regen-scheduled pref from Shared only.
 * @returns {boolean}
 */
function readRegeneratePref(): boolean {
  return DataStore.preference(regenerateTagMentionCachePref) === true
}

/**
 * Resolve the last cache run instant for incremental update / age checks.
 * Uses the newer of `cache.lastUpdated` (file) and `lastTimeThisWasRunPref` (preference) so a full rebuild
 * is recognised even if the pref was not updated in older plugin versions.
 * @param {Object} cache - parsed tagMentionCache.json
 * @returns {{ lastRun: Date | null, source: string }}
 */
function getTagMentionCacheLastRunInfo(cache: Object): { lastRun: ?Date, source: string } {
  // Cast: DataStore.preference() is declared `mixed`; parseTagMentionCacheTimestamp() already handles anything it is given.
  const fromPref = parseTagMentionCacheTimestamp((readLastTimeThisWasRunPref(): any))
  const fromFile = parseTagMentionCacheTimestamp(cache?.lastUpdated)
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

/**
 * Build lookup structures once per cache generate/update run.
 * @param {Array<string>} wantedItems
 * @returns {TagMentionLookupContext}
 */
export function buildTagMentionLookupContext(wantedItems: Array<string>): TagMentionLookupContext {
  const wantedHashtags = wantedItems.filter((w) => w.startsWith('#'))
  const wantedMentions = wantedItems.filter((w) => w.startsWith('@'))
  return {
    wantedItems,
    wantedLower: new Set(wantedItems.map((w) => w.toLowerCase())),
    wantedHashtags,
    wantedMentions,
    scanHashtags: wantedHashtags.length > 0,
    scanMentions: wantedMentions.length > 0,
  }
}

/**
 * Trim trailing parenthetical suffix from a mention (NotePlan convention).
 * @param {string} mention
 * @returns {string}
 */
export function trimMentionSuffix(mention: string): string {
  return mention.replace(/\s*\(.*\)$/, '')
}

/**
 * @param {string} term
 * @param {TagMentionLookupContext} ctx
 * @returns {boolean}
 */
export function isWantedItem(term: string, ctx: TagMentionLookupContext): boolean {
  if (term === '') return false
  return ctx.wantedLower.has(term.toLowerCase())
}

/**
 * @param {string} mention
 * @param {TagMentionLookupContext} ctx
 * @returns {boolean}
 */
export function isWantedMention(mention: string, ctx: TagMentionLookupContext): boolean {
  return isWantedItem(trimMentionSuffix(mention), ctx)
}

/**
 * String values of every frontmatter field (arrays flattened).
 * @param {TNote} note
 * @returns {Array<string>}
 */
function frontmatterValuesAsStrings(note: TNote): Array<string> {
  const attrs = note.frontmatterAttributes || {}
  const values: Array<string> = []
  for (const key of Object.keys(attrs)) {
    const raw: mixed = attrs[key]
    if (raw == null || raw === '') continue
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item != null && String(item).trim() !== '') values.push(String(item))
      }
    } else {
      values.push(String(raw))
    }
  }
  return values
}

/**
 * Wanted tags/mentions found in any frontmatter field value (not only `note-tag` or Reviews `project:`).
 * @param {TNote} note
 * @param {TagMentionLookupContext} ctx
 * @returns {Array<string>}
 */
function getWantedItemsFromAllFrontmatter(note: TNote, ctx: TagMentionLookupContext): Array<string> {
  if (!noteHasFrontMatter(note)) return []
  if (!ctx.scanHashtags && !ctx.scanMentions) return []
  const found = new CaseInsensitiveSet()
  for (const value of frontmatterValuesAsStrings(note)) {
    if (ctx.scanHashtags) {
      for (const tag of getHashtagsFromString(value)) {
        if (isWantedItem(tag, ctx)) found.add(tag)
      }
    }
    if (ctx.scanMentions) {
      const mentions = value.matchAll(RE_NP_MENTION_G)
      for (const m of mentions) {
        const mention = m[1].trim()
        if (isWantedMention(mention, ctx)) found.add(trimMentionSuffix(mention))
      }
    }
  }
  return [...found]
}

/**
 * True if any frontmatter field contains a wanted hashtag or mention.
 * @param {TNote} note
 * @param {TagMentionLookupContext} ctx
 * @returns {boolean}
 */
function noteFrontmatterHasWantedTag(note: TNote, ctx: TagMentionLookupContext): boolean {
  return getWantedItemsFromAllFrontmatter(note, ctx).length > 0
}

/**
 * Staged pre-filter: skip expensive regex/paragraph work when note cannot contain wanted items.
 * @param {TNote} note
 * @param {TagMentionLookupContext} ctx
 * @returns {boolean}
 */
/**
 * @param {string} text
 * @param {TagMentionLookupContext} ctx
 * @returns {boolean}
 */
function textMayContainWantedItems(text: string, ctx: TagMentionLookupContext): boolean {
  if (ctx.scanMentions && text.includes('@')) {
    const lower = text.toLowerCase()
    if (ctx.wantedMentions.some((w) => lower.includes(w.toLowerCase()))) return true
  }
  if (ctx.scanHashtags && text.includes('#')) {
    const lower = text.toLowerCase()
    if (ctx.wantedHashtags.some((w) => lower.includes(w.toLowerCase()))) return true
  }
  return false
}

export function noteMayContainCacheItems(note: TNote, ctx: TagMentionLookupContext): boolean {
  if (ctx.wantedItems.length === 0) return false

  const content = note.content ?? ''
  if (textMayContainWantedItems(content, ctx)) return true

  // Open-items cache: also probe open-type paragraphs (tags may only appear on tasks, not in stale/summary content)
  if (WANTED_PARA_TYPES.length > 0) {
    const wantedParaTypesSet = new Set(WANTED_PARA_TYPES)
    for (const p of note.paragraphs) {
      if (!wantedParaTypesSet.has(p.type)) continue
      if (textMayContainWantedItems(p.content, ctx)) return true
    }
  }

  if (noteFrontmatterHasWantedTag(note, ctx)) return true

  return false
}

/**
 * Extract wanted tags/mentions from open-type paragraphs only (single pass).
 * @param {TNote} note
 * @param {TagMentionLookupContext} ctx
 * @param {boolean} includeNoteTags
 * @returns {Array<string>}
 */
function getWantedTagOrMentionListFromNoteOpenItemsOnly(
  note: TNote,
  ctx: TagMentionLookupContext,
  includeNoteTags: boolean = true,
): Array<string> {
  const wantedParaTypesSet = new Set(WANTED_PARA_TYPES)
  const foundItems = new CaseInsensitiveSet()

  for (const p of note.paragraphs) {
    if (!wantedParaTypesSet.has(p.type)) continue
    const text = p.content

    if (ctx.scanHashtags) {
      const hashtagsInPara = text.match(RE_NP_HASHTAG_G) ?? []
      for (const hashtag of hashtagsInPara) {
        const tag = hashtag.trim()
        if (isWantedItem(tag, ctx)) foundItems.add(tag)
      }
    }

    if (ctx.scanMentions) {
      const mentionsInPara = text.matchAll(RE_NP_MENTION_G)
      for (const m of mentionsInPara) {
        const mention = m[1].trim()
        if (isWantedMention(mention, ctx)) foundItems.add(trimMentionSuffix(mention))
      }
    }
  }

  if (includeNoteTags) {
    for (const item of getWantedItemsFromAllFrontmatter(note, ctx)) {
      foundItems.add(item)
    }
  }

  return [...foundItems]
}

/**
 * Process notes for cache build; returns cache rows and stats.
 * @param {Array<TNote>} notes
 * @param {TagMentionLookupContext} ctx
 * @returns {{ entries: Array<{ filename: string, items: Array<string> }>, matchingNoteCount: number, totalFoundItems: number, notesSkippedByPrefilter: number }}
 */
function processNotesForTagMentionCache(
  notes: $ReadOnlyArray<TNote>,
  ctx: TagMentionLookupContext,
): { entries: Array<{ filename: string, items: Array<string> }>, matchingNoteCount: number, totalFoundItems: number, notesSkippedByPrefilter: number } {
  const entries = []
  let matchingNoteCount = 0
  let totalFoundItems = 0
  let notesSkippedByPrefilter = 0
  let noteCount = 0

  for (const note of notes) {
    noteCount++
    // Note: This is not actually being shown, as we get spinning beachball instead.
    if (noteCount % 100 === 0) {
      CommandBar.showLoading(true, `Generating tag/mention cache`, noteCount/notes.length)
    }
    if (!noteMayContainCacheItems(note, ctx)) {
      notesSkippedByPrefilter++
      continue
    }
    const foundItems = getFoundItemsFromNote(note, ctx)
    if (foundItems.length > 0) {
      entries.push({ filename: note.filename, items: foundItems })
      totalFoundItems += foundItems.length
      matchingNoteCount++
    }
  }
  CommandBar.showLoading(false)

  return { entries, matchingNoteCount, totalFoundItems, notesSkippedByPrefilter }
}

//-----------------------------------------------------------------
// exported Getter and setter functions

export function isTagMentionCacheAvailable(): boolean {
  return DataStore.fileExists(tagMentionCacheFile)
}

export function isTagMentionCacheAvailableForItem(item: string): boolean {
  if (isTagMentionCacheAvailable()) {
    const cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const parsedCache = JSON.parse(cache) ?? {}
    const wantedItems = parsedCache.wantedItems ?? []
    const result = wantedItems.some((wanted) => caseInsensitiveMatch(item, wanted))
    logDebug('isTagMentionCacheAvailableForItem', `-> ${item}: ${result}`)
    return result
  } else {
    return false
  }
}

export function isTagMentionCacheGenerationScheduled(): boolean {
  return readRegeneratePref()
}

/**
 * Schedule a regeneration of the tag mention cache if it's too old (>24 hours). Note: assumes that the cache is available.
 * @param {string} generatedAtStr The date and time the cache was generated.
 */
export function scheduleTagMentionCacheGenerationIfTooOld(generatedAtStr: string): void {
  const nowMom = moment()
  const generatedAtMom = moment(generatedAtStr)
  const diffHours = nowMom.diff(generatedAtMom, 'hours', true).toFixed(3) // 3 significant figures
  if (diffHours >= (TAG_CACHE_GENERATE_INTERVAL_DAYS * 24)) {
    logInfo('scheduleTagMentionCacheGenerationIfTooOld', `Tag mention cache is too old (${diffHours}hours), so scheduling a regeneration.`)
    scheduleTagMentionCacheGeneration()
  } else {
    logDebug('scheduleTagMentionCacheGenerationIfTooOld', `Tag mention cache is not too old (${diffHours}hours).`)
  }
}

/**
 * Update the tag mention cache if it's too old (>1 hour). Note: assumes that the cache is available.
 * @param {string} updatedAtStr The date and time the cache was last updated.
 * @returns {boolean} True if the cache was updated, false otherwise.
 */
export async function updateTagMentionCacheIfTooOld(updatedAtStr: string): Promise<boolean> {
  const nowMom = moment()
  const updatedAtMom = moment(updatedAtStr)
  const diffHours = nowMom.diff(updatedAtMom, 'hours', true)
  const diffHours3SF = diffHours.toFixed(3) // 3 significant figures
  if (diffHours >= TAG_CACHE_UPDATE_INTERVAL_HOURS) {
    logInfo('updateTagMentionCacheIfTooOld', `Tag mention cache last update is too old (${diffHours3SF}hours), so will now update it ...`)
    await updateTagMentionCache()
    return true
  } else {
    logDebug('updateTagMentionCacheIfTooOld', `Tag mention cache last update is not too old (${diffHours3SF}hours).`)
    return false
  }
}

export function scheduleTagMentionCacheGeneration(): void {
  logInfo('scheduleTagMentionCacheGeneration', `Scheduling tag mention cache generation.`)
  DataStore.setPreference(regenerateTagMentionCachePref, true)
}

/**
 * Unique trimmed items across all plugin registrations (order: first plugin, then first seen).
 * @param {TTagMentionCacheRegistrations} registrations
 * @returns {Array<string>}
 */
export function getUnionOfTagMentionCacheRegistrations(registrations: TTagMentionCacheRegistrations): Array<string> {
  const seen = new Set<string>()
  const union: Array<string> = []
  for (const pluginId of Object.keys(registrations)) {
    const items = registrations[pluginId] ?? []
    for (const raw of items) {
      const item = String(raw).trim()
      if (item === '') continue
      const key = item.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        union.push(item)
      }
    }
  }
  return union
}

/**
 * Parse wanted-list JSON: new `{ registrations }` or legacy `{ items }` (attributed to Dashboard).
 * @param {string} raw
 * @returns {TTagMentionCacheRegistrations}
 */
export function parseTagMentionCacheRegistrationsJson(raw: string): TTagMentionCacheRegistrations {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.registrations && typeof parsed.registrations === 'object' && !Array.isArray(parsed.registrations)) {
      const registrations: TTagMentionCacheRegistrations = {}
      for (const pluginId of Object.keys(parsed.registrations)) {
        const items = parsed.registrations[pluginId]
        registrations[pluginId] = Array.isArray(items) ? items.map((i: mixed) => String(i).trim()).filter(Boolean) : []
      }
      return registrations
    }
    if (parsed && Array.isArray(parsed.items)) {
      return { [DASHBOARD_PLUGIN_ID]: parsed.items.map((i) => String(i).trim()).filter(Boolean) }
    }
  } catch (err) {
    logWarn('parseTagMentionCacheRegistrationsJson', err instanceof Error ? err.message : String(err))
  }
  return {}
}

/**
 * Load per-plugin registrations from Shared's wanted list file.
 * @returns {TTagMentionCacheRegistrations}
 */
export function getTagMentionCacheRegistrations(): TTagMentionCacheRegistrations {
  if (!DataStore.fileExists(wantedTagMentionsListFile)) return {}
  const data = DataStore.loadData(wantedTagMentionsListFile, true) ?? ''
  return parseTagMentionCacheRegistrationsJson(data)
}

/**
 * Persist registrations and return the new union.
 * @param {TTagMentionCacheRegistrations} registrations
 * @returns {Array<string>}
 */
function saveTagMentionCacheRegistrations(registrations: TTagMentionCacheRegistrations): Array<string> {
  const cleaned: TTagMentionCacheRegistrations = {}
  for (const pluginId of Object.keys(registrations)) {
    const items = (registrations[pluginId] ?? []).map((i) => String(i).trim()).filter(Boolean)
    if (items.length > 0) {
      cleaned[pluginId] = items
    }
  }
  DataStore.saveData(JSON.stringify({ registrations: cleaned }), wantedTagMentionsListFile, true)
  return getUnionOfTagMentionCacheRegistrations(cleaned)
}

/**
 * Drop cache-row items that are no longer in the union. Removes notes that become empty.
 * @param {Object} cache
 * @param {Array<string>} union
 * @returns {Object}
 */
export function pruneTagMentionCacheToUnion(cache: Object, union: Array<string>): Object {
  const unionLower = new Set(union.map((i) => i.toLowerCase()))
  const pruneNotes = (notes: Array<any>): Array<any> => {
    if (!Array.isArray(notes)) return []
    return notes
      .map((row) => {
        const items = (row.items ?? []).filter((item) => unionLower.has(String(item).toLowerCase()))
        return { ...row, items }
      })
      .filter((row) => row.items.length > 0)
  }
  return {
    ...cache,
    wantedItems: union,
    regularNotes: pruneNotes(cache.regularNotes ?? []),
    calendarNotes: pruneNotes(cache.calendarNotes ?? []),
  }
}

/**
 * If the cache file exists, prune items that left the union and save.
 * @param {Array<string>} union
 * @returns {void}
 */
function pruneSavedCacheToUnion(union: Array<string>): void {
  if (!DataStore.fileExists(tagMentionCacheFile)) return
  try {
    const raw = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const parsed = JSON.parse(raw)
    const pruned = pruneTagMentionCacheToUnion(parsed, union)
    DataStore.saveData(JSON.stringify(pruned), tagMentionCacheFile, true)
  } catch (err) {
    logWarn('pruneSavedCacheToUnion', err instanceof Error ? err.message : String(err))
  }
}

/**
 * Union of tags/mentions all plugins have registered.
 * @returns {Array<string>}
 */
export function getTagMentionCacheDefinitions(): Array<string> {
  return getUnionOfTagMentionCacheRegistrations(getTagMentionCacheRegistrations())
}

/**
 * Replace one plugin's registered items. New union items *schedule* a cache regen (Dashboard runs it after
 * refresh). Dropped union items are pruned. Do not start a full scan here: JSContext is single-threaded, so
 * a fire-and-forget generate still blocks the caller and a later scheduled generate would scan twice.
 * @param {string} pluginId
 * @param {Array<string>} items
 * @returns {{ union: Array<string>, addedToUnion: Array<string>, removedFromUnion: Array<string> }}
 */
export function registerTagMentionCacheItems(
  pluginId: string,
  items: Array<string>,
): { union: Array<string>, addedToUnion: Array<string>, removedFromUnion: Array<string> } {
  const id = pluginId.trim()
  if (id === '') {
    return { union: getTagMentionCacheDefinitions(), addedToUnion: [], removedFromUnion: [] }
  }
  const before = getTagMentionCacheDefinitions()
  const registrations = getTagMentionCacheRegistrations()
  registrations[id] = items.map((i) => String(i).trim()).filter(Boolean)
  const union = saveTagMentionCacheRegistrations(registrations)
  const beforeLower = new Set(before.map((i) => i.toLowerCase()))
  const unionLower = new Set(union.map((i) => i.toLowerCase()))
  const addedToUnion = union.filter((i) => !beforeLower.has(i.toLowerCase()))
  const removedFromUnion = before.filter((i) => !unionLower.has(i.toLowerCase()))
  logInfo('registerTagMentionCacheItems', `plugin '${id}' now has [${String(registrations[id] ?? [])}]; union [${String(union)}]`)
  if (removedFromUnion.length > 0) {
    pruneSavedCacheToUnion(union)
  }
  if (addedToUnion.length > 0) {
    // Schedule only. Starting generate here used to run the full scan on the same JSContext before this
    // function returned, then Dashboard's end-of-refresh scheduled generate scanned everything again.
    logInfo('registerTagMentionCacheItems', `- ${addedToUnion.length} new union item(s); scheduling cache regeneration`)
    scheduleTagMentionCacheGeneration()
  }
  return { union, addedToUnion, removedFromUnion }
}

/**
 * Remove a plugin's registration entirely. Items stay if another plugin still wants them.
 * @param {string} pluginId
 * @returns {{ union: Array<string>, removedFromUnion: Array<string> }}
 */
export function unregisterTagMentionCacheItems(pluginId: string): { union: Array<string>, removedFromUnion: Array<string> } {
  const before = getTagMentionCacheDefinitions()
  const registrations = getTagMentionCacheRegistrations()
  delete registrations[pluginId]
  const union = saveTagMentionCacheRegistrations(registrations)
  const unionLower = new Set(union.map((i) => i.toLowerCase()))
  const removedFromUnion = before.filter((i) => !unionLower.has(i.toLowerCase()))
  logInfo('unregisterTagMentionCacheItems', `removed '${pluginId}'; union [${String(union)}]`)
  if (removedFromUnion.length > 0) {
    pruneSavedCacheToUnion(union)
  }
  return { union, removedFromUnion }
}

/**
 * Add items to one plugin's list (does not remove existing items for that plugin).
 * @param {string} pluginId
 * @param {Array<string>} mentionOrTagsIn
 * @returns {void}
 */
export function addTagMentionCacheItemsForPlugin(pluginId: string, mentionOrTagsIn: Array<string>): void {
  const registrations = getTagMentionCacheRegistrations()
  const existing = registrations[pluginId] ?? []
  const merged = existing.slice()
  for (const mentionOrTag of mentionOrTagsIn) {
    const trimmed = mentionOrTag.trim()
    if (trimmed !== '' && !merged.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      merged.push(trimmed)
    }
  }
  registerTagMentionCacheItems(pluginId, merged)
}

/**
 * Dashboard-compat: add items to the Dashboard registration slot.
 * @param {Array<string>} mentionOrTagsIn
 * @returns {void}
 */
export function addTagMentionCacheDefinitions(mentionOrTagsIn: Array<string>): void {
  addTagMentionCacheItemsForPlugin(DASHBOARD_PLUGIN_ID, mentionOrTagsIn)
}

/**
 * Dashboard-compat: replace the Dashboard registration slot only (other plugins are kept).
 * @param {Array<string>} wantedItems
 * @returns {void}
 */
export function setTagMentionCacheDefinitions(wantedItems: Array<string>): void {
  registerTagMentionCacheItems(DASHBOARD_PLUGIN_ID, wantedItems)
}

/**
 * Use tagMentionCache to returns a list of notes that contain the given tags and/or mentions.
 * It does so in a case-insensitive way, so asking for '@BOB' will find '@bob' and '@Bob'.
 * It does not do any filtering by para type.
 * @param {Array<string>} tagOrMentions The tags and/or mentions to search for.
 * @param {boolean} firstUpdateCache If true, the cache will be updated before the search is done. (Default: true)
 * @returns {[Array<string>, string]} An array of note filenames that contain the tag or mention, and a cache-age string for diagnostics.
 */
export async function getFilenamesOfNotesWithTagOrMentions(
  tagOrMentions: Array<string>,
  firstUpdateCache: boolean = true,
): Promise<[Array<string>, string]> {
  try {
    logInfo(
      'getFilenamesOfNotesWithTagOrMentions',
      `Starting for tag/mention(s) [${String(tagOrMentions)}]${firstUpdateCache ? '. (First update cache)' : ''}. TAG_CACHE_ONLY_FOR_OPEN_ITEMS: ${String(TAG_CACHE_ONLY_FOR_OPEN_ITEMS)}`,
    )

    // 1. Ensure cache is ready for the requested tags/mentions
    await ensureCacheIsReadyForTags(tagOrMentions, firstUpdateCache)

    // 2. Load and refresh cache if needed
    const startTime = new Date()
    const cache = await loadAndRefreshCacheIfNeeded()

    // 3. Find matching notes from cache
    const matchingNoteFilenamesFromCache = findMatchingNotesFromCache(tagOrMentions, cache)
    logTagMentionCacheDuration('getFilenamesOfNotesWithTagOrMentions', startTime, 'accessed', `(found ${String(matchingNoteFilenamesFromCache.length)} notes for [${String(tagOrMentions)}])`)
    logTimer(
      'getFilenamesOfNotesWithTagOrMentions',
      startTime,
      `-> found ${String(matchingNoteFilenamesFromCache.length)} notes from CACHE with wanted tags/mentions [${String(tagOrMentions)}]:`,
    )

    // 4. Add cache age info
    const cacheAgeInfo = buildCacheAgeInfo(cache)

    // 5. Schedule regeneration if needed
    scheduleTagMentionCacheGenerationIfTooOld(cache.generatedAt)

    return [matchingNoteFilenamesFromCache, cacheAgeInfo]
  } catch (err) {
    logError('getFilenamesOfNotesWithTagOrMentions', JSP(err))
    return [[], 'error']
  }
}

/**
 * Generate the mention tag cache from scratch.
 * Writes all instances of wanted mentions and tags (from the wantedTagMentionsList) to the tagMentionCacheFile, by filename.
 * Note: this includes all calendar notes, and all regular notes, apart from those in special folders (starts with '@'), including @Templates, @Archive and @Trash folders.
 *
 * **Threading:** The note scan and `DataStore.saveData()` run on the main thread, not via `CommandBar.onAsyncThread()`.
 * This rebuild can take 1–2 minutes, but async-thread execution has proved unreliable here: work can stall or be dropped
 * (notably when invoked as an external/plugin command), so `tagMentionCache.json` never gets a new `generatedAt` and
 * completion logs never appear. `showLoading()` gives user feedback without moving the scan off the main thread.
 * WebView banner messages also require the main thread (see NotePlan docs on `onAsyncThread`).
 *
 * @param {string} generationReason The reason for the generation, for info & logging purposes.
 * @param {boolean} forceRebuild If true, the cache will be rebuilt from scratch, otherwise it will revert to the quicker 'updateTagMentionCache' function if the WANTED_PARA_TYPES are all already in the cache.
 * @param {TTagMentionCacheProgress} progress Optional Dashboard (or other) UI callbacks. Shared always uses CommandBar.showLoading.
 */
export async function generateTagMentionCache(
  generationReason: string = 'Triggered by external call',
  forceRebuild: boolean = true,
  progress: TTagMentionCacheProgress = {},
): Promise<void> {
  if (tagMentionCacheGenerationInProgress) {
    logInfo('generateTagMentionCache', `- already in progress; skipping duplicate start (${generationReason})`)
    return
  }
  tagMentionCacheGenerationInProgress = true
  const startTime = new Date()
  let progressBannerShown = false
  let loadingIndicatorShown = false
  try {
    // Note: this doesn't get the current definitions, if the perspective definition has changed and not yet saved. However, getTaggedSectionData() notices this and updates the list and asks for a Cache rebuild, so it quickly gets resolved.
    const wantedItems = getTagMentionCacheDefinitions()
    // const config = await getDashboardSettings()
    logDebug('generateTagMentionCache', `Starting with wantedItems:[${String(wantedItems)}] for ${generationReason}`)
    // logDebug('generateTagMentionCache', `- ${TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ' ONLY FOR OPEN ITEMS' : ' ON ANY PARA TYPE'}`)

    if (shouldSkipRedundantCacheRebuild(wantedItems)) {
      logInfo('generateTagMentionCache', `- cache already has all wanted items and was generated recently; skipping rebuild (${generationReason})`)
      clearTagMentionCacheGenerationPref()
      return
    }

    // If we're not forcing a rebuild, and the WANTED_PARA_TYPES are the same as (or less than) what is in the cache, then use the quicker 'updateTagMentionCache' function
    if (!forceRebuild) {
      // Get wantedItems from the cache
      const existingCache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
      const parsedCache = JSON.parse(existingCache) ?? {}
      const cachedWantedItems = parsedCache.wantedItems ?? []
      logInfo('generateTagMentionCache', `- cachedWantedItems: [${String(cachedWantedItems)}]`)
      if (cacheHasSameWantedItems(wantedItems, cachedWantedItems)) {
        logInfo('generateTagMentionCache', `- Not forcing a rebuild, and WANTED_PARA_TYPES are all present already in the cache, so calling updateTagMentionCache() instead.`)
        await updateTagMentionCache()
        logTagMentionCacheDuration('generateTagMentionCache', startTime, 'rebuilt', `(delegated to update; wanted items already in cache)`)
        return
      } else {
        logDebug('generateTagMentionCache', `- rebuild not forced, but wanted items are different, so will rebuild cache.`)
      }
    } else {
      logDebug('generateTagMentionCache', `- forced cache rebuild requested`)
    }

    // Get all notes to scan on the main thread (banner messages must reach the WebView from the main thread)
    const allCalNotes = DataStore.calendarNotes
    const allRegularNotes = DataStore.projectNotes.filter((note) => !note.filename.startsWith('@'))
    // const openItemsSuffix = TAG_CACHE_ONLY_FOR_OPEN_ITEMS ? ' from all open items' : ''
    const progressMessage = `${generationReason}: generating cache for all ${String(wantedItems.length)} wanted #tags & @mentions from ${String(allCalNotes.length)} calendar + ${String(allRegularNotes.length)} regular notes ...`
    if (progress.onProgress) {
      await progress.onProgress(progressMessage)
      progressBannerShown = true
    }
    logInfo('generateTagMentionCache', `- processing ${String(allCalNotes.length)} calendar + ${String(allRegularNotes.length)} regular notes ...`)

    // This is very quick
    const lookupCtx = buildTagMentionLookupContext(wantedItems)

    // Do NOT move the scan below to CommandBar.onAsyncThread. See function JSDoc: async-thread runs have failed to
    // finish (cache file not saved, no completion logs), especially from external command invocations. Use showLoading
    // for progress feedback while the main thread does the work; save + WebView banners also require main thread.
    CommandBar.showLoading(true, `Generating tag/mention cache (${String(allCalNotes.length + allRegularNotes.length)} notes) ...`)
    loadingIndicatorShown = true

    logInfo('generateTagMentionCache', `- scanning ${String(allCalNotes.length)} calendar notes ...`)
    const calResult = processNotesForTagMentionCache(allCalNotes, lookupCtx)
    logDebug('generateTagMentionCache', `  - pre-filter skipped ${String(calResult.notesSkippedByPrefilter)} calendar notes with no possible wanted items`)

    logInfo('generateTagMentionCache', `- scanning ${String(allRegularNotes.length)} regular notes ...`)
    const regResult = processNotesForTagMentionCache(allRegularNotes, lookupCtx)
    logDebug('generateTagMentionCache', `  - pre-filter skipped ${String(regResult.notesSkippedByPrefilter)} regular notes with no possible wanted items`)

    const calWantedItems = calResult.entries
    const regularWantedItems = regResult.entries
    const ccal = calResult.matchingNoteCount
    const creg = regResult.matchingNoteCount
    const totalFoundItems = calResult.totalFoundItems + regResult.totalFoundItems
    const totalMatchingNotes = ccal + creg
    // Cast: as above -- Flow has no numeric type for a Date operand.
    const elapsedSecs = Math.max(((new Date(): any) - startTime) / 1000, 0.001)
    const notesPerSec = ((allCalNotes.length + allRegularNotes.length - calResult.notesSkippedByPrefilter - regResult.notesSkippedByPrefilter) / elapsedSecs).toFixed(3)
    logInfo('generateTagMentionCache', `-> found ${String(ccal)} calendar + ${String(creg)} regular notes with wanted items (${String(totalFoundItems)} matching open items)`)
    logTimer('generateTagMentionCache', startTime, `-> finished cache generation at ${String(notesPerSec)} checked notes/second`)

    // Save the filteredMentions and filteredTags to the mentionTagCacheFile
    const cacheTimestamp = serializeTagMentionCacheTimestamp(startTime)
    const cache = {
      generatedAt: cacheTimestamp,
      lastUpdated: cacheTimestamp,
      wantedItems: wantedItems,
      regularNotes: regularWantedItems,
      calendarNotes: calWantedItems,
    }

    DataStore.saveData(JSON.stringify(cache), tagMentionCacheFile, true)
    logTimer('generateTagMentionCache', startTime, `- after saving ${String(totalFoundItems)} items to mentionTagCacheFile`)
    logTagMentionCacheDuration('generateTagMentionCache', startTime, 'rebuilt', `(${String(totalFoundItems)} items in ${String(totalMatchingNotes)} notes)`)

    // Keep pref in sync with cache.lastUpdated so the next refresh/updateTagMentionCache sees age ~0 (not stale pref).
    recordTagMentionCacheLastRunTime(startTime)

    // Replace progress banner with a timed completion message (progress banners have no timeout and would persist otherwise)
    if (progress.onComplete) {
      await progress.onComplete(`Tag/mention cache re-generated; it contains ${String(totalFoundItems)} matching open items in ${String(totalMatchingNotes)} notes`)
    }
    progressBannerShown = false

    // Clear the preference that was set to trigger a regeneration
    clearTagMentionCacheGenerationPref()
  } catch (err) {
    logError('generateTagMentionCache', JSP(err))
    if (progressBannerShown) {
      if (progress.onRemoveProgress) await progress.onRemoveProgress()
      const errMessage = err instanceof Error ? err.message : String(err)
      if (progress.onError) await progress.onError(`Tag/mention cache generation failed: ${errMessage}`)
      progressBannerShown = false
    }
  } finally {
    tagMentionCacheGenerationInProgress = false
    if (loadingIndicatorShown) {
      CommandBar.showLoading(false)
    }
    if (progressBannerShown) {
      logWarn('generateTagMentionCache', `- removing progress banner`)
      if (progress.onRemoveProgress) await progress.onRemoveProgress()
    }
  }
}

/**
 * Update the tagMentionCacheFile.
 * It works smartly: it only recalculates notes that have been updated since the last run.
 * Last-run time comes from `cache.lastUpdated` (ISO UTC in JSON) and `lastTimeThisWasRunPref` (Date in preferences); see `getTagMentionCacheLastRunInfo`.
 */
// eslint-disable-next-line require-await
export async function updateTagMentionCache(): Promise<void> {
  try {
    // const config = await getDashboardSettings()
    const startTime = new Date() // just for timing this function

    logDebug('updateTagMentionCache', `About to read ${tagMentionCacheFile} ...`)
    if (!isTagMentionCacheAvailable()) {
      logWarn('updateTagMentionCache', `${tagMentionCacheFile} file does not exist, so will schedule a re-generation of the cache from scratch.`)
      scheduleTagMentionCacheGeneration()
      logTagMentionCacheDuration('updateTagMentionCache', startTime, 'updated', `(skipped; cache missing, regeneration scheduled)`)
      return
    }
    // Get the list of wanted tags and mentions
    const wantedItems = getTagMentionCacheDefinitions()
    const lookupCtx = buildTagMentionLookupContext(wantedItems)
    const data = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const cache = JSON.parse(data)

    const { lastRun, source } = getTagMentionCacheLastRunInfo(cache)
    if (lastRun == null) {
      logWarn('updateTagMentionCache', `No valid last-run timestamp (pref or cache.lastUpdated); treating cache as stale`)
    }
    const momPrevious = lastRun != null ? moment(lastRun) : moment(0)
    const momNow = moment()
    const fileAgeMins = momNow.diff(momPrevious, 'minutes', true)
    logDebug(
      'updateTagMentionCache',
      `Last updated ${fileAgeMins.toFixed(3)} mins ago (source: ${source}; previous: ${momPrevious.format()} / now: ${momNow.format()})`,
    )
    if (lastRun != null && momNow.diff(momPrevious, 'seconds') < 5) {
      logInfo('updateTagMentionCache', `- Not updating cache as it was updated less than 5 seconds ago`)
      logTagMentionCacheDuration('updateTagMentionCache', startTime, 'updated', `(skipped; updated less than 5 seconds ago)`)
      return
    }

    // Find all notes updated since the last time this was run
    const jsdateToStartLooking = momPrevious.toDate()
    const numDaysBack = momPrevious.diff(momNow, 'days', true) // don't round to nearest integer
    // Note: This operations takes >500ms for JGC.
    // TODO(later): we have asked @EduardMe for a special API to get notes changed in a given time period, but it's not available yet.
    const recentlychangedNotes = getNotesChangedInInterval(numDaysBack).filter((n) => n.changedDate >= jsdateToStartLooking)
    logTimer('updateTagMentionCache', startTime, `Found ${recentlychangedNotes.length} changed notes in that time`)

    // For each note, get wanted tags and mentions, and overwrite the existing cache details
    let c = 0
    for (const note of recentlychangedNotes) {
      const isCalendarNote = note.type === 'Calendar'

      // First clear existing details for this note
      logDebug('updateTagMentionCache', `- removing existing items for recently changed file '${note.filename}'`)
      removeNoteFromCache(cache, note.filename, isCalendarNote)

      // Then get wanted tags and mentions on open items, and add them
      const foundWantedItems = getFoundItemsFromNote(note, lookupCtx)
      if (foundWantedItems.length > 0) {
        logDebug('updateTagMentionCache', `-> ${String(foundWantedItems.length)} foundWantedItems [${String(foundWantedItems)}]`)
        addNoteToCache(cache, note.filename, foundWantedItems, isCalendarNote)
        c++
      }
    }
    logTimer('updateTagMentionCache', startTime, `-> ${c} recently changed notes with wanted items`)

    // Update the last updated time and wanted items (which should be the same,)
    cache.lastUpdated = serializeTagMentionCacheTimestamp(startTime)
    cache.wantedItems = wantedItems

    DataStore.saveData(JSON.stringify(cache), tagMentionCacheFile, true)
    logTimer('updateTagMentionCache', startTime, `- after saving to mentionTagCacheFile`)

    recordTagMentionCacheLastRunTime(startTime)

    logTimer(`updateTagMentionCache`, startTime, `total runtime`, 1000)
    logTagMentionCacheDuration('updateTagMentionCache', startTime, 'updated', `(${String(c)} of ${String(recentlychangedNotes.length)} changed notes had wanted items)`)
    return
  } catch (err) {
    logError('updateTagMentionCache', JSP(err))
    return
  }
}

/**
 * Count tag/mention hits stored in a cache notes array.
 * @param {Array<{ items?: Array<string> }>} notesArray
 * @returns {number}
 */
function countCachedItemHits(notesArray: Array<{ items?: Array<string> }>): number {
  if (!Array.isArray(notesArray)) return 0
  return notesArray.reduce((sum, note) => sum + (note.items?.length ?? 0), 0)
}

/**
 * Return markdown lines for the Tag/Mention Cache section in diagnostics output.
 * @returns {Array<string>}
 */
export function getTagMentionCacheDiagnosticsLines(): Array<string> {
  const lines: Array<string> = []
  const wantedItemsFromDefinitions = getTagMentionCacheDefinitions()
  const cacheFileExists = isTagMentionCacheAvailable()
  const definitionsFileExists = DataStore.fileExists(wantedTagMentionsListFile)
  const generationScheduled = isTagMentionCacheGenerationScheduled()
  const lastRunPref = readLastTimeThisWasRunPref()
  const registrations = getTagMentionCacheRegistrations()

  lines.push('### Settings')
  lines.push(`- TAG_CACHE_ONLY_FOR_OPEN_ITEMS (code): ${String(TAG_CACHE_ONLY_FOR_OPEN_ITEMS)}`)
  lines.push(`- Update interval: ${String(TAG_CACHE_UPDATE_INTERVAL_HOURS)} hour(s)`)
  lines.push(`- Full regenerate interval: ${String(TAG_CACHE_GENERATE_INTERVAL_DAYS)} day(s)`)
  lines.push(`- Regeneration scheduled (pref): ${String(generationScheduled)}`)
  lines.push(`- Last run: ${lastRunPref != null ? String(lastRunPref) : '(not set)'} (from pref)`)
  lines.push(`- Cache files: ${tagMentionCacheFile}`)
  lines.push('')
  lines.push('### Registrations (`wantedTagMentionsList.json`)')
  if (definitionsFileExists) {
    const pluginIds = Object.keys(registrations)
    if (pluginIds.length === 0) {
      lines.push('- No plugin registrations')
    } else {
      for (const pluginId of pluginIds) {
        const items = registrations[pluginId] ?? []
        lines.push(`- ${pluginId} (${items.length}): ${items.length > 0 ? items.join(', ') : '(none)'}`)
      }
    }
    lines.push(`- Union count: ${wantedItemsFromDefinitions.length}`)
    lines.push(`- Union items: ${wantedItemsFromDefinitions.length > 0 ? wantedItemsFromDefinitions.join(', ') : '(none)'}`)
  } else {
    lines.push('- File not present')
  }
  lines.push('')
  lines.push('### Cache stats (`tagMentionCache.json`)')
  if (!cacheFileExists) {
    lines.push('- Cache file not present')
    return lines
  }

  try {
    const cacheRaw = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const parsedCache = JSON.parse(cacheRaw) ?? {}
    const regularNotes = parsedCache.regularNotes ?? []
    const calendarNotes = parsedCache.calendarNotes ?? []
    const wantedItemsInCache = parsedCache.wantedItems ?? []
    const regularHitCount = countCachedItemHits(regularNotes)
    const calendarHitCount = countCachedItemHits(calendarNotes)

    lines.push(`- Generated at: ${parsedCache.generatedAt ?? '(not set)'}`)
    lines.push(`- Last updated (cache file): ${parsedCache.lastUpdated ?? '(not set)'}`)
    lines.push(`- Wanted items in cache file (${wantedItemsInCache.length}): ${wantedItemsInCache.length > 0 ? wantedItemsInCache.join(', ') : '(none)'}`)
    if (wantedItemsFromDefinitions.length > 0 || wantedItemsInCache.length > 0) {
      const definitionsSet = new Set(wantedItemsFromDefinitions.map((item) => item.toLowerCase()))
      const cacheOnly = wantedItemsInCache.filter((item) => !definitionsSet.has(String(item).toLowerCase()))
      const definitionsOnly = wantedItemsFromDefinitions.filter((item) => !wantedItemsInCache.some((c) => String(c).toLowerCase() === item.toLowerCase()))
      if (cacheOnly.length > 0) {
        lines.push(`- In cache file but not definitions: ${cacheOnly.join(', ')}`)
      }
      if (definitionsOnly.length > 0) {
        lines.push(`- In definitions but not cache file: ${definitionsOnly.join(', ')}`)
      }
    }
    lines.push(`- Regular notes with hits: ${regularNotes.length} (${regularHitCount} tag/mention entries)`)
    lines.push(`- Calendar notes with hits: ${calendarNotes.length} (${calendarHitCount} tag/mention entries)`)
    lines.push(`- Total tag/mention entries cached: ${regularHitCount + calendarHitCount}`)
  } catch (err) {
    lines.push(`- Error reading cache file: ${err instanceof Error ? err.message : String(err)}`)
  }

  return lines
}

/**
 * Get list of wanted tags/mentions that appear in this note (full-note scan; fallback when open-items fast path is off).
 * Does filtering by para type when WANTED_PARA_TYPES is non-empty.
 * If 'includeNoteTags' is true, include matching tags/mentions from any frontmatter field.
 * @param {TNote} note
 * @param {Array<string>} wantedTagsOrMentions
 * @param {Array<string>?} wantedParaTypesParam
 * @param {boolean?} includeNoteTags?
 * @param {TagMentionLookupContext?} lookupCtx?
 * @returns {Array<string>} list of wanted tags/mentions found in the note
 */
export function getWantedTagOrMentionListFromNote(
  note: TNote,
  wantedTagsOrMentions: Array<string>,
  wantedParaTypesParam: Array<string> = [],
  includeNoteTags: boolean = false,
  lookupCtx?: TagMentionLookupContext,
): Array<string> {
  try {
    const ctx = lookupCtx ?? buildTagMentionLookupContext(wantedTagsOrMentions)
    if (ctx.wantedItems.length === 0) return []

    const correctedHashtagsInNote = ctx.scanHashtags ? getCorrectedHashtagsFromNote(note) : []
    const seenWantedTags: Array<string> = []
    for (const tag of correctedHashtagsInNote) {
      if (isWantedItem(tag, ctx)) seenWantedTags.push(tag)
    }
    const tagSet = new CaseInsensitiveSet(seenWantedTags)
    const distinctTags: Array<string> = [...tagSet]

    const correctedMentionsInNote = ctx.scanMentions ? getCorrectedMentionsFromNote(note) : []
    const seenWantedMentions: Array<string> = []
    for (const mention of correctedMentionsInNote) {
      const trimmedMention = trimMentionSuffix(mention)
      if (isWantedItem(trimmedMention, ctx)) seenWantedMentions.push(trimmedMention)
    }
    const mentionSet = new CaseInsensitiveSet(seenWantedMentions)
    const distinctMentions: Array<string> = [...mentionSet]

    let tagsAndMentions = distinctTags.concat(distinctMentions)

    const paraTypes = wantedParaTypesParam.length > 0 ? wantedParaTypesParam : WANTED_PARA_TYPES
    if (paraTypes.length > 0) {
      tagsAndMentions = filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags(note, tagsAndMentions, paraTypes, includeNoteTags)
    } else if (includeNoteTags) {
      for (const item of getWantedItemsFromAllFrontmatter(note, ctx)) {
        tagsAndMentions.push(item)
      }
    }

    if (tagsAndMentions.length > 0) {
      return [...new Set(tagsAndMentions)]
    }
    return []
  } catch (err) {
    logError('getWantedTagOrMentionListFromNote', JSP(err))
    return []
  }
}

//-----------------------------------------------------------------
// private helper functions

/**
 * Get wanted tags/mentions from a note for the tag mention cache.
 * @param {TNote} note - The note to process
 * @param {TagMentionLookupContext} ctx - Pre-built lookup context
 * @returns {Array<string>} Found tags/mentions from the note
 */
function getFoundItemsFromNote(note: TNote, ctx: TagMentionLookupContext): Array<string> {
  if (ctx.wantedItems.length === 0) return []
  if (!noteMayContainCacheItems(note, ctx)) return []

  if (WANTED_PARA_TYPES.length > 0) {
    return getWantedTagOrMentionListFromNoteOpenItemsOnly(note, ctx, true)
  }
  return getWantedTagOrMentionListFromNote(note, ctx.wantedItems, WANTED_PARA_TYPES, true, ctx)
}

/**
 * For unit tests: same path as tag mention cache build for one note.
 * @param {TNote} note
 * @param {Array<string>} wantedItems
 * @returns {Array<string>}
 */
export function getCacheItemsFromNote(note: TNote, wantedItems: Array<string>): Array<string> {
  return getFoundItemsFromNote(note, buildTagMentionLookupContext(wantedItems))
}

/**
 * Add a note's items to the cache.
 * @param {Object} cache - The cache object
 * @param {string} filename - The note filename
 * @param {Array<string>} items - The tags/mentions found in the note
 * @param {boolean} isCalendarNote - Whether this is a calendar note
 */
function addNoteToCache(cache: Object, filename: string, items: Array<string>, isCalendarNote: boolean): void {
  if (isCalendarNote) {
    cache.calendarNotes.push({ filename, items })
  } else {
    cache.regularNotes.push({ filename, items })
  }
}

/**
 * Remove a note from the cache by filename.
 * @param {Object} cache - The cache object
 * @param {string} filename - The filename to remove
 * @param {boolean} isCalendarNote - Whether this is a calendar note
 */
function removeNoteFromCache(cache: Object, filename: string, isCalendarNote: boolean): void {
  if (isCalendarNote) {
    cache.calendarNotes = cache.calendarNotes.filter((item) => item.filename !== filename)
  } else {
    cache.regularNotes = cache.regularNotes.filter((item) => item.filename !== filename)
  }
}

/**
 * Ensures the cache is ready for the requested tags/mentions.
 * Adds missing items to wanted list and updates cache if needed.
 * @param {Array<string>} tagOrMentions - Tags/mentions to ensure are in wanted list
 * @param {boolean} firstUpdateCache - Whether to update cache before searching
 */
async function ensureCacheIsReadyForTags(
  tagOrMentions: Array<string>,
  firstUpdateCache: boolean,
): Promise<void> {
  const wantedItems = getTagMentionCacheDefinitions()
  const missingItems = tagOrMentions.filter((item) => !wantedItems.some((wanted) => caseInsensitiveMatch(item, wanted)))
  if (missingItems.length > 0) {
    logWarn(
      'ensureCacheIsReadyForTags',
      `Warning: the following tags/mentions are not in the wantedTagMentionsList.json filename: [${String(
        missingItems,
      )}]. Will use the API instead, and then regenerate the cache.`,
    )
    addTagMentionCacheDefinitions(missingItems)
    scheduleTagMentionCacheGeneration()
    await updateTagMentionCache()
  } else if (firstUpdateCache) {
    logInfo('ensureCacheIsReadyForTags', `- updating cache before looking for notes with tags/mentions [${String(tagOrMentions)}]`)
    await updateTagMentionCache()
  }
}

/**
 * Loads the cache from disk and refreshes it if it's too old.
 * @returns {Promise<Object>} Parsed cache object with regularNotes, calendarNotes, generatedAt, lastUpdated
 */
async function loadAndRefreshCacheIfNeeded(): Promise<Object> {
  let cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
  let parsedCache = JSON.parse(cache)

  // Update the cache if too old
  const cacheUpdated = await updateTagMentionCacheIfTooOld(parsedCache.lastUpdated)
  if (cacheUpdated) {
    cache = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    parsedCache = JSON.parse(cache)
  }

  const regularNoteItems = parsedCache.regularNotes
  const calNoteItems = parsedCache.calendarNotes
  logDebug('loadAndRefreshCacheIfNeeded', `Regular notes in cache: ${String(regularNoteItems.length)}`)
  logDebug('loadAndRefreshCacheIfNeeded', `Calendar notes in cache: ${String(calNoteItems.length)}`)

  return parsedCache
}

/**
 * Checks if a note item matches any of the given tags/mentions (case-insensitive).
 * @param {Object} line - Cache line with items array
 * @param {Array<string>} itemsToMatch - tags/mentions to match against
 * @returns {boolean} True if any item matches
 */
function noteItemsMatchItems(line: Object, itemsToMatch: Array<string>): boolean {
  return line.items.some((tag) => caseInsensitiveArrayIncludes(tag, itemsToMatch))
}

/**
 * Searches the cache for notes containing the given tags/mentions. It does this in a case-insensitive way.
 * @param {Array<string>} tagOrMentions - Tags/mentions to search for
 * @param {Object} cache - The cache object with regularNotes and calendarNotes
 * @returns {Array<string>} Array of matching note filenames
 */
function findMatchingNotesFromCache(
  tagOrMentions: Array<string>,
  cache: Object,
): Array<string> {
  // Get matching Calendar notes using Cache
  const matchingCalNotes = cache.calendarNotes
    .filter((line) => noteItemsMatchItems(line, tagOrMentions))
    .map((item) => item.filename)

  // Get matching Regular notes using Cache
  const matchingRegularNotes = cache.regularNotes
    .filter((line) => noteItemsMatchItems(line, tagOrMentions))
    .map((item) => item.filename)

  return matchingCalNotes.concat(matchingRegularNotes)
}

/**
 * Cheap read of regular-note filenames that contain any of the given tags/mentions.
 * Does not update or regenerate the cache. Returns [] if the cache is missing.
 * @param {Array<string>} tagOrMentions
 * @returns {Array<string>}
 */
export function getRegularNoteFilenamesFromTagMentionCache(tagOrMentions: Array<string>): Array<string> {
  const startTime = new Date()
  try {
    if (!Array.isArray(tagOrMentions) || tagOrMentions.length === 0) {
      logTagMentionCacheDuration('getRegularNoteFilenamesFromTagMentionCache', startTime, 'accessed', `(no tags requested)`)
      return []
    }
    if (!isTagMentionCacheAvailable()) {
      logTagMentionCacheDuration('getRegularNoteFilenamesFromTagMentionCache', startTime, 'accessed', `(cache unavailable)`)
      return []
    }
    const raw = DataStore.loadData(tagMentionCacheFile, true) ?? ''
    const cache = JSON.parse(raw)
    const regularNotes = cache.regularNotes ?? []
    const filenames = regularNotes.filter((line) => noteItemsMatchItems(line, tagOrMentions)).map((item) => item.filename)
    logTagMentionCacheDuration('getRegularNoteFilenamesFromTagMentionCache', startTime, 'accessed', `(found ${String(filenames.length)} regular notes for [${String(tagOrMentions)}])`)
    return filenames
  } catch (err) {
    logWarn('getRegularNoteFilenamesFromTagMentionCache', err instanceof Error ? err.message : String(err))
    logTagMentionCacheDuration('getRegularNoteFilenamesFromTagMentionCache', startTime, 'accessed', `(error)`)
    return []
  }
}

/**
 * Builds a string describing the age of the cache.
 * `cache.generatedAt` / `cache.lastUpdated` are ISO UTC strings (see serializeTagMentionCacheTimestamp); moment parses them as absolute instants.
 * @param {Object} cache - The cache object with generatedAt and lastUpdated
 * @returns {string} Cache age information string
 */
function buildCacheAgeInfo(cache: Object): string {
  const momNow = moment()
  const momGeneratedAt = moment(cache.generatedAt)
  const momGeneratedAgeMins = momNow.diff(momGeneratedAt, 'minutes', true)
  const momLastUpdated = moment(cache.lastUpdated)
  const momLastUpdatedAgeMins = momNow.diff(momLastUpdated, 'minutes', true)
  const formatAge = (age: number): string => new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: age < 1 ? 1 : 3,
    useGrouping: true,
  }).format(age)
  const cacheGenerationAge = formatAge(momGeneratedAgeMins)
  const cacheUpdatedAge = formatAge(momLastUpdatedAgeMins)
  return `Cache age: ${cacheGenerationAge}m, updated ${cacheUpdatedAge}m ago`
}

/**
 * Filters tags or mentions ('items') seen in note to:
 * - wantedParagraphTypes
 * - matching tags/mentions in any frontmatter field (when allowNoteTags is true).
 * Note: there is a simpler version of this in NPnote.js
 * @param {TNote} note - The note to process
 * @param {Array<string>} items - The list of tags or mentions to filter
 * @param {Array<string>} WANTED_PARA_TYPES - The paragraph types to allow
 * @param {boolean} allowNoteTags - Whether to allow tagsOrMentions from note tags
 * @returns {Array<string>} Filtered tagsOrMentions that match the criteria
 */
function filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags(
  note: TNote,
  tagsOrMentions: Array<string>,
  wantedParaTypes: Array<string>,
  allowNoteTags: boolean = false,
): Array<string> {
  try {
    const frontmatterWanted = allowNoteTags ? getWantedItemsFromAllFrontmatter(note, buildTagMentionLookupContext(tagsOrMentions)) : []

    const filteredItems = tagsOrMentions.filter((item) => {
      const paragraphsWithItem = note.paragraphs.filter((p) => caseInsensitiveSubstringMatch(item, p.content))
      const hasValidParagraphType = paragraphsWithItem.some((p) => wantedParaTypes.includes(p.type))
      const hasMatchingFrontmatter = allowNoteTags && frontmatterWanted.some((fmItem) => caseInsensitiveMatch(item, fmItem))

      return hasValidParagraphType || hasMatchingFrontmatter
    })

    if (filteredItems.length > 0) {
      // logDebug('filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags', `Found ${filteredItems.length} distinct items from ${tagsOrMentions.length} instances in ${note.filename}`)
    }

    return filteredItems
  } catch (error) {
    logError('filterTagsOrMentionsInNoteByWantedParaTypesOrNoteTags', `Error filtering items in note ${note.filename}: ${error.message}`)
    return []
  }
}

// Exported for unit tests (timestamp round-trip / timezone-safe parsing).
export { parseTagMentionCacheTimestamp, serializeTagMentionCacheTimestamp }
