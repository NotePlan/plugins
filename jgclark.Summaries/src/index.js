// @flow

//-----------------------------------------------------------------------------
// Summary plugin commands
// Jonathan Clark
// Last updated 16.11.2022 for v0.16.0
//-----------------------------------------------------------------------------

export {
  testHeatMapGeneration1,
  testHeatMapGeneration2,
  testHeatMapGeneration3,
} from './testCharting'
export {
  showTaskCompletionHeatmap,
  testGenStats,
  weeklyStats,
  weeklyStats2
} from './forCharting'
export {
  makeProgressUpdate,
  progressUpdate
} from './progress'
export { statsPeriod } from './stats'

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { updateJSONForFunctionNamed } from '@helpers/NPPresets'
import {
  getPluginJson,
  getSettings,
  pluginUpdated,
  savePluginJson,
  semverVersionToNumber,
  updateSettingData
} from '@helpers/NPConfiguration'
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
    logInfo('onSettingsUpdated', `Starting with _logLevel ${logLevel}`)
    // clo(initialPluginJson, 'initialPluginJson')

    let updatedPluginJson = initialPluginJson
    if (initialPluginJson) {
      const commands = updatedPluginJson['plugin.commands']
      clo(commands, 'commands')
      let testCommands = commands.filter((command) => {
        const start = command.name.slice(0, 4)
        return start === 'test'
      })
      logInfo('onSettingsUpdated', `- found ${testCommands.length} test commands`)

      // WARNING: savePluginJson causes an infinite loop!
      // WARNING: So all these lines are commented out.
      // if (logLevel === 'DEBUG') {
      //   for (let command of testCommands) {
      //     updatedPluginJson = updateJSONForFunctionNamed(updatedPluginJson, command, false)
      //   }
      //   clo(updatedPluginJson, `updatedPluginJson after unhiding:`)
      // }
      // else {
      //   for (let command of testCommands) {
      //     updatedPluginJson = updateJSONForFunctionNamed(updatedPluginJson, command, true)
      //   }
      //   clo(updatedPluginJson, `updatedPluginJson after hiding:`)

      // }
      // logDebug('onSettingsUpdated', `- before savePluginJson ...`)

      // await savePluginJson(pluginJson['plugin.id'], updatedPluginJson)
      // logDebug('onSettingsUpdated', `  - NOT CALLED OTHERWISE AN INFINITE LOOP!`)
    }
  }
  catch (error) {
    logError('onSettingsUpdated', error.message)
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

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
}
