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
    console.log(`onUpdateOrInstall running for ${PLUGIN_ID}`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(PLUGIN_ID, pluginJson, config?.silent)
  } catch (error) {
    console.log(error)
  }
}