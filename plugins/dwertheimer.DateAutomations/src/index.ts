// @flow
import pluginJson from '../plugin.json'
import { updateSettingData } from '../../helpers/NPConfiguration'

export { insertDate } from './dateFunctions'
export { insertDateTime } from './dateFunctions'
export { insertDateTime8601 } from './dateFunctions'
export { insertISODate } from './dateFunctions'
export { insertCalendarNoteLink } from './dateFunctions'
export { insertTime } from './dateFunctions'
export { dateFormatPicker } from './dateFunctions'
export { insertStrftime } from './dateFunctions'
export { insertWeekDates } from './dateFunctions'

export { get8601String, getWeekDates } from './dateFunctions'

const PLUGIN_ID = 'date' // the key that's used in _configuration note
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${PLUGIN_ID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    console.log(`${PLUGIN_ID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
  } catch (error: any) {
    console.log(error)
  }
  console.log(`${PLUGIN_ID}: onUpdateOrInstall finished`)
}
