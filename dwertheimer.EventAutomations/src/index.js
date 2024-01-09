// @flow
import pluginJson from '../plugin.json'
import { updateSettingData, pluginUpdated } from '../../helpers/NPConfiguration'
import { log, logDebug, clo } from '../../helpers/dev'

export { editSettings } from '@helpers/NPSettings'

export {
  insertTodosAsTimeblocks,
  insertTodosAsTimeblocksWithPresets,
  selectCalendar,
  insertSyncedCopiesOfTodayTodos,
  removeTimeBlocks,
  removePreviousTimeBlocks,
  markDoneAndRecreateTimeblocks,
  onEditorWillSave,
} from './NPTimeblocking'

export { createEvents, createEventPrompt } from './NPEventBlocks'

const PLUGIN_ID = 'autoTimeBlocking' // the key that's used in _configuration note

export async function onUpdateOrInstall(): Promise<void> {
  try {
    console.log(`${PLUGIN_ID}: onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const updateSettings = updateSettingData(pluginJson)
    console.log(`${PLUGIN_ID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
  } catch (error) {
    await console.log(error)
  }
  console.log(`${PLUGIN_ID}: onUpdateOrInstall finished`)
}

export function onSettingsUpdated() {}

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  // clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  console.log(`\n\n\n`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}
