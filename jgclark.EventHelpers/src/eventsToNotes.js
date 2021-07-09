// @flow
// ------------------------------------------------------------------------------------
// Command to bring calendar events into notes
// @jgclark
// ------------------------------------------------------------------------------------

import {
  toISOShortTimeString,
  showMessage
} from '../../helperFunctions'

// Preferences for this command
const pref_todaysEventsHeading = '### Events today'
const pref_createNoteSections =
  { "#meeting": "#meeting Notes",
  "#webinar": "#webinar Notes", }

//------------------------------------------------------------------------------
// Return MD list of today's events
export async function listTodaysEvents(): Promise<Array<string>> {
  // return ['oops']
  const eA: Array<TCalendarItem> = await Calendar.eventsToday()
  await showMessage(`got eventsToday -> ${eA.length}`)
  const outputArray: Array<string> = []
  for (const e of eA) {
    let outputLine = `- ${e.title}`
    if (e.date != null) {
      outputLine += ` (${toISOShortTimeString(e.date)})`
    }
    outputArray.push(outputLine)
  }
  console.log(outputArray.join('\n'))
  return outputArray
}

export async function insertTodaysEvents(): Promise<void> {
  const outputArray: Array<string> = await listTodaysEvents()
  outputArray.unshift(pref_todaysEventsHeading)
  outputArray.push('')
  if (Editor.note == null) {
    console.log(`insertTodaysEvents: Warning: editor not open. Stopping.`)
    await showMessage(`Please run again with a note open.`)
  }

  Editor.insertTextAtCursor(outputArray.join('\n'))
}

// Add sections to today's note from matching events
export async function makeSectionFromEvent(): Promise<void> {
  console.log(`\nmakeSectionFromEvent:`)
  const matchStrings = Object.keys(pref_createNoteSections)
  const sectionTitles = Object.values(pref_createNoteSections)
  // await showMessage(`makeSectionFromEvent start`)
  let eA: Array<TCalendarItem>
  try {
    eA = await Calendar.eventsToday()
  }
  catch (err) {
    await showMessage(`caught error: ${err.message}`)
  }
  await showMessage(`got eventsToday -> ${eA.length}`)
  const outputArray: Array<string> = []
  for (const e of eA) {
    for (let i = 0; i < matchStrings.length; i++) {
      const m = matchStrings[i]
      if (e.title.match(m)) {
        let outputLine = `### ${sectionTitles[i]} [${e.title}]}`
        if (e.date != null) {
          outputLine += ` (${toISOShortTimeString(e.date)})`
        }
        outputArray.push(outputLine)
      }
    }
  }
  console.log(outputArray.join('\n'))
}


// const DEFAULT_EVENTS_OPTIONS = `  events: {
//     defaultCalendarName: "<your default here>",
//     processedTagName: "#event_created",
//     createNoteSections: {
//       [
//         "tag":   "#meeting",
//         "title": "#meeting Notes",
//       ],
//       [
// 		    "tag":   "#webinar",
//         "title": "#webinar Notes",
//       ],
//     },
//   },
// `
