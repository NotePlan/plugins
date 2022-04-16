// @flow
import pluginJson from '../plugin.json'
import { migrateConfiguration, updateSettingData } from '../../helpers/NPConfiguration'

export { insertDate } from './dateFunctions'
export { insertDateTime } from './dateFunctions'
export { insertDateTime8601 } from './dateFunctions'
export { insertISODate } from './dateFunctions'
export { insertCalendarNoteLink } from './dateFunctions'
export { insertTime } from './dateFunctions'
export { dateFormatPicker } from './dateFunctions'
export { insertStrftime } from './dateFunctions'
export { insertWeekDates } from './dateFunctions'

const PLUGIN_ID = 'date' // the key that's used in _configuration note
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
