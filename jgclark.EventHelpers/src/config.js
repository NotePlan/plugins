// @flow
// ----------------------------------------------------------------------------
// Helpers for Event Helpers plugin.
// (More general event helpers are in the helpers/ folder.)
// Last updated 28.1.2022 for v0.11.0, by @jgclark
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
// import  { clo } from '../../helpers/dev'
// import { logAllEnvironmentSettings } from '../../helpers/NPdev'
import { showMessage } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings

const DEFAULT_EVENTS_OPTIONS = `
  events: {
    calendarToWriteTo: "",  // specify calendar name to write events to. Must be writable calendar. If empty, then the default system calendar will be used.
    addEventID: false,  // whether to add an '⏰event:ID' internal link when creating an event from a time block
    processedTagName: "#event_created",  // optional tag to add after making a time block an event
    confirmEventCreation: false,  // optional tag to indicate whether to ask user to confirm each event to be created
    removeTimeBlocksWhenProcessed: true,  // whether to remove time block after making an event from it
    eventsHeading: "### Events today",  // optional heading to put before list of today's events
    calendarSet: [],  // optional ["array","of calendar","names"] to filter by when showing list of events. If empty or missing, no filtering will be done.
    addMatchingEvents: {  // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
      "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
      "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
      "holiday": "*|TITLE|* *|NOTES|*",
    },
    locale: "en-US",
    timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
    calendarNameMappings: [  // here you can map a calendar name to a new string - e.g. "Thomas" to "Me" with "Thomas;Me"
      "From;To",
    ],
  },
`

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
  const result = await getOrMakeConfigurationSection(
    'events',
    DEFAULT_EVENTS_OPTIONS,
    // no minimum config needed, as can use defaults if need be
  )
  if (result == null || Object.keys(result).length === 0) {
    console.log(`\tInfo: couldn't find 'events' settings in _configuration note. Will use defaults.`)
    return {
      eventsHeading: '### Events today',
      addMatchingEvents: {
        "meeting": "### *|TITLE|* (*|START|*)\\n*|NOTES|*",
        "webinar": "### *|TITLE|* (*|START|*) *|URL|*",
        "holiday": "*|TITLE|* *|NOTES|*",
      },
      locale: 'en-US',
      timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
      calendarSet: [],
      calendarNameMappings: [],
      processedTagName: '#event_created',
      removeTimeBlocksWhenProcessed: true,
      addEventID: false,
      confirmEventCreation: false,
      calendarToWriteTo: '',
    }
  } else {
    console.log(`\tFound 'events' settings in _configuration note.`)
    // Get locale: if blank in settings then get from NP environment (from 3.3.2)
    // or if not available default to 'en-US'
    const envRegion = (NotePlan.environment) ? NotePlan.environment.regionCode : ''
    const envLanguage = (NotePlan.environment) ? NotePlan.environment.languageCode : ''
    let tempLocale = castStringFromMixed(result, 'locale')
    tempLocale = (tempLocale != null) && tempLocale !== ''
        ? tempLocale
        : (envRegion !== '')
          ? `${envLanguage}-${envRegion}`
        : 'en-US'
    
    const env1224 = (NotePlan.environment) ? NotePlan.environment.is12hFormat : false
    let tempTimeOptions = result?.timeOptions ?? { hour: '2-digit', minute: '2-digit', hour12: env1224 }
    // $FlowFixMe[incompatible-call]
    // clo(tempTimeOptions)
    // $FlowFixMe[incompatible-type]
    let tempAME: ?{ [string]: mixed } = result.addMatchingEvents ?? null

    const config: EventsConfig = {
      eventsHeading: castStringFromMixed(result, 'eventsHeading'),
      addMatchingEvents: tempAME,
      locale: tempLocale,
      timeOptions: tempTimeOptions,
      calendarSet: castStringArrayFromMixed(result, 'calendarSet'),
      calendarNameMappings: castStringArrayFromMixed(result, 'calendarNameMappings'),
      processedTagName: castStringFromMixed(result, 'processedTagName'),
      removeTimeBlocksWhenProcessed: castBooleanFromMixed(result, 'removeTimeBlocksWhenProcessed'),
      addEventID: castBooleanFromMixed(result, 'addEventID'),
      confirmEventCreation: castBooleanFromMixed(result, 'confirmEventCreation'),
      calendarToWriteTo: castStringFromMixed(result, 'calendarToWriteTo'),
    }
  
    console.log(`loaded config OK`)
    // console.log(`config = ${clo(config)}\n`)
    return config
  }
}
