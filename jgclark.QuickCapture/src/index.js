// @flow

//--------------------------------------------------------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// v0.4.2, 5.7.2021
//--------------------------------------------------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { migrateConfiguration } from '../../helpers/configuration'

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

const PLUGIN_ID = 'inbox'

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