// @flow
//--------------------------------------------------------------------------
// EventChooser Component
// Allows users to select a calendar event by typing to filter choices
//--------------------------------------------------------------------------

import React, { useMemo, useState, useEffect, useRef } from 'react'
import SearchableChooser, { type ChooserConfig } from './SearchableChooser'
import { truncateText } from '@helpers/react/reactUtils.js'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import { startOfDay, endOfDay } from 'date-fns'
import './EventChooser.css'

export type EventOption = {
  id: string,
  title: string,
  date: Date,
  endDate?: ?Date,
  calendar: string,
  isAllDay: boolean,
  type: string, // 'event' or 'reminder'
  isCompleted?: boolean,
  notes?: string,
  url?: string,
  availability?: number,
  attendees?: Array<string>,
  attendeeNames?: Array<string>,
  calendarItemLink?: string,
  location?: string,
  isCalendarWritable?: boolean,
  isRecurring?: boolean,
  occurrences?: Array<Date>,
}

export type EventChooserProps = {
  label?: string,
  value?: string, // The event ID
  date?: Date, // Date to get events for (defaults to today)
  dateFromField?: Date | string | null, // Date value from a dependent field (can be Date, string, or null)
  onChange: (eventId: string, event: EventOption) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  width?: string, // Custom width for the chooser input (e.g., '80vw', '79%', '300px'). Overrides default width even in compact mode.
  showValue?: boolean, // If true, display the selected value below the input
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request events from plugin
  selectedCalendars?: Array<string>, // Optional array of calendar titles to filter events by (ignored if allCalendars=true)
  allCalendars?: boolean, // If true, include events from all calendars NotePlan can access
  calendarFilterRegex?: string, // Optional regex pattern to filter calendars after fetching (applied when allCalendars=true)
  eventFilterRegex?: string, // Optional regex pattern to filter events by title after fetching
  includeReminders?: boolean, // If true, include reminders in the list
  reminderLists?: Array<string>, // Optional array of reminder list titles to filter reminders by
  shortDescriptionOnLine2?: boolean, // If true, render short description on second line (default: false)
  initialEvents?: Array<EventOption>, // Preloaded events for static HTML testing
}

/**
 * Format time for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Extract calendar color from calendarItemLink
 * The color is at the end of the calendarItemLink string before the closing parenthesis
 * Format: "![📅](...:::#FBE983)" where #FBE983 is the hex color
 * @param {string} calendarItemLink - The calendarItemLink string from CalendarItem
 * @returns {string | null} Hex color string (e.g., "#FBE983") or null if not found
 */
function extractCalendarColor(calendarItemLink: ?string): ?string {
  if (!calendarItemLink || typeof calendarItemLink !== 'string') {
    return null
  }
  
  // Look for # followed by 6 hex digits before the closing parenthesis
  // Pattern: # followed by 6 hex characters before )
  const colorMatch = calendarItemLink.match(/#([0-9A-Fa-f]{6})\)$/)
  if (colorMatch) {
    return `#${colorMatch[1]}`
  }
  
  return null
}

/**
 * Format event for display
 * @param {EventOption} event - Event to format
 * @returns {string} Formatted event string
 */
function formatEventDisplay(event: EventOption): string {
  if (event.isAllDay) {
    return `${event.title} (${event.calendar}, all-day)`
  }
  const timeStr = formatTime(event.date)
  const endTimeStr = event.endDate ? ` - ${formatTime(event.endDate)}` : ''
  return `${timeStr}${endTimeStr} - ${event.title} (${event.calendar})`
}

/**
 * Check if an event is currently happening
 * @param {EventOption} event - Event to check
 * @param {Date} now - Current time
 * @returns {boolean} True if event is happening now
 */
function isEventHappeningNow(event: EventOption, now: Date): boolean {
  if (event.isAllDay) {
    // For all-day events, check if today is within the event date range
    const eventStart = startOfDay(event.date)
    const eventEnd = event.endDate ? endOfDay(event.endDate) : endOfDay(event.date)
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    return todayStart >= eventStart && todayStart <= eventEnd
  }
  // For timed events, check if now is between start and end
  const start = event.date.getTime()
  const end = event.endDate ? event.endDate.getTime() : start
  const nowTime = now.getTime()
  return nowTime >= start && nowTime <= end
}

/**
 * Check if an event is within 15 minutes (before or after)
 * @param {EventOption} event - Event to check
 * @param {Date} now - Current time
 * @returns {boolean} True if event is within 15 minutes
 */
function isEventWithin15Minutes(event: EventOption, now: Date): boolean {
  if (event.isAllDay) {
    return false // All-day events don't have a specific time
  }
  const eventTime = event.date.getTime()
  const nowTime = now.getTime()
  const diffMinutes = Math.abs(eventTime - nowTime) / (1000 * 60)
  return diffMinutes <= 15
}

/**
 * EventChooser Component
 * A searchable dropdown for selecting calendar events
 * @param {EventChooserProps} props
 * @returns {React$Node}
 */
/**
 * Parse a date from various formats (Date object, ISO string, YYYY-MM-DD, etc.)
 * @param {Date | string | null} dateInput - Date input to parse
 * @returns {Date | null} Parsed date or null if invalid
 */
function parseDateFromField(dateInput: Date | string | null): Date | null {
  if (!dateInput) return null
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput
  }
  
  // If it's a string, try to parse it
  if (typeof dateInput === 'string') {
    // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/)
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10)
      const month = parseInt(isoMatch[2], 10) - 1 // Month is 0-indexed
      const day = parseInt(isoMatch[3], 10)
      const parsed = new Date(year, month, day)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
    
    // Try native Date parsing
    const parsed = new Date(dateInput)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }
  
  return null
}

export function EventChooser({
  label,
  value = '',
  date,
  dateFromField,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search events...',
  width,
  showValue = false,
  requestFromPlugin,
  selectedCalendars,
  allCalendars = false,
  calendarFilterRegex,
  eventFilterRegex,
  includeReminders = false,
  reminderLists,
  shortDescriptionOnLine2 = false,
  initialEvents,
}: EventChooserProps): React$Node {
  // Initialize from preloaded data if available (for static HTML testing)
  // Preloaded events come as ISO strings (from getEvents serialization) and need to be converted to Date objects
  const hasInitialEvents = Array.isArray(initialEvents) && initialEvents.length > 0
  const [events, setEvents] = useState<Array<EventOption>>(() => {
    if (hasInitialEvents && initialEvents) {
      logDebug('EventChooser', `Converting initial events: ${initialEvents.length} events`)
      // Convert preloaded events (ISO strings) to EventOption format with Date objects
      // This matches the format EventChooser expects after processing requestFromPlugin response
      const eventOptions: Array<EventOption> = initialEvents
        .map((event: any) => {
          // Plugin returns events with date/endDate as ISO strings that need to be converted to Date objects
          return {
            id: event.id || '',
            title: event.title || '',
            date: event.date ? new Date(event.date) : new Date(),
            endDate: event.endDate ? new Date(event.endDate) : null,
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
            occurrences: event.occurrences ? event.occurrences.map((d: string) => new Date(d)) : [],
          }
        })
        .filter((event: EventOption) => event.id) // Only include events with IDs
        .sort((a: EventOption, b: EventOption) => {
          // Sort all-day events first, then by time
          if (a.isAllDay && !b.isAllDay) return -1
          if (!a.isAllDay && b.isAllDay) return 1
          if (a.isAllDay && b.isAllDay) {
            // Both all-day, sort by title
            return a.title.localeCompare(b.title)
          }
          // Both timed, sort by start time
          return a.date.getTime() - b.date.getTime()
        })
      logDebug('EventChooser', `Converted ${eventOptions.length} initial events to EventOption format`)
      return eventOptions
    }
    return []
  })
  const [isLoading, setIsLoading] = useState<boolean>(!hasInitialEvents) // If preloaded, not loading
  const [error, setError] = useState<?string>(null)
  const lastLoadedDateRef = useRef<?string>(null) // Track last loaded date to prevent re-loading
  const isLoadingRef = useRef<boolean>(false) // Track loading state to prevent concurrent loads

  // Get the date to use: priority is dateFromField > date > today
  const targetDate = useMemo(() => {
    if (dateFromField) {
      const parsed = parseDateFromField(dateFromField)
      if (parsed) {
        logDebug('EventChooser', `[DIAG] Using dateFromField: ${parsed.toDateString()}, ISO: ${parsed.toISOString()}`)
        return parsed
      }
    }
    // Parse date prop if it exists, otherwise use today
    const parsedDate = date ? parseDateFromField(date) : null
    const result = parsedDate || new Date()
    logDebug('EventChooser', `[DIAG] Using date prop or today: ${result.toDateString()}, ISO: ${result.toISOString()}`)
    return result
  }, [date, dateFromField])
  const targetDateString = useMemo(() => {
    // Format date in LOCAL timezone, not UTC (toISOString converts to UTC which can shift the date)
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0') // Month is 0-indexed, pad to 2 digits
    const day = String(targetDate.getDate()).padStart(2, '0')
    const localDateString = `${year}-${month}-${day}`
    const utcDateString = targetDate.toISOString().split('T')[0]
    logDebug('EventChooser', `[DIAG] Date formatting: local=${localDateString}, UTC=${utcDateString}, targetDate=${targetDate.toDateString()}`)
    return localDateString
  }, [targetDate])
  const isToday = useMemo(() => {
    const today = new Date()
    return (
      targetDate.getFullYear() === today.getFullYear() &&
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getDate() === today.getDate()
    )
  }, [targetDate])

  // Load events for the target date
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    // Prevent re-loading if we've already loaded this exact date or are currently loading
    // Also skip if initial events were provided (for static HTML testing)
    if (lastLoadedDateRef.current === targetDateString || isLoadingRef.current || hasInitialEvents) {
      if (hasInitialEvents) {
        logDebug('EventChooser', `Skipping load - using initial events (${initialEvents?.length || 0} events)`)
      }
      return
    }
    
    let isMounted = true

    async function loadEvents() {
      if (!requestFromPlugin) {
        logError('EventChooser', 'Cannot load events: requestFromPlugin is not available')
        if (isMounted) {
          setError('Event chooser requires plugin connection')
          setEvents([])
          setIsLoading(false)
          isLoadingRef.current = false
        }
        return
      }

      try {
        isLoadingRef.current = true
        setIsLoading(true)
        setError(null)

        // Convert targetDate to ISO string for the plugin
        const dateString = targetDateString
        const utcDateString = targetDate.toISOString().split('T')[0]

        logDebug('EventChooser', `Loading events for ${targetDate.toDateString()} (local: ${dateString}, UTC: ${utcDateString})`)

        // Request events from plugin - the plugin will call Calendar.eventsBetween()
        // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
        const eventsData = await requestFromPlugin('getEvents', {
          dateString, // Pass date as YYYY-MM-DD string in LOCAL timezone (not UTC)
          // Don't pass date as ISO string - it will be in UTC and cause timezone issues
          // The plugin will use dateString (YYYY-MM-DD) which is already in local timezone
          calendars: allCalendars ? undefined : selectedCalendars && selectedCalendars.length > 0 ? selectedCalendars : undefined,
          allCalendars: allCalendars || undefined,
          calendarFilterRegex: calendarFilterRegex || undefined,
          eventFilterRegex: eventFilterRegex || undefined,
          includeReminders: includeReminders || undefined,
          reminderLists: reminderLists && reminderLists.length > 0 ? reminderLists : undefined,
        })

        if (Array.isArray(eventsData)) {
          // Convert events from plugin to EventOption format and sort by time
          // Include all CalendarItem properties
          const eventOptions: Array<EventOption> = eventsData
            .map((event: any) => {
              // Plugin should return events with date/endDate as ISO strings that need to be converted to Date objects
              return {
                id: event.id || '',
                title: event.title || '',
                date: event.date ? new Date(event.date) : new Date(),
                endDate: event.endDate ? new Date(event.endDate) : null,
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
                occurrences: event.occurrences ? event.occurrences.map((d: string) => new Date(d)) : [],
              }
            })
            .filter((event: EventOption) => event.id) // Only include events with IDs
            .sort((a: EventOption, b: EventOption) => {
              // Sort all-day events first, then by time
              if (a.isAllDay && !b.isAllDay) return -1
              if (!a.isAllDay && b.isAllDay) return 1
              if (a.isAllDay && b.isAllDay) {
                // Both all-day, sort by title
                return a.title.localeCompare(b.title)
              }
              // Both timed, sort by start time
              return a.date.getTime() - b.date.getTime()
            })

          if (isMounted) {
            setEvents(eventOptions)
            lastLoadedDateRef.current = targetDateString // Mark this date as loaded
            logDebug('EventChooser', `Loaded ${eventOptions.length} events`)
          }
        } else {
          logError('EventChooser', `Failed to load events: Invalid response format`)
          if (isMounted) {
            setError('Invalid response from plugin')
            setEvents([])
          }
        }
      } catch (err) {
        logError('EventChooser', `Error loading events: ${err.message}`)
        if (isMounted) {
          setError(err.message)
          setEvents([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
          isLoadingRef.current = false
        }
      }
    }

    // Use setTimeout to delay the request, allowing TOC and other UI to render first
    const timeoutId = setTimeout(() => {
      loadEvents()
    }, 200) // 200ms delay to yield to TOC rendering

    return () => {
      isMounted = false
      isLoadingRef.current = false
      clearTimeout(timeoutId)
    }
  }, [targetDateString]) // Only depend on targetDateString, not requestFromPlugin to avoid infinite loops

  // Handle both string (ID) and object (full event) values for backward compatibility
  const currentEventId = useMemo(() => {
    if (value) {
      if (typeof value === 'string') {
        return value // Backward compatibility: value is just the ID
      } else if (value && typeof value === 'object' && value.id) {
        return value.id // Value is full event object, extract ID
      }
    }
    return null
  }, [value])

  // Find default event if today and no value set
  const defaultEventId = useMemo(() => {
    if (currentEventId) {
      return currentEventId // Use provided value if set
    }
    if (!isToday || events.length === 0) {
      return null
    }

    const now = new Date()

    // Primary: event happening now
    const happeningNow = events.find((event) => isEventHappeningNow(event, now))
    if (happeningNow) {
      logDebug('EventChooser', `Default: event happening now: ${happeningNow.title}`)
      return happeningNow.id
    }

    // Fallback: event within 15 minutes
    const within15Min = events.find((event) => isEventWithin15Minutes(event, now))
    if (within15Min) {
      logDebug('EventChooser', `Default: event within 15 minutes: ${within15Min.title}`)
      return within15Min.id
    }

    return null
  }, [currentEventId, isToday, events])

  // Auto-select default event if found and no value is set
  useEffect(() => {
    if (defaultEventId && !currentEventId && events.length > 0) {
      const defaultEvent = events.find((e) => e.id === defaultEventId)
      if (defaultEvent) {
        logDebug('EventChooser', `Auto-selecting default event: ${defaultEvent.title}`)
        // Use setTimeout to avoid calling onChange during render
        setTimeout(() => {
          onChange(defaultEventId, defaultEvent)
        }, 0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEventId, currentEventId, events.length])

  // Configure the generic SearchableChooser for events
  const config: ChooserConfig = {
    items: events,
    filterFn: (event: EventOption, searchTerm: string) => {
      const term = searchTerm.toLowerCase()
      return (
        event.title.toLowerCase().includes(term) ||
        event.calendar.toLowerCase().includes(term) ||
        formatEventDisplay(event).toLowerCase().includes(term)
      )
    },
    getDisplayValue: (event: EventOption) => {
      return formatEventDisplay(event)
    },
    getOptionText: (event: EventOption) => {
      return formatEventDisplay(event)
    },
    getOptionTitle: (event: EventOption) => {
      const details = []
      if (event.isAllDay) {
        details.push('All-day event')
      } else {
        const startTime = event.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        details.push(`Starts: ${startTime}`)
        if (event.endDate) {
          const endTime = event.endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
          details.push(`Ends: ${endTime}`)
        }
      }
      details.push(`Calendar: ${event.calendar}`)
      return `${event.title} - ${details.join(', ')}`
    },
    truncateDisplay: truncateText,
    onSelect: (event: EventOption) => {
      onChange(event.id, event)
    },
    emptyMessageNoItems: error ? `Error loading events: ${error}` : 'No events found for this day',
    emptyMessageNoMatch: 'No events match your search',
    classNamePrefix: 'event-chooser',
    iconClass: 'fa-solid fa-calendar-alt',
    fieldType: 'event-chooser',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 100,
    dropdownMaxLength: 80,
    getOptionIcon: (event: EventOption) => {
      if (event.type === 'reminder') {
        return 'fa-bell'
      }
      return event.isAllDay ? 'fa-calendar-day' : 'fa-clock'
    },
    getOptionColor: (event: EventOption) => {
      if (event.type === 'reminder') {
        return 'orange'
      }
      return event.isAllDay ? 'blue' : null
    },
    getOptionShortDescription: (event: EventOption) => {
      return event.isAllDay ? 'all-day' : null
    },
    shortDescriptionOnLine2,
    // Custom rendering with column layout: icon | time | title
    renderOption: (event: EventOption, helpers) => {
      const { isSelected, handleItemSelect, classNamePrefix, getOptionTitle } = helpers
      const calendarIcon = event.type === 'reminder' ? 'fa-bell' : 'fa-calendar'
      
      // Extract calendar color from calendarItemLink, fallback to default colors
      const extractedColor = extractCalendarColor(event.calendarItemLink)
      let calendarColor = 'gray' // Default fallback
      let calendarColorStyle = null
      
      if (event.type === 'reminder') {
        calendarColor = 'orange'
      } else if (extractedColor) {
        // Use the extracted hex color directly
        calendarColorStyle = extractedColor
      } else if (event.isAllDay) {
        calendarColor = 'blue'
      }
      
      const timeDisplay = event.isAllDay ? 'All-day' : formatTime(event.date)
      const titleWrap = false // Can be made configurable later
      
      // Build detailed tooltip with start/end times
      const tooltipDetails = []
      if (event.isAllDay) {
        tooltipDetails.push('All-day event')
      } else {
        const startTime = event.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        tooltipDetails.push(`Starts: ${startTime}`)
        if (event.endDate) {
          const endTime = event.endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
          tooltipDetails.push(`Ends: ${endTime}`)
        }
      }
      tooltipDetails.push(`Calendar: ${event.calendar}`)
      const fullTooltip = `${event.title} - ${tooltipDetails.join(', ')}`

      return (
        <div
          className={`searchable-chooser-option event-chooser-option ${isSelected ? 'option-selected' : ''}`}
          onClick={(e) => handleItemSelect(event, e)}
          title={fullTooltip}
          style={{
            backgroundColor: isSelected ? 'var(--bg-alt-color, #e6e9ef)' : undefined,
            cursor: 'pointer',
          }}
        >
          <div className="searchable-chooser-option-columns event-chooser-option-columns">
            {/* Calendar icon column */}
            <div className="searchable-chooser-option-column-icon event-chooser-option-icon">
              <i
                className={`fa-solid ${calendarIcon}`}
                style={{
                  color: calendarColorStyle || `var(--${calendarColor}-500, var(--fg-placeholder-color, rgba(76, 79, 105, 0.7)))`,
                  fontSize: '0.9rem',
                }}
                title={event.calendar}
              />
            </div>
            {/* Time column */}
            <div className="searchable-chooser-option-column-time event-chooser-option-time">
              {timeDisplay}
            </div>
            {/* Title column */}
            <div
              className={`searchable-chooser-option-column-title event-chooser-option-title ${titleWrap ? 'wrap' : 'truncate'}`}
            >
              {event.title}
            </div>
          </div>
        </div>
      )
    },
  }

  return (
    <SearchableChooser
      label={label}
      value={currentEventId || defaultEventId || ''}
      disabled={disabled}
      compactDisplay={compactDisplay}
      placeholder={placeholder}
      showValue={showValue}
      width={width}
      config={config}
      isLoading={isLoading}
    />
  )
}

export default EventChooser

