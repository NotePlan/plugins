// @flow

//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 17.6.2022 for v0.9.0
//-----------------------------------------------------------------------------

export { weeklyStats } from './forPlotting'
export { insertProgressUpdate } from './progress'
export { saveSearch } from './saveSearch'
export { saveSearchPeriod } from './saveSearchPeriod'
export { statsPeriod } from './stats'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '@helpers/NPConfiguration'

export function init(): void {
  // Placeholder only
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const configKey = "summaries"

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
