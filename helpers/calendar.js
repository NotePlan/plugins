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
 * @returns array of calendar items without all day events
 */
export function getTimedEntries(input: Array<TCalendarItem>): Array<TCalendarItem> {
  return input.filter((event) => !event.isAllDay)
}

/**
 * Some events span multiple days, but we only want to show the time for one day in question.
 * Assumes that this list was previously filtered to only include events that are on the day in question.
 * @author @jgclark
 * @param {Array<TCalendarItem>} input - array of calendar items (e.g. for a day)
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

/**
 * Parse an attendee list and return as a simple comma-separate string to display.
 * Object structure appears to be:
 *  {
  "0": "✓ [Jonathan Clark](mailto:jonathan@clarksonline.me.uk)",
  "1": "[James Bond](mailto:007@sis.gov.uk)",
  "2": "x [M](mailto:m@sis.gov.uk)",
  "length": 3
}
 * @author @dwertheimer, @jgclark
 * @param {Map<string, string>} attendees object returned by CalendarList item
 * @param {string?} attendeeType type to return in list 'email' | 'name'
 * @return {string} comma-separated list of parsed attendees
 */
export function attendeesAsString(attendees: Map<string, string>, returnType?: 'email' | 'name' = 'name'): string {
  let attArr = []
  let splitterRE = /\[(.*?)\]\((.*?)\)/

  for(let v of attendees.values()) {
    let result = splitterRE.exec(v)
    if (result && result?.length) {
      if ((returnType === 'email' && result[2]) || (returnType === 'name' && result[1] == '' && result[2])) {
        attArr.push(result[2])
      } else {
        attArr.push(result[1])
      }
    } else {
      attArr.push(v)
    }
  }
  return attArr.join(', ')
}

// @dwertheimer's original version
// export function attendeesAsString(attendees: Array<string>, returnType: 'email' | 'name' = 'name'): string {
//   let attArr = []
//   let splitterRE = /\[(.*?)\]\((.*?)\)/

//   attendees.forEach((att) => {
//     let result = splitterRE.exec(att)
//     if (result && result?.length) {
//       if ((returnType === 'email' && result[2]) || (returnType === 'name' && result[1] == '' && result[2])) {
//         attArr.push(result[2])
//       } else {
//         attArr.push(result[1])
//       }
//     } else {
//       attArr.push(att)
//     }
//   })
//   return attArr.join(', ')
// }
