/* eslint-disable require-await */
// @flow

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { logError, logDebug, logInfo, logWarn, timer, clo } from '@helpers/dev'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'

const pluginID = 'np.Tidy'

/**
 * NOTEPLAN PER-NOTE TRIGGERS
 *
 * The following functions are called by NotePlan automatically
 * if a note has a triggers: section in its frontmatter
 * See the documentation: https://help.noteplan.co/article/173-plugin-note-triggers
 */

/**
 * onOpen
 * Plugin entrypoint for command: "/onOpen"
 * Called when a note is opened and that note
 * has a triggers: onOpen in its frontmatter
 * @param {TNote} note - current note in Editor
 */
export async function onOpen(note: TNote): Promise<void> {
  try {
    logDebug(pluginJson, `onOpen running for note:"${String(note.filename)}"`)
    // Try to guard against infinite loops of opens/refreshing
    // You can delete this code if you are sure that your onOpen trigger will not cause an infinite loop
    // But the safest thing to do is put your code inside the if loop below to ensure it runs no more than once every 15s
    const now = new Date()
    if (Editor?.note?.changedDate) {
      const lastEdit = new Date(Editor?.note?.changedDate)
      if (now - lastEdit > 15000) {
        logDebug(pluginJson, `onOpen ${timer(lastEdit)} since last edit`)
        // Put your code here or call a function that does the work
      } else {
        logDebug(pluginJson, `onOpen: Only ${timer(lastEdit)} since last edit (hasn't been 15s)`)
      }
    }
  } catch (error) {
    logError(pluginJson, `onOpen: ${error.message}`)
  }
}

/**
 * onEditorWillSave
 * Plugin entrypoint for command: "/onEditorWillSave"
 */
export async function onEditorWillSave() {
  try {
    logDebug(pluginJson, `onEditorWillSave running with note in Editor:"${String(Editor.filename)}"`)
    // Put your code here or call a function that does the work
    // Note: as stated in the documentation, if you want to change any content in the Editor
    // before the file is written, you should NOT use the *note* variable here to change content
    // Instead, use Editor.* commands (e.g. Editor.insertTextAtCursor()) or Editor.updateParagraphs()
  } catch (error) {
    logError(pluginJson, `onEditorWillSave: ${error.message}`)
  }
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin, including triggers)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export function init(): void {
  try {
    // Check for the latest version of the plugin, and if a minor update is available, install it and show a message
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) =>
      pluginUpdated(pluginJson, r),
    )
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
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

export async function testUpdated(): Promise<void> {
  await onUpdateOrInstall(true)
}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {
  // Placeholder only to stop error in logs
  logDebug(pluginJson, `${pluginJson['plugin.id']} :: onSettingsUpdated running`)
}
