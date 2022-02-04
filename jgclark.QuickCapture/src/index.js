// @flow

//-----------------------------------------------------------------------------
// Quick Capture plugin for NotePlan
// Jonathan Clark
// Last updated 3.2.22 for v0.4.2, @jgclark
//-----------------------------------------------------------------------------

export {
  addTaskToInbox,
  addTaskToNoteHeading,
  addTextToNoteHeading,
  appendTaskToDailyNote,
  appendTextToDailyJournal,
  prependTaskToDailyNote,
  appendTaskToNote,
  prependTaskToNote
} from './quickCapture'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json' 

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '../../helpers/NPconfiguration'

const configKey = 'inbox'

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
