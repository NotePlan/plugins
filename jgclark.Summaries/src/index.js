// @flow

//-----------------------------------------------------------------------------
// Summary plugin commands
// Jonathan Clark
// Last updated 10.10.2023 for v0.20.0
//-----------------------------------------------------------------------------

// export {
//   testHeatMapGeneration1,
//   testHeatMapGeneration2,
//   testHeatMapGeneration3,
// } from './testCharting'
export {
  showTagHeatmap,
  showTaskCompletionHeatmap,
  testJGCHeatmaps,
} from './forHeatmaps'
export {
  testTaskGenStats,
  weeklyStats
} from './forCharts'
export {
  makeProgressUpdate,
  progressUpdate
} from './progress'
export {
  todayProgress,
  todayProgressFromTemplate
} from './todayProgress'
export { statsPeriod } from './stats'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { updateJSONForFunctionNamed } from '@helpers/NPPresets'
import {
  getPluginJson,
  getSettings,
  pluginUpdated,
  // savePluginJson,
  // semverVersionToNumber,
  updateSettingData
} from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
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

export async function onSettingsUpdated(): Promise<void> {
  try {
    logDebug(pluginID, 'starting onSettingsUpdated')

    // See if we need to hide or unhide the test: commands in this plugin, depending whether _logLevel is DEBUG or not
    // Get the commands' details
    const initialPluginJson = await getPluginJson(pluginID)
    const initialSettings = await getSettings(pluginID) ?? `{".logLevel": "INFO"}`
    // $FlowFixMe[incompatible-type]
    const logLevel = initialSettings["_logLevel"]
    // logInfo('onSettingsUpdated', `Starting with _logLevel ${logLevel}`)
    // clo(initialPluginJson, 'initialPluginJson')

    // WARNING: savePluginJson causes an infinite loop!
    // WARNING: So all these lines are commented out.
    // let updatedPluginJson = initialPluginJson
    // if (initialPluginJson) {
    //   const commands = updatedPluginJson['plugin.commands']
    //   clo(commands, 'commands')
    //   let testCommands = commands.filter((command) => {
    //     const start = command.name.slice(0, 4)
    //     return start === 'test'
    //   })
    //   logInfo('onSettingsUpdated', `- found ${testCommands.length} test commands`)

    //   if (logLevel === 'DEBUG') {
    //     for (let command of testCommands) {
    //       updatedPluginJson = updateJSONForFunctionNamed(updatedPluginJson, command, false)
    //     }
    //     clo(updatedPluginJson, `updatedPluginJson after unhiding:`)
    //   }
    //   else {
    //     for (let command of testCommands) {
    //       updatedPluginJson = updateJSONForFunctionNamed(updatedPluginJson, command, true)
    //     }
    //     clo(updatedPluginJson, `updatedPluginJson after hiding:`)

    //   }
    //   logDebug('onSettingsUpdated', `- before savePluginJson ...`)

    //   await savePluginJson(pluginJson['plugin.id'], updatedPluginJson)
    //   logDebug('onSettingsUpdated', `  - NOT CALLED OTHERWISE AN INFINITE LOOP!`)
    // }
  }
  catch (error) {
    logError('jgclark.Summaries::onSettingsUpdated', error.message)
  }
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
    logInfo(pluginID, `- finished`)

  } catch (error) {
    logError('jgclark.Summaries::onUpdateOrInstall', error.message)
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
