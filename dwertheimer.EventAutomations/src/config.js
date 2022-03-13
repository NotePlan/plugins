// @flow

import { validateConfigProperties } from '../../helpers/config'

export function getTimeBlockingDefaults(): { [key: string]: any } {
  return {
    todoChar: '*' /* character at the front of a timeblock line - can be *,-,or a heading, e.g. #### */,
    timeBlockTag: `#🕑` /* placed at the end of the timeblock to show it was created by this plugin */,
    timeBlockHeading: 'Time Blocks' /* if this heading exists in the note, timeblocks will be placed under it */,
    workDayStart: '00:00' /* needs to be in 24 hour format (two digits, leading zero) */,
    workDayEnd: '23:59' /* needs to be in 24 hour format (two digits, leading zero) */,
    durationMarker: "'" /* signifies how long a task is, e.g. apostrophe: '2h5m or use another character, e.g. tilde: ~2h5m */,
    intervalMins: 5 /* inverval on which to calculate time blocks */,
    removeDuration: true /* remove duration when creating timeblock text */,
    defaultDuration: 20 /* default duration of a task that has no duration/end time */,
    mode: 'PRIORITY_FIRST' /* 'PRIORITY_FIRST' or 'LARGEST_FIRST' */,
    allowEventSplits: false /* allow tasks to be split into multiple timeblocks */,
    insertIntoEditor: true /* insert timeblocks into the editor */,
    passBackResults: false /* pass back the results to the caller (e.g. for template calls) */,
    createCalendarEntries: false /* create calendar entries for the timeblocks */,
    eventEnteredOnCalTag: '#event_created' /* needs to match @jgclark config/events/processedTagName */,
    deletePreviousCalendarEntries: false /* before creating new calendar entries, delete previous calendar entries for the timeblocks; 
               to keep a calendar entry around, just remove the timeBlockTag */,
    includeTasksWithText: [] /* limit to tasks with ANY of these tags/text */,
    excludeTasksWithText: [] /* exclude tasks with ANY of these tags/text */,
    includeLinks: 'OFF',
    linkText: '📄',
    presets: [
      { label: 'Limit Time Blocks to Work Hours', workDayStart: '08:00', workDayEnd: '17:59' },
      {
        label: 'Create Timeblocks on Calendar',
        createCalendarEntries: true,
        deletePreviousCalendarEntries: true,
        todoChar: '*',
      },
    ] /* presets for the dropdown */,
    /* OPTIONAL: nowStrOverride: "00:00" for testing, e.g. '00:00' */
  }
}

export function validateTimeBlockConfig(config: { [key: string]: any }): { [key: string]: any } {
  const configTypeCheck = {
    todoChar: /^(?!(?:.*\*){2})[\*|\-|#{1,}]+$/,
    timeBlockTag: 'string',
    timeBlockHeading: /^[^#+].*/,
    workDayStart: /^\d{2}:\d{2}$/,
    workDayEnd: /^\d{2}:\d{2}$/,
    durationMarker: 'string',
    intervalMins: 'number',
    removeDuration: 'boolean',
    defaultDuration: 'number',
    mode: 'string',
    allowEventSplits: 'boolean',
    insertIntoEditor: 'boolean',
    passBackResults: { type: 'boolean', optional: true },
    createCalendarEntries: 'boolean',
    deletePreviousCalendarEntries: 'boolean',
    eventEnteredOnCalTag: 'string',
    includeLinks: 'string',
    linkText: 'string',
    includeTasksWithText: { type: 'array', optional: true },
    excludeTasksWithText: { type: 'array', optional: true },
    presets: { type: 'array', optional: true },
    nowStrOverride: { type: /^\d{2}:\d{2}$/, optional: true },
  }
  try {
    // $FlowIgnore
    const validatedConfig = validateConfigProperties(config, configTypeCheck)
    return validatedConfig
  } catch (error) {
    // console.log(`NPTimeblocking::validateTimeBlockConfig: ${String(error)}\nInvalid config:\n${JSON.stringify(config)}`)
    throw new Error(`${String(error)}`)
  }
}

export const arrayToCSV = (inStr: Array<string> | string): string => (Array.isArray(inStr) ? inStr.join(', ') : inStr)
