// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 12.4.2022 for v0.12.0, by @jgclark
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
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)

 * @author @jgclark
 * @return {EventsConfig} object with configuration
 */
export async function getEventsSettings(): Promise<any> {
  log(pluginJson, `Start of getEventsSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: EventsConfig = await DataStore.loadJSON("../jgclark.EventHelpers/settings.json")
    // $FlowFixMe
    // clo(v2Config, `${configKey} settings from V2:`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      throw new Error(`Cannot find settings for '${configKey}' plugin`)
    }
    v2Config.locale = getLocale(v2Config)
    v2Config.timeOptions = getTimeOptions(v2Config)
    return v2Config
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
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
