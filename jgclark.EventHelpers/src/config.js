// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 29.9.2023 for v0.21.0, by @jgclark
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
} from '@helpers/dataManipulation'
import { type HourMinObj } from '@helpers/dateTime'
import { clo, log, logDebug, logWarn, logError } from "@helpers/dev"
import { type EventsConfig } from '@helpers/NPCalendar'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Get settings

const configKey = 'events'

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 * @author @jgclark
 * @return {EventsConfig} object with configuration
 */
export async function getEventsSettings(): Promise<any> {
  logDebug(pluginJson, `Start of getEventsSettings()`)
  try {
    // Get settings using ConfigV2
    let v2Config: EventsConfig = await DataStore.loadJSON("../jgclark.EventHelpers/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'EventHelpers' plugin. Please make sure you have installed it from the Plugin Preferences pane. For now I will use default settings.`)
      // Be kind and return a default set of config
      const defaultConfig: EventsConfig = {
        eventsHeading: "## Events",
        formatEventsDisplay: "### *|CAL|*: *|TITLE|* (*|START|*)*| with ATTENDEES|**|\nNOTES|*",
        formatAllDayEventsDisplay: "### *|CAL|*: *|TITLE|**| with ATTENDEES|**|\nNOTES|*",
        sortOrder: "time",
        matchingEventsHeading: "## Matching Events",
        addMatchingEvents: {},
        locale: "",
        timeOptions: "{\n\"hour\": \"2-digit\", \n\"minute\": \"2-digit\", \n\"hour12\": false\n}",
        calendarSet: [],
        calendarNameMappings: ["From;To"],
        addEventID: false,
        confirmEventCreation: true,
        processedTagName: "",
        removeTimeBlocksWhenProcessed: true,
        calendarToWriteTo: "",
        defaultEventDuration: 60,
        alternateDateFormat: "",
        removeDoneDates: true,
        uncompleteTasks: true,
        removeProcessedTagName: true,
        includeCompletedTasks: true,
        meetingTemplateTitle: ""
      }
      v2Config = defaultConfig
    }
    v2Config.locale = getLocale(v2Config)
    v2Config.timeOptions = getTimeOptions(v2Config)
    // clo(v2Config, `${configKey} settings from V2:`)
    return v2Config
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
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
  clo(tempTimeOptions, `tempTimeOptions: `)
  return tempTimeOptions
}
