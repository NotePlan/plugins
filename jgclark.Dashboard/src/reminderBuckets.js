// @flow
//-----------------------------------------------------------------------------
// Pure reminder date bucketing, sorting, and section-merge helpers
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TReminderForDashboard, TSectionCode, TSectionItem } from './types'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { logDebug } from '@helpers/dev'

//-----------------------------------------------------------------------------
// Types

/**
 * Date buckets of incomplete reminders (settings-free classification).
 * Today is split timed vs untimed; past-dated go to overdueItems; undated to undatedItems.
 * Dates after tomorrow are excluded from all buckets.
 */
export type TReminderBuckets = {
  timedTodayItems: Array<TSectionItem>,
  untimedTodayItems: Array<TSectionItem>,
  yesterdayItems: Array<TSectionItem>,
  tomorrowItems: Array<TSectionItem>,
  overdueItems: Array<TSectionItem>,
  undatedItems: Array<TSectionItem>,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Whether a reminder has a non-empty time string.
 * @param {TReminderForDashboard} reminder
 * @returns {boolean}
 */
export function reminderHasTime(reminder: TReminderForDashboard): boolean {
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
  if (reminderItems.length > 0) {
    // logDebug('assignReminderItemsToSection', `- placing ${String(reminderItems.length)} reminder(s) into section ${String(sectionCode)}`)
  }
  return reminderItems.map((item, i) => ({
    ...item,
    ID: `${idPrefix}-${startIndex + i}`,
    sectionCode: sectionCode,
    reminder: item.reminder ? { ...item.reminder } : item.reminder,
  }))
}

/**
 * Bucket incomplete reminder items into today timed/untimed, yesterday, tomorrow, past-dated overdue, and undated.
 * Reminders dated after tomorrow are dropped (not shown anywhere).
 * @param {Array<TSectionItem>} allItems
 * @returns {TReminderBuckets}
 */
export function bucketReminderItems(allItems: Array<TSectionItem>): TReminderBuckets {
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
  // Log which bucket each reminder landed in, so a mis-bucketed one is visible.
  const bucketOf = (arr, name) => arr.forEach((it) => logDebug('bucketReminderItems', `- bucket=${name} "${String(it.reminder?.title ?? '?').slice(0, 34)}" date=${String(it.reminder?.date ?? 'UNDATED')} time=${String(it.reminder?.time ?? '-')}`))
  bucketOf(timedTodayItems, 'timedToday')
  bucketOf(untimedTodayItems, 'untimedToday')
  bucketOf(yesterdayItems, 'yesterday')
  bucketOf(tomorrowItems, 'tomorrow')
  bucketOf(overdueItems, 'overdue')
  bucketOf(undatedItems, 'undated')

  return {
    timedTodayItems: sortReminderSectionItems(timedTodayItems),
    untimedTodayItems: sortReminderSectionItems(untimedTodayItems),
    yesterdayItems: sortReminderSectionItems(yesterdayItems),
    tomorrowItems: sortReminderSectionItems(tomorrowItems),
    overdueItems: sortReminderSectionItems(overdueItems),
    undatedItems: sortReminderSectionItems(undatedItems),
  }
}
