// @flow
/**
 * Relative date string utilities for NotePlan and React/WebView environments.
 * - getRelativeDatesWithNotes: full NotePlan API (DataStore.calendarNoteByDateString), includes TNote objects
 * - getRelativeDates: uses getRelativeDatesWithNotes when the API is available, otherwise moment-only fallback
 * @author @dwertheimer, @jgclark
 */

import moment from 'moment/min/moment-with-locales'
import * as dt from './dateTime'
import { logDebug, logError, logWarn } from './dev'
import { getNPWeekData, type NotePlanWeekInfo } from './NPdateTime'

export type RelativeDateWithNote = {
  relName: string,
  dateStr: string,
  note: ?TNote,
}

export type RelativeDate = {
  relName: string,
  dateStr: string,
}

/**
 * Get array of dates relative to today for day, week and month, with TNote objects from DataStore.
 * Requires DataStore.calendarNoteByDateString; returns an empty array if unavailable.
 *
 * @param {boolean} useISODailyDates - if true, use ISO daily dates (e.g. '2025-01-01') instead of NP filename-style dates (e.g. '20250101')
 * @returns {Array<RelativeDate>} relative date name, relative date string, TNote for that relative date
 */
export function getRelativeDatesWithNotes(useISODailyDates: boolean = false): Array<RelativeDateWithNote> {
  try {
    const relativeDates: Array<RelativeDateWithNote> = []
    const todayMom = moment()

    logDebug('NPDateStrings::getRelativeDatesWithNotes', `Starting, with typeof DataStore = ${typeof DataStore}`)
    if (!DataStore || typeof DataStore !== 'object') {
      return []
    }
    if (typeof DataStore.calendarNoteByDateString !== 'function') {
      logWarn(
        'NPDateStrings::getRelativeDatesWithNotes',
        `NP DataStore.calendarNoteByDateString function is not available, so returning an empty set.`,
      )
      return []
    }

    // Days
    let thisDateStr = moment(todayMom).format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'today', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).subtract(1, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'yesterday', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'tomorrow', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    for (let i = 6; i > 1; i--) {
      thisDateStr = moment(todayMom).subtract(i, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `${i} days ago`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }
    for (let i = 2; i < 7; i++) {
      thisDateStr = moment(todayMom).add(i, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `in ${i} days`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }

    // Weeks: NP weeks count differently from ISO/moment
    // $FlowIgnore[incompatible-type]
    let thisNPWeekInfo: NotePlanWeekInfo = getNPWeekData(new Date())
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'this week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), -1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'last week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), 1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'next week', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    for (let i = -11; i < -1; i++) {
      // $FlowIgnore[incompatible-type]
      thisNPWeekInfo = getNPWeekData(new Date(), i)
      // $FlowIgnore[incompatible-use]
      thisDateStr = thisNPWeekInfo.weekString
      relativeDates.push({ relName: `${-i} weeks ago`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }
    for (let i = 2; i < 11; i++) {
      // $FlowIgnore[incompatible-type]
      thisNPWeekInfo = getNPWeekData(new Date(), i)
      // $FlowIgnore[incompatible-use]
      thisDateStr = thisNPWeekInfo.weekString
      relativeDates.push({ relName: `${i} weeks' time`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }

    // Months
    for (let i = -12; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${-i} months ago`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }
    thisDateStr = moment(todayMom).subtract(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'last month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'this month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'next month', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    for (let i = 2; i < 12; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${i} months' time`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }

    // Quarters
    for (let i = -4; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${-i} quarters ago`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'last quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'this quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'next quarter', dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    for (let i = 2; i < 5; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${i} quarters' time`, dateStr: thisDateStr, note: DataStore.calendarNoteByDateString(thisDateStr) })
    }

    return relativeDates
  } catch (err) {
    logError('NPDateStrings::getRelativeDatesWithNotes', `${err.name}: ${err.message}`)
    // $FlowIgnore[prop-missing]
    return [{}]
  }
}

/**
 * Get array of dates relative to today for day, week and month, with TNote objects from DataStore.
 * Requires DataStore.calendarNoteByDateString; returns an empty array if unavailable.
 * Note: See also getRelativeDatesWithNotes(), which adds the note objects.
 *
 * @param {boolean} useISODailyDates - if true, use ISO daily dates (e.g. '2025-01-01') instead of NP filename-style dates (e.g. '20250101')
 * @returns {Array<RelativeDate>} relative date name, relative date string, TNote for that relative date
 */
export function getRelativeDatesUsingNPAPI(useISODailyDates: boolean = false): Array<RelativeDate> {
  try {
    const relativeDates: Array<RelativeDate> = []
    const todayMom = moment()

    logDebug('NPDateStrings::getRelativeDatesUsingNPAPI', `Starting, with typeof DataStore = ${typeof DataStore}`)
    if (!DataStore || typeof DataStore !== 'object') {
      logWarn('NPDateStrings::getRelativeDatesUsingNPAPI', `NP DataStore is not available, so returning an empty set.`)
      return []
    }
    if (typeof DataStore.calendarNoteByDateString !== 'function') {
      logWarn('NPDateStrings::getRelativeDatesUsingNPAPI', `NP DataStore.calendarNoteByDateString function is not available, so returning an empty set.`)
      return []
    }

    // Days
    let thisDateStr = moment(todayMom).format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'today', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).subtract(1, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'yesterday', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'tomorrow', dateStr: thisDateStr })
    for (let i = 6; i > 1; i--) {
      thisDateStr = moment(todayMom).subtract(i, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `${i} days ago`, dateStr: thisDateStr })
    }
    for (let i = 2; i < 7; i++) {
      thisDateStr = moment(todayMom).add(i, 'days').startOf('day').format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `in ${i} days`, dateStr: thisDateStr })
    }

    // Weeks: NP weeks count differently from ISO/moment
    // $FlowIgnore[incompatible-type]
    let thisNPWeekInfo: NotePlanWeekInfo = getNPWeekData(new Date())
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'this week', dateStr: thisDateStr })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), -1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'last week', dateStr: thisDateStr })
    // $FlowIgnore[incompatible-type]
    thisNPWeekInfo = getNPWeekData(new Date(), 1)
    // $FlowIgnore[incompatible-use]
    thisDateStr = thisNPWeekInfo.weekString
    relativeDates.push({ relName: 'next week', dateStr: thisDateStr })
    for (let i = -11; i < -1; i++) {
      // $FlowIgnore[incompatible-type]
      thisNPWeekInfo = getNPWeekData(new Date(), i)
      // $FlowIgnore[incompatible-use]
      thisDateStr = thisNPWeekInfo.weekString
      relativeDates.push({ relName: `${-i} weeks ago`, dateStr: thisDateStr })
    }
    for (let i = 2; i < 11; i++) {
      // $FlowIgnore[incompatible-type]
      thisNPWeekInfo = getNPWeekData(new Date(), i)
      // $FlowIgnore[incompatible-use]
      thisDateStr = thisNPWeekInfo.weekString
      relativeDates.push({ relName: `${i} weeks' time`, dateStr: thisDateStr })
    }

    // Months
    for (let i = -12; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${-i} months ago`, dateStr: thisDateStr })
    }
    thisDateStr = moment(todayMom).subtract(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'last month', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'this month', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'next month', dateStr: thisDateStr })
    for (let i = 2; i < 12; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${i} months' time`, dateStr: thisDateStr })
    }

    // Quarters
    for (let i = -4; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${-i} quarters ago`, dateStr: thisDateStr })
    }
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'last quarter', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'this quarter', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'next quarter', dateStr: thisDateStr })
    for (let i = 2; i < 5; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${i} quarters' time`, dateStr: thisDateStr })
    }

    return relativeDates
  } catch (err) {
    logError('NPDateStrings::getRelativeDatesUsingNPAPI', `${err.name}: ${err.message}`)
    return []
  }
}

/**
 * Get array of dates relative to today for day, week and month in React/WebView environment.
 * Note: This is a version that doesn't call NotePlan APIs -- needed before NP 3.21 when calling from HTMLViews.  It will not necessarily give the same results as getRelativeDatesUsingNPAPI() for Weeks.
 * 
 * Returns a list of objects with:
 * - relName: string - the relative date name (e.g. 'today', 'yesterday', 'in 2 days', 'this week', 'last week', 'next week', 'this month', 'last month', 'next month', 'this quarter', 'last quarter', 'next quarter')
 * - dateStr: string - the date string in the format of the note title (e.g. '2025-01-01', '2025-01-02', '2025-01-03')
 * - note: null - always null in React environment (notes cannot be fetched without NotePlan APIs)
 *
 * @param {boolean} useISODailyDates - if true, use ISO daily dates (e.g. '2025-01-01') instead of NP filename-style dates (e.g. '20250101')
 * @returns {Promise<Array<RelativeDate>>} Array of relative dates
 */
// eslint-disable-next-line require-await -- async API for React/WebView callers
export async function getRelativeDates(useISODailyDates: boolean = false): Promise<Array<RelativeDate>> {
  try {
    const relativeDates: Array<RelativeDate> = []
    const todayMom = moment()

    // Use the NotePlan API when DataStore can resolve calendar notes ...
    if (typeof DataStore !== 'undefined' && DataStore && typeof DataStore.calendarNoteByDateString === 'function') {
      return getRelativeDatesUsingNPAPI(useISODailyDates)
    }

    // ... otherwise use Moment library, which gives same results (apart from Weeks, potentially), but without Note objects.
    // Days
    let thisDateStr = moment(todayMom).format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'today', dateStr: thisDateStr })
    thisDateStr = moment(todayMom)
      .subtract(1, 'days')
      .startOf('day')
      .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'yesterday', dateStr: thisDateStr })
    thisDateStr = moment(todayMom)
      .add(1, 'days')
      .startOf('day')
      .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'tomorrow', dateStr: thisDateStr })
    for (let i = 6; i > 1; i--) {
      thisDateStr = moment(todayMom)
        .subtract(i, 'days')
        .startOf('day')
        .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `${i} days ago`, dateStr: thisDateStr })
    }
    for (let i = 2; i < 7; i++) {
      thisDateStr = moment(todayMom)
        .add(i, 'days')
        .startOf('day')
        .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `in ${i} days`, dateStr: thisDateStr })
    }

    // Note: NP can count weeks differently, but when its not available we'll use ISO weeks for simplicity.
    const startOfWeek = moment(todayMom).startOf('isoWeek')
    for (let i = -11; i < 12; i++) {
      const weekMom = moment(startOfWeek).add(i, 'weeks')
      thisDateStr = weekMom.format('YYYY-[W]WW')
      if (i === 0) {
        relativeDates.push({ relName: 'this week', dateStr: thisDateStr })
      } else if (i === -1) {
        relativeDates.push({ relName: 'last week', dateStr: thisDateStr })
      } else if (i === 1) {
        relativeDates.push({ relName: 'next week', dateStr: thisDateStr })
      } else if (i < -1 && i >= -11) {
        relativeDates.push({ relName: `${-i} weeks ago`, dateStr: thisDateStr })
      } else if (i > 1 && i < 11) {
        relativeDates.push({ relName: `${i} weeks' time`, dateStr: thisDateStr })
      }
    }

    // Months
    for (let i = -12; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${-i} months ago`, dateStr: thisDateStr })
    }
    thisDateStr = moment(todayMom).subtract(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'last month', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'this month', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'next month', dateStr: thisDateStr })
    for (let i = 2; i < 12; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${i} months' time`, dateStr: thisDateStr })
    }

    // Quarters
    for (let i = -4; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${-i} quarters ago`, dateStr: thisDateStr })
    }
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'last quarter', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'this quarter', dateStr: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'next quarter', dateStr: thisDateStr })
    for (let i = 2; i < 5; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${i} quarters' time`, dateStr: thisDateStr })
    }

    return relativeDates
  } catch (err) {
    logError('NPDateStrings::getRelativeDates', `${err.name}: ${err.message}`)
    // Return empty array on error
    return []
  }
}

