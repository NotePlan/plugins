// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getEvents
// Returns list of calendar events for a specific date
//--------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { keepTodayPortionOnly } from '@helpers/calendar.js'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of calendar events for a specific date
 * @param {Object} params - Request parameters
 * @param {string} params.dateString - Date string in YYYY-MM-DD format (optional, defaults to today)
 * @param {string} params.date - ISO date string (optional, alternative to dateString)
 * @param {Array<string>} params.calendars - Optional array of calendar titles to filter by (ignored if allCalendars=true)
 * @param {boolean} params.allCalendars - If true, include events from all calendars NotePlan can access (bypasses calendars filter)
 * @param {string} params.calendarFilterRegex - Optional regex pattern to filter calendars after fetching (applied when allCalendars=true)
 * @param {string} params.eventFilterRegex - Optional regex pattern to filter events by title after fetching
 * @param {boolean} params.includeReminders - If true, include reminders (default: false)
 * @param {Array<string>} params.reminderLists - Optional array of reminder list titles to filter reminders by
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {Promise<RequestResponse>}
 */
export async function getEvents(
  params: {
    dateString?: string,
    date?: string,
    calendars?: Array<string>,
    allCalendars?: boolean,
    calendarFilterRegex?: string,
    eventFilterRegex?: string,
    includeReminders?: boolean,
    reminderLists?: Array<string>,
  } = {},
  pluginJson: any,
): Promise<RequestResponse> {
  const startTime: number = Date.now()
  try {
    // Parse the date using moment.js for proper timezone handling
    // Prefer dateString (YYYY-MM-DD), fall back to date (ISO), or use today
    let targetMoment: any // moment.Moment type
    let isToday = false

    if (params.dateString) {
      // Parse YYYY-MM-DD format - moment handles this in local timezone
      targetMoment = moment(params.dateString, 'YYYY-MM-DD', true) // strict parsing
      if (!targetMoment.isValid()) {
        logError(pluginJson, `[np.Shared/requestHandlers] getEvents: Invalid dateString provided: "${String(params.dateString)}"`)
        return {
          success: false,
          message: `Invalid dateString provided`,
          data: null,
        }
      }
    } else if (params.date) {
      // Parse ISO date string - moment handles timezone conversion properly
      targetMoment = moment(params.date)
      if (!targetMoment.isValid()) {
        logError(pluginJson, `[np.Shared/requestHandlers] getEvents: Invalid date provided: "${String(params.date)}"`)
        return {
          success: false,
          message: `Invalid date provided`,
          data: null,
        }
      }
    } else {
      // Default to today - use Calendar.eventsToday() for better accuracy
      isToday = true
      targetMoment = moment().startOf('day')
    }

    // Normalize to start of day in local timezone using moment
    targetMoment = targetMoment.startOf('day')
    const targetDate: Date = targetMoment.toDate()

    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getEvents START: targetDate=${targetDate.toISOString()}, isToday=${String(isToday)}, localDate=${targetMoment.format('YYYY-MM-DD')}, input dateString="${String(
        params.dateString || '',
      )}", input date="${String(params.date || '')}"`,
    )

    // Get start and end of day using moment (handles timezone properly)
    const dayStartMoment = targetMoment.clone().startOf('day')
    const dayEndMoment = targetMoment.clone().endOf('day')

    // Convert to Calendar.dateFrom format (extract components from moment in local timezone)
    const year = dayStartMoment.year()
    const month = dayStartMoment.month() + 1 // Calendar.dateFrom uses 1-12 for months, moment uses 0-11
    const day = dayStartMoment.date()
    const dayStart = Calendar.dateFrom(year, month, day, 0, 0, 0)
    const dayEnd = Calendar.dateFrom(year, month, day, 23, 59, 59)

    logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents: Calendar.dateFrom params: year=${year}, month=${month}, day=${day}`)
    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getEvents: dayStart=${dayStart.toISOString()}, dayEnd=${dayEnd.toISOString()}, momentStart=${dayStartMoment.format()}, momentEnd=${dayEndMoment.format()}`,
    )
    logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents: dayStart local=${dayStartMoment.format('YYYY-MM-DD HH:mm:ss')}, dayEnd local=${dayEndMoment.format('YYYY-MM-DD HH:mm:ss')}`)

    // Fetch events for the day - use eventsToday() for today, eventsBetween() for other dates
    const eventsStartTime: number = Date.now()
    let calendarEvents: Array<TCalendarItem>
    if (isToday) {
      // Use eventsToday() for better accuracy when fetching today's events
      calendarEvents = await Calendar.eventsToday()
    } else {
      calendarEvents = await Calendar.eventsBetween(dayStart, dayEnd)
    }
    const eventsElapsed: number = Date.now() - eventsStartTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents Calendar.eventsBetween: elapsed=${eventsElapsed}ms, found=${calendarEvents.length} events`)

    // Filter to only events that are on this day
    let filteredEvents = keepTodayPortionOnly(calendarEvents, targetDate)

    // Filter by calendars if specified (only if allCalendars is not enabled)
    if (!params.allCalendars && params.calendars && Array.isArray(params.calendars) && params.calendars.length > 0) {
      filteredEvents = filteredEvents.filter((event: TCalendarItem) => {
        return params.calendars?.includes(event.calendar || '')
      })
      logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents FILTERED BY CALENDARS: ${filteredEvents.length} events after calendar filter`)
    }

    // Apply calendar filter regex if specified (when allCalendars is enabled)
    if (params.allCalendars && params.calendarFilterRegex && typeof params.calendarFilterRegex === 'string') {
      try {
        const calendarRegex = new RegExp(params.calendarFilterRegex)
        const beforeCount = filteredEvents.length
        filteredEvents = filteredEvents.filter((event: TCalendarItem) => {
          return calendarRegex.test(event.calendar || '')
        })
        logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents FILTERED BY CALENDAR REGEX: ${beforeCount} -> ${filteredEvents.length} events after regex filter`)
      } catch (error) {
        logError(pluginJson, `[np.Shared/requestHandlers] getEvents: Invalid calendarFilterRegex pattern: "${String(params.calendarFilterRegex)}", error: ${error.message}`)
      }
    }

    // Apply event title filter regex if specified
    if (params.eventFilterRegex && typeof params.eventFilterRegex === 'string') {
      try {
        const eventRegex = new RegExp(params.eventFilterRegex)
        const beforeCount = filteredEvents.length
        filteredEvents = filteredEvents.filter((event: TCalendarItem) => {
          return eventRegex.test(event.title || '')
        })
        logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents FILTERED BY EVENT REGEX: ${beforeCount} -> ${filteredEvents.length} events after regex filter`)
      } catch (error) {
        logError(pluginJson, `[np.Shared/requestHandlers] getEvents: Invalid eventFilterRegex pattern: "${String(params.eventFilterRegex)}", error: ${error.message}`)
      }
    }

    // Get reminders if requested
    let reminders: Array<TCalendarItem> = []
    if (params.includeReminders === true) {
      const remindersStartTime: number = Date.now()
      if (params.reminderLists && Array.isArray(params.reminderLists) && params.reminderLists.length > 0) {
        // Filter by reminder lists
        reminders = await Calendar.remindersByLists(params.reminderLists)
        logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents remindersByLists: elapsed=${Date.now() - remindersStartTime}ms, found=${reminders.length} reminders`)
      } else {
        // Get reminders for today
        reminders = await Calendar.remindersToday()
        logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents remindersToday: elapsed=${Date.now() - remindersStartTime}ms, found=${reminders.length} reminders`)
      }

      // Filter reminders to only those on this day
      reminders = keepTodayPortionOnly(reminders, targetDate)
      logDebug(pluginJson, `[np.Shared/requestHandlers] getEvents FILTERED REMINDERS: ${reminders.length} reminders after date filter`)
    }

    // Convert events to serializable format (Date objects to ISO strings)
    // Include all CalendarItem properties for full event information
    const serializedEvents = filteredEvents.map((event: TCalendarItem) => ({
      id: event.id || '',
      title: event.title || '',
      date: event.date ? event.date.toISOString() : new Date().toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      calendar: event.calendar || '',
      isAllDay: event.isAllDay || false,
      type: event.type || 'event',
      isCompleted: event.isCompleted || false,
      notes: event.notes || '',
      url: event.url || '',
      availability: event.availability ?? -1,
      attendees: event.attendees || [],
      attendeeNames: event.attendeeNames || [],
      calendarItemLink: event.calendarItemLink || '',
      location: event.location || '',
      isCalendarWritable: event.isCalendarWritable || false,
      isRecurring: event.isRecurring || false,
      occurrences: event.occurrences ? event.occurrences.map((d: Date) => d.toISOString()) : [],
    }))

    // Sort events: all-day first, then by time
    serializedEvents.sort((a: any, b: any) => {
      const aDate = new Date(a.date)
      const bDate = new Date(b.date)
      // Sort all-day events first, then by time
      if (a.isAllDay && !b.isAllDay) return -1
      if (!a.isAllDay && b.isAllDay) return 1
      if (a.isAllDay && b.isAllDay) {
        // Both all-day, sort by title
        return a.title.localeCompare(b.title)
      }
      // Both timed, sort by start time
      return aDate.getTime() - bDate.getTime()
    })

    // Convert reminders to serializable format and add to events
    // Include all CalendarItem properties for full reminder information
    if (reminders.length > 0) {
      const serializedReminders = reminders.map((reminder: TCalendarItem) => ({
        id: reminder.id || '',
        title: reminder.title || '',
        date: reminder.date ? reminder.date.toISOString() : new Date().toISOString(),
        endDate: reminder.endDate ? reminder.endDate.toISOString() : null,
        calendar: reminder.calendar || '',
        isAllDay: reminder.isAllDay || false,
        type: 'reminder', // Mark as reminder
        isCompleted: reminder.isCompleted || false,
        notes: reminder.notes || '',
        url: reminder.url || '',
        availability: reminder.availability ?? -1,
        attendees: reminder.attendees || [],
        attendeeNames: reminder.attendeeNames || [],
        calendarItemLink: reminder.calendarItemLink || '',
        location: reminder.location || '',
        isCalendarWritable: reminder.isCalendarWritable || false,
        isRecurring: reminder.isRecurring || false,
        occurrences: reminder.occurrences ? reminder.occurrences.map((d: Date) => d.toISOString()) : [],
      }))

      // Sort reminders: all-day first, then by time
      serializedReminders.sort((a: any, b: any) => {
        const aDate = new Date(a.date)
        const bDate = new Date(b.date)
        if (a.isAllDay && !b.isAllDay) return -1
        if (!a.isAllDay && b.isAllDay) return 1
        if (a.isAllDay && b.isAllDay) {
          return a.title.localeCompare(b.title)
        }
        return aDate.getTime() - bDate.getTime()
      })

      // Merge reminders with events, keeping all-day events first, then by time
      serializedEvents.push(...serializedReminders)
      serializedEvents.sort((a: any, b: any) => {
        const aDate = new Date(a.date)
        const bDate = new Date(b.date)
        if (a.isAllDay && !b.isAllDay) return -1
        if (!a.isAllDay && b.isAllDay) return 1
        if (a.isAllDay && b.isAllDay) {
          return a.title.localeCompare(b.title)
        }
        return aDate.getTime() - bDate.getTime()
      })
    }

    const totalElapsed: number = Date.now() - startTime
    logDebug(
      pluginJson,
      `[np.Shared/requestHandlers] getEvents COMPLETE: totalElapsed=${totalElapsed}ms, found=${serializedEvents.length} items (${filteredEvents.length} events, ${reminders.length} reminders)`,
    )

    return {
      success: true,
      data: serializedEvents,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getEvents ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get events: ${error.message}`,
      data: null,
    }
  }
}



