// @flow
//-----------------------------------------------------------------------------
// More advanced searching
// Jonathan Clark
// Last updated 3.4.2024 for v1.0.0+
//-----------------------------------------------------------------------------

export {
  quickSearch,
  saveSearch,
  searchOverAll,
  searchOpenTasks,
  searchOpenChecklists,
  searchOverNotes,
  searchOverCalendar
} from './saveSearch'
export { searchPeriod } from './saveSearchPeriod'
export { refreshSavedSearch } from './searchTriggers'
export {
  closeDialogWindow,
  flexiSearchRequest,
  flexiSearchHandler,
  getPluginPreference,
  savePluginPreference
} from './flexiSearch'

const pluginID = "jgclark.SearchExtensions"

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    const res = await DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
    if (res.code > 0) {
      logWarn(pluginJson, `init::installOrUpdatePlugins check -> code ${String(res.code)} message ${res.message}`)
    }
  } catch (error) {
    logError(pluginID, error.message)
    logError(pluginID, JSP(error))
  }
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    const updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused' })

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
