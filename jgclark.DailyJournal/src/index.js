// @flow

//-----------------------------------------------------------------------------
// Daily Journal commands
// Jonathan Clark
// v0.6.5, 28.6.2021
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { migrateConfiguration } from '../../helpers/configuration'


export { dayStart, dayReview, todayStart } from './journal'


const PLUGIN_ID = 'dailyJournal'

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