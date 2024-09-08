// @flow
// ----------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated 2024-09-06 for v0.22.0, by @jgclark
// @jgclark, with additions by @dwertheimer, @weyert, @m1well, @akrabat
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getEventsSettings } from './eventsHelpers'
import { getEventsForDay, type EventsConfig } from '@helpers/NPCalendar'
import {
  calcOffsetDateStr,
  getCalendarNoteTimeframe,
  // getDateStringFromCalendarFilename,
  getDateFromUnhyphenatedDateString,
  getDateStrForStartofPeriodFromCalendarFilename,
  // getISODateStringFromYYYYMMDD,
  toLocaleDateString,
  toLocaleTime,
  // unhyphenateString,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { getTagParamsFromString } from '@helpers/general'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { showMessage } from '@helpers/userInput'

/**
 * Return markdown list of the current open Calendar note's events (and potentially the days after it)
 * @author @jgclark
 *
 * @param {string} paramString - checked for options
 * @returns {string} Markdown-formatted list of today's events
 */
export async function listDaysEvents(paramStringIn: string = ''): Promise<string> {
  try {
    if (Editor.note == null || Editor.filename == null || Editor.type !== 'Calendar') {
      await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
      return ''
    }
    const openNote = Editor.note
    // handle getting no parameters passed at all
    let paramString = ''
    if (paramStringIn == null) {
      logWarn('listDaysEvents', `No parameters passed (from template), so will use defaults.`)
    } else {
      paramString = paramStringIn
    }

    const config = await getEventsSettings()
    const noteTimeFrame = getCalendarNoteTimeframe(openNote)
    if (!noteTimeFrame) throw new Error(`No noteTimeFrame found for note ${openNote.filename}. Stopping.`)
    const startDayDateString = getDateStrForStartofPeriodFromCalendarFilename(Editor.filename)
    logDebug(pluginJson, `listDaysEvents: starting for noteTimeFrame=${noteTimeFrame} / date ${startDayDateString} with paramString='${paramString}'`)

    // Get a couple of other suppplied parameters, or use defaults
    // Work out format for output line (from params, or if blank, a default)
    // NB: be aware that this call doesn't do type checking
    // NB: allow previous parameter names 'template' and 'allday_template' still.
    const format = paramString.includes('"format":')
      ? String(await getTagParamsFromString(paramString, 'format', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'))
      : paramString.includes('"template":')
      ? String(await getTagParamsFromString(paramString, 'template', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'))
      : config.formatEventsDisplay
    const alldayformat = paramString.includes('"allday_format":')
      ? String(await getTagParamsFromString(paramString, 'allday_format', '- *|CAL|*: *|TITLE|**| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'))
      : paramString.includes('"allday_template":')
      ? String(await getTagParamsFromString(paramString, 'allday_template', '- *|CAL|*: *|TITLE|**| with ATTENDEENAMES|**|\nLOCATION|**|\nNOTES|**|\nURL|*'))
      : config.formatAllDayEventsDisplay
    const includeAllDayEvents: boolean = await getTagParamsFromString(paramString, 'includeAllDayEvents', true)
    const includeHeadings: boolean = await getTagParamsFromString(paramString, 'includeHeadings', true)
    const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', 1)
    const calendarSetStr: string = String(await getTagParamsFromString(paramString, 'calendarSet', config.calendarSet))
    const calendarSet: Array<string> = calendarSetStr !== '' ? calendarSetStr.split(',') : [] // also deal with empty case
    const calendarNameMappingsStr: string = String(await getTagParamsFromString(paramString, 'calendarNameMappings', config.calendarNameMappings))
    const calendarNameMappings: Array<string> = calendarNameMappingsStr !== '' ? calendarNameMappingsStr.split(',') : []
    // If the format contains 'CAL' then we care about calendar names in output
    const withCalendarName = format.includes('CAL')

    const outputArray: Array<string> = []

    // For each day to cover
    for (let i = 0; i < daysToCover; i++) {
      // Set dateStr to the day in question (YYYYMMDD)

      // const isoStartDayDateStr = getISODateStringFromYYYYMMDD(startDayDateString)
      // const dateStr = unhyphenateString(calcOffsetDateStr(isoStartDayDateStr, `+${i}d`))
      const dateStr = calcOffsetDateStr(startDayDateString, `+${i}d`)
      logDebug('listDaysEvents', `${i}: startDayDateString=${startDayDateString}, dateStr=${dateStr}`)

      // Add heading if wanted, or if doing more than 1 day
      if (daysToCover > 1) {
        const npDateStr = getDateFromUnhyphenatedDateString(dateStr)
        if (!npDateStr) {
          throw new Error(`Could not get valid NP date string from ${dateStr}`)
        }
        const localisedDateStr = toNPLocaleDateString(npDateStr)
        // figure out H level to set: calc from config.eventsHeading or default to 2
        const hLevel = config.eventsHeading !== '' ? config.eventsHeading.split(' ')[0].length : 2
        outputArray.push(config.eventsHeading !== '' ? `${config.eventsHeading} for ${localisedDateStr}` : `${'#'.repeat(hLevel)} for ${localisedDateStr}`)
      } else {
        if (config.eventsHeading !== '' && includeHeadings) {
          outputArray.push(config.eventsHeading)
        }
      }

      // Get all the events for this day, for the given calendarSet
      const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, calendarSet) ?? []
      // logDebug('listDaysEvents', `- ${eArr.length} events found on ${dateStr} from  ${calendarSet.length} calendars ${String(calendarSet)}`)
      const mapForSorting: { cal: string, start: Date, text: string }[] = []

      // Process each event
      for (const e of eArr) {
        // logDebug('listDaysEvents', `- Processing event '${e.title}' (${typeof e})`)
        if (!includeAllDayEvents && e.isAllDay) {
          // logDebug('listDaysEvents', `  - skipping as event is all day and includeAllDayEvents is false`)
          continue
        }

        // Replace any mentions of the keywords in the e.title string
        const replacements = getReplacements(e, config)
        const thisEventStr = smartStringReplace(e.isAllDay ? alldayformat : format, replacements)

        mapForSorting.push({
          cal: withCalendarName ? calendarNameWithMapping(e.calendar, calendarNameMappings) : '',
          start: e.date,
          text: thisEventStr,
        })
      }

      // Sort the events
      if (config.sortOrder === 'calendar') {
        mapForSorting.sort(sortByCalendarNameThenStartTime())
      } else {
        mapForSorting.sort(sortByStartTimeThenCalendarName())
      }

      outputArray.push(mapForSorting.map((element) => element.text).join('\n'))
    }

    const output = outputArray.join('\n') // If this array is empty -> empty string
    logDebug('listDaysEvents', output)
    return output
  } catch (err) {
    logError('listDaysEvents', err.message)
    return '(error)'
  }
}

// ----------------------------------------------------------------------------
/**
 * Insert list of today's events at cursor position.
 * NB: When this is called by UI as a /command, it doesn't have any params passed with it.
 *
 * @author @jgclark
 * @param {?string} paramString - passed through to next function
 */
export async function insertDaysEvents(paramString: ?string): Promise<void> {
  try {
    logDebug(pluginJson, 'insertDaysEvents: Starting')
    if (Editor.note == null || Editor.type !== 'Calendar') {
      await showMessage(`Please run again with a calendar note open.`, 'OK', 'Insert Events')
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
 * Return string of matching events in the current day's note, from list in keys of config.addMatchingEvents, having applied placeholder formatting.
 * Note: Parameters can be passed in as a JSON string, except for the complex 'format' which only comes from 'config.addMatchingEvents'.
 * @author @jgclark
 * @param {?string} paramStringIn Paramaters to use
 * @return {string} List of matching events, as a multi-line string
 */
export async function listMatchingDaysEvents(
  paramStringIn: string = '', // NB: the parameter isn't currently used, but is provided for future expansion.
): Promise<string> {
  try {
    if (Editor.note == null || Editor.filename == null || Editor.type !== 'Calendar') {
      await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
      return ''
    }
    const openNote = Editor.note

    // handle getting no parameters passed at all
    let paramString = ''
    if (paramStringIn == null) {
      logWarn('listMatchingDaysEvents', `No parameters passed (from template), so will use defaults.`)
    } else {
      paramString = paramStringIn
    }

    const config = await getEventsSettings()
    // const baseDateStr = getDateStringFromCalendarFilename(Editor.filename)
    // logDebug(pluginJson, `listMatchingDaysEvents: starting for date ${baseDateStr} with paramString=${paramString}`)
    const noteTimeFrame = getCalendarNoteTimeframe(openNote)
    if (!noteTimeFrame) throw new Error(`No noteTimeFrame found for note ${openNote.filename}. Stopping.`)
    const startDayDateString = getDateStrForStartofPeriodFromCalendarFilename(Editor.filename)
    logDebug(pluginJson, `listMatchingDaysEvents: starting for noteTimeFrame=${noteTimeFrame} / date ${startDayDateString} with paramString='${paramString}'`)

    if (config.addMatchingEvents == null) {
      await showMessage(`Error: Empty 'addMatchingEvents' setting in Config. Stopping`, 'OK', 'List Matching Events')
      return `**Error: found no 'Add matching events' in plugin settings.**`
    }

    const formatArr = Object.values(config.addMatchingEvents)
    const textToMatchArr = Object.keys(config.addMatchingEvents)
    logDebug('listMatchingDaysEvents', `- from settings found ${textToMatchArr.length} match strings to look for`)

    // Get a couple of other supplied parameters, or use defaults
    const includeAllDayEvents: boolean = await getTagParamsFromString(paramString, 'includeAllDayEvents', true)
    const includeHeadings = await getTagParamsFromString(paramString, 'includeHeadings', true)
    const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', 1)
    const calendarSetStr: string = String(await getTagParamsFromString(paramString, 'calendarSet', config.calendarSet))
    const calendarSet: Array<string> = calendarSetStr !== '' ? calendarSetStr.split(',') : [] // also deal with empty case
    const calendarNameMappingsStr: string = String(await getTagParamsFromString(paramString, 'calendarNameMappings', config.calendarNameMappings))
    const calendarNameMappings: Array<string> = calendarNameMappingsStr !== '' ? calendarNameMappingsStr.split(',') : []

    const outputArray: Array<string> = []

    // For each day to cover
    for (let i = 0; i < daysToCover; i++) {
      // Set dateStr to the day in question (YYYYMMDD)
      // const dateStr = unhyphenateString(calcOffsetDateStr(getISODateStringFromYYYYMMDD(baseDateStr), `+${i}d`))
      const dateStr = calcOffsetDateStr(startDayDateString, `+${i}d`)
      logDebug('listDaysEvents', `${i}: startDayDateString=${startDayDateString}, dateStr=${dateStr}`)

      // Add heading if wanted, or if doing more than 1 day
      if (daysToCover > 1) {
        const npDateStr = getDateFromUnhyphenatedDateString(dateStr)
        if (!npDateStr) {
          throw new Error(`Could not get valid NP date string from ${dateStr}`)
        }
        const localisedDateStr = toNPLocaleDateString(npDateStr)
        // figure out H level to set: calc from config.eventsHeading or default to 2
        const hLevel = config.matchingEventsHeading !== '' ? config.matchingEventsHeading.split(' ')[0].length : 2
        outputArray.push(config.matchingEventsHeading !== '' ? `${config.matchingEventsHeading} for ${localisedDateStr}` : `${'#'.repeat(hLevel)} for ${localisedDateStr}`)
      } else {
        if (config.matchingEventsHeading !== '' && includeHeadings) {
          outputArray.push(config.matchingEventsHeading)
        }
      }

      // Get all the events for this day, for the wanted calendarSet
      const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, calendarSet) ?? []
      const mapForSorting: { cal: string, start: Date, text: string }[] = []

      // Process each event
      for (const e of eArr) {
        logDebug('listMatchingDaysEvents', `- Processing event '${e.title}' (${typeof e})`)
        if (!includeAllDayEvents && e.isAllDay) {
          logDebug('listMatchingDaysEvents', `  - skipping as event is all day and includeAllDayEvents is false`)
          continue
        }

        // for each event, check each of the strings we want to match
        for (let j = 0; j < textToMatchArr.length; j++) {
          const thisFormat: string = String(formatArr[j])
          const withCalendarName = thisFormat.includes('CAL')
          const reMatch = new RegExp(textToMatchArr[j], 'i')
          if (e.title.match(reMatch)) {
            logDebug('listMatchingDaysEvents', `- Found match to event '${e.title}' from '${textToMatchArr[j]}`)
            // Replace any mentions of the keywords in the e.title string
            const replacements = getReplacements(e, config)
            const thisEventStr = smartStringReplace(thisFormat, replacements)

            mapForSorting.push({
              cal: withCalendarName ? calendarNameWithMapping(e.calendar, calendarNameMappings) : '',
              start: e.date,
              text: thisEventStr,
            })

            // (v0.20.3) If we have the general configuration setting, or a 'STOPMATCHING' signal on this particular event, then break out of loop as we have made a match
            if (config.stopMatching || thisFormat.includes('STOPMATCHING')) {
              logDebug('listMatchingDaysEvents', `- STOPMATCHING signal given, so skipping other possible matches for this event`)
              break
            }
          } else {
            // logDebug('listMatchingDaysEvents', `- No match to ${e.title}`)
          }
        }
      }

      // Sort the events (if there are matching events)
      if (mapForSorting.length > 0) {
        // Sort the matched events
        if (config.sortOrder === 'calendar') {
          mapForSorting.sort(sortByCalendarNameThenStartTime())
        } else {
          mapForSorting.sort(sortByStartTimeThenCalendarName())
        }

        outputArray.push(mapForSorting.map((element) => element.text).join('\n'))
      } else {
        outputArray.push('No matching events')
      }
    }

    const output = outputArray.join('\n') // If this array is empty -> empty string
    logDebug('listMatchingDaysEvents', output)
    return output
  } catch (error) {
    logError('insertMatchingDaysEvents', error.message)
    return ''
  }
}

// ----------------------------------------------------------------------------
/**
 * Insert list of matching events in the current day's note, from list
 * in keys of config.addMatchingEvents. Apply format too.
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
 * Change the format placeholders to the actual values, using a Map
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
    outputObject.set('MEETINGNOTE', item.id ? `[Meeting Note](noteplan://x-callback-url/runPlugin?pluginID=np.MeetingNotes&command=newMeetingNoteFromEventID&arg0=${item.id}&arg1=${config.meetingTemplateTitle ? encodeURIComponent(config.meetingTemplateTitle) : ''})` : '')
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
export function smartStringReplace(format: string, replacements: Map<string, string>): string {
  try {
    // logDebug(pluginJson, `smartStringReplace starting for format <${format}>`)
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
    logError('smartStringReplace', error.message)
    return ''
  }
}

/**
 * Map 'name' to another if found in the 'mappings' array.
 * Note: returns original name if no mapping found.
 * @private
 * @author @m1well
 */
export const calendarNameWithMapping = (name: string, mappings: Array<string>): string => {
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
export const sortByCalendarNameThenStartTime = (): Function => {
  return (b, a) => {
    if (a.cal !== b.cal) {
      if (a.cal > b.cal) {
        return -1
      }
      if (b.cal > a.cal) {
        return 1
      }
    } else {
      if (a.start > b.start) {
        return -1
      }
      if (b.start > a.start) {
        return 1
      }
      return 0
    }
    return 0
  }
}

/**
 * Sorter for CalendarItems by .start (time) then .calendar (name)
 * @author @jgclark after @m1well
 */
export const sortByStartTimeThenCalendarName = (): Function => {
  return (b, a) => {
    if (a.start !== b.start) {
      if (a.start > b.start) {
        return -1
      }
      if (b.start > a.start) {
        return 1
      }
    } else {
      if (a.cal > b.cal) {
        return -1
      }
      if (b.cal > a.cal) {
        return 1
      }
      return 0
    }
    return 0
  }
}
