/* eslint-disable require-await */
// @flow

//---------------------------------------------------------------
// Window Sets commands
// Jonathan Clark
// Last updated 15.3.2024 for v1.2.0 by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import * as wsh from './WTHelpers'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@np/helpers/NPConfiguration'

const pluginID = 'jgclark.WindowTools'

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
  moveCurrentSplitToMain,
  swapSplitWindows
} from './otherWindowTools'

export {
  logWindowSets,
  onEditorWillSave,
  readWindowSetDefinitions,
  writeWSNoteToPrefs,
  writeWSsToNote,
} from './WTHelpers'

export {
  logPreferenceAskUser,
  unsetPreferenceAskUser,
} from '@np/helpers/NPdev'

export {
  logWindowsList,
  setEditorSplitWidth,
} from '@np/helpers/NPWindows'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error: any) {
    logError(pluginJson, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {
  return // Placeholder only to try to stop error in logs
}

export async function testUpdate(): Promise<void> {
  await onUpdateOrInstall(true)
  return
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (testUpdate) {
      updateSettingsResult = 1 // updated
      logInfo(pluginID, '- forcing pluginUpdated() to run ...')
    }

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

    // Test to see if we have any saved window sets (if this is an upgrade)
    // If we don't, this will offer to add some.
    const saved = await wsh.readWindowSetDefinitions()
    if (saved.length > 0) {
      await wsh.logWindowSets()
    // } else {
    //   logInfo('WT / onUpdateOrInstall', `No saved WindowSet definitions found. Will offer to add some example ones.`)
    //   await wsh.offerToAddExampleWSs()
    }
    return // Placeholder only to try to stop error in logs
  } catch (error: any) {
    logError(pluginID, `onUpdateOrInstall: ${error.message}`)
  }
}
