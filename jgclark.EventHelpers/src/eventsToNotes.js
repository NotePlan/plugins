// @flow
// ----------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated 2025-11-23 for v0.23.2, by @jgclark
// @jgclark, with additions by @dwertheimer, @weyert, @m1well, @akrabat
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './eventsHelpers'
import { getEventsForDay, type EventsConfig } from '@helpers/NPCalendar'
import {
  getCalendarNoteTimeframe,
  getDateFromYYYYMMDDString,
  isDailyNote,
  isWeeklyNote,
  toLocaleDateString,
  toLocaleTime,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { getTagParamsFromString } from '@helpers/general'
import { calcOffsetDateStr, getDateStrForStartofPeriodFromCalendarFilename, toNPLocaleDateString } from '@helpers/NPdateTime'
import { showMessage } from '@helpers/userInput'

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const SORT_ORDER_CALENDAR = 'calendar'
const DEFAULT_HEADING_LEVEL = 2
const DEFAULT_FORMAT_EVENTS = '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'
const DEFAULT_FORMAT_ALL_DAY = '- *|CAL|*: *|TITLE|**| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'

// ----------------------------------------------------------------------------
// Helper Functions (Private)
// ----------------------------------------------------------------------------

/**
 * Validate Editor state based on requirements
 * @param {Object} options - Validation options
 * @param {boolean} options.requireEditor - Whether Editor must exist
 * @param {boolean} options.requireFilename - Whether Editor.filename must exist
 * @param {boolean} options.requireCalendarType - Whether Editor.type must be 'Calendar'
 * @param {boolean} options.requireDailyNote - Whether note must be a daily note
 * @param {boolean} options.requireWeeklyNote - Whether note must be a weekly note
 * @param {boolean} options.requireDailyOrWeekly - Whether note must be daily or weekly
 * @returns {{isValid: boolean, errorMessage: ?string, note: ?TNote}} Validation result
 */
function validateEditorState(options: {
  requireEditor?: boolean,
  requireFilename?: boolean,
  requireCalendarType?: boolean,
  requireDailyNote?: boolean,
  requireWeeklyNote?: boolean,
  requireDailyOrWeekly?: boolean,
}): { isValid: boolean, errorMessage: ?string, note: ?TNote } {
  const {
    requireEditor = true,
    requireFilename = false,
    requireCalendarType = true,
    requireDailyNote = false,
    requireWeeklyNote = false,
    requireDailyOrWeekly = false,
  } = options

  if (requireEditor && (!Editor || Editor.note == null)) {
    return {
      isValid: false,
      errorMessage: 'Please run again with a note open.',
      note: null,
    }
  }

  if (!Editor || Editor.note == null) {
    return { isValid: false, errorMessage: 'No note is currently open.', note: null }
  }

  const note: TNote = Editor.note

  if (requireFilename && Editor.filename == null) {
    return {
      isValid: false,
      errorMessage: 'Note filename is not available.',
      note: null,
    }
  }

  if (requireCalendarType && Editor.type !== 'Calendar') {
    return {
      isValid: false,
      errorMessage: 'Please run again with a calendar note open.',
      note: null,
    }
  }

  if (requireDailyNote && !isDailyNote(note)) {
    return {
      isValid: false,
      errorMessage: 'Please run again with a daily calendar note open.',
      note: null,
    }
  }

  if (requireWeeklyNote && !isWeeklyNote(note)) {
    return {
      isValid: false,
      errorMessage: 'Please run again with a weekly calendar note open.',
      note: null,
    }
  }

  if (requireDailyOrWeekly && !isDailyNote(note) && !isWeeklyNote(note)) {
    return {
      isValid: false,
      errorMessage: 'Please run again with a daily or weekly calendar note open.',
      note: null,
    }
  }

  return { isValid: true, errorMessage: null, note }
}

/**
 * Normalize parameter string, handling null/undefined cases
 * @param {?string} paramStringIn - Input parameter string
 * @param {string} functionName - Name of calling function for logging
 * @returns {string} Normalized parameter string
 */
function normalizeParamString(paramStringIn: ?string, functionName: string): string {
  if (paramStringIn == null) {
    logWarn(functionName, `No parameters passed (from template), so will use defaults.`)
    return ''
  }
  return paramStringIn
}

/**
 * Get format parameter from paramString, checking multiple possible parameter names
 * @param {string} paramString - Parameter string to check
 * @param {Array<string>} paramNames - Array of parameter names to check (in order)
 * @param {string} defaultValue - Default value to use if no parameter found
 * @returns {Promise<string>} Format string
 */
async function getFormatParam(paramString: string, paramNames: Array<string>, defaultValue: string): Promise<string> {
  for (const paramName of paramNames) {
    if (paramString.includes(`"${paramName}":`)) {
      return String(await getTagParamsFromString(paramString, paramName, defaultValue))
    }
  }
  return defaultValue
}

/**
 * Generate heading for a day's events
 * @param {number} daysToCover - Total number of days being processed
 * @param {string} dateStr - Date string (YYYYMMDD format)
 * @param {string} headingConfig - Heading configuration from config
 * @param {boolean} includeHeadings - Whether to include headings for single day
 * @returns {string} Generated heading string
 */
function generateDayHeading(
  daysToCover: number,
  dateStr: string,
  headingConfig: string,
  includeHeadings: boolean
): string {
  if (daysToCover > 1) {
    const npDateStr = getDateFromYYYYMMDDString(dateStr)
    if (!npDateStr) {
      throw new Error(`Could not get valid NP date string from ${dateStr}`)
    }
    const localisedDateStr = toNPLocaleDateString(npDateStr)
    const hLevel = headingConfig !== '' ? headingConfig.split(' ')[0].length : DEFAULT_HEADING_LEVEL
    return headingConfig !== ''
      ? `${headingConfig} for ${localisedDateStr}`
      : `${'#'.repeat(hLevel)} for ${localisedDateStr}`
  } else if (headingConfig !== '' && includeHeadings) {
    return headingConfig
  }
  return ''
}

/**
 * Process a single event into a sortable object
 * @param {TCalendarItem} event - Calendar event to process
 * @param {string} format - Format string for regular events
 * @param {string} alldayFormat - Format string for all-day events
 * @param {EventsConfig} config - Configuration object
 * @param {Array<string>} calendarNameMappings - Calendar name mappings
 * @param {boolean} withCalendarName - Whether to include calendar name
 * @returns {{cal: string, start: Date, text: string}} Processed event object
 */
function processEvent(
  event: TCalendarItem,
  format: string,
  alldayFormat: string,
  config: EventsConfig,
  calendarNameMappings: Array<string>,
  withCalendarName: boolean
): { cal: string, start: Date, text: string } {
  const replacements = getReplacements(event, config)
  const eventStr = replaceFormatPlaceholderStringWithActualValues(
    event.isAllDay ? alldayFormat : format,
    replacements
  )
  return {
    cal: withCalendarName ? calendarNameWithMapping(event.calendar, calendarNameMappings) : '',
    start: event.date,
    text: eventStr,
  }
}

/**
 * Process events for a single day
 * @param {string} dateStr - Date string (YYYYMMDD format)
 * @param {Array<string>} calendarSet - Set of calendars to include
 * @param {string} format - Format string for regular events
 * @param {string} alldayFormat - Format string for all-day events
 * @param {boolean} includeAllDayEvents - Whether to include all-day events
 * @param {EventsConfig} config - Configuration object
 * @param {Array<string>} calendarNameMappings - Calendar name mappings
 * @param {boolean} withCalendarName - Whether to include calendar name
 * @returns {Promise<Array<{cal: string, start: Date, text: string}>>} Array of processed events
 */
async function processEventsForDay(
  dateStr: string,
  calendarSet: Array<string>,
  format: string,
  alldayFormat: string,
  includeAllDayEvents: boolean,
  config: EventsConfig,
  calendarNameMappings: Array<string>,
  withCalendarName: boolean
): Promise<Array<{ cal: string, start: Date, text: string }>> {
  const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, calendarSet) ?? []
  const mapForSorting: Array<{ cal: string, start: Date, text: string }> = []

  for (const e of eArr) {
    if (!includeAllDayEvents && e.isAllDay) {
      continue
    }

    const processedEvent = processEvent(e, format, alldayFormat, config, calendarNameMappings, withCalendarName)
    mapForSorting.push(processedEvent)
  }

  return mapForSorting
}

/**
 * Sort events based on configuration
 * @param {Array<{cal: string, start: Date, text: string}>} events - Events to sort
 * @param {string} sortOrder - Sort order ('calendar' or 'time')
 * @returns {void} Sorts array in place
 */
function sortEvents(events: Array<{ cal: string, start: Date, text: string }>, sortOrder: string): void {
  if (sortOrder === SORT_ORDER_CALENDAR) {
    events.sort(sortByCalendarNameThenStartTime())
  } else {
    // Default to time-based sorting
    events.sort(sortByStartTimeThenCalendarName())
  }
}

// ----------------------------------------------------------------------------

/**
 * Return markdown list of the current open Calendar note's events (and potentially the days after it)
 * @author @jgclark
 *
 * @param {string} paramString - checked for options
 * @returns {string} Markdown-formatted list of today's events
 */
export async function listDaysEvents(paramStringIn: string = ''): Promise<string> {
  try {
    const validation = validateEditorState({
      requireEditor: true,
      requireFilename: true,
      requireCalendarType: true,
      requireDailyOrWeekly: true,
    })
    if (!validation.isValid) {
      await showMessage(validation.errorMessage || 'Please run again with a daily or weekly calendar note open.', 'OK', 'List Events')
      return ''
    }
    const openNote: TNote = validation.note
    const paramString = normalizeParamString(paramStringIn, 'listDaysEvents')

    const config = await getEventsSettings()
    const noteTimeFrame = getCalendarNoteTimeframe(openNote)
    if (!noteTimeFrame) throw new Error(`No noteTimeFrame found for note ${openNote.filename}. Stopping.`)
    const startDayDateString = getDateStrForStartofPeriodFromCalendarFilename(Editor.filename)

    // Get format parameters, checking both new and legacy parameter names
    const format = await getFormatParam(paramString, ['format', 'template'], config.formatEventsDisplay || DEFAULT_FORMAT_EVENTS)
    const alldayformat = await getFormatParam(paramString, ['allday_format', 'allday_template'], config.formatAllDayEventsDisplay || DEFAULT_FORMAT_ALL_DAY)

    const includeAllDayEvents: boolean = await getTagParamsFromString(paramString, 'includeAllDayEvents', true)
    const includeHeadings: boolean = await getTagParamsFromString(paramString, 'includeHeadings', true)
    const calendarSetStr: string = String(await getTagParamsFromString(paramString, 'calendarSet', config.calendarSet))
    const calendarSet: Array<string> = calendarSetStr !== '' ? calendarSetStr.split(',') : []
    const calendarNameMappingsStr: string = String(await getTagParamsFromString(paramString, 'calendarNameMappings', config.calendarNameMappings))
    const calendarNameMappings: Array<string> = calendarNameMappingsStr !== '' ? calendarNameMappingsStr.split(',') : []
    const withCalendarName = format.includes('CAL')

    const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', isWeeklyNote(openNote) ? 7 : 1)

    logDebug(pluginJson, `listDaysEvents: starting for noteTimeFrame=${noteTimeFrame} / daysToCover=${daysToCover} / from '${startDayDateString}' with paramString='${paramString}'`)

    const outputArray: Array<string> = []

    for (let i = 0; i < daysToCover; i++) {
      const dateStr = calcOffsetDateStr(startDayDateString, `+${i}d`)
      logDebug(pluginJson, `${i}: startDayDateString=${startDayDateString}, dateStr=${dateStr}`)

      const heading = generateDayHeading(daysToCover, dateStr, config.eventsHeading, includeHeadings)
      if (heading !== '') {
        outputArray.push(heading)
      }

      const mapForSorting = await processEventsForDay(
        dateStr,
        calendarSet,
        format,
        alldayformat,
        includeAllDayEvents,
        config,
        calendarNameMappings,
        withCalendarName
      )

      sortEvents(mapForSorting, config.sortOrder)
      outputArray.push(mapForSorting.map((element) => element.text).join('\n'))
    }

    const output = outputArray.join('\n')
    logDebug(pluginJson, output)
    return output
  } catch (err) {
    logError(pluginJson, `listDaysEvents: ${err.message}`)
    return ''
  }
}

// ----------------------------------------------------------------------------
/**
 * Insert list of a day's events at cursor position.
 * NB: When this is called by UI as a /command, it doesn't have any params passed with it.
 *
 * @author @jgclark
 * @param {?string} paramString - passed through to next function
 */
export async function insertDaysEvents(paramString: ?string): Promise<void> {
  try {
    logDebug(pluginJson, 'insertDaysEvents: Starting')
    const validation = validateEditorState({
      requireEditor: true,
      requireCalendarType: true,
      requireDailyNote: true,
    })
    if (!validation.isValid) {
      await showMessage(validation.errorMessage || 'Please run again with a daily calendar note open.', 'OK', 'Insert Events')
      return
    }

    // Get list of events happening on the day of the open note
    let output: string = await listDaysEvents(paramString || '')
    output += output.length === 0 ? '\nnone\n' : '\n'
    Editor.insertTextAtCursor(output)
  } catch (error) {
    logError('insertDaysEvents', error.message)
  }
}

// ----------------------------------------------------------------------------

/**
 * Return markdown-formatted list of matching events for the currently-open Calendar note, from list in keys of config.addMatchingEvents, having applied placeholder formatting.
 * Note: Parameters can be passed in as a JSON string, except for the complex 'format' which only comes from 'config.addMatchingEvents'.
 * @author @jgclark
 * @param {?string} paramStringIn Paramaters to use
 * @return {string} List of matching events, as a multi-line string
 */
export async function listMatchingDaysEvents(
  paramStringIn: string = '', // NB: the parameter isn't currently used, but is provided for future expansion.
): Promise<string> {
  try {
    const validation = validateEditorState({
      requireEditor: false,
      requireFilename: true,
      requireCalendarType: true,
    })
    if (!validation.isValid) {
      await showMessage(validation.errorMessage || 'Please run again with a calendar note open.', 'OK', 'List Events')
      return ''
    }
    const openNote: TNote = validation.note
    const paramString = normalizeParamString(paramStringIn, 'listMatchingDaysEvents')

    const config = await getEventsSettings()
    const noteTimeFrame = getCalendarNoteTimeframe(openNote)
    if (!noteTimeFrame) throw new Error(`No noteTimeFrame found for note ${openNote.filename}. Stopping.`)
    const startDayDateString = getDateStrForStartofPeriodFromCalendarFilename(Editor.filename)
    logDebug(pluginJson, `listMatchingDaysEvents: starting for noteTimeFrame=${noteTimeFrame} / date ${startDayDateString} with paramString='${paramString}'`)

    if (config.addMatchingEvents == null) {
      await showMessage(`Error: Empty 'addMatchingEvents' setting in Config. Stopping`, 'OK', 'List Matching Events')
      return `**Error: found no 'Add matching events' in plugin settings.**`
    }

    const matchingEvents = config.addMatchingEvents
    const formatArr = Object.values(matchingEvents)
    const textToMatchArr = Object.keys(matchingEvents)
    logDebug(pluginJson, `- from settings found ${textToMatchArr.length} match strings to look for`)

    const includeAllDayEvents: boolean = await getTagParamsFromString(paramString, 'includeAllDayEvents', true)
    const includeHeadings: boolean = await getTagParamsFromString(paramString, 'includeHeadings', true)
    const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', 1)
    const calendarSetStr: string = String(await getTagParamsFromString(paramString, 'calendarSet', config.calendarSet))
    const calendarSet: Array<string> = calendarSetStr !== '' ? calendarSetStr.split(',') : []
    const calendarNameMappingsStr: string = String(await getTagParamsFromString(paramString, 'calendarNameMappings', config.calendarNameMappings))
    const calendarNameMappings: Array<string> = calendarNameMappingsStr !== '' ? calendarNameMappingsStr.split(',') : []

    const outputArray: Array<string> = []

    for (let i = 0; i < daysToCover; i++) {
      const dateStr = calcOffsetDateStr(startDayDateString, `+${i}d`)
      logDebug(pluginJson, `${i}: startDayDateString=${startDayDateString}, dateStr=${dateStr}`)

      const heading = generateDayHeading(daysToCover, dateStr, config.matchingEventsHeading, includeHeadings)
      if (heading !== '') {
        outputArray.push(heading)
      }

      const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, calendarSet) ?? []
      const mapForSorting: Array<{ cal: string, start: Date, text: string }> = []

      for (const e of eArr) {
        logDebug(pluginJson, `- Processing event '${e.title}'`)
        if (!includeAllDayEvents && e.isAllDay) {
          logDebug(pluginJson, `  - skipping as event is all day and includeAllDayEvents is false`)
          continue
        }

        for (let j = 0; j < textToMatchArr.length; j++) {
          const thisFormat: string = String(formatArr[j])
          const withCalendarName = thisFormat.includes('CAL')
          const reMatch = new RegExp(textToMatchArr[j], 'i')
          if (e.title.match(reMatch)) {
            logDebug(pluginJson, `- Found match to event '${e.title}' from '${textToMatchArr[j]}`)
            const processedEvent = processEvent(e, thisFormat, thisFormat, config, calendarNameMappings, withCalendarName)
            mapForSorting.push(processedEvent)

            const stopMatching = 'stopMatching' in config ? (config: any).stopMatching: false
            if (stopMatching || thisFormat.includes('STOPMATCHING')) {
              logDebug(pluginJson, `- STOPMATCHING signal given, so skipping other possible matches for this event`)
              break
            }
          }
        }
      }

      if (mapForSorting.length > 0) {
        sortEvents(mapForSorting, config.sortOrder)
        outputArray.push(mapForSorting.map((element) => element.text).join('\n'))
      } else {
        outputArray.push('No matching events')
      }
    }

    const output = outputArray.join('\n')
    logDebug(pluginJson, output)
    return output
  } catch (error) {
    logError(pluginJson, `listMatchingDaysEvents: ${error.message}`)
    return ''
  }
}

// ----------------------------------------------------------------------------

/**
 * Return markdown list of the current open Calendar note's events (and potentially the days after it)
 * NB: When this is called by UI as a /command, it doesn't have any params passed with it.
 * @author @jgclark
 *
 * @param {string} paramString - checked for options
 * @returns {string} Markdown-formatted list of today's events
 */
export async function listWeeksEvents(paramString: string = ''): Promise<string> {
  try {
    logDebug(pluginJson, 'insertWeeksEvents: Starting')
    if (!Editor || Editor.note == null || Editor.type !== 'Calendar' || !isWeeklyNote(Editor.note)) {
      await showMessage(`Please run again with a weekly calendar note open.`, 'OK', 'Insert Events')
      return ''
    }
    logDebug(pluginJson, 'listWeeksEvents: starting')
    return await listDaysEvents(paramString)
  } catch (error) {
    logError('listWeeksEvents', error.message)
    return ''
  }
}

/**
 * Insert list of a week's events at cursor position.
 * NB: When this is called by UI as a /command, it doesn't have any params passed with it.
 *
 * @author @jgclark
 * @param {?string} paramString - passed through to next function
 */
export async function insertWeeksEvents(paramString: ?string): Promise<void> {
  try {
    logDebug(pluginJson, 'insertWeeksEvents: Starting')
    if (!Editor || Editor.note == null || Editor.type !== 'Calendar' || !isWeeklyNote(Editor.note)) {
      await showMessage(`Please run again with a weekly calendar note open.`, 'OK', 'Insert Events')
      return
    }

    // Get list of events happening on the week of the open note
    let output: string = await listWeeksEvents(paramString || '')
    output += output.length === 0 ? '\nnone\n' : '\n'
    Editor.insertTextAtCursor(output)
  } catch (error) {
    logError('insertWeeksEvents', error.message)
  }
}

// ----------------------------------------------------------------------------
/**
 * Insert list of matching events in the current day's note, from list in keys of config.addMatchingEvents. Apply format too.
 * @author @jgclark
 *
 * @param {?string} paramString Paramaters to use (to pass on to next function)
 */
export async function insertMatchingDaysEvents(paramString: ?string): Promise<void> {
  logDebug(pluginJson, 'insertMatchingDaysEvents: starting')
  try {
    if (Editor.note == null || Editor.type !== 'Calendar') {
      await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
      return
    }
    const output = await listMatchingDaysEvents(paramString || '')
    Editor.insertTextAtCursor(output)
  } catch (error) {
    logError('insertMatchingDaysEvents', error.message)
  }
}

// ----------------------------------------------------------------------------
/**
 * Change the format placeholders to the actual values, using a Map.
 * @author @jgclark
 *
 * @param {TCalendarItem} item Calendar item whose values to use
 * @param {EventsConfig} config current configuration to use for this plugin
 * @return {Map<string, string>}
 */
export function getReplacements(item: TCalendarItem, config: EventsConfig): Map<string, string> {
  try {
    // logDebug('getReplacements', 'starting getReplacements')
    const outputObject = new Map<string, string>()

    // Deal with special case of ATTENDEES / ATTENDEENAMES where we need to dedupe what NP reports.
    let attendeesToUse = ''
    if (item.attendees) {
      attendeesToUse = [...new Set([...item.attendees])].join(', ')
    }
    let attendeeNamesToUse = ''
    if (item.attendeeNames) {
      attendeeNamesToUse = [...new Set([...item.attendeeNames])].join(', ')
    }

    outputObject.set('CAL', calendarNameWithMapping(item.calendar, config.calendarNameMappings))
    outputObject.set('TITLE', item.title)
    outputObject.set('NOTES', item.notes)
    outputObject.set('ATTENDEES', attendeesToUse)
    outputObject.set('ATTENDEENAMES', attendeeNamesToUse)
    outputObject.set('EVENTLINK', item.calendarItemLink ? item.calendarItemLink : '')
    outputObject.set('LOCATION', item.location ? item.location : '')
    outputObject.set('DATE', toLocaleDateString(item.date, config.locale))
    outputObject.set('START', !item.isAllDay ? toLocaleTime(item.date, config.locale, config.timeOptions) : '')
    outputObject.set('END', item.endDate != null && !item.isAllDay ? toLocaleTime(item.endDate, config.locale, config.timeOptions) : '') // must be processed after 'ATTENDEE*'
    outputObject.set('URL', item.url)
    outputObject.set('ID', item.id || '')
    outputObject.set('MEETINGNOTE', item.id ? `[Create Meeting Note](noteplan://x-callback-url/runPlugin?pluginID=np.MeetingNotes&command=newMeetingNoteFromEventID&arg0=${item.id}&arg1=${config.meetingTemplateTitle ? encodeURIComponent(config.meetingTemplateTitle) : ''})` : '')
    outputObject.set('STOPMATCHING', '') // a signal only, so no text from it

    // outputObject.forEach((v, k, map) => { logDebug('getReplacements', `- ${k} : ${v}`) })
    return outputObject
  } catch (error) {
    logError('getReplacements', error.message)
    return new Map() // for completeness
  }
}

// ----------------------------------------------------------------------------
/**
 * Change the format placeholders to the actual values.
 * This version allows for optional items within the string.  E.g.
 *   - `*|with ATTENDEES|*` only prints the `with ` if ATTENDEES is not empty
 * @private
 * @author @jgclark
 * @param {TCalendarItem} item Calendar item whose values to use
 * @param {EventsConfig} config current configuration to use for this plugin
 * @param {string} format format string, to look for more complex strings (e.g. *|with ATTENDEES|*)
 * @return {{string, string}}
 */
export function replaceFormatPlaceholderStringWithActualValues(format: string, replacements: Map<string, string>): string {
  try {
    // logDebug(pluginJson, `replaceFormatPlaceholderStringWithActualValues starting for format <${format}>`)
    let output = format

    // For each possible placeholder, process it if it present in format AND the value for this event is not empty
    // (For safety ATTENDEES needs to come before END in the list, as 'END' is part of 'ATTENDEES'!)
    const placeholders = ['STOPMATCHING', 'CAL', 'TITLE', 'EVENTLINK', 'LOCATION', 'ATTENDEENAMES', 'ATTENDEES', 'DATE', 'START', 'END', 'NOTES', 'URL', 'MEETINGNOTE', 'ID']
    for (const p of placeholders) {
      const thisRE = new RegExp(`\\*\\|([^|*]*?${p}.*?)\\|\\*`)
      const REResult = output.match(thisRE) // temp RE result
      if (REResult) {
        // We have matched the term in the format string
        const matchedTag = REResult[0] // includes opening and closing *|...|*
        const matchedTagInternals = REResult[1] // excludes the opening and closing *|...|*

        // if Placeholder p has a replacement Value then replace the placeholder's tag with the replacement
        const replacementValue = replacements.get(p) ?? ''
        if (replacementValue !== '') {
          const replacementForTag = matchedTagInternals.replace(p, replacementValue)
          // logDebug(pluginJson, `- replacing ${replacementValue} for ${p}`)
          output = output.replace(matchedTag, replacementForTag)
        } else {
          output = output.replace(matchedTag, '')
        }
        // logDebug(pluginJson, `=> ${output}`)
      }
    }
    return output
  } catch (error) {
    logError('replaceFormatPlaceholderStringWithActualValues', error.message)
    return ''
  }
}

/**
 * Map 'name' to another if found in the 'mappings' array.
 * Note: returns original name if no mapping found.
 * @private
 * @author @m1well
 */
const calendarNameWithMapping = (name: string, mappings: Array<string>): string => {
  let mapped = name
  mappings.forEach((mapping) => {
    const splitted = mapping.split(';')
    if (splitted.length === 2 && name === splitted[0]) {
      mapped = splitted[1]
    }
  })
  return mapped
}

/**
 * Sorter for CalendarItems by .calendar then by .start (time)
 * @author @m1well
 */
export const sortByCalendarNameThenStartTime = (): (a: { cal: string, start: Date, text: string }, b: { cal: string, start: Date, text: string }) => number => {
  return (a, b) => {
    const calCompare = a.cal.localeCompare(b.cal)
    if (calCompare !== 0) return calCompare
    return a.start.getTime() - b.start.getTime()
  }
}

/**
 * Sorter for CalendarItems by .start (time) then .calendar (name)
 * @author @jgclark after @m1well
 */
export const sortByStartTimeThenCalendarName = (): (a: { cal: string, start: Date, text: string }, b: { cal: string, start: Date, text: string }) => number => {
  return (a, b) => {
    const timeCompare = a.start.getTime() - b.start.getTime()
    if (timeCompare !== 0) return timeCompare
    return a.cal.localeCompare(b.cal)
  }
}
