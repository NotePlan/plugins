// @flow

/**
 * Imports
 */
import pluginJson from '../plugin.json'
import { clo } from '@np/helpers/dev'

/**
 * Command Exports
 */
export { editSettings } from '@np/helpers/NPSettings'

export { taskSync } from './taskSync'
export {
  updateDatePlusTags,
  reviewOverdueTasksByTask,
  reviewOverdueTasksInNote,
  reviewOverdueTasksInFolder,
  reviewEditorReferencedTasks,
  searchForOpenTasks,
  askToReviewForgottenTasks,
  reviewWeeklyTasks,
  reviewOverdueTasksAsOfDate,
} from './NPOverdue'
export { followUpSaveHere, followUpInFuture } from './NPFollowUp'
export { processOverdueReact, onUserModifiedParagraphs, testOverdueReact, processFolderReact } from './NPOverdueReact.js'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData, pluginUpdated } from '@np/helpers/NPConfiguration'

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

export async function onSettingsUpdated(): Promise<void> {
  // you probably won't need to use this...it's fired when the settings are updated in the Preferences panel
}

export function onUpdateOrInstall(): void {
  // this runs after the plugin is installed or updated. the following command updates the plugin's settings data
  updateSettingData(pluginJson)
}

export async function testOnUpdateOrInstall(): Promise<void> {
  // test as after the plugin is installed or updated. the following command updates the plugin's settings data
  const r = { code: 1 /* updated */, message: 'plugin updated message' }
  await pluginUpdated(pluginJson, r)
}
