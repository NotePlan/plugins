// @flow
// ----------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated 6.5.2022 for v0.15.1, by @jgclark
// @jgclark, with additions by @dwertheimer, @weyert, @m1well
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getEventsSettings } from './config'
import { attendeesAsString } from '../../helpers/calendar'
import { getEventsForDay, type EventsConfig } from '../../helpers/NPCalendar'
import { clo, log, logWarn, logError } from '../../helpers/dev'
import { getDateStringFromCalendarFilename, getISODateStringFromYYYYMMDD, getDateFromUnhyphenatedDateString, toLocaleDateString, toLocaleTime, unhyphenatedDate } from '../../helpers/dateTime'
import { calcOffsetDate } from '../../helpers/NPdateTime'
import { getTagParamsFromString, stringReplace } from '../../helpers/general'
import { showMessage } from '../../helpers/userInput'

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
      ? String(await getTagParamsFromString(paramString, 'format', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEES|**|\nNOTES|**|\nURL|*'))
      : (paramString.includes('"template":'))
        ? String(await getTagParamsFromString(paramString, 'template', '- *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEES|**|\nNOTES|**|\nURL|*'))
        : config.formatEventsDisplay
    const alldayformat = (paramString.includes('"allday_format":'))
      ? String(await getTagParamsFromString(paramString, 'allday_format', '- *|CAL|*: *|TITLE|**| with ATTENDEES|**|\nNOTES|**|\nURL|*'))
      : (paramString.includes('"allday_template":'))
        ? String(await getTagParamsFromString(paramString, 'allday_template', '- *|CAL|*: *|TITLE|**| with ATTENDEES|**|\nNOTES|**|\nURL|*'))
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
      const cOD = calcOffsetDate(isoBaseDateStr, `+${i}d`)
      const dateStr = unhyphenatedDate(cOD)

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
        log(pluginJson, `  Processing event '${e.title}'`)
        // Replace any mentions of the keywords in the e.title string
        const replacements = getReplacements(e, config)
        const thisEventStr = smartStringReplace(e.isAllDay ? alldayformat : format, replacements).trimEnd()

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

    let output = outputArray.join('\n').replace(/\s{2,}/gm, ' ') // If this array is empty -> empty string
    log(pluginJson, output)
    return output
  }
  catch (err) {
    logError(pluginJson, err.message)
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
    let dateStr = unhyphenatedDate(calcOffsetDate(getISODateStringFromYYYYMMDD(baseDateStr), `+${i}d`))

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

  let output = outputArray.join('\n').replace(/\s{2,}/gm, ' ') // If this array is empty -> empty string
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
 * Change the format placeholders to the actual values. For V1 syntax.
 * @private
 * @author @m1well
 * @param {TCalendarItem} item Calendar item whose values to use
 * @param {EventsConfig} config current configuration to use for this plugin
 * @return {{string, string}}
 */
function getReplacements(item: TCalendarItem, config: EventsConfig): { key: string, value: string }[] {
  let outputObject = [
    { key: 'CAL', value: calendarNameWithMapping(item.calendar, config.calendarNameMappings) },
    { key: 'TITLE', value: item.title },
    { key: 'NOTES', value: item.notes },
    { key: 'URL', value: '<item.url disabled>' },
    // $FlowIgnore[incompatible-call]
    { key: 'ATTENDEES', value: item.attendees ? attendeesAsString(item.attendees) : '' },
    { key: 'EVENTLINK', value: item.calendarItemLink ? item.calendarItemLink : '' },
    { key: 'DATE', value: toLocaleDateString(item.date) },
    {
      key: 'START',
      value: !item.isAllDay
        ? toLocaleTime(item.date, config.locale, config.timeOptions)
        : '',
    },
    {
      key: 'END',
      value:
        item.endDate != null && !item.isAllDay
          ? toLocaleTime(item.endDate, config.locale, config.timeOptions)
          : '',
    },
  ]
  // console.log(typeof outputObject)
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
function smartStringReplace(format: string, replacements: { key: string, value: string }[]): string {
  log(pluginJson, `smartStringReplace starting for format <${format}>`)
  let output = format
  // let trer = [] // temp RE result
  // let matchedTag = '' // to include opening and closing *|...|*
  // let matchedTagInternals = '' // to exclude the opening and closing *|...|*
  // let replacementForTag = ''

  // For each possible placeholder, process it if it present in format AND the value for this event is not empty
  // (For safety ATTENDEES needs to come before END in the list, as 'END' is part of 'ATTENDEES'!)
  const placeholders = ['CAL', 'TITLE', 'EVENTLINK', 'ATTENDEES', 'DATE', 'START', 'END', 'NOTES', 'NOTES', 'URL']
  for (let p of placeholders) {
    const thisRE = new RegExp("\\*\\|([^|*]*?"+p+".*?)\\|\\*")
    let trer = output.match(thisRE) // temp RE result
    if (trer) {
      // We have matched the term in the format string
      let matchedTag = trer[0] // includes opening and closing *|...|*
      let matchedTagInternals = trer[1] // excludes the opening and closing *|...|*
      const thisPlaceholderValue = stringReplace(p, replacements)
      if (thisPlaceholderValue !== '') {
        log(pluginJson, ` matched ${p}`)
        let replacementForTag = stringReplace(matchedTagInternals, replacements)
        // console.log(`  ${matchedTagInternals} / ${replacementForTag}`)
        output = output.replace(matchedTag, replacementForTag)
      } else {
        output = output.replace(matchedTag, '')
      }
      log(pluginJson, `  => ${output}`)
    }
  }
  
  return output.trimEnd()
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
