// @flow
// ----------------------------------------------------------------------
// Helpers for Events/Calendar -- that require NotePlan functions
// ----------------------------------------------------------------------
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
// ----------------------------------------------------------------------

import { addMinutes, differenceInMinutes } from 'date-fns'
import { keepTodayPortionOnly, RE_EVENT_ID } from './calendar'
import {
  getDateFromUnhyphenatedDateString,
  getISODateStringFromYYYYMMDD,
  type HourMinObj,
  // printDateRange,
  RE_ISO_DATE,
  RE_BARE_WEEKLY_DATE,
  removeDateTagsAndToday,
  todaysDateISOString,
  weekStartDateStr,
} from './dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from './dev'
import { displayTitle } from './general'
import { findEndOfActivePartOfNote } from './paragraph'
import {
  RE_TIMEBLOCK,
  isTimeBlockPara,
  getTimeBlockString,
} from './timeblocks'
import { showMessage, showMessageYesNoCancel, chooseOption } from './userInput'

export type EventsConfig = {
  eventsHeading: string,
  formatEventsDisplay: string,
  formatAllDayEventsDisplay: string,
  sortOrder: string,
  calendarSet: Array<string>,
  calendarNameMappings: Array<string>,
  matchingEventsHeading: string,
  addMatchingEvents: ?{ [string]: mixed },
  locale: string,
  timeOptions: any,
  includeCompletedTasks: boolean,
  calendarToWriteTo?: string,
  defaultEventDuration: number,
  confirmEventCreation?: boolean,
  removeTimeBlocksWhenProcessed?: boolean,
  addEventID: boolean,
  processedTagName?: string /* if not set, uses RE_EVENT_ID */,
  alternateDateFormat: string,
  removeDoneDates: boolean,
  uncompleteTasks: boolean,
  removeProcessedTagName: boolean,
  meetingTemplateTitle: string
}

// ----------------------------------------------------------------------

/**
 * Prompt user for which of the writeable calendars to use
 * @param {Array<string>} calendars - the list of writeable calendars
 * @returns {string} the calendar name to write to (or '' if none)
 */
export async function chooseCalendar(calendars: $ReadOnlyArray<string>): Promise<string> {
  clo(calendars, `chooseCalendar: available/writeable calendars`)
  if (calendars?.length) {
    const opts = calendars.map((cal) => ({
      label: cal,
      value: cal,
    }))
    const calendarName = await chooseOption('Choose calendar to write to:', opts, opts[0].label)
    return calendarName
  }
  return ''
}

/**
 * Check if a specified calendar is available to the user and writable
 * If not, prompt the user to choose one of the available calendars (if forceUserToChoose is set to true)
 * @param {string} calendarName - the name of the calendar to look for in the calendar list
 * @param {boolean} forceUserToChoose - if calendar is not set or not writeable, force use to choose a calendar (default: false)
 * @returns {string|null} either null for no changes required (use the calendar name passed in), or a new calendar name that was chosen by the user
 */
export async function checkOrGetCalendar(calendarName: string, forceUserToChoose: boolean = false): Promise<string | null> {
  try {
    let chosenCalendar = calendarName
    const writableCalendars: $ReadOnlyArray<string> = Calendar.availableCalendarTitles(true)
    if (writableCalendars.length) {
      let calendarOK = false
      if (calendarName && calendarName !== '') {
        if (writableCalendars.includes(calendarName)) {
          calendarOK = true
        } else {
          logWarn('NPCalendar:: checkOrGetCalendar', `Calendar ${calendarName} cannot be found in the writable calendars array:\n${writableCalendars.join('\n')}`)
          await showMessage(
            `Calendar from settings: "${calendarName}" cannot be found in the writable calendars array:\n${writableCalendars.join(
              '\n',
            )}\nPlease choose a calendar which NotePlan can write to.`,
          )
        }
      }
      if (!calendarOK && forceUserToChoose) {
        chosenCalendar = await chooseCalendar(writableCalendars)
      }
    } else {
      logError(`NPCalendar::checkCalendar`, `No writable calendars found.`)
      showMessage('No writable calendars found. Please check your NotePlan Calendar Preferences')
    }
    const retVal = chosenCalendar !== '' && chosenCalendar !== calendarName ? chosenCalendar : null
    if (!retVal) logDebug(`NPCalendar::checkOrGetCalendar`, `Calendar "${calendarName}" is writable. Good to go.`)
    if (retVal) logWarn(`NPCalendar::checkOrGetCalendar`, `"${calendarName}" did not work. Writeable calendar chosen: "${chosenCalendar}"`)
    return retVal
  }
  catch (error) {
    logError('NPCalendar::checkOrGetCalendar', error.message)
    return null// for completeness
  }
}

/**
 * Go through current Editor note, identify time blocks to turn into events,
 * and then add them as events.
 * @param {EventsConfig} config - the configuration for the timeblocks and event creation
 * @param {TNote|TEditor} note - the note to scan for time blocks
 * @param {boolean} showLoadingProgress -- show progress counter while adding events (default: false)
 * @author @jgclark
 */
export async function writeTimeBlocksToCalendar(config: EventsConfig, note: TNote | TEditor, showLoadingProgress: boolean = false): Promise<void> {
  try {
  const { paragraphs } = note
  if (paragraphs == null || note == null) {
    logWarn('NPCalendar / writeTimeBlocksToCalendar', 'no content found')
    return
  }
  // $FlowFixMe - Flow doesn't like note or Editor being called here. But for these purposes they should be identical
  const noteTitle = displayTitle(note)
  logDebug('NPCalendar / writeTimeBlocksToCalendar', `Starting for note '${noteTitle}' ...`)

  let calendarToWriteTo = '' // NP will then use the default
  if (config.calendarToWriteTo != null && config.calendarToWriteTo !== '') {
    // Check that the calendar name we've been given is in the list and is writable
    const writableCalendars: $ReadOnlyArray<string> = Calendar.availableCalendarTitles(true)
    if (writableCalendars.includes(config.calendarToWriteTo)) {
      calendarToWriteTo = config.calendarToWriteTo || ''
      logDebug('NPCalendar / writeTimeBlocksToCalendar', `- will write to calendar '${String(calendarToWriteTo)}'`)
    } else {
      logWarn('NPCalendar / writeTimeBlocksToCalendar', `- requested calendar '${String(config.calendarToWriteTo)}' is not writeable. Will use default calendar instead.`)
    }
  }

  // Look through open note to find valid time blocks, but stop at Done or Cancelled sections
  // $FlowIgnore - Flow doesn't like note or Editor being called here. But for these purposes they should be identical
  const endOfActive = findEndOfActivePartOfNote(note)
    const timeblockParas = paragraphs.filter((p) => isTimeBlockPara(p) && p.lineIndex <= endOfActive && ((p.type !== 'done' && p.type !== 'checklistDone') || config.includeCompletedTasks))
    if (timeblockParas.length > 0) {
      logDebug('NPCalendar / writeTimeBlocksToCalendar', `-   found ${timeblockParas.length} in '${noteTitle}'`)
      // Work out our current date context (as YYYY-MM-DD):
      // - if a calendar note -> date of note
      // - if a project note -> today's date
      // NB: But these are ignored if there's an actual date in the time block
      const dateContext = note.type === 'Calendar' && note.filename ? getISODateStringFromYYYYMMDD(note.filename) ?? todaysDateISOString : todaysDateISOString

      // Iterate over timeblocks
      if (showLoadingProgress && !config.confirmEventCreation) {
        CommandBar.showLoading(true, 'Inserting Calendar Events')
        await CommandBar.onAsyncThread()
      }
      for (let i = 0; i < timeblockParas.length; i++) {
        const thisPara = timeblockParas[i]
        const thisParaContent = thisPara.content ?? ''
        logDebug('NPCalendar / writeTimeBlocksToCalendar', `${i}: ${thisParaContent}`)
        const reResults = thisParaContent.match(RE_TIMEBLOCK) ?? ['']
        logDebug('NPCalendar / writeTimeBlocksToCalendar', reResults.toString())
        let timeBlockString = reResults[0].trim() // or ...
        timeBlockString = getTimeBlockString(thisParaContent).trim()

        // Check to see if this line has been processed before, by looking for the
        // processed tag, or an [[event:ID]]
        if ((config.processedTagName !== '' && thisParaContent.match(config.processedTagName || '')) || thisParaContent.match(RE_EVENT_ID)) {
          logDebug('NPCalendar / writeTimeBlocksToCalendar', `- Ignoring timeblock in '${thisParaContent}' as it has already been processed`)
        } else {
          // Go ahead and process this time block
          logDebug('NPCalendar / writeTimeBlocksToCalendar', `- Found timeblock '${timeBlockString}'`)
          let datePart = ''
          // Now add date part (or dateContext if there wasn't one in the paragraph)
          const origTimeBlockString = timeBlockString
          if (thisParaContent.match(RE_ISO_DATE)) {
            const temp = thisParaContent.match(RE_ISO_DATE) ?? []
            datePart = temp[0]
          } else if (thisParaContent.match(RE_BARE_WEEKLY_DATE)) {
            const temp = thisParaContent.match(RE_BARE_WEEKLY_DATE) ?? []
            const weekPart = temp[0]
            datePart = getISODateStringFromYYYYMMDD(weekStartDateStr(weekPart))
          } else {
            logDebug('NPCalendar / writeTimeBlocksToCalendar', `- No date in time block so will add current dateContext (${dateContext})`)
            datePart = dateContext
          }
          timeBlockString = `${datePart} ${timeBlockString}`
          logDebug('NPCalendar / writeTimeBlocksToCalendar', `- datePart: ${datePart}`)
          // NB: parseDateText returns an array, so we'll use the first one as most likely
          // eslint-disable-next-line prefer-const
          let timeblockDateRange = { ...Calendar.parseDateText(timeBlockString)[0] }

          if (timeblockDateRange) {
            // We have a valid timeblock, so let's make the event etc.

            // First see if this is a zero-length event, which happens when no end time
            // was specified. If we have a defaultEventDuration then use it.
            if (differenceInMinutes(timeblockDateRange.start, timeblockDateRange.end) === 0 && config.defaultEventDuration > 0) {
              const newEndDate = addMinutes(timeblockDateRange.end, config.defaultEventDuration)
              timeblockDateRange.end = newEndDate
            }

            // Strip out time + date (if present) from the timeblock line,
            // as we don't want those to go into the calendar event itself (=restOfTask).
            // But also keep a version with date (if present) as we don't want to lose that from the task itself.
            const restOfTaskWithoutTimeBlock = thisPara.content
              .replace(origTimeBlockString, '')
              .replace(/\s{2,}/g, ' ')
              .trimEnd() // take off timeblock
            const restOfTaskWithoutDateTime = removeDateTagsAndToday(restOfTaskWithoutTimeBlock)
              .replace(timeBlockString, '')
              .replace(/\s{2,}/g, ' ')
            logDebug('NPCalendar / writeTimeBlocksToCalendar', `- Will process time block '${timeBlockString}' for '${restOfTaskWithoutDateTime}'`)

            // Do we want to add this particular event?
            if (config.confirmEventCreation) {
              const res = await showMessageYesNoCancel(`Add '${restOfTaskWithoutDateTime}' at '${timeBlockString}'?`, ['Yes', 'No', 'Cancel'], 'Make event from time block')
              if (res === 'No') {
                continue // go to next time block
              } else if (res === 'Cancel') {
                logDebug('NPCalendar / writeTimeBlocksToCalendar', `User cancelled rest of the command.`)
                i = timeblockParas.length
                continue // cancel out of all time blocks
              }
            }
            const eventRange = { start: timeblockDateRange.start, end: timeblockDateRange.end }
            const eventID = (await createEventFromDateRange(restOfTaskWithoutDateTime, eventRange, calendarToWriteTo))

            if (eventID != null && eventID !== '') {
              // Remove time block string (if wanted)
              let thisParaContent = thisPara.content
              logDebug('NPCalendar / writeTimeBlocksToCalendar', `- starting with thisPara.content: '${thisParaContent}'`)
              if (config.removeTimeBlocksWhenProcessed) {
                thisParaContent = restOfTaskWithoutTimeBlock
              }
              // Add processedTag (if not empty)
              if (config.processedTagName !== '') {
                thisParaContent += ` ${String(config.processedTagName)}`
              }
              // Add event ID (if wanted)
              if (config.addEventID) {
                const createdEvent = await Calendar.eventByID(eventID) ?? null
                thisParaContent += ` ${createdEvent?.calendarItemLink ?? ''}`
              }
              thisPara.content = thisParaContent
              logDebug('NPCalendar / writeTimeBlocksToCalendar', `- setting thisPara.content -> '${thisParaContent}'`)
              // FIXME(@EduardMe): there's something odd going on here. Often 3 characters are left or repeated at the end of the line as a result of this
              if (showLoadingProgress && !config.confirmEventCreation) {
                CommandBar.showLoading(true, `Inserting Calendar Events\n(${i + 1}/${timeblockParas.length})`, (i + 1) / timeblockParas.length)
                await CommandBar.onMainThread()
                Editor.updateParagraph(thisPara)
                await CommandBar.onAsyncThread()
              } else {
                Editor.updateParagraph(thisPara)
              }
            } else {
              logError('NPcalendar / writeTimeBlocksToCalendar', `Error creating new event for '${timeBlockString}'`)
            }
          } else {
            logError('NPCalendar / writeTimeBlocksToCalendar', `Can't get DateRange from '${timeBlockString}'`)
          }
        }
      }
      if (showLoadingProgress && !config.confirmEventCreation) {
        await CommandBar.onMainThread()
        CommandBar.showLoading(false)
      }
    } else {
      logInfo('NPCalendar / writeTimeBlocksToCalendar()', `  -> No time blocks found.`)
      await showMessage(`Sorry, no time blocks found.`)
    }
  }
  catch (error) {
    logError('NPCalendar / writeTimeBlocksToCalendar', error.message)
    return // for completeness
  }
}

/**
 * Create a new calendar event
 * @author @jgclark
 *
 * @param {string} - eventTitle: title to use for this event
 * @param {DateRange} - dateRange: date range for this event
 * @param {string} - calendarName: name of calendar to write to. Needs to be writable!
 * @returns {string} CalendarItem of new event
 */
async function createEventFromDateRange(eventTitle: string, dateRange: DateRange, calendarName: string): Promise<string> {
  try {
    // logDebug('NPCalendar / createEventFromDateRange', `Starting with ${eventTitle} for calendar ${pref_calendarToWriteTo}`)
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
      // availability
    )
    const createdEvent = Calendar.add(event)
    const calendarDisplayName = calendarName !== '' ? calendarName : 'system default'
    if (createdEvent != null) {
      const newID = createdEvent.id ?? 'undefined'
      logInfo('NPCalendar / createEventFromDateRange', `-> Event created with id: ${newID} in ${calendarDisplayName} calendar `)
      return newID
    } else {
      logError('NPCalendar / createEventFromDateRange', `failed to create event in ${calendarDisplayName} calendar`)
      await showMessage(`Sorry, I failed to create event in ${calendarDisplayName} calendar`, 'OK', `Create Event Error`)
      return ''
    }
  }
  catch (error) {
    logError('NPCalendar / createEventFromDateRange', error.message)
    return 'error' // for completeness

  }
}

/**
 * Get list of events for the given day (specified as YYYYMMDD).
 * Now also filters out any that don't come from one of the calendars specified
 * in calendarSet.
 * @author @jgclark
 *
 * @param {string} dateStr YYYYMMDD date to use
 * @param {Array<string>} calendarSet optional list of calendars
 * @param {HourMinObj} start optional start time in the day
 * @param {HourMinObj} end optional end time in the day
 * @return {Array<TCalendarItem>} array of events as CalendarItems
 */
export async function getEventsForDay(
  dateStr: string,
  calendarSet: Array<string> = [],
  start: HourMinObj = { h: 0, m: 0 },
  end: HourMinObj = { h: 23, m: 59 },
): Promise<Array<TCalendarItem> | null> {
  try {
    // logDebug('NPCalendar / getEventsForDay', `starting with ${dateStr} ${calendarSet.toString()}`)
    clo(calendarSet)
    const y = parseInt(dateStr.slice(0, 4))
    const m = parseInt(dateStr.slice(4, 6))
    const d = parseInt(dateStr.slice(6, 8))
    const startOfDay = Calendar.dateFrom(y, m, d, start.h, start.m, 0)
    const endOfDay = Calendar.dateFrom(y, m, d, end.h, end.m, 59)
    // logDebug('NPCalendar / getEventsForDay', `starting for period ${startOfDay.toString()} - ${endOfDay.toString()}`)
    let eArr: Array<TCalendarItem> = await Calendar.eventsBetween(startOfDay, endOfDay)
    const allEventCount = eArr.length

    // Filter out parts of multi-day events not in today
    eArr = keepTodayPortionOnly(eArr, getDateFromUnhyphenatedDateString(dateStr) ?? new Date())

    // If we have a calendarSet list, use to weed out events that don't match .calendar
    if (calendarSet && calendarSet.length > 0) {
      eArr = eArr.filter((e) => calendarSet.some((c) => e.calendar === c))
      logDebug('NPCalendar / getEventsForDay', `- ${eArr.length} of ${allEventCount} Events kept for ${dateStr} after filtering with ${String(calendarSet)}`)
    } else {
      logDebug('NPCalendar / getEventsForDay', `- ${eArr.length} Events returned for ${dateStr}`)
    }
    return eArr
  }
  catch (error) {
    logError('NPCalendar / getEventsForDay', error.message)
    return null // for completeness
  }
}
