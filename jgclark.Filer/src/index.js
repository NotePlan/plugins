// @flow

// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// Last updated 17.5.2022, for v0.7.0
// -----------------------------------------------------------------------------

export { moveParas } from './fileItems'
export { addIDAndAddToOtherNote } from './IDs'
export { newNoteFromSelection } from './newNoteFromSelection'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json' 

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '../../helpers/NPconfiguration'

const configKey = "filer"

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
