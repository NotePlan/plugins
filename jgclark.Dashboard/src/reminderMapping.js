// @flow
//-----------------------------------------------------------------------------
// Reminder list resolution and CalendarItem -> Dashboard mapping
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDashboardSettings, TReminderForDashboard, TSectionItem } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { logDebug, logWarn } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'

//-----------------------------------------------------------------------------
// Types

/**
 * Reminder list titles plus optional color-by-title map used for fetch and display.
 */
export type TReminderListsResult = {
  titles: Array<string>,
  colorByTitle: { [string]: string },
}

//-----------------------------------------------------------------------------
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
 * @param {Array<any>} lists - reminder list objects from the NotePlan API
 * @returns {TReminderListsResult}
 */
function titlesAndColorsFromReminderListObjects(lists: Array<any>): TReminderListsResult {
  const colorByTitle: { [string]: string } = {}
  const titles: Array<string> = []
  for (const list of lists) {
    // availableReminderLists returns list objects with title + color (typed loosely as TCalendarItem)
    // $FlowFixMe[prop-missing]
    const title: string = list.title || ''
    if (!title || title.trim() === '') continue
    titles.push(title)
    // $FlowFixMe[prop-missing]
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
    // in one of them is simply absent from the Dashboard, with nothing anywhere to
    // say why -- which reads as "the Dashboard lost my reminder".
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
 * Resolve which reminder lists to use for this Dashboard config / Perspective.
 * Blank `includedReminderLists` inherits NotePlan-enabled lists; a non-empty CSV selects
 * those accessible list names (including lists disabled in NotePlan) by exact title match.
 * @param {TDashboardSettings} config
 * @returns {TReminderListsResult}
 */
export function getReminderListsForConfig(config: TDashboardSettings): TReminderListsResult {
  const configuredNames = dedupeReminderListTitles(stringListOrArrayToArray(config.includedReminderLists ?? '', ','))
  if (configuredNames.length === 0) {
    return getEnabledReminderLists()
  }

  const { titles: accessibleTitles, colorByTitle: accessibleColors } = getAllAccessibleReminderLists()
  const accessibleSet: { [string]: boolean } = {}
  for (const title of accessibleTitles) {
    accessibleSet[title] = true
  }

  const matchedTitles: Array<string> = []
  const missingTitles: Array<string> = []
  for (const name of configuredNames) {
    if (accessibleSet[name]) {
      matchedTitles.push(name)
    } else {
      missingTitles.push(name)
    }
  }

  if (missingTitles.length > 0) {
    logWarn('getReminderListsForConfig', `includedReminderLists names not found among accessible lists: ${missingTitles.join(', ')}`)
  }

  const colorByTitle: { [string]: string } = {}
  for (const title of matchedTitles) {
    if (accessibleColors[title]) {
      colorByTitle[title] = accessibleColors[title]
    }
  }

  logDebug('getReminderListsForConfig', `- Perspective override: ${String(matchedTitles.length)} of ${String(configuredNames.length)} configured list(s): ${matchedTitles.join(', ') || '(none)'}`)
  return { titles: matchedTitles, colorByTitle }
}

//-----------------------------------------------------------------------------
// Priority and CalendarItem mapping

/**
 * Map Apple Reminders / EventKit priority values to Dashboard (NotePlan-style) priority.
 * Apple: 0 = none, 1 = high, 5 = medium, 9 = low.
 * Dashboard: 0 = none, 1 = low (!), 2 = medium (!!), 3 = high (!!!).
 * @param {mixed} applePriority - raw value from TCalendarItem.priority
 * @returns {number} 0 / 1 / 2 / 3
 */
export function mapAppleReminderPriorityToDashboard(applePriority: mixed): number {
  const raw = typeof applePriority === 'number' ? applePriority : parseInt(String(applePriority ?? ''), 10)
  if (raw === 1) return 3 // high
  if (raw === 5) return 2 // medium
  if (raw === 9) return 1 // low
  return 0 // none or unknown
}

/**
 * Map Dashboard priority (0 / 1 / 2 / 3) back to Apple Reminders / EventKit priority.
 * @param {number} dashboardPriority
 * @returns {number} Apple: 0 = none, 1 = high, 5 = medium, 9 = low
 */
export function mapDashboardPriorityToAppleReminder(dashboardPriority: number): number {
  if (dashboardPriority === 3) return 1 // high
  if (dashboardPriority === 2) return 5 // medium
  if (dashboardPriority === 1) return 9 // low
  return 0
}

/**
 * Parse leading !!! / !! / ! priority markers from reminder text (NotePlan task style).
 * Note: This is a Dashboard-specific convention, to allow users to set priority in the reminder text in the add-reminder-dialog, in the same way as they do for tasks.
 * Requires whitespace after the markers and non-empty remaining text; otherwise leaves text unchanged and priority unset (0).
 * @param {string} text
 * @returns {{ title: string, dashboardPriority: number }}
 */
export function parseLeadingPriorityFromReminderText(text: string): { title: string, dashboardPriority: number } {
  const trimmed = text.trim()
  const match = trimmed.match(/^(!{1,3})\s+(.+)$/)
  if (!match) {
    return { title: trimmed, dashboardPriority: 0 }
  }
  const bangs = match[1]
  const rest = match[2].trim()
  if (rest === '') {
    return { title: trimmed, dashboardPriority: 0 }
  }
  const dashboardPriority = bangs === '!!!' ? 3 : bangs === '!!' ? 2 : 1
  return { title: rest, dashboardPriority }
}

/**
 * Map a NotePlan CalendarItem (reminder) into TReminderForDashboard.
 * Does not pass TCalendarItem through to section items.
 * @param {TCalendarItem} calendarItem
 * @param {{ [string]: string }} [colorByTitle] - optional map of list title -> hex color
 * @returns {TReminderForDashboard}
 */
export function mapCalendarItemToReminderForDashboard(
  calendarItem: TCalendarItem,
  colorByTitle: { [string]: string } = {},
): TReminderForDashboard {
  const listname = calendarItem.calendar || ''
  const reminder: TReminderForDashboard = {
    title: calendarItem.title || '(untitled reminder)',
    listname,
    // TODO(future): Enable this if the API is extended to cover flagged status
    // flagged: Boolean(calendarItem.flagged),
    flagged: false,
  }
  if (calendarItem.id) {
    reminder.id = calendarItem.id
  }
  const dashboardPriority = mapAppleReminderPriorityToDashboard(calendarItem.priority)
  if (dashboardPriority >= 1 && dashboardPriority <= 3) {
    reminder.priority = dashboardPriority
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
  if (calendarItem.date) {
    // Note: API quirk: some undated reminders still report a date (now, or epoch 1970-01-01T00:00:00.000Z).
    // This test to see if there are 'occurences' (i.e. dated) works around this.
    // Note: 'occurences' is a typo in the API, it should be 'occurrences'.
    // From NotePlan v3.21.2, Calendar.update with date=null clears due date; keep epoch treatment for older/legacy items.
    // Reminder due dates from NotePlan/EventKit are stored in Zulu (UTC). Coerce bridge Date-or-ISO-string, then
    // convert to local timezone for Dashboard date bucketing (YYYY-MM-DD) and timed display (HH:mm).
    const rawDate: Date | string = calendarItem.date
    const dateObj: Date = rawDate instanceof Date ? rawDate : new Date(rawDate)
    const dateMs = dateObj.getTime()
    const isEpochDate = !isNaN(dateMs) && dateMs < 86400000 // to allow for different timezones, not just midnight GMT
    if (!isEpochDate && calendarItem.occurences && calendarItem.occurences.length > 0) {
      const localMom = moment(dateObj) // formats in local TZ
      reminder.date = localMom.format('YYYY-MM-DD')
      if (!calendarItem.isAllDay) {
        reminder.time = localMom.format('HH:mm')
      }
    }
  }

  // Log one compact line per reminder: the raw EventKit fields next to what we derived.
  // Strictly better than the older `if (title.match(/test/i))` dump, which only
  // covered reminders that happened to have "test" in the name.
  logDebug('reminderFromCalendarItem', `- list="${String(listname ?? "?")}" "${String(calendarItem.title).slice(0, 34)}" rawDate=${String(calendarItem.date).slice(0, 16)} isAllDay=${String(calendarItem.isAllDay)} occurences=${String(calendarItem.occurences ? calendarItem.occurences.length : 'none')} -> date=${String(reminder.date ?? 'UNDATED')} time=${String(reminder.time ?? '-')}`)
  return reminder
}

/**
 * Build a TSectionItem for a reminder.
 * @param {string} id
 * @param {TReminderForDashboard} reminder
 * @returns {TSectionItem}
 */
export function createReminderSectionItem(id: string, reminder: TReminderForDashboard): TSectionItem {
  return {
    ID: id,
    sectionCode: 'REM',
    itemType: 'reminder',
    reminder,
  }
}
