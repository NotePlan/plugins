// @flow
import pluginJson from '../plugin.json'
import { migrateConfiguration } from '../../helpers/configuration'

export { createNoteForCalendarItemWithQuickTemplate, createNoteForCalendarItemWithoutQuickTemplate } from './events'
export { insertTodosAsTimeblocks, insertTodosAsTimeblocksWithPresets } from './NPTimeblocking'

const PLUGIN_ID = 'autoTimeBlocking'

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`onUpdateOrInstall running for ${PLUGIN_ID}`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(PLUGIN_ID, pluginJson, config?.silent)
    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    //  DataStore.settings = { ...templateSettings }
  } catch (error) {
    console.log(error)
  }
}
