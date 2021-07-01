// @flow

// ------------------------------------------------------------------------------------
// Command to turn timeblocks into full calendar events
// @jgclark
//
// See https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm). 
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// ------------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import {
  // toISOShortDateTimeString,
  // toISODateString,
  printDateRange,
  displayTitle,
} from '../../helperFunctions'

// Setting variables
let pref_processedTagName: string

const RE_SCHEDULED_DATE = '>\\d{4}-[01]\\d{1}-\\d{2}' // find dates of form YYYY-MM-DD
// find '[>date] 12:30[AM|PM|am|pm][-14:45[AM|PM|am|pm]]'
export const RE_TIMEBLOCK_TYPE1 = `(${RE_SCHEDULED_DATE})? [0-2]?\\d:[0-5]\\d(AM|PM|am|pm)?(\\s?-\\s?[0-2]?\\d:[0-5]\\d(AM|PM|am|pm)?)?`
// find '[>date] at 2(AM|PM|am|pm)[-11[AM|PM|am|pm]]'
export const RE_TIMEBLOCK_TYPE2 = `(${RE_SCHEDULED_DATE})? at [0-2]?\\d(:[0-5]\\d|(AM|PM|am|pm)?)(\\s?-\\s?[0-2]?\\d(:[0-5]\\d|AM|PM|am|pm)?)?`

// ------------------------------------------------------------------------------------

// Go through current Editor note and identify timeblocks to turn into events
export async function timeblocksToCalendar() {
  const { paragraphs, note } = Editor
  if (paragraphs == null || note == null) {
    console.log('\ntimeblocksToCalendar: warning: no content found')
  }
  const noteTitle = displayTitle(note)
  console.log(`\ntimeblocksToCalendar: starting for note '${noteTitle}'`)

  // Get config settings from Template folder _configuration note
  const config = await getOrMakeConfigurationSection(
    'statistics',
    DEFAULT_EVENTS_OPTIONS,
  )
  const eventsConfig: any = config?.events ?? null
  if (eventsConfig == null) {
    console.log("\tCouldn't find 'events' settings in _configuration note.")
    return
  }

  console.log("\tFound 'events' settings in _configuration note.")
  // now get each setting
  pref_processedTagName =
    eventsConfig.pref_processedTagName != null ? eventsConfig.pref_processedTagName : '#event_created'
  
  // Look through open note to find timeblocks
  const timeblockParas = paragraphs.filter(
    // (p) => (p.content.match(RE_TIMEBLOCK_TYPE1) ))
    (p) => (p.content.match(RE_TIMEBLOCK_TYPE1) || (p.content.match(RE_TIMEBLOCK_TYPE2))))
  if (timeblockParas.length > 0) {
    console.log(`  found ${timeblockParas.length} in '${noteTitle}'`)

    // Iterate over timeblocks 
    for (let i = 0; i < timeblockParas.length; i++) {
      const thisPara = timeblockParas[i]
      let tempArray = thisPara.content?.match(RE_TIMEBLOCK_TYPE1) ?? ['']
      const timeblockStringType1 = tempArray[0]
      tempArray = thisPara.content?.match(RE_TIMEBLOCK_TYPE2) ?? ['']
      const timeblockStringType2 = tempArray[0]
      const timeblockString = (timeblockStringType1 !== '') ? timeblockStringType1 : timeblockStringType2
      // Check to see if this line has been processed before, by looking for the processed tag
      if (thisPara.content.match(pref_processedTagName)) {
        console.log(`\tIgnoring timeblock '${timeblockString}' as line contains ${pref_processedTagName}`)
      }
      else {
        console.log(`\tFound timeblock '${timeblockString}'`)
        
        // NB: parseDateText returns an array, so we'll use the first one as most likely
        const timeblockDateRange = Calendar.parseDateText(timeblockString)[0]
        if (timeblockDateRange != null) {
          // printDateRange(timeblockDateRange)
          const title = thisPara.content.replace(timeblockString, '')
          console.log(`\tWill process timeblock '${timeblockString}' for '${title}'`)
          createEventFromDateRange(title, timeblockDateRange)

          // Add processedTag (if wanted)
          if (pref_processedTagName !== '') {
            thisPara.content += ` ${pref_processedTagName}`
            Editor.updateParagraph(thisPara)
          }
        } else {
          console.log(`\tError getting DateRange from '${timeblockString}'`)
        }
      }
    }
  } else {
    console.log(`  -> No timeblocks found.`)
  }
}

// Create a new calendar event
// NB: we can't set which calendar to write to
function createEventFromDateRange(eventTitle: string, dateRange: DateRange) {
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
  } else {
    console.log('\t-> Error: failed to create event')
  }
}

const DEFAULT_EVENTS_OPTIONS = `  events: {
    processedTagName: "#event_created",
  },
`

// This is for later use when we can *read* calendar events, as promised by @EduardMe, 1.7.2021
// const DEFAULT_EVENTS_OPTIONS = `  events: {
//     defaultCalendarName: "<your default here>",
//     processedTagName: "#event_created",
//     createNoteSections: {
//       [
// 		 "tag":   "#meeting",
//         "title": "#meeting Notes",
//       ],
//       [
// 		 "tag":   "#webinar",
//         "title": "#webinar Notes",
//       ],
//     },
//   },
// `

//----------------------------------------------------------------------
// Testing finding timeblock in text string:
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
