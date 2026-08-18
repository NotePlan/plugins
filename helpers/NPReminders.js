// @flow
//----------------------------------------------------------------------------------------------------------------------
// Helpers for Apple Reminders / NotePlan Calendar reminder APIs
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//----------------------------------------------------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { colorToModernSpecWithOpacity } from '@helpers/colors'
import { logDebug, logWarn } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'

//----------------------------------------------------------------------------------------------------------------------
// Types

/**
 * Reminder list titles plus optional color-by-title map used for fetch and display.
 */
export type TReminderListsResult = {
  titles: Array<string>,
  colorByTitle: { [string]: string },
}

/**
 * Normalized reminder shape shared across plugins (local date/time, NotePlan-style priority).
 */
export type TReminder = {
  id?: string,
  title: string,
  notes?: string,
  listname: string,
  color?: string,
  // TODO(future): the NotePlan API does not yet expose flagged status, so nothing populates this
  // from real data - but demoData.js carries it in anticipation, so it is declared optional here.
  flagged?: boolean,
  priority?: number, // 0/omit = none; 1 / 2 / 3 = low / medium / high (from Apple 0 / 9 / 5 / 1)
  date?: string, // optional local calendar date YYYY-MM-DD (converted from API Zulu/UTC)
  time?: string, // optional local HH:MM in 24-hour format (converted from API Zulu/UTC)
  location?: string,
}

/**
 * Local calendar date and optional time extracted from a TCalendarItem reminder.
 */
export type TReminderLocalDateTime = {
  date?: string,
  time?: string,
}

/**
 * Display metadata for a reminder marker (list colour + optional due time).
 */
export type TReminderDisplayInfo = {
  color?: string,
  time?: string,
}

/**
 * Map of reminder id -> display metadata for @remind(UUID) markers and reminder chips.
 */
export type TReminderDisplayById = {
  [string]: TReminderDisplayInfo,
}

/**
 * Foreground/background colours for a reminder marker lozenge.
 * Uses the Apple Reminders list colour when provided; otherwise NP theme CSS variable fallbacks.
 * @param {?string} listColor - hex/list colour from the reminder list
 * @returns {{ color: string, backgroundColor: string }}
 */
export function getReminderMarkerColors(listColor?: ?string): { color: string, backgroundColor: string } {
  if (listColor) {
    return {
      color: listColor,
      backgroundColor: colorToModernSpecWithOpacity(listColor, 0.15) || `rgba(from ${listColor} r g b / 0.15)`,
    }
  }
  return {
    color: 'var(--fg-reminderMarker, #26709e)',
    backgroundColor: 'var(--bg-reminderMarker, #d7ebf8)',
  }
}

/**
 * Build id -> display map from normalized reminders (for @remind token rendering).
 * @param {Array<TReminder>} reminders
 * @returns {TReminderDisplayById}
 */
export function buildReminderDisplayByIdFromReminders(reminders: Array<TReminder>): TReminderDisplayById {
  const map: TReminderDisplayById = {}
  for (const reminder of reminders) {
    if (!reminder.id) continue
    map[reminder.id] = {
      color: reminder.color,
      time: reminder.time,
    }
  }
  return map
}

//----------------------------------------------------------------------------------------------------------------------
// List helpers

/**
 * Deduplicate titles while preserving first-seen order; skip blank strings.
 * @param {Array<string>} titles
 * @returns {Array<string>}
 */
export function dedupeReminderListTitles(titles: Array<string>): Array<string> {
  const seen: { [string]: boolean } = {}
  const result: Array<string> = []
  for (const title of titles) {
    const trimmed = title ? title.trim() : ''
    if (!trimmed || seen[trimmed]) continue
    seen[trimmed] = true
    result.push(trimmed)
  }
  return result
}

/**
 * Build titles + color map from Calendar.availableReminderLists() results.
 * @param {$ReadOnlyArray<any>} lists - reminder list objects from the NotePlan API
 * @returns {TReminderListsResult}
 */
// Note: $ReadOnlyArray because the list is only iterated, and every caller passes the result of
// Calendar.availableReminderLists(), which the API declares as read-only.
function titlesAndColorsFromReminderListObjects(lists: $ReadOnlyArray<any>): TReminderListsResult {
  const colorByTitle: { [string]: string } = {}
  const titles: Array<string> = []
  for (const list of lists) {
    // availableReminderLists returns list objects with title + color (typed loosely as TCalendarItem)
    const title: string = list.title || ''
    if (!title || title.trim() === '') continue
    titles.push(title)
    const listColor: ?string = list.color
    if (listColor && typeof listColor === 'string' && listColor.trim() !== '') {
      colorByTitle[title] = listColor
    }
  }
  return { titles, colorByTitle }
}

/**
 * Return all accessible reminder lists (including NotePlan-disabled): titles plus optional color-by-title map.
 * Uses Calendar.availableReminderLists() when available (NP >= 3.20.0);
 * otherwise falls back to all list titles (no colors on older NP).
 * @returns {TReminderListsResult}
 */
export function getAllAccessibleReminderLists(): TReminderListsResult {
  if (usersVersionHas('availableReminderLists')) {
    const allLists = Calendar.availableReminderLists()
    const result = titlesAndColorsFromReminderListObjects(allLists)
    logDebug('getAllAccessibleReminderLists', `- ${String(result.titles.length)} accessible reminder list(s): ${result.titles.join(', ') || '(none)'}`)
    return result
  }
  logWarn('getAllAccessibleReminderLists', `availableReminderLists not supported on this NotePlan version; using all reminder list titles`)
  const allTitles = Calendar.availableReminderListTitles()
  const titles = dedupeReminderListTitles(allTitles.slice())
  return { titles, colorByTitle: {} }
}

/**
 * Return enabled reminder lists from NotePlan settings: titles plus optional color-by-title map.
 * Uses Calendar.availableReminderLists({ enabledOnly: true }) when available (NP >= 3.20.0);
 * otherwise falls back to all list titles (no colors / enable filter on older NP).
 * @returns {TReminderListsResult}
 */
export function getEnabledReminderLists(): TReminderListsResult {
  if (usersVersionHas('availableReminderLists')) {
    const enabledLists = Calendar.availableReminderLists({ enabledOnly: true })
    const result = titlesAndColorsFromReminderListObjects(enabledLists)
    logDebug('getEnabledReminderLists', `- ${String(result.titles.length)} enabled reminder list(s): ${result.titles.join(', ') || '(none)'}`)
    // Name the lists that exist but are switched off in NotePlan. A reminder living
    // in one of them is simply absent from callers, with nothing to say why.
    try {
      const allTitles = titlesAndColorsFromReminderListObjects(Calendar.availableReminderLists()).titles
      const ignored = allTitles.filter((t) => !result.titles.includes(t))
      if (ignored.length > 0) {
        logDebug('getEnabledReminderLists', `- ignoring ${String(ignored.length)} list(s) disabled in NotePlan: [${ignored.join(', ')}]`)
      }
    } catch (err) {
      logWarn('getEnabledReminderLists', `- could not enumerate all lists to report ignored ones: ${err.message}`)
    }
    return result
  }
  // Older NotePlan: cannot read enabled/disabled or colors; use all accessible list titles
  logWarn('getEnabledReminderLists', `availableReminderLists not supported on this NotePlan version; using all reminder list titles`)
  const allTitles = Calendar.availableReminderListTitles()
  const titles = dedupeReminderListTitles(allTitles.slice())
  return { titles, colorByTitle: {} }
}

/**
 * Match configured list names against accessible reminder lists (exact title match).
 * Includes lists disabled in NotePlan when they are still accessible.
 * Logs a warning for names that are not found.
 * @param {Array<string>} configuredNames - already-deduped list titles to match
 * @returns {TReminderListsResult}
 */
export function resolveReminderListsByNames(configuredNames: Array<string>): TReminderListsResult {
  const { titles: accessibleTitles, colorByTitle: accessibleColors } = getAllAccessibleReminderLists()
  const accessibleSet: { [string]: boolean } = {}
  for (const title of accessibleTitles) {
    accessibleSet[title] = true
  }

  const matchedTitles: Array<string> = []
  const matchedSet: { [string]: boolean } = {}
  const missingTitles: Array<string> = []
  for (const name of configuredNames) {
    if (!accessibleSet[name]) {
      if (!missingTitles.includes(name)) {
        missingTitles.push(name)
      }
      continue
    }
    if (matchedSet[name]) continue
    matchedSet[name] = true
    matchedTitles.push(name)
  }

  if (missingTitles.length > 0) {
    logWarn('resolveReminderListsByNames', `configured reminder list names not found among accessible lists: ${missingTitles.join(', ')}`)
  }

  const colorByTitle: { [string]: string } = {}
  for (const title of matchedTitles) {
    if (accessibleColors[title]) {
      colorByTitle[title] = accessibleColors[title]
    }
  }

  logDebug('resolveReminderListsByNames', `- matched ${String(matchedTitles.length)} of ${String(configuredNames.length)} configured list(s): ${matchedTitles.join(', ') || '(none)'}`)
  return { titles: matchedTitles, colorByTitle }
}

//----------------------------------------------------------------------------------------------------------------------
// Priority mapping

/**
 * Map Apple Reminders / EventKit priority values to NotePlan-style priority.
 * Apple: 0 = none, 1 = high, 5 = medium, 9 = low.
 * NotePlan: 0 = none, 1 = low (!), 2 = medium (!!), 3 = high (!!!).
 * @param {mixed} applePriority - raw value from TCalendarItem.priority
 * @returns {number} 0 / 1 / 2 / 3
 */
export function mapAppleReminderPriorityToNotePlan(applePriority: mixed): number {
  const raw = typeof applePriority === 'number' ? applePriority : parseInt(String(applePriority ?? ''), 10)
  if (raw === 1) return 3 // high
  if (raw === 5) return 2 // medium
  if (raw === 9) return 1 // low
  return 0 // none or unknown
}

/**
 * Map NotePlan-style priority (0 / 1 / 2 / 3) back to Apple Reminders / EventKit priority.
 * @param {number} notePlanPriority
 * @returns {number} Apple: 0 = none, 1 = high, 5 = medium, 9 = low
 */
export function mapNotePlanPriorityToAppleReminder(notePlanPriority: number): number {
  if (notePlanPriority === 3) return 1 // high
  if (notePlanPriority === 2) return 5 // medium
  if (notePlanPriority === 1) return 9 // low
  return 0
}

/**
 * Parse leading !!! / !! / ! priority markers from reminder text (NotePlan task style).
 * Useful when creating reminders from NotePlan-style text (e.g. add-reminder dialogs).
 * Requires whitespace after the markers and non-empty remaining text; otherwise leaves text unchanged and priority unset (0).
 * @param {string} text
 * @returns {{ title: string, notePlanPriority: number }}
 */
export function parseLeadingPriorityFromReminderText(text: string): { title: string, notePlanPriority: number } {
  const trimmed = text.trim()
  const match = trimmed.match(/^(!{1,3})\s+(.+)$/)
  if (!match) {
    return { title: trimmed, notePlanPriority: 0 }
  }
  const bangs = match[1]
  const rest = match[2].trim()
  if (rest === '') {
    return { title: trimmed, notePlanPriority: 0 }
  }
  const notePlanPriority = bangs === '!!!' ? 3 : bangs === '!!' ? 2 : 1
  return { title: rest, notePlanPriority }
}

//----------------------------------------------------------------------------------------------------------------------
// CalendarItem date/time and mapping

/**
 * Extract local YYYY-MM-DD and optional HH:mm from a reminder CalendarItem.
 * Handles API quirks: epoch dates, missing occurences (undated), and UTC → local conversion.
 * Note: 'occurences' is a typo in the NotePlan API (should be 'occurrences').
 * @param {TCalendarItem} calendarItem
 * @returns {TReminderLocalDateTime}
 */
export function getReminderLocalDateAndTime(calendarItem: TCalendarItem): TReminderLocalDateTime {
  if (!calendarItem.date) {
    return {}
  }
  // Some undated reminders still report a date (now, or epoch 1970-01-01T00:00:00.000Z).
  // Requiring occurences (i.e. dated) works around this.
  // From NotePlan v3.21.2, Calendar.update with date=null clears due date; keep epoch treatment for older/legacy items.
  const rawDate: Date | string = calendarItem.date
  const dateObj: Date = rawDate instanceof Date ? rawDate : new Date(rawDate)
  const dateMs = dateObj.getTime()
  const isEpochDate = !isNaN(dateMs) && dateMs < 86400000 // allow for different timezones, not just midnight GMT
  if (isEpochDate || !calendarItem.occurences || calendarItem.occurences.length === 0) {
    return {}
  }
  const localMom = moment(dateObj) // formats in local TZ
  const result: TReminderLocalDateTime = {
    date: localMom.format('YYYY-MM-DD'),
  }
  if (!calendarItem.isAllDay) {
    result.time = localMom.format('HH:mm')
  }
  return result
}

/**
 * Map a NotePlan CalendarItem (reminder) into a normalized TReminder.
 * Does not pass TCalendarItem through to callers.
 * @param {TCalendarItem} calendarItem
 * @param {{ [string]: string }} [colorByTitle] - optional map of list title -> hex color
 * @returns {TReminder}
 */
export function mapCalendarItemToReminder(
  calendarItem: TCalendarItem,
  colorByTitle: { [string]: string } = {},
): TReminder {
  const listname = calendarItem.calendar || ''
  const reminder: TReminder = {
    title: calendarItem.title || '(untitled reminder)',
    listname,
    // TODO(future): Enable this if the API is extended to cover flagged status
    // flagged: Boolean(calendarItem.flagged),
    flagged: false,
  }
  if (calendarItem.id) {
    reminder.id = calendarItem.id
  }
  const notePlanPriority = mapAppleReminderPriorityToNotePlan(calendarItem.priority)
  if (notePlanPriority >= 1 && notePlanPriority <= 3) {
    reminder.priority = notePlanPriority
  }
  if (listname && colorByTitle[listname]) {
    reminder.color = colorByTitle[listname]
  }
  if (calendarItem.notes && calendarItem.notes.trim() !== '') {
    reminder.notes = calendarItem.notes
  }
  if (calendarItem.location && calendarItem.location.trim() !== '') {
    reminder.location = calendarItem.location
  }
  const { date, time } = getReminderLocalDateAndTime(calendarItem)
  if (date) {
    reminder.date = date
  }
  if (time) {
    reminder.time = time
  }

  logDebug(
    'mapCalendarItemToReminder',
    `- list="${String(listname ?? '?')}" "${String(calendarItem.title).slice(0, 34)}" rawDate=${String(calendarItem.date).slice(0, 16)} isAllDay=${String(calendarItem.isAllDay)} occurences=${String(calendarItem.occurences ? calendarItem.occurences.length : 'none')} -> date=${String(reminder.date ?? 'UNDATED')} time=${String(reminder.time ?? '-')}`,
  )
  return reminder
}

//----------------------------------------------------------------------------------------------------------------------
// Time / sort helpers

/**
 * Whether a reminder has a non-empty time string.
 * @param {{ time?: string }} reminder
 * @returns {boolean}
 */
export function reminderHasTime(reminder: { time?: string, ... }): boolean {
  return Boolean(reminder.time && reminder.time.trim() !== '')
}

/**
 * Whether a timed reminder's due time has been reached (time <= now, same calendar day assumed).
 * @param {{ time?: string }} reminder
 * @returns {boolean}
 */
export function reminderTimeHasBeenReached(reminder: { time?: string, ... }): boolean {
  if (!reminderHasTime(reminder) || !reminder.time) {
    return false
  }
  const nowTime = moment().format('HH:mm')
  return reminder.time <= nowTime
}

/**
 * Keep only reminders whose due time has already been reached.
 * @param {Array<TReminder>} reminders
 * @returns {Array<TReminder>}
 */
export function filterRemindersWhoseTimeHasBeenReached(reminders: Array<TReminder>): Array<TReminder> {
  return reminders.filter((reminder) => reminderTimeHasBeenReached(reminder))
}

/**
 * Compare two reminders: by time (timed before undated), then priority desc, then date, then title.
 * Missing reminders compare equal (0).
 * TODO(future): Enable flagged-first sorting if the API is extended to cover flagged status
 * @param {?TReminder} ra
 * @param {?TReminder} rb
 * @returns {number}
 */
export function compareRemindersByTimePriorityDate(ra: ?TReminder, rb: ?TReminder): number {
  if (!ra || !rb) return 0

  // Timed before undated; earlier times first
  const timeA = ra.time || '99:99'
  const timeB = rb.time || '99:99'
  if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1
  }

  // Higher priority first (1 / 2 / 3); missing treated as 0
  const priorityA = ra.priority ?? 0
  const priorityB = rb.priority ?? 0
  if (priorityA !== priorityB) {
    return priorityB - priorityA
  }

  const dateA = ra.date || '9999-99-99'
  const dateB = rb.date || '9999-99-99'
  if (dateA !== dateB) {
    return dateA < dateB ? -1 : 1
  }

  return (ra.title || '').localeCompare(rb.title || '')
}

/**
 * Sort reminders: by time (timed before undated), then priority desc, then date, then title.
 * @param {Array<TReminder>} reminders
 * @returns {Array<TReminder>}
 */
export function sortRemindersByTimePriorityDate(reminders: Array<TReminder>): Array<TReminder> {
  return reminders.slice().sort(compareRemindersByTimePriorityDate)
}
