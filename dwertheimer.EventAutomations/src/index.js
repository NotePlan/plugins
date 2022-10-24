// @flow
import pluginJson from '../plugin.json'
import { migrateConfiguration, updateSettingData, pluginUpdated } from '../../helpers/NPConfiguration'
import { log, logDebug, clo } from '../../helpers/dev'

export {
  insertTodosAsTimeblocks,
  insertTodosAsTimeblocksWithPresets,
  selectCalendar,
  insertSyncedCopiesOfTodayTodos,
  removeSyncedCopiesOfTodayTodos,
  removeTimeBlocks,
  removePreviousSyncedCopies,
  removePreviousTimeBlocks,
  markDoneAndRecreateTimeblocks,
} from './NPTimeblocking'

export { createEvents } from './NPEventBlocks'

const PLUGIN_ID = 'autoTimeBlocking' // the key that's used in _configuration note

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

export function onSettingsUpdated() {}

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}
