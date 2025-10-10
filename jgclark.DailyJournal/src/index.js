// @flow

//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// last update 2025-10-10 for v1.0.0 by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
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
  todayStart,
  weekStart,
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

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onUpdateOrInstall started`)
    // Tell user the plugin has been updated
    await updateSettingData(pluginJson)
    await pluginUpdated(pluginJson, { code: 2, message: `Plugin Installed.` })
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
