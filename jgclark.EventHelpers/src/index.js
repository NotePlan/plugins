// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 22.7.2022, for v0.16.6
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { log, logError } from '@helpers/dev'
import { updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { timeBlocksToCalendar } from './timeblocks'
export { listDaysEvents, insertDaysEvents, listMatchingDaysEvents, insertMatchingDaysEvents } from './eventsToNotes'
export { processDateOffsets, shiftDates } from './offsets'

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
    log(pluginJson, `${pluginID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    log(pluginJson, `${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  log(pluginJson, `${pluginID}: onUpdateOrInstall finished`)
}
