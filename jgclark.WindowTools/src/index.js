// @flow

//---------------------------------------------------------------
// Window Sets commands
// Jonathan Clark
// Last updated 2.1.2024 for v1.0.0 by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import * as ws from './windowSets'
import * as wsh from './WTHelpers'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = 'jgclark.WindowSets'

export {
  saveWindowSet,
  openWindowSet,
  deleteWindowSet,
  deleteAllSavedWindowSets,
} from './windowSets'

export {
  openCurrentNoteNewSplit,
  openCurrentNoteNewWindow,
  openNoteNewWindow,
  openNoteNewSplit,
} from './openers'

export {
  constrainMainWindow,
  moveCurrentSplitToMain
} from './otherWindowTools'

export {
  logWindowSets,
  readWindowSetDefinitions,
  syncWSNoteToPrefs,
  writeWSNoteToPrefs,
  writeWSsToNote,
} from './WTHelpers'

export {
  logPreferenceAskUser,
  unsetPreferenceAskUser,
} from '@helpers/NPdev'

export {
  logWindowsList,
  setEditorSplitWidth,
} from '@helpers/NPWindows'

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

export async function onSettingsUpdated(): Promise<void> {
  return // Placeholder only to try to stop error in logs
}

export async function testUpdate(): Promise<void> {
  onUpdateOrInstall(true)
  return
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (testUpdate) {
      updateSettingsResult = 1 // updated
      logDebug(pluginID, '- forcing pluginUpdated() to run ...')
    }

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

    // Test to see if we have any saved window sets (if this is an upgrade)
    const savedWindowSets = await wsh.readWindowSetDefinitions()
    if (savedWindowSets.length === 0) {
      logInfo('onUpdateOrInstall', `No saved windowSets object found. Will offer to add some example ones.`)
      await wsh.offerToAddExampleWSs()
    }
    return // Placeholder only to try to stop error in logs
  } catch (error) {
    logError(pluginID, `onUpdateOrInstall: ${error.message}`)
  }
}
