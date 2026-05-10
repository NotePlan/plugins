// @flow
//-----------------------------------------------------------------------------
// Project class helpers for Project & Reviews plugin
// by Jonathan Clark
// Last updated 2026-04-30 for v2.0.0.b27, @Cursor
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { getMetadataLineIndexFromBody, getParamMentionFromList } from './reviewHelpers'
import { RE_DATE, todaysDateISOString, toISODateString } from '@helpers/dateTime'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getContentFromBrackets } from '@helpers/general'
import { getFrontmatterParagraphs } from '@helpers/NPFrontMatter'
import { usersVersionHas } from '@helpers/NPVersions'
import { getInputTrimmed, inputIntegerBounded, isInt } from '@helpers/userInput'

export type FrontmatterFieldRead = {
  exists: boolean,
  value: ?string,
}

/** Full-line match for ISO YYYY-MM-DD (same rule as RE_DATE). */
export const RE_ISO_DATE_LINE: RegExp = new RegExp(`^${RE_DATE}$`)

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
  // $FlowFixMe[prop-missing] runtime may expose numeric timestamps
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
 * @param {CoreNoteFields} note
 * @param {string} fieldName
 * @returns {FrontmatterFieldRead}
 */
export function readRawFrontmatterField(note: CoreNoteFields, fieldName: string): FrontmatterFieldRead {
  const fmParas = getFrontmatterParagraphs(note, false)
  if (!fmParas || fmParas.length === 0) {
    return { exists: false, value: undefined }
  }
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escapedFieldName}:\\s*(.*)$`, 'i')
  for (const para of fmParas) {
    const match = para.content.match(re)
    if (match) {
      return { exists: true, value: match[1] != null ? match[1] : '' }
    }
  }
  return { exists: false, value: undefined }
}

/**
 * Calculate duration string for a date, optionally relative to a start date.
 * If startDate is provided, returns "after X" format. Otherwise returns relative time (e.g., "2 days ago").
 * If duration is less than 1 day then return "today".
 * @param {string|Date} date - The date to calculate duration for (ISO string or Date)
 * @param {?string|Date} startDate - Optional start date for calculating duration between dates
 * @param {boolean} roundShortDurationToToday - Whether to use round to 'today' if duration is measured in hours or less
 * @returns {string} Duration string
 */
export function formatDurationString(date: string | Date, startDate?: string | Date, roundShortDurationToToday: boolean = false): string {
  if (startDate != null) {
    return `after ${moment(startDate).to(moment(date), true)}`
  } else {
    let duration = moment(date).fromNow()
    if (roundShortDurationToToday && ['seconds', 'minutes', 'hours'].includes(duration)) {
      duration = 'today'
    }
    return duration
  }
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
 * Interpret CommandBar.showForm() result for add-progress: comment (required), progress date, optional integer %.
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
    if (comment === '') {
      logDebug('parseRawProgressFormValues', `Empty comment; treating as invalid`)
      return null
    }
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
        title: `Add Progress for '${projectTitle}'`,
        submitText: 'Add',
        fields: [
          { type: 'string', key: 'comment', title: 'Comment', required: true },
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

  const resText = await getInputTrimmed(message1, 'OK', `Add Progress comment`)
  if (!resText) {
    logDebug('promptAddProgressLineInputs', `No valid progress comment`)
    return null
  }
  const comment = String(resText)
  const resNum = await inputIntegerBounded('Add Progress % completion', 'Percent Complete (optional %${lastPercentMessage})', 100, 0)
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
 * @returns {{ hasCombinedTagsMetadata: boolean, hasSeparateFrontmatterMetadata: boolean, hasFrontmatterMetadata: boolean, metadataBodyLineIndex: false | number }}
 */
export function getMetadataPresenceState(note: TNote, combinedKey: string): {
  hasCombinedTagsMetadata: boolean,
  hasSeparateFrontmatterMetadata: boolean,
  hasFrontmatterMetadata: boolean,
  metadataBodyLineIndex: false | number,
} {
  const combinedMetadataField = readRawFrontmatterField(note, combinedKey)
  const hasCombinedTagsMetadata = combinedMetadataField.exists && String(combinedMetadataField.value ?? '').trim() !== ''
  const hasSeparateFrontmatterMetadata =
    ['start', 'due', 'reviewed', 'completed', 'cancelled', 'review', 'nextReview']
      .map((k) => readRawFrontmatterField(note, k))
      .some((field) => field.exists && String(field.value ?? '').trim() !== '')
  const hasFrontmatterMetadata = hasCombinedTagsMetadata || hasSeparateFrontmatterMetadata
  const metadataBodyLineIndex = getMetadataLineIndexFromBody(note)
  return { hasCombinedTagsMetadata, hasSeparateFrontmatterMetadata, hasFrontmatterMetadata, metadataBodyLineIndex }
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
