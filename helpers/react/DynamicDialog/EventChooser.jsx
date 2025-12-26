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
  showValue?: boolean, // If true, display the selected value below the input
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request events from plugin
  selectedCalendars?: Array<string>, // Optional array of calendar titles to filter events by
  includeReminders?: boolean, // If true, include reminders in the list
  reminderLists?: Array<string>, // Optional array of reminder list titles to filter reminders by
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
  showValue = false,
  requestFromPlugin,
  selectedCalendars,
  includeReminders = false,
  reminderLists,
}: EventChooserProps): React$Node {
  const [events, setEvents] = useState<Array<EventOption>>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<?string>(null)
  const lastLoadedDateRef = useRef<?string>(null) // Track last loaded date to prevent re-loading
  const isLoadingRef = useRef<boolean>(false) // Track loading state to prevent concurrent loads

  // Get the date to use: priority is dateFromField > date > today
  const targetDate = useMemo(() => {
    if (dateFromField) {
      const parsed = parseDateFromField(dateFromField)
      if (parsed) {
        return parsed
      }
    }
    return date || new Date()
  }, [date, dateFromField])
  const targetDateString = useMemo(() => {
    return targetDate.toISOString().split('T')[0] // YYYY-MM-DD format
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
  useEffect(() => {
    // Prevent re-loading if we've already loaded this exact date or are currently loading
    if (lastLoadedDateRef.current === targetDateString || isLoadingRef.current) {
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

        logDebug('EventChooser', `Loading events for ${targetDate.toDateString()} (${dateString})`)

        // Request events from plugin - the plugin will call Calendar.eventsBetween()
        // Note: requestFromPlugin resolves with just the data when success=true, or rejects with error when success=false
        const eventsData = await requestFromPlugin('getEvents', {
          dateString, // Pass date as YYYY-MM-DD string
          date: targetDate.toISOString(), // Also pass full ISO string for plugin to parse
        })

        if (Array.isArray(eventsData)) {
          // Convert events from plugin to EventOption format and sort by time
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

    loadEvents()

    return () => {
      isMounted = false
      isLoadingRef.current = false
    }
  }, [targetDateString]) // Only depend on targetDateString, not requestFromPlugin to avoid infinite loops

  // Find default event if today and no value set
  const defaultEventId = useMemo(() => {
    if (value) {
      return value // Use provided value if set
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
  }, [value, isToday, events])

  // Auto-select default event if found and no value is set
  useEffect(() => {
    if (defaultEventId && !value && events.length > 0) {
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
  }, [defaultEventId, value, events.length])

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
    iconClass: 'fa-calendar',
    fieldType: 'event-chooser',
    debugLogging: false,
    maxResults: 25,
    inputMaxLength: 100,
    dropdownMaxLength: 80,
    getOptionIcon: (event: EventOption) => {
      return event.isAllDay ? 'fa-calendar-day' : 'fa-clock'
    },
    getOptionColor: (event: EventOption) => {
      return event.isAllDay ? 'blue' : null
    },
    getOptionShortDescription: (event: EventOption) => {
      return event.isAllDay ? 'all-day' : null
    },
    // Custom rendering with column layout: icon | time | title
    renderOption: (event: EventOption, helpers) => {
      const { isSelected, handleItemSelect, classNamePrefix } = helpers
      const calendarIcon = 'fa-calendar'
      const calendarColor = event.isAllDay ? 'blue' : 'gray'
      const timeDisplay = event.isAllDay ? 'All-day' : formatTime(event.date)
      const titleWrap = false // Can be made configurable later

      return (
        <div
          className={`searchable-chooser-option event-chooser-option ${isSelected ? 'option-selected' : ''}`}
          onClick={(e) => handleItemSelect(event, e)}
          title={`${event.title} - Calendar: ${event.calendar}`}
          style={{
            backgroundColor: isSelected ? 'var(--hover-bg, #f5f5f5)' : undefined,
            cursor: 'pointer',
          }}
        >
          <div className="searchable-chooser-option-columns event-chooser-option-columns">
            {/* Calendar icon column */}
            <div className="searchable-chooser-option-column-icon event-chooser-option-icon">
              <i
                className={`fa-solid ${calendarIcon}`}
                style={{
                  color: `var(--${calendarColor}-500, var(--gray-500, #666))`,
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
      value={value || defaultEventId || ''}
      disabled={disabled}
      compactDisplay={compactDisplay}
      placeholder={placeholder}
      showValue={showValue}
      config={config}
      isLoading={isLoading}
    />
  )
}

export default EventChooser

