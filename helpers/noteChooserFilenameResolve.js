// @flow
//--------------------------------------------------------------------------
// NoteChooser template tokens → real storage filenames
//
// This module is intentionally separate from NPnote.js: it only runs when
// callers pass React NoteChooser / TemplateRunner-style values like `<today>`.
// Normal filenames, titles, and paths are returned unchanged — no impact on
// existing getNoteFromFilename / getNoteFromIdentifier call sites.
//--------------------------------------------------------------------------

import * as dt from '@helpers/dateTime'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getRelativeDates } from '@helpers/NPdateTime'
import { parseTeamspaceFilename } from '@helpers/teamspace'

/** getRelativeDates relName → NoteChooser / TemplateRunner token (single source of truth) */
const REL_NAME_TO_NOTE_CHOOSER_TOKEN: { [string]: string } = {
  today: '<today>',
  'this week': '<thisweek>',
  'next week': '<nextweek>',
  'last week': '<lastweek>',
  'this month': '<thismonth>',
  'next month': '<nextmonth>',
  'last month': '<lastmonth>',
  'this quarter': '<thisquarter>',
  'next quarter': '<nextquarter>',
  'last quarter': '<lastquarter>',
}

type RelativeTokenFilenameEntry = {
  token: string,
  tokenLower: string,
  filenames: Array<string>,
}

const RELATIVE_TOKEN_CACHE_TTL_MS = 60 * 1000
let relativeTokenFilenameCache: { createdAt: number, entries: Array<RelativeTokenFilenameEntry> } = { createdAt: 0, entries: [] }

/**
 * Clear the relative-token cache. Used by real-runtime benchmarks and tests.
 * @returns {void}
 */
export function clearNoteChooserFilenameResolveCache(): void {
  relativeTokenFilenameCache = { createdAt: 0, entries: [] }
}

/**
 * Map getRelativeDates() relName values to NoteChooser / TemplateRunner-style tokens (e.g. `<today>`).
 * @param {string} relName
 * @returns {?string}
 */
function relNameToNoteChooserTemplateToken(relName: string): ?string {
  return REL_NAME_TO_NOTE_CHOOSER_TOKEN[relName.toLowerCase()] ?? null
}

/**
 * Last path segment of a note filename, after stripping teamspace prefix when present.
 * @param {string} filenameIn
 * @returns {string}
 */
function calendarBasenameForCompare(filenameIn: string): string {
  const parsed = parseTeamspaceFilename(filenameIn)
  const path = parsed.isTeamspace ? parsed.filename : filenameIn
  return path.split('/').pop() || path
}

/**
 * Whether two calendar storage paths refer to the same note file (basename compare).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function calendarNoteFilenamesEquivalent(a: string, b: string): boolean {
  return calendarBasenameForCompare(a).toLowerCase() === calendarBasenameForCompare(b).toLowerCase()
}

/**
 * Canonical bracket token for known `<today>`-style calendar codes (case-insensitive).
 * @param {string} bracket
 * @returns {?string}
 */
function canonicalBracketCalendarToken(bracket: string): ?string {
  const lower = bracket.trim().toLowerCase()
  for (const token of Object.values(REL_NAME_TO_NOTE_CHOOSER_TOKEN)) {
    if (token.toLowerCase() === lower) {
      return token
    }
  }
  return null
}

/**
 * Resolve a getRelativeDates() entry to the concrete calendar filename candidates it may represent.
 * @param {any} rd - getRelativeDates() result entry
 * @returns {Array<string>} Calendar filename candidates
 */
function filenamesFromRelativeDateEntry(rd: any): Array<string> {
  const filenames: Array<string> = []
  const noteFromRd = rd?.note
  if (noteFromRd != null && typeof noteFromRd.filename === 'string' && noteFromRd.filename !== '') {
    filenames.push(noteFromRd.filename)
  }

  const ds = rd?.dateStr
  if (typeof ds === 'string' && ds.length > 0 && typeof DataStore !== 'undefined' && typeof DataStore.defaultFileExtension === 'string') {
    if (new RegExp(dt.RE_ISO_DATE).test(ds)) {
      filenames.push(`${dt.convertISODateFilenameToNPDayFilename(ds)}${DataStore.defaultFileExtension}`)
    } else if (dt.isValidCalendarNoteFilenameWithoutExtension(ds)) {
      filenames.push(`${ds}${DataStore.defaultFileExtension}`)
    }
  }

  return filenames
}

/**
 * Build and cache relative token to calendar filename mappings.
 * This avoids recomputing getRelativeDates() for every calendar note during chooser decoration.
 * @returns {Array<RelativeTokenFilenameEntry>} Relative token mappings
 */
function getRelativeTokenFilenameEntries(): Array<RelativeTokenFilenameEntry> {
  const now = Date.now()
  if (relativeTokenFilenameCache.entries.length > 0 && now - relativeTokenFilenameCache.createdAt < RELATIVE_TOKEN_CACHE_TTL_MS) {
    return relativeTokenFilenameCache.entries
  }

  const entries: Array<RelativeTokenFilenameEntry> = []
  const relativeDates = getRelativeDates(true)
  for (const rd of relativeDates) {
    if (!rd || !rd.relName) {
      continue
    }
    const token = relNameToNoteChooserTemplateToken(rd.relName)
    if (!token) {
      continue
    }
    entries.push({
      token,
      tokenLower: token.toLowerCase(),
      filenames: filenamesFromRelativeDateEntry(rd),
    })
  }

  relativeTokenFilenameCache = { createdAt: now, entries }
  return entries
}

/**
 * Resolve NoteChooser "relative" filenames such as `<today>` or `<thisweek>` to a real storage filename
 * that `getNoteFromFilename` / `getNoteByFilename` can open.
 *
 * **Backward compatible:** Only non-empty trimmed strings that start with `<` and end with `>` are
 * transformed when they match a known relative-date token from `getRelativeDates`. All other inputs
 * (normal paths, titles, ISO dates, unknown bracket tokens like `<current>`) are returned unchanged.
 *
 * @param {string} filenameIn
 * @returns {string}
 */
export function resolveNoteChooserFilenameForLookup(filenameIn: string): string {
  try {
    if (typeof filenameIn !== 'string') {
      return filenameIn
    }
    const trimmed = filenameIn.trim()
    if (trimmed.length < 3 || trimmed[0] !== '<' || trimmed[trimmed.length - 1] !== '>') {
      return filenameIn
    }
    if (typeof DataStore === 'undefined' || typeof DataStore.defaultFileExtension !== 'string') {
      return filenameIn
    }
    const wantToken = trimmed.toLowerCase()
    const entry = getRelativeTokenFilenameEntries().find((candidate) => candidate.tokenLower === wantToken)
    if (entry) {
      const out = entry.filenames[0]
      if (out) {
        logDebug('noteChooserFilenameResolve', `resolved "${trimmed}" -> "${out}"`)
        return out
      }
      logWarn('noteChooserFilenameResolve', `could not resolve "${trimmed}" to a filename (no note, bad dateStr)`)
      return filenameIn
    }
    return filenameIn
  } catch (err) {
    logError('noteChooserFilenameResolve', `${err.name}: ${err.message}`)
    return filenameIn
  }
}

/**
 * Short code to show in NoteChooser (e.g. `<today>`) when the note matches a TemplateRunner-style
 * relative calendar token — either the synthetic option (`filename` is `<today>`) or a real calendar
 * file that is the same note as that token (e.g. today's `YYYY-MM-DD.md` daily).
 *
 * @param {any} note - `TNote` or `NoteOption` (only `filename` and `type` are read)
 * @returns {?string}
 */
export function getNoteChooserTemplateTokenForDisplay(note: any): ?string {
  if (note == null || typeof note !== 'object') {
    return null
  }
  if (note.type !== 'Calendar') {
    return null
  }
  const fn = note.filename
  if (typeof fn !== 'string' || fn === '') {
    return null
  }
  const trimmed = fn.trim()

  if (trimmed.length >= 3 && trimmed[0] === '<' && trimmed[trimmed.length - 1] === '>') {
    return canonicalBracketCalendarToken(trimmed)
  }

  try {
    for (const entry of getRelativeTokenFilenameEntries()) {
      for (const filename of entry.filenames) {
        if (calendarNoteFilenamesEquivalent(trimmed, filename)) {
          return entry.token
        }
      }
    }
  } catch (err) {
    logError('noteChooserFilenameResolve', `getNoteChooserTemplateTokenForDisplay: ${err.name}: ${err.message}`)
  }
  return null
}
