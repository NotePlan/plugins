// @flow
//-----------------------------------------------------------------------------
// More advanced searching
// Jonathan Clark
// Last updated 2025-01-17 for v1.4.0, @jgclark
//-----------------------------------------------------------------------------

// Note: following waiting for v1.5
// export {
//   replace,
//   replaceOverAll,
//   replaceOverNotes,
//   replaceOverCalendar
// } from './replace'
export {
  quickSearch,
  saveSearch,
  searchOverAll,
  searchOpenTasks,
  searchOverNotes,
  searchOverCalendar
} from './saveSearch'
export { searchPeriod } from './saveSearchPeriod'
export { refreshSavedSearch } from './searchTriggers'
export {
  closeDialogWindow,
  showFlexiSearchDialog,
  flexiSearchHandler,
  getPluginPreference,
  savePluginPreference
} from './flexiSearch'

const pluginID = "jgclark.SearchExtensions"

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { getSearchSettings } from './searchHelpers'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginID, error.message)
    logError(pluginID, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // Read these new settings, and then set two preferences to be picked up by flexiSearch later
  const updatedSettings = await getSearchSettings()
  logDebug('onSettingsUpdated', `Setting caseSensitiveSearching pref to ${String(updatedSettings.caseSensitiveSearching ?? false)}`)
  DataStore.setPreference(`${pluginID}.caseSensitiveSearching`, updatedSettings.caseSensitiveSearching ?? false)
  logDebug('onSettingsUpdated', `Setting fullWordSearching pref to ${String(updatedSettings.fullWordSearching ?? false)}`)
  DataStore.setPreference(`${pluginID}.fullWordSearching`, updatedSettings.fullWordSearching ?? false)
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
