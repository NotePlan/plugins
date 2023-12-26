// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// Jonathan Clark
// Last updated 26.12.2023 for v0.13.0, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
// import { generateCSSFromTheme } from '@helpers/HTMLView'
import pluginJson from '../plugin.json'
import { getReviewSettings } from './reviewHelpers'
import { makeFullReviewList, renderProjectLists } from './reviews'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { editSettings } from '@helpers/NPSettings'

export {
  logFullReviewList,
  makeFullReviewList,
  startReviews,
  // nextReview,
  finishReview,
  finishReviewAndStartNextReview,
  skipReview,
  makeProjectLists,
  redisplayProjectListHTML,
  renderProjectLists,
  toggleDisplayFinished,
  toggleDisplayOnlyOverdue
} from './reviews'
export {
  addProgressUpdate,
  completeProject,
  cancelProject,
  togglePauseProject
} from './projects'
export {
  generateCSSFromTheme
} from '@helpers/NPThemeToCSS'
// export {
//   setHTMLWinHeight,
// } from '@helpers/NPWindows'

// An earlier version had some functions in projectLists.js, but they had to be moved because of dependency issues.

// Note: There are other possible exports, including:
export { testFonts } from '../experiments/fontTests.js'

export {
  testGenerateCSSFromTheme,
  testButtonTriggerCommand,
  testButtonTriggerOpenNote,
  testCSSCircle,
  testRedToGreenInterpolation,
} from './HTMLtests'

const pluginID = 'jgclark.Reviews'

export async function init(): Promise<void> {
  try {

    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message. Do this in the background.
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )

    // Check that np.Shared plugin is installed, and if not, then install it and show a message. Do this in the background (asynchronously).
    DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, false)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function testSettingsUpdated(): Promise<void> {
  await onSettingsUpdated()
}

export async function onSettingsUpdated(): Promise<void> {
  // Update the full - review - list in case there's a change in a relevant setting
  logInfo(pluginID, 'Have updated settings, so will recalc the review list and display...')
  const config = await getReviewSettings()
  await makeFullReviewList(config, true)
  // TODO: this actually generates errors, as Editor and HTMLView disappear at this point!
  await renderProjectLists(config)
}

export async function onUpdateOrInstall(forceUpdated: boolean = false): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall ...`)
    let updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData code: ${updateSettingsResult}`)

    if (forceUpdated) {
      logInfo('', `- Forcing pluginUpdated() ...`)
      updateSettingsResult = 1
    }
    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'unused?' })

  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished`)
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
