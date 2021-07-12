// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// v0.2.0, 12.7.2021
// @jgclark
// ------------------------------------------------------------------------------------

import {
  showMessage,
  toLocaleShortTime
} from '../../helperFunctions'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listTodaysEvents(): Promise<Array<string>> {
  // TODO: Work out if there's an issue running this between 11PM and midnight on BST?
  const eA: Array<TCalendarItem> = await Calendar.eventsToday()
  const outputArray: Array<string> = []
  for (const e of eA) {
    let outputLine = `- ${e.title}`
    if (!e.isAllDay) {
      outputLine += ` (${toLocaleShortTime(e.date)})`
    }
    outputArray.push(outputLine)
  }
  console.log(outputArray.join(''))
  return outputArray
}

// Insert list of today's events at cursor positions
export async function insertListTodaysEvents(): Promise<void> {
  if (Editor.note == null) {
    await showMessage('Please run again with a note open.')
    return
  }
  // Get config settings from Template folder _configuration note
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    await showMessage("Couldn't find 'events' settings in _configuration note.")
    return
  }
  // console.log("\tFound 'events' settings in _configuration note.")
  // now get setting we need
  const pref_todaysEventsHeading = (eventsConfig.todaysEventsHeading != null)
    ? eventsConfig.todaysEventsHeading
    : '### Events today'
  console.log(pref_todaysEventsHeading)

  // Get list of events happening today
  const outputArray: Array<string> = await listTodaysEvents()

  await fetch("https://noteplan.co") // TODO: WAIT: remove on next beta!

  outputArray.push((outputArray.length === 0) ? "none\n" : "")
  outputArray.unshift(pref_todaysEventsHeading)
  const output = outputArray.join('\n')
  console.log(output)
  Editor.insertTextAtCursor(output)
}


// Add matching events to today's note, from list in keys of pref_addMatchingEvents.
// Prepend any with value of the values in pref_addMatchingEvents.
export async function addMatchingEvents(): Promise<void> {
  console.log(`\naddMatchingEvents:`)
  // Get config settings from Template folder _configuration note
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    return
  }
  // now get the setting we need
  const pref_addMatchingEvents = eventsConfig.addMatchingEvents ?? null

  if (pref_addMatchingEvents == null) {
    console.log("\nError: empty find 'addMatchingEvents' setting in _configuration note.")
    await showMessage(`Warning: Empty 'addMatchingEvents' setting in _configuration note`)
    return
  }
  // console.log( pref_addMatchingEvents.toString() )
  const textToMatch = Object.keys(pref_addMatchingEvents)
  const textToPrepend = Object.values(pref_addMatchingEvents)
  console.log(`\tFrom settings found ${textToMatch.length} match strings to look for`)
  const eA: Array<TCalendarItem> = await Calendar.eventsToday()
  
  await fetch("https://noteplan.co") // TODO: WAIT: remove on next beta!

  const outputArray: Array<string> = []
  for (const e of eA) {
    for (let i = 0; i < textToMatch.length; i++) {
      const m = textToMatch[i]
      if (e.title.match(m)) {
        // $FlowFixMe -- not sure how to deal with mixed coercing to strings
        let outputLine = `${textToPrepend[i]} ${e.title}`
        if (!e.isAllDay) {
          outputLine += ` (${toLocaleShortTime(e.date)})`
        }
        outputArray.push(outputLine)
      }
    }
  }
  const output = outputArray.join('\n')
  console.log(output)
  Editor.insertTextAtCursor(output)
}

const DEFAULT_EVENTS_OPTIONS = `  events: {
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
