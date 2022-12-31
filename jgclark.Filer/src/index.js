// @flow

// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// Last updated 17.8.2022, for v1.0.0-beta1
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
} from './fileItems'
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

    // Test to see if np.Globals has been installed
    // TODO:
    const allPlugins = DataStore.listPlugins()
    const installedPlugins = DataStore.installedPlugins()
    logDebug(pluginID, `- ${installedPlugins.length} / ${allPlugins.length}  plugins installed`)
    const globalsInstalled = installedPlugins.filter((p) => p.id === 'np.Globals')
    logDebug(pluginID, `- includes ${String(globalsInstalled.length)} np.Globals`)
    if (globalsList.length === 0) {
      // If not, ask user to install it
      // TODO: check first
      const globalPluginObjects = allPlugins.filter((p) => p.id === 'np.Globals')
      const globalPluginObject = globalPluginObjects[0]
      clo(globalPluginObject)
      await DataStore.installPlugin(globalPluginObject, true)
    }

    logDebug(pluginID, `- finished`)

  } catch (error) {
    logError(pluginID, error.message)
  }
}
