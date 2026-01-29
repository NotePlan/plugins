// @flow
//--------------------------------------------------------------------------
// Data Handlers - Data-fetching functions for forms
// These functions are separated from requestHandlers.js to break circular dependencies
//--------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { getAllNotesAsOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { logDebug, logError, logInfo } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { keepTodayPortionOnly } from '@helpers/calendar.js'
import { type RequestResponse } from './shared/types'

/**
 * Get list of folders with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Exclude trash folder (default: true)
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
 * @returns {RequestResponse}
 */
export function getFolders(params: { excludeTrash?: boolean, space?: ?string } = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    const spaceParam = params.space
    logDebug(
      pluginJson,
      `[DIAG] getFolders START: excludeTrash=${String(params.excludeTrash ?? true)}, space=${spaceParam != null ? String(spaceParam) : 'null/undefined (all spaces)'}`,
    )

    const excludeTrash = params.excludeTrash ?? true
    // Don't default spaceId - if null/undefined, don't filter (show all spaces)
    // Empty string means Private space only, teamspace ID means specific teamspace only
    const spaceId = spaceParam
    const exclusions = excludeTrash ? ['@Trash'] : []

    // Get all folders except exclusions. Include special folders (@Templates, @Archive, etc.) and teamspaces, sorted
    const foldersStartTime: number = Date.now()
    let folders = getFoldersMatching([], false, exclusions, false, true)
    const foldersElapsed: number = Date.now() - foldersStartTime
    logDebug(pluginJson, `[DIAG] getFolders getFoldersMatching: elapsed=${foldersElapsed}ms, found=${folders.length} folders`)

    // Filter by space if specified (empty string = Private, teamspace ID = specific teamspace, null/undefined = all spaces)
    if (spaceId !== null && spaceId !== undefined) {
      folders = folders.filter((folder: string) => {
        // Root folder - only include for Private space
        if (folder === '/') {
          return spaceId === ''
        }

        // Check if folder is a teamspace folder
        if (folder.startsWith('%%NotePlanCloud%%')) {
          const folderDetails = parseTeamspaceFilename(folder)
          if (spaceId === '') {
            // Private space filter - exclude all teamspace folders
            return false
          } else {
            // Specific teamspace filter - only include folders from that teamspace
            return spaceId === folderDetails.teamspaceID
          }
        } else {
          // Regular folder (not teamspace)
          if (spaceId === '') {
            // Private space filter - include regular folders
            return true
          } else {
            // Specific teamspace filter - exclude regular folders
            return false
          }
        }
      })
      logDebug(pluginJson, `[DIAG] getFolders FILTERED: ${folders.length} folders after space filter (space=${spaceId || 'Private'})`)
    }

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getFolders COMPLETE: totalElapsed=${totalElapsed}ms, found=${folders.length} folders`)

    if (folders.length === 0) {
      logInfo(pluginJson, `getFolders: No folders found, returning root folder only`)
      return {
        success: true,
        message: 'No folders found, returning root folder',
        data: ['/'],
      }
    }

    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getFolders ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get folders: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get list of notes with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.includeCalendarNotes - Include calendar notes (default: false)
 * @param {boolean} params.includePersonalNotes - Include personal/project notes (default: true)
 * @param {boolean} params.includeRelativeNotes - Include relative notes like <today>, <thisweek>, etc. (default: false)
 * @param {boolean} params.includeTeamspaceNotes - Include teamspace notes (default: true)
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace)
 * @returns {RequestResponse}
 */
export function getNotes(
  params: {
    includeCalendarNotes?: boolean,
    includePersonalNotes?: boolean,
    includeRelativeNotes?: boolean,
    includeTeamspaceNotes?: boolean,
    space?: string, // Space ID (empty string = Private, teamspace ID = specific teamspace)
  } = {},
): RequestResponse {
  const startTime: number = Date.now()
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true
    const spaceId = params.space ?? '' // Empty string = Private (default)

    logDebug(
      pluginJson,
      `[DIAG] getNotes START: includeCalendarNotes=${String(includeCalendarNotes)}, includePersonalNotes=${String(includePersonalNotes)}, includeRelativeNotes=${String(
        includeRelativeNotes,
      )}, includeTeamspaceNotes=${String(includeTeamspaceNotes)}, space=${spaceId || 'Private'}`,
    )

    const allNotes: Array<any> = []

    // Get project notes and calendar notes separately, then filter
    const processStartTime: number = Date.now()

    // Get project notes (personal notes)
    if (includePersonalNotes) {
      const projectNotes = getAllNotesAsOptions(false, true) // Don't include calendar notes here
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes PROJECT: elapsed=${processElapsed}ms, found=${projectNotes.length} project notes`)

      // Filter teamspace notes if needed, and also filter by space if specified
      for (const note of projectNotes) {
        const isTeamspaceNote = note.isTeamspaceNote === true
        const noteTeamspaceID = note.teamspaceID || null

        // First check if we should include teamspace notes at all
        if (includeTeamspaceNotes || !isTeamspaceNote) {
          // If space filter is specified, only include notes from that space
          if (spaceId !== '') {
            // Space filter is set - only include notes from that specific space
            if (spaceId === noteTeamspaceID) {
              allNotes.push(note)
            }
            // Skip notes that don't match the space filter
          } else {
            // No space filter (Private) - only include private notes (non-teamspace)
            if (!isTeamspaceNote) {
              allNotes.push(note)
            }
            // Skip teamspace notes when space filter is Private (empty string)
          }
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes PROJECT FILTERED: ${allNotes.length} personal notes after teamspace and space filter`)
    }

    // Get calendar notes if requested
    if (includeCalendarNotes) {
      const calendarStartTime: number = Date.now()
      const calendarNotes = getAllNotesAsOptions(true, true) // Include calendar notes
      const calendarElapsed: number = Date.now() - calendarStartTime
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR: elapsed=${calendarElapsed}ms, found=${calendarNotes.length} calendar notes`)

      // Filter teamspace notes if needed, and only include calendar notes (not project notes)
      // Also filter by space if specified
      for (const note of calendarNotes) {
        const isCalendarNote = note.type === 'Calendar'
        const isTeamspaceNote = note.isTeamspaceNote === true
        const noteTeamspaceID = note.teamspaceID || null

        // Only include if it's actually a calendar note (not a project note that got mixed in)
        if (isCalendarNote) {
          // If space filter is specified, only include notes from that space
          if (spaceId !== '') {
            // Space filter is set - only include notes from that specific space
            if (spaceId === noteTeamspaceID) {
              allNotes.push(note)
            }
            // Skip notes that don't match the space filter
          } else {
            // No space filter (Private) - only include private notes (non-teamspace)
            if (!isTeamspaceNote) {
              allNotes.push(note)
            }
            // Skip teamspace notes when space filter is Private (empty string)
          }
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR FILTERED: ${allNotes.length} total notes after calendar filter`)
    }

    logDebug(pluginJson, `[DIAG] getNotes FILTERED: ${allNotes.length} notes after filtering`)

    // Get relative notes (like <today>, <thisweek>, etc.)
    if (includeRelativeNotes) {
      const processStartTime: number = Date.now()
      const relativeNotes = getRelativeNotesAsOptions(true) // Include decoration
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes RELATIVE: elapsed=${processElapsed}ms, found=${relativeNotes.length} relative notes`)
      allNotes.push(...relativeNotes)
    }

    // Re-sort all notes together by changedDate (most recent first), but put relative notes at the top
    allNotes.sort((a: any, b: any) => {
      // Relative notes (those with filename starting with '<') should appear first
      const aIsRelative = typeof a.filename === 'string' && a.filename.startsWith('<')
      const bIsRelative = typeof b.filename === 'string' && b.filename.startsWith('<')

      if (aIsRelative && !bIsRelative) return -1
      if (!aIsRelative && bIsRelative) return 1

      // For non-relative notes, sort by changedDate (most recent first)
      const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
      const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
      return bDate - aDate
    })

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getNotes COMPLETE: totalElapsed=${totalElapsed}ms, found=${allNotes.length} total notes`)

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getNotes ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  }
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
        logError(pluginJson, `getEvents: Invalid dateString provided: "${String(params.dateString)}"`)
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
        logError(pluginJson, `getEvents: Invalid date provided: "${String(params.date)}"`)
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
      `[DIAG] getEvents START: targetDate=${targetDate.toISOString()}, isToday=${String(isToday)}, localDate=${targetMoment.format('YYYY-MM-DD')}, input dateString="${String(
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

    logDebug(pluginJson, `[DIAG] getEvents: Calendar.dateFrom params: year=${year}, month=${month}, day=${day}`)
    logDebug(
      pluginJson,
      `[DIAG] getEvents: dayStart=${dayStart.toISOString()}, dayEnd=${dayEnd.toISOString()}, momentStart=${dayStartMoment.format()}, momentEnd=${dayEndMoment.format()}`,
    )
    logDebug(pluginJson, `[DIAG] getEvents: dayStart local=${dayStartMoment.format('YYYY-MM-DD HH:mm:ss')}, dayEnd local=${dayEndMoment.format('YYYY-MM-DD HH:mm:ss')}`)

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
    logDebug(pluginJson, `[DIAG] getEvents Calendar.eventsBetween: elapsed=${eventsElapsed}ms, found=${calendarEvents.length} events`)

    // Filter to only events that are on this day
    let filteredEvents = keepTodayPortionOnly(calendarEvents, targetDate)

    // Filter by calendars if specified (only if allCalendars is not enabled)
    if (!params.allCalendars && params.calendars && Array.isArray(params.calendars) && params.calendars.length > 0) {
      filteredEvents = filteredEvents.filter((event: TCalendarItem) => {
        return params.calendars?.includes(event.calendar || '')
      })
      logDebug(pluginJson, `[DIAG] getEvents FILTERED BY CALENDARS: ${filteredEvents.length} events after calendar filter`)
    }

    // Apply calendar filter regex if specified (when allCalendars is enabled)
    if (params.allCalendars && params.calendarFilterRegex && typeof params.calendarFilterRegex === 'string') {
      try {
        const calendarRegex = new RegExp(params.calendarFilterRegex)
        const beforeCount = filteredEvents.length
        filteredEvents = filteredEvents.filter((event: TCalendarItem) => {
          return calendarRegex.test(event.calendar || '')
        })
        logDebug(pluginJson, `[DIAG] getEvents FILTERED BY CALENDAR REGEX: ${beforeCount} -> ${filteredEvents.length} events after regex filter`)
      } catch (error) {
        logError(pluginJson, `[DIAG] getEvents: Invalid calendarFilterRegex pattern: "${String(params.calendarFilterRegex)}", error: ${error.message}`)
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
        logDebug(pluginJson, `[DIAG] getEvents FILTERED BY EVENT REGEX: ${beforeCount} -> ${filteredEvents.length} events after regex filter`)
      } catch (error) {
        logError(pluginJson, `[DIAG] getEvents: Invalid eventFilterRegex pattern: "${String(params.eventFilterRegex)}", error: ${error.message}`)
      }
    }

    // Get reminders if requested
    let reminders: Array<TCalendarItem> = []
    if (params.includeReminders === true) {
      const remindersStartTime: number = Date.now()
      if (params.reminderLists && Array.isArray(params.reminderLists) && params.reminderLists.length > 0) {
        // Filter by reminder lists
        reminders = await Calendar.remindersByLists(params.reminderLists)
        logDebug(pluginJson, `[DIAG] getEvents remindersByLists: elapsed=${Date.now() - remindersStartTime}ms, found=${reminders.length} reminders`)
      } else {
        // Get reminders for today
        reminders = await Calendar.remindersToday()
        logDebug(pluginJson, `[DIAG] getEvents remindersToday: elapsed=${Date.now() - remindersStartTime}ms, found=${reminders.length} reminders`)
      }

      // Filter reminders to only those on this day
      reminders = keepTodayPortionOnly(reminders, targetDate)
      logDebug(pluginJson, `[DIAG] getEvents FILTERED REMINDERS: ${reminders.length} reminders after date filter`)
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
      `[DIAG] getEvents COMPLETE: totalElapsed=${totalElapsed}ms, found=${serializedEvents.length} items (${filteredEvents.length} events, ${reminders.length} reminders)`,
    )

    return {
      success: true,
      data: serializedEvents,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getEvents ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get events: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get all hashtags from DataStore
 * @param {Object} _params - Not used, kept for consistency
 * @returns {RequestResponse} Array of hashtags (without # prefix)
 */
export function getHashtags(_params: Object = {}): RequestResponse {
  try {
    // DataStore.hashtags returns items without # prefix
    const hashtags = DataStore.hashtags || []
    logDebug(pluginJson, `getHashtags: returning ${hashtags.length} hashtags`)
    return {
      success: true,
      data: hashtags,
    }
  } catch (error) {
    logError(pluginJson, `getHashtags error: ${error.message}`)
    return {
      success: false,
      message: error.message,
      data: [],
    }
  }
}

/**
 * Get all mentions from DataStore
 * @param {Object} _params - Not used, kept for consistency
 * @returns {RequestResponse} Array of mentions (without @ prefix)
 */
export function getMentions(_params: Object = {}): RequestResponse {
  try {
    // DataStore.mentions returns items without @ prefix
    const mentions = DataStore.mentions || []
    logDebug(pluginJson, `getMentions: returning ${mentions.length} mentions`)
    return {
      success: true,
      data: mentions,
    }
  } catch (error) {
    logError(pluginJson, `getMentions error: ${error.message}`)
    return {
      success: false,
      message: error.message,
      data: [],
    }
  }
}

/**
 * Get all teamspace definitions
 * @param {Object} _params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
export function getTeamspaces(_params: Object = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getTeamspaces START`)

    const teamspacesStartTime: number = Date.now()
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspacesElapsed: number = Date.now() - teamspacesStartTime
    logDebug(pluginJson, `[DIAG] getTeamspaces getAllTeamspaceIDsAndTitles: elapsed=${teamspacesElapsed}ms, found=${teamspaces.length} teamspaces`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getTeamspaces COMPLETE: totalElapsed=${totalElapsed}ms, found=${teamspaces.length} teamspaces`)

    return {
      success: true,
      data: teamspaces,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getTeamspaces ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get teamspaces: ${error.message}`,
      data: null,
    }
  }
}
