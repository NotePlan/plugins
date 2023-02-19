// @flow

// ----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 19.2.2023 for v0.2.0, @jgclark
// ----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { logWindows } from './dashboardHelpers'
export { testCompleteItem } from './pluginToHTMLBridge'
export { showDashboardHTML } from './dashboardHTML'
export { onMessageFromHTMLView } from './pluginToHTMLBridge'

export { getDataForDashboard, logDashboardData } from './dataGeneration'

const thisPluginID = 'jgclark.Dashboard'
const sharedPluginID = 'np.Shared'

/**
 * Test to see if np.Shared is installed, and if filenames are passed, then check that they are available too.
 * @author @jgclark
 * @results {boolean | number} simple or more complex results of check
 */
export async function checkForWantedResources(filesToCheck?: Array<string>): Promise<boolean | number> {
  try {
    logDebug('checkForWantedResources', `Starting with buildVersion ${Number(NotePlan.environment.buildVersion)}`)
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
    const livePluginJson = await getPluginJson(thisPluginID)
    const requiredFiles = livePluginJson['plugin.requiredSharedFiles']
    logDebug(`${thisPluginID}/init/checkForWantedResources`, `plugin np.Shared is loaded 😄 and provides ${String(requiredFiles.length)} files:`)

    // Double-check that the requiredSharedFiles can be accessed
    let numFound = 0
    for (const rf of filesToCheck) {
      const filename = `../../${sharedPluginID}/${rf}`
      if (NotePlan.environment.buildVersion >= 973) {
        // If we can, use newer method that doesn't have to load the data
        if (DataStore.fileExists(filename)) {
          logDebug(`checkForWantedResources`, `- ${filename} exists`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      } else {
        const data = DataStore.loadData(filename, false)
        if (data) {
          logDebug(`checkForWantedResources`, `- found ${filename}, length ${String(data.length)}`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      }
    }
    return numFound
  } catch (error) {
    logError(thisPluginID, error.message)
    return false
  }
}

/**
 * Check things each time this plugin's commands are run
 */
export async function init(): Promise<void> {
  try {
    logDebug(`${thisPluginID}/init`, 'starting ...')
    const wantedFileList = pluginJson['plugin.requiredSharedFiles']
    logDebug(`${thisPluginID}/init`, `${String(wantedFileList.length)} wanted files: ${String(wantedFileList)}`)
    const wantedRes = await checkForWantedResources(wantedFileList)
    if (typeof wantedRes === 'number' && wantedRes >= wantedFileList.length) {
      // plugin np.Shared is loaded, and is providing all the wanted resources
      logDebug(`${thisPluginID}/init`, `plugin np.Shared is loaded 😄 and provides all the ${String(wantedFileList.length)} wanted files`)
    } else if (typeof wantedRes === 'number' && wantedRes < wantedFileList.length) {
      // plugin np.Shared is loaded, but isn't providing all the wanted resources
      logWarn(
        `${thisPluginID}/init`,
        `plugin np.Shared is loaded 😄, but is only providing ${String(wantedRes)} out of ${String(wantedFileList.length)} wanted files, so there might be display issues 😳`,
      )
    } else if (wantedRes) {
      // plugin np.Shared is loaded
      logWarn(`${thisPluginID}/init`, `plugin np.Shared is loaded 😄; no further checking done`)
    } else {
      // plugin np.Shared is not loaded
      logWarn(`${thisPluginID}/init`, `plugin np.Shared isn't loaded 🥵, so icons probably won't display`)
    }

    // In the background, see if there is an update to the plugin to install, and if so let user know
    DataStore.installOrUpdatePluginsByID([thisPluginID], false, false, false)
  } catch (error) {
    logError(`${thisPluginID}/init`, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${thisPluginID}: onUpdateOrInstall running`)
    // Try updating settings data
    const updateSettings = updateSettingData(pluginJson)
    logDebug(pluginJson, `${thisPluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${thisPluginID}: onUpdateOrInstall finished`)
}
