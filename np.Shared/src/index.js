// @flow
// -----------------------------------------------------------------------------
// Shared Resources plugin for NotePlan
// Jonathan Clark
// last updated 2024-10-08 for v0.4.4+, @jgclark
// -----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { clo, clof, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

export { openReactWindow, onMessageFromHTMLView } from './NPReactLocal'

const sharedPluginID = 'np.Shared'

/**
 * Log the list of resource files that should currently be available by this plugin (i.e. at run-time, not compile-time).
 * @author @jgclark
 */
export async function logProvidedSharedResources(): Promise<void> {
  try {
    const liveSharedPluginJson = await getPluginJson(sharedPluginID)
    const requiredFiles = liveSharedPluginJson['plugin.requiredFiles']
    logInfo(sharedPluginID, `Resources Provided by np.Shared according to its plugin.json file:\n- ${requiredFiles.join('\n- ')}`)
  } catch (error) {
    logError(sharedPluginID, JSP(error))
  }
}

/** Log the the list of resource files that are actually available to client plugins from np.Shared (i.e. at run-time, not compile-time).
 * @author @jgclark
 */
export async function logAvailableSharedResources(pluginID: string): Promise<void> {
  try {
    const liveSharedPluginJson = await getPluginJson(sharedPluginID)
    const requiredFiles = liveSharedPluginJson['plugin.requiredFiles']
    for (const rf of requiredFiles) {
      const relativePathToRF = `../../${sharedPluginID}/${rf}`
      logInfo(sharedPluginID, `- ${relativePathToRF} ${DataStore.fileExists(relativePathToRF) ? 'is' : "isn't"} available from np.Shared`)
    }
  } catch (error) {
    logError(sharedPluginID, JSP(error))
  }
}

/**
 * Test to see if np.Shared is installed, and the relevant plugin.resuiredSharedFiles are available. 
 * Altnernatively, if a list of filenames are passed, then check that they are available. 
 * Return the number of wanted files found, or false if np.Shared isn't installed.
 * @author @jgclark
 * @param {string} clientPluginID - pluginID for the client plugin
 * @param {Array<string>} files - optional list of filenames to check
 * @results {false | number} simple or more complex results of check
 */
export async function checkForWantedResources(pluginID: string, filesToCheckIn?: Array<string>): Promise<false | number> {
  try {
    // logDebug('checkForWantedResources', `Starting with buildVersion ${Number(NotePlan.environment.buildVersion)}`)
    // First test to see if np.Shared is installed
    if (!DataStore.isPluginInstalledByID(sharedPluginID)) {
      logWarn('checkForWantedResources', `${sharedPluginID} is not installed.`)
      return false
    }
    // It is installed.
    logDebug(`checkForWantedResources`, `plugin np.Shared is loaded`)

    // Work out list of files to check for
    const livePluginJson = await getPluginJson(pluginID) ?? {}
    // clof(livePluginJson, `livePluginJson some fields`, ['plugin.requiredSharedFiles', 'plugin.requiredFiles'])
    const requiredSharedFiles = livePluginJson['plugin.requiredSharedFiles'] ?? []
    // logDebug(`checkForWantedResources`, `requiredSharedFiles: ${String(requiredSharedFiles)}`)
    const filesToCheck = filesToCheckIn ? filesToCheckIn : requiredSharedFiles
    // logDebug(`checkForWantedResources`, `filesToCheck: ${String(filesToCheck)}`)

    // Double-check that these files can be accessed
    let numFound = 0
    for (const rf of filesToCheck) {
      const filename = `../../${sharedPluginID}/${rf}`
      if (NotePlan.environment.buildVersion >= 973) {
        // If we can, use newer method that doesn't have to load the data
        if (DataStore.fileExists(filename)) {
          // logDebug(`checkForWantedResources`, `- ${filename} exists`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      } else {
        const data = DataStore.loadData(filename, false)
        if (data) {
          // logDebug(`checkForWantedResources`, `- found ${filename}, length ${String(data.length)}`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      }
    }
    if (filesToCheck.length !== numFound) {
      logWarn(`checkForWantedResources`, `I can access ${String(numFound)}, not the ${String(filesToCheck.length)} wanted shared resource files. This will probably mean issues with display or functionality.`)
    }
    return numFound
  } catch (error) {
    logError('checkForWantedResources', `for ${pluginID}: ${JSP(error)}`)
    return false
  }
}

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(sharedPluginID, `onUpdateOrInstall: Starting`)
    // Try updating settings data
    const updateSettings = updateSettingData(sharedPluginID)
    logDebug(sharedPluginID, `onUpdateOrInstall: UpdateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(sharedPluginID, error)
  }
  logDebug(sharedPluginID, `onUpdateOrInstall: Finished`)
}
