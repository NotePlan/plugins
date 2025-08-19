// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 2025-08-19 for v0.22.2, by @jgclark
// @jgclark
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { castStringFromMixed } from '@helpers/dataManipulation'
import { clo, log, logDebug, logWarn, logError } from "@helpers/dev"
import { type EventsConfig } from '@helpers/NPCalendar'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Get settings

// const configKey = 'events'

/**
 * Get config settings
 * @author @jgclark
 * @return {EventsConfig} object with configuration
 */
export async function getEventsSettings(): Promise<any> {
  logDebug(pluginJson, `Start of getEventsSettings()`)
  try {
    // Get settings using ConfigV2
    let config: EventsConfig = await DataStore.loadJSON("../jgclark.EventHelpers/settings.json")

    if (config == null || Object.keys(config).length === 0) {
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
        meetingTemplateTitle: "",
        addComputedFinalDate: false
      }
      config = defaultConfig
    }
    config.locale = getLocale(config)
    config.timeOptions = getTimeOptions(config)
    // clo(config, `${configKey} settings from V2:`)
    return config
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
  const tempTimeOptions = tempConfig?.timeOptions ?? { hour: '2-digit', minute: '2-digit', hour12: env1224 }
  clo(tempTimeOptions, `tempTimeOptions: `)
  return tempTimeOptions
}
