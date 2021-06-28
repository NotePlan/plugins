// @flow

// import { getInput } from '../../nmn.sweep/src/userInput'
// import { parseJSON5 } from './configuration'

// eslint-disable-next-line no-unused-vars
const pref_defaultCalendarName = 'Jonathan (iCloud)'
// eslint-disable-next-line no-unused-vars
const pref_processedTagName = '#event_created'

function toShortDateTimeString(d: Date) {
  return d.toISOString().slice(0, 16)
}

// eslint-disable-next-line no-unused-vars
function toISODateString(d: Date) {
  return d.toISOString()
}

function printDateRange(dateRange: DateRange) {
  const dr = dateRange
  console.log(
    `  ${toShortDateTimeString(dr.start)} - ${toShortDateTimeString(dr.end)}`,
  )
}

// Go through current Editor note and identify timeblocks to turn into events
export default function timeblocksToCalendar() {
  const { paragraphs } = Editor
  if (paragraphs == null) {
    console.log('timeblocksToCalendar: warning: no content found')
  }

  // See https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking
  // for definition of time blocks

  // Testing finding timeblock in text string:
  // - The following won't work as hoped:
  // printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM"))
  // - The following *do* work as hoped:
  // printDateRange(Calendar.parseDateText("at 2PM-3PM"))
  // printDateRange(Calendar.parseDateText("2021-06-02 at 2-3"))
  // printDateRange(Calendar.parseDateText("2021-06-02 at 2am-3PM"))
  // printDateRange(Calendar.parseDateText("2021-06-02 at 2am-3AM"))
  // printDateRange(Calendar.parseDateText("2021-06-02 2:15-3:45"))
  // printDateRange(Calendar.parseDateText("2021-06-02 16:00-16:45"))
  // printDateRange(Calendar.parseDateText("16:00-16:45"))

  // Use '16:00-16:45' as test timeblock for today's date
  const timeblockString = '21:00-21:45'
  // NB: parseDateText returns an array, so we'll use the first one
  const timeblockDateRange = Calendar.parseDateText(timeblockString)[0]
  console.log('About to create new Event for:')
  printDateRange(timeblockDateRange) // FIXME: UNDEFINED
  // const timeblockDateRange = timeblockDateRanges[0]
  createEventFromDateRange('test title', timeblockDateRange)
  console.log('Finished creating new Event')
}

function createEventFromDateRange(eventTitle: string, dateRange: DateRange) {
  console.log(`  Starting cEFDR with ${eventTitle}`)
  // CalendarItem.create(title, date, endDate, type, isAllDay)
  const event = CalendarItem.create(
    eventTitle,
    dateRange.start,
    dateRange.end,
    'event',
    false,
  )
  const createdEvent = Calendar.add(event)
  if (createdEvent != null) {
    console.log(`Event created with id: ${createdEvent.id ?? 'undefined'}`)
  } else {
    console.log('Failed to create event')
  }
}
