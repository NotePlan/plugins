// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { semverVersionToNumber } from '@helpers/general'
import { log, logError } from '@helpers/dev'
import pluginJson from '../../plugin.json'

/**
 * Default configuration values for the NPTemplating system.
 * It's crucial to keep this synchronized with the structure expected by
 * `TEMPLATE_CONFIG_BLOCK` and the plugin's settings in `plugin.json`.
 * @const {object} DEFAULT_TEMPLATE_CONFIG
 * @property {string} templateFolderName - Default name/path for the templates folder.
 *                                        Uses NotePlan's environment variable if available.
 * @property {string} templateLocale - Default locale for date/time formatting (e.g., "en-US").
 * @property {boolean} templateGroupTemplatesByFolder - Whether to group templates by subfolder
 *                                                    in the template chooser UI.
 * @property {string} dateFormat - Default format string for dates (e.g., "YYYY-MM-DD").
 * @property {string} timeFormat - Default format string for times (e.g., "HH:mm").
 * @property {object} defaultFormats - Container for other specific default formats.
 * @property {string} defaultFormats.now - Default format for the "now" timestamp.
 */
export const DEFAULT_TEMPLATE_CONFIG: {
  templateFolderName: string,
  templateLocale: string,
  templateGroupTemplatesByFolder: boolean,
  dateFormat: string,
  timeFormat: string,
  defaultFormats: {
    now: string,
  },
} = {
  templateFolderName: typeof NotePlan !== 'undefined' ? NotePlan.environment.templateFolder : '@Templates',
  templateLocale: 'en-US',
  templateGroupTemplatesByFolder: false,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm',
  defaultFormats: {
    now: 'YYYY-MM-DD HH:mm',
  },
}

/**
 * Flow type definition for the template configuration object (read-only).
 * This defines the expected structure and types for template settings.
 * @type {TemplateConfig}
 * @property {string} templateFolderName - The folder where templates are stored.
 * @property {string} [templateLocale] - Optional locale for localization (e.g., date formats).
 * @property {boolean} [templateGroupTemplatesByFolder] - Optional flag to group templates by folder in UI.
 * @property {string} [userFirstName] - Optional user's first name.
 * @property {string} [userLastName] - Optional user's last name.
 * @property {string} [userEmail] - Optional user's email.
 * @property {string} [userPhone] - Optional user's phone number.
 * @property {string} [dateFormat] - Optional default date format.
 * @property {string} [timeFormat] - Optional default time format.
 * @property {boolean} [nowFormat] - Optional: This seems like a typo or legacy field.
 *                                   `DEFAULT_TEMPLATE_CONFIG` uses `defaultFormats.now` (string).
 * @property {string} [weatherFormat] - Optional format for weather information.
 * @property {mixed} [services] - Optional configuration for external services.
 */
export type TemplateConfig = $ReadOnly<{
  templateFolderName: string,
  templateLocale?: string,
  templateGroupTemplatesByFolder?: boolean,
  userFirstName?: string,
  userLastName?: string,
  userEmail?: string,
  userPhone?: string,
  dateFormat?: string,
  timeFormat?: string,
  nowFormat?: boolean, // Typo? Consider changing to string or aligning with defaultFormats.now
  weatherFormat?: string,
  services?: mixed,
}>

/**
 * Returns the default template configuration object.
 * @async
 * @returns {Promise<typeof DEFAULT_TEMPLATE_CONFIG>} A promise that resolves to the default template configuration.
 */
export async function getDefaultTemplateConfig(): Promise<typeof DEFAULT_TEMPLATE_CONFIG> {
  // More specific return type
  return DEFAULT_TEMPLATE_CONFIG
}

/**
 * Generates a string block representing the template configuration,
 * suitable for inclusion in a settings file (e.g., _configuration note).
 * It attempts to migrate some values from potentially older config structures if found in `DEFAULT_TEMPLATE_CONFIG`.
 * @async
 * @returns {Promise<string>} A promise that resolves to the formatted configuration string.
 */
export async function TEMPLATE_CONFIG_BLOCK(): Promise<string> {
  const config = DEFAULT_TEMPLATE_CONFIG // Start with the current default configuration

  // Attempt to migrate legacy configuration values if they were structured differently.
  // These lookups (e.g., config?.date?.locale) are speculative and depend on how
  // 'config' (which is DEFAULT_TEMPLATE_CONFIG here) might have been structured in the past
  // or if it's dynamically augmented elsewhere (unlikely for this constant).
  // For DEFAULT_TEMPLATE_CONFIG, these legacy paths (?.date?.locale) will likely be undefined.

  // $FlowFixMe - Accessing potentially non-existent nested properties.
  const locale = config?.date?.locale || '' // Legacy: config.date.locale
  // $FlowFixMe
  const first = config?.tagValue?.me?.firstName || '' // Legacy: config.tagValue.me.firstName
  // $FlowFixMe
  const last = config?.tagValue?.me?.lastName || '' // Legacy: config.tagValue.me.lastName

  // $FlowFixMe
  const dateFormatToUse = config?.date?.dateStyle || DEFAULT_TEMPLATE_CONFIG.dateFormat
  // $FlowFixMe
  const timeFormatToUse = config?.date?.timeStyle || DEFAULT_TEMPLATE_CONFIG.timeFormat

  // $FlowFixMe - timestampFormat seems to be derived from date.timeStyle or defaults to 'now' format.
  // This specific migration for 'timestampFormat' seems to be mapping a legacy 'timeStyle' to it,
  // or defaulting to the 'now' format from default settings if not found.
  const timestampFormat = config?.date?.timeStyle || DEFAULT_TEMPLATE_CONFIG.defaultFormats.now

  // Construct the configuration string using current and potentially migrated values.
  return `  templates: {
    locale: "${locale}",
    defaultFormats: {
      date: "${dateFormatToUse}",
      time: "${timeFormatToUse}",
      now: "${DEFAULT_TEMPLATE_CONFIG.defaultFormats.now}"
    },
    user: {
      first: "${first}",
      last: "${last}",
      email: "",
      phone: ""
    },
    // check https://github.com/public-apis/public-apis for other services
    services: {}
  },
  `
}

/**
 * Retrieves the path to NotePlan's main template folder from the environment.
 * @async
 * @returns {Promise<string>} A promise that resolves to the template folder path.
 */
export async function getTemplateFolder(): Promise<string> {
  return NotePlan.environment.templateFolder
}

/**
 * Loads the templating settings from the settings.json file.
 * If the settings file doesn't exist, creates it with default values.
 * @async
 * @returns {Promise<any>} The loaded settings object
 */
export async function getSettings(): Promise<any> {
  let data = DataStore.loadJSON('../np.Templating/settings.json')
  if (!data) {
    const result = DataStore.saveJSON(DEFAULT_TEMPLATE_CONFIG, '../np.Templating/settings.json')
    data = DataStore.loadJSON('../np.Templating/settings.json')
  }

  return data
}

/**
 * Retrieves a specific setting value by key.
 * @async
 * @param {string} [key=''] - The key of the setting to retrieve
 * @param {string} [defaultValue=''] - The default value to return if the key is not found
 * @returns {Promise<string>} The setting value or default value
 */
export async function getSetting(key: string = '', defaultValue?: string = ''): Promise<string> {
  const data = await getSettings()
  if (data) {
    return data.hasOwnProperty(key) ? data[key] : defaultValue
  }
  return defaultValue
}

/**
 * Saves a setting value to the settings storage.
 * Note: This method appears to be a stub that doesn't actually save anything.
 * @async
 * @param {string} key - The key of the setting to save
 * @param {string} value - The value to save
 * @returns {Promise<boolean>} Always returns true (stub implementation)
 */
export async function putSetting(key: string, value: string): Promise<boolean> {
  return true
}

/**
 * Provides a diagnostic health check for the templating system.
 * Returns the current template configuration as a markdown code block.
 * @async
 * @param {Object} templateConfig - The current template configuration
 * @returns {Promise<string>} A formatted string containing the current configuration
 */
export async function heartbeat(templateConfig: any): Promise<string> {
  // Handle the case when templateConfig is not passed
  if (!templateConfig) {
    return '```\nNo template configuration available\n```\n'
  }

  return '```\n' + JSON.stringify(templateConfig, null, 2) + '\n```\n'
}

/**
 * Updates plugin settings to the latest version or installs default settings if none exist.
 * Applies version-specific updates to settings as needed when upgrading between versions.
 * @async
 * @param {any} currentSettings - The current plugin settings object
 * @param {string} currentVersion - The current plugin version
 * @returns {Promise<TemplateConfig>} A promise that resolves to the updated settings
 */
export async function updateOrInstall(currentSettings: any, currentVersion: string): Promise<TemplateConfig> {
  const settingsData = { ...currentSettings }

  // each setting update applied will increement
  let updatesApplied = 0
  // current settings version as number
  const settingsVersion: number = semverVersionToNumber(settingsData?.version || '')

  // changes in v1.0.3
  // if (settingsVersion < semverVersionToNumber('1.0.3')) {
  //   updatesApplied++
  //   log(pluginJson, `==> np.Templating 1.0.3 Updates Applied`)
  // }

  if (settingsVersion < semverVersionToNumber('2.0.0')) {
    log(pluginJson, `==> np.Templating 2.0.0 Updates Applied`)
    updatesApplied++
  }

  if (settingsVersion < semverVersionToNumber('1.1.3')) {
    log(pluginJson, `==> np.Templating 1.1.3 Updates Applied`)
    updatesApplied++
  }

  // update settings version to latest version from plugin.json
  settingsData.version = currentVersion
  if (updatesApplied > 0) {
    log(pluginJson, `==> np.Templating Settings Updated to v${currentVersion}`)

    const templateGroupTemplatesByFolder = DataStore.settings?.templateGroupTemplatesByFolder || false
    DataStore.setPreference('templateGroupTemplatesByFolder', templateGroupTemplatesByFolder)
  }

  // return new settings
  return settingsData
}

/**
 * Initializes the templating system by loading settings and global functions.
 * Sets up the template configuration and global method list for use in templates.
 * @async
 * @param {Object} context - The NPTemplating class instance or constructor context
 * @returns {Promise<void>}
 */
export async function setup(context: any): Promise<void> {
  try {
    const data = await getSettings()

    context.templateConfig = {
      ...data,
      ...{ clipboard: '' },
    }

    let globalData = []
    if (context.globals) {
      Object.getOwnPropertyNames(context.globals).forEach((key) => {
        globalData.push(key)
      })
    }

    context.templateGlobals = globalData
  } catch (error) {
    await CommandBar.prompt('Template Error', error)
  }
}
