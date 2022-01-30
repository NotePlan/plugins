// @flow
//-------------------------------------------------------------------------------
// Configuration Utilities
// @codedungeon unless otherwise noted

import { showMessage, showMessageYesNo } from './userInput'
import { parseJSON5 } from './general'

// this is the only possible location for _configuration note
const STATIC_TEMPLATE_FOLDER = '📋 Templates'

const dt = () => {
  const d = new Date()

  const pad = (value: number) => {
    return value < 10 ? '0' + value : value
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString()
}

const log = (msg: string = '') => {
  console.log(`${dt()} ${msg}`)
}

/**
 * Get NotePlan Configuration
 * @author @codedungeon
 * @return return this as structured data, in the format specified by the first line of the codeblock (should be `javascript`)
 */
export async function getConfiguration(configSection: string = ''): Promise<any> {
  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(STATIC_TEMPLATE_FOLDER))
    .find((n) => !!n.title?.startsWith('_configuration'))

  const content: ?string = configFile?.content
  if (content == null) {
    log(`getConfiguration: Unable to find _configuration note`)
    return {}
  }

  const configData = content.split('\n```')[1]

  // $FlowIgnore
  const config = await parseConfiguration(configData)
  if (!config.hasOwnProperty(configSection)) {
    log(`Unable to locate ${configSection} in _configuration`)
    return {}
  }
  return config[configSection]
}

/**
 * initialize np.Templating Settings
 * @author @codedungeon
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {any} settings data
 */
export async function initConfiguration(pluginJsonData: any): Promise<any> {
  const migrateData = {}
  if (typeof pluginJsonData !== 'object') {
    CommandBar.prompt('np.Templating', 'Invalid Plugin Settings')
    return migrateData
  }

  try {
    const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []
    pluginSettings.forEach((setting) => {
      migrateData[setting.key] = setting.default
    })
  } catch (error) {
    CommandBar.prompt('np.Templating', `An error occurred ${error}`)
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
      // migration data from _configuration || plugin.settings default value
      migrateData[key] = key && configData?.[key] ? configData[key] : setting?.default || ''
    })

    // initialize settings data
    migrateData.version = pluginJsonData['plugin.version']
    DataStore.settings = { ...migrateData }

    log(`==> ${pluginJsonData['plugin.id']} _configuration.${configSection} migration (migration complete)`)
  } else {
    log(`==> ${pluginJsonData['plugin.id']} _configuration.${configSection} migration (already migrated)`)
  }

  // if settings data was migrated (first time only)
  if (migrationResult !== 0 && !silentMode) {
    const reviewMessage: string = canEditSettings ? `\n\nWould you like to review settings?` : ''
    const answer: mixed = await CommandBar.prompt(
      'Configuration Migration Complete',
      `Your _configuration "templates" has been migrated to NotePlan Plugin Settings. ${reviewMessage}`,
      canEditSettings ? ['Yes', 'No'] : ['OK'],
    )
    if (canEditSettings && answer === 0) {
      await NotePlan.showConfigurationView()
    }
  }

  return migrationResult
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
      await CommandBar.prompt('NotePlan Configuration', 'No configuration block found in configuration file.')
      return {}
    }

    let [format, ...contents] = block.split('\n')
    contents = contents.join('\n')
    format = format.trim()

    return parseJSON5(contents)
  } catch (error) {
    await CommandBar.prompt('NotePlan Error', error)
  }
}

/**
 * Convert semver string to number
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
