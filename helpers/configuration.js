// @flow

/*----------------------------------------------------------------------------------------------------------------------------
 * Configuration Utilities
 * @author @codedungeon unless otherwise noted
 * Requires NotePlan 3.4 or greater (waiting for NotePlan.environment version method to perform proper validation)
 * Note: Everything is self contained in this method, no other dependencies beyond `json5` plugin
 * --------------------------------------------------------------------------------------------------------------------------*/

import json5 from 'json5'

// this is the only possible location for _configuration note
const STATIC_TEMPLATE_FOLDER = '📋 Templates'

/**
 * Returns ISO formatted date time
 * @author @codedungeon
 * @return {string} formatted date time
 */
const dt = (): string => {
  const d = new Date()

  const pad = (value: number): string => {
    return value < 10 ? '0' + value : value.toString()
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString()
}

/**
 * Log to console and np-out.log (with date time and category)
 * @author @codedungeon
 * @param {string} msg - log message
 * @return void
 */
const log = (msg: string = ''): void => {
  console.log(`${dt()} : configuration :: ${msg}`)
}

/**
 * Get NotePlan Configuration block for given section
 * @author @codedungeon
 * @param {string} section - NotePlan _configuration section
 * @return return this as structured data, in the format specified by the first line of the codeblock (should be `javascript`)
 */
export async function getConfiguration(configSection: string = ''): Promise<any> {
  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(STATIC_TEMPLATE_FOLDER))
    .find((n) => !!n.title?.startsWith('_configuration'))

  const content: ?string = configFile?.content
  if (content == null) {
    log(`getConfiguration - Unable to find _configuration note`)
    return {}
  }

  const configData = content.split('\n```')[1]

  // $FlowIgnore
  const config = await parseConfiguration(configData)
  if (!config.hasOwnProperty(configSection)) {
    log(`getConfiguration - Unable to locate ${configSection} in _configuration`)
    return {}
  }
  return config[configSection]
}

/**
 * initialize Plugin Settings
 * @author @codedungeon
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {any} settings data
 */
export async function initConfiguration(pluginJsonData: any): Promise<any> {
  const migrateData = {}
  if (typeof pluginJsonData !== 'object') {
    CommandBar.prompt('NotePlan Error', 'Invalid Plugin Settings')
    return migrateData
  }

  try {
    const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []
    pluginSettings.forEach((setting) => {
      migrateData[setting.key] = setting.default
    })
  } catch (error) {
    CommandBar.prompt('NotePlan Error', `An error occurred ${error}`)
  }

  return migrateData
}

/**
 * migrate existing _configuration block to plugin/settings.json
 * @author @codedungeon
 * @param {string} configSection - template section name
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {number} migration result (-1 migration section not found, 1 success, 0 no migration necessary)
 */
export async function migrateConfiguration(
  configSection: string,
  pluginJsonData: any,
  silentMode?: boolean = false,
): Promise<number> {
  // migrationResult
  // will be 1 if _configuration was migrated to plugin settings
  // will be 0 if no migration necessary
  // will be -1 if _configuration data not found
  let migrationResult = 0
  const canEditSettings: boolean = NotePlan.environment.platform === 'macOS'

  const pluginSettingsData = await DataStore.loadJSON(`../${pluginJsonData['plugin.id']}/settings.json`)
  if (!pluginSettingsData) {
    const migrateData = {}

    // load _configuration data for configSection if exists
    const configData = await getConfiguration(configSection)
    migrationResult = Object.keys(configData).length > 0 ? 1 : -1
    // load plugin settings object, if not exists settings object will be empty
    const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []
    pluginSettings.forEach((setting) => {
      const key: any = setting?.key || null
      if (key) {
        log(key)
        migrateData[key] = setting?.default || ''

        // migration data from _configuration if exists
        if (key && configData[key] !== 'undefined') {
          migrateData[key] = configData[key]
          // Check if the variable is an array with anything but objects, then save it as comma separated string
          if (Array.isArray(configData[key]) && configData[key].length > 0 && typeof configData[key][0] !== 'object') {
            migrateData[key] = configData[key].join(', ')
          }
        }
      }
    })

    // initialize settings data
    migrateData.version = pluginJsonData['plugin.version']
    DataStore.settings = { ...migrateData }

    log(`==> ${pluginJsonData['plugin.id']} _configuration.${configSection} migration (migration complete)`)
  }

  // if settings data was migrated (first time only)
  if (migrationResult !== 0 && !silentMode) {
    const reviewMessage: string = canEditSettings ? `\n\nWould you like to review settings?` : ''
    const answer: mixed = await CommandBar.prompt(
      'Configuration Migration Complete',
      `Your _configuration "${configSection}" have been migrated to NotePlan Plugin Settings. ${reviewMessage}`,
      canEditSettings ? ['Yes', 'No'] : ['OK'],
    )
    if (canEditSettings && answer === 0) {
      await NotePlan.showConfigurationView()
    }
  }

  return migrationResult
}

/**
 * update setting data in the event plugin.settings object has been updated
 * @author @codedungeon
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {number} update result (1 settings update, 0 no update necessary)
 */
export async function updateSettingData(pluginJsonData: any): Promise<number> {
  let updateResult = 0

  const newSettings = {}
  const currentSettingData = DataStore.settings

  const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []
  pluginSettings.forEach((setting) => {
    const key: any = setting?.key || null
    if (key) {
      if (!currentSettingData.hasOwnProperty(key)) {
        newSettings[key] = setting?.default || ''
        updateResult = 1 // we have made at least one update, change result code accordingly
      } else {
        newSettings[key] = currentSettingData[key]
      }
    }
  })
  DataStore.settings = { ...newSettings }

  return updateResult
}

/**
 * parseConfiguration
 * @author @codedungeon, adapted from @nmn
 * @param {string} block - contents of first codeblock as string (excludes ``` delimiters)
 * @return {mixed} structured version of this data, in the format specified by the first line of the codeblock
 */
export async function parseConfiguration(block: string): Promise<?{ [string]: ?mixed }> {
  try {
    if (block == null) {
      await CommandBar.prompt('NotePlan Error', 'No configuration block found in configuration file.')
      return {}
    }

    let [format, ...contents] = block.split('\n')
    contents = contents.join('\n')
    format = format.trim()

    const value: any = json5.parse(contents)
    return value
  } catch (error) {
    await CommandBar.prompt(
      'NotePlan Error',
      "Failed to parse your _configuration note, it seems to be malformed (e.g. a missing comma).\n\nPlease correct it, delete the plugin (click on the plugin name in the preferences to see the 'delete' button), and redownload it.\n\nError: " +
        error,
    )
  }
}

/**
 * Convert semver string to number (used when plugin settings see np.Templating for an example)
 * @author @codedungeon
 * @param {string} semver - semver version
 * @return return long version number
 */
export function semverVersionToNumber(version: string): number {
  const parts = version.split('.')

  // $FlowIgnore
  parts.forEach((part: number) => {
    if (part >= 1024) {
      throw new Error(`Version string invalid, ${part} is too large`)
    }
  })

  let numericVersion = 0
  // Shift all parts either 0, 10 or 20 bits to the left.
  for (let i = 0; i < 3; i++) {
    numericVersion |= parseInt(parts[i]) << (i * 10)
  }
  return numericVersion
}
