// @flow

// -----------------------------------------------------------------------------
// Plugin to store your expenses for further analyis
// Michael Wellner (@m1well)
// v1.7.0, 2022-02-10
// -----------------------------------------------------------------------------

import { migrateConfiguration, updateSettingData } from '../../helpers/NPConfiguration'
import pluginJson from '../plugin.json'

export { expensesTracking, expensesAggregate, individualTracking, shortcutsTracking, fixedTracking } from './expenses'

const PLUGIN_ID = 'expenses'

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
