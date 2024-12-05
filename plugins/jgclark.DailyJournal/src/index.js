// @flow

//---------------------------------------------------------------
// Journalling commands
// Jonathan Clark
// Last updated 16.6.23 for v0.15.1 by @jgclark
//---------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export {
  dayStart,
  todayStart,
  weekStart,
  monthStart,
  dailyJournalQuestions,
  weeklyJournalQuestions,
  monthlyJournalQuestions,
  quarterlyJournalQuestions,
  yearlyJournalQuestions,
} from './journal'

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

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const pluginID = 'jgclark.DailyJournal'

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
      logDebug(pluginID, '- forcing pluginUpdated() to run ...')
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
