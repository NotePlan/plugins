// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 2025-01-20, for v0.22.2
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError } from '@helpers/dev'
import { updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { timeBlocksToCalendar } from './timeblocks'
export {
  listDaysEvents,
  insertDaysEvents,
  listMatchingDaysEvents,
  insertMatchingDaysEvents
} from './eventsToNotes'
export { processDateOffsets } from './offsetDates'
export { shiftDates } from './shiftDates'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

const pluginID = 'jgclark.EventHelpers'

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder to avoid complaints
}

// refactor previous variables to new types
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    logDebug(pluginJson, `${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${pluginID}: onUpdateOrInstall finished`)
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
