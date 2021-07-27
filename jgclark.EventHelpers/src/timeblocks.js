// @flow

// ------------------------------------------------------------------------------------
// Command to turn time blocks into full calendar events
// @jgclark
//
// See https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm).
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// ------------------------------------------------------------------------------------

// TODO: Need to add ability to cope with 'at 5-5.30pm' and similar 

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import {
  // printDateRange,
  todaysDateISOString,
  isoDateStringFromCalendarFilename,
  RE_DATE,
  displayTitle,
} from '../../helperFunctions'

// find dates of form YYYY-MM-DD
const RE_SCHEDULED_DATE = '>\\d{4}-[01]\\d{1}-\\d{2}'
// find '[>date] 12:30[AM|PM|am|pm][-14:45[AM|PM|am|pm]]'
export const RE_TIMEBLOCK_TYPE1 = `(${RE_SCHEDULED_DATE})? [0-2]?\\d:[0-5]\\d(AM|PM|am|pm)?(\\s?-\\s?[0-2]?\\d:[0-5]\\d(AM|PM|am|pm)?)?`
// find '[>date] at 2(AM|PM|am|pm)[-11[AM|PM|am|pm]]'
export const RE_TIMEBLOCK_TYPE2 = `(${RE_SCHEDULED_DATE})? at [0-2]?\\d(:[0-5]\\d|(AM|PM|am|pm)?)(\\s?-\\s?[0-2]?\\d(:[0-5]\\d|AM|PM|am|pm)?)?`
const RE_EVENT_ID = '\\[\\[event:[A-F0-9-]*\\]\\]'

// ------------------------------------------------------------------------------------

// Go through current Editor note and identify time blocks to turn into events
export async function timeBlocksToCalendar() {
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
  )
  // const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    return
  }

  console.log("\tFound 'events' settings in _configuration note.")
  // now get each setting we need
  const pref_processedTagName: string =
    eventsConfig.processedTagName != null &&
    typeof eventsConfig.processedTagName === 'string'
      ? eventsConfig.processedTagName
      : '#event_created'
  const pref_removeTimeBlocksWhenProcessed =
    (eventsConfig.removeTimeBlocksWhenProcessed != null)
    ? eventsConfig.removeTimeBlocksWhenProcessed
    : true
  const pref_addEventID =
    (eventsConfig.addEventID != null)
    ? eventsConfig.addEventID
    : false

  // Look through open note to find time blocks
  const timeblockParas = paragraphs.filter(
    (p) =>
      p.content.match(RE_TIMEBLOCK_TYPE1) ||
      p.content.match(RE_TIMEBLOCK_TYPE2),
  )
  if (timeblockParas.length > 0) {
    console.log(`  found ${timeblockParas.length} in '${noteTitle}'`)
    // Work out our current date context (as YYYY-MM-DD):
    // - if a calendar note -> date of note
    // - if a project note -> today's date
    // NB: But these are ignored if there's an actual date in the time block
    const dateContext =
      note.type === 'Calendar'
        ? isoDateStringFromCalendarFilename(note.filename) ??
          todaysDateISOString
        : todaysDateISOString

    // Iterate over timeblocks
    for (let i = 0; i < timeblockParas.length; i++) {
      const thisPara = timeblockParas[i]
      let tempArray = thisPara.content?.match(RE_TIMEBLOCK_TYPE1) ?? ['']
      const timeBlockStringType1 = tempArray[0]
      tempArray = thisPara.content?.match(RE_TIMEBLOCK_TYPE2) ?? ['']
      const timeBlockStringType2 = tempArray[0]
      let timeBlockString =
        timeBlockStringType1 !== ''
          ? timeBlockStringType1
          : timeBlockStringType2
      // Check to see if this line has been processed before, by looking for the
      // processed tag, or an [[event:ID]]
      // $FlowFixMe[incompatible-call]
      if (thisPara.content.match(pref_processedTagName)
       || thisPara.content.match(RE_EVENT_ID)) {
        // $FlowFixMe[incompatible-type]
        console.log(
          `\tIgnoring timeblock '${timeBlockString}' as line contains ${pref_processedTagName}`,
        )
      } else {
        console.log(`\tFound timeblock '${timeBlockString}'`)

        // Now add dateContext if there isn't one set already
        const origTimeBlockString = timeBlockString
        if (!timeBlockString.match(RE_DATE)) {
          console.log(
            `\tNo date in time block so will add current dateContext (${dateContext})`,
          )
          timeBlockString = `${dateContext} ${timeBlockString}`
        }
        // NB: parseDateText returns an array, so we'll use the first one as most likely
        const timeblockDateRange = Calendar.parseDateText(timeBlockString)[0]
        if (timeblockDateRange != null) {
          const title = thisPara.content.replace(timeBlockString, '')
          console.log(`\tWill process time block '${timeBlockString}' for '${title}'`)
          const eventID = createEventFromDateRange(title, timeblockDateRange)

          // Remove time block string (if wanted)
          if (pref_removeTimeBlocksWhenProcessed) {
            thisPara.content = thisPara.content.replace(origTimeBlockString, '')
          }
          // Add processedTag (if not empty)
          if (pref_processedTagName !== '') {
            // $FlowFixMe[incompatible-type]
            thisPara.content += ` ${pref_processedTagName}`
            console.log(`\t-> '${thisPara.content}'`)
          }
          // Add event ID (if wanted)
          if (pref_addEventID) {
            // $FlowFixMe[incompatible-type]
            thisPara.content += ` [[event:${eventID}]]`
            console.log(`\t-> '${thisPara.content}'`)
          }
          Editor.updateParagraph(thisPara) // seems not to work twice in quick succession, so just do it once here
        } else {
          console.log(`\tError getting DateRange from '${timeBlockString}'`)
        }
      }
    }
  } else {
    console.log(`  -> No time blocks found.`)
  }
}

// Create a new calendar event
// NB: we can't set which calendar to write to
function createEventFromDateRange(eventTitle: string, dateRange: DateRange): ?string {
  // console.log(`\tStarting cEFDR with ${eventTitle}`)
  // CalendarItem.create(title, date, endDate, type, isAllDay)
  const event = CalendarItem.create(
    eventTitle,
    dateRange.start,
    dateRange.end,
    'event', // not 'reminder'
    false, // not 'isAllDay'
  )
  const createdEvent = Calendar.add(event)
  if (createdEvent != null) {
    console.log(`\t-> Event created with id: ${createdEvent.id ?? 'undefined'}`)
    return createdEvent.id
  } else {
    console.log('\t-> Error: failed to create event')
    return '(error)'
  }
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

//----------------------------------------------------------------------
// Testing finding time blocks in text string:
// - The following *don't work*:
// printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM")[0])
// printDateRange(Calendar.parseDateText("2021-06-02 at 2PM")[0])
// printDateRange(Calendar.parseDateText("2PM-3PM")[0])
// printDateRange(Calendar.parseDateText("2-3")[0]) // thinks of this as Feb 3rd
// printDateRange(Calendar.parseDateText("2-3PM")[0])
// printDateRange(Calendar.parseDateText("2PM-3")[0])

// - The following *do* work as hoped:
// printDateRange(Calendar.parseDateText("2:30-3:45")[0]) // = AM
// printDateRange(Calendar.parseDateText("at 2PM-3PM")[0])
// printDateRange(Calendar.parseDateText("at 2-3")[0]) // = AM
// printDateRange(Calendar.parseDateText("at 2-3PM")[0]) // = PM
// printDateRange(Calendar.parseDateText("at 2PM-3")[0]) // = PM->next AM
// printDateRange(Calendar.parseDateText("at 2:30-3:45")[0]) // = AM
// printDateRange(Calendar.parseDateText("2021-06-02 at 2-3")[0]) // = AM
// printDateRange(Calendar.parseDateText("2021-06-02 at 2:30-3:45")[0]) // = AM
// printDateRange(Calendar.parseDateText("2021-06-02 at 2am-3PM")[0])
// printDateRange(Calendar.parseDateText("2021-06-02 at 2am-3AM")[0])
// printDateRange(Calendar.parseDateText("2021-06-02 2:15-3:45")[0])
// printDateRange(Calendar.parseDateText("2021-06-02 16:00-16:45")[0])
// printDateRange(Calendar.parseDateText("16:00-16:45")[0])
