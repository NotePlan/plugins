// @flow
//-----------------------------------------------------------------------------
// Supporting functions for date ranges etc. in SearchExtensions plugin.
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import { hyphenatedDateString } from '@helpers/dateTime'
import { logError } from '@helpers/dev'
import { getPeriodStartEndDates } from '@helpers/NPdateTime'

/**
 * NP extended search syntax for dates and date ranges (used via native date: operators):
 * date:today | yesterday | tomorrow | past | future | past-and-today
 * date:this-week | last-week | next-week | this-month | last-month | next-month
 * date:this-year | last-year | next-year | 30days | all
 * date:2025-08-25 | 2025-W35 | 2025-08 | 2025-Q3 | 2025
 * date:2025-08-01-2025-08-30 (and week/month/quarter/year ranges)
 */

/**
 * Get date range from user (interactive period picker).
 * @returns {Promise<[string, string, string, string]>} [fromDateStr, toDateStr, periodString, periodAndPartStr]
 */
export async function getDateRangeFromUser(): Promise<[string, string, string, string]> {
  try {
    const [fromDate, toDate, _periodType, periodString, periodAndPartStr, _periodNumber] = await getPeriodStartEndDates(`What period shall I search over?`, false, '', true)
    if (fromDate == null || toDate == null) {
      throw new Error('Dates could not be parsed for requested time period')
    }
    const fromDateStr = hyphenatedDateString(fromDate)
    const toDateStr = hyphenatedDateString(toDate)
    let periodAndPartStrToUse = periodAndPartStr
    if (periodAndPartStr === '') {
      periodAndPartStrToUse = periodString
    }
    return [fromDateStr, toDateStr, periodString, periodAndPartStrToUse]
  } catch (error) {
    logError('getDateRangeFromUser', `${error.message}`)
    return ['', '', '', '']
  }
}
