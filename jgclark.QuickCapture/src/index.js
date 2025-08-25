/* eslint-disable require-await */
// @flow
//-----------------------------------------------------------------------------
// Quick Capture plugin for NotePlan
// Jonathan Clark
// Last updated 2025-08-08 for v0.17.0, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logInfo, logError } from "@helpers/dev"
// import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { insertParas, smartAppendParas, smartCreateSectionsAndPara, smartPrependParas } from '@helpers/paragraph'
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
export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    // Note: turned off, as it was causing too much noise in logs
    // DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
    //   pluginUpdated(pluginJson, r),
    // )
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
 * To test function paragraph::smartCreateSectionsAndPara()
 * Assumes a note titled 'Quick Capture qalh TEST'
 */
export async function smartCreateTest(): Promise<void> {
  // $FlowIgnore[incompatible-use]
  const note: TNote = DataStore.projectNoteByTitle('Quick Capture callback TESTs', false, false)[0]
  smartCreateSectionsAndPara(
    note,
    'test_text_addeed_below_heading by tempSmartCreateTest()',
    'list',
    ['Head E', 'Subhead EE'],
    2,
    false,
  )
}

/**
 * To test function paragraph::smartAppendParas()
 * Assumes a note titled 'Quick Capture qalh TEST'
 */
export async function smartAppendParasTest(): Promise<void> {
  // $FlowIgnore[incompatible-use]
  const note: TNote = DataStore.projectNoteByTitle('Quick Capture callback TESTs', false, false)[0]
  smartAppendParas(
    note,
    ['test adding list by smartAppendParas()', 'test adding text by smartAppendParas()', 'test adding checklist by smartAppendParas()'],
    ['list', 'text', 'checklist'],
  )
}

/**
 * To test function paragraph::smartPrependParas()
 * Assumes a note titled 'Quick Capture qalh TEST'
 */
export async function smartPrependParasTest(): Promise<void> {
  // $FlowIgnore[incompatible-use]
  const note: TNote = DataStore.projectNoteByTitle('Quick Capture callback TESTs', false, false)[0]
  smartPrependParas(
    note,
    ['test adding list by smartPrependParas()', 'test adding text by smartPrependParas()', 'test adding checklist by smartPrependParas()'],
    ['list', 'text', 'checklist'],
  )
}

/**
 * To test function paragraph::insertParas()
 * Assumes a note titled 'Quick Capture qalh TEST'
 */
export async function insertParasTest(): Promise<void> {
  // $FlowIgnore[incompatible-use]
  const note: TNote = DataStore.projectNoteByTitle('Quick Capture callback TESTs', false, false)[0]
  insertParas(
    note,
    4,
    ['test adding list by insertParas()', 'test adding text by insertParas()', 'test adding checklist by insertParas()'],
    ['list', 'text', 'checklist'],
  )
}
