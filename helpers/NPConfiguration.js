// @flow

/*----------------------------------------------------------------------------------------------------------------------------
 * Configuration Utilities
 * @author @codedungeon unless otherwise noted
 * Requires NotePlan 3.4 or greater (waiting for NotePlan.environment version method to perform proper validation)
 * --------------------------------------------------------------------------------------------------------------------------*/

import json5 from 'json5'
import { logDebug, logError, logInfo, JSP } from '@helpers/dev'
import { showMessageYesNo } from '@helpers/userInput'

/**
 * Returns ISO formatted date time
 * @author @codedungeon
 * @return {string} formatted date time
 */
export const dt = (): string => {
  const d = new Date()

  const pad = (value: number): string => {
    return value < 10 ? `0${value}` : value.toString()
  }

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${d.toLocaleTimeString()}`
}

// this is the only possible location for _configuration note
// const STATIC_TEMPLATE_FOLDER = '📋 Templates'

/**
 * Get NotePlan Configuration block for given section
 * WARNING: Since NotePlan v3.4 no longer used, so commented out.
 * @author @codedungeon
 * @param {string} section - NotePlan _configuration section
 * @return return this as structured data, in the format specified by the first line of the codeblock (should be `javascript`)
 */
// export async function getConfiguration(configSection: string = ''): Promise<any> {
//   const configFile = DataStore.projectNotes.filter((n) => n.filename?.startsWith(STATIC_TEMPLATE_FOLDER)).find((n) => !!n.title?.startsWith('_configuration'))

//   const content: ?string = configFile?.content
//   if (content == null) {
//     log(`getConfiguration - Unable to find _configuration note`)
//     return {}
//   }

//   const configData = content.split('\n```')[1]

//   // FlowIgnore
//   const config = await parseConfiguration(configData)
//   if (!config.hasOwnProperty(configSection)) {
//     log(`getConfiguration - Unable to locate ${configSection} in _configuration`)
//     return {}
//   }
//   return config[configSection]
// }

/**
 * initialize Plugin Settings
 * @author @codedungeon
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {any} settings data
 */
export async function initConfiguration(pluginJsonData: any): Promise<any> {
  const migrateData = {}
  if (typeof pluginJsonData !== 'object') {
    await CommandBar.prompt('NotePlan Error', 'Invalid Plugin Settings')
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

/* WARNING: Since migration following NotePlan v3.4 this is no longer used, so commented out. */
/**
 * Migrate existing _configuration block to plugin/settings.json
 * @author @codedungeon
 * @param {string} configSection - template section name
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {number} migration result (-1 migration section not found, 1 success, 0 no migration necessary)
 */
// export async function migrateConfiguration(configSection: string, pluginJsonData: any, silentMode?: boolean = false): Promise<number> {
//   // migrationResult
//   // will be 1 if _configuration was migrated to plugin settings
//   // will be 0 if no migration necessary
//   // will be -1 if _configuration data not found
//   let migrationResult = 0
//   const canEditSettings: boolean = NotePlan.environment.platform === 'macOS'

//   const pluginSettingsData = await DataStore.loadJSON(`../${pluginJsonData['plugin.id']}/settings.json`)
//   if (!pluginSettingsData) {
//     const migrateData = {}

//     // load _configuration data for configSection if exists
//     const configData = await getConfiguration(configSection)
//     migrationResult = Object.keys(configData).length > 0 ? 1 : -1

//     // load plugin settings object, if not exists settings object will be empty
//     const pluginSettings = pluginJsonData.hasOwnProperty('plugin.settings') ? pluginJsonData['plugin.settings'] : []

//     pluginSettings.forEach((setting) => {
//       const key: any = setting?.key || null
//       const type: any = setting?.type || null

//       if (key) {
//         log(`migrateConfiguration checking: ${key}, type: ${type}`)
//         migrateData[key] = setting?.default || ''

//         // add key if it does not exist in _configuration note
//         if (!configData.hasOwnProperty(key)) {
//           log(`migrateConfiguration adding key: ${key}`)
//           configData[key] = setting.default

//           // Convert json to an object
//           if (setting.type === 'json' && setting.default !== 'undefined') {
//             configData[key] = JSON.parse(setting.default)
//           }
//         }

//         // migration data from _configuration if exists
//         if (key && configData[key] !== 'undefined') {
//           migrateData[key] = configData[key]

//           // Check if the variable is an array with anything but objects, then save it as comma separated string
//           // Note: We don't need to conver this here, we need to set the type in the plugin.settings of plugin.json to [string]
//           // if (Array.isArray(configData[key]) && configData[key].length > 0 && (typeof configData[key][0]) !== 'object') {
//           //   migrateData[key] = configData[key].join(', ')
//           // }
//         }
//       }
//     })

//     // initialize settings data
//     // $FlowFixMe[prop-missing]
//     migrateData.version = pluginJsonData['plugin.version']
//     DataStore.settings = { ...migrateData }

//     log(`==> ${pluginJsonData['plugin.id']} _configuration.${configSection} migration (migration complete)`)
//   }

//   // if settings data was migrated (first time only)
//   if (migrationResult === 1 && !silentMode) {
//     const reviewMessage: string = canEditSettings ? `\n\nWould you like to review the plugin settings now?` : ''
//     const answer: mixed = await CommandBar.prompt(
//       'Configuration Migration Complete',
//       `Your personal settings for plugin: "${configSection}" have been migrated from the _configuration note to the new NotePlan Plugin Settings.\n\nTo change your plugin settings in the future (on the Mac), please open the NotePlan preferences, navigate to "Plugins" and click on the gear icon on the right of the plugin name. ${reviewMessage}`,
//       canEditSettings ? ['Yes', 'No'] : ['OK'],
//     )
//     if (canEditSettings && answer === 0) {
//       await NotePlan.showConfigurationView()
//     }
//   }

//   return migrationResult
// }

/**
 * update setting data in the event plugin.settings object has been updated
 * @author @codedungeon
 * @param {any} pluginJsonData - plugin.json data for which plugin is being migrated
 * @return {number} update result (1 settings update, 0 no update necessary, -1 update failed)
 */
export function updateSettingData(pluginJsonData: any): number {
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
  // FIXME: @jgclark at least once saw an 'undefined is not an object' error, which appeared to be for this line.
  // dbw did the following logging to try to track it down but it looks like, JS thinks that DataStore is not an object at times
  // and yet, somehow the migration actually does work and migrates new settings. So, I'm not sure what's going on here.
  // we are going to leave this alone for the time being, but if you see this error again, please uncomment the following to keep hunting
  // logDebug(
  //   'NPConfiguration/updateSettingData',
  //   `typeof DataStore: ${typeof DataStore} isArray:${String(
  //     Array.isArray(DataStore),
  //   )} typeof DataStore.settings: ${typeof DataStore?.settings} typeof newSettings: ${typeof newSettings}`,
  // )
  // logDebug(`NPConfiguration/updateSettingData: Object.keys(DataStore): ${Object.keys(DataStore).join(',')}`)
  // logDebug('currentSettingData:', JSP(currentSettingData, 2))
  // logDebug('newSettings:', JSP(newSettings, 2))
  // logDebug('DataStore.settings:', JSP(DataStore.settings, 2))
  try {
    console.log(`NPConfiguration/updateSettingData: You may see a JS Exception: TypeError below, but as far as we can tell, the migration is working so you can ignore the error.`)
    DataStore.settings = newSettings
  } catch (error) {
    console.log(
      'NPConfiguration/updateSettingData/Plugin Settings Migration Failed. Was not able to automatically migrate your plugin settings to the new version. Please open the plugin settings and save in order to update your settings.',
    )
    updateResult = -1
  }

  return updateResult
}

export function getSetting(pluginName: string = '', key: string = '', defaultValue?: any = ''): any | null {
  const settings = DataStore.loadJSON(`../../data/${pluginName}/settings.json`)
  return typeof settings === 'object' && settings.hasOwnProperty(key) ? settings[key] : defaultValue
}

export async function getSettings(pluginName: string = '', defaultValue?: any = {}): any | null {
  const settings = await DataStore.loadJSON(`../../data/${pluginName}/settings.json`)
  return typeof settings === 'object' ? settings : defaultValue
}

/**
 * Save given settings to the given plugin's settings.json file.
 * TODO(@dwertheimer): why can value be unspecified?
 * @author @dwertheimer, updated by @jgclark
 * @param {string?} pluginName
 * @param {any?} value
 * @param {boolean?} triggerUpdateMechanism
 * @returns {any} ?
 */
export async function saveSettings(pluginName: string = '', value?: any = {}, triggerUpdateMechanism: boolean = true): any | null {
  // logDebug('NPConfiguration/saveSettings', `starting to ${pluginName}/plugin.json with triggerUpdateMechanism? ${String(triggerUpdateMechanism)}`)
  if (NotePlan.environment.buildVersion < 1045 || triggerUpdateMechanism) {
    // save, and can't or don't want to turn off triggering onUpdateSettings
    return await DataStore.saveJSON(value, `../../data/${pluginName}/settings.json`)
  } else {
    // save, but don't trigger onUpdateSettings
    // logDebug('NPConfiguration/saveSettings', `writing ${pluginName}/settings.json and asking to block trigger`)
    return await DataStore.saveJSON(value, `../../data/${pluginName}/settings.json`, true)
  }
}

/**
 * Save given settings to the given plugin's plugin.json file.
 * TODO(@dwertheimer): why can value be unspecified?
 * @author @dwertheimer, updated by @jgclark
 * @param {string?} pluginName
 * @param {any?} value
 * @param {boolean?} triggerUpdateMechanism
 * @returns {any} ?
 */
export async function savePluginJson(pluginName: string = '', value?: any = {}, triggerUpdateMechanism: boolean = true): Promise<boolean> {
  // logDebug('NPConfiguration/savePluginJson', `starting for ${pluginName}/plugin.json triggerUpdateMechanism? ${String(triggerUpdateMechanism)}`)
  if (NotePlan.environment.buildVersion < 1045 || triggerUpdateMechanism) {
    // save, and can't or don't want to turn off triggering onUpdateSettings
    return await DataStore.saveJSON(value, `../../${pluginName}/plugin.json`)
  } else {
    // save, but don't trigger onUpdateSettings
    // logDebug('NPConfiguration/savePluginJson', `writing ${pluginName}/plugin.json and asking to block trigger`)
    return await DataStore.saveJSON(value, `../../${pluginName}/plugin.json`, true)
  }
}

export async function getPluginJson(pluginName: string = ''): any {
  logDebug('NPConfiguration', `getting ${pluginName}/plugin.json`)
  return await DataStore.loadJSON(`../../${pluginName}/plugin.json`)
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

    // eslint-disable-next-line
    let [format, ...contents] = block.split('\n')
    // $FlowFixMe[incompatible-type]
    contents = contents.join('\n')

    const value: any = json5.parse(contents)
    return value
  } catch (error) {
    await CommandBar.prompt(
      'NotePlan Error',
      `Failed to parse your _configuration note, it seems to be malformed (e.g. a missing comma).\n\nPlease correct it, delete the plugin (click on the plugin name in the preferences to see the 'delete' button), and redownload it.\n\nError: ${error}`,
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

/**
 * Notify the user that a plugin was automatically updated. Typical usage:
 * @usage DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
 * @author @dwertheimer
 * @param {{ code: number, message: string }} result
 */
export async function pluginUpdated(pluginJson: any, result: { code: number, message: string }): Promise<void> {
  // result.codes = 0=no update, 1=updated, -1=error
  if (result.code === 1) {
    logInfo(pluginJson, `Plugin was updated`)
    const newSettings = await getPluginJson(pluginJson['plugin.id'])
    if (newSettings) {
      const hasChangelog = newSettings['plugin.changelog']
      const hasUpdateMessage = newSettings['plugin.lastUpdateInfo']
      const updateMessage = hasUpdateMessage ? `Changes include:\n"${hasUpdateMessage}"\n\n` : ''
      const version = newSettings['plugin.version']
      const openReadme = await showMessageYesNo(
        `The '${newSettings['plugin.name']}' plugin was automatically updated to v${version}. ${updateMessage}Would you like to open the Plugin's ${
          hasChangelog ? 'Change Log' : 'Documentation'
        } to see more details?`,
        ['Yes', 'No'],
        `'${newSettings['plugin.name']}' Plugin Updated`,
      )
      if (openReadme === 'Yes') {
        const url = hasChangelog ? newSettings['plugin.changelog'] : newSettings['plugin.url'] || ''
        NotePlan.openURL(url)
      }
    } else {
      logInfo(pluginJson, `Plugin was updated, but no new settings were loaded: newSettings was:${JSP(newSettings)}`)
    }
  } else if (result.code === -1) {
    logError(pluginJson, `Plugin update failed: ${result.message}`)
  }
}
