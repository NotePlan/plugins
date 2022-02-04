// @flow
// ------------------------------------------------------------------------------------
// Command to turn time blocks into full calendar events
// @jgclark
// Last updated 4.2.2022 for v0.11.2, by @jgclark
//
// See https://help.noteplan.co/article/121-time-blocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm).
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// They work on tasks, titles, and list lines, but not scheduled/cancelled tasks, quotes, or just text.
// NB: The actual detection allows for more time types than is mentioned in the docs.
// ------------------------------------------------------------------------------------

import { getEventsSettings } from './config'
import type { EventsConfig } from './config'
import {
  isoDateStringFromCalendarFilename,
  printDateRange,
  todaysDateISOString,
} from '../../helpers/dateTime'
import { displayTitle } from '../../helpers/general'
import { findEndOfActivePartOfNote } from '../../helpers/paragraph'
import {
  RE_ISO_DATE,
  RE_HOURS,
  RE_MINUTES,
  RE_TIME,
  RE_AMPM,
  RE_AMPM_OPT,
  RE_DONE_DATETIME,
  RE_DONE_DATE_OPT_TIME,
  RE_TIMEBLOCK,
  RE_TIMEBLOCK_FOR_THEMES,
  isTimeBlockPara,
  getTimeBlockString,
} from '../../helpers/timeblocks'
import { showMessage, showMessageYesNo } from '../../helpers/userInput'

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

// ----------------------------------------------------------------------------
// Additional Regular Expressions

const RE_EVENT_ID = `event:[A-F0-9-]{36,37}`

// ----------------------------------------------------------------------------

/**
 * Go through current Editor note, identify time blocks to turn into events,
 * and then add them as events.
 * @author @jgclark
 */
export async function timeBlocksToCalendar(): Promise<void> {
  // console.log(RE_TIMEBLOCK)
  // console.log(RE_TIMEBLOCK_FOR_THEMES)

  const { paragraphs, note } = Editor
  if (paragraphs == null || note == null) {
    console.log('warning: no content found')
    return
  }
  const noteTitle = displayTitle(note)
  console.log(`for note '${noteTitle}' ...`)

  // Get config settings from Template folder _configuration note
  const config = await getEventsSettings()

  let calendarToWriteTo = '' // NP will then use the default
  if (config.calendarToWriteTo != null && config.calendarToWriteTo !== '') {
    // Check that the calendar name we've been given is in the list and is writable
    const writableCalendars: $ReadOnlyArray<string> = Calendar.availableCalendarTitles(true)
    if (writableCalendars.includes(config.calendarToWriteTo)) {
      calendarToWriteTo = config.calendarToWriteTo
      console.log(`\twill write to calendar '${calendarToWriteTo}'`)
    } else {
      console.log(`\trequested calendar '${config.calendarToWriteTo}' is not writeable. Will use default calendar instead.`)
    }
  }

  // Look through open note to find valid time blocks, but stop at Done or Cancelled sections
  const endOfActive = findEndOfActivePartOfNote(note)
  const timeblockParas = paragraphs.filter( (p) => isTimeBlockPara(p) && p.lineIndex <= endOfActive )
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
      if ((config.processedTagName !== "" && thisParaContent.match(config.processedTagName))
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

        if (timeblockDateRange) {
          // We have a valid timeblock, so let's make the event etc.
          // First strip out time + date (if present) from the timeblock line,
          // as we don't want those to go into the calendar event
          let restOfTask = thisPara.content.replace(origTimeBlockString, '').trim() // take off timeblock
          restOfTask = restOfTask.replace(`>${datePart}`, '').trim() // take off >date (if present)
          restOfTask = restOfTask.replace(datePart, '').trim() // take off date (if present)
          console.log(`\tWill process time block '${timeBlockString}' for '${restOfTask}'`)

          // Do we want to add this particular eent?
          if (config.confirmEventCreation) {
            const res = await showMessageYesNo(`Add '${restOfTask}' at '${timeBlockString}'?`, ['Yes', 'No'], 'Make event from time block')
            if (res === 'No') {
              continue // go to next time block
            }
          }

          const eventID = await createEventFromDateRange(restOfTask, timeblockDateRange, calendarToWriteTo) ?? '<error getting eventID>'

          // Remove time block string (if wanted)
          let thisParaContent = thisPara.content
          console.log(`\tstarting with thisPara.content: '${thisParaContent}'`)
          if (config.removeTimeBlocksWhenProcessed) {
            thisParaContent = restOfTask
          }
          // Add processedTag (if not empty)
          if (config.processedTagName !== '') {
            thisParaContent += ` ${config.processedTagName}`
          }
          // Add event ID (if wanted)
          if (config.addEventID) {
            thisParaContent += ` ⏰event:${eventID}`
          }
          thisPara.content = thisParaContent
          // console.log(`\tsetting thisPara.content -> '${thisParaContent}'`)
          // FIXME(@EduardMe): there's something odd going on here. Often 3 characters are left or repeated at the end of the line as a result of this
          Editor.updateParagraph(thisPara)
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

/**
 * Create a new calendar event
 * @author @jgclark
 * 
 * @param {string} - eventTitle: title to use for this event
 * @param {DateRange} - dateRange: date range for this event
 * @param {string} - calendarName: name of calendar to write to. Needs to be writable!
 * @return {string} Calendar ID of new event (or 'error')
 */
async function createEventFromDateRange(
  eventTitle: string,
  dateRange: DateRange,
  calendarName: string): Promise<string> {
  // console.log(`\tStarting cEFDR with ${eventTitle} for calendar ${pref_calendarToWriteTo}`)
  // If we have a pref_calendarToWriteTo setting, then include that in the call
  const event: TCalendarItem = CalendarItem.create(
    eventTitle,
    dateRange.start,
    dateRange.end,
    'event', // not 'reminder'
    false, // not 'isAllDay'
    calendarName,
    false, // not completed
    '',    // empty notes
    ''     // no URL
    )
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
// Markdown to test timeblock functionality
// These should create:
// - 2:30-3:45 TBT1a
//  - TBT1b @done(2021-12-12) 2:30-3:45
//  - TBT1c at 2:30-3:45
// - TBT2a at 2PM-3PM
// - TBT2b @done(2021-12-12) at 2PM-3PM -- but fails in API?
// - TBT3 at 2-3PM
// - TBT4 at 2PM-3
// - TBT5a at 2-3
// - TBT5b at 2 -3
// * TBT5c at 2- 3
//  * TBT5d at 2 - 3
// 	* TBT5e at 2~3
// * [ ] TBT5f at 2to3
// - [ ] TBT5h at 2 to 3
// - TBT5i at 2–3
// - [ ] TBT6 >2021-06-02 at 2-3
// - TBT7 >2021-06-02 at 2:30-3:45
// - TBT8 >2021-06-02 at 2am-3PM
// - TBT9 >2021-06-02 2:15 - 3:45
// - TBT10 2021-06-02 2:15 - 3:45
// - TBT11a >2021-06-02 16:00 - 16:45
// * TBT11b 2021-06-02 16:00 - 16:45
// * TBT12 @done(2021-12-12) 2:30-3:45
// * [x] TBT13 done at 2PM-3PM @done(2021-12-12)
// - TBT14 at 5-5:45pm
// - TBT15 at 5pm
// * TBT22a 1️⃣ 6:00 AM - 9:30 AM - Part I -- but parsed wrongly
// - [ ] TBT22b 1️⃣ 6:00AM - 9:30AM
// * TBT23 at noon
// * TBT24 at noon:24
// - TBT25 at midnight
// - TBT26 at midnight:26
// These shouldn't create:
// - TBT16a at 5a
// - TBT16b at 5p
// - TBT17 shouldn't create 2021-06-02 2.15PM-3.45PM
// - TBT18 shouldn't create 2PM-3PM _doesn't parse_
// - TBT9 shouldn't create 2-3 _parsed wrongly_
// - TBT0 shouldn't create 2-3PM _doesn't parse_
// - [ ] TBT21 shouldn't create 2PM-3 _doesn't parse_
// - TBT27 cost was 23.12
// - TBT28 Philippians 2.6-11
// - TBT29 ### 21/11/2021  CCC Hybrid service
// - TBT30 _not yet clear whether this should pass:_ terminal 5
// * TBT31 Do something <2022-01-05
// * [x] TBT32 Done something @done(2022-01-05)
// - TBT33 the temp is 17-18 -- does create but really shouldn't
// - TBT34 no: I sat 2pm onwards
// - TBT35 no: somethingfrom 2pm onwards
// - TBT36 no: 1234:56
