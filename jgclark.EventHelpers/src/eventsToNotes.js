// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated for v0.10.0, 26.12.2021 by @m1well
// @jgclark, with additions by @dwertheimer, @weyert, @m1well
// ------------------------------------------------------------------------------------

import { getTagParamsFromString, stringReplace, } from '../../helpers/general'
import { showMessage } from '../../helpers/userInput'
import { dateStringFromCalendarFilename, toLocaleTime } from '../../helpers/dateTime'

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings
const DEFAULT_EVENTS_OPTIONS = `
  events: {
    calendarToWriteTo: "",  // specify calendar name to write events to. Must be writable calendar. If empty, then the default system calendar will be used.
    addEventID: false,  // whether to add an '⏰event:ID' internal link when creating an event from a time block
    processedTagName: "#event_created",  // optional tag to add after making a time block an event
    confirmEventCreation: false,  // optional tag to indicate whether to ask user to confirm each event to be created
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    eventsHeading: "### Events today",  // optional heading to put before list of today's events
    calendarSet: [],  // optional ["array","of calendar","names"] to filter by when showing list of events. If empty or missing, no filtering will be done.
    addMatchingEvents: {  // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
      "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
      "holiday": "*|TITLE|* *|NOTES|*",
    },
    locale: "en-US",
    timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
    calendarNameMappings: [  // here you can map a calendar name to a new string - e.g. "Thomas" to "Me" with "Thomas;Me"
      "From;To",
    ],
  },
`
// global variables, including default settings
let pref_eventsHeading: string
let pref_addMatchingEvents: ?{ [string]: mixed }
let pref_locale: string
let pref_timeOptions
let pref_calendarSet: Array<string>
let pref_calendarNameMappings: Array<string>

//------------------------------------------------------------------------------
// Local functions

// Get config settings from Template folder _configuration note
async function getEventsSettings(): Promise<void> {
  console.log(`\nStart of getEventsSettings()`)
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
    // no minimum config needed, as can use defaults if need be
  )
  if (eventsConfig == null) {
    console.log(`\tInfo: couldn't find 'events' settings in _configuration note. Will use defaults.`)
  }
  console.log(`\tFound 'events' settings in _configuration note.`)

  // now get settings we need
  pref_eventsHeading = eventsConfig?.eventsHeading != null ? String(eventsConfig?.eventsHeading) : '### Events today'
  // if (
  //   eventsConfig.eventsHeading != null &&
  //   typeof eventsConfig.eventsHeading === 'string'
  // ) {
  //   pref_eventsHeading = eventsConfig.eventsHeading
  // }
  console.log(pref_eventsHeading)
  // $FlowFixMe
  pref_calendarSet = eventsConfig?.calendarSet ?? []
  // console.log(pref_calendarSet)
  // $FlowFixMe
  pref_addMatchingEvents = eventsConfig?.addMatchingEvents ?? null
  // if (eventsConfig?.addMatchingEvents != null) {
  //   // $FlowFixMe
  //   pref_addMatchingEvents = eventsConfig.addMatchingEvents
  // } else {
  //   console.log(
  //     `\tInfo: empty find 'addMatchingEvents' setting in _configuration note.`,
  //   )
  // }
  pref_locale = eventsConfig?.locale != null && eventsConfig?.locale !== '' ? String(eventsConfig?.locale) : 'en-US'
  // if (eventsConfig.locale != null) {
  //   pref_locale = eventsConfig.locale
  // }
  console.log(pref_locale)
  pref_timeOptions = eventsConfig?.timeOptions ?? { hour: '2-digit', minute: '2-digit', hour12: false }
  // if (eventsConfig.timeOptions != null) {
  //   pref_timeOptions = eventsConfig.timeOptions
  // }
  // $FlowFixMe
  pref_calendarNameMappings = eventsConfig?.calendarNameMappings ?? []
  console.log(`\tEnd of getEventsSettings()`)
}

export type HourMinObj = { h: number, m: number }

//------------------------------------------------------------------------------
// Get list of events for the given day (specified as YYYYMMDD)
// Now also filters out any that don't come from one of the calendars specified
// in pref_calendarSet.
export async function getEventsForDay(
  dateStr: string,
  start: HourMinObj = { h: 0, m: 0 },
  end: HourMinObj = { h: 23, m: 59 },
): Promise<Array<TCalendarItem>> {
  const y = parseInt(dateStr.slice(0, 4))
  const m = parseInt(dateStr.slice(4, 6))
  const d = parseInt(dateStr.slice(6, 8))
  const startOfDay = Calendar.dateFrom(y, m, d, start.h, start.m, 0)
  const endOfDay = Calendar.dateFrom(y, m, d, end.h, end.m, 59)
  console.log(`  getEventsForDay: ${startOfDay.toString()} - ${endOfDay.toString()}`)
  let eArr: Array<TCalendarItem> = await Calendar.eventsBetween(startOfDay, endOfDay)
  console.log(`\tgetEventsForDay: Retrieved ${eArr.length} events from NP Calendar store`)

  // If we have a setCalendar list, use to weed out events that don't match .calendar
  if (pref_calendarSet && pref_calendarSet.length > 0) {
    // const filteredEventArray = pref_calendarSet.slice().filter(c => eArr.some(e => e.calendar === c))
    eArr = eArr.filter((e) => pref_calendarSet.some((c) => e.calendar === c))
    console.log(`\t${eArr.length} Events kept after filtering with ${pref_calendarSet.toString()}`)
  }
  return eArr
}

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listDaysEvents(paramString: string = ''): Promise<string> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return ''
  }
  // $FlowIgnore[incompatible-call]
  const dateStr = dateStringFromCalendarFilename(Editor.filename)
  console.log(`\nlistDaysEvents for ${dateStr} with paramString=${String(paramString)}`)

  // Get config settings from Template folder _configuration note
  await getEventsSettings()
  // Work out template for output line (from params, or if blank, a default)
  // NB: be aware that this call doesn't do type checking
  const template = String(await getTagParamsFromString(paramString, 'template', '- *|CAL|*: *|TITLE|* (*|START|*)'))
  const alldayTemplate = String(await getTagParamsFromString(paramString, 'allday_template', '- *|CAL|*: *|TITLE|*'))
  const includeHeadings = await getTagParamsFromString(paramString, 'includeHeadings', true)
  // console.log(`\toutput template: '${template}' and '${alldayTemplate}'`)

  const withCalendarName = template.includes('CAL')

  // Get all the events for this day
  const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr)

  const outputArray: Array<string> = []
  const mapForSorting: { cal: string; start: string, text: string }[] = []
  let lastEventStr = '' // keep duplicates from multiple calendars out

  for (const e of eArr) {
    // console.log(`      for e: ${e.title}: ${JSON.stringify(e)}`)
    const replacements = getReplacements(e)

    // NB: the following will replace any mentions of the keywords in the e.title string itself
    const thisEventStr = stringReplace(e.isAllDay ? alldayTemplate : template, replacements).trimEnd()
    if (lastEventStr !== thisEventStr) {
      outputArray.push(thisEventStr)
      lastEventStr = thisEventStr
    }
    if (withCalendarName) {
      mapForSorting.push({
        cal: calendarNameWithMapping(e.calendar, pref_calendarNameMappings),
        start: toLocaleTime(e.date),
        text: thisEventStr
      })
    }
  }
  if (pref_eventsHeading !== '' && includeHeadings) {
    outputArray.unshift(pref_eventsHeading)
  }

  if (withCalendarName) {
    mapForSorting.sort(sortByCalendarNameAndStartTime())
  }

  let output = outputArray.join('\n')
  if (withCalendarName) {
    output = mapForSorting.map(element => element.text).join('\n')
  }

  return output.replace(/\\s{2,}/g, ' ') // If this the array is empty -> empty string
}

//------------------------------------------------------------------------------
// Insert list of today's events at cursor position
// NB: When this is called by UI as a command, *it doesn't have any params passed with it*.
export async function insertDaysEvents(paramString: ?string): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }
  console.log(`\ninsertDaysEvents:`)

  // Get list of events happening on the day of the open note
  let output: string = await listDaysEvents(paramString || '')
  output += output.length === 0 ? '\nnone\n' : '\n'
  Editor.insertTextAtCursor(output)
}

//------------------------------------------------------------------------------
// Return string list of matching events in the current day's note, from list
// in keys of pref_addMatchingEvents. Apply template before returning.
export async function listMatchingDaysEvents(
  /*eslint-disable */
  paramString: ?string, // NB: the parameter isn't currently used, but is provided for future expansion.
  /*eslint-enable */
): Promise<string> {
  // $FlowIgnore[incompatible-call]
  const dateStr = dateStringFromCalendarFilename(Editor.filename)
  console.log(`\nlistMatchingDaysEvents for date ${dateStr}:`)

  // Get config settings from Template folder _configuration note
  await getEventsSettings()
  if (pref_addMatchingEvents == null) {
    await showMessage(`Error: Empty 'addMatchingEvents' setting in _configuration note. Stopping`)
    return `(Error: found no 'addMatchingEvents' settings in _configuration note.)`
  }
  const textToMatchA = Object.keys(pref_addMatchingEvents)
  const templateArr = Object.values(pref_addMatchingEvents)
  console.log(`\tFrom settings found ${textToMatchA.length} match strings to look for`)

  // Get all events for this day
  const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr)

  const outputArray: Array<string> = []
  // for each event, check each of the strings we want to match
  let lastEventStr = '' // keep duplicates from multiple calendars out
  for (const e of eArr) {
    for (let i = 0; i < textToMatchA.length; i++) {
      // const m = textToMatchA[i]
      const template = templateArr[i]
      const reMatch = new RegExp(textToMatchA[i], 'i')
      if (e.title.match(reMatch)) {
        console.log(`\tFound match to event '${e.title}'`)
        const replacements = getReplacements(e)
        // $FlowFixMe -- not sure how to deal with mixed coercing to strings
        const thisEventStr = stringReplace(template, replacements)
        if (lastEventStr !== thisEventStr) {
          outputArray.push(thisEventStr)
          lastEventStr = thisEventStr
        }
      } else {
        // console.log(`No match to ${e.title}`)
      }
    }
  }
  const output = outputArray.join('\n').replace(/\\s{2,}/g, ' ') // If this array is empty -> empty string.
  // console.log(output)
  return output
}

//------------------------------------------------------------------------------
// Insert list of matching events in the current day's note, from list
// in keys of pref_addMatchingEvents. Apply template too.
export async function insertMatchingDaysEvents(paramString: ?string): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }
  console.log(`\ninsertMatchingDaysEvents:`)

  const output = await listMatchingDaysEvents(paramString || '')
  Editor.insertTextAtCursor(output)
}

//------------------------------------------------------------------------------
/**
 * @private
 * @author @m1well
 */
const getReplacements = (item: TCalendarItem): { key: string, value: string }[] => {
  return [
    {
      key: '*|CAL|*',
      value: calendarNameWithMapping(item.calendar, pref_calendarNameMappings)
    },
    { key: '*|TITLE|*', value: item.title },
    {
      key: '*|START|*',
      value: !item.isAllDay
        ? // $FlowFixMe
        toLocaleTime(item.date, pref_locale, pref_timeOptions)
        : '',
    },
    {
      key: '*|END|*',
      value:
        item.endDate != null && !item.isAllDay
          ? // $FlowFixMe
          toLocaleTime(item.endDate, pref_locale, pref_timeOptions)
          : '',
    },
    { key: '*|NOTES|*', value: item.notes },
    { key: '*|URL|*', value: item.url },
  ]
}

/**
 * @private
 * @author @m1well
 */
const calendarNameWithMapping = (name: string, mappings: Array<string>): string => {
  let mapped = name
  mappings.forEach(mapping => {
    const splitted = mapping.split(';')
    if (splitted.length === 2 && name === splitted[0]) {
      mapped = splitted[1]
    }
  })
  return mapped
}

/**
 * @private
 * @author @m1well
 */
const sortByCalendarNameAndStartTime = (): Function => {
  return (b, a) => {
    if (a.cal !== b.cal) {
      if (a.cal > b.cal) {
        return -1
      }
      if (b.cal > a.cal) {
        return 1
      }
    } else {
      if (a.start > b.start) {
        return -1
      }
      if (b.start > a.start) {
        return 1
      }
      return 0
    }
    return 0
  }
}
