// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark
// Last updated 1.5.2022 for v0.6.3, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { migrateConfiguration, updateSettingData } from '../../helpers/NPConfiguration'
import { log, logError } from '../../helpers/dev'

export { logReviewList, projectLists, startReviews, nextReview, finishReview } from './reviews'

export { completeProject, cancelProject } from './projects'

const configKey = 'review'

export function init(): void {
  // Placeholder only
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    log(configKey, `onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(configKey, pluginJson, config?.silent)
    log(configKey, `onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
      const updateSettings = updateSettingData(pluginJson)
      log(configKey, `onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    }
  } catch (error) {
    logError(configKey, error)
  }
  log(configKey, `onUpdateOrInstall finished`)
}
