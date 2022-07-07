// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 16.6.2022, for v0.16.0+
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json' 
import { log } from "@helpers/dev"
import { migrateConfiguration, updateSettingData } from '@helpers/NPConfiguration'

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
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(configKey, pluginJson, config?.silent)
    log(pluginJson, `${configKey}: onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
       const updateSettings = updateSettingData(pluginJson)
       log(pluginJson, `${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
     }
  } catch (error) {
    log(pluginJson, error)
  }
  log(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}
