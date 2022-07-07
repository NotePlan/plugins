/* eslint-disable */
/*
 * CalendarItem mock class
 *
 * Usage: const myCalendarItem = new CalendarItem({ param changes here })
 *
 */

export class CalendarItem {
  // Properties
  attendeeNames = [] /* sample:  [Storey Wertheimer Wertheimer ] */
  attendees = [] /* sample:  [[Storey Wertheimer Wertheimer](mailto:storey@wertheimer.com) ] */
  availability = 'PLACEHOLDER' // TODO: add value
  calendar = 'PLACEHOLDER' // TODO: add value
  calendarItemLink = 'PLACEHOLDER' // TODO: add value
  date = {} /* new Date("Sun May 22 2022 00:00:00 GMT-0700 (PDT)"),  */
  endDate = {} /* new Date("Mon Jun 20 2022 00:00:00 GMT-0700 (PDT)"),  */
  id = 'PLACEHOLDER' // TODO: add value
  isAllDay = 'PLACEHOLDER' // TODO: add value
  isCalendarWritable = 'PLACEHOLDER' // TODO: add value
  isCompleted = 'PLACEHOLDER' // TODO: add value
  isRecurring = 'PLACEHOLDER' // TODO: add value
  location = 'PLACEHOLDER' // TODO: add value
  notes = 'PLACEHOLDER' // TODO: add value
  occurences = [] /* sample:  [Sun May 22 2022 00:00:00 GMT-0700 (PDT) ] */
  title = 'PLACEHOLDER' // TODO: add value
  type = 'PLACEHOLDER' // TODO: add value
  url = 'PLACEHOLDER' // TODO: add value

  // Methods

  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
