// @flow
// ----------------------------------------------------------------------------
// Sort configuration for commands in the Event Helpers plugin.
// Last updated 2025-11-21 for v0.23.0, by @jgclark
// @jgclark
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { castStringFromMixed } from '@helpers/dataManipulation'
import { clo, logDebug, logWarn, logError } from "@helpers/dev"
import { type EventsConfig } from '@helpers/NPCalendar'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Get settings

/**
 * Get default configuration object
 * @private
 * @returns {EventsConfig} Default configuration
 */
function getDefaultConfig(): EventsConfig {
  return {
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
}

/**
 * Get config settings
 * @author @jgclark
 * @return {Promise<EventsConfig>} object with configuration
 */
export async function getEventsSettings(): Promise<EventsConfig> {
  logDebug(pluginJson, `Start of getEventsSettings()`)
  try {
    // Get settings using ConfigV2
    let config: EventsConfig = await DataStore.loadJSON("../jgclark.EventHelpers/settings.json")

    if (config == null || Object.keys(config).length === 0) {
      await showMessage(`Cannot find settings for the 'EventHelpers' plugin. Please make sure you have installed it from the Plugin Preferences pane. For now I will use default settings.`)
      config = getDefaultConfig()
    }
    config.locale = getLocale(config)
    config.timeOptions = getTimeOptions(config)
    return config
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
    // Return default config as fallback
    const defaultConfig = getDefaultConfig()
    defaultConfig.locale = getLocale(defaultConfig)
    defaultConfig.timeOptions = getTimeOptions(defaultConfig)
    return defaultConfig
  }
}

/**
 * Get locale: if blank in settings then get from NP environment, or if not available default ('en-US').
 * @author @jgclark
 * @param {Object} tempConfig
 * @returns {string}
 */
function getLocale(tempConfig: Object): string {
  const tempLocale = castStringFromMixed(tempConfig, 'locale')
  if (tempLocale != null && tempLocale !== '') {
    return tempLocale
  }

  const envRegion = NotePlan?.environment?.regionCode ?? ''
  const envLanguage = NotePlan?.environment?.languageCode ?? ''

  if (envRegion !== '' && envLanguage !== '') {
    return `${envLanguage}-${envRegion}`
  }

  return 'en-US'
}

/**
 * Get timeOptions: if blank in settings then get from NP environment, or if not available default to 24-hour format.
 * @author @jgclark
 * @param {Object} tempConfig
 * @returns {Object}
 */
function getTimeOptions(tempConfig: Object): Object {
  const env12or24 = NotePlan?.environment?.is12hFormat ?? false
  const defaultOptions = { hour: '2-digit', minute: '2-digit', hour12: env12or24 }

  const tempTimeOptions = tempConfig?.timeOptions ?? defaultOptions

  // Handle case where timeOptions might be a JSON string
  if (typeof tempTimeOptions === 'string') {
    try {
      return JSON.parse(tempTimeOptions)
    } catch (e) {
      logWarn(pluginJson, `Failed to parse timeOptions JSON string: ${e.message}`)
      return defaultOptions
    }
  }

  return tempTimeOptions
}
