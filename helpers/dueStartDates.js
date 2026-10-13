// @flow
//-------------------------------------------------------------------------------
// Start dates (`>YYYY-MM-DD`) and due dates (`!YYYY-MM-DD` or `!>YYYY-MM-DD`) in task or note text.
//
// A due date counts when a non-word or non-digit character, or the start of the
// line, is immediately before `!`, and the date is not followed by a digit.
// A start date counts the same way before `>`, and the date is not followed by a digit.
// The `>` in `!>YYYY-MM-DD` belongs to the due date, so it is not also a start date.
// When several dates match, the first valid one in the string is used.
//-------------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { RE_DATE, daysBetween, getTodaysDateHyphenated, relativeDateFromNumber } from './dateTime'

// Before `!`: start of line, or any non-word / non-digit character (`\D`). After the date: not a digit.
const RE_DUE_DATE_PATTERN = `(?:^|\\D)!>?(${RE_DATE})(?!\\d)`
// Same boundaries as a due date. A preceding `!` is excluded so `!>YYYY-MM-DD` stays a due date only.
const RE_START_DATE_PATTERN = `(?:^|[^\\d!])>(${RE_DATE})(?!\\d)`

/**
 * First valid ISO date for a marker pattern, or null.
 * @param {string} content
 * @param {RegExp} pattern - global, multiline; capture group 1 is YYYY-MM-DD
 * @returns {?string}
 */
function firstValidISODate(content: string, pattern: RegExp): ?string {
  for (const match of content.matchAll(pattern)) {
    const iso = match[1]
    if (typeof iso === 'string' && moment(iso, 'YYYY-MM-DD', true).isValid()) return iso
  }
  return null
}

/**
 * Return first valid Due date in content, without the leading `!` or `!>`, or null when none is present.
 * @param {string} content
 * @returns {?string} YYYY-MM-DD
 */
function returnFirstValidDueDate(content: string): ?string {
  return firstValidISODate(content, new RegExp(RE_DUE_DATE_PATTERN, 'gm'))
}

/**
 * Return first valid Start date in content, without the leading `>`, or null when none is present.
 * @param {string} content
 * @returns {?string} YYYY-MM-DD
 */
function returnFirstValidStartDate(content: string): ?string {
  return firstValidISODate(content, new RegExp(RE_START_DATE_PATTERN, 'gm'))
}

/**
 * Whether content contains a due date (`!YYYY-MM-DD` or `!>YYYY-MM-DD`).
 * @param {string} content
 * @returns {boolean}
 */
export function hasDueDate(content: string): boolean {
  return returnFirstValidDueDate(content) != null
}

/**
 * Whether content contains both a start date (`>YYYY-MM-DD`) and a due date (`!YYYY-MM-DD` or `!>YYYY-MM-DD`).
 * @param {string} content
 * @returns {boolean}
 */
export function hasStartAndDueDate(content: string): boolean {
  return returnFirstValidStartDate(content) != null && returnFirstValidDueDate(content) != null
}

/**
 * Returns whole days from the start date to the due date (due minus start).
 * Negative when the due date is before the start date.
 * Returns null when either date is missing.
 * @param {string} content
 * @returns {?number} null when either date is missing
 */
export function daysBetweenStartAndDueDate(content: string): ?number {
  const start = returnFirstValidStartDate(content)
  const due = returnFirstValidDueDate(content)
  if (start == null || due == null) return null
  return daysBetween(start, due)
}

/**
 * Returns whole days from today to the due date (due minus today).
 * Positive when the due date is still ahead, 0 when it is today, negative when it is past.
 * Returns null when there is no due date.
 * @param {string} content
 * @returns {?number} null when there is no due date
 */
export function daysBeforeDueDate(content: string): ?number {
  const due = returnFirstValidDueDate(content)
  if (due == null) return null
  return daysBetween(getTodaysDateHyphenated(), due)
}

// `!>YYYY-MM-DD` only. A plain `!YYYY-MM-DD` is a deadline, not a start-to-due window.
const RE_BANG_GT_DUE_DATE_PATTERN = `(?:^|\\D)!>(${RE_DATE})(?!\\d)`

/**
 * First valid `!>YYYY-MM-DD` due date, without the marker, or null.
 * @param {string} content
 * @returns {?string} YYYY-MM-DD
 */
function returnFirstValidBangGtDueDate(content: string): ?string {
  return firstValidISODate(content, new RegExp(RE_BANG_GT_DUE_DATE_PATTERN, 'gm'))
}

/**
 * Why today is or is not inside the start date and a `!>YYYY-MM-DD` due date.
 * A plain `!YYYY-MM-DD` does not open this window. The `>` inside `!>` is not a start date.
 * @param {string} content
 * @returns {string}
 */
export function explainStartDueWindow(content: string): string {
  const start = returnFirstValidStartDate(content)
  const due = returnFirstValidBangGtDueDate(content)
  if (start == null && due == null) return 'no start date and no !> due date'
  if (start == null) return 'no start date'
  if (due == null) return 'no !> due date'
  const today = getTodaysDateHyphenated()
  if (daysBetween(start, today) < 0) return `today ${today} is before start ${start} (due ${due})`
  if (daysBetween(today, due) < 0) return `today ${today} is after due ${due} (start ${start})`
  return `in window start ${start} due ${due}`
}

/**
 * Whether today falls on or between the start date (`>YYYY-MM-DD`) and a due date written `!>YYYY-MM-DD`.
 * A plain `!YYYY-MM-DD` does not open this window. The `>` inside `!>` is not a start date.
 * @param {string} content
 * @returns {boolean}
 */
export function todayIsBetweenStartAndDueDate(content: string): boolean {
  return explainStartDueWindow(content).startsWith('in window')
}

export const DUE_CHIP_MAX_DAYS = 5

export type dueDateSoonChip= {
  days: number,
  label: string,
  urgent: boolean,
}

function dueChipDayLimit(maxDays: ?number): number {
  const rawLimit = maxDays == null || !Number.isFinite(maxDays) ? DUE_CHIP_MAX_DAYS : maxDays
  return Math.max(0, Math.floor(rawLimit))
}

type DueDateSpan = {
  iso: string,
  days: number,
  tokenStart: number,
  tokenLength: number,
}

function dueDateSpans(content: string): Array<DueDateSpan> {
  const today = getTodaysDateHyphenated()
  const spans: Array<DueDateSpan> = []
  for (const match of content.matchAll(new RegExp(RE_DUE_DATE_PATTERN, 'gm'))) {
    const iso = match[1]
    if (typeof iso !== 'string' || !moment(iso, 'YYYY-MM-DD', true).isValid()) continue
    // `!YYYY-MM-DD` is 1 marker char; `!>YYYY-MM-DD` is 2. The date sits at the end of the match.
    const markerLength = match[0].endsWith(`>${iso}`) ? 2 : 1
    const tokenLength = markerLength + iso.length
    const tokenStart = match.index + match[0].length - tokenLength
    spans.push({
      iso,
      days: daysBetween(today, iso),
      tokenStart,
      tokenLength,
    })
  }
  return spans
}

function dayWord(count: number): string {
  return count === 1 ? 'day' : 'days'
}

/**
 * Chip for a due date that is today, overdue, or at most `maxDays` ahead.
 * `urgent` is today or overdue (theme warning color). Farther dates return null.
 * @param {string} content
 * @param {number} maxDays - days ahead to start showing the chip (default 5). 0 shows today and overdue only.
 * @returns {?DueDateChip}
 */
export function dueDateChip(content: string, maxDays?: number): ?dueDateSoonChip{
  const limit = dueChipDayLimit(maxDays)
  const span = dueDateSpans(content).find((item) => item.days <= limit)
  if (span == null) return null
  const days = span.days
  if (days === 0) return { days, label: 'today', urgent: true }
  if (days < 0) {
    const ago = Math.abs(days)
    return { days, label: `${ago} ${dayWord(ago)} ago`, urgent: true }
  }
  return { days, label: `${days} ${dayWord(days)}`, urgent: false }
}

/**
 * Content with the first due date that is inside the countdown window removed.
 * A later due date that is still outside the window is left in place.
 * @param {string} content
 * @param {number} maxDays
 * @returns {string}
 */
export function contentWithoutDueDate(content: string, maxDays?: number): string {
  const limit = dueChipDayLimit(maxDays)
  const span = dueDateSpans(content).find((item) => item.days <= limit)
  if (span == null) return content
  const next = `${content.slice(0, span.tokenStart)}${content.slice(span.tokenStart + span.tokenLength)}`
  return next.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
}

/**
 * Turn due dates that are further ahead than the countdown window into an inline chip.
 * The label is YYYY-MM-DD unless `useRelativeDate` is true, in which case it is a relative date.
 * Dates inside the window are left as `!YYYY-MM-DD` or `!>YYYY-MM-DD` for the countdown chip.
 * @param {string} content
 * @param {number} maxDays
 * @param {boolean} useRelativeDate - caller chooses relative wording ("in 3 wks") or the calendar date
 * @returns {string}
 */
export function replaceFarDueDatesWithChips(content: string, maxDays?: number, useRelativeDate?: boolean): string {
  const limit = dueChipDayLimit(maxDays)
  const spans = dueDateSpans(content).filter((item) => item.days > limit)
  let next = content
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i]
    const label = useRelativeDate ? relativeDateFromNumber(span.days) : span.iso
    const chip = `<span class="dueDateAheadChip"><i class="fa-regular fa-flag pad-right"></i>${label}</span>`
    next = `${next.slice(0, span.tokenStart)}${chip}${next.slice(span.tokenStart + span.tokenLength)}`
  }
  return next
}
