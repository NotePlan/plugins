// @flow

// -----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// last changed 3.6.2022 for v0.13.1, @jgclark
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { log, logError } from '@helpers/dev'
// settings
import { migrateConfiguration, updateSettingData } from '@helpers/NPconfiguration'
export { countAndAddDays } from './countDays'

export {
  convertToFrontmatter,
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
export { indexFolders } from './indexFolders'

const configKey = 'noteHelpers'

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    log(pluginJson, `${configKey}: onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(configKey, pluginJson, config?.silent)
    log(pluginJson, `${configKey}: onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
      const updateSettings = updateSettingData(pluginJson)
      log(pluginJson, `${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  log(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}
