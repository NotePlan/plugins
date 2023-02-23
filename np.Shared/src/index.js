// @flow

// -----------------------------------------------------------------------------
// Shared Resources plugin for NotePlan
// Jonathan Clark
// last updated 30.1.2023 for v0.1.0, @jgclark
// -----------------------------------------------------------------------------

const pluginID = 'np.Shared'
import pluginJson from '../plugin.json'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
export { openReactWindow } from './NPReactLocal'

export function fakeInstall(): void {
  try {
    logDebug(pluginID, 'fakeInstall: Starting ...')
    // TODO: stuff
  } catch (error) {
    logError(pluginID, JSP(error))
  }
}

/**
 * Write to the log the list of resource files provided by this plugin
 * @author @jgclark
 */
export async function logProvidedResources(): Promise<void> {
  try {
    const livePluginJson = await getPluginJson(pluginID)
    const requiredFiles = livePluginJson['plugin.requiredFiles']
    logInfo(pluginID, `Resources Provided by np.Shared according to its plugin.json file:\n- ${requiredFiles.join('\n- ')}`)
  } catch (error) {
    logError(pluginID, JSP(error))
  }
}

export function logLocallyAvailableResources(): void {
  try {
    const availableFiles = ['test', 'me'] // FIXME:
    logInfo(pluginID, `# Locally available resources, as found in Plugins/np.Shared/:\n- ${availableFiles.join('\n- ')}`)
  } catch (error) {
    logError(pluginID, JSP(error))
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
    logDebug(pluginID, `onUpdateOrInstall: Starting`)
    // Try updating settings data
    const updateSettings = updateSettingData(pluginID)
    logDebug(pluginID, `onUpdateOrInstall: UpdateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginID, error)
  }
  logDebug(pluginID, `onUpdateOrInstall: Finished`)
}
