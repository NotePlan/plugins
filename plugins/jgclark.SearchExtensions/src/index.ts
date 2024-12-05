// @flow
//-----------------------------------------------------------------------------
// More advanced searching
// Jonathan Clark
// Last updated 2024-10-25 for v1.4.0, @jgclark
//-----------------------------------------------------------------------------

export {
  replace,
  replaceOverAll,
  replaceOverNotes,
  replaceOverCalendar
} from './replace'
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
  flexiSearchRequest,
  flexiSearchHandler,
  getPluginPreference,
  savePluginPreference
} from './flexiSearch'

const pluginID = "jgclark.SearchExtensions"

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@np/helpers/dev'
import { pluginUpdated, updateSettingData } from '@np/helpers/NPConfiguration'
import { editSettings } from '@np/helpers/NPSettings'

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

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
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
