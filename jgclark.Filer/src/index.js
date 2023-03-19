// @flow

// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// Last updated 18.3.2023, for v1.1.0-beta
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
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
export { updateSettings } from './filerHelpers'
export { addIDAndAddToOtherNote } from './IDs'
export { newNoteFromClipboard, newNoteFromSelection } from './newNote'

const pluginID = "jgclark.Filer"

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

export function onSettingsUpdated(): void {
  // empty, but avoids NotePlan error
}

// test the update mechanism, including display to user
export function testUpdate(): void {
  onUpdateOrInstall(true) // force update mechanism to fire
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    logDebug(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (testUpdate) {
      updateSettingsResult = 1 // updated
      logDebug(pluginID, '- forcing pluginUpdated() to run ...')
    }

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })
    logDebug(pluginID, `- finished`)

  } catch (error) {
    logError(pluginID, error.message)
  }
}
