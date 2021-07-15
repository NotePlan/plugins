// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// v0.2.1, 13.7.2021
// @jgclark
// ------------------------------------------------------------------------------------

import { showMessage, toLocaleShortTime } from '../../helperFunctions'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listTodaysEvents(): Promise<string> {
  // TODO: Work out if there's an issue running this between 11PM and midnight on BST?
  // Get config settings from Template folder _configuration note
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    await showMessage("Couldn't find 'events' settings in _configuration note.")
    return ''
  }
  // console.log("\tFound 'events' settings in _configuration note.")
  // now get setting we need
  const pref_todaysEventsHeading: string =
    eventsConfig.todaysEventsHeading != null &&
    typeof eventsConfig.todaysEventsHeading === 'string'
      ? eventsConfig.todaysEventsHeading
      : '### Events today'
  // console.log(pref_todaysEventsHeading)

  const eA: Array<TCalendarItem> = await Calendar.eventsToday()
  const outputArray: Array<string> = []
  for (const e of eA) {
    let outputLine = `- ${e.title}`
    if (!e.isAllDay) {
      outputLine += ` (${toLocaleShortTime(e.date)})`
    }
    outputArray.push(outputLine)
  }
  if (pref_todaysEventsHeading !== '') {
    outputArray.unshift(pref_todaysEventsHeading)
  }
  const output = outputArray.join('\n')
  console.log(output)
  return output
}

// Insert list of today's events at cursor positions
export async function insertListTodaysEvents(): Promise<void> {
  if (Editor.note == null) {
    await showMessage('Please run again with a note open.')
    return
  }

  // Get list of events happening today
  let output: string = await listTodaysEvents()
  await fetch('https://noteplan.co') // TODO: WAIT: remove on next beta!
  output += output.length === 0 ? '\nnone\n' : '\n'
  Editor.insertTextAtCursor(output)
}

// Return string list of matching events in today's note, from list in keys of
// pref_addMatchingEvents.
// Prepend any with value of the values in pref_addMatchingEvents.
export async function listMatchingTodaysEvents(): Promise<string> {
  console.log(`\nalistMatchingTodaysEvents:`)
  // Get config settings from Template folder _configuration note
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    return ''
  }
  // now get the setting we need

  const pref_addMatchingEvents: ?{ [string]: mixed } =
    (eventsConfig.addMatchingEvents: $FlowFixMe) ?? null

  if (pref_addMatchingEvents == null) {
    console.log(
      "\nError: empty find 'addMatchingEvents' setting in _configuration note.",
    )
    await showMessage(
      `Warning: Empty 'addMatchingEvents' setting in _configuration note`,
    )
    return ''
  }

  const textToMatch = Object.keys(pref_addMatchingEvents)
  const textToPrepend = Object.values(pref_addMatchingEvents)
  console.log(
    `\tFrom settings found ${textToMatch.length} match strings to look for`,
  )
  const eA: Array<TCalendarItem> = await Calendar.eventsToday()

  await fetch('https://noteplan.co') // TODO: WAIT: remove on next beta!

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

// Add matching events to today's note.
export async function insertMatchingTodaysEvents(): Promise<void> {
  console.log(`\ninsertMatchingTodaysEvents:`)
  // Get config settings from Template folder _configuration note
  const output = await listMatchingTodaysEvents()
  Editor.insertTextAtCursor(output)
}

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
