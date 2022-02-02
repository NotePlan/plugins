// @flow
import pluginJson from '../plugin.json'
import { migrateConfiguration } from '../../helpers/configuration'
import { arrayToCSV } from './config.js'

export { createNoteForCalendarItemWithQuickTemplate, createNoteForCalendarItemWithoutQuickTemplate } from './events'
export { insertTodosAsTimeblocks, insertTodosAsTimeblocksWithPresets } from './NPTimeblocking'

const PLUGIN_ID = 'autoTimeBlocking'

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  // refactor previous variables to new types
  const settings = { ...DataStore.settings }
  if (settings) {
    // these fields used to be arrays, now need to be CSV strings
    settings.includeTasksWithText = arrayToCSV(settings.includeTasksWithText)
    settings.excludeTasksWithText = arrayToCSV(settings.excludeTasksWithText)
    DataStore.settings = settings
  }
  try {
    console.log(`onUpdateOrInstall running for ${PLUGIN_ID}`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(PLUGIN_ID, pluginJson, config?.silent)
  } catch (error) {
    console.log(error)
  }
}
