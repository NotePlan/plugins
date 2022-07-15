// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 15.7.2022, for v0.16.0+
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json' 
import { log } from "@helpers/dev"
import { migrateConfiguration, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { timeBlocksToCalendar } from './timeblocks'
export {
  listDaysEvents,
  insertDaysEvents,
  listMatchingDaysEvents,
  insertMatchingDaysEvents,
} from './eventsToNotes'
export { processDateOffsets, shiftDates } from './offsets'

export function init(): void {
  // Placeholder only
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const configKey = "events"

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    log(pluginJson, `${configKey}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    log(pluginJson, `${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    log(pluginJson, error)
  }
  log(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}
