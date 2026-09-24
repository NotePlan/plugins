// @flow
// -----------------------------------------------------------------------------
// Canvas View plugin for NotePlan
// Entry point: exports the plugin's commands and lifecycle hooks.
// -----------------------------------------------------------------------------

export { openCanvas, onMessageFromHTMLView } from './NPCanvasView'

import pluginJson from '../plugin.json'
import { updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { logDebug, logError } from '@helpers/dev'

export function init(): void {
  // Placeholder for future startup work (e.g. checking for plugin updates)
}

export function onSettingsUpdated(): void {
  // Nothing to do yet; settings are read fresh on every command run
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, 'onUpdateOrInstall running')
    const updateResult = await updateSettingData(pluginJson)
    await pluginUpdated(pluginJson, { code: updateResult, message: 'Settings updated' })
  } catch (error) {
    logError(pluginJson, `onUpdateOrInstall: ${error.message}`)
  }
}
