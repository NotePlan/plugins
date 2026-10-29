// @flow
//-------------------------------------------------------------------------------
// Start dates (`>YYYY-MM-DD` or `>YYYY-Wnn`) and due dates (`!` / `!>` plus a day or week).
//
// A due date counts when a non-word or non-digit character, or the start of the
// line, is immediately before `!`, and the date is not followed by a digit.
// A start date counts the same way before `>`, and the date is not followed by a digit.
// The `>` in `!>YYYY-MM-DD` or `!>YYYY-Wnn` belongs to the due date, so it is not also a start date.
// When several dates match, the first valid one in the string is used.
// A week id uses NotePlan's week (the user's first day of week). The due day is the
// last day of that week. The start day is the first day of that week.
//-------------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { RE_DATE, RE_NP_WEEK_SPEC, daysBetween, getTodaysDateHyphenated, relativeDateFromNumber } from './dateTime'
import { getFirstDateInPeriod, getLastDateInPeriod } from './NPdateTime'

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
  return returnFirstValidDueDate(content) != null || returnFirstValidWeekDue(content) != null
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
  if (due != null) return daysBetween(getTodaysDateHyphenated(), due)
  return daysUntilWeekDue(content)
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

// Week ids are YYYY-Wnn. W00 and W54+ are not weeks.
const RE_WEEK_DUE_PATTERN = `(?:^|\\D)!>?(${RE_NP_WEEK_SPEC})(?!\\d)`
const RE_BANG_GT_WEEK_DUE_PATTERN = `(?:^|\\D)!>(${RE_NP_WEEK_SPEC})(?!\\d)`
const RE_WEEK_START_PATTERN = `(?:^|[^\\d!])>(${RE_NP_WEEK_SPEC})(?!\\d)`

/**
 * @param {string} weekSpec - YYYY-Wnn
 * @returns {boolean}
 */
function isValidWeekSpec(weekSpec: string): boolean {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekSpec)
  if (match == null) return false
  const week = parseInt(match[2], 10)
  return week >= 1 && week <= 53
}

/**
 * First valid week id for a marker pattern, or null.
 * @param {string} content
 * @param {RegExp} pattern - global, multiline; capture group 1 is YYYY-Wnn
 * @returns {?string}
 */
function firstValidWeekSpec(content: string, pattern: RegExp): ?string {
  for (const match of content.matchAll(pattern)) {
    const weekSpec = match[1]
    if (typeof weekSpec === 'string' && isValidWeekSpec(weekSpec)) return weekSpec
  }
  return null
}

/**
 * First `!YYYY-Wnn` or `!>YYYY-Wnn`, without the marker, or null.
 * @param {string} content
 * @returns {?string}
 */
function returnFirstValidWeekDue(content: string): ?string {
  return firstValidWeekSpec(content, new RegExp(RE_WEEK_DUE_PATTERN, 'gm'))
}

/**
 * First `!>YYYY-Wnn`, without the marker, or null.
 * @param {string} content
 * @returns {?string}
 */
function returnFirstValidBangGtWeekDue(content: string): ?string {
  return firstValidWeekSpec(content, new RegExp(RE_BANG_GT_WEEK_DUE_PATTERN, 'gm'))
}

/**
 * First `>YYYY-Wnn` start week, without the marker, or null.
 * The `>` inside `!>` is not a start week.
 * @param {string} content
 * @returns {?string}
 */
function returnFirstValidWeekStart(content: string): ?string {
  return firstValidWeekSpec(content, new RegExp(RE_WEEK_START_PATTERN, 'gm'))
}

/**
 * ISO day for the first or last day of a NotePlan week, or null when the week is not usable.
 * @param {string} weekSpec
 * @param {boolean} useEnd
 * @returns {?string}
 */
function weekBoundIso(weekSpec: string, useEnd: boolean): ?string {
  if (!isValidWeekSpec(weekSpec)) return null
  const bound = useEnd ? getLastDateInPeriod(weekSpec) : getFirstDateInPeriod(weekSpec)
  if (typeof bound !== 'string' || !moment(bound, 'YYYY-MM-DD', true).isValid()) return null
  return bound
}

/**
 * Last day of the first week due date (`!YYYY-Wnn` or `!>YYYY-Wnn`), or null.
 * @param {string} content
 * @returns {?string} YYYY-MM-DD
 */
export function weekDueEndDate(content: string): ?string {
  const due = returnFirstValidWeekDue(content)
  if (due == null) return null
  return weekBoundIso(due, true)
}

/**
 * Whole days from today to the last day of the first week due date.
 * Positive when that day is still ahead, 0 when it is today, negative when it has passed.
 * Null when there is no week due date.
 * @param {string} content
 * @returns {?number}
 */
export function daysUntilWeekDue(content: string): ?number {
  const end = weekDueEndDate(content)
  if (end == null) return null
  return daysBetween(getTodaysDateHyphenated(), end)
}

/**
 * Whether the first week due date's last day is before today.
 * @param {string} content
 * @returns {boolean}
 */
export function weekDueIsPast(content: string): boolean {
  const days = daysUntilWeekDue(content)
  return days != null && days < 0
}

/**
 * Why this week is or is not inside a `>YYYY-Wnn` start week and a `!>YYYY-Wnn` due week.
 * A plain `!YYYY-Wnn` does not open this span. A day start or day due does not either.
 * @param {string} content
 * @returns {string}
 */
export function explainThisWeekSpan(content: string): string {
  const startWeek = returnFirstValidWeekStart(content)
  const dueWeek = returnFirstValidBangGtWeekDue(content)
  if (startWeek == null && dueWeek == null) return 'no start week and no !> week due'
  if (startWeek == null) return 'no start week'
  if (dueWeek == null) return 'no !> week due'
  const start = weekBoundIso(startWeek, false)
  const dueEnd = weekBoundIso(dueWeek, true)
  if (start == null || dueEnd == null) return `week bounds unavailable (start ${startWeek} due ${dueWeek})`
  const today = getTodaysDateHyphenated()
  if (daysBetween(start, today) < 0) return `today ${today} is before start week ${startWeek} (due ${dueWeek}, through ${dueEnd})`
  if (daysBetween(today, dueEnd) < 0) return `today ${today} is after due week ${dueWeek} (start ${startWeek}, through ${dueEnd})`
  return `in week span start ${startWeek} due ${dueWeek}`
}

/**
 * Whether today falls in a week from the start week (`>YYYY-Wnn`) through the due week (`!>YYYY-Wnn`).
 * Inclusive of the first day of the start week and the last day of the due week.
 * @param {string} content
 * @returns {boolean}
 */
export function thisWeekIsInStartDueWeekSpan(content: string): boolean {
  return explainThisWeekSpan(content).startsWith('in week span')
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
  kind: 'day' | 'week',
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
      kind: 'day',
    })
  }
  return spans
}

/**
 * Week due markers (`!YYYY-Wnn` or `!>YYYY-Wnn`). `days` is the offset to the last day of that week.
 * @param {string} content
 * @returns {Array<DueDateSpan>}
 */
function weekDueSpans(content: string): Array<DueDateSpan> {
  const today = getTodaysDateHyphenated()
  const spans: Array<DueDateSpan> = []
  for (const match of content.matchAll(new RegExp(RE_WEEK_DUE_PATTERN, 'gm'))) {
    const weekSpec = match[1]
    if (typeof weekSpec !== 'string' || !isValidWeekSpec(weekSpec)) continue
    const end = weekBoundIso(weekSpec, true)
    if (end == null) continue
    const markerLength = match[0].endsWith(`>${weekSpec}`) ? 2 : 1
    const tokenLength = markerLength + weekSpec.length
    const tokenStart = match.index + match[0].length - tokenLength
    spans.push({
      iso: end,
      days: daysBetween(today, end),
      tokenStart,
      tokenLength,
      kind: 'week',
    })
  }
  return spans
}

/**
 * The due marker the countdown chip uses. A week due always qualifies. A day due qualifies
 * only inside the caller's day window. The earliest such marker in the line wins.
 * @param {string} content
 * @param {?number} maxDays
 * @returns {?DueDateSpan}
 */
function firstCountdownSpan(content: string, maxDays: ?number): ?DueDateSpan {
  const limit = dueChipDayLimit(maxDays)
  const spans = dueDateSpans(content).concat(weekDueSpans(content)).sort((a, b) => a.tokenStart - b.tokenStart)
  for (const span of spans) {
    if (span.kind === 'week') return span
    if (span.days <= limit) return span
  }
  return null
}

/**
 * Chip label for a week due date. Days when the offset is from -6 through 6, otherwise whole weeks
 * with the partial week dropped toward zero.
 * @param {number} days
 * @returns {dueDateSoonChip}
 */
function weekChipFromDays(days: number): dueDateSoonChip {
  if (days >= -6 && days <= 6) {
    if (days === 0) return { days, label: 'today', urgent: true }
    if (days < 0) {
      const ago = Math.abs(days)
      return { days, label: `${ago} ${dayWord(ago)} ago`, urgent: true }
    }
    return { days, label: `${days} ${dayWord(days)}`, urgent: false }
  }
  const weeks = Math.trunc(days / 7)
  const count = Math.abs(weeks)
  const word = count === 1 ? 'week' : 'weeks'
  if (weeks < 0) return { days, label: `${count} ${word} ago`, urgent: true }
  return { days, label: `${count} ${word}`, urgent: false }
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
  const span = firstCountdownSpan(content, maxDays)
  if (span == null) return null
  if (span.kind === 'week') return weekChipFromDays(span.days)
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
  const span = firstCountdownSpan(content, maxDays)
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
