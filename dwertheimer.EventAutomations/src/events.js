// @flow
import { getEventsForDay } from '../../helpers/NPCalendar'
import { getTodaysDateUnhyphenated, type HourMinObj, toLocaleTime } from '../../helpers/dateTime'
import { chooseOption, chooseFolder } from '../../helpers/userInput'
import pluginJson from '../plugin.json'
import { logDebug } from '@helpers/dev'

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
  // logDebug(pluginJson,`${hr}:${min}`)
  return { h: hr, m: min }
}

export async function createNoteForCalendarItemWithQuickTemplate(): Promise<void> {
  await createNoteForCalendarItem(true)
}

export async function createNoteForCalendarItemWithoutQuickTemplate(): Promise<void> {
  await createNoteForCalendarItem(false)
}

export async function createNoteForCalendarItem(useQuickTemplate: boolean = true): Promise<void> {
  const date = getTodaysDateUnhyphenated()
  logDebug(pluginJson, `Creating note for today's date: ${date}`)
  const allDaysEvents = await getEventsForDay(date)
  logDebug(pluginJson, `Found ${allDaysEvents?.length || 0} events for today`)
  const nowIshEvents = await getEventsForDay(date, [], getTimeOffset({ h: -1, m: 0 }), getTimeOffset({ h: +1, m: 0 })) // second param now implies consider all calendars
  logDebug(pluginJson, `Found ${nowIshEvents?.length || 0} events for nowIsh`)
  // const events = allDaysEvents
  if (nowIshEvents && nowIshEvents.length > 0) {
    // events = [...nowIshEvents, ...[{ title: '---' }], ...allDaysEvents]
  }
  // $FlowIgnore
  const selections = allDaysEvents.map((event) => {
    // $FlowIgnore
    const time = toLocaleTime(event.date, [], { hour: '2-digit', minute: '2-digit', hour12: false })
    // $FlowIgnore
    if (event.title) return { label: `${time}: ${event.title}`, value: event.title, time, date: event.date.toLocaleDateString() }
  })
  // $FlowIgnore
  const selectedEvent = await chooseOption('Choose an event to create a note for', selections, '')
  // Override the quickTemplateNote title with the selected event
  // $FlowIgnore
  const selEvent = selections.find((event) => event.value === selectedEvent)
  // $FlowIgnore
  // const theTime = selEvent.time === '00:00' ? '' : selEvent.time
  logDebug(pluginJson, `Selected event: ${selectedEvent} ${String(JSON.stringify(selEvent))}`)
  // $FlowIgnore
  // const theTitle = `${selectedEvent} {{date8601()}} ${theTime || ''}`
  if (selectedEvent && useQuickTemplate) {
    // quickTemplateNote is not defined!
    // await quickTemplateNote(theTitle)
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
    // newNoteWithTemplate is not defined!
    // await newNoteWithTemplate('', theTitle)
  } else {
    const folder = await chooseFolder('What folder should the note be in?')
    if (selEvent) {
      const title = `${selEvent.value} ${selEvent.date} ${selEvent.time && selEvent.time !== '00:00' ? selEvent.time : ''}`
      const fname = (await DataStore.newNote(title, folder)) ?? ''
      logDebug(pluginJson, `Creating note with title: ${title}, fname=${fname}`)
      if (fname) {
        await Editor.openNoteByFilename(fname, false)
      }
    }
  }
}

// function printEventsToConsole(events: Array<Object>): void {
//   events.forEach((event) => {
//     //  ${event.notes} ${event.url}
//     logDebug(pluginJson,`${event.title} ${event.date} ${event.endDate} ${event.isAllDay}`)
//   })
// }
