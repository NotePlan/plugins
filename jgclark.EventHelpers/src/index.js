// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 3.2.2022, for v0.11.0
//-----------------------------------------------------------------------------

export { timeBlocksToCalendar } from './timeblocks'
export { listDaysEvents, insertDaysEvents, listMatchingDaysEvents, insertMatchingDaysEvents } from './eventsToNotes'
export { processDateOffsets } from './offsets'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '../../helpers/NPConfiguration'

const PLUGIN_ID = 'events'

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${PLUGIN_ID}: onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(PLUGIN_ID, pluginJson, config?.silent)
    console.log(`${PLUGIN_ID}: onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
      const updateSettings = updateSettingData(pluginJson)
      console.log(`${PLUGIN_ID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    }
  } catch (error) {
    console.log(error)
  }
  console.log(`${PLUGIN_ID}: onUpdateOrInstall finished`)
}
