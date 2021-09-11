// @flow

// ------------------------------------------------------------------------------------
// Command to turn time blocks into full calendar events
// @jgclark
// v0.5.0, 12.9.2021
//
// See https://help.noteplan.co/article/52-part-2-tasks-events-and-reminders#timeblocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm).
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// ------------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { showMessageYesNo } from '../../helpers/userInput'
import { displayTitle } from '../../helpers/general'
import {
  printDateRange,
  todaysDateISOString,
  isoDateStringFromCalendarFilename,
} from '../../helpers/dateTime'

// ------------------------------------------------------------------------------------
// Settings
const DEFAULT_EVENTS_OPTIONS = `
  events: {
    calendarToWriteTo: "" // specify calendar name to write events to. Must be writable calendar. If empty, then the default system calendar will be used.
    addEventID: false,  // whether to add an [[event:ID]] internal link when creating an event from a time block
    processedTagName: "#event_created",   // optional tag to add after making a time block an event
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    eventsHeading: "### Events today",  // optional heading to put before list of today's events
    addMatchingEvents: {   // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
      "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
      "holiday": "*|TITLE|* *|NOTES|*",
    },
    locale: "en-US",
	  timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
  },
`

let pref_processedTagName: string
let pref_removeTimeBlocksWhenProcessed: boolean
let pref_addEventID: boolean
let pref_confirmEventCreation: boolean
let pref_calendarToWriteTo: string

// ------------------------------------------------------------------------------------
// Regular Expressions
// find dates of form YYYY-MM-DD
const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'
const RE_HOUR = '[0-2]?\\d'
const RE_MINUTE = '[0-5]\\d'
const RE_TIME = `${RE_HOUR}:${RE_MINUTE}`
const RE_AMPM = `(AM|PM|am|pm)`
const RE_OPT_AMPM = `${RE_AMPM}?`
// find ' 12:30[AM|PM|am|pm][-14:45[AM|PM|am|pm]]'
const RE_TIMEBLOCK_TYPE1 = `\\s*${RE_TIME}${RE_OPT_AMPM}(\\s?-\\s?${RE_TIME}${RE_OPT_AMPM})?`
// find ' at 2(AM|PM|am|pm)[-11[AM|PM|am|pm]]'
const RE_TIMEBLOCK_TYPE2 = `\\s*at\\s+${RE_HOUR}(:${RE_MINUTE}|(AM|PM|am|pm)?)(\\s?-\\s?${RE_HOUR}(:${RE_MINUTE}|AM|PM|am|pm)?)?`
// find ' at 9(AM|PM|am|pm)-11:30(AM|PM|am|pm)'
const RE_TIMEBLOCK_TYPE3 = `\\s*(at\\s+)?${RE_HOUR}${RE_OPT_AMPM}\\s?-\\s?${RE_HOUR}:${RE_MINUTE}${RE_AMPM}`
const RE_DONE_DATETIME = `@done\\(${RE_ISO_DATE} ${RE_TIME}${RE_OPT_AMPM}\\)`
const RE_EVENT_ID = `event:[A-F0-9-]{32}`

// ------------------------------------------------------------------------------------

// Go through current Editor note and identify time blocks to turn into events
export async function timeBlocksToCalendar() {

  printDateRange(Calendar.parseDateText("5-5:45pm")[0])

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
  pref_removeTimeBlocksWhenProcessed = eventsConfig?.removeTimeBlocksWhenProcessed ?? true
  pref_addEventID = eventsConfig?.addEventID ?? false
  pref_confirmEventCreation = eventsConfig?.confirmEventCreation ?? false
  pref_calendarToWriteTo = eventsConfig?.calendarToWriteTo ?? ''
  if (pref_calendarToWriteTo != null && pref_calendarToWriteTo !== '') {
    // TODO: we should check that the calendar name we've been given is writable
    // when API calls are available from r655
    console.log(`\twill write to calendar ${pref_calendarToWriteTo}`)
  }

  // const pref_processedTagName: string =
  //   eventsConfig.processedTagName != null &&
  //   typeof eventsConfig.processedTagName === 'string'
  //     ? eventsConfig.processedTagName
  //     : '#event_created'
  // const pref_removeTimeBlocksWhenProcessed =
  //   (eventsConfig.removeTimeBlocksWhenProcessed != null)
  //   ? eventsConfig.removeTimeBlocksWhenProcessed
  //   : true
  // const pref_addEventID =
  //   (eventsConfig.addEventID != null)
  //   ? eventsConfig.addEventID
  //   : false
  // const pref_confirmEventCreation =
  //   (eventsConfig.confirmEventCreation != null)
  //   ? eventsConfig.confirmEventCreation
  //   : false
  // const pref_calendarToWriteTo =
  //   (eventsConfig.calendarToWriteTo != null)
  //   ? eventsConfig.calendarToWriteTo
  //   : "" // if blank then we will use the default from the Operating System

  // Look through open note to find time blocks, but ignore @done(...) lines
  // which can look like timeblocks
  const timeblockParas = paragraphs.filter(
    (p) =>
      (p.content.match(RE_TIMEBLOCK_TYPE1) ||
       p.content.match(RE_TIMEBLOCK_TYPE2) ||
       p.content.match(RE_TIMEBLOCK_TYPE3)) &&
      !p.content.match(RE_DONE_DATETIME)
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
      const thisParaContent = thisPara.content ?? ''
      let tempArray = thisParaContent.match(RE_TIMEBLOCK_TYPE1) ?? ['']
      const timeBlockStringType1 = tempArray[0]
      tempArray = thisParaContent.match(RE_TIMEBLOCK_TYPE2) ?? ['']
      const timeBlockStringType2 = tempArray[0]
      tempArray = thisParaContent.match(RE_TIMEBLOCK_TYPE3) ?? ['']
      const timeBlockStringType3 = tempArray[0]
      let timeBlockString =
        timeBlockStringType1 !== ''
          ? timeBlockStringType1
          : timeBlockStringType2 !== ''
            ? timeBlockStringType2
            : timeBlockStringType3

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
          const title = thisParaContent.replace(origTimeBlockString, '')
          if (pref_confirmEventCreation) {
            const res = await showMessageYesNo(`Create '${timeBlockString}' for '${title}'?`)
            if (res === 'No') {
              continue // go to next time block
            }
          }

          console.log(`\tWill process time block '${timeBlockString}' for '${title}'`)
          const eventID = createEventFromDateRange(title, timeblockDateRange)

          // Remove time block string (if wanted)
          if (pref_removeTimeBlocksWhenProcessed) {
            thisPara.content = thisParaContent.replace(origTimeBlockString, '')
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
  }
}

// Create a new calendar event
function createEventFromDateRange(eventTitle: string, dateRange: DateRange): ?string {
  // console.log(`\tStarting cEFDR with ${eventTitle} for calendar ${pref_calendarToWriteTo}`)
  // If we have a pref_calendarToWriteTo setting, then include that in the call
  let event: TCalendarItem
  if (pref_calendarToWriteTo !== '') {
    event = CalendarItem.create(
      eventTitle,
      dateRange.start,
      dateRange.end,
      'event', // not 'reminder'
      false, // not 'isAllDay'
      pref_calendarToWriteTo,
    )
  } else {
    event = CalendarItem.create(
      eventTitle,
      dateRange.start,
      dateRange.end,
      'event', // not 'reminder'
      false, // not 'isAllDay'
    )
  }
  const createdEvent = Calendar.add(event)
  if (createdEvent != null) {
    console.log(`-> Event created with id: ${createdEvent.id ?? 'undefined'} in calendar ${pref_calendarToWriteTo}`)
    return createdEvent.id
  } else {
    console.log(`-> Error: failed to create event in calendar ${pref_calendarToWriteTo}`)
    return '(error)'
  }
}

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
// printDateRange(Calendar.parseDateText("at 5-5:45pm")[0])

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
