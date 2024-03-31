/* eslint-disable require-await */
// @flow

import pluginJson from '../plugin.json' // gives you access to the contents of plugin.json
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'
const scriptStartTime = new Date()

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
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onOpen running for note:"${String(note.filename)}"`)
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
    logError(pluginJson, `onOpen: ${JSP(error)}`)
  }
}

/**
 * onEditorWillSave
 * Plugin entrypoint for command: "/onEditorWillSave"
 */
export async function onEditorWillSave() {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onEditorWillSave running with note in Editor:"${String(Editor.filename)}"`)
    // Put your code here or call a function that does the work
    // Note: as stated in the documentation, if you want to change any content in the Editor
    // before the file is written, you should NOT use the *note* variable here to change content
    // Instead, use Editor.* commands (e.g. Editor.insertTextAtCursor()) or Editor.updateParagraphs()
  } catch (error) {
    logError(pluginJson, `onEditorWillSave: ${JSP(error)}`)
  }
}

/*
 * NOTEPLAN GLOBAL PLUGIN HOOKS
 *
 * The rest of these functions are called by NotePlan automatically under certain conditions
 * It is unlikely you will need to edit/add anything below this line
 *
 */

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onUpdateOrInstall running`)
    const pluginExists = DataStore.loadJSON(`../../data/${pluginJson['plugin.id']}/settings.json`)
    clo(pluginExists, `${pluginJson['plugin.id']} Plugin Exists=${typeof pluginExists}`)
    await updateSettingData(pluginJson) // update the settings for new settings or write it for the first time if install
    if (!pluginExists) {
      // this is the first install
      await pluginUpdated(pluginJson, { code: 2, message: `onUpdateOrInstall: Plugin Installed` })
    }
  } catch (error) {
    logError(pluginJson, `onUpdateOrInstall: ${JSP(error)}`)
  }
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin, including triggers)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export function init(): void {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: init (tpwd) running; scriptStartTime:${scriptStartTime.getTime()} now:${new Date().getTime()} (${timer(scriptStartTime)})`)
    // clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
    logDebug(pluginJson, `init ${pluginJson['plugin.id']} about to call installOrUpdatePluginsByID`)
    DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false).then((r) => {
      clo(r, `${pluginJson['plugin.id']} Inside installOrUpdatePluginsByID... result=`)
      CommandBar.hide()
      pluginUpdated(pluginJson, r)
    })
  } catch (error) {
    logError(pluginJson, `init: ${JSP(error)}`)
  }
}

/**
 * NotePlan calls this function settings are updated in the Preferences panel
 * You should not need to edit this function
 */
export async function onSettingsUpdated(): Promise<void> {
  try {
    logDebug(pluginJson, `${pluginJson['plugin.id']} :: onSettingsUpdated running`)
  } catch (error) {
    logError(pluginJson, `onSettingsUpdated: ${JSP(error)}`)
  }
}

/**
 * Check the version of the plugin (and force an update if the version is out of date)
 */
export async function versionCheck(): Promise<void> {
  try {
    await showMessage(`Current Version: ${pluginJson['plugin.version']}`, 'OK', `${pluginJson['plugin.name']}`, true)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
