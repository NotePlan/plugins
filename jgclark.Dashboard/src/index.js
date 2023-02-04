// @flow

// -----------------------------------------------------------------------------
// Dashboard plugin for NotePlan
// Jonathan Clark
// last updated 31.1.2023 for v0.1.0, @jgclark
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { showDashboardHTML } from './dashboardHTML'
export { getDataForDashboard, logDashboardData } from './dataGeneration'

const pluginID = 'jgclark.Dashboard'
const sharedPluginID = 'np.Shared'

/**
 * Test to see if np.Shared is installed, and if filenames are passed, then check that they are available too.
 * @author @jgclark
 * @results {boolean | number} simple or more complex results of check
 */
export async function checkForWantedResources(filesToCheck?: Array<string>): Promise<boolean | number> {
  // First test to see if np.Shared is installed
  if (!DataStore.isPluginInstalledByID(sharedPluginID)) {
    return false
  }

  // It is installed.
  let retBool = true
  // If we don't want to check whether file(s) can be accessed then return
  if (!filesToCheck) {
    return true
  }

  // We want to check, so read np.Shared's requiredFiles
  const livePluginJson = await getPluginJson(sharedPluginID)
  const requiredFiles = livePluginJson['plugin.requiredFiles']
  logDebug(`${pluginID}/init/checkForWantedResources`, `plugin np.Shared is loaded 😄 and provides ${String(requiredFiles.length)} files:`)

  // Double-check that the requiredFiles can be accessed
  let numFound = 0
  for (const rf of filesToCheck) {
    const filename = `../../${sharedPluginID}/${rf}`
    const data = DataStore.loadData(filename, false)
    if (data) {
      logDebug(`checkForWantedResources`, `- found ${filename}, length ${String(data.length)}`)
      numFound++
    } else {
      logWarn(`checkForWantedResources`, `- ${filename} not found`)
    }
  }
  return numFound
}

/**
 * Check things each time this plugin's commands are run
 */
export async function init(): Promise<void> {
  try {
    logDebug(`${pluginID}/init`, 'starting ...')
    // FIXME: is .dependencies the right thing to use here?
    const wantedFileList = pluginJson['plugin.dependencies']
    logDebug(`${pluginID}/init`, `${String(wantedFileList.length)} wanted files: ${String(wantedFileList)}`)
    const wantedRes = await checkForWantedResources(wantedFileList)
    if (typeof wantedRes === 'number' && wantedRes >= wantedFileList.length) {
      // plugin np.Shared is loaded, and is providing all the wanted resources
      logDebug(`${pluginID}/init`, `plugin np.Shared is loaded 😄 and provides all the ${String(wantedFileList.length)} wanted files`)
    } else if (typeof wantedRes === 'number' && wantedRes < wantedFileList.length) {
      // plugin np.Shared is loaded, but isn't providing all the wanted resources
      logWarn(`${pluginID}/init`, `plugin np.Shared is loaded 😄, but is only providing ${String(wantedRes)} out of ${String(wantedFileList.length)} wanted files, so there might be display issues 😳`)
    } else if (wantedRes) {
      // plugin np.Shared is loaded
      logWarn(`${pluginID}/init`, `plugin np.Shared is loaded 😄; no further checking done`)
    } else {
      // plugin np.Shared is not loaded
      logWarn(`${pluginID}/init`, `plugin np.Shared isn't loaded 🥵, so icons probably won't display`)
    }

    // In the background, see if there is an update to the plugin to install, and if so let user know
    DataStore.installOrUpdatePluginsByID([pluginID], false, false, false)
  }
  catch (error) {
    logError(`${pluginID}/init`, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}


export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall running`)
    // Try updating settings data
    const updateSettings = updateSettingData(pluginJson)
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${pluginID}: onUpdateOrInstall finished`)
}
