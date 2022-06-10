// @flow

//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 10.6.2022 for v0.1.0
//-----------------------------------------------------------------------------

export { makeMOC } from './MOCs'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

import { migrateConfiguration, updateSettingData } from '@helpers/NPconfiguration'

export function init(): void {
  // Placeholder only
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const configKey = "mocs"

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${configKey}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    console.log(`${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
  } catch (error) {
    console.log(error)
  }
  console.log(`${configKey}: onUpdateOrInstall finished`)
}
