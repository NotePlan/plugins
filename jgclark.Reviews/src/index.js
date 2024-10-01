// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// by Jonathan Clark
// Last updated 2024-09-30 for v1.0.0.b1, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
// import { generateCSSFromTheme } from '@helpers/HTMLView'
import pluginJson from '../plugin.json'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import {
  renderProjectLists
} from './reviews'
import {
  generateAllProjectsList,
  // makeFullReviewList,
} from './reviewListHelpers'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { editSettings } from '@helpers/NPSettings'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

export {
  finishReview,
  finishReviewAndStartNextReview,
  makeProjectLists, // TODO: rename to displayProjectLists
  // nextReview,
  redisplayProjectListHTML,
  renderProjectLists,
  skipReview,
  startReviews,
  toggleDisplayFinished,
  toggleDisplayOnlyDue
} from './reviews'
export {
  generateAllProjectsList,
  getNextNoteToReview, //  TODO: remove in time
  getNextProjectsToReview, //  TODO: remove in time
  logAllProjectsList,
  logFullReviewList,
  // makeFullReviewList,
} from './reviewListHelpers'
export { removeAllDueDates } from '@helpers/NPParagraph'
export {
  addProgressUpdate,
  completeProject,
  cancelProject,
  togglePauseProject
} from './projects'
export {
  generateCSSFromTheme
} from '@helpers/NPThemeToCSS'

// Note: There are other possible exports, including:
export { testFonts } from '../experiments/fontTests.js'
export {
  testGenerateCSSFromTheme,
  testButtonTriggerCommand,
  testButtonTriggerOpenNote,
  testCSSCircle,
  testRedToGreenInterpolation,
} from './HTMLtests'
export { onMessageFromHTMLView } from './pluginToHTMLBridge' // TODO: is this needed?
const pluginID = 'jgclark.Reviews'

export function init(): void {
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
  logDebug(pluginID, 'Have updated settings, so will recalc the review list and display...')
  const config: ReviewConfig = await getReviewSettings()

  // await makeFullReviewList(config, true)
  await generateAllProjectsList(config, true)

  // If v3.11+, can now refresh Dashboard
  if (NotePlan.environment.buildVersion >= 1181) {
    if (isHTMLWindowOpen(pluginJson['plugin.id'])) {
      logDebug(pluginJson, `will refresh Project List as it is open`)
      await renderProjectLists(config)
    }
  }
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
