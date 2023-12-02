// @flow

// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// Last updated 22.3.2023, for v1.1.0+
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError, logWarn, timer } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export {
  moveParas,
  moveParaBlock,
  moveParasToCalendarDate,
  moveParasToCalendarWeekly,
  moveParasToNextWeekly,
  moveParasToThisWeekly,
  moveParasToToday,
  moveParasToTomorrow,
} from './moveItems'
export {
  copyNoteLinks,
  copyRecentNoteLinks,
  moveNoteLinks,
  moveRecentNoteLinks,
} from './noteLinks'
export { addIDAndAddToOtherNote } from './IDs'
export { archiveNoteUsingFolder } from './archive'
export { newNoteFromClipboard, newNoteFromSelection } from './newNote'

const pluginID = "jgclark.Filer"

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
    //   pluginUpdated(pluginJson, r),
    // )
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // empty, but avoids NotePlan error
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginID, error.message)
  }
}

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
