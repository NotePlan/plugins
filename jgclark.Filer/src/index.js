// @flow

// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// Last updated 25.6.2022, for v0.8.0
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, log, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export {
  moveParas,
  moveParasToCalendarDate,
  moveParasToCalendarWeekly,
  moveParasToNextWeekly,
  moveParasToThisWeekly,
  moveParasToToday,
  moveParasToTomorrow,
} from './fileItems'
export { addIDAndAddToOtherNote } from './IDs'
export { newNoteFromClipboard, newNoteFromSelection } from './newNote'

const configKey = "filer"

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
