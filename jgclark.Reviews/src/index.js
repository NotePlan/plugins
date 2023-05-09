// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// Jonathan Clark
// Last updated 27.02.2023 for v0.9.2, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
// import { generateCSSFromTheme } from '@helpers/HTMLView'
import pluginJson from '../plugin.json'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logError, logInfo } from '@helpers/dev'
import { makeFullReviewList, renderProjectLists } from './reviews'

export {
  logFullReviewList,
  makeFullReviewList,
  startReviews,
  nextReview,
  finishReview,
  skipReview,
  makeProjectLists,
  redisplayProjectListHTML,
  renderProjectLists,
} from './reviews'
export {
  completeProject,
  cancelProject,
  togglePauseProject
} from './projects'
export {
  generateCSSFromTheme
} from '@helpers/HTMLView'
export {
  setHTMLWinHeight,
} from '@helpers/NPWindows'

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

export async function testUpdated(): Promise<void> {
  await onUpdateOrInstall(true)
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder now
  // Update the full - review - list in case there's a change in a relevant setting
  // await makeFullReviewList(false)
  // await renderProjectLists()
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
