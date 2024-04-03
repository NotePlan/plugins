// @flow

//-----------------------------------------------------------------------------
// Quick Capture plugin for NotePlan
// Jonathan Clark
// Last updated 3.4.2024 for v0.16.0+, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError, logWarn } from "@helpers/dev"
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { addJotToInbox, addTaskToInbox } from './inbox'
export {
  addChecklistToNoteHeading,
  addTaskToNoteHeading,
  addTextToNoteHeading,
  appendTaskToCalendarNote,
  appendTaskToWeeklyNote,
  appendTextToDailyJournal,
  appendTextToWeeklyJournal,
  appendTextToMonthlyJournal,
  appendTextToYearlyJournal,
  prependTaskToCalendarNote,
  appendTaskToNote,
  prependTaskToNote
} from './quickCapture'

const pluginID = 'jgclark.QuickCapture'

/**
 * Runs every time the plugin starts up (any command in this plugin is run)
 */
export async function init(): Promise<void> {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    const res = await DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
    if (res.code > 0) {
      logWarn(pluginJson, `init::installOrUpdatePlugins check -> code ${String(res.code)} message ${res.message}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
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

/**
  note.addParagraphBelowHeadingTitle(
 * To test bug with .() API call reported in https://github.com/NotePlan/plugins/issues/429
 * Assumes a note titled 'Quick Capture qalh TEST'
 * TODO(later): remove after bug fixed
 */
export function tempAddParaTest(): void {
  // $FlowIgnore[incompatible-use]
  const note: TNote = DataStore.projectNoteByTitle('Quick Capture callback TESTs', false, false)[0]
  note.addParagraphBelowHeadingTitle(
    "test_text_addeed_below_heading by tempAddParaTest()",
    'text',
    'Head C',
    true,
    false,
  )
}