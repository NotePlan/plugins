// @flow

//-----------------------------------------------------------------------------
// Event Helpers
// Jonathan Clark
// last updated 4.2.2022, for v0.11.0
//-----------------------------------------------------------------------------

export { timeBlocksToCalendar } from './timeblocks'
export {
  listDaysEvents,
  insertDaysEvents,
  listMatchingDaysEvents,
  insertMatchingDaysEvents,
} from './eventsToNotes'
export { processDateOffsets } from './offsets'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json' 

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '../../helpers/NPconfiguration'

const configKey = "events"

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${configKey}: onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(configKey, pluginJson, config?.silent)
    console.log(`${configKey}: onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
       const updateSettings = updateSettingData(pluginJson)
       console.log(`${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
     }
  } catch (error) {
    console.log(error)
  }
  console.log(`${configKey}: onUpdateOrInstall finished`)
}
