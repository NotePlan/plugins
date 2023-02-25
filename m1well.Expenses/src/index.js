// @flow

// -----------------------------------------------------------------------------
// Plugin to store your expenses for further analyis
// Michael Wellner (@m1well)
// v1.7.0, 2022-02-10
// -----------------------------------------------------------------------------

import { updateSettingData } from '../../helpers/NPConfiguration'
import pluginJson from '../plugin.json'

export { expensesTracking, expensesAggregate, individualTracking, shortcutsTracking, fixedTracking } from './expenses'

const PLUGIN_ID = 'expenses'

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${PLUGIN_ID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    console.log(`${PLUGIN_ID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
  } catch (error) {
    console.log(error)
  }
  console.log(`${PLUGIN_ID}: onUpdateOrInstall finished`)
}
