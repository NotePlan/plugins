// @flow
/**
 * React/WebView-specific date string utilities
 * These functions work in React environments where NotePlan APIs (DataStore, Calendar) are not available
 * @author @dwertheimer
 */

import moment from 'moment/min/moment-with-locales'
import * as dt from '../dateTime'

export type RelativeDate = {
  relName: string,
  dateStr: string,
  note: null, // Always null in React environment - notes cannot be fetched
}

/**
 * Get array of dates relative to today for day, week and month in React/WebView environment.
 * This is a React-safe version that doesn't call NotePlan APIs.
 * Returns a list of objects with:
 * - relName: string - the relative date name (e.g. 'today', 'yesterday', 'in 2 days', 'this week', 'last week', 'next week', 'this month', 'last month', 'next month', 'this quarter', 'last quarter', 'next quarter')
 * - dateStr: string - the date string in the format of the note title (e.g. '2025-01-01', '2025-01-02', '2025-01-03')
 * - note: null - always null in React environment (notes cannot be fetched without NotePlan APIs)
 *
 * @param {boolean} useISODailyDates - if true, use ISO daily dates (e.g. '2025-01-01') instead of NP filename-style dates (e.g. '20250101')
 * @returns {Array<RelativeDate>} Array of relative dates
 */
export function getRelativeDates(useISODailyDates: boolean = false): Array<RelativeDate> {
  try {
    const relativeDates: Array<RelativeDate> = []
    const todayMom = moment()

    // Days
    let thisDateStr = moment(todayMom).format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'today', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom)
      .subtract(1, 'days')
      .startOf('day')
      .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'yesterday', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom)
      .add(1, 'days')
      .startOf('day')
      .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
    relativeDates.push({ relName: 'tomorrow', dateStr: thisDateStr, note: null })
    for (let i = 6; i > 1; i--) {
      thisDateStr = moment(todayMom)
        .subtract(i, 'days')
        .startOf('day')
        .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `${i} days ago`, dateStr: thisDateStr, note: null })
    }
    for (let i = 2; i < 7; i++) {
      thisDateStr = moment(todayMom)
        .add(i, 'days')
        .startOf('day')
        .format(useISODailyDates ? dt.MOMENT_FORMAT_NP_ISO : dt.MOMENT_FORMAT_NP_DAY)
      relativeDates.push({ relName: `in ${i} days`, dateStr: thisDateStr, note: null })
    }

    // Weeks - use moment for week calculations in React environment
    // Note: NP weeks count differently, but for React we'll use ISO weeks for simplicity
    const startOfWeek = moment(todayMom).startOf('isoWeek')
    for (let i = -11; i < 12; i++) {
      const weekMom = moment(startOfWeek).add(i, 'weeks')
      thisDateStr = weekMom.format('YYYY-[W]WW')
      if (i === 0) {
        relativeDates.push({ relName: 'this week', dateStr: thisDateStr, note: null })
      } else if (i === -1) {
        relativeDates.push({ relName: 'last week', dateStr: thisDateStr, note: null })
      } else if (i === 1) {
        relativeDates.push({ relName: 'next week', dateStr: thisDateStr, note: null })
      } else if (i < -1 && i >= -11) {
        relativeDates.push({ relName: `${-i} weeks ago`, dateStr: thisDateStr, note: null })
      } else if (i > 1 && i < 11) {
        relativeDates.push({ relName: `${i} weeks' time`, dateStr: thisDateStr, note: null })
      }
    }

    // Months
    for (let i = -12; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${-i} months ago`, dateStr: thisDateStr, note: null })
    }
    thisDateStr = moment(todayMom).subtract(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'last month', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom).startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'this month', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom).add(1, 'month').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
    relativeDates.push({ relName: 'next month', dateStr: thisDateStr, note: null })
    for (let i = 2; i < 12; i++) {
      thisDateStr = moment(todayMom).add(i, 'months').startOf('month').format(dt.MOMENT_FORMAT_NP_MONTH)
      relativeDates.push({ relName: `${i} months' time`, dateStr: thisDateStr, note: null })
    }

    // Quarters
    for (let i = -4; i < -1; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${-i} quarters ago`, dateStr: thisDateStr, note: null })
    }
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'last quarter', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom).startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'this quarter', dateStr: thisDateStr, note: null })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ relName: 'next quarter', dateStr: thisDateStr, note: null })
    for (let i = 2; i < 5; i++) {
      thisDateStr = moment(todayMom).add(i, 'quarters').startOf('quarter').format(dt.MOMENT_FORMAT_NP_QUARTER)
      relativeDates.push({ relName: `${i} quarters' time`, dateStr: thisDateStr, note: null })
    }

    return relativeDates
  } catch (err) {
    // Return empty array on error
    return []
  }
}

