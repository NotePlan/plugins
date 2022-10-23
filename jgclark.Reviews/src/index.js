// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// Jonathan Clark
// Last updated 23.10.2022 for v0.9.0-betas, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
// import { generateCSSFromTheme } from '@helpers/HTMLView'
import pluginJson from '../plugin.json'
import { makeFullReviewList } from "./reviews";
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logError, logInfo } from '@helpers/dev'

export {
  logFullReviewList,
  makeFullReviewList,
  startReviews,
  nextReview,
  finishReview,
  makeProjectLists,
  redisplayProjectList,
} from './reviews'
export {
  renderProjectListsHTML,
  renderProjectListsMarkdown,
} from './projectLists'
export {
  completeProject,
  cancelProject,
  pauseProject
} from './projects'
export {
  generateCSSFromTheme
} from '@helpers/HTMLView'

// NB: There are other possible exports, including:
// export { testNoteplanStateFont } from '../test/noteplanstateFontTest.js'

export {
  testGenerateCSSFromTheme,
  testButtonTriggerCommand,
  testButtonTriggerOpenNote,
  testCSSCircle,
  testRedToGreenInterpolation,
} from './HTMLtests'

const pluginID = 'jgclark.Reviews'

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

export async function testUpdated(): Promise<void> {
  await onUpdateOrInstall(true)
}

export async function onSettingsUpdated(): Promise<void> {
  // Update the full-review-list in case there's a change in a relevant setting
  await makeFullReviewList(false)
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
