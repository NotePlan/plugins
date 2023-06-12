// @flow
//-----------------------------------------------------------------------------
// More advanced searching
// Jonathan Clark
// Last updated 2.6.2023 for v1.1.0-beta
//-----------------------------------------------------------------------------

export {
  quickSearch,
  saveSearch,
  searchOverAll,
  searchOpenTasks,
  searchOverNotes,
  searchOverCalendar
} from './saveSearch'
export { searchPeriod } from './saveSearchPeriod'
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
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logError, logInfo } from '@helpers/dev'

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
