// @flow

//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2026-10-07 for v1.15.0+ by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { renameKeys } from '@helpers/dataManipulation'
import { clo, compareObjects, JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { backupSettings, pluginUpdated, saveSettings } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

const pluginID = 'jgclark.DailyJournal'

export {
  dailyJournalQuestions,
  weeklyJournalQuestions,
  monthlyJournalQuestions,
  quarterlyJournalQuestions,
  yearlyJournalQuestions,
} from './journal'

export {
  dayStart,
  dayEnd,
  todayStart,
  todayEnd,
  weekStart,
  weekEnd,
  monthStart,
} from './templatesStartEnd'

export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false)
  } catch (error) {
    logError(pluginJson, `init: ${JSP(error)}`)
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `onUpdateOrInstall() ...`)
    await backupSettings(pluginID, `before_onUpdateOrInstall-v${pluginJson['plugin.version']}`)

    // Tell user the plugin has been updated
    logInfo(pluginID, `- finished`)
    await pluginUpdated(pluginJson, { code: 2, message: `Plugin Installed or Updated.` })
  } catch (error) {
    logError(pluginID, `onUpdateOrInstall: ${JSP(error)}`)
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
