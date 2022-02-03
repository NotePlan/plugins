// @flow

//-----------------------------------------------------------------------------
// Quick Capture plugin for NotePlan
// Jonathan Clark
// Last updated 2.2.22 for v0.4.2, @jgclark
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

import pluginJson from '../plugin.json' // to allow changes in plugin.json to trigger recompilation

// Moving to ConfigV2
import { migrateConfiguration } from '../../helpers/configuration'

const PLUGIN_ID = 'QuickCapture'

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`onUpdateOrInstall running for ${PLUGIN_ID}`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(PLUGIN_ID, pluginJson, config?.silent)
  } catch (error) {
    console.log(error)
  }
}
