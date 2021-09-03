// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// v0.3.8, 23.8.2021
// @jgclark, with additions by @dwertheimer, @weyert
// ------------------------------------------------------------------------------------

import {
  stringReplace,
  getTagParams,
  // getTagParamsFromString,
} from '../../helpers/general'
import {
  showMessage,
} from '../../helpers/userInput'
import {
  toLocaleShortTime,
  dateStringFromCalendarFilename,
} from '../../helpers/dateTime'


import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings
const DEFAULT_EVENTS_OPTIONS = `  events: {
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    eventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "meeting": "### *|TITLE|* (*|START|*)\n*|NOTES|*",
      "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
      "holiday": "*|TITLE|* *|NOTES|*",
    },
    locale: "en-US",
	  timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false }
  },
`
// global variables, including default settings
let pref_eventsHeading: string = '### Events today'
let pref_addMatchingEvents: ?{ [string]: mixed } = null
let pref_locale: string = 'en-US'
let pref_timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false }

//------------------------------------------------------------------------------
// Get config settings from Template folder _configuration note
async function getEventsSettings(): Promise<void> {
  console.log(`\nStart of getEventsSettings()`)
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
    // not including a minimum required configuration list
  )
  if (eventsConfig == null) {
    console.log(`\tCouldn't find 'events' settings in _configuration note.`)
    await showMessage(`Couldn't find 'events' settings in _configuration note.`)
    return
  }
  console.log(`\tFound 'events' settings in _configuration note.`)

  // now get settings we need
  if (
    eventsConfig.todaysEventsHeading != null &&
    typeof eventsConfig.todaysEventsHeading === 'string'
  ) {
    pref_eventsHeading = eventsConfig.todaysEventsHeading
  }
  // console.log(pref_eventsHeading)
  if (eventsConfig.addMatchingEvents != null) {
    // $FlowFixMe
    pref_addMatchingEvents = eventsConfig.addMatchingEvents
  } else {
    console.log(
      `\tError: empty find 'addMatchingEvents' setting in _configuration note.`,
    )
  }
  if (eventsConfig.locale != null) {
    // $FlowFixMe
    pref_locale = eventsConfig.locale
  }
  if (eventsConfig.timeOptions != null) {
    pref_timeOptions = eventsConfig.timeOptions
  }
  console.log(`\tEnd of getEventsSettings()`)
}

async function getEventsForDay(dateStr: string): Promise<Array<TCalendarItem>> {
  const y = parseInt(dateStr.slice(0, 4))
  const m = parseInt(dateStr.slice(4, 6))
  const d = parseInt(dateStr.slice(6, 8))
  const startOfDay = Calendar.dateFrom(y, m, d, 0, 0, 0)
  const endOfDay = Calendar.dateFrom(y, m, d, 23, 59, 59)
  console.log(`  ${startOfDay.toString()} - ${endOfDay.toString()}`)
  const eA: Array<TCalendarItem> = await Calendar.eventsBetween(
    startOfDay,
    endOfDay,
  )
  console.log(`\tFound ${eA.length} events`)
  return eA
}

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listDaysEvents(paramString?: string): Promise<string> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return ''
  }
  // $FlowIgnore[incompatible-call]
  const dateStr = dateStringFromCalendarFilename(Editor.filename)
  console.log(
    `\nlistDaysEvents for ${dateStr} with paramString=${String(paramString)}`,
  )

  // Get config settings from Template folder _configuration note
  await getEventsSettings()
  // Work out template for output line (from params, or if blank, a default)
  const template =
    paramString != null && paramString !== ''
      ? getTagParams(paramString, 'template')
      : '- *|TITLE|* (*|START|*)'
  const allday =
    paramString != null && paramString !== ''
      ? getTagParams(paramString, 'allday_template')
      : '- *|TITLE|*'
  const includeHeadings =
    paramString != null && paramString !== ''
      ? getTagParams(paramString, 'includeHeadings')
      : true
  console.log(`\toutput template: '${template}' and '${allday}'`)

  // Get all the events for this day
  const eA: Array<TCalendarItem> = await getEventsForDay(dateStr)

  const outputArray: Array<string> = []
  let lastEventStr = '' // keep duplicates from multiple calendars out
  for (const e of eA) {
    // console.log(`      for e: ${e.title}: ${JSON.stringify(e)}`)
    const replacements = [
      { key: '*|TITLE|*', value: e.title },
      {
        key: '*|START|*',
        value: !e.isAllDay
          // $FlowFixMe
          ? toLocaleShortTime(e.date, pref_locale, pref_timeOptions)
          : '',
      },
      {
        key: '*|END|*',
        value:
          e.endDate != null && !e.isAllDay
            // $FlowFixMe
            ? toLocaleShortTime(e.endDate, pref_locale, pref_timeOptions)
            : '',
      },
      { key: '*|NOTES|*', value: e.notes },
      { key: '*|URL|*', value: e.url },
    ]
    // NB: the following will replace any mentions of the keywords in the e.title string itself
    const thisEventStr = stringReplace(
      e.isAllDay ? allday : template,
      replacements
    ).trimEnd()
    if (lastEventStr !== thisEventStr) {
      outputArray.push(thisEventStr)
      lastEventStr = thisEventStr
    }
  }
  if (pref_eventsHeading !== '' && includeHeadings) {
    outputArray.unshift(pref_eventsHeading)
  }
  const output = outputArray.join('\n') // If this the array is empty -> empty string
  console.log(output)
  return output
}

//------------------------------------------------------------------------------
// Insert list of today's events at cursor position
// This is called by UI.
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
    await showMessage(
      `Error: Empty 'addMatchingEvents' setting in _configuration note. Stopping`,
    )
    return `(Error: found no 'addMatchingEvents' settings in _configuration note.)`
  }
  const textToMatchA = Object.keys(pref_addMatchingEvents)
  const templateA = Object.values(pref_addMatchingEvents)
  console.log(
    `\tFrom settings found ${textToMatchA.length} match strings to look for`,
  )

  // Get all events for this day
  const eA: Array<TCalendarItem> = await getEventsForDay(dateStr)

  const outputArray: Array<string> = []
  // for each event, check each of the strings we want to match
  let lastEventStr = '' // keep duplicates from multiple calendars out
  for (const e of eA) {
    for (let i = 0; i < textToMatchA.length; i++) {
      // const m = textToMatchA[i]
      const template = templateA[i]
      const reMatch = new RegExp(textToMatchA[i], "i")
      if (e.title.match(reMatch)) {
        console.log(`\tFound match to event '${e.title}'`)
        const replacements = [
          { key: '*|TITLE|*', value: e.title },
          {
            key: '*|START|*',
            value: !e.isAllDay
              // $FlowFixMe
              ? toLocaleShortTime(e.date, pref_locale, pref_timeOptions)
              : ''
          },
          {
            key: '*|END|*',
            value: e.endDate != null && !e.isAllDay
              // $FlowFixMe
              ? toLocaleShortTime(e.endDate, pref_locale, pref_timeOptions)
              : ''
          },
          { key: '*|NOTES|*', value: e.notes },
          { key: '*|URL|*', value: e.url },
        ]
        // $FlowFixMe -- not sure how to deal with mixed coercing to strings
        const thisEventStr = stringReplace(template, replacements)
        if (lastEventStr !== thisEventStr) {
          outputArray.push(thisEventStr)
          lastEventStr = thisEventStr
        }
      } else {
        console.log(`No match to ${e.title}`)
      }
    }
  }
  const output = outputArray.join('\n') // If this the array is empty -> empty string
  console.log(output)
  return output
}

//------------------------------------------------------------------------------
// Insert list of matching events in the current day's note, from list
// in keys of pref_addMatchingEvents. Apply template too.
export async function insertMatchingDaysEvents(
  paramString: ?string,
): Promise<void> {
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage('Please run again with a calendar note open.')
    return
  }
  console.log(`\ninsertMatchingDaysEvents:`)

  // Get config settings from Template folder _configuration note
  const output = await listMatchingDaysEvents(paramString || '')
  Editor.insertTextAtCursor(output)
}
