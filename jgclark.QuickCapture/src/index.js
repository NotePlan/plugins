// @flow

//-----------------------------------------------------------------------------
// Quick Capture plugin for NotePlan
// Jonathan Clark
// Last updated 27.6.22 for v0.10.1, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, log, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export {
  addTaskToInbox,
  addTaskToNoteHeading,
  addTextToNoteHeading,
  appendTaskToDailyNote,
  appendTaskToWeeklyNote,
  appendTextToDailyJournal,
  prependTaskToDailyNote,
  appendTaskToNote,
  prependTaskToNote
} from './quickCapture'

const configKey = 'inbox'

/**
 * Runs every time the plugin starts up (any command in this plugin is run)
 */
export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
// refactor previous variables to new types
export async function onUpdateOrInstall(): Promise<void> {
  try {
    log(pluginJson, `${configKey}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    log(pluginJson, `${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  log(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}
