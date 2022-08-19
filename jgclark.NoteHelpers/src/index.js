// @flow

// -----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// last updated 27.6.2022 for v0.15.0, @jgclark
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { log, logError } from '@helpers/dev'
import { updateSettingData } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

export { convertNoteToFrontmatter } from '@helpers/NPnote'
export { countAndAddDays } from './countDays'
export { indexFolders } from './indexFolders'
export {
  jumpToDone,
  jumpToHeading,
  jumpToNoteHeading,
  convertLocalLinksToPluginLinks,
  moveNote,
  openCurrentNoteNewSplit,
  openNoteNewWindow,
  openNoteNewSplit,
  renameNoteFile,
} from './noteHelpers'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

const configKey = 'noteHelpers'

export async function onUpdateOrInstall(): Promise<void> {
  try {
    log(pluginJson, `${configKey}: onUpdateOrInstall running`)
    // Try updating settings data
    const updateSettings = updateSettingData(pluginJson)
    log(pluginJson, `${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== 'undefined') {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks',
        `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`
      )
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  log(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}
