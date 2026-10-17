// @flow
//-----------------------------------------------------------------------------
// Project class helpers for Project & Reviews plugin
// by Jonathan Clark
// Last updated 2026-09-11 for v2.1.2, @CursorAI & @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { getMetadataLineIndexFromBody, getParamMentionFromList } from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import { RE_DATE, RE_DATE_INTERVAL, todaysDateISOString, toISODateString } from '@helpers/dateTime'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getContentFromBrackets } from '@helpers/general'
import { getFrontmatterParagraphs } from '@helpers/NPFrontMatter'
import { usersVersionHas } from '@helpers/NPVersions'
import { getInputTrimmed, inputIntegerBounded, isInt } from '@helpers/userInput'

export type FrontmatterFieldRead = {
  exists: boolean,
  value: ?string,
}

/** Case-insensitive key -> field read from a single frontmatter scan. */
export type FrontmatterFieldsMap = { [string]: FrontmatterFieldRead }

/**
 * Prefs needed by Project constructor. Resolve once per batch and pass in to avoid repeated DataStore.preference calls.
 */
export type ProjectConstructorPrefs = {
  projectMetadataFrontmatterKey: string,
  startMentionStr: string,
  dueMentionStr: string,
  reviewedMentionStr: string,
  completedMentionStr: string,
  cancelledMentionStr: string,
  reviewIntervalMentionStr: string,
  nextReviewMentionStr: string,
  ignoreChecklistsInProgress: boolean,
  numberDaysForFutureToIgnore: number,
  /** When true, emit ProjectConstructor logDebug / logTimer lines. */
  logConstructorTiming: boolean,
}

/** Full-line match for ISO YYYY-MM-DD (same rule as RE_DATE). */
export const RE_ISO_DATE_LINE: RegExp = new RegExp(`^${RE_DATE}$`)

/** Full-line match for a date interval (same rule as RE_DATE_INTERVAL). */
export const RE_INTERVAL_LINE: RegExp = new RegExp(`^${RE_DATE_INTERVAL}$`)

/**
 * Read all frontmatter key/value pairs in one pass over frontmatter paragraphs.
 * Keys in the returned map are lowercased for case-insensitive lookup.
 * Distinguishes missing vs present-but-empty the same way as {@link readRawFrontmatterField}.
 * @param {CoreNoteFields} note
 * @returns {FrontmatterFieldsMap}
 */
export function readAllRawFrontmatterFields(note: CoreNoteFields): FrontmatterFieldsMap {
  const out: FrontmatterFieldsMap = {}
  const fmParas = getFrontmatterParagraphs(note, false)
  if (!fmParas || fmParas.length === 0) {
    return out
  }
  for (const para of fmParas) {
    const content = para.content || ''
    const colonIndex = content.indexOf(':')
    if (colonIndex <= 0) continue
    const rawKey = content.slice(0, colonIndex).trim()
    if (rawKey === '') continue
    const lcKey = rawKey.toLowerCase()
    // First occurrence wins (matches readRawFrontmatterField scan order)
    if (out[lcKey] != null) continue
    out[lcKey] = { exists: true, value: content.slice(colonIndex + 1).replace(/^\s+/, '') }
  }
  return out
}

/**
 * Lookup a field in a map from {@link readAllRawFrontmatterFields}.
 * @param {FrontmatterFieldsMap} fieldsMap
 * @param {string} fieldName
 * @returns {FrontmatterFieldRead}
 */
export function getRawFrontmatterFieldFromMap(fieldsMap: FrontmatterFieldsMap, fieldName: string): FrontmatterFieldRead {
  const entry = fieldsMap[fieldName.toLowerCase()]
  if (entry == null) {
    return { exists: false, value: undefined }
  }
  return entry
}

/**
 * Resolve constructor prefs from DataStore (or overlay with an optional partial).
 * @param {Partial<ProjectConstructorPrefs>} [overrides]
 * @returns {ProjectConstructorPrefs}
 */
export function getProjectConstructorPrefs(overrides?: Partial<ProjectConstructorPrefs>): ProjectConstructorPrefs {
  const mentionOr = (prefKey: string, defaultMention: string): string =>
    checkString(DataStore.preference(prefKey) || defaultMention)
  const prefAsBoolean = (prefKey: string): boolean => {
    const raw = DataStore.preference(prefKey)
    if (raw === true || raw === false) return raw
    if (raw === 'true') return true
    if (raw === 'false' || raw == null || raw === '') return false
    return Boolean(raw)
  }
  const prefAsNumber = (prefKey: string): number => {
    const raw = DataStore.preference(prefKey)
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
    if (raw == null || raw === '') return 0
    const n = Number(raw)
    return Number.isNaN(n) ? 0 : n
  }
  const base: ProjectConstructorPrefs = {
    projectMetadataFrontmatterKey: checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project'),
    startMentionStr: mentionOr('startMentionStr', '@start'),
    dueMentionStr: mentionOr('dueMentionStr', '@due'),
    reviewedMentionStr: mentionOr('reviewedMentionStr', '@reviewed'),
    completedMentionStr: mentionOr('completedMentionStr', '@completed'),
    cancelledMentionStr: mentionOr('cancelledMentionStr', '@cancelled'),
    reviewIntervalMentionStr: mentionOr('reviewIntervalMentionStr', '@review'),
    nextReviewMentionStr: mentionOr('nextReviewMentionStr', '@nextReview'),
    ignoreChecklistsInProgress: prefAsBoolean('ignoreChecklistsInProgress'),
    numberDaysForFutureToIgnore: prefAsNumber('numberDaysForFutureToIgnore'),
    logConstructorTiming: prefAsBoolean('_logTimer'),
  }
  if (overrides == null) return base
  return { ...base, ...overrides }
}

/**
 * Build constructor prefs from a ReviewConfig-like object (batch list regen).
 * @param {{
 *   projectMetadataFrontmatterKey?: string,
 *   startMentionStr?: string,
 *   dueMentionStr?: string,
 *   reviewedMentionStr?: string,
 *   completedMentionStr?: string,
 *   cancelledMentionStr?: string,
 *   reviewIntervalMentionStr?: string,
 *   nextReviewMentionStr?: string,
 *   ignoreChecklistsInProgress?: boolean,
 *   numberDaysForFutureToIgnore?: number,
 *   _logTimer?: boolean,
 * }} config
 * @returns {ProjectConstructorPrefs}
 */
export function projectConstructorPrefsFromReviewConfig(config: $ReadOnly<{
  projectMetadataFrontmatterKey?: ?string,
  startMentionStr?: ?string,
  dueMentionStr?: ?string,
  reviewedMentionStr?: ?string,
  completedMentionStr?: ?string,
  cancelledMentionStr?: ?string,
  reviewIntervalMentionStr?: ?string,
  nextReviewMentionStr?: ?string,
  ignoreChecklistsInProgress?: ?boolean,
  numberDaysForFutureToIgnore?: ?number,
  _logTimer?: ?boolean,
  ...
}>): ProjectConstructorPrefs {
  return getProjectConstructorPrefs({
    projectMetadataFrontmatterKey: checkString(config.projectMetadataFrontmatterKey || 'project'),
    startMentionStr: checkString(config.startMentionStr || '@start'),
    dueMentionStr: checkString(config.dueMentionStr || '@due'),
    reviewedMentionStr: checkString(config.reviewedMentionStr || '@reviewed'),
    completedMentionStr: checkString(config.completedMentionStr || '@completed'),
    cancelledMentionStr: checkString(config.cancelledMentionStr || '@cancelled'),
    reviewIntervalMentionStr: checkString(config.reviewIntervalMentionStr || '@review'),
    nextReviewMentionStr: checkString(config.nextReviewMentionStr || '@nextReview'),
    ignoreChecklistsInProgress: Boolean(config.ignoreChecklistsInProgress),
    numberDaysForFutureToIgnore: typeof config.numberDaysForFutureToIgnore === 'number' ? config.numberDaysForFutureToIgnore : 0,
    // Batch list regen: only emit per-project timing when the user turned _logTimer on.
    logConstructorTiming: Boolean(config._logTimer),
  })
}

/**
 * Milliseconds since epoch for a note's `changedDate` (Date or number in some contexts).
 * @param {TNote} note
 * @returns {?number}
 */
export function getNoteChangedDateMs(note: TNote): ?number {
  const cd = note.changedDate
  if (cd == null) {
    return null
  }
  if (cd instanceof Date) {
    return cd.getTime()
  }
  if (typeof cd === 'number') {
    return cd
  }
  return null
}

/**
 * Modification time for comparing against `allProjectsList` cache rows.
 * Returns null when `checkEditor` is true and this note is the focused editor note (unsaved edits must not use the fast path).
 * @param {TNote} note
 * @param {boolean} checkEditor
 * @returns {?number}
 */
export function getNoteChangeTimeMsForCache(note: TNote, checkEditor: boolean): ?number {
  if (checkEditor && typeof Editor !== 'undefined' && Editor && Editor.note && Editor.note.filename === note.filename) {
    return null
  }
  return getNoteChangedDateMs(note)
}

/**
 * Parse a frontmatter value that may be plain content (e.g. '1w' / '2026-03-26')
 * or a wrapped mention value (e.g. '@review(1w)' / '@due(2026-03-26)'),
 * or a quoted value (e.g. '"1w"' / '"2026-03-26"'),
 * or empty ('').
 * Returns value trimmed and unquoted, and may be empty.
 * @param {string} rawValue
 * @returns {string}
 */
export function parseProjectFrontmatterValue(rawValue: string): string {
  let trimmed = rawValue.trim()

  // Remove double quotes that might surround the value
  trimmed = trimmed.replace(/^"|"$/g, '')

  // Remove any mention brackets and return the content
  const mentionMatch = trimmed.match(/^@([A-Za-z0-9_-]+)\((.*)\)$/)
  if (!mentionMatch) {
    return trimmed
  }

  const mentionParam = mentionMatch[2] != null ? mentionMatch[2].trim() : ''
  return mentionParam
}

/**
 * Read a frontmatter key directly from raw frontmatter lines.
 * This distinguishes between:
 * - key missing
 * - key present but empty/invalid
 * Prefer {@link readAllRawFrontmatterFields} + {@link getRawFrontmatterFieldFromMap} when reading multiple keys.
 * @param {CoreNoteFields} note
 * @param {string} fieldName
 * @param {FrontmatterFieldsMap} [fieldsMap] - optional pre-scanned map
 * @returns {FrontmatterFieldRead}
 */
export function readRawFrontmatterField(note: CoreNoteFields, fieldName: string, fieldsMap?: FrontmatterFieldsMap): FrontmatterFieldRead {
  if (fieldsMap != null) {
    return getRawFrontmatterFieldFromMap(fieldsMap, fieldName)
  }
  return getRawFrontmatterFieldFromMap(readAllRawFrontmatterFields(note), fieldName)
}

/**
 * Duration from project start to a finish date, e.g. "after 3 months".
 * Returns '' when startDate is missing so callers do not persist relative phrases such as "a day ago".
 * @param {string|Date} date - The finish date (ISO string or Date)
 * @param {?string|Date} startDate - Project start date
 * @param {boolean} [_roundShortDurationToToday] unused; kept so existing call sites stay unchanged
 * @returns {string} Duration string
 */
export function formatDurationString(date: string | Date, startDate?: string | Date, _roundShortDurationToToday: boolean = false): string {
  if (startDate == null || startDate === '') {
    return ''
  }
  const startMom = moment(startDate)
  const endMom = moment(date)
  if (!startMom.isValid() || !endMom.isValid()) {
    return ''
  }
  return `after ${startMom.to(endMom, true)}`
}

/**
 * Extract ISO date string (YYYY-MM-DD) from a mention string (e.g. @start(2022-03-31)).
 * @param {string} mentionStr - Full mention string
 * @returns {?string} YYYY-MM-DD or undefined if no valid match
 */
export function getISODateStringFromMention(mentionStr: string): ?string {
  const RE_DATE_CAPTURE = new RegExp(`(${RE_DATE})`)
  const match = mentionStr.match(RE_DATE_CAPTURE)
  return match && match[1] ? match[1] : undefined
}

/**
 * Parse a date mention from the mentions list; returns ISO date string (YYYY-MM-DD).
 * @param {Array<string>|$ReadOnlyArray<string>} mentions - Array of mention strings
 * @param {string} mentionName - Mention string name (e.g. @due)
 * @param {string} projectTitle
 * @param {string} projectFilename
 * @returns {?string} ISO date string or undefined
 */
export function parseDateMentionFromMentions(
  mentions: $ReadOnlyArray<string>,
  mentionName: string,
  projectTitle: string,
  projectFilename: string,
): ?string {
  const tempStr = getParamMentionFromList(mentions, mentionName)
  if (tempStr === '') {
    return undefined
  }

  const bracketContent = getContentFromBrackets(tempStr)
  if (bracketContent == null || bracketContent.trim() === '') {
    logWarn('ProjectConstructor', `Found empty ${mentionName}() in '${projectTitle}' (${projectFilename}). Ignoring this value.`)
    return undefined
  }
  return getISODateStringFromMention(tempStr)
}

/**
 * Normalize a date value from CommandBar.showForm (string or Date) to YYYY-MM-DD, or today's date if invalid.
 * @param {mixed} value
 * @returns {string}
 */
export function normalizeProgressDateFromForm(value: mixed): string {
  const today = todaysDateISOString
  if (value == null || value === '') {
    return today
  }
  if (value instanceof Date) {
    const iso = toISODateString(value)
    return iso !== '' && RE_ISO_DATE_LINE.test(iso) ? iso : today
  }
  const s = String(value).trim()
  if (RE_ISO_DATE_LINE.test(s)) {
    return s
  }
  logWarn('Project / normalizeProgressDateFromForm', `Bad date value '${String(value)}', using ${today}`)
  return today
}

/**
 * Interpret CommandBar.showForm() result for add-progress: optional comment, progress date, optional integer %.
 * Empty comment is valid (caller may skip writing a progress line).
 * @param {CommandBarFormResult} formResult
 * @returns {?{ comment: string, progressDateStr: string, percentStr: string }}
 */
export function parseRawProgressFormValues(formResult: CommandBarFormResult): ?{ comment: string, progressDateStr: string, percentStr: string } {
  try {
    if (formResult == null || typeof formResult !== 'object') {
      throw new Error(`formResult is null or not an object`)
    }
    if (formResult.submitted === false) {
      logWarn('parseRawProgressFormValues', `user didn't submit form: stopping.`)
      return null
    }
    const fieldMap: { [string]: mixed } = formResult.values ?? {}
    const commentRaw = fieldMap.comment
    const comment = typeof commentRaw === 'string' ? commentRaw.trim() : String(commentRaw ?? '').trim()
    const dateRaw = fieldMap.progressDate ?? fieldMap.date
    const progressDateStr = normalizeProgressDateFromForm(dateRaw)
    let percentStr = ''
    const pr = fieldMap.percentComplete ?? fieldMap.percent
    if (pr != null && pr !== '') {
      const ps = String(pr).trim()
      if (ps !== '' && isInt(ps)) {
        const v = parseFloat(ps)
        if (v >= 0 && v <= 100) {
          percentStr = String(v)
        }
      }
    }
    return { comment, progressDateStr, percentStr }
  } catch (error) {
    logError('parseRawProgressFormValues', `Error parsing form result: ${error.message}`)
    return null
  }
}

/**
 * Ask for progress comment, optional % complete, and progress date.
 * Uses CommandBar.showForm when NotePlan supports commandBarForms (v3.21+); otherwise two separate prompts (date = today).
 * Comment is optional: submit with an empty comment to skip adding a progress line (e.g. when pausing).
 * @param {string} projectTitle
 * @param {string} prompt - leading phrase before quoted title
 * @param {number} lastPercentComplete - for hint text (may be NaN)
 * @returns {Promise<?{ comment: string, progressDateStr: string, percentStr: string }>}
 */
export async function promptAddProgressLineInputs(
  projectTitle: string,
  prompt: string,
  lastPercentComplete: number,
): Promise<?{ comment: string, progressDateStr: string, percentStr: string }> {
  const message1 = `${prompt} '${projectTitle}'`
  const lastPercentMessage = !isNaN(lastPercentComplete)
    ? `; last was ${String(lastPercentComplete)}`
    : ``

  if (usersVersionHas('commandBarForms')) {
    try {
      const raw = await CommandBar.showForm({
        title: message1,
        submitText: 'OK',
        fields: [
          { type: 'string', key: 'comment', title: 'Comment (optional)', description: 'Leave blank if no progress comment is needed', placeholder: 'Optional comment', required: false },
          { type: 'date', key: 'progressDate', title: 'Date', description: 'Date of comment', default: todaysDateISOString, required: false },
          { type: 'number', key: 'percentComplete', title: `Percent Complete (optional %${lastPercentMessage})`, description: `Enter your estimate of project completion (as %${lastPercentMessage}) if wanted`, placeholder: '%', min: 0, max: 100, optional: true, required: false },
        ],
      })
      if (raw == null || raw.submitted !== true) {
        logDebug('promptAddProgressLineInputs', `User cancelled the form input`)
        return null
      }
      const parsed = parseRawProgressFormValues(raw)
      if (parsed) {
        return parsed
      }
      logDebug('promptAddProgressLineInputs', `Invalid showForm submission`)
      return null
    } catch (error) {
      logWarn('promptAddProgressLineInputs', `CommandBar.showForm failed (${error.message}); using separate prompts`)
    }
  }

  // Fallback: blank / cancel skips adding a progress line (same as optional form comment)
  const resText = await getInputTrimmed(`${message1} (optional; leave blank for none)`, 'OK', `Add Progress comment`)
  if (resText === false || resText == null) {
    logDebug('promptAddProgressLineInputs', `User cancelled progress comment prompt`)
    return null
  }
  const comment = String(resText).trim()
  if (comment === '') {
    logDebug('promptAddProgressLineInputs', `Empty progress comment; skipping progress line`)
    return { comment: '', progressDateStr: todaysDateISOString, percentStr: '' }
  }
  const resNum = await inputIntegerBounded('Add Progress % completion', `Percent Complete (optional %${lastPercentMessage})`, 100, 0)
  let percentStr = ''
  if (!isNaN(resNum)) {
    percentStr = String(resNum)
  }
  return { comment, progressDateStr: todaysDateISOString, percentStr }
}

/**
 * Detect whether frontmatter metadata keys or body metadata line exist.
 * @param {TNote} note
 * @param {string} combinedKey
 * @param {Array<string>} [separateKeys] - configured separate FM keys (defaults to common defaults)
 * @param {FrontmatterFieldsMap} [fieldsMap] - optional pre-scanned map
 * @returns {{ hasCombinedTagsMetadata: boolean, hasSeparateFrontmatterMetadata: boolean, hasFrontmatterMetadata: boolean, metadataBodyLineIndex: false | number, combinedMetadataField: FrontmatterFieldRead }}
 */
export function getMetadataPresenceState(
  note: TNote,
  combinedKey: string,
  separateKeys?: Array<string>,
  fieldsMap?: FrontmatterFieldsMap,
): {
  hasCombinedTagsMetadata: boolean,
  hasSeparateFrontmatterMetadata: boolean,
  hasFrontmatterMetadata: boolean,
  metadataBodyLineIndex: false | number,
  combinedMetadataField: FrontmatterFieldRead,
} {
  const map = fieldsMap != null ? fieldsMap : readAllRawFrontmatterFields(note)
  const combinedMetadataField = getRawFrontmatterFieldFromMap(map, combinedKey)
  const hasCombinedTagsMetadata = combinedMetadataField.exists && String(combinedMetadataField.value ?? '').trim() !== ''
  const keysToCheck =
    separateKeys != null && separateKeys.length > 0
      ? separateKeys
      : ['start', 'due', 'reviewed', 'completed', 'cancelled', 'review', 'nextReview', 'started']
  const hasSeparateFrontmatterMetadata = keysToCheck.some((k) => {
    const field = getRawFrontmatterFieldFromMap(map, k)
    return field.exists && String(field.value ?? '').trim() !== ''
  })
  const hasFrontmatterMetadata = hasCombinedTagsMetadata || hasSeparateFrontmatterMetadata
  const metadataBodyLineIndex = getMetadataLineIndexFromBody(note)
  return {
    hasCombinedTagsMetadata,
    hasSeparateFrontmatterMetadata,
    hasFrontmatterMetadata,
    metadataBodyLineIndex,
    combinedMetadataField,
  }
}

/**
 * Derive separate frontmatter key from mention preference.
 * @param {string} raw
 * @param {string} defaultKey
 * @returns {string}
 */
export function separateFmKeyFromMentionPref(raw: string, defaultKey: string): string {
  const s = String(raw || '').replace(/^[@#]/, '')
  return s !== '' ? s : defaultKey
}
