// @flow
// ------------------------------------------------------------------------------------
// Command to turn time blocks into full calendar events
// @jgclark
// Last updated for v0.9.0, 11.12.2021 by @jgclark
//
// See https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm).
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// ------------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { showMessage, showMessageYesNo } from '../../helpers/userInput'
import { displayTitle } from '../../helpers/general'
import {
  isoDateStringFromCalendarFilename,
  printDateRange,
  todaysDateISOString,
} from '../../helpers/dateTime'
import {
  RE_ISO_DATE,
  RE_HOURS,
  RE_MINUTES,
  RE_TIME,
  RE_AMPM,
  RE_AMPM_OPT,
  RE_DONE_DATETIME,
  RE_DONE_DATE_OPT_TIME,
  // RE_TIMEBLOCK_START,
  // RE_TIMEBLOCK_END,
  RE_TIMEBLOCK,
  RE_TIMEBLOCK_FOR_THEMES,
  isTimeBlockPara,
  getTimeBlockString,
} from '../../helpers/timeblocks'

// ------------------------------------------------------------------------------------
// Settings
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

let pref_processedTagName: string
let pref_removeTimeBlocksWhenProcessed: boolean
let pref_addEventID: boolean
let pref_confirmEventCreation: boolean
let pref_calendarToWriteTo: string

// ------------------------------------------------------------------------------------
// Additional Regular Expressions

const RE_EVENT_ID = `event:[A-F0-9-]{32,33}`

// ------------------------------------------------------------------------------------

// Go through current Editor note and identify time blocks to turn into events
export async function timeBlocksToCalendar() {
  console.log(RE_TIMEBLOCK)

  const { paragraphs, note } = Editor
  if (paragraphs == null || note == null) {
    console.log('\ntimeBlocksToCalendar: warning: no content found')
    return
  }
  const noteTitle = displayTitle(note)
  console.log(`\ntimeBlocksToCalendar: starting for note '${noteTitle}'`)

  // Get config settings from Template folder _configuration note
  const eventsConfig = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
    // no minimum config needed, as can use defaults if need be
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tInfo: couldn't find 'events' settings in _configuration note. Will use defaults.")
  }
  console.log("\tFound 'events' settings in _configuration note.")

  // now get settings we need
  pref_processedTagName = String(eventsConfig?.processedTagName) ?? '#event_created'
  // $FlowFixMe[incompatible-type]
  pref_removeTimeBlocksWhenProcessed = eventsConfig?.removeTimeBlocksWhenProcessed ?? true
  // $FlowFixMe[incompatible-type]
  pref_addEventID = eventsConfig?.addEventID ?? false
  // $FlowFixMe[incompatible-type]
  pref_confirmEventCreation = eventsConfig?.confirmEventCreation ?? false
  pref_calendarToWriteTo = String(eventsConfig?.calendarToWriteTo) ?? ''

  let calendarToWriteTo = '' // NP will then use the default
  if (pref_calendarToWriteTo != null && pref_calendarToWriteTo !== '') {
    // Check that the calendar name we've been given is in the list and is writable
    const writableCalendars: $ReadOnlyArray<string> = Calendar.availableCalendarTitles(true)
    if (writableCalendars.includes(pref_calendarToWriteTo)) {
      calendarToWriteTo = pref_calendarToWriteTo
      console.log(`\twill write to calendar '${calendarToWriteTo}'`)
    } else {
      console.log(`\trequested calendar '${pref_calendarToWriteTo}' is not writeable. Will use default calendar instead.`)
    }
  }

  // Look through open note to find time blocks, but ignore @done(...) lines
  // which can look like timeblocks
  const timeblockParas = paragraphs.filter( (p) => isTimeBlockPara(p) )
  if (timeblockParas.length > 0) {
    console.log(`  found ${timeblockParas.length} in '${noteTitle}'`)
    // Work out our current date context (as YYYY-MM-DD):
    // - if a calendar note -> date of note
    // - if a project note -> today's date
    // NB: But these are ignored if there's an actual date in the time block
    const dateContext =
      note.type === 'Calendar'
        ? isoDateStringFromCalendarFilename(note.filename) ?? todaysDateISOString
        : todaysDateISOString

    // Iterate over timeblocks
    for (let i = 0; i < timeblockParas.length; i++) {
      const thisPara = timeblockParas[i]
      const thisParaContent = thisPara.content ?? ''
      console.log(`${i}: ${thisParaContent}`)
      const reResults = thisParaContent.match(RE_TIMEBLOCK) ?? ['']
      // console.log(reResults.toString())
      let timeBlockString = reResults[0].trim() // or ...
      timeBlockString = getTimeBlockString(thisParaContent).trim()
      
      // Check to see if this line has been processed before, by looking for the
      // processed tag, or an [[event:ID]]
      // $FlowFixMe[incompatible-call]
      if ((pref_processedTagName !== "" && thisParaContent.match(pref_processedTagName))
          || thisParaContent.match(RE_EVENT_ID)) {
        console.log(
          `\tIgnoring timeblock in '${thisParaContent}' as it has already been processed`,
        )
      } else {
        // Go ahead and process this time block
        console.log(`\tFound timeblock '${timeBlockString}'`)
        let datePart = ''
        // Now add date part (or dateContext if there wasn't one in the paragraph)
        const origTimeBlockString = timeBlockString
        if (!thisParaContent.match(RE_ISO_DATE)) {
          console.log(
            `\tNo date in time block so will add current dateContext (${dateContext})`,
          )
          datePart = dateContext
        } else {
          const temp = thisParaContent.match(RE_ISO_DATE) ?? []
          datePart = temp[0]
        }
        timeBlockString = `${datePart} ${timeBlockString}`
        // NB: parseDateText returns an array, so we'll use the first one as most likely
        const timeblockDateRange = Calendar.parseDateText(timeBlockString)[0]

        if (timeblockDateRange != null) {
          const title = thisParaContent.replace(origTimeBlockString, '').trim()
          if (pref_confirmEventCreation) {
            const res = await showMessageYesNo(`Add event at '${timeBlockString}' for '${title}'?`)
            if (res === 'No') {
              continue // go to next time block
            }
          }

          console.log(`\tWill process time block '${timeBlockString}' for '${title}'`)
          const eventID = await createEventFromDateRange(title, timeblockDateRange, calendarToWriteTo) ?? '<error getting eventID>'

          // Remove time block string (if wanted)
          if (pref_removeTimeBlocksWhenProcessed) {
            thisPara.content = thisParaContent.replace(origTimeBlockString, '').trim()
          }
          // Add processedTag (if not empty)
          if (pref_processedTagName !== '') {
            thisPara.content += ` ${pref_processedTagName}`
          }
          // Add event ID (if wanted)
          if (pref_addEventID) {
            thisPara.content += ` ⏰event:${eventID}`
          }
          Editor.updateParagraph(thisPara) // seems not to work twice in quick succession, so just do it once here
        } else {
          console.log(`\tError getting DateRange from '${timeBlockString}'`)
        }
      }
    }
  } else {
    console.log(`  -> No time blocks found.`)
    await showMessage(`Sorry, no time blocks found.`)
  }
}

// Create a new calendar event
async function createEventFromDateRange(
  eventTitle: string,
  dateRange: DateRange,
  calendarName: string): Promise<string> {
  // console.log(`\tStarting cEFDR with ${eventTitle} for calendar ${pref_calendarToWriteTo}`)
  // If we have a pref_calendarToWriteTo setting, then include that in the call
  let event: TCalendarItem
  // if (pref_calendarToWriteTo !== '') {
    event = CalendarItem.create(
      eventTitle,
      dateRange.start,
      dateRange.end,
      'event', // not 'reminder'
      false, // not 'isAllDay'
      calendarName,
    )
  // } else {
  //   event = CalendarItem.create(
  //     eventTitle,
  //     dateRange.start,
  //     dateRange.end,
  //     'event', // not 'reminder'
  //     false, // not 'isAllDay'
  //   )
  // }
  const createdEvent = Calendar.add(event)
  const calendarDisplayName = (calendarName !== '') ? calendarName : 'system default'
  if (createdEvent != null) {
    const newID = createdEvent.id ?? 'undefined'
    console.log(`-> Event created with id: ${newID} in ${calendarDisplayName} calendar `)
    return newID
  } else {
    console.log(`-> Error: failed to create event in ${calendarDisplayName} calendar`)
    await showMessage(`Sorry, I failed to create event in ${calendarDisplayName} calendar`)
    return 'error'
  }
}

//----------------------------------------------------------------------
// Markdown to test timeblock function. All should create apart from ones listed
// - TBT-1a 2:30-3:45
// - TBT-1b @done(2021-12-12) 2:30-3:45
// - TBT-2a at 2PM-3PM
// - TBT-2b shouldn't create @done(2021-12-12 12:34) at 2PM-3PM
// - TBT-3 at 2-3
// - TBT-4 at 2-3PM
// - TBT-5 at 2PM-3
// - TBT-6 at 2:30-3:45
// - TBT-7 >2021-06-02 at 2-3
// - TBT-8 >2021-06-02 at 2:30-3:45
// - TBT-9 >2021-06-02 at 2am-3PM
// - TBT-10 >2021-06-02 at 2am-3AM
// - TBT-11a >2021-06-02 2:15 - 3:45
// - TBT-11b 2021-06-02 2:15 - 3:45
// - TBT-12a >2021-06-02 16:00 - 16:45
// - TBT-12b 2021-06-02 16:00 - 16:45
// - TBT-13 16:00-16:45
// - TBT-14 at 5-5:45pm
// - TBT-15 shouldn't create 2021-06-02 2.15PM-3.45PM
// - TBT-16 shouldn't create 2PM-3PM
// - TBT-18 shouldn't create 2-3
// - TBT-19 shouldn't create 2-3PM
// - TBT-20 shouldn't create 2PM-3
