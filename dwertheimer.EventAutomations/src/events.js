// @flow
import { add } from 'date-fns'
import { getEventsForDay, type HourMinObj } from '../../jgclark.EventHelpers/src/eventsToNotes'
import { getTodaysDateUnhyphenated, toLocaleShortTime } from '../../helpers/dateTime'
import { chooseOption } from '../../helpers/userInput'
import { quickTemplateNote } from '../../nmn.Templates/src/index'

function getTimeOffset(offset: HourMinObj = { h: 0, m: 0 }) {
  const now = new Date()
  let min = now.getMinutes() + offset.m
  let hrCorrect = 0
  if (min < 0) {
    min = 60 + min
    hrCorrect = -1
  }
  let hr = now.getHours() + offset.h + hrCorrect
  if (hr < 0) hr = 0
  if (hr > 23) hr = 23
  // console.log(`${hr}:${min}`)
  return { h: hr, m: min }
}

export async function createNoteForCalendarItemWithQuickTemplate(): Promise<void> {
  createNoteForCalendarItem(true)
}

export async function createNoteForCalendarItemWithoutQuickTemplate(): Promise<void> {
  createNoteForCalendarItem(false)
}

export async function createNoteForCalendarItem(useQuickTemplate: boolean = true): Promise<void> {
  const message = 'Hello World from Events!'
  const date = getTodaysDateUnhyphenated()
  console.log(`Creating note for today's date: ${date}`)
  const allDaysEvents = await getEventsForDay(date)
  console.log(`Found ${allDaysEvents.length} events for today`)
  const nowIshEvents = await getEventsForDay(date, getTimeOffset({ h: -1, m: 0 }), getTimeOffset({ h: +1, m: 0 }))
  console.log(`Found ${nowIshEvents.length} events for nowIsh`)
  let events = allDaysEvents
  if (nowIshEvents.length > 0) {
    events = [...nowIshEvents, ...[{ title: '---' }], ...allDaysEvents]
  }
  const selections = allDaysEvents.map((event, i) => {
    const time = toLocaleShortTime(event.date, [], { hour: '2-digit', minute: '2-digit', hour12: false })
    if (event.title) return { label: `${time}: ${event.title}`, value: event.title }
  })
  const selectedEvent = await chooseOption('Choose an event to create a note for', selections, null)
  console.log(`Selected event: ${selectedEvent}`)
  // Override the quickTemplateNote title with the selected event
  if (useQuickTemplate) quickTemplateNote(`${selectedEvent}`)
}

function printEventsToConsole(events: Array<Object>): void {
  events.forEach((event) => {
    //  ${event.notes} ${event.url}
    console.log(`${event.title} ${event.date} ${event.endDate} ${event.isAllDay}`)
  })
}
