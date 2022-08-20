// @flow

//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// Last updated 15.8.2022 for v0.13.0
//-----------------------------------------------------------------------------

export { weeklyStats } from './forPlotting'
export { insertProgressUpdate } from './progress'
export { statsPeriod } from './stats'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { pluginUpdated, semverVersionToNumber, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = "jgclark.Summaries"

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
  logDebug(pluginID, 'starting onSettingsUpdated')
  const newSettings = {}
  const currentSettingData = DataStore.settings
  const updatedPluginVersion = pluginJson["plugin.version"]
  const updatedPluginVersionAsNumber = semverVersionToNumber(updatedPluginVersion)
  logDebug(pluginID, `new version = ${updatedPluginVersion} (${updatedPluginVersionAsNumber})`)

  // ** FOLLOWING IS GETTING READY FOR FUTURE RELEASE **
  // If this was upgrade to v0.13.0 (semver ???)
  // if (updatedPluginVersionAsNumber >= 12288) {
  //   logDebug(pluginID, `Will try to update further settings for v0.12.0 ...`)
  //   // Empty setting 'progressYesNo' has been added automatically
  //   // Empty setting 'progressTotal' has been added automatically
  //   // Empty setting 'progressAverage' has been added automatically
  //   // Default setting 'progressYesNoChars' has been added automatically

  //   const pluginSettings = pluginJson.hasOwnProperty('plugin.settings') ? pluginJson['plugin.settings'] : []
  //   if (pluginSettings === []) {
  //     logError(pluginID, `Cannot find any plugin.settings in ${pluginID}/plugin.json`)
  //     return
  //   }
  //   // Copy 'progressMentions' to new 'progressAll' setting (for now without deleting the original)
  //   // TODO: const progressMentionsSetting = pluginJson.hasOwnProperty('plugin.settings') ? pluginJson['plugin.settings'] : []

  //   // Copy 'progressHashtags' to new 'progressCount' setting (for now without deleting the original)
  //   // TODO:
  //   logDebug(pluginID, `... done.`)
  // }
}

// test the update mechanism, including display to user
export function testUpdate(): void {
  onUpdateOrInstall(true) // force update mechanism to fire
}

export async function onUpdateOrInstall(testUpdate: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (testUpdate) {
      updateSettingsResult = 1 // updated
      logDebug(pluginID, '- forcing pluginUpdated() tu run ...')
    }
    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
}
