// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 3.2.2022 for v0.11.1, by @jgclark
// @jgclark
// ----------------------------------------------------------------------------
import {
  castBooleanFromMixed,
  castHeadingLevelFromMixed,
  castNumberFromMixed,
  castStringArrayFromMixed,
  castStringFromMixed,
  trimAnyQuotes,
} from '../../helpers/dataManipulation'
import type { HourMinObj } from '../../helpers/dateTime'
import  { clo } from '../../helpers/dev'
// import { logAllEnvironmentSettings } from '../../helpers/NPdev'
import { showMessage } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings

// const DEFAULT_EVENTS_OPTIONS = `
//   events: {
//     calendarToWriteTo: "",  // specify calendar name to write events to. Must be writable calendar. If empty, then the default system calendar will be used.
//     addEventID: false,  // whether to add an '⏰event:ID' internal link when creating an event from a time block
//     processedTagName: "#event_created",  // optional tag to add after making a time block an event
//     confirmEventCreation: false,  // optional tag to indicate whether to ask user to confirm each event to be created
//     removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
//     eventsHeading: "### Events today",  // optional heading to put before list of today's events
//     calendarSet: [],  // optional ["array","of calendar","names"] to filter by when showing list of events. If empty or missing, no filtering will be done.
//     addMatchingEvents: {  // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
//       "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
//       "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
//       "holiday": "*|TITLE|* *|NOTES|*",
//     },
//     locale: "en-US",
//     timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
//     calendarNameMappings: [  // here you can map a calendar name to a new string - e.g. "Thomas" to "Me" with "Thomas;Me"
//       "From;To",
//     ],
//   },
// `

const configKey = 'events'

export type EventsConfig = {
  eventsHeading: string,
  addMatchingEvents: ?{ [string]: mixed },
  locale: string,
  timeOptions: any,
  calendarSet: string[],
  calendarNameMappings: string[],
  processedTagName: string,
  removeTimeBlocksWhenProcessed: boolean,
  addEventID: boolean,
  confirmEventCreation: boolean,
  calendarToWriteTo: string,
}

//------------------------------------------------------------------------------

/**
 * Get config settings from Template folder _configuration note
 * @author @jgclark
 */
export async function getEventsSettings(): Promise<EventsConfig> {
  console.log(`Start of getEventsSettings()`)
  // Wish the following was possible:
  // if (NotePlan.environment.version >= "3.4") {
  const v2Config: EventsConfig = DataStore.settings
  // $FlowFixMe[incompatible-call]
  // clo(v2Config, 'v2Config')
  
  if (v2Config != null && Object.keys(v2Config).length > 0) {
    const config: EventsConfig = v2Config
    config.locale = getLocale(v2Config)
    config.timeOptions = getTimeOptions(v2Config)

    // $FlowFixMe
    clo(config, `\t${configKey} settings from V2:`)
    return config

    // console.log(`\tInfo: couldn't find 'events' settings in _configuration note. Will use defaults.`)
    // return {
    //   eventsHeading: '### Events today',
    //   addMatchingEvents: {
    //     "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
    //     "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
    //     "holiday": "*|TITLE|* *|NOTES|*",
    //   },
    //   locale: 'en-US',
    //   timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
    //   calendarSet: [],
    //   calendarNameMappings: [],
    //   processedTagName: '#event_created',
    //   removeTimeBlocksWhenProcessed: true,
    //   addEventID: false,
    //   confirmEventCreation: false,
    //   calendarToWriteTo: '',
    // }
  } else {
    // Read settings from _configuration, or if missing set a default
    // Don't mind if no config section is found
    // const result = await getOrMakeConfigurationSection(
    //   'events',
    //   DEFAULT_EVENTS_OPTIONS,
    //   // no minimum config needed, as can use defaults if need be
    // )
    const v1Config = await getOrMakeConfigurationSection(configKey) ?? {}

    // $FlowFixMe[incompatible-type]
    let tempAME: ?{ [string]: mixed } = v1Config.addMatchingEvents ?? null

    const config: EventsConfig = {
      eventsHeading: castStringFromMixed(v1Config, 'eventsHeading'),
      addMatchingEvents: tempAME,
      locale: getLocale(v1Config),
      timeOptions: getTimeOptions(v1Config),
      calendarSet: castStringArrayFromMixed(v1Config, 'calendarSet'),
      calendarNameMappings: castStringArrayFromMixed(v1Config, 'calendarNameMappings'),
      processedTagName: castStringFromMixed(v1Config, 'processedTagName'),
      removeTimeBlocksWhenProcessed: castBooleanFromMixed(v1Config, 'removeTimeBlocksWhenProcessed'),
      addEventID: castBooleanFromMixed(v1Config, 'addEventID'),
      confirmEventCreation: castBooleanFromMixed(v1Config, 'confirmEventCreation'),
      calendarToWriteTo: castStringFromMixed(v1Config, 'calendarToWriteTo'),
    }
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V1:`)
    return config
  }
}

// Get locale: if blank in settings then get from NP environment (from 3.3.2)
// or if not available default to 'en-US'
function getLocale(tempConfig: Object): string {
  const envRegion = (NotePlan?.environment) ? NotePlan?.environment?.regionCode : ''
  const envLanguage = (NotePlan?.environment) ? NotePlan?.environment?.languageCode : ''
  // $FlowFixMe
  let tempLocale = castStringFromMixed(tempConfig, 'locale')
  tempLocale = (tempLocale != null) && tempLocale !== ''
    ? tempLocale
    : (envRegion !== '')
      ? `${envLanguage}-${envRegion}`
      : 'en-US'
  return tempLocale
}

// Get timeOptions: if blank in settings then get from NP environment (from 3.3.2)
// or if not available default
function getTimeOptions(tempConfig: Object): Object {
  const env1224 = (NotePlan?.environment) ? NotePlan?.environment?.is12hFormat : false
  let tempTimeOptions = tempConfig?.timeOptions ?? { hour: '2-digit', minute: '2-digit', hour12: env1224 }
  // clo(tempTimeOptions, `tempTimeOptions: `)
  return tempTimeOptions
}