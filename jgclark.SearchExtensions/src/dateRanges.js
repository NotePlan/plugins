// @flow
//-----------------------------------------------------------------------------
// Supporting functions for date ranges etc. in SearchExtensions plugin.
// Jonathan Clark
// Last updated 2025-09-26 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TSearchOptions } from './searchHelpers'
import {
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  convertISODateFilenameToNPDayFilename,
  YYYYMMDDDateStringFromDate,
} from '@helpers/dateTime'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import { getPeriodStartEndDates, } from '@helpers/NPdateTime'

/**
 * NP extended search syntax for dates and date ranges:
 date:today - Today's items
 * date:yesterday - Yesterday's items
 * date:tomorrow - Tomorrow's items
 * date:past - Past items
 * date:future - Future items
 * date:past-and-today - Past items including today
 * date:this-week - This week
 * date:last-week - Last week
 * date:next-week - Next week
 * date:this-month - This month
 * date:last-month - Last month
 * date:next-month - Next month
 * date:this-year - This year
 * date:last-year - Last year
 * date:next-year - Next year
 * date:30days - Rolling 30 days
 * date:all - All time (default if nothing is defined)
 * Custom ISO dates:
 * date:2025-08-25 - Specific day (YYYY-MM-DD)
 * date:2025-W35 - Specific week (YYYY-WNN)
 * date:2025-08 - Specific month (YYYY-MM)
 * date:2025-Q3 - Specific quarter (YYYY-QN)
 * date:2025 - Specific year (YYYY)
 * Date ranges (i):
 * date:2025-08-01-2025-08-30 - Day range (YYYY-MM-DD-YYYY-MM-DD)
 * date:2025-W01-2025-W52 - Week range (YYYY-WNN-YYYY-WNN)
 * date:2025-06-2025-07 - Month range (YYYY-MM-YYYY-MM)
 * date:2025-Q1-2025-Q4 - Quarter range (YYYY-QN-YYYY-QN)
 * date:2024-2025 - Year range (YYYY-YYYY)
*/

/** 
 * Work out time period to cover, including asking user if necessary.
 */
export function getDateRangeFromSearchOptions(searchOptions: TSearchOptions): [string, string, string, string] {
  try {
    let periodString = ''
    let periodAndPartStr = ''
    // let periodType = ''
    let fromDateStr = ''
    let toDateStr = ''
    
    // Try using supplied arguments (may not exist, and don't want to supply a default yet)
    const fromDateArg = searchOptions.fromDateStr
    const toDateArg = searchOptions.toDateStr
    const todayMom = new moment().startOf('day')

    fromDateStr = (fromDateArg && fromDateArg !== '')
      ? (fromDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
        ? convertISODateFilenameToNPDayFilename(fromDateArg)
        : fromDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
          ? fromDateArg
          : 'error')
      : todayMom.subtract(91, 'days').format('YYYYMMDD') // 91 days ago
    toDateStr = (toDateArg && toDateArg !== '')
      ? (toDateArg.match(RE_ISO_DATE) // for YYYY-MM-DD
        ? convertISODateFilenameToNPDayFilename(toDateArg)
        : toDateArg.match(RE_YYYYMMDD_DATE) // for YYYYMMDD
          ? toDateArg
          : 'error')
      : todayMom.format('YYYYMMDD') // today
    periodString = `${fromDateStr} - ${toDateStr}`
    periodAndPartStr = periodString
    
    return [fromDateStr, toDateStr, periodString, periodAndPartStr]
  } catch (error) {
    logError('getDateRangeFromSearchOptions', `${error.message}`)
    return ['', '', '', '']
  }
}

/**
 * Get date range from user
 */
export async function getDateRangeFromUser(): Promise<[string, string, string, string]> {
  try {
    let _fromDate: Date
    let _toDate: Date
    let periodString = ''
    let periodAndPartStr = ''
    let periodType = ''
    let fromDateStr = ''
    let toDateStr = ''
    let _periodNumber: number
    // eslint-disable-next-line no-unused-vars
    [_fromDate, _toDate, periodType, periodString, periodAndPartStr, _periodNumber] = await getPeriodStartEndDates(`What period shall I search over?`, false)
    if (_fromDate == null || _toDate == null) {
      throw new Error('dates could not be parsed for requested time period')
    }
    fromDateStr = YYYYMMDDDateStringFromDate(_fromDate)
    toDateStr = YYYYMMDDDateStringFromDate(_toDate)
    if (periodAndPartStr === '') {
      periodAndPartStr = periodString
    }
    return [fromDateStr, toDateStr, periodString, periodAndPartStr]
  } catch (error) {
    logError('getDateRangeFromUser', `${error.message}`)
    return ['', '', '', '']
  }
}
