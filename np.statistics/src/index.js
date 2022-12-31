// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark & Eduard Metzger
// Last updated 30.12.202 for v0.6.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { log } from "@helpers/dev"
import { updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { showNoteCount } from './showNoteCount'
export { showWordCount } from './showWordCount'
export { showTaskCountForAll, showTaskCountForNote } from './taskNoteStats'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

const pluginID = "np.statistics"

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder to avoid complaints
}

// refactor previous variables to new types
export async function onUpdateOrInstall(): Promise<void> {
  try {
    log(pluginJson, `${pluginID}: onUpdateOrInstall running`)
    const updateSettings = updateSettingData(pluginJson)
    log(pluginJson, `${pluginID}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']} updated to v${pluginJson['plugin.version']}`
      )
    }
    log(pluginJson, `${pluginID}: onUpdateOrInstall finished`)
  } catch (error) {
    log(pluginJson, error)
  }
}
