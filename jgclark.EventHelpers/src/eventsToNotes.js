// @flow
// ----------------------------------------------------------------------------
// Command to bring calendar events into notes
// Last updated 12.4.2022 for v0.12.0, by @jgclark
// @jgclark, with additions by @dwertheimer, @weyert, @m1well
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getEventsSettings } from './config'
import { log, logWarn, logError, clo } from '../../helpers/dev'
import { getDateStringFromCalendarFilename, toLocaleTime } from '../../helpers/dateTime'
import { getTagParamsFromString, stringReplace } from '../../helpers/general'
import { getEventsForDay, type EventsConfig } from '../../helpers/NPCalendar'
import { showMessage } from '../../helpers/userInput'

/**
 * Return MD list of the current open Calendar note's events
 * @author @jgclark
 *
 * @param {string} paramString - passed to next function
 * @return {string} Markdown-formatted list of today's events
 */
export async function listDaysEvents(paramString: string = ''): Promise<string> {
  if (Editor.note == null || Editor.filename == null || Editor.type !== 'Calendar') {
    await showMessage(`Please run again with a calendar note open.`, 'OK', 'List Events')
    return ''
  }
  const dateStr = getDateStringFromCalendarFilename(Editor.filename)
  log(pluginJson, `listDaysEvents for date ${dateStr} with paramString=${String(paramString)}`)

  // Get config settings from Template folder _configuration note
  const config = await getEventsSettings()

  // Work out format for output line (from params, or if blank, a default)
  // NB: be aware that this call doesn't do type checking
  // NB: allow previous parameter names 'template' and 'allday_template' still.
  const format = String(await getTagParamsFromString(paramString, 'format', '- *|CAL|*: *|TITLE|* (*|START|*)'))
              || String(await getTagParamsFromString(paramString, 'template', '- *|CAL|*: *|TITLE|* (*|START|*)'))
  const alldayformat = String(await getTagParamsFromString(paramString, 'allday_format', '- *|CAL|*: *|TITLE|*'))
              || String(await getTagParamsFromString(paramString, 'allday_template', '- *|CAL|*: *|TITLE|*'))
  const includeHeadings = await getTagParamsFromString(paramString, 'includeHeadings', true)

  // If the format contains 'CAL' then we care about calendar names in output
  const withCalendarName = format.includes('CAL')

  // Get all the events for this day
  const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, config.calendarSet)
  log(pluginJson, `${eArr.length} events found from calendarSet of ${config.calendarSet.length} calendars`)
  const outputArray: Array<string> = []
  const mapForSorting: { cal: string, start: string, text: string }[] = []
  // let lastEventStr = '' // keep duplicates from multiple calendars out

  // Process each event
  for (const e of eArr) {
    const replacements = getReplacements(e, config)

    // Replace any mentions of the keywords in the e.title string
    const thisEventStr = stringReplace(e.isAllDay ? alldayformat : format, replacements).trimEnd()

    // This was used to avoid duplicates appearing; now I don't think it's needed
    // if (lastEventStr !== thisEventStr) {
    //   outputArray.push(thisEventStr)
    //   lastEventStr = thisEventStr
    // }

    mapForSorting.push({
      cal: withCalendarName ? calendarNameWithMapping(e.calendar, config.calendarNameMappings) : '',
      start: toLocaleTime(e.date),
      text: thisEventStr
    })
  }

  // Prepend heading if wanted
  if (config.eventsHeading !== '' && includeHeadings) {
    outputArray.unshift(config.eventsHeading)
  }

  // if (withCalendarName) {
    mapForSorting.sort(sortByCalendarNameAndStartTime())
  // } else {
  //   mapForSorting.sort(sortByStartTime())
  // }

  // let output = (withCalendarName)
  //   ? mapForSorting.map((element) => element.text).join('\n')
  //   : outputArray.join('\n')
  let output = mapForSorting.map((element) => element.text).join('\n')

  output.replace(/\s{2,}/gm, ' ') // If this array is empty -> empty string
  log(pluginJson, output)
  return output
}

// ----------------------------------------------------------------------------
/**
 * Insert list of today's events at cursor position.
 * NB: When this is called by UI as a command, *it doesn't have any params passed with it*.
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
 * TODO: include sorting here, as done in non-matching version
 * @author @jgclark
 *
 * @param {?string} paramString Paramaters to use (for future expansion)
 * @return {string} List of matching events, as a multi-line string
 */
export async function listMatchingDaysEvents(
  /*eslint-disable */
  paramString: ?string, // NB: the parameter isn't currently used, but is provided for future expansion.
  /*eslint-enable */
): Promise<string> {
  // $FlowIgnore[incompatible-call]
  const dateStr = getDateStringFromCalendarFilename(Editor.filename)
  log(pluginJson, `listMatchingDaysEvents for date ${dateStr}:`)

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
  const textToMatchA = Object.keys(config.addMatchingEvents)
  const formatArr = Object.values(config.addMatchingEvents)
  log(pluginJson, `  From settings found ${textToMatchA.length} match strings to look for`)

  // Get all events for this day
  const eArr: Array<TCalendarItem> = await getEventsForDay(dateStr, config.calendarSet)

  const outputArray: Array<string> = []
  // for each event, check each of the strings we want to match
  // let lastEventStr = '' // keep duplicates from multiple calendars out
  for (const e of eArr) {
    for (let i = 0; i < textToMatchA.length; i++) {
      // const m = textToMatchA[i]
      const format = formatArr[i]
      const reMatch = new RegExp(textToMatchA[i], 'i')
      if (e.title.match(reMatch)) {
        log(pluginJson, `  Found match to event '${e.title}'`)
        const replacements = getReplacements(e, config)
        // $FlowFixMe -- not sure how to deal with mixed coercing to strings
        const thisEventStr = stringReplace(format, replacements)
        // This was used to avoid duplicates appearing; now I don't think it's needed
        // if (lastEventStr !== thisEventStr) {
          outputArray.push(thisEventStr)
        //   lastEventStr = thisEventStr
        // }
      } else {
        // log(pluginJson, `No match to ${e.title}`)
      }
    }
  }
  const output = outputArray.join('\n').replace(/\\s{2,}/g, ' ') // If this array is empty -> empty string.
  log(pluginJson, output)
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
  log(pluginJson, `insertMatchingDaysEvents:`)

  const output = await listMatchingDaysEvents(paramString || '')
  Editor.insertTextAtCursor(output)
}

// ----------------------------------------------------------------------------
/**
 * @private
 * @author @m1well
 */
function getReplacements(item: TCalendarItem, config: EventsConfig): { key: string, value: string }[] {
  return [
    {
      key: '*|CAL|*',
      value: calendarNameWithMapping(item.calendar, config.calendarNameMappings),
    },
    { key: '*|TITLE|*', value: item.title },
    {
      key: '*|START|*',
      value: !item.isAllDay
        ? // $FlowFixMe[incompatible-call]
          toLocaleTime(item.date, config.locale, config.timeOptions)
        : '',
    },
    {
      key: '*|END|*',
      value:
        item.endDate != null && !item.isAllDay
          ? // $FlowFixMe[incompatible-call]
            toLocaleTime(item.endDate, config.locale, config.timeOptions)
          : '',
    },
    { key: '*|NOTES|*', value: item.notes },
    { key: '*|URL|*', value: item.url },
  ]
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
 * Sorter for CalendarItems, including CalendarName
 * @author @m1well
 */
export const sortByCalendarNameAndStartTime = (): Function => {
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
