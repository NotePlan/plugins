// @flow
export { default as sortTasks } from './sortTasks'
export { sortTasksByPerson } from './sortTasks'
export { sortTasksByTag } from './sortTasks'
export { tasksToTop, openTasksToTop } from './sortTasks'
export { default as markTasks } from './markTasks'
export { sortTasksViaTemplate } from './sortTasks'
export { taskSync } from './taskSync'
export { copyTagsFromLineAbove, copyTagsFromHeadingAbove, copyLineForEachMention, copyLineForEachHashtag } from './tagTasks'
export { openIncompleteLinksInNote, openURLOnLine } from './NPOpenLinks'
import pluginJson from '../plugin.json'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

export async function onSettingsUpdated(): Promise<void> {
  // you probably won't need to use this...it's fired when the settings are updated in the Preferences panel
}

export function onUpdateOrInstall(): void {
  // this runs after the plugin is installed or updated. the following command updates the plugin's settings data
  updateSettingData(pluginJson)
}
