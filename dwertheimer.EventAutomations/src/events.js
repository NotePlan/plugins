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
  // KNOWN BUG - getEventsForDay() returns `Array<TCalendarItem> | null` (it returns null from its catch), and the
  // line above already hedges with `allDaysEvents?.length`, but this dereferences it unguarded. If fetching today's
  // events throws, this line throws "cannot read property 'map' of null" instead of reporting the failure.
  // $FlowIgnore[incompatible-use]
  const selections = allDaysEvents.map((event) => {
    // casts: TCalendarItem.date is `Date | null` because reminders may have no due date, but getEventsForDay()
    // returns events, which always carry one (same reasoning/precedent as NPEventBlocks.js:272).
    const time = toLocaleTime((event.date: any), [], { hour: '2-digit', minute: '2-digit', hour12: false })
    if (event.title) return { label: `${time}: ${event.title}`, value: event.title, time, date: (event.date: any).toLocaleDateString() }
  })
  // KNOWN BUG - the map callback above has no else branch, so any event with an empty title yields `undefined` in
  // `selections`. chooseOption() does `options.map((o) => (typeof o === 'string' ? o : o.label))`, which throws on
  // an undefined element. Also fails because Option<T> is the exact `{ label, value }` while these rows carry extra
  // `time`/`date` payload; that half would clear if helpers/userInput.js declared Option inexact (`{ ..., ... }`).
  // $FlowIgnore
  const selectedEvent = await chooseOption('Choose an event to create a note for', selections, '')
  // Override the quickTemplateNote title with the selected event
  // KNOWN BUG - same undefined elements as above: `.find()` reads `.value` off a possibly-undefined row.
  // $FlowIgnore[incompatible-use]
  const selEvent = selections.find((event) => event.value === selectedEvent)
  // const theTime = selEvent.time === '00:00' ? '' : selEvent.time
  logDebug(pluginJson, `Selected event: ${selectedEvent} ${String(JSON.stringify(selEvent))}`)
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
