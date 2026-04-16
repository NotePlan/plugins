// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// by Jonathan Clark
// Last updated 2026-04-16 for v2.0.0.b19, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { generateAllProjectsList } from './allProjectsListHelpers'
import { getReviewSettings } from './reviewHelpers'
import { renderProjectListsIfOpen } from './reviews'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { editSettings } from '@helpers/NPSettings'

export {
  finishReview,
  finishReviewAndStartNextReview,
  generateProjectListsAndRenderIfOpen,
  displayProjectLists,
  nextReview,
  redisplayProjectListHTML,
  renderProjectLists,
  renderProjectListsIfOpen,
  toggleDemoModeForProjectLists,
  setNewReviewInterval,
  skipReview,
  startReviews,
  toggleDisplayFinished,
  toggleDisplayOnlyDue,
  toggleDisplayNextActions
} from './reviews'
export {
  generateAllProjectsList,
  getNextNoteToReview,
  getNextProjectsToReview,
  logAllProjectsList
} from './allProjectsListHelpers'
// export { NOP } from './reviewHelpers'
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
export {
  writeProjectsWeeklyProgressToCSV,
  showProjectsWeeklyProgressHeatmaps
} from './projectsWeeklyProgress'

// Note: There are other possible exports, including:
export { testFonts } from '../experiments/fontTests.js'
export { onMessageFromHTMLView } from './pluginToHTMLBridge' 

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
  // Re-generate the allProjects list in case there's a change in a relevant setting (same as displayProjectLists).
  // Only refresh the project list window if it is already open; do not open it from saving settings alone.
  try {
    const config = await getReviewSettings()
    if (!config) throw new Error('No config found. Stopping.')
    logDebug(pluginJson, 'Have updated Review settings; recalculating review list and refreshing project list UI if already open...')
    if (!(config.useDemoData ?? false)) {
      await generateAllProjectsList(config, true)
    }
    await renderProjectListsIfOpen(config)
  } catch (error) {
    logError(pluginJson, JSP(error))
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
