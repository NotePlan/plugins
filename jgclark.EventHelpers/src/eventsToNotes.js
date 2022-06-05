// @flow
// ----------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated 25.5.2022 for v0.16.1, by @jgclark
// @jgclark, with additions by @dwertheimer, @weyert, @m1well
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getEventsSettings } from './config'
import { getEventsForDay, type EventsConfig } from '@helpers/NPCalendar'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getDateFromUnhyphenatedDateString,
  getISODateStringFromYYYYMMDD,
  toLocaleDateString,
  toLocaleTime,
  unhyphenatedDate,
  unhyphenateString,
} from '@helpers/dateTime'
import { clo, log, logWarn, logError } from '@helpers/dev'
import { getTagParamsFromString } from '@helpers/general'
import { showMessage } from '@helpers/userInput'

/**
 * Return MD list of the current open Calendar note's events
 * @author @jgclark
 *
 * @param {string} paramString - checked for options
 * @return {string} Markdown-formatted list of today's events
 */
export async function listDaysEvents(paramString: string = ''): Promise<string> {
  if (Editor.note == null || Editor.filename == null || Editor.type !== 'Calendar') {
    await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
    return ''
  }
  try {
    const baseDateStr = getDateStringFromCalendarFilename(Editor.filename)
    log(pluginJson, `listDaysEvents for date ${baseDateStr} with paramString='${paramString}'`)

    // Get config settings
    const config = await getEventsSettings()

    // Get a couple of other suppplied parameters, or use defaults
    // Work out format for output line (from params, or if blank, a default)
    // NB: be aware that this call doesn't do type checking
    // NB: allow previous parameter names 'template' and 'allday_template' still.
    const format = (paramString.includes('"format":'))
      ? String(await getTagParamsFromString(paramString, 'format', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEENAMES|**|\nNOTES|**|\nURL|*'))
      : (paramString.includes('"template":'))
        ? String(await getTagParamsFromString(paramString, 'template', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEENAMES|**|\nNOTES|**|\nURL|*'))
        : config.formatEventsDisplay
    const alldayformat = (paramString.includes('"allday_format":'))
      ? String(await getTagParamsFromString(paramString, 'allday_format', '- *|CAL|*: *|TITLE|**| with ATTENDEENAMES|**|\nNOTES|**|\nURL|*'))
      : (paramString.includes('"allday_template":'))
        ? String(await getTagParamsFromString(paramString, 'allday_template', '- *|CAL|*: *|TITLE|**| with ATTENDEENAMES|**|\nNOTES|**|\nURL|*'))
        : config.formatAllDayEventsDisplay
    const includeHeadings = await getTagParamsFromString(paramString, 'includeHeadings', true)
    const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', 1)
    // If the format contains 'CAL' then we care about calendar names in output
    const withCalendarName = format.includes('CAL')

    const outputArray: Array<string> = []

    // For each day to cover
    for (let i = 0; i < daysToCover; i++) {
      // Set dateStr to the day in question (YYYYMMDD)
      const isoBaseDateStr = getISODateStringFromYYYYMMDD(baseDateStr)
      const dateStr = unhyphenateString(calcOffsetDateStr(isoBaseDateStr, `+${i}d`))

      // Add heading if wanted, or if doing more than 1 day
      if (daysToCover > 1) {
        // $FlowIgnore[incompatible-call]
        const localisedDateStr = toLocaleDateString(getDateFromUnhyphenatedDateString(dateStr))
        outputArray.push((config.eventsHeading !== '') ? `${config.eventsHeading} for ${localisedDateStr}` : `### for ${localisedDateStr}`)
      } else {
        if (config.eventsHeading !== '' && includeHeadings) {
          outputArray.push(config.eventsHeading)
        }
      }

      // Get all the events for this day
      const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, config.calendarSet)
      log(pluginJson, `${eArr.length} events found on ${dateStr} from calendarSet of ${config.calendarSet.length} calendars`)
      const mapForSorting: { cal: string, start: Date, text: string }[] = []

      // Process each event
      for (const e of eArr) {
        log(pluginJson, `  Processing event '${e.title}' (${typeof e})`)
        // Replace any mentions of the keywords in the e.title string
        const replacements = getReplacements(e, config)
        const thisEventStr = smartStringReplace(e.isAllDay ? alldayformat : format, replacements)

        mapForSorting.push({
          cal: withCalendarName ? calendarNameWithMapping(e.calendar, config.calendarNameMappings) : '',
          start: e.date,
          text: thisEventStr
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

    let output = outputArray.join('\n') // If this array is empty -> empty string
    // log(pluginJson, output)
    return output
  }
  catch (err) {
    logError(pluginJson, err.message)
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
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage(`Please run again with a calendar note open.`, 'OK', 'Insert Events')
    return
  }

  // Get list of events happening on the day of the open note
  let output: string = await listDaysEvents(paramString || '')
  output += output.length === 0 ? '\nnone\n' : '\n'
  Editor.insertTextAtCursor(output)
}

// ----------------------------------------------------------------------------
/**
 * Return string list of matching events in the current day's note, from list
 * in keys of config.addMatchingEvents. Apply format too.
 * @author @jgclark
 *
 * @param {?string} paramString Paramaters to use (for future expansion)
 * @return {string} List of matching events, as a multi-line string
 */
export async function listMatchingDaysEvents(
  paramString: string = '', // NB: the parameter isn't currently used, but is provided for future expansion.
): Promise<string> {
  // $FlowIgnore[incompatible-call] - called by a function that checks Editor is valid.
  const baseDateStr = getDateStringFromCalendarFilename(Editor.filename)
  log(pluginJson, `listMatchingDaysEvents for date ${baseDateStr} with paramString=${paramString}`)

  // Get config settings
  const config = await getEventsSettings()
  if (config.addMatchingEvents == null) {
    await showMessage(
      `Error: Empty 'addMatchingEvents' setting in Config. Stopping`,
      'OK',
      'List Matching Events',
    )
    return `(Error: found no 'addMatchingEvents' setting in Config.)`
  }
  const textToMatchArr = Object.keys(config.addMatchingEvents)
  const formatArr = Object.values(config.addMatchingEvents)
  log(pluginJson, `From settings found ${textToMatchArr.length} match strings to look for`)

  // Get a couple of other supplied parameters, or use defaults
  const includeHeadings = await getTagParamsFromString(paramString, 'includeHeadings', true)
  const daysToCover: number = await getTagParamsFromString(paramString, 'daysToCover', 1)

  const outputArray: Array<string> = []

  // For each day to cover
  for (let i = 0; i < daysToCover; i++) {
    // Set dateStr to the day in question (YYYYMMDD)
    let dateStr = unhyphenateString(calcOffsetDateStr(getISODateStringFromYYYYMMDD(baseDateStr), `+${i}d`))

    // Add heading if wanted, or if doing more than 1 day
    if (daysToCover > 1) {
      // $FlowIgnore[incompatible-call]
      const localisedDateStr = toLocaleDateString(getDateFromUnhyphenatedDateString(dateStr))
      outputArray.push((config.matchingEventsHeading !== '') ? `${config.matchingEventsHeading} for ${localisedDateStr}` : `### for ${localisedDateStr}`)
    } else {
      if (config.matchingEventsHeading !== '' && includeHeadings) {
        outputArray.push(config.matchingEventsHeading)
      }
    }

    // Get all the events for this day
    const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, config.calendarSet)
    const mapForSorting: { cal: string, start: Date, text: string }[] = []

    // for each event, check each of the strings we want to match
    for (const e of eArr) {
      for (let j = 0; j < textToMatchArr.length; j++) {
        const thisFormat: string = String(formatArr[j])
        const withCalendarName = thisFormat.includes('CAL')
        const reMatch = new RegExp(textToMatchArr[j], 'i')
        if (e.title.match(reMatch)) {
          log(pluginJson, `  Found match to event '${e.title}'`)
          // Replace any mentions of the keywords in the e.title string
          const replacements = getReplacements(e, config)
          const thisEventStr = smartStringReplace(thisFormat, replacements)

          mapForSorting.push({
            cal: withCalendarName
              ? calendarNameWithMapping(e.calendar, config.calendarNameMappings)
              : '',
            start: e.date,
            text: thisEventStr
          })
        } else {
          // log(pluginJson, `No match to ${e.title}`)
        }
      }
    }

    // If there are matching events
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

  let output = outputArray.join('\n') // If this array is empty -> empty string
  // log(pluginJson, output)
  return output
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
  if (Editor.note == null || Editor.type !== 'Calendar') {
    await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
    return
  }
  const output = await listMatchingDaysEvents(paramString || '')
  Editor.insertTextAtCursor(output)
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
  // log(pluginJson, 'starting getReplacementsV2')
  let outputObject = new Map < string, string> ()

  outputObject.set('CAL', calendarNameWithMapping(item.calendar, config.calendarNameMappings))
  outputObject.set('TITLE', item.title)
  outputObject.set('NOTES', item.notes)
  outputObject.set('ATTENDEENAMES', item.attendeeNames ? item.attendeeNames.join(', ') : '')
  outputObject.set('ATTENDEES', item.attendees ? item.attendees.join(', ') : '')
  outputObject.set('EVENTLINK', item.calendarItemLink ? item.calendarItemLink : '')
  outputObject.set('DATE', toLocaleDateString(item.date))
  outputObject.set('START', !item.isAllDay ? toLocaleTime(item.date, config.locale, config.timeOptions) : '')
  outputObject.set('END', item.endDate != null && !item.isAllDay ? toLocaleTime(item.endDate, config.locale, config.timeOptions) : '')
  outputObject.set('URL', item.url)

  // outputObject.forEach((v, k, map) => { console.log(`${k} : ${v}`) })
  return outputObject
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
  // log(pluginJson, `smartStringReplaceV2 starting for format <${format}>`)
  let output = format

  // For each possible placeholder, process it if it present in format AND the value for this event is not empty
  // (For safety ATTENDEES needs to come before END in the list, as 'END' is part of 'ATTENDEES'!)
  const placeholders = ['CAL', 'TITLE', 'EVENTLINK', 'ATTENDEENAMES', 'ATTENDEES', 'DATE', 'START', 'END', 'NOTES', 'URL']
  for (let p of placeholders) {
    const thisRE = new RegExp("\\*\\|([^|*]*?" + p + ".*?)\\|\\*")
    let REResult = output.match(thisRE) // temp RE result
    if (REResult) {
      // We have matched the term in the format string
      let matchedTag = REResult[0] // includes opening and closing *|...|*
      let matchedTagInternals = REResult[1] // excludes the opening and closing *|...|*

      // if Placeholder p has a replacement Value then replace the placeholder's tag with the replacement
      const replacementValue = replacements.get(p) ?? ''
      if (replacementValue !== '') {
        let replacementForTag = matchedTagInternals.replace(p, replacementValue)
        log(pluginJson, `    replacing ${replacementValue} for ${p}`)
        output = output.replace(matchedTag, replacementForTag)
      } else {
        output = output.replace(matchedTag, '')
      }
      log(pluginJson, `  => ${output}`)
    }
  }

  return output
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
