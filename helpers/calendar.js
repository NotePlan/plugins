// @flow
// ----------------------------------------------------------------------------
// Helpers for Events/Calendar -- that don't require NotePlan functions
// ----------------------------------------------------------------------------

import {
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
} from 'date-fns'

/**
 * @description This function takes a list of calendar items and returns a list of calendar items that are not all day
 * @param {*} input - array of calendar items
 * @returns arry of calendar items without all day events
 */
export function getTimedEntries(input: Array<TCalendarItem>): Array<TCalendarItem> {
  return input.filter((event) => !event.isAllDay)
}

/**
 * Some events span multiple days, but we only want to show the time for one day in question.
 * Assumes that this list was previously filtered to only include events that are on the day in question.
 * @param {TCalendarItem[]} input - array of calendar items (e.g. for a day)
 * @param {Date} today - date to compare this event against (default is today)
 * @returns {Array<TCalendarItem>} the same array of items but with the start and end times adjusted to the day of interest
 */
export function keepTodayPortionOnly(input: Array<TCalendarItem>, whatDate: Date = new Date()): Array<TCalendarItem> {
  return input.map((event) => {
    const diff = !event.endDate ? 0 : differenceInCalendarDays(event.date, event.endDate)
    if (diff === 0) {
      return event
    } else {
      // make an eventCopy as event is immutable. NB: spread operator doesn't seem to work
      const eventCopy = {
        title: event.title,
        date: event.date,
        endDate: event.endDate, // end date for our purposes is the end of the starting day
        type: event.type,
        isAllDay: event.isAllDay,
        isCompleted: event.isCompleted,
        occurrences: event.occurrences,
        calendar: event.calendar,
        notes: event.notes,
        url: event.url,
        availability: event.availability,
      }
      const todayWasStart = differenceInCalendarDays(event.date, whatDate) === 0
      const todayWasEnd = !event.endDate ? true : differenceInCalendarDays(event.endDate, whatDate) === 0
      if (todayWasStart) {
        eventCopy.endDate = endOfDay(event.date)
      }
      if (todayWasEnd) {
        eventCopy.date = startOfDay(event.endDate || event.date)
      }
      if (!todayWasStart && !todayWasEnd) {
        eventCopy.date = startOfDay(whatDate)
        eventCopy.endDate = endOfDay(whatDate)
      }
      // $FlowFixMe[prop-missing]
      return eventCopy
    }
  })
}
