// @flow

import pluginJson from '../plugin.json'

// updateSettingsData will execute whenever your plugin is installed or updated
import { log, logDebug, clo } from '@helpers/dev'
import { updateSettingData } from '@helpers/NPConfiguration'

export { newMeetingNote, newMeetingNoteFromID } from './NPMeetingNotes'
export { insertNoteTemplate } from './NPMeetingNotes'

export function init(): void {
  // this runs every time the plugin starts up (any command in this plugin is run)
  // turning updates to silentmode since users won't know np.MeetingNotes is installed
  // updates will happen (or not happen) silently
  clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export async function onUpdateOrInstall(): Promise<void> {
  await updateSettingData(pluginJson)
}

export async function onSettingsUpdated(): Promise<void> {
  // nothing, but stops log errors
}
