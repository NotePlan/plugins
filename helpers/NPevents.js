// @flow
// --------------------------------------------------------
// Helpers for Events -- that require NotePlan functions
// --------------------------------------------------------

import type { HourMinObj } from './dateTime'

/** 
 * Get list of events for the given day (specified as YYYYMMDD).
 * Now also filters out any that don't come from one of the calendars specified
 * in calendarSet.
 * @author @jgclark
 * 
 * @param {string} dateStr YYYYMMDD date to use
 * @param {[string]} calendarSet optional list of calendars 
 * @param {HourMinObj} start optional start time in the day
 * @param {HourMinObj} end optional end time in the day
 * @return {[TCalendarItem]} array of events as CalendarItems
 */
export async function getEventsForDay(
  dateStr: string,
  calendarSet: string[] = [],
  start: HourMinObj = { h: 0, m: 0 },
  end: HourMinObj = { h: 23, m: 59 },
): Promise<Array<TCalendarItem>> {
  const y = parseInt(dateStr.slice(0, 4))
  const m = parseInt(dateStr.slice(4, 6))
  const d = parseInt(dateStr.slice(6, 8))
  const startOfDay = Calendar.dateFrom(y, m, d, start.h, start.m, 0)
  const endOfDay = Calendar.dateFrom(y, m, d, end.h, end.m, 59)
  console.log(`getEventsForDay: ${startOfDay.toString()} - ${endOfDay.toString()}`)
  let eArr: Array<TCalendarItem> = await Calendar.eventsBetween(startOfDay, endOfDay)
  console.log(`\tretrieved ${eArr.length} events from NP Calendar store`)

  // If we have a calendarSet list, use to weed out events that don't match .calendar
  if (calendarSet.length > 0) {
    // const filteredEventArray = calendarSet.slice().filter(c => eArr.some(e => e.calendar === c))
    eArr = eArr.filter((e) => calendarSet.some((c) => e.calendar === c))
    console.log(`\t${eArr.length} Events kept after filtering with ${calendarSet.toString()}`)
  }
  return eArr
}
