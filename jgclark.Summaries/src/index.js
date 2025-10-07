/* eslint-disable require-await */
// @flow
//-----------------------------------------------------------------------------
// Summary plugin commands
// Jonathan Clark
// Last updated 16.2.2024 for v0.21.0
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
  weeklyStatsMermaid,
  weeklyStatsCSV
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
import { renameKeys } from '@helpers/dataManipulation'
import { clo, compareObjects, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { backupSettings, pluginUpdated, saveSettings } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

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
  return
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logInfo(pluginID, `onUpdateOrInstall() ...`)
    const initialSettings = (await DataStore.loadJSON(`../${pluginID}/settings.json`)) || DataStore.settings
    await backupSettings(pluginID, `before_onUpdateOrInstall-v${pluginJson['plugin.version']}`)

    // Migrate any necessary settings from v0.22.x to v1.0.0
    // TODO: also remove old settings: excludeHashtags, excludeMentions
    const keysToChange = {
      // oldKey: newKey
      statsHeading: "PSStatsHeading",
      periodStatsShowSparklines: 'PSShowSparklines',
      showAsHashtagOrMention: "PSHowAsHashtagOrMention",
      periodStatsYesNo: 'PSYesNo',
      periodStatsHashtagsAverage: 'PSHashtagsAverage',
      includeHashtags: 'PSHashtagsCount',
      includedHashtags: 'PSHashtagsCount',
      periodStatsHashtagsTotal: 'PSHashtagsTotal',
      excludeHashtags: 'PSHashtagsToExclude',
      periodStatsMentions: 'PSMentionsCount',
      periodStatsMentionsAverage: 'PSMentionsAverage',
      periodStatsMentionsTotal: 'PSMentionsTotal',
      excludeMentions: 'PSMentionsToExclude',
    }
    const migratedSettings = renameKeys(initialSettings, keysToChange)
    const diff = compareObjects(migratedSettings, initialSettings, [], true)
    if (diff != null) {
      // Save the settings back to the DataStore
      logInfo(`onUpdateOrInstall`, `- changes to settings detected`)
      clo(initialSettings, `onUpdateOrInstall:  initialSettings:`)
      clo(migratedSettings, `onUpdateOrInstall:  migratedSettings:`)
      await saveSettings(pluginID, migratedSettings)
    } else {
      logDebug(`onUpdateOrInstall`, `- no changes detected to settings.`)
    }

    // Tell user the plugin has been updated
    logInfo(pluginID, `- finished`)
    await pluginUpdated(pluginJson, { code: 1, message: 'Plugin Installed or Updated.' }) // unused?
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
