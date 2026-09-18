// @flow

//-----------------------------------------------------------------------------
// Index for Reviews plugin
// by Jonathan Clark
// Last updated 2026-09-18 for v2.3.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { generateAllProjectsList, recalculateAllProjectsListItems } from './allProjectsListHelpers'
import { migrateAllProjects } from './migration'
import { renderProjectListsIfOpen } from './reviews'
import {
  getLastSettingsSnapshot,
  getReviewSettings,
  getSettingsUpdateAction,
  persistLastSettingsSnapshot,
  seedLastSettingsSnapshotIfMissing,
} from './reviewSettings'
import { JSP, compareObjects, logDebug, logError, logInfo } from '@helpers/dev'
import { backupSettings, pluginUpdated, saveSettings, updateSettingData } from '@helpers/NPConfiguration'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

export { getReviewSettings } from './reviewSettings' // Keep exported while hidden test:getReviewSettings command exists
export {
  finishReview,
  finishReviewAndStartNextReview,
  generateProjectListsAndRenderIfOpen,
  onDashboardFolderFiltersChanged,
  displayProjectLists,
  nextReview,
  redisplayProjectListHTML,
  renderProjectLists,
  renderProjectListsIfOpen,
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
  logAllProjectsList,
  recalculateAllProjectsListItems,
} from './allProjectsListHelpers'
export { migrateAllProjects } from './migration'
// export { NOP } from './reviewHelpers'
export { removeAllDueDates } from '@helpers/NPParagraph'
export {
  addProgressUpdate,
  completeProject,
  cancelProject,
  togglePauseProject
} from './projects'
export { convertToProject, createNewProject } from './newProject.js'
export {
  generateCSSFromTheme
} from '@helpers/NPThemeToCSS'
export {
  writeProjectsWeeklyProgressToCSV,
  showProjectsWeeklyProgressHeatmaps
} from './projectsWeeklyProgress'

// Note: Previously there were some test functions exported, including:
// export { testFonts } from '../experiments/fontTests.js'
export { onMessageFromHTMLView } from './pluginToHTMLBridge' 

const pluginID = 'jgclark.Reviews'

/**
 * Migrate legacy progressHeading + progressHeadingLevel into a single markdown heading string.
 * @param {{ [string]: any }} settings
 * @returns {{ [string]: any }}
 */
function migrateProgressHeadingSetting(settings: { [string]: any }): { [string]: any } {
  const migrated = { ...settings }
  const rawHeading = typeof migrated.progressHeading === 'string' ? migrated.progressHeading.trim() : ''
  const oldLevel = migrated.progressHeadingLevel

  if (oldLevel !== undefined || (rawHeading !== '' && !/^#{1,5}\s+/.test(rawHeading))) {
    if (rawHeading !== '' && !/^#{1,5}\s+/.test(rawHeading)) {
      const level = Math.min(5, Math.max(1, Number(oldLevel) || 2))
      migrated.progressHeading = `${'#'.repeat(level)} ${rawHeading}`
    }
    delete migrated.progressHeadingLevel
  }
  return migrated
}

/**
 * Open this plugin's settings pane in NotePlan Preferences.
 * Used by the Rich list top-bar and empty-state gear controls, and the hidden "/Projects: update plugin settings" command.
 * @returns {Promise<void>}
 */
export async function openSettings(): Promise<void> {
  try {
    logDebug(pluginJson, `openSettings: opening plugin configuration view`)
    await NotePlan.showConfigurationView()
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

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
  // Compare the newly saved raw settings.json against the last snapshot, then:
  // - rebuild the allProjects list when review-scope or metadata-term settings changed
  // - recalculate existing list rows when next-action or progress-calculation settings changed
  // - redisplay open project lists when only display settings changed
  // - otherwise do neither
  // Only refresh the project list window if it is already open; do not open it from saving settings alone.
  try {
    const rawSettings: { [string]: any } = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    if (rawSettings == null || Object.keys(rawSettings).length === 0) {
      throw new Error(`Can't get Review settings. Stopping.`)
    }

    const previousRaw = getLastSettingsSnapshot()
    const action = getSettingsUpdateAction(previousRaw, rawSettings)
    logInfo(pluginJson, `Have updated Review settings; action='${action}' (previous snapshot ${previousRaw == null ? 'missing' : 'present'})`)

    if (action === 'rebuild' || action === 'recalculate' || action === 'redisplay') {
      const config = await getReviewSettings()
      if (!config) throw new Error(`Can't get Review settings. Stopping.`)
      if (action === 'rebuild') {
        // Skip the write-time Rich-list invoke; render once in-process below.
        await generateAllProjectsList(config, true, 0, false, true, true)
      } else if (action === 'recalculate') {
        await recalculateAllProjectsListItems(config, true, 0, false, true)
      }
      await renderProjectListsIfOpen(config)
    }

    persistLastSettingsSnapshot(rawSettings)
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall: starting ...`)
    const initialSettings = (await DataStore.loadJSON(`../${pluginID}/settings.json`)) || DataStore.settings || {}

    // Backup settings on install/update as a v2 safety net (quietly)
    await backupSettings('jgclark.Reviews', `before_onUpdateOrInstall_v${pluginJson["plugin.version"]}`, true)

    const migratedSettings = migrateProgressHeadingSetting(initialSettings)
    const diff = compareObjects(migratedSettings, initialSettings, [], true)
    if (diff != null) {
      logInfo(pluginID, `- migrated progressHeading setting from legacy progressHeadingLevel`)
      await saveSettings(pluginID, migratedSettings, false)
    }

    const updateSettingsResult = updateSettingData(pluginJson)
    logInfo(pluginID, `- updateSettingData returned code: ${updateSettingsResult}`)

    const settingsAfterUpdate = (await DataStore.loadJSON(`../${pluginID}/settings.json`)) || migratedSettings
    seedLastSettingsSnapshotIfMissing(settingsAfterUpdate)

    // Tell user the plugin has been updated
    await pluginUpdated(pluginJson, { code: updateSettingsResult, message: 'Plugin Installed or Updated.' })

    // Ask user if they want to migrate all projects now, or tell them how to do it manually.
    const decision: string = await showMessageYesNo('v2 of this plugin now stores project metadata in the notes\' frontmatter. Each time you finish a review of a project note, the metadata will be migrated to the frontmatter, and you will get a confirmatory line in the note where the metadata used to be.\nHowever, I can also migrate the metadata for all your projects in one go.\nWould you like me to do this now?\nNote: you can do this later by running the "Migrate all projects" command.', ['Yes', 'No'], 'Reviews v2: metadata migration')
    if (decision === 'Yes') {
      await migrateAllProjects()
    } else {
      logInfo(pluginID, `- user chose not to migrate all projects now.`)
      await showMessage('You can migrate all projects manually by running the "/Migrate all projects" command. In the meantime, each note will be migrated individually when you finish reviewing it.', 'OK', 'Reviews v2: metadata migration')
    }
  } catch (error) {
    logError(pluginID, error.message)
  }
  logInfo(pluginID, `- finished.`)
}
