// @flow

/**
 * Request Handlers for Forms Plugin
 *
 * This file contains handlers for request/response pattern communication from React to NotePlan.
 * Each handler should return a standardized response object with:
 * - success: boolean
 * - message: string (optional, for error messages or informational messages)
 * - data: any (the actual response data)
 *
 * @author @dwertheimer
 */

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { getAllNotesAsOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate, formatFormFieldsAsCodeBlock, getFormTemplateList } from './templateIO'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFoldersMatching, getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/paragraph'
import { createRunPluginCallbackUrl } from '@helpers/general'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { showMessage } from '@helpers/userInput'
import { getHeadingsFromNote, getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { getNoteByFilename, getNote } from '@helpers/note'
import { getNoteContentAsHTML } from '@helpers/HTMLView'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { updateFrontMatterVars, ensureFrontmatter, endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import { saveCodeBlockToNote, loadCodeBlockFromNote, replaceCodeBlockContent } from '@helpers/codeBlocks'
import { parseObjectString } from '@helpers/stringTransforms'
import { replaceContentUnderHeading, removeContentUnderHeading } from '@helpers/NPParagraph'
import { initPromisePolyfills, waitForCondition } from '@helpers/promisePolyfill'
import { keepTodayPortionOnly } from '@helpers/calendar.js'
import { testFormFieldRender } from './FormFieldRenderTest'
// Form-specific handlers are now in their respective handler files:
// - formBrowserHandlers.js: getFormTemplates, getFormFields, handleSubmitForm, handleOpenFormBuilder
// - formBuilderHandlers.js: handleCreateProcessingTemplate, handleOpenNote, handleCopyFormUrl, handleDuplicateForm
// - formSubmitHandlers.js: handleFormSubmitAction, handleUnknownAction

// Initialize Promise polyfills early
initPromisePolyfills()

/**
 * Standardized response type for all request handlers
 */
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Test function to verify request handlers are working correctly
 * Call this from NotePlan Command Bar: "Test Request Handlers"
 * @returns {Promise<void>}
 */
export async function testRequestHandlers(): Promise<void> {
  try {
    logInfo(pluginJson, '🧪 Testing request handlers...')

    // Test getFolders
    logInfo(pluginJson, 'Testing getFolders...')
    const foldersResult = getFolders({ excludeTrash: true })
    logInfo(pluginJson, `getFolders: success=${String(foldersResult.success)}, folders=${foldersResult.data?.length ?? 0}`)
    if (foldersResult.data && foldersResult.data.length > 0) {
      logInfo(pluginJson, `First 3 folders: ${foldersResult.data.slice(0, 3).join(', ')}`)
    }

    // Test getNotes
    logInfo(pluginJson, 'Testing getNotes...')
    const notesResult = getNotes({ includeCalendarNotes: false })
    logInfo(pluginJson, `getNotes: success=${String(notesResult.success)}, notes=${notesResult.data?.length ?? 0}`)
    if (notesResult.data && notesResult.data.length > 0) {
      logInfo(
        pluginJson,
        `First 3 notes: ${notesResult.data
          .slice(0, 3)
          .map((n: any) => n.title || n.filename)
          .join(', ')}`,
      )
    }

    // Test getTeamspaces
    logInfo(pluginJson, 'Testing getTeamspaces...')
    const teamspacesResult = getTeamspaces({})
    logInfo(pluginJson, `getTeamspaces: success=${String(teamspacesResult.success)}, teamspaces=${teamspacesResult.data?.length ?? 0}`)
    if (teamspacesResult.data && teamspacesResult.data.length > 0) {
      logInfo(pluginJson, `Teamspaces: ${teamspacesResult.data.map((ts: any) => `${ts.title} (${ts.id})`).join(', ')}`)
    }

    logInfo(pluginJson, '✅ All request handlers tested successfully! Check Plugin Console for details.')
    await showMessage('Request handlers test complete! Check Plugin Console (NotePlan > Help > Plugin Console) for details.')
  } catch (error) {
    logError(pluginJson, `❌ Error testing request handlers: ${error.message}`)
    await showMessage(`Error testing request handlers: ${error.message}`)
  }
}

/**
 * Get list of folders (excluding trash)
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude @Trash folder (default: true)
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
 * Get list of available calendar titles
 * NOTE: There is a known bug in NotePlan's Calendar.availableCalendarTitles() API that causes
 * it to only return calendars with write access, even when writeOnly=false. This means the
 * list may be incomplete and missing read-only calendars that NotePlan can still access events from.
 * @param {Object} params - Request parameters
 * @param {boolean} params.writeOnly - If true, only return calendars with write access (default: false)
 * @returns {RequestResponse}
 */
export function getAvailableCalendars(params: { writeOnly?: boolean } = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    const writeOnly = params.writeOnly ?? false
    logDebug(pluginJson, `[DIAG] getAvailableCalendars START: writeOnly=${String(writeOnly)}`)

    // NOTE: Bug in NotePlan API - availableCalendarTitles may only return writeable calendars
    // even when writeOnly=false. This is why we offer "All NotePlan Enabled Calendars" option.
    const calendars = Calendar.availableCalendarTitles(writeOnly || false)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getAvailableCalendars COMPLETE: totalElapsed=${totalElapsed}ms, found=${calendars.length} calendars`)

    return {
      success: true,
      data: calendars,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getAvailableCalendars ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get calendars: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get list of available reminder list titles
 * @param {Object} params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
export function getAvailableReminderLists(_params: Object = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getAvailableReminderLists START`)

    // NOTE: Calendar.availableReminderListTitles() may return an empty array if the user
    // has no reminder lists configured in NotePlan. This is not an error condition.
    const reminderLists = Calendar.availableReminderListTitles()

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getAvailableReminderLists COMPLETE: totalElapsed=${totalElapsed}ms, found=${reminderLists.length} reminder lists`)

    if (reminderLists.length === 0) {
      logDebug(pluginJson, `[DIAG] getAvailableReminderLists: Empty result - user may not have any reminder lists configured in NotePlan`)
    }

    return {
      success: true,
      data: reminderLists,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getAvailableReminderLists ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get reminder lists: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get teamspace definitions for folder decoration
 * @param {Object} params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
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

/**
 * Create a new folder
 * @param {Object} params - Request parameters
 * @param {string} params.folderPath - Full path of the folder to create (e.g., '/Projects/NewProject' or 'NewFolder')
 * @returns {RequestResponse}
 */
export function createFolder(params: { folderPath: string }): RequestResponse {
  try {
    logDebug(pluginJson, `createFolder: Creating folder="${params.folderPath}"`)

    if (!params.folderPath || !params.folderPath.trim()) {
      return {
        success: false,
        message: 'Folder path is required',
        data: null,
      }
    }

    const folderPath = params.folderPath.trim()

    // Check if folder already exists
    const existingFolders = DataStore.folders || []
    if (existingFolders.includes(folderPath)) {
      logDebug(pluginJson, `createFolder: Folder already exists: "${folderPath}"`)
      return {
        success: true,
        message: 'Folder already exists',
        data: folderPath,
      }
    }

    // Create the folder
    DataStore.createFolder(folderPath)

    logDebug(pluginJson, `createFolder: Successfully created folder: "${folderPath}"`)

    return {
      success: true,
      data: folderPath,
    }
  } catch (error) {
    logError(pluginJson, `createFolder: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create folder: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Create a new note
 * @param {Object} params - Request parameters
 * @param {string} params.noteTitle - Title of the new note
 * @param {string} params.folder - Folder path to create the note in (default: '/')
 * @returns {RequestResponse}
 */
export function createNote(params: { noteTitle: string, folder?: string }): RequestResponse {
  const startTime: number = Date.now()
  try {
    const { noteTitle, folder = '/' } = params

    if (!noteTitle || !noteTitle.trim()) {
      return {
        success: false,
        message: 'Note title is required',
        data: null,
      }
    }

    logDebug(pluginJson, `[DIAG] createNote START: noteTitle="${noteTitle}", folder="${folder}"`)

    // Create the note using DataStore.newNote
    const filename = DataStore.newNote(noteTitle.trim(), folder)

    if (filename) {
      const totalElapsed: number = Date.now() - startTime
      logDebug(pluginJson, `[DIAG] createNote COMPLETE: totalElapsed=${totalElapsed}ms, filename="${filename}"`)
      return {
        success: true,
        data: filename,
      }
    } else {
      const totalElapsed: number = Date.now() - startTime
      logError(pluginJson, `[DIAG] createNote ERROR: totalElapsed=${totalElapsed}ms, DataStore.newNote returned null`)
      return {
        success: false,
        message: 'Failed to create note: DataStore.newNote returned null',
        data: null,
      }
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] createNote ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to create note: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Save autosave content to a note
 * @param {Object} params - Request parameters
 * @param {string} params.filename - Filename pattern (e.g., "@Trash/Autosave-2025-12-30T23-51-09")
 * @param {string} params.content - Content to save (JSON code block)
 * @param {Object} params.formState - Form state object (for reference)
 * @returns {RequestResponse}
 */
export async function saveAutosave(params: { filename: string, content: string, formState?: Object }): Promise<RequestResponse> {
  const startTime: number = Date.now()
  try {
    const { filename, content } = params

    if (!filename || !content) {
      return {
        success: false,
        message: 'Filename and content are required',
        data: null,
      }
    }

    logDebug(pluginJson, `saveAutosave: Saving to "${filename}"`)

    // Parse filename pattern: "@Trash/Autosave-2025-12-30T23-51-09"
    // Extract folder and note title
    const parts = filename.split('/')
    let folder = '/'
    let noteTitle = filename

    if (parts.length > 1) {
      folder = parts.slice(0, -1).join('/')
      noteTitle = parts[parts.length - 1]
    } else if (filename.startsWith('@')) {
      // If it starts with @ but no slash, treat the whole thing as the note title
      noteTitle = filename
      folder = '/'
    }

    logDebug(pluginJson, `saveAutosave: Parsed folder="${folder}", noteTitle="${noteTitle}"`)

    // Try to find existing note first by searching in the folder
    // Note: DataStore.projectNotes excludes notes in @Trash, so we need to use
    // projectNoteByTitle with searchAllFolders: true for trash folder
    let note: ?TNote = null
    const isTrashFolder = folder === '@Trash' || folder.startsWith('@Trash/')

    if (isTrashFolder) {
      // For @Trash folder, use projectNoteByTitle with searchAllFolders: true
      // because projectNotes excludes trash notes
      // Search by filename pattern since NotePlan appends numbers to filenames, not titles
      const potentialNotes = DataStore.projectNoteByTitle(noteTitle, true, true) ?? []
      
      // First, try to find exact title match
      let matchingNotes = potentialNotes.filter((n) => {
        const noteFolder = getFolderFromFilename(n.filename)
        const noteDisplayTitle = displayTitle(n)
        return noteFolder === folder && noteDisplayTitle === noteTitle
      })
      
      // If no exact match, search by filename pattern (NotePlan appends " 2", " 3", etc. to filenames)
      if (matchingNotes.length === 0) {
        // Extract base filename without extension (e.g., "Autosave-Jeff-Meeting-Form-2025-12-31T08-40-49")
        const baseFilename = noteTitle.replace(/\.(md|txt)$/i, '')
        matchingNotes = potentialNotes.filter((n) => {
          const noteFolder = getFolderFromFilename(n.filename)
          if (noteFolder !== folder) return false
          
          // Get filename without folder and extension
          const noteFilename = n.filename.split('/').pop() || ''
          const noteFilenameBase = noteFilename.replace(/\.(md|txt)$/i, '').replace(/\s+\d+$/, '') // Remove number suffix
          
          // Match if base filename matches (ignoring number suffix)
          return noteFilenameBase === baseFilename || noteFilenameBase === noteTitle
        })
      }
      
      if (matchingNotes.length > 0) {
        // Prefer exact title match, otherwise use first match (which should be the original, not numbered)
        note = matchingNotes.find((n) => displayTitle(n) === noteTitle) || matchingNotes[0]
        logDebug(pluginJson, `saveAutosave: Found existing note in trash folder "${folder}": ${note.filename}`)
      }
    } else if (folder === '/') {
      // Root folder - find notes without folder path
      const rootNotes = DataStore.projectNotes.filter((n) => {
        const noteFolder = getFolderFromFilename(n.filename)
        return noteFolder === '/' && displayTitle(n) === noteTitle
      })
      if (rootNotes.length > 0) {
        note = rootNotes[0]
        logDebug(pluginJson, `saveAutosave: Found existing note in root: ${note.filename}`)
      }
    } else {
      // Specific folder - find notes in that folder
      const folderNotes = DataStore.projectNotes.filter((n) => {
        const noteFolder = getFolderFromFilename(n.filename)
        return noteFolder === folder && displayTitle(n) === noteTitle
      })
      if (folderNotes.length > 0) {
        note = folderNotes[0]
        logDebug(pluginJson, `saveAutosave: Found existing note in folder "${folder}": ${note.filename}`)
      }
    }

    // If note not found, create it
    // For @Trash, we need to use a different approach since getOrMakeRegularNoteInFolder doesn't search trash properly
    if (!note) {
      logDebug(pluginJson, `saveAutosave: Note not found, creating new note`)
      if (isTrashFolder) {
        // For @Trash, create the note directly using DataStore.newNote (synchronous, not async)
        const noteFilename = DataStore.newNote(noteTitle, folder)
        if (noteFilename) {
          // Try to get the note by filename first
          note = await DataStore.projectNoteByFilename(noteFilename)
          if (!note) {
            // Wait a bit for the note to be available in the cache
            await new Promise((resolve) => setTimeout(resolve, 100))
            // Try again
            note = await DataStore.projectNoteByFilename(noteFilename)
            if (!note) {
              // If that fails, try to find it using projectNoteByTitle with searchAllFolders
              const foundNotes = DataStore.projectNoteByTitle(noteTitle, true, true) ?? []
              const matchingNotes = foundNotes.filter((n) => {
                const noteFolder = getFolderFromFilename(n.filename)
                return noteFolder === folder && displayTitle(n) === noteTitle
              })
              if (matchingNotes.length > 0) {
                note = matchingNotes[0]
                logDebug(pluginJson, `saveAutosave: Found newly created note in trash: ${note.filename}`)
              }
            }
          }
          if (note) {
            // Update cache to ensure note is available
            DataStore.updateCache(note, true)
            logDebug(pluginJson, `saveAutosave: Created/found note in trash: ${note.filename}`)
          }
        }
      } else {
        // For other folders, use getOrMakeRegularNoteInFolder
        note = await getOrMakeRegularNoteInFolder(noteTitle, folder)
      }
      
      if (!note) {
        logError(pluginJson, `saveAutosave: Failed to get or create note "${noteTitle}" in folder "${folder}"`)
        return {
          success: false,
          message: `Failed to get or create note "${noteTitle}"`,
          data: null,
        }
      }
      logDebug(pluginJson, `saveAutosave: Created/found note: ${note.filename}`)
    }

    // Extract JSON content from the code block (content comes as "```json\n{...}\n```")
    // Remove the code block fences to get just the JSON content
    let jsonContent = content
    if (content.startsWith('```')) {
      // Remove opening fence (e.g., "```json\n")
      const lines = content.split('\n')
      if (lines.length > 1) {
        // Skip first line (fence) and last line (closing fence), join the rest
        jsonContent = lines.slice(1, -1).join('\n')
      } else {
        // Fallback: try to strip fences manually
        jsonContent = content.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '')
      }
    }

    // Use replaceCodeBlockContent to save to a code block (replaces existing or adds new)
    // Use fixed code block type "autosave" so each save replaces the previous one in the same note
    const codeBlockType = 'autosave'
    const success = replaceCodeBlockContent(note, codeBlockType, jsonContent, pluginJson.id)

    if (!success) {
      logError(pluginJson, `saveAutosave: Failed to save code block to note`)
      return {
        success: false,
        message: 'Failed to save autosave content',
        data: null,
      }
    }

    // Add xcallback URL outside the codeblock for restoring the form
    // Parse the formState to get the form title if available
    let formStateObj: any = {}
    try {
      formStateObj = params.formState || JSON.parse(jsonContent)
    } catch (e) {
      logDebug(pluginJson, `saveAutosave: Could not parse formState, using empty object`)
    }

    // Create xcallback URL to restore the form
    // The restore command will need the autosave filename to restore from
    const restoreCommand = 'Restore form from autosave'
    const restoreUrl = createRunPluginCallbackUrl(pluginJson['plugin.id'], restoreCommand, [filename])

    // Add the restore link to the note content (outside the codeblock)
    // Check if the link already exists in the note
    const restoreLinkText = `[Restore form from autosave](${restoreUrl})`
    const noteContent = note.content || ''
    
    // Remove existing restore link if present (look for the pattern, including any trailing newline and blank lines)
    // Remove the link and up to 2 following newlines (to clean up extra blank lines)
    let updatedContent = noteContent.replace(/\[Restore form from autosave\]\(noteplan:\/\/[^\)]+\)\n{0,2}/g, '')
    
    // Split content into lines for easier manipulation
    const lines = updatedContent.split('\n')
    
    // Find where to insert the restore link
    // If note has frontmatter, insert after frontmatter; otherwise insert at index 1 (after title)
    const fmEndIndex = endOfFrontmatterLineIndex(note)
    let insertIndex = 1 // Default: after title line (index 0)
    
    if (fmEndIndex !== -1) {
      // Has frontmatter, insert after it
      insertIndex = fmEndIndex + 1
    }
    
    // Check if restore link already exists (shouldn't happen after removal, but be safe)
    const existingLinkIndex = lines.findIndex((line) => line.includes('[Restore form from autosave]'))
    if (existingLinkIndex === -1) {
      // Only insert if it doesn't already exist
      // Check what's at the insert position and after to avoid adding extra blank lines
      const lineAtInsert = lines[insertIndex] || ''
      const lineAfterInsert = lines[insertIndex + 1] || ''
      
      // If the line at insert position is already blank, just insert the link
      if (lineAtInsert.trim() === '') {
        lines[insertIndex] = restoreLinkText
      } else {
        // Insert link and ensure exactly one blank line after it
        lines.splice(insertIndex, 0, restoreLinkText)
        // If the next line isn't blank, add one blank line
        if (insertIndex + 1 >= lines.length || lines[insertIndex + 1].trim() !== '') {
          lines.splice(insertIndex + 1, 0, '')
        }
      }
    } else {
      // Link exists, just update it (don't add extra blank lines)
      lines[existingLinkIndex] = restoreLinkText
    }
    updatedContent = lines.join('\n')

    // Update the note content
    note.content = updatedContent

    // Update cache
    DataStore.updateCache(note, true)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `saveAutosave: Successfully saved to "${filename}", totalElapsed=${totalElapsed}ms`)
    return {
      success: true,
      data: note.filename,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `saveAutosave: Error saving autosave, totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Error saving autosave: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get headings from a note
 * @param {Object} params - Request parameters
 * @param {string} params.noteFilename - Filename of the note to get headings from
 * @param {boolean} params.optionAddTopAndBottom - Whether to add "top of note" and "bottom of note" options (default: true)
 * @param {boolean} params.includeArchive - Whether to include headings in Archive section (default: false)
 * @returns {RequestResponse}
 */
export function getHeadings(params: { noteFilename: string, optionAddTopAndBottom?: boolean, includeArchive?: boolean }): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getHeadings START: noteFilename="${params.noteFilename}"`)

    if (!params.noteFilename) {
      return {
        success: false,
        message: 'Note filename is required',
        data: null,
      }
    }

    // Get the note by filename
    const note = getNoteByFilename(params.noteFilename)
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${params.noteFilename}`,
        data: null,
      }
    }

    // Get headings from the note
    const optionAddTopAndBottom = params.optionAddTopAndBottom ?? true
    const includeArchive = params.includeArchive ?? false
    const headings = getHeadingsFromNote(note, false, optionAddTopAndBottom, false, includeArchive)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getHeadings COMPLETE: totalElapsed=${totalElapsed}ms, found=${headings.length} headings`)

    return {
      success: true,
      data: headings,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getHeadings ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get headings: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Render markdown text to HTML
 * @param {Object} params - Request parameters
 * @param {string} params.markdown - Markdown text to render
 * @returns {RequestResponse}
 */
export async function renderMarkdown(params: { markdown: string }): Promise<RequestResponse> {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] renderMarkdown START: markdown length=${params.markdown?.length || 0}`)

    if (!params.markdown) {
      return {
        success: false,
        message: 'Markdown text is required',
        data: null,
      }
    }

    // For static markdown, we need to create a minimal note-like object
    // getNoteContentAsHTML expects (content: string, note: TNote)
    // We'll create a minimal note object with just the required properties
    const tempNote: any = {
      filename: 'temp.md',
      content: params.markdown,
      paragraphs: [],
    }

    const html = await getNoteContentAsHTML(params.markdown, tempNote)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] renderMarkdown COMPLETE: totalElapsed=${totalElapsed}ms`)

    return {
      success: true,
      data: html,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] renderMarkdown ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to render markdown: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get note content as HTML
 * @param {Object} params - Request parameters
 * @param {string} params.noteIdentifier - Filename or title of the note
 * @param {boolean} params.isFilename - Whether noteIdentifier is a filename (default: true)
 * @param {boolean} params.isTitle - Whether noteIdentifier is a title (default: false)
 * @returns {RequestResponse}
 */
export async function getNoteContentAsHTMLHandler(params: { noteIdentifier: string, isFilename?: boolean, isTitle?: boolean }): Promise<RequestResponse> {
  const startTime: number = Date.now()
  try {
    logDebug(
      pluginJson,
      `[DIAG] getNoteContentAsHTML START: noteIdentifier="${params.noteIdentifier}", isFilename=${String(params.isFilename ?? true)}, isTitle=${String(params.isTitle ?? false)}`,
    )

    if (!params.noteIdentifier) {
      return {
        success: false,
        message: 'Note identifier is required',
        data: null,
      }
    }

    // Get the note by filename or title
    const note = await getNote(params.noteIdentifier, null, '')
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${params.noteIdentifier}`,
        data: null,
      }
    }

    // Get the note content as HTML
    const html = await getNoteContentAsHTML(note.content, note)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getNoteContentAsHTML COMPLETE: totalElapsed=${totalElapsed}ms`)

    return {
      success: true,
      data: html,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getNoteContentAsHTML ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get note content as HTML: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Remove empty lines from a note's content
 * Removes sequences of 2+ newlines, blank lines after frontmatter, and trailing blank lines
 * @param {any} note - The note to clean up (CoreNoteFields)
 * @returns {void}
 */
export function removeEmptyLinesFromNote(note: any): void {
  if (!note) return

  // Rebuild content from paragraphs
  const contentParts = note.paragraphs.map((p) => p.rawContent)
  let cleanedContent = contentParts.join('\n')

  // Remove all blank lines: replace any sequence of 2+ newlines with a single newline
  cleanedContent = cleanedContent.replace(/\n{2,}/g, '\n')
  // Remove blank lines immediately after frontmatter (after the closing ---)
  cleanedContent = cleanedContent.replace(/(---\n)\n+/g, '$1')
  // Remove trailing blank lines
  cleanedContent = cleanedContent.replace(/\n+$/, '')

  note.content = cleanedContent
  note.updateParagraphs(note.paragraphs)
}

/**
 * Update form links in a note's body content under "Form Details" heading
 * Uses replaceContentUnderHeading to replace or create the heading section
 * @param {CoreNoteFields} note - The note to update
 * @param {string} formTitle - The title of the form
 * @param {string} launchLink - The launch link URL
 * @param {string} formEditLink - The form edit link URL
 * @param {string} processingTemplateLink - Optional processing template link URL
 * @returns {Promise<void>}
 */
export async function updateFormLinksInNote(
  note: any, // CoreNoteFields - note object with paragraphs and frontmatter
  formTitle: string,
  launchLink: string,
  formEditLink: string,
  processingTemplateLink?: string,
): Promise<void> {
  logDebug(pluginJson, `updateFormLinksInNote: [START] Called with formTitle: "${formTitle}"`)
  logDebug(pluginJson, `updateFormLinksInNote: [START] Note content before (first 30 lines):\n${(note.content || '').split('\n').slice(0, 30).join('\n')}`)
  logDebug(pluginJson, `updateFormLinksInNote: [START] Note has ${note.paragraphs.length} paragraphs`)

  const links = [`- [open form](${launchLink})`, `- [edit form](${formEditLink})`]
  if (processingTemplateLink) {
    links.push(`- [open processing template](${processingTemplateLink})`)
  }
  // Use replaceContentUnderHeading to replace or create the "Form Details" section
  // Note: The heading text includes the formTitle, but this is just for display in the body
  const markdownContent = `## Form Details - ${formTitle}:\n${links.join('\n')}`
  logDebug(pluginJson, `updateFormLinksInNote: [BEFORE] markdownContent to insert:\n${markdownContent}`)

  // Find where the frontmatter ends to insert after it
  // endOfFrontmatterLineIndex expects a note object, not just paragraphs
  const endOfFM = endOfFrontmatterLineIndex(note)
  logDebug(pluginJson, `updateFormLinksInNote: endOfFrontmatterLineIndex returned: ${endOfFM}`)

  if (endOfFM != null && endOfFM >= 0) {
    // We have frontmatter - insert after it
    const insertionIndex = endOfFM + 1
    logDebug(pluginJson, `updateFormLinksInNote: Will insert at index ${insertionIndex} (after frontmatter ending at ${endOfFM})`)

    // Check if "Form Details" heading already exists
    let headingIndex = -1
    for (let i = insertionIndex; i < note.paragraphs.length; i++) {
      const p = note.paragraphs[i]
      if (p.type === 'title' && p.content.trim().startsWith('Form Details')) {
        headingIndex = i
        break
      }
    }

    if (headingIndex >= 0) {
      // Heading exists, remove content under it first
      removeContentUnderHeading(note, 'Form Details', false, false)
      // Re-find the heading after removal
      for (let i = insertionIndex; i < note.paragraphs.length; i++) {
        const p = note.paragraphs[i]
        if (p.type === 'title' && p.content.trim().startsWith('Form Details')) {
          headingIndex = i
          break
        }
      }
      // Insert content after the heading
      note.insertParagraph(links.join('\n'), headingIndex + 1, 'text')
    } else {
      // Heading doesn't exist, insert heading and content
      // Use insertHeading with headingLevel 2 for ## heading
      note.insertHeading(`Form Details - ${formTitle}:`, insertionIndex, 2)
      note.insertParagraph(links.join('\n'), insertionIndex + 1, 'text')
    }
  } else {
    // No frontmatter, use the standard method
    logDebug(pluginJson, `updateFormLinksInNote: No frontmatter found, using replaceContentUnderHeading`)
    await replaceContentUnderHeading(note, 'Form Details', markdownContent, false, 2)
  }

  logDebug(pluginJson, `updateFormLinksInNote: [AFTER] Note content after (first 30 lines):\n${(note.content || '').split('\n').slice(0, 30).join('\n')}`)
  logDebug(pluginJson, `updateFormLinksInNote: [AFTER] Note has ${note.paragraphs.length} paragraphs`)
}

/**
 * Router function to handle requests from React
 * @param {string} requestType - The type of request (e.g., 'getFolders', 'getNotes', 'createFolder')
 * @param {Object} params - Request parameters
 * @returns {Promise<RequestResponse>}
 */
export async function handleRequest(requestType: string, params: Object = {}): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleRequest: requestType="${requestType}", params=${JSON.stringify(params)}`)

    switch (requestType) {
      case 'getFolders':
        return getFolders(params)
      case 'getNotes':
        return getNotes(params)
      case 'getEvents':
        return await getEvents(params)
      case 'getAvailableCalendars':
        return getAvailableCalendars(params)
      case 'getAvailableReminderLists':
        return getAvailableReminderLists(params)
      case 'getTeamspaces':
        return getTeamspaces(params)
      case 'getHashtags':
        return getHashtags(params)
      case 'getMentions':
        return getMentions(params)
      case 'createFolder':
        return createFolder(params)
      case 'getHeadings':
        return getHeadings(params)
      case 'renderMarkdown':
        return await renderMarkdown(params)
      case 'getNoteContentAsHTML':
        return await getNoteContentAsHTMLHandler(params)
      case 'createNote':
        return createNote(params)
      case 'saveAutosave':
        return await saveAutosave(params)
      case 'testFormFieldRender':
        // Open the form field render test window
        await testFormFieldRender()
        return {
          success: true,
          message: 'Form field examples opened',
          data: null,
        }
      // Form-specific handlers are now in their respective handler files:
      // - formBrowserHandlers.js handles: getFormTemplates, getFormFields, submitForm, openFormBuilder
      // - formBuilderHandlers.js handles: createProcessingTemplate, openNote, copyFormUrl, duplicateForm
      // - formSubmitHandlers.js handles: onSubmitClick and other form submission actions
      default:
        logError(pluginJson, `handleRequest: Unknown request type: "${requestType}"`)
        return {
          success: false,
          message: `Unknown request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `handleRequest: Error handling request "${requestType}": ${error.message}`)
    return {
      success: false,
      message: `Error handling request: ${error.message}`,
      data: null,
    }
  }
}
