// @flow
//-----------------------------------------------------------------------------
// Generate data for REM (Reminders) Section and day/TB reminder buckets
// Last updated 2026-07-14 for v2.4.0.b50, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { reminderItems } from './demoData'
import type { TActionButton, TDashboardSettings, TReminderForDashboard, TSection, TSectionCode, TSectionItem, TSettingItem } from './types'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { clo, clof, logDebug, logError, logTimer, logWarn, timer } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'

// TODO(later): periodic auto-refresh while Dashboard is visible (TB-style timer)

/**
 * Buckets of incomplete reminders for Dashboard sections.
 * Today is split timed vs untimed; REM section holds undated + before yesterday.
 * Dates after tomorrow are excluded (future-dated beyond the Tomorrow day bucket).
 */
export type TRemindersGeneratedData = {
  timedTodayItems: Array<TSectionItem>,
  untimedTodayItems: Array<TSectionItem>,
  yesterdayItems: Array<TSectionItem>,
  tomorrowItems: Array<TSectionItem>,
  remindersSection: ?TSection,
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
    remindersSection: null,
  }
}

/**
 * Enabled reminder lists from NotePlan settings: titles plus optional color-by-title map.
 * Uses Calendar.availableReminderLists({ enabledOnly: true }) when available (NP >= 3.20.0);
 * otherwise falls back to all list titles (no colors / enable filter on older NP).
 * @returns {{ titles: Array<string>, colorByTitle: { [string]: string } }}
 */
export function getEnabledReminderLists(): { titles: Array<string>, colorByTitle: { [string]: string } } {
  const colorByTitle: { [string]: string } = {}
  if (usersVersionHas('availableReminderLists')) {
    const enabledLists = Calendar.availableReminderLists({ enabledOnly: true })
    const titles: Array<string> = []
    for (const list of enabledLists) {
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
    logDebug('getEnabledReminderLists', `- ${String(titles.length)} enabled reminder list(s): ${titles.join(', ') || '(none)'}`)
    return { titles, colorByTitle }
  }
  // Older NotePlan: cannot read enabled/disabled or colors; use all accessible list titles
  logWarn('getEnabledReminderLists', `availableReminderLists not supported on this NotePlan version; using all reminder list titles`)
  const allTitles = Calendar.availableReminderListTitles()
  const titles = allTitles.slice().filter((t) => Boolean(t) && t.trim() !== '')
  return { titles, colorByTitle }
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
    // TODO(later): map real flagged when NotePlan exposes it on CalendarItem
    flagged: false,
  }
  if (calendarItem.id) {
    reminder.id = calendarItem.id
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
    clof(calendarItem, "CalendarItem (for Reminder): ", ['title', 'date', 'occurences', 'isAllDay', 'isCompleted'])
    clo(reminder, "  => Reminder: ")
  }
  return reminder
}

/**
 * Sort reminders: flagged first, then by date then time (timed before undated), then title.
 * @param {Array<TSectionItem>} items
 * @returns {Array<TSectionItem>}
 */
export function sortReminderSectionItems(items: Array<TSectionItem>): Array<TSectionItem> {
  return items.slice().sort((a, b) => {
    const ra = a.reminder
    const rb = b.reminder
    if (!ra || !rb) return 0

    if (ra.flagged !== rb.flagged) {
      return ra.flagged ? -1 : 1
    }

    const dateA = ra.date || '9999-99-99'
    const dateB = rb.date || '9999-99-99'
    if (dateA !== dateB) {
      return dateA < dateB ? -1 : 1
    }

    // Timed before undated within the same date
    const timeA = ra.time || '99:99'
    const timeB = rb.time || '99:99'
    if (timeA !== timeB) {
      return timeA < timeB ? -1 : 1
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
 * Bucket incomplete reminder items into today timed/untimed, yesterday, tomorrow, and the rest.
 * Reminders dated after tomorrow are dropped (not shown in REM or day sections).
 * @param {Array<TSectionItem>} allItems
 * @returns {{
 *   timedTodayItems: Array<TSectionItem>,
 *   untimedTodayItems: Array<TSectionItem>,
 *   yesterdayItems: Array<TSectionItem>,
 *   tomorrowItems: Array<TSectionItem>,
 *   restItems: Array<TSectionItem>,
 * }}
 */
export function bucketReminderItems(allItems: Array<TSectionItem>): {
  timedTodayItems: Array<TSectionItem>,
  untimedTodayItems: Array<TSectionItem>,
  yesterdayItems: Array<TSectionItem>,
  tomorrowItems: Array<TSectionItem>,
  restItems: Array<TSectionItem>,
} {
  const todayISO = getTodaysDateHyphenated()
  const yesterdayISO = moment().subtract(1, 'days').format('YYYY-MM-DD')
  const tomorrowISO = moment().add(1, 'days').format('YYYY-MM-DD')

  const timedTodayItems: Array<TSectionItem> = []
  const untimedTodayItems: Array<TSectionItem> = []
  const yesterdayItems: Array<TSectionItem> = []
  const tomorrowItems: Array<TSectionItem> = []
  const restItems: Array<TSectionItem> = []
  let skippedFutureCount = 0

  for (const item of allItems) {
    const reminder = item.reminder
    if (!reminder) {
      restItems.push(item)
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
    } else {
      // undated or before yesterday
      restItems.push(item)
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
    restItems: sortReminderSectionItems(restItems),
  }
}

/**
 * Fetch incomplete reminders, bucket by date (dropping those after tomorrow), and build the REM section for the remainder.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {Promise<TRemindersGeneratedData>}
 */
export async function getRemindersGeneratedData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
): Promise<TRemindersGeneratedData> {
  try {
    // Missing showRemindersSection means ON (default); only an explicit false disables Reminders.
    if (config.showRemindersSection === false) {
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
      const { titles: enabledListTitles, colorByTitle } = getEnabledReminderLists()
      listTitlesForAdd = enabledListTitles
      let calendarItems: Array<TCalendarItem> = []
      if (enabledListTitles.length === 0) {
        logDebug('getRemindersGeneratedData', `- no enabled reminder lists; buckets will be empty`)
      } else {
        calendarItems = await Calendar.remindersByLists(enabledListTitles)
      }
      const incomplete = calendarItems.filter((ci) => !ci.isCompleted)
      logDebug('getRemindersGeneratedData', `- fetched ${String(calendarItems.length)} reminders from ${String(enabledListTitles.length)} list(s), ${String(incomplete.length)} incomplete`)

      allItems = incomplete.map((ci, index) => {
        const reminder = mapCalendarItemToReminderForDashboard(ci, colorByTitle)
        return createReminderSectionItem(`${thisSectionCode}-${index}`, reminder)
      })
    }

    const buckets = bucketReminderItems(allItems)
    logDebug(
      'getRemindersGeneratedData',
      `- buckets: timedToday=${String(buckets.timedTodayItems.length)} untimedToday=${String(buckets.untimedTodayItems.length)} yesterday=${String(buckets.yesterdayItems.length)} tomorrow=${String(buckets.tomorrowItems.length)} rest=${String(buckets.restItems.length)}`,
    )

    const maxInSection = config.maxItemsToShowInSection ?? 24
    let restItems = buckets.restItems
    const totalRestCount = restItems.length
    if (totalRestCount > maxInSection) {
      restItems = restItems.slice(0, maxInSection)
    }

    let sectionDescription = ''
    if (config?.FFlag_ShowSectionTimings) {
      sectionDescription += ` [${timer(startTime)}]`
    }

    // Form fields for the heading add-Reminder button (CommandButton → showDialog)
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
    ]
    const actionButtons: Array<TActionButton> =
      listTitlesForAdd.length > 0
        ? [
          {
            actionName: 'addReminder',
            actionPluginID: `${pluginJson['plugin.id']}`,
            display: '<i class= "fa-regular fa-fw fa-circle-plus RemindersColor" ></i> ',
            tooltip: 'Add a new Reminder',
            postActionRefresh: ['REM', 'DT', 'TB', 'DO'],
            formFields: reminderFormFields,
            submitOnEnter: true,
            submitButtonText: 'Add & Close',
            actionParam: '',
          },
        ]
        : []

    const remindersSection: TSection = {
      ID: thisSectionCode,
      sectionCode: thisSectionCode,
      name: 'Reminders',
      showSettingName: 'showRemindersSection',
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-list',
      sectionTitleColorPart: 'RemindersSectionColor',
      sectionItems: restItems,
      generatedDate: new Date(),
      isReferenced: false,
      actionButtons: actionButtons,
      totalCount: totalRestCount > maxInSection ? totalRestCount : undefined,
    }

    logTimer('getRemindersGeneratedData', startTime, `- REM rest section has ${String(restItems.length)} of ${String(totalRestCount)} items, 100`)

    return {
      timedTodayItems: buckets.timedTodayItems,
      untimedTodayItems: buckets.untimedTodayItems,
      yesterdayItems: buckets.yesterdayItems,
      tomorrowItems: buckets.tomorrowItems,
      remindersSection,
    }
  } catch (error) {
    logError('getRemindersGeneratedData', error.message)
    return emptyRemindersGeneratedData()
  }
}
