// @flow

// -----------------------------------------------------------------------------
// Shared Resources plugin for NotePlan
// Jonathan Clark
// last updated 15.7.2023 for v0.4.4, @jgclark
// -----------------------------------------------------------------------------

const sharedPluginID = 'np.Shared'
import pluginJson from '../plugin.json'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

export { openReactWindow, onMessageFromHTMLView } from './NPReactLocal'

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
 * Test to see if np.Shared is installed, and if filenames are passed, then check that they are available too. In the latter case, return the number of 'filesToCheck' that are found.
 * @author @jgclark
 * @param {string} clientPluginID - pluginID for the client plugin
 * @param {Array<string>} files - optional list of filenames to check
 * @results {boolean | number} simple or more complex results of check
 */
export async function checkForWantedResources(pluginID: string, filesToCheck?: Array<string>): Promise<boolean | number> {
  try {
    // logDebug('checkForWantedResources', `Starting with buildVersion ${Number(NotePlan.environment.buildVersion)}`)
    // First test to see if np.Shared is installed
    if (!DataStore.isPluginInstalledByID(sharedPluginID)) {
      logInfo('checkForWantedResources', `${sharedPluginID} is not installed.`)
      return false
    }

    // It is installed.
    let retBool = true
    // If we don't want to check whether file(s) can be accessed then return
    if (!filesToCheck) {
      return true
    }

    // We want to check, so read this plugin's requiredSharedFiles
    const livePluginJson = await getPluginJson(pluginID)
    const requiredSharedFiles = livePluginJson['plugin.requiredSharedFiles'] ?? []
    // $FlowFixMe
    logDebug(`${pluginID}/init/checkForWantedResources`, `plugin np.Shared is loaded 😄 and provides ${String(requiredSharedFiles.length)} files:`)

    // Double-check that the requiredSharedFiles can be accessed
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
    return numFound
  } catch (error) {
    logError(pluginID, error.message)
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
