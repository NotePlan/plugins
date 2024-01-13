// @flow

/*----------------------------------------------------------------------------------------------------------------------------
 * Configuration Utilities
 * @author @codedungeon unless otherwise noted
 * Requires NotePlan 3.4 or greater (waiting for NotePlan.environment version method to perform proper validation)
 * --------------------------------------------------------------------------------------------------------------------------*/

import json5 from 'json5'
import { showMessage, showMessageYesNo } from './userInput'
import { castStringFromMixed } from '@helpers/dataManipulation'
import { logDebug, logError, logInfo, JSP, clo, copyObject } from '@helpers/dev'
import { sortListBy } from '@helpers/sorting'

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
 * Convert semver string to number, ignoring any non-numeric, non-period characters (e.g., "-beta3")
 * @param {string} version - semver version string
 * @returns {number} Numeric representation of version
 * @throws {Error} If version string is invalid
 */
export function semverVersionToNumber(version: string): number {
  // Trim the version string at the first non-numeric, non-period character
  const trimmedVersion = version.split(/[^0-9.]/)[0]

  const parts = trimmedVersion.split('.').map((part) => {
    const numberPart = parseInt(part, 10)
    if (isNaN(numberPart) || numberPart < 0) {
      throw new Error(`Invalid version part: ${part}`)
    }
    return numberPart
  })

  if (parts.length !== 3) {
    throw new Error('Version string must have exactly three parts')
  }

  let numericVersion = 0
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] > 1023) {
      throw new Error(`Version string invalid, ${parts[i]} is too large`)
    }
    numericVersion += parts[i] * Math.pow(1024, 2 - i)
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
  // result.codes = 0=no update, 1=updated, 2=installed, -1=error
  if (result.code >= 1) {
    logInfo(pluginJson, `Plugin was ${result.code === 1 ? 'updated' : 'installed'}`)
    logDebug(pluginJson, `calling getPluginJson pluginJson['plugin.id'] = ${pluginJson['plugin.id']}`)
    const newSettings = await getPluginJson(pluginJson['plugin.id'])
    clo(newSettings, 'pluginUpdated - newSettings')
    if (newSettings) {
      const hasChangelog = newSettings['plugin.changelog']
      const hasUpdateMessage = newSettings['plugin.lastUpdateInfo']
      const updateMessage = hasUpdateMessage ? `Latest changes include:\n"${hasUpdateMessage}"\n\n` : ''
      const version = newSettings['plugin.version']
      const openReadme = await showMessageYesNo(
        `The '${newSettings['plugin.name']}' plugin ${
          result.code === 1 ? 'was automatically updated to' : 'was installed.'
        } v${version}. ${updateMessage}Would you like to open the Plugin's ${hasChangelog ? 'Change Log' : 'Documentation'} to see more details?`,
        ['Yes', 'No'],
        `'${newSettings['plugin.name']}' Plugin Updated`,
      )
      if (openReadme === 'Yes') {
        const url = hasChangelog ? newSettings['plugin.changelog'] : newSettings['plugin.url'] || ''
        NotePlan.openURL(url)
      }
      await migrateCommandsIfNecessary(newSettings)
    } else {
      logInfo(pluginJson, `Plugin was updated, but no new settings were loaded. ${result.code === 2 ? '(not necessary on new install) ' : ''}newSettings was:${JSP(newSettings)}`)
    }
  } else if (result.code === -1) {
    logError(pluginJson, `Plugin update failed: ${result.message}`)
  }
}

/**
 * Get locale: from configIn.locale (if present), else get from NP environment (from 3.3.2), else default to 'en-US'
 * TODO: In time point to np.Shared config item
 * @author @jgclark
 * @param {Object} tempConfig
 * @returns {string}
 */
export function getLocale(configIn: Object): string {
  const envRegion = NotePlan?.environment ? NotePlan?.environment?.regionCode : ''
  const envLanguage = NotePlan?.environment ? NotePlan?.environment?.languageCode : ''
  let tempLocale = castStringFromMixed(configIn, 'locale') ?? null
  tempLocale = tempLocale != null && tempLocale !== '' ? tempLocale : envRegion !== '' ? `${envLanguage}-${envRegion}` : 'en-US'
  return tempLocale
}

export type PluginObjectWithUpdateField = {
  ...PluginObject,
  updateIsAvailable: boolean,
  isInstalled: boolean,
  installedVersion: string,
  installLink?: string,
  documentation?: string,
  lastUpdateInfo?: string,
  author?: string,
}

/**
 * Find a plugin id and optionally minVersion from a list of plugins generated by DataStore.installedPlugins() etc.
 * @param {*} list - array of plugins
 * @param {*} id - id to find
 * @param {*} minVersion - min version to find (optional)
 * @returns the plugin object if the id is found and the minVersion matches (>= the minVersion)
 */
export const findPluginInList = (list: Array<any>, id: string, minVersion?: string): any =>
  list.find((p) => p.id === id && (minVersion ? semverVersionToNumber(p.version) >= semverVersionToNumber(minVersion) : true))

/**
 * @param {string} id - the id of the plugin
 * @param {string} minVersion - the minimum version of the plugin that is required
 * @returns {boolean} - true if the plugin is installed with the minimum version
 */
export async function pluginIsInstalled(id: string, minVersion?: string): Promise<boolean> {
  const installedPlugins = await DataStore.installedPlugins()
  return Boolean(findPluginInList(installedPlugins, id, minVersion))
}

/**
 * When commands move from one plugin to another, we tell the user about it and invite them to download the new plugin if they don't have it already.
 * We look for two fields in the plugin.json:
 * - "offerToDownloadPlugin": {"id": "np.Tidy", "minVersion": "2.18.0"},
 * - "commandMigrationMessage": "NOTE: Task Sorting commands have been moved from the Task Automations plugin to the TaskSorter plugin.",
 * @param {any} pluginJson - the old plugin
 * @returns {void}
 */
export async function migrateCommandsIfNecessary(pluginJson: any): Promise<void> {
  const newPluginInfo = pluginJson['offerToDownloadPlugin']
  if (newPluginInfo && newPluginInfo.id) {
    const { id, minVersion } = newPluginInfo
    const isInstalled = await pluginIsInstalled(id, minVersion)
    if (isInstalled) {
      logDebug(pluginJson, `migrateCommandsIfNecessary() ran but ${newPluginInfo.id} ${newPluginInfo.minVersion} was installed.`)
      return
    }
    const commandMigrationMessage = pluginJson['commandMigrationMessage']
    const githubReleasedPlugins = await DataStore.listPlugins(false, true, false) //released plugins .isOnline is true for all of them
    // clo(githubReleasedPlugins, 'migrateCommandsIfNecessary: githubReleasedPlugins')
    // logDebug(pluginJson, `migrateCommandsIfNecessary: githubReleasedPlugins ^^^^`)
    const newPlugin = await findPluginInList(githubReleasedPlugins, id, minVersion)
    clo(newPlugin, 'migrateCommandsIfNecessary: newPlugin found:')
    if (!newPlugin) {
      logDebug(pluginJson, `migrateCommandsIfNecessary() could not find plugin on github: ${id} >= ${minVersion}`)
      await showMessage(`Could not find ${id} plugin to download. Please try to use the NotePlan preferences panel.`, 'OK', 'Plugin Not Found')
      return
    }
    const msg = `${commandMigrationMessage || ''}\nWould you like to download the plugin "${newPlugin.name}" now?`
    const res = await showMessageYesNo(msg, ['Yes', 'No'], 'Download New Plugin')
    if (res === 'Yes') {
      clo(newPlugin, `migrateCommandsIfNecessary() before plugin download: ${id} >= ${minVersion}. Will try to install:`)
      // const r = await DataStore.installOrUpdatePluginsByID([id], true, false, false)
      const r = await DataStore.installPlugin(newPlugin, false)
      // FIXME: Never gets here, even when the plugin successfully installs
      clo(r, `migrateCommandsIfNecessary() after plugin download: result=`)

      logDebug(pluginJson, `migrateCommandsIfNecessary() after plugin download: ${id} >= ${minVersion}`)
      const installedPlugins = DataStore.installedPlugins()
      const newPluginInstalled = findPluginInList(installedPlugins, id, minVersion)
      if (!newPluginInstalled) {
        logDebug(pluginJson, `migrateCommandsIfNecessary() after plugin download but did not find plugin installed: ${id} >= ${minVersion}`)
        return
      }
      // TODO: Migrate settings from old plugin to new plugin
      await pluginUpdated(newPluginInstalled, { code: 2, message: 'Plugin Installed' })
    }
  } else {
    logDebug(pluginJson, `migrateCommandsIfNecessary() did not find offerToDownloadPlugin; doing nothing`)
  }
}

/**
 * Get a list of plugins to ouput, either (depending on user choice):
 * 1) installed plugins only
 * 2) all latest plugins, local or online/released on github
 * @param {string} showInstalledOnly - show only installed plugins
 * @returns
 */
export async function getPluginList(showInstalledOnly: boolean = false, installedPlugins: Array<any> = DataStore.installedPlugins()): Promise<Array<PluginObjectWithUpdateField>> {
  try {
    // clo(installedPlugins, ` generatePluginCommandList installedPlugins`)
    // .listPlugins(showLoading, showHidden, skipMatchingLocalPlugins)
    logDebug(`getPluginList  calling: DataStore.listPlugins`)
    const githubReleasedPlugins = await DataStore.listPlugins(true, false, true) //released plugins .isOnline is true for all of them
    logDebug(`getPluginList  back from: DataStore.listPlugins`)

    // githubReleasedPlugins.forEach((p) => logDebug(`generatePluginCommandList githubPlugins`, `${p.id}`))
    // const localOnlyPlugins = installedPlugins.filter((p) => !githubReleasedPlugins.find((q) => q.id === p.id))
    // localOnlyPlugins.forEach((p) => logDebug(`generatePluginCommandList localOnlyPlugins`, `${p.id}`))
    const allLocalAndReleasedPlugins = [...installedPlugins, ...githubReleasedPlugins]
    let allLatestPlugins = allLocalAndReleasedPlugins.reduce((acc, p) => {
      const pluginsWithThisID = allLocalAndReleasedPlugins.filter((f) => f.id === p.id)
      if (pluginsWithThisID.length > 1) clo(pluginsWithThisID, `generatePluginCommandList pluginsWithThisID.length dupes ${p.id}: ${pluginsWithThisID.length}`)
      let latest = pluginsWithThisID[0]
      if (pluginsWithThisID.length > 1) {
        logDebug(
          `${p.id}: howMany:${pluginsWithThisID.length} onlineVersion (${pluginsWithThisID[1].version}):${semverVersionToNumber(
            pluginsWithThisID[1].version,
          )} <> installed version (${latest.version}): ${semverVersionToNumber(latest.version)}`,
        )
        if (semverVersionToNumber(pluginsWithThisID[1].version) > semverVersionToNumber(latest.version)) {
          latest = pluginsWithThisID[1] //assumes at most we have 2 versions (local and online) - could do a filter here if necessary
        }
      }
      if (!acc.find((f) => f.id === latest.id)) {
        acc.push(latest)
      }
      return acc
    }, [])
    allLatestPlugins = sortListBy(allLatestPlugins, 'name')
    // allLatestPlugins.forEach((p) => logDebug(`generatePluginCommandList allLatestPlugins`, `${p.name} (${p.id})`))
    const plugins = showInstalledOnly ? installedPlugins : allLatestPlugins
    // logDebug(
    //   `generatePluginCommandList`,
    //   `installedPlugins ${installedPlugins.length} githubPlugins ${githubReleasedPlugins.length} allLocalAndReleasedPlugins ${allLocalAndReleasedPlugins.length}`,
    // )
    // clo(installedPlugins[0], 'generatePluginCommandList installedPlugins')
    // clo(allPlugins[0], 'generatePluginCommandList allPlugins')
    const pluginListWithUpdateField = plugins.map((plugin) => {
      const pluginWithUpdateField: PluginObjectWithUpdateField = {
        ...copyObject(plugin),
        updateIsAvailable: plugin.isOnline,
        isInstalled: !plugin.isOnline,
        installedVersion: plugin.isOnline ? 'N/A' : plugin.version,
      }
      return pluginWithUpdateField
    })
    return pluginListWithUpdateField
  } catch (error) {
    logError(`getPluginList: caught error: ${JSP(error)}`)
    return []
  }
}
