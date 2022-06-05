// @flow
// ----------------------------------------------------------------------------
// Helpers for Events/Calendar -- that require NotePlan functions
// ----------------------------------------------------------------------------
//
// A note on Time Blocks:
//
// See https://help.noteplan.co/article/121-time-blocking
// for definition of time blocks. In summary:
//  "It is essential to use the keyword at or write the time with colons (HH:mm).
//   You can also use the 24h format like 15:00 without am / pm.
//   And, you don't have to define an end time."
// They work on tasks, titles, and list lines, but not scheduled/cancelled tasks, quotes, or just text.
// NB: The actual detection allows for more time types than is mentioned in the docs.
// ----------------------------------------------------------------------------

import { keepTodayPortionOnly } from './calendar'
import { getDateFromUnhyphenatedDateString, getISODateStringFromYYYYMMDD, type HourMinObj, printDateRange, removeDateTagsAndToday, todaysDateISOString } from './dateTime'
import { addMinutes, differenceInMinutes } from 'date-fns'
import { clo, log, logError, logWarn } from './dev'
import { displayTitle } from './general'
import { findEndOfActivePartOfNote } from './paragraph'
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
} from './timeblocks'
import { showMessage, showMessageYesNo } from './userInput'

export type EventsConfig = {
  eventsHeading: string,
  formatEventsDisplay: string,
  formatAllDayEventsDisplay: string,
  sortOrder: string,
  matchingEventsHeading: string,
  addMatchingEvents: ?{ [string]: mixed },
  locale: string,
  timeOptions: any,
  calendarSet: Array<string>,
  calendarNameMappings: Array<string>,
  addEventID: boolean,
  confirmEventCreation?: boolean,
  processedTagName?: string /* if not set, uses RE_EVENT_ID */,
  removeTimeBlocksWhenProcessed?: boolean,
  calendarToWriteTo?: string,
  defaultEventDuration: number,
}

// ----------------------------------------------------------------------------
// Additional Regular Expressions

const RE_EVENT_ID = `event:[A-F0-9-]{36,37}`

// ----------------------------------------------------------------------------

/**
 * Go through current Editor note, identify time blocks to turn into events,
 * and then add them as events.
 * @author @jgclark
 */
export async function writeTimeBlocksToCalendar(config: EventsConfig, note: TNote | TEditor): Promise<void> {
  const { paragraphs } = note
  if (paragraphs == null || note == null) {
    logWarn('NPCalendar/writeTimeBlocksToCalendar()', 'no content found')
    return
  }
  // $FlowIgnore - Flow doesn't like note or Editor being called here. But for these purposes they should be identical
  const noteTitle = displayTitle(note)
  log('NPCalendar/writeTimeBlocksToCalendar()', `for note '${noteTitle}' ...`)

  let calendarToWriteTo = '' // NP will then use the default
  if (config.calendarToWriteTo != null && config.calendarToWriteTo !== '') {
    // Check that the calendar name we've been given is in the list and is writable
    const writableCalendars: $ReadOnlyArray<string> = Calendar.availableCalendarTitles(true)
    if (writableCalendars.includes(config.calendarToWriteTo)) {
      calendarToWriteTo = config.calendarToWriteTo || ''
      log('NPCalendar/writeTimeBlocksToCalendar()', `\twill write to calendar '${String(calendarToWriteTo)}'`)
    } else {
      log('NPCalendar/writeTimeBlocksToCalendar()', `\trequested calendar '${String(config.calendarToWriteTo)}' is not writeable. Will use default calendar instead.`)
    }
  }

  // Look through open note to find valid time blocks, but stop at Done or Cancelled sections
  // $FlowIgnore - Flow doesn't like note or Editor being called here. But for these purposes they should be identical
  const endOfActive = findEndOfActivePartOfNote(note)
  const timeblockParas = paragraphs.filter((p) => isTimeBlockPara(p) && p.lineIndex <= endOfActive)
  if (timeblockParas.length > 0) {
    log('NPCalendar/writeTimeBlocksToCalendar()', `  found ${timeblockParas.length} in '${noteTitle}'`)
    // Work out our current date context (as YYYY-MM-DD):
    // - if a calendar note -> date of note
    // - if a project note -> today's date
    // NB: But these are ignored if there's an actual date in the time block
    const dateContext = note.type === 'Calendar' && note.filename ? getISODateStringFromYYYYMMDD(note.filename) ?? todaysDateISOString : todaysDateISOString

    // Iterate over timeblocks
    for (let i = 0; i < timeblockParas.length; i++) {
      const thisPara = timeblockParas[i]
      const thisParaContent = thisPara.content ?? ''
      log('NPCalendar/writeTimeBlocksToCalendar()', `${i}: ${thisParaContent}`)
      const reResults = thisParaContent.match(RE_TIMEBLOCK) ?? ['']
      // log('NPCalendar/writeTimeBlocksToCalendar()', reResults.toString())
      let timeBlockString = reResults[0].trim() // or ...
      timeBlockString = getTimeBlockString(thisParaContent).trim()

      // Check to see if this line has been processed before, by looking for the
      // processed tag, or an [[event:ID]]
      // $FlowFixMe[incompatible-call]
      if ((config.processedTagName !== '' && thisParaContent.match(config.processedTagName || '')) || thisParaContent.match(RE_EVENT_ID)) {
        log('NPCalendar/writeTimeBlocksToCalendar()', `\tIgnoring timeblock in '${thisParaContent}' as it has already been processed`)
      } else {
        // Go ahead and process this time block
        log('NPCalendar/writeTimeBlocksToCalendar()', `\tFound timeblock '${timeBlockString}'`)
        let datePart = ''
        // Now add date part (or dateContext if there wasn't one in the paragraph)
        const origTimeBlockString = timeBlockString
        if (!thisParaContent.match(RE_ISO_DATE)) {
          log('NPCalendar/writeTimeBlocksToCalendar()', `\tNo date in time block so will add current dateContext (${dateContext})`)
          datePart = dateContext
        } else {
          const temp = thisParaContent.match(RE_ISO_DATE) ?? []
          datePart = temp[0]
        }
        timeBlockString = `${datePart} ${timeBlockString}`
        // NB: parseDateText returns an array, so we'll use the first one as most likely
        let timeblockDateRange = Calendar.parseDateText(timeBlockString)[0]

        if (timeblockDateRange) {
          // We have a valid timeblock, so let's make the event etc.

          // First see if this is a zero-length event, which happens when no end time
          // was specified. If we have a defaultEventDuration then use it.
          if (differenceInMinutes(timeblockDateRange.start, timeblockDateRange.end) === 0 && config.defaultEventDuration > 0) {
            const newEndDate = addMinutes(timeblockDateRange.end, config.defaultEventDuration)
            timeblockDateRange = { start: timeblockDateRange.start, end: newEndDate }
          }

          // Strip out time + date (if present) from the timeblock line,
          // as we don't want those to go into the calendar event itself (=restOfTask).
          // But also keep a version with date (if present) as we don't want to lose that from the task itself.
          let restOfTaskWithoutTimeBlock = thisPara.content
            .replace(origTimeBlockString, '')
            .replace(/\s{2,}/g, ' ')
            .trimEnd() // take off timeblock
          let restOfTaskWithoutDateTime = removeDateTagsAndToday(restOfTaskWithoutTimeBlock)
            .replace(timeBlockString, '')
            .replace(/\s{2,}/g, ' ')
          log('NPCalendar/writeTimeBlocksToCalendar()', `\tWill process time block '${timeBlockString}' for '${restOfTaskWithoutDateTime}'`)

          // Do we want to add this particular event?
          if (config.confirmEventCreation) {
            const res = await showMessageYesNo(`Add '${restOfTaskWithoutDateTime}' at '${timeBlockString}'?`, ['Yes', 'No'], 'Make event from time block')
            if (res === 'No') {
              continue // go to next time block
            }
          }

          const eventID = (await createEventFromDateRange(restOfTaskWithoutDateTime, timeblockDateRange, calendarToWriteTo)) ?? '<error getting eventID>'

          // Remove time block string (if wanted)
          let thisParaContent = thisPara.content
          // log('NPCalendar/writeTimeBlocksToCalendar()', `\tstarting with thisPara.content: '${thisParaContent}'`)
          if (config.removeTimeBlocksWhenProcessed) {
            thisParaContent = restOfTaskWithoutTimeBlock
          }
          // Add processedTag (if not empty)
          if (config.processedTagName !== '') {
            thisParaContent += ` ${String(config.processedTagName)}`
          }
          // Add event ID (if wanted)
          if (config.addEventID) {
            thisParaContent += ` ⏰event:${eventID}`
          }
          thisPara.content = thisParaContent
          // log('NPCalendar/writeTimeBlocksToCalendar()', `\tsetting thisPara.content -> '${thisParaContent}'`)
          // FIXME(@EduardMe): there's something odd going on here. Often 3 characters are left or repeated at the end of the line as a result of this
          Editor.updateParagraph(thisPara)
        } else {
          logError('NPCalendar/writeTimeBlocksToCalendar()', `Can't get DateRange from '${timeBlockString}'`)
        }
      }
    }
  } else {
    log('NPCalendar/writeTimeBlocksToCalendar()', `  -> No time blocks found.`)
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
async function createEventFromDateRange(eventTitle: string, dateRange: DateRange, calendarName: string): Promise<string> {
  // log('', `\tStarting cEFDR with ${eventTitle} for calendar ${pref_calendarToWriteTo}`)
  // If we have a pref_calendarToWriteTo setting, then include that in the call
  const event: TCalendarItem = CalendarItem.create(
    eventTitle,
    dateRange.start,
    dateRange.end,
    'event', // not 'reminder'
    false, // not 'isAllDay'
    calendarName,
    false, // isCompleted
    '', // notes
    '', // url
  )
  const createdEvent = Calendar.add(event)
  const calendarDisplayName = calendarName !== '' ? calendarName : 'system default'
  if (createdEvent != null) {
    const newID = createdEvent.id ?? 'undefined'
    log('NPCalendar/createEventFromDateRange()', `\t-> Event created with id: ${newID} in ${calendarDisplayName} calendar `)
    return newID
  } else {
    logError('NPCalendar/createEventFromDateRange()', `failed to create event in ${calendarDisplayName} calendar`)
    await showMessage(`Sorry, I failed to create event in ${calendarDisplayName} calendar`, 'OK', `Create Event Error`)
    return 'error'
  }
}

/**
 * Get list of events for the given day (specified as YYYYMMDD).
 * Now also filters out any that don't come from one of the calendars specified
 * in calendarSet.
 * @author @jgclark
 *
 * @param {string} dateStr YYYYMMDD date to use
 * @param {[string]} calendarSet optional list of calendars
 * @param {HourMinObj} start optional start time in the day
 * @param {HourMinObj} end optional end time in the day
 * @return {[TCalendarItem]} array of events as CalendarItems
 */
export async function getEventsForDay(
  dateStr: string,
  calendarSet: Array<string> = [],
  start: HourMinObj = { h: 0, m: 0 },
  end: HourMinObj = { h: 23, m: 59 },
): Promise<Array<TCalendarItem>> {
  const y = parseInt(dateStr.slice(0, 4))
  const m = parseInt(dateStr.slice(4, 6))
  const d = parseInt(dateStr.slice(6, 8))
  const startOfDay = Calendar.dateFrom(y, m, d, start.h, start.m, 0)
  const endOfDay = Calendar.dateFrom(y, m, d, end.h, end.m, 59)
  // log('NPCalendar/getEventsForDay()', `getEventsForDay: ${startOfDay.toString()} - ${endOfDay.toString()}`)
  let eArr: Array<TCalendarItem> = await Calendar.eventsBetween(startOfDay, endOfDay)
  // log('NPCalendar/getEventsForDay()', `\tretrieved ${eArr.length} events from NP Calendar store`)

  // Filter out parts of multi-day events not in today
  eArr = keepTodayPortionOnly(eArr, getDateFromUnhyphenatedDateString(dateStr) ?? new Date())

  // If we have a calendarSet list, use to weed out events that don't match .calendar
  if (calendarSet.length > 0) {
    // const filteredEventArray = calendarSet.slice().filter(c => eArr.some(e => e.calendar === c))
    eArr = eArr.filter((e) => calendarSet.some((c) => e.calendar === c))
    log('NPCalendar/getEventsForDay', `  ${eArr.length} Events kept for ${dateStr} after filtering with ${calendarSet.toString()}`)
  }
  return eArr
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
