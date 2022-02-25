// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 20.2.2022 for v0.11.5, by @jgclark
// @jgclark
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import {
  castBooleanFromMixed,
  castHeadingLevelFromMixed,
  castNumberFromMixed,
  castStringArrayFromMixed,
  castStringFromMixed,
  trimAnyQuotes,
} from '../../helpers/dataManipulation'
import { clo, log, logWarn, logError } from "../../helpers/dev"
import { type HourMinObj } from '../../helpers/dateTime'
import { type EventsConfig } from '../../helpers/NPCalendar'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//------------------------------------------------------------------------------
// Get settings

const configKey = 'events'

/**
 * Get config settings from either ConfigV1 or Config V2 (if available)
 * @author @jgclark
 */
export async function getEventsSettings(): Promise<EventsConfig> {
  log(pluginJson, `Start of getEventsSettings()`)
  // Wish the following was possible:
  // if (NotePlan.environment.version >= "3.4") {
  
  // Get settings using ConfigV2
  // This is the usual way ... but it breaks when run from a Template ...
  // const v2Config: EventsConfig = DataStore.settings
  // ... so try this explicit way instead
  const v2Config: EventsConfig = await DataStore.loadJSON("../jgclark.EventHelpers/settings.json")
  
  if (v2Config != null && Object.keys(v2Config).length > 0) {
    const config: EventsConfig = v2Config
    config.locale = getLocale(v2Config)
    config.timeOptions = getTimeOptions(v2Config)

    // $FlowFixMe
    clo(config, `\t${configKey} settings from V2:`)
    return config

  } else {
    // Read settings from _configuration, or if missing set a default
    // Don't mind if no config section is found
    // const result = await getOrMakeConfigurationSection(
    //   'events',
    //   DEFAULT_EVENTS_OPTIONS,
    //   // no minimum config needed, as can use defaults if need be
    // )
    const v1Config = (await getOrMakeConfigurationSection(configKey)) ?? {}

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
      defaultEventDuration: 60 // not available to set through ConfigV1
    }
    // $FlowFixMe
    clo(config, `\t${configKey} settings from V1:`)
    return config
  }
}

// Get locale: if blank in settings then get from NP environment (from 3.3.2)
// or if not available default
function getLocale(tempConfig: Object): string {
  const envRegion = NotePlan?.environment ? NotePlan?.environment?.regionCode : ''
  const envLanguage = NotePlan?.environment ? NotePlan?.environment?.languageCode : ''
  let tempLocale = castStringFromMixed(tempConfig, 'locale')
  tempLocale =
    tempLocale != null && tempLocale !== '' ? tempLocale : envRegion !== '' ? `${envLanguage}-${envRegion}` : 'en-US'
  return tempLocale
}

// Get timeOptions: if blank in settings then get from NP environment (from 3.3.2)
// or if not available default
function getTimeOptions(tempConfig: Object): Object {
  const env1224 = NotePlan?.environment ? NotePlan?.environment?.is12hFormat : false
  let tempTimeOptions = tempConfig?.timeOptions ?? { hour: '2-digit', minute: '2-digit', hour12: env1224 }
  // clo(tempTimeOptions, `tempTimeOptions: `)
  return tempTimeOptions
}
