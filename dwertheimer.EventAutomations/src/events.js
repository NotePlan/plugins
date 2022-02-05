// @flow
import { add } from 'date-fns'
import { getEventsForDay } from '../../helpers/NPCalendar'
import { getTodaysDateUnhyphenated, type HourMinObj, toLocaleTime } from '../../helpers/dateTime'
import { chooseOption, chooseFolder } from '../../helpers/userInput'
import { quickTemplateNote, newNoteWithTemplate } from '../../nmn.Templates/src/index'

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
  const date = getTodaysDateUnhyphenated()
  console.log(`Creating note for today's date: ${date}`)
  const allDaysEvents = await getEventsForDay(date)
  console.log(`Found ${allDaysEvents.length} events for today`)
  const nowIshEvents = await getEventsForDay(date, [], getTimeOffset({ h: -1, m: 0 }), getTimeOffset({ h: +1, m: 0 })) // second param now implies consider all calendars
  console.log(`Found ${nowIshEvents.length} events for nowIsh`)
  let events = allDaysEvents
  if (nowIshEvents.length > 0) {
    events = [...nowIshEvents, ...[{ title: '---' }], ...allDaysEvents]
  }
  // $FlowIgnore
  const selections = allDaysEvents.map((event, i) => {
    // $FlowIgnore
    const time = toLocaleTime(event.date, [], { hour: '2-digit', minute: '2-digit', hour12: false })
    // $FlowIgnore
    if (event.title)
      return { label: `${time}: ${event.title}`, value: event.title, time, date: event.date.toLocaleDateString() }
  })
  // $FlowIgnore
  const selectedEvent = await chooseOption('Choose an event to create a note for', selections, '')
  // Override the quickTemplateNote title with the selected event
  // $FlowIgnore
  const selEvent = selections.find((event) => event.value === selectedEvent)
  // $FlowIgnore
  const theTime = selEvent.time === '00:00' ? '' : selEvent.time
  console.log(`Selected event: ${selectedEvent} ${String(JSON.stringify(selEvent))}`)
  // $FlowIgnore
  const theTitle = `${selectedEvent} {{date8601()}} ${theTime || ''}`
  if (selectedEvent && useQuickTemplate) {
    await quickTemplateNote(theTitle)
    return
  }
  const useTemplate = await chooseOption(
    'Use a template?',
    [
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
    ],
    'Yes',
  )
  if (useTemplate !== 'No') {
    await newNoteWithTemplate('', theTitle)
  } else {
    const folder = await chooseFolder('What folder should the note be in?')
    if (selEvent) {
      const title = `${selEvent.value} ${selEvent.date} ${
        selEvent.time && selEvent.time !== '00:00' ? selEvent.time : ''
      }`
      const fname = (await DataStore.newNote(title, folder)) ?? ''
      console.log(`Creating note with title: ${title}, fname=${fname}`)
      if (fname) {
        await Editor.openNoteByFilename(fname, false)
      }
    }
  }
}

function printEventsToConsole(events: Array<Object>): void {
  events.forEach((event) => {
    //  ${event.notes} ${event.url}
    console.log(`${event.title} ${event.date} ${event.endDate} ${event.isAllDay}`)
  })
}
