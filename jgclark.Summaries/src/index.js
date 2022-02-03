// @flow

//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 12.1.2022 for v0.4.0
//-----------------------------------------------------------------------------

// including so rollup will trigger build when plugin.json is modified
import pluginJson from '../plugin.json'
import { migrateConfiguration } from '../../helpers/configuration'

export { insertProgressUpdate } from './progress'
export { weeklyStats } from './forPlotting'
export { occurrencesPeriod } from './occurrences'
export { saveSearch } from './saveSearch'
export { statsPeriod } from './stats'

const PLUGIN_ID = 'summaries'

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