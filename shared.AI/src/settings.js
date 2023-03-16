// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { editSettings } from '@helpers/NPSettings'

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/NotePlan AI: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
