// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// v0.2.3, 28.7.2021
// @jgclark
// ------------------------------------------------------------------------------------

import {
  showMessage,
  toLocaleShortTime,
  stringReplace,
  getTagParams,
} from '../../helperFunctions'
import {
  getOrMakeConfigurationSection,
  // parseJSON5
} from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings
const DEFAULT_EVENTS_OPTIONS = `  events: {
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    todaysEventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and add this into daily note prepending by string on the right (which can be empty)
      "#meeting": "### ",
      "#webinar": "### ",
      "#holiday": "",
    },
  },
`

let pref_todaysEventsHeading: string = '### Events today'
let pref_addMatchingEvents: ?{ [string]: mixed } = null

//------------------------------------------------------------------------------
// Get config settings from Template folder _configuration note
async function getSettings(): Promise<void> {
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
  )
  // const eventsConfig: any = config?.events ?? null
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
    pref_todaysEventsHeading = eventsConfig.todaysEventsHeading
  }
  // console.log(pref_todaysEventsHeading)
  if (eventsConfig.addMatchingEvents != null) {
    // $FlowFixMe
    pref_addMatchingEvents = eventsConfig.addMatchingEvents
  } else {
    console.log(
      `\nError: empty find 'addMatchingEvents' setting in _configuration note.`,
    )
  }
}

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listTodaysEvents(paramString: string): Promise<string> {
  console.log(`\nlistTodaysEvents:`)

  // Get config settings from Template folder _configuration note
  await getSettings()
  // Work out template for output line (from params, or if blank, a default)
  const template =
    paramString !== ''
      ? getTagParams(paramString, 'template')
      : '- TITLE (START)'
  console.log(`\toutput template: '${template}'`)

  const eA: Array<TCalendarItem> = await Calendar.eventsToday()
  const outputArray: Array<string> = []

  let lastEventStr = '' // keep duplicates from multiple calendars out
  for (const e of eA) {
    const replacements = [
      { key: 'TITLE', value: e.title },
      { key: 'START', value: !e.isAllDay ? toLocaleShortTime(e.date) : '' },
      {
        key: 'END',
        value: e.endDate != null ? toLocaleShortTime(e.endDate) : '',
      },
    ]
    const thisEventStr = stringReplace(template, replacements)
    if (lastEventStr !== thisEventStr) {
      outputArray.push(thisEventStr)
      lastEventStr = thisEventStr
    }
  }
  if (pref_todaysEventsHeading !== '') {
    outputArray.unshift(pref_todaysEventsHeading)
  }
  const output = outputArray.join('\n')
  console.log(output)
  return output
}

//------------------------------------------------------------------------------
// Insert list of today's events at cursor positions
// This is called by UI.
export async function insertListTodaysEvents(params: ?string): Promise<void> {
  if (Editor.note == null) {
    await showMessage('Please run again with a note open.')
    return
  }

  // Get list of events happening today
  let output: string = await listTodaysEvents(params)
  output += output.length === 0 ? '\nnone\n' : '\n'
  Editor.insertTextAtCursor(output)
}

//------------------------------------------------------------------------------
// Return string list of matching events in today's note, from list in keys of
// pref_addMatchingEvents.
// Prepend any with value of the values in pref_addMatchingEvents.
// NB: the parameter isn't currently used, but is provided for future expansion.
export async function listMatchingTodaysEvents(
  params: string,
): Promise<string> {
  console.log(`\nalistMatchingTodaysEvents:`)
  // Get config settings from Template folder _configuration note
  await getSettings()
  if (pref_addMatchingEvents == null) {
    await showMessage(
      `Error: Empty 'addMatchingEvents' setting in _configuration note. Stopping`,
    )
    return `(Error: found no 'addMatchingEvents' settings in _configuration note.)`
  }

  const textToMatch = Object.keys(pref_addMatchingEvents)
  const textToPrepend = Object.values(pref_addMatchingEvents)
  console.log(
    `\tFrom settings found ${textToMatch.length} match strings to look for`,
  )
  const eA: Array<TCalendarItem> = await Calendar.eventsToday()

  const outputArray: Array<string> = []
  for (const e of eA) {
    for (let i = 0; i < textToMatch.length; i++) {
      const m = textToMatch[i]
      if (e.title.match(m)) {
        // $FlowFixMe -- not sure how to deal with mixed coercing to strings
        let outputLine = `${textToPrepend[i]}${e.title}`
        if (!e.isAllDay) {
          outputLine += ` (${toLocaleShortTime(e.date)})`
        }
        outputArray.push(outputLine)
      }
    }
  }
  const output = outputArray.join('\n')
  console.log(output)
  return output
}

//------------------------------------------------------------------------------
// Add matching events to today's note.
// This is called by UI.
export async function insertMatchingTodaysEvents(): Promise<void> {
  console.log(`\ninsertMatchingTodaysEvents:`)
  // Get config settings from Template folder _configuration note
  const output = await listMatchingTodaysEvents('')
  Editor.insertTextAtCursor(output)
}
