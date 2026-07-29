// @flow
//-----------------------------------------------------------------------------
// Generate data for REM (Reminders) Section and day/TB reminder buckets
// Last updated 2026-07-29 for v2.4.0.b57, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { isCurrentRemindersEnabled, isUndatedOverdueRemindersEnabled } from './dashboardHelpers'
import { reminderItems } from './demoData'
import type { TActionButton, TDashboardSettings, TReminderForDashboard, TSection, TSectionCode, TSectionItem, TSettingItem } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { clo, clof, logDebug, logError, logTimer, logWarn, timer } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'

// TODO(later): periodic auto-refresh while Dashboard is visible (TB-style timer)

/**
 * Buckets of incomplete reminders for Dashboard sections.
 * Today is split timed vs untimed; REM holds undated only; past-dated go to overdueItems.
 * Dates after tomorrow are excluded.
 */
export type TRemindersGeneratedData = {
  timedTodayItems: Array<TSectionItem>,
  untimedTodayItems: Array<TSectionItem>,
  yesterdayItems: Array<TSectionItem>,
  tomorrowItems: Array<TSectionItem>,
  overdueItems: Array<TSectionItem>,
  remindersSection: ?TSection,
}

/**
 * Reminder list titles plus optional color-by-title map used for fetch and display.
 */
export type TReminderListsResult = {
  titles: Array<string>,
  colorByTitle: { [string]: string },
}

/**
 * @returns {TRemindersGeneratedData}
 */
function emptyRemindersGeneratedData(): TRemindersGeneratedData {
  return {
    timedTodayItems: [],
    untimedTodayItems: [],
    yesterdayItems: [],
    tomorrowItems: [],
    overdueItems: [],
    remindersSection: null,
  }
}

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
 * All accessible reminder lists (including NotePlan-disabled): titles plus optional color-by-title map.
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
 * Enabled reminder lists from NotePlan settings: titles plus optional color-by-title map.
 * Uses Calendar.availableReminderLists({ enabledOnly: true }) when available (NP >= 3.20.0);
 * otherwise falls back to all list titles (no colors / enable filter on older NP).
 * @returns {TReminderListsResult}
 */
export function getEnabledReminderLists(): TReminderListsResult {
  if (usersVersionHas('availableReminderLists')) {
    const enabledLists = Calendar.availableReminderLists({ enabledOnly: true })
    const result = titlesAndColorsFromReminderListObjects(enabledLists)
    logDebug('getEnabledReminderLists', `- ${String(result.titles.length)} enabled reminder list(s): ${result.titles.join(', ') || '(none)'}`)
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
    logWarn(
      'getReminderListsForConfig',
      `includedReminderLists names not found among accessible lists: ${missingTitles.join(', ')}`,
    )
  }

  const colorByTitle: { [string]: string } = {}
  for (const title of matchedTitles) {
    if (accessibleColors[title]) {
      colorByTitle[title] = accessibleColors[title]
    }
  }

  logDebug(
    'getReminderListsForConfig',
    `- Perspective override: ${String(matchedTitles.length)} of ${String(configuredNames.length)} configured list(s): ${matchedTitles.join(', ') || '(none)'}`,
  )
  return { titles: matchedTitles, colorByTitle }
}

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
    // Note: API bug: all reminders report a date: depending how they're created they can be current datetime, or epoch start (1970-01-01T00:00:00.000Z)
    // This test to see if there are 'occurences' (i.e. dated) works around this.
    // Note: 'occurences' is a typo in the API, it should be 'occurrences'.
    // TODO(later): remove workarounds when bugs are fixed.
    // Also: writing date=null via the plugin bridge becomes 1970-01-01T00:00:00.000Z -- treat epoch as undated.
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
  if (calendarItem.title.match(/test/i) || calendarItem.title.match(/new/i)) {
    // TODO(future): Enable flagged in this clof list if the API is extended to cover flagged status
    clof(calendarItem, "CalendarItem (for Reminder): ", ['title', 'date', 'occurences', 'isAllDay', 'isCompleted', 'priority' /*, 'flagged' */])
    clo(reminder, "  => Reminder: ")
  }
  return reminder
}

/**
 * Sort reminders: by time (timed before undated), then priority desc, then date, then title.
 * TODO(future): Enable flagged-first sorting if the API is extended to cover flagged status
 * @param {Array<TSectionItem>} items
 * @returns {Array<TSectionItem>}
 */
export function sortReminderSectionItems(items: Array<TSectionItem>): Array<TSectionItem> {
  return items.slice().sort((a, b) => {
    const ra = a.reminder
    const rb = b.reminder
    if (!ra || !rb) return 0

    // TODO(future): Enable this if the API is extended to cover flagged status
    // if (ra.flagged !== rb.flagged) {
    //   return ra.flagged ? -1 : 1
    // }

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
  })
}

/**
 * Prepare reminder items for another section: assign destination sectionCode and unique IDs.
 * Returns new item objects (does not mutate the input array or its items).
 * @param {Array<TSectionItem>} reminderItems
 * @param {TSectionCode} sectionCode - e.g. 'DT' or 'DY'
 * @param {string} idPrefix - e.g. 'DT' or 'DT_REF'
 * @param {number} startIndex - starting index for ID suffix
 * @returns {Array<TSectionItem>}
 */
export function assignReminderItemsToSection(
  reminderItems: Array<TSectionItem>,
  sectionCode: TSectionCode,
  idPrefix: string,
  startIndex: number = 0,
): Array<TSectionItem> {
  return reminderItems.map((item, i) => ({
    ...item,
    ID: `${idPrefix}-${startIndex + i}`,
    sectionCode: sectionCode,
    reminder: item.reminder ? { ...item.reminder } : item.reminder,
  }))
}

/**
 * Build a TSectionItem for a reminder.
 * @param {string} id
 * @param {TReminderForDashboard} reminder
 * @returns {TSectionItem}
 */
function createReminderSectionItem(id: string, reminder: TReminderForDashboard): TSectionItem {
  return {
    ID: id,
    sectionCode: 'REM',
    itemType: 'reminder',
    reminder,
  }
}

/**
 * Whether a reminder has a non-empty time string.
 * @param {TReminderForDashboard} reminder
 * @returns {boolean}
 */
function reminderHasTime(reminder: TReminderForDashboard): boolean {
  return Boolean(reminder.time && reminder.time.trim() !== '')
}

/**
 * Whether a timed reminder's due time has been reached (time <= now, same calendar day assumed).
 * @param {TReminderForDashboard} reminder
 * @returns {boolean}
 */
export function reminderTimeHasBeenReached(reminder: TReminderForDashboard): boolean {
  if (!reminderHasTime(reminder) || !reminder.time) {
    return false
  }
  const nowTime = moment().format('HH:mm')
  return reminder.time <= nowTime
}

/**
 * Keep only reminder items whose due time has already been reached.
 * @param {Array<TSectionItem>} reminderItems
 * @returns {Array<TSectionItem>}
 */
export function filterRemindersWhoseTimeHasBeenReached(reminderItems: Array<TSectionItem>): Array<TSectionItem> {
  return reminderItems.filter((item) => item.reminder != null && reminderTimeHasBeenReached(item.reminder))
}

/**
 * Bucket incomplete reminder items into today timed/untimed, yesterday, tomorrow, past-dated overdue, and undated.
 * Reminders dated after tomorrow are dropped (not shown anywhere).
 * @param {Array<TSectionItem>} allItems
 * @returns {{
 *   timedTodayItems: Array<TSectionItem>,
 *   untimedTodayItems: Array<TSectionItem>,
 *   yesterdayItems: Array<TSectionItem>,
 *   tomorrowItems: Array<TSectionItem>,
 *   overdueItems: Array<TSectionItem>,
 *   undatedItems: Array<TSectionItem>,
 * }}
 */
export function bucketReminderItems(allItems: Array<TSectionItem>): {
  timedTodayItems: Array<TSectionItem>,
  untimedTodayItems: Array<TSectionItem>,
  yesterdayItems: Array<TSectionItem>,
  tomorrowItems: Array<TSectionItem>,
  overdueItems: Array<TSectionItem>,
  undatedItems: Array<TSectionItem>,
} {
  const todayISO = getTodaysDateHyphenated()
  const yesterdayISO = moment().subtract(1, 'days').format('YYYY-MM-DD')
  const tomorrowISO = moment().add(1, 'days').format('YYYY-MM-DD')

  const timedTodayItems: Array<TSectionItem> = []
  const untimedTodayItems: Array<TSectionItem> = []
  const yesterdayItems: Array<TSectionItem> = []
  const tomorrowItems: Array<TSectionItem> = []
  const overdueItems: Array<TSectionItem> = []
  const undatedItems: Array<TSectionItem> = []
  let skippedFutureCount = 0

  for (const item of allItems) {
    const reminder = item.reminder
    if (!reminder) {
      undatedItems.push(item)
      continue
    }
    const date = reminder.date
    if (date === todayISO) {
      if (reminderHasTime(reminder)) {
        timedTodayItems.push(item)
      } else {
        untimedTodayItems.push(item)
      }
    } else if (date === yesterdayISO) {
      yesterdayItems.push(item)
    } else if (date === tomorrowISO) {
      tomorrowItems.push(item)
    } else if (date && date > tomorrowISO) {
      // Future beyond tomorrow: omit from Dashboard entirely
      skippedFutureCount += 1
    } else if (date && date < yesterdayISO) {
      // Past-dated (before yesterday) → Overdue
      overdueItems.push(item)
    } else {
      // Undated (no usable date)
      undatedItems.push(item)
    }
  }

  if (skippedFutureCount > 0) {
    logDebug('bucketReminderItems', `- skipped ${String(skippedFutureCount)} reminder(s) dated after ${tomorrowISO}`)
  }

  return {
    timedTodayItems: sortReminderSectionItems(timedTodayItems),
    untimedTodayItems: sortReminderSectionItems(untimedTodayItems),
    yesterdayItems: sortReminderSectionItems(yesterdayItems),
    tomorrowItems: sortReminderSectionItems(tomorrowItems),
    overdueItems: sortReminderSectionItems(overdueItems),
    undatedItems: sortReminderSectionItems(undatedItems),
  }
}

/**
 * Fetch incomplete reminders, bucket by date (dropping those after tomorrow), and build the REM section for undated items.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {Promise<TRemindersGeneratedData>}
 */
export async function getRemindersGeneratedData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
): Promise<TRemindersGeneratedData> {
  try {
    const currentRemindersEnabled = isCurrentRemindersEnabled(config)
    const undatedOverdueRemindersEnabled = isUndatedOverdueRemindersEnabled(config)
    // Missing keys mean ON; only skip fetch when both toggles are explicitly off
    if (!currentRemindersEnabled && !undatedOverdueRemindersEnabled) {
      return emptyRemindersGeneratedData()
    }

    const thisSectionCode = 'REM'
    const startTime = new Date()
    logDebug('getRemindersGeneratedData', `--------- Gathering Reminders ${useDemoData ? 'DEMO ' : ''}items --------`)

    let allItems: Array<TSectionItem> = []
    let listTitlesForAdd: Array<string> = []

    if (useDemoData) {
      allItems = reminderItems.slice()
      // Create a unique list of list names from demo items so the add-Reminder heading button is shown in demo mode
      const seenListTitles: { [string]: boolean } = {}
      for (const item of allItems) {
        const listTitle = item.reminder?.listname
        if (listTitle && !seenListTitles[listTitle]) {
          seenListTitles[listTitle] = true
          listTitlesForAdd.push(listTitle)
        }
      }
    } else {
      // Resolve list titles for this Perspective (override or NotePlan-enabled), then fetch via remindersByLists
      const { titles: listTitles, colorByTitle } = getReminderListsForConfig(config)
      listTitlesForAdd = listTitles
      let calendarItems: Array<TCalendarItem> = []
      if (listTitles.length === 0) {
        logDebug('getRemindersGeneratedData', `- no reminder lists to query; buckets will be empty`)
      } else {
        // Always pass explicit list titles to remindersByLists (empty array would return ALL lists)
        calendarItems = await Calendar.remindersByLists(listTitles)
      }
      const incomplete = calendarItems.filter((ci) => !ci.isCompleted)
      logDebug('getRemindersGeneratedData', `- fetched ${String(calendarItems.length)} reminders from ${String(listTitles.length)} list(s) via remindersByLists, ${String(incomplete.length)} incomplete`)

      allItems = incomplete.map((ci, index) => {
        const reminder = mapCalendarItemToReminderForDashboard(ci, colorByTitle)
        return createReminderSectionItem(`${thisSectionCode}-${index}`, reminder)
      })
    }

    const buckets = bucketReminderItems(allItems)
    logDebug(
      'getRemindersGeneratedData',
      `- buckets: timedToday=${String(buckets.timedTodayItems.length)} untimedToday=${String(buckets.untimedTodayItems.length)} yesterday=${String(buckets.yesterdayItems.length)} tomorrow=${String(buckets.tomorrowItems.length)} overdue=${String(buckets.overdueItems.length)} undated=${String(buckets.undatedItems.length)}`,
    )

    // Zero out buckets owned by a disabled toggle
    const timedTodayItems = currentRemindersEnabled ? buckets.timedTodayItems : []
    const untimedTodayItems = currentRemindersEnabled ? buckets.untimedTodayItems : []
    const yesterdayItems = currentRemindersEnabled ? buckets.yesterdayItems : []
    const tomorrowItems = currentRemindersEnabled ? buckets.tomorrowItems : []
    const overdueItems = undatedOverdueRemindersEnabled ? buckets.overdueItems : []
    let undatedItems = undatedOverdueRemindersEnabled ? buckets.undatedItems : []

    const maxInSection = config.maxItemsToShowInSection ?? 24
    const totalUndatedCount = undatedItems.length
    if (totalUndatedCount > maxInSection) {
      undatedItems = undatedItems.slice(0, maxInSection)
    }

    let sectionDescription = '{countWithLimit} reminders'
    if (config?.FFlag_ShowSectionTimings) {
      sectionDescription += ` [${timer(startTime)}]`
    }

    // Adding Reminders only supported on NotePlan >= 3.21.2 (macOS build 1525)
    // Form fields for the heading add-Reminder button (CommandButton -> showDialog)
    const reminderFormFields: Array<TSettingItem> = [
      { type: 'input', label: 'Reminder:', key: 'text', focus: true },
      // $FlowIgnore[incompatible-type]
      {
        type: 'dropdown-select',
        label: 'Reminder List:',
        key: 'list',
        options: listTitlesForAdd,
        noWrapOptions: true,
        value: listTitlesForAdd[0] || '',
      },
      { type: 'calendarpicker', label: 'Date (optional):', key: 'date', dateFormat: 'YYYY-MM-DD' },
      { type: 'input', label: 'Time (optional, HH:MM):', key: 'time' },
      // TODO(future): Enable this if the API is extended to cover flagged status
      // { type: 'switch', label: 'Flagged?', key: 'flagged', default: false },
    ]
    const actionButtons: Array<TActionButton> =
      usersVersionHas('addRemindersSupport') && listTitlesForAdd.length > 0
        ? [
          {
            actionName: 'addReminder',
            actionPluginID: `${pluginJson['plugin.id']}`,
            display: '<i class= "fa-regular fa-fw fa-circle-plus RemindersColor" ></i> ',
            tooltip: 'Add a new Reminder',
            postActionRefresh: ['REM', 'DT', 'TB', 'DO', 'DY', 'OVERDUE'],
            formFields: reminderFormFields,
            submitOnEnter: true,
            submitButtonText: 'Add & Close',
            actionParam: '',
          },
        ]
        : []

    const remindersSection: ?TSection = undatedOverdueRemindersEnabled
      ? {
        ID: thisSectionCode,
        sectionCode: thisSectionCode,
        name: 'Reminders',
        showSettingName: 'showUndatedOverdueReminders',
        description: sectionDescription,
        FAIconClass: 'fa-regular fa-fw fa-list',
        sectionTitleColorPart: 'RemindersSectionColor',
        sectionItems: undatedItems,
        generatedDate: new Date(),
        isReferenced: false,
        actionButtons: actionButtons,
        totalCount: totalUndatedCount,
      }
      : null

    logTimer('getRemindersGeneratedData', startTime, `- REM undated section has ${String(undatedItems.length)} of ${String(totalUndatedCount)} items, 100`)

    return {
      timedTodayItems,
      untimedTodayItems,
      yesterdayItems,
      tomorrowItems,
      overdueItems,
      remindersSection,
    }
  } catch (error) {
    logError('getRemindersGeneratedData', error.message)
    return emptyRemindersGeneratedData()
  }
}
