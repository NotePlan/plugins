// @flow

/*----------------------------------------------------------------------------------------------------------------------------
 * Configuration Utilities
 * @author @codedungeon unless otherwise noted
 * Requires NotePlan 3.4 or greater (waiting for NotePlan.environment version method to perform proper validation)
 * --------------------------------------------------------------------------------------------------------------------------*/

import json5 from 'json5'
import { showMessage, showMessageYesNo } from './userInput'
import { castStringFromMixed } from '@np/helpers/dataManipulation'
import { logDebug, logWarn, logError, logInfo, JSP, clo, copyObject, timer } from '@np/helpers/dev'
import { sortListBy } from '@np/helpers/sorting'

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
 * @return {number} update result (1 settings updated, 0 no update necessary, -1 update failed)
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
  logDebug(
    'NPConfiguration/updateSettingData',
    `typeof DataStore: ${typeof DataStore} isArray:${String(
      Array.isArray(DataStore),
    )} typeof DataStore.settings: ${typeof DataStore?.settings} typeof newSettings: ${typeof newSettings}`,
  )
  // logDebug(`NPConfiguration/updateSettingData: Object.keys(DataStore): ${Object.keys(DataStore).join(',')}`)
  // logDebug('currentSettingData:', JSP(currentSettingData, 2))
  // logDebug('newSettings:', JSP(newSettings, 2))
  // logDebug('DataStore.settings:', JSP(DataStore.settings, 2))
  try {
    DataStore.settings = newSettings
  } catch (error) {
    console.log(
      'NPConfiguration/updateSettingData/Plugin Settings Migration Failed. Was not able to automatically migrate your plugin settings to the new version. Please open the plugin settings and save in order to update your settings.',
    )
    updateResult = -1
  }

  return updateResult
}

/**
 * Copy specific plugin settings from one (old) plugin to another (new) plugin
 * Typically called when the calling plugin is the new plugin
 * @param {string} oldPluginID
 * @param {string} newPluginID
 * @param {Array<string>} settingsList - an array of the names of the settings to copy
 */
export async function copySpecificSettings(oldPluginID: string, newPluginID: string, settingsList: Array<string>) {
  const oldPluginSettings = await getSettings(oldPluginID)
  const newPluginSettings = await getSettings(newPluginID)
  if (!oldPluginSettings) throw `copySpecificSettings: Could not load pluginJson for ${oldPluginID}`
  if (!newPluginSettings) throw `copySpecificSettings: Could not load pluginJson for ${newPluginID}`
  settingsList.forEach((settingName) => (oldPluginSettings.hasOwnProperty(settingName) ? (newPluginSettings[settingName] = oldPluginSettings[settingName]) : null)) // if the setting was set previously, copy it
  clo(newPluginSettings, `About to save revised settings after command migration to: ${newPluginID}`)
  await saveSettings(newPluginID, newPluginSettings, false)
}

export function getSetting(pluginId: string = '', key: string = '', defaultValue?: any = ''): any | null {
  const settings = DataStore.loadJSON(`../../data/${pluginId}/settings.json`)
  return typeof settings === 'object' && settings.hasOwnProperty(key) ? settings[key] : defaultValue
}

export async function getSettings(pluginId: string = '', defaultValue?: any = {}): any | null {
  const settings = await DataStore.loadJSON(`../../data/${pluginId}/settings.json`)
  return typeof settings === 'object' ? settings : defaultValue
}

/**
 * Save given settings to the given plugin's settings.json file.
 * TODO(@dwertheimer): why can value be unspecified?
 * @author @dwertheimer, updated by @jgclark
 * @param {string?} pluginId
 * @param {any?} value
 * @param {boolean?} triggerUpdateMechanism
 * @returns {any} ?
 */
export async function saveSettings(pluginId: string = '', value?: any = {}, triggerUpdateMechanism: boolean = true): any | null {
  // logDebug('NPConfiguration/saveSettings', `starting to ${pluginId}/plugin.json with triggerUpdateMechanism? ${String(triggerUpdateMechanism)}`)
  if (NotePlan.environment.buildVersion < 1045 || triggerUpdateMechanism) {
    // save, and can't or don't want to turn off triggering onUpdateSettings
    return await DataStore.saveJSON(value, `../../data/${pluginId}/settings.json`)
  } else {
    // save, but don't trigger onUpdateSettings
    // logDebug('NPConfiguration/saveSettings', `writing ${pluginId}/settings.json and asking to block trigger`)
    return await DataStore.saveJSON(value, `../../data/${pluginId}/settings.json`, true)
  }
}

/**
 * Save given settings to the given plugin's plugin.json file.
 * @author @dwertheimer, updated by @jgclark
 * @param {string?} pluginId
 * @param {any?} value
 * @param {boolean?} triggerUpdateMechanism
 * @returns {any} ?
 */
export async function savePluginJson(pluginId: string = '', value: any = {}, triggerUpdateMechanism: boolean = true): Promise<boolean> {
  // logDebug('NPConfiguration/savePluginJson', `starting for ${pluginId}/plugin.json triggerUpdateMechanism? ${String(triggerUpdateMechanism)}`)
  if (NotePlan.environment.buildVersion < 1045 || triggerUpdateMechanism) {
    // save, and can't or don't want to turn off triggering onUpdateSettings
    return await DataStore.saveJSON(value, `../../${pluginId}/plugin.json`)
  } else {
    // save, but don't trigger onUpdateSettings
    // logDebug('NPConfiguration/savePluginJson', `writing ${pluginId}/plugin.json and asking to block trigger`)
    return await DataStore.saveJSON(value, `../../${pluginId}/plugin.json`, true)
  }
}

export async function getPluginJson(pluginId: string = ''): any {
  return await DataStore.loadJSON(`../../${pluginId}/plugin.json`)
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
export function semverVersionToNumber(version: string): number | string {
  // Trim the version string at the first non-numeric, non-period character
  const trimmedVersion = version.split(/[^0-9.]/)[0]

  const parts = trimmedVersion.split('.').map((part) => {
    const numberPart = parseInt(part, 10)
    if (isNaN(numberPart) || numberPart < 0) {
      logError(`Invalid version part: version=${version} part=${part}`)
    }
    return numberPart
  })

  if (parts.length !== 3) {
    logError('Version string must have exactly three parts')
    return 0
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
export async function pluginUpdated(pluginJson: any, result: { code: number, message: string }, installSilently: boolean = false): Promise<void> {
  // result.codes = 0=no update, 1=updated, 2=installed, -1=error
  if (result.code >= 1) {
    const wasUpdated = result.code === 1
    logInfo(pluginJson, `Plugin was ${wasUpdated ? 'updated' : 'installed'}`)
    const newPluginJson = await getPluginJson(pluginJson['plugin.id'])
    logDebug(pluginJson, `pluginUpdated: newPluginJson:  ${newPluginJson['plugin.id']} ${newPluginJson['plugin.version']}`)
    // CommandBar.hide() // hide any open CommandBar before we open another prompt
    if (newPluginJson) {
      if (!installSilently) {
        const hasChangelog = newPluginJson['plugin.changelog']
        const hasUpdateMessage = newPluginJson['plugin.lastUpdateInfo']
        const updateMessage = hasUpdateMessage ? `Latest changes include:\n"${hasUpdateMessage}"\n\n` : ''
        const version = newPluginJson['plugin.version']
        const dialogMsg = `The '${newPluginJson['plugin.name']}' plugin ${
          wasUpdated ? 'was automatically updated to' : 'was installed.' // Plugin was installed
        } v${version}. ${updateMessage}Would you like to open the Plugin's ${wasUpdated && hasChangelog ? 'Change Log' : 'Documentation'} to see more details?`
        const openReadme = await showMessageYesNo(dialogMsg, ['Yes', 'No'], `Plugin ${wasUpdated ? 'Updated' : 'Installed'}`)
        if (openReadme === 'Yes') {
          const url = wasUpdated ? (hasChangelog ? newPluginJson['plugin.changelog'] : newPluginJson['plugin.url'] || '') : newPluginJson['plugin.url']
          NotePlan.openURL(url)
        }
        logDebug(pluginJson, `${dialogMsg.replace('\n', '')}: ${openReadme}; ${result.message || ''}`)
      }
      await checkForDependenciesAndCommandMigrations(newPluginJson)
    } else {
      logInfo(
        pluginJson,
        `Plugin was updated, but no new settings were loaded. ${result.code === 2 ? '(not necessary on new install) ' : ''}newPluginJson was:${JSP(newPluginJson)}`,
      )
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
export const findPluginInList = (list: Array<any>, id: string, minVersion?: string = '0.0.0'): any => {
  return list.find((p) => {
    if (p.id === id) {
      logDebug(
        `findPluginInList: ${p.id} ${p.version} (${semverVersionToNumber(p.version)}) >= ${minVersion} ${String(
          minVersion ? semverVersionToNumber(p.version) >= semverVersionToNumber(minVersion) : true,
        )}`,
      )
      return minVersion ? semverVersionToNumber(p.version) >= semverVersionToNumber(minVersion) : true
    }
    return false
  })
}

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
 * Attempts to install a plugin if it's not already installed, and optionally shows a message to the user.
 * @param {any} pluginInfo - Information about the plugin to be installed.
 * @param {boolean} showMessageToUser - Whether to show a message to the user. Defaults to false.
 * @param {string} [messageToShowUser] - Optional message to show to the user if showMessageToUser is true.
 * @returns {Promise<any>} - returns either the pluginInstalled object
 */
async function installPlugin(pluginInfo: any): Promise<PluginObject | void> {
  if (!pluginInfo || !pluginInfo.id) {
    return
  }
  const { id, minVersion, preInstallMessage } = pluginInfo
  logDebug(`installPlugin: Start install process for: ${id}`)
  const isInstalled = await pluginIsInstalled(id, minVersion)
  if (isInstalled) {
    logDebug(`installPlugin() ran but ${id} >= ${minVersion || '0.0.0'} was installed, so no need to do anything.`)
    return
  }

  const githubReleasedPlugins = await DataStore.listPlugins(false, true, false) // Released plugins .isOnline is true for all of them
  const newPlugin = await findPluginInList(githubReleasedPlugins, id, minVersion) // minversion can be null/undefined - means just look for any version installed
  if (!newPlugin) {
    logError(`installPlugin() could not find plugin on github: ${id} >= ${minVersion}`)
    await showMessage(`Could not find ${id} plugin to download >= v${minVersion}.`, 'OK', 'Plugin/Dependency Not Found')
    return
  }
  logDebug(`installPlugin(): ${id}, found version: ${newPlugin?.version} (>= ${minVersion}). Will install it now.`)
  if (preInstallMessage) {
    const res = await showMessageYesNo(preInstallMessage, ['Download', 'Cancel'], 'Download New Plugin')
    if (res !== 'Download') {
      logDebug(`installPlugin() cancelled by user for: ${id}`)
      return
    }
  }

  const installed = await DataStore.installPlugin(newPlugin, false)
  if (installed) logDebug(`installPlugin() after plugin download/install/settingsUpdate for: ${installed.id} / ${installed.name} / ${installed.version}`)
  return installed
}

/**
 * Install multiple plugins (either for dependencies or command migrations)
 * Copy settings from old plugin to new one if settingsToCopy field is set in plugin.json of the plugin kicking off the misgration
 * @param {Array<any>} pluginsToInstall - list of plugins to install, minimally, each with an id, e.g. {id}
 * @param {string|null} messageToShowUser
 * @param {any} migrateCommandsFrom - the pluginjson of the original plugin which is asking for other plugins to be installed
 */
export async function installPlugins(pluginsToInstall: Array<any>, migrateCommandsFrom: Object = null): Promise<void> {
  for (let i = 0; i < pluginsToInstall.length; i++) {
    const pluginToInstall = typeof pluginsToInstall[i] === 'string' ? { id: pluginsToInstall[i] } : pluginsToInstall[i]
    const pluginInstalledInfo = await installPlugin(pluginToInstall)
    if (pluginInstalledInfo) {
      const settingsToCopy = pluginToInstall.settingsToCopy // was migrateCommandsFrom?.settingsToCopy previously
      if (settingsToCopy) {
        logDebug(
          migrateCommandsFrom,
          `installPlugins() copying settings from old (${migrateCommandsFrom['plugin.id']}) to new (${pluginInstalledInfo.id}), ${settingsToCopy.length} settings.`,
        )
        if (settingsToCopy?.length) await copySpecificSettings(migrateCommandsFrom['plugin.id'], pluginInstalledInfo.id, settingsToCopy)
      }
      if (pluginToInstall.preInstallMessage) {
        // show an "installed" message if there was a preInstallMessage (otherwise it's a silent install)
        await pluginUpdated({ 'plugin.id': pluginInstalledInfo?.id, 'plugin.version': pluginInstalledInfo?.version }, { code: 2, message: 'Installed' })
      }
    }
  }
}

/**
 * Migrates commands if necessary, iterating over plugins with an index and handling optional user messages.
 * @param {any} pluginJson - JSON object containing the plugin's information, potentially with multiple plugins to migrate.
 * @returns {Promise<void>
 */
export async function migrateCommandsIfNecessary(pluginJson: any): Promise<void> {
  if (!pluginJson['offerToDownloadPlugin']) return
  const start = new Date()
  const pluginsToMigrate = Array.isArray(pluginJson['offerToDownloadPlugin']) ? pluginJson['offerToDownloadPlugin'] : [pluginJson['offerToDownloadPlugin']]
  if (pluginsToMigrate.length) {
    logInfo(pluginJson, `migrateCommandsIfNecessary: found ${pluginsToMigrate.length} plugins to check to migrate [${JSON.stringify(pluginsToMigrate)}] ...`)
    await installPlugins(pluginsToMigrate, pluginJson)
  }
  logDebug(pluginJson, `migrateCommandsIfNecessary() took ${timer(start)}`)
}

/**
 * Install plugins which are dependencies of the given plugin
 * @param {any} pluginJson - JSON object containing the original plugin's information, potentially with multiple plugins to check/install.
 */
export async function installDependencies(pluginJson: any): Promise<void> {
  if (!pluginJson['plugin.dependsOn']) return
  const start = new Date()
  const pluginDependencies = Array.isArray(pluginJson['plugin.dependsOn']) ? pluginJson['plugin.dependsOn'] : [pluginJson['plugin.dependsOn']]
  if (pluginDependencies.length) {
    logInfo(pluginJson, `installDependencies: found ${pluginDependencies.length} plugins to check are installed [${JSON.stringify(pluginDependencies)}] ...`)
    await installPlugins(pluginDependencies, pluginJson)
  }
  logDebug(pluginJson, `installDependencies() took ${timer(start)}`)
}

/**
 * checkForDependenciesAndCommandMigrations
 * @param {any} pluginJson
 */
export async function checkForDependenciesAndCommandMigrations(pluginJson: any): Promise<void> {
  const start = new Date()
  await installDependencies(pluginJson)
  await migrateCommandsIfNecessary(pluginJson)
  logDebug(pluginJson, `checkForDependenciesAndCommandMigrations() took ${timer(start)}`)
}

//FIXME: I AM HERE -- need to go through the flow of original function to make sure it still prompts user correctly etc
// Also add the message to the object optionally and confirm on succcess/fail

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
    const githubReleasedPlugins = await DataStore.listPlugins(false, false, true) //released plugins .isOnline is true for all of them
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

/**
 * Get a setting value from another plugin, or use a default
 * @author @jgclark
 * @param {string} pluginID
 * @param {string} settingName
 * @param {any} defaultValue
 * @returns {any}
 */
// eslint-disable-next-line no-unused-vars
export async function getSettingFromAnotherPlugin(pluginID: string, settingName: string, defaultValue: any): Promise<any> {
  try {
    const otherConfig: any = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    const thisSetting = otherConfig.settingName ?? defaultValue
    logDebug('getSettingFromAnotherPlugin', `${pluginID}.${settingName} -> type:${typeof thisSetting}: ${thisSetting}`)
    return thisSetting
  } catch (error) {
    logError('getSettingFromAnotherPlugin', `getSettingFromAnotherPlugin: caught error: ${JSP(error)}`)
  }
}
