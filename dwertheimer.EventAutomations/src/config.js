// @flow

import { validateConfigProperties } from '../../helpers/config'
import { logDebug } from '@helpers/dev'

export function getTimeBlockingDefaults(): AutoTimeBlockingConfig {
  return {
    todoChar: '+' /* character at the front of a timeblock line - can be *,-,or a heading, e.g. #### */,
    checkedItemChecksOriginal: false /* if true, checked items will check the original item, not the timeblock */,
    timeBlockTag: `#🕑` /* placed at the end of the timeblock to show it was created by this plugin */,
    timeBlockHeading:
      '[Time Blocks](noteplan://runPlugin?pluginID=dwertheimer.EventAutomations&command=atb%20-%20Create%20AutoTimeBlocks%20for%20%3Etoday%27s%20Tasks)' /* if this heading exists in the note, timeblocks will be placed under it */,
    foldTimeBlockHeading: false,
    workDayStart: '00:00' /* needs to be in 24 hour format (two digits, leading zero) */,
    workDayEnd: '23:59' /* needs to be in 24 hour format (two digits, leading zero) */,
    durationMarker: "'" /* signifies how long a task is, e.g. apostrophe: '2h5m or use another character, e.g. tilde: ~2h5m */,
    intervalMins: 5 /* inverval on which to calculate time blocks */,
    removeDuration: true /* remove duration when creating timeblock text */,
    defaultDuration: 20 /* default duration of a task that has no duration/end time */,
    mode: 'PRIORITY_FIRST' /* 'PRIORITY_FIRST' or 'LARGEST_FIRST' or 'BY_TIMEBLOCK_TAG' */,
    orphanTagggedTasks: "OUTPUT_FOR_INFO (but don't schedule them)",
    allowEventSplits: false /* allow tasks to be split into multiple timeblocks */,
    insertIntoEditor: true /* insert timeblocks into the editor */,
    passBackResults: false /* pass back the results to the caller (e.g. for template calls) */,
    createCalendarEntries: false /* create calendar entries for the timeblocks */,
    eventEnteredOnCalTag: '#event_created' /* needs to match @jgclark config/events/processedTagName */,
    deletePreviousCalendarEntries: false /* before creating new calendar entries, delete previous calendar entries for the timeblocks; 
               to keep a calendar entry around, just remove the timeBlockTag */,
    includeTasksWithText: [] /* limit to tasks with ANY of these tags/text */,
    excludeTasksWithText: [] /* exclude tasks with ANY of these tags/text */,
    includeLinks: 'Pretty Links',
    linkText: '📄',
    syncedCopiesTitle: "Today's Synced Tasks",
    createSyncedCopies: true,
    foldSyncedCopiesHeading: false,
    runSilently: false,
    timeblockTextMustContainString: '' /* is set automatically when config is pulled */,
    foldersToIgnore: [],
    calendarToWriteTo: '',
    includeAllTodos: true,
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

const nonEmptyString: RegExp = /^(?!\s*$).+/

export function validateAutoTimeBlockingConfig(config: AutoTimeBlockingConfig): AutoTimeBlockingConfig {
  const configTypeCheck = {
    todoChar: /^(?!(?:.*\*){2})[\*|\-|\+|#{1,}]+$/,
    timeBlockTag: /^#.*/,
    timeBlockHeading: /^[^#+].*/,
    foldTimeBlockHeading: 'boolean',
    workDayStart: /^\d{2}:\d{2}$/,
    workDayEnd: /^\d{2}:\d{2}$/,
    durationMarker: nonEmptyString,
    intervalMins: 'number',
    removeDuration: 'boolean',
    createSyncedCopies: 'boolean',
    syncedCopiesTitle: nonEmptyString,
    foldSyncedCopiesHeading: 'boolean',
    defaultDuration: 'number',
    mode: 'string',
    orphanTagggedTasks: 'string',
    checkedItemChecksOriginal: 'boolean',
    allowEventSplits: 'boolean',
    insertIntoEditor: 'boolean',
    runSilently: { type: 'boolean', optional: true },
    passBackResults: { type: 'boolean', optional: true },
    createCalendarEntries: 'boolean',
    deletePreviousCalendarEntries: 'boolean',
    eventEnteredOnCalTag: nonEmptyString,
    includeLinks: nonEmptyString,
    linkText: nonEmptyString,
    includeTasksWithText: { type: 'array', optional: true },
    excludeTasksWithText: { type: 'array', optional: true },
    calendarToWriteTo: 'string',
    foldersToIgnore: { type: 'array', optional: true },
    presets: { type: 'array', optional: true },
    nowStrOverride: { type: /^\d{2}:\d{2}$/, optional: true },
    timeblockTextMustContainString: 'string',
    includeAllTodos: 'boolean',
  }
  try {
    // $FlowIgnore
    const validatedConfig = validateConfigProperties(config, configTypeCheck)
    if (validatedConfig.checkedItemChecksOriginal && (validatedConfig.todoChar !== '+' || validatedConfig.includeLinks !== 'Pretty Links')) {
      throw new Error(
        `To use the checklist check to check the original, your timeblock character must be + and the 'Include links to task location in time blocks' setting must be set to 'Pretty Links'`,
      )
    }
    // $FlowIgnore
    return validatedConfig
  } catch (error) {
    // console.log(`NPTimeblocking::validateAutoTimeBlockingConfig: ${String(error)}\nInvalid config:\n${JSON.stringify(config)}`)
    throw new Error(`${String(error)}`)
  }
}

export const arrayToCSV = (inStr: Array<string> | string): string => (Array.isArray(inStr) ? inStr.join(', ') : inStr)

export type AutoTimeBlockingConfig = {
  todoChar: string,
  checkedItemChecksOriginal: boolean,
  timeBlockTag: string,
  timeBlockHeading: string,
  foldTimeBlockHeading: boolean,
  workDayStart: string,
  workDayEnd: string,
  durationMarker: string,
  intervalMins: number,
  removeDuration: boolean,
  createSyncedCopies: boolean,
  syncedCopiesTitle: string,
  foldSyncedCopiesHeading: boolean,
  defaultDuration: number,
  mode: string,
  orphanTagggedTasks: string,
  allowEventSplits: boolean,
  insertIntoEditor: boolean,
  runSilently?: boolean,
  passBackResults?: boolean,
  createCalendarEntries: boolean,
  deletePreviousCalendarEntries: boolean,
  calendarToWriteTo: string,
  eventEnteredOnCalTag: string,
  includeLinks: string,
  linkText: string,
  includeTasksWithText?: Array<string>,
  excludeTasksWithText?: Array<string>,
  foldersToIgnore?: Array<string>,
  presets?: any,
  nowStrOverride?: string,
  timeblockTextMustContainString: string,
  includeAllTodos: boolean,
}
