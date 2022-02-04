// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark
// Last updated 2022-01-22 for v0.5.3, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

export { projectLists, startReviews, nextReview, finishReview } from './reviews'

export { completeProject, cancelProject } from './projects'

// Moving to ConfigV2
import { migrateConfiguration, updateSettingData } from '../../helpers/NPConfiguration'

const configKey = 'review'

// refactor previous variables to new types
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    console.log(`${configKey}: onUpdateOrInstall running`)
    // migrate _configuration data to data/<plugin>/settings.json (only executes migration once)
    const migrationResult: number = await migrateConfiguration(configKey, pluginJson, config?.silent)
    console.log(`${configKey}: onUpdateOrInstall migrateConfiguration code: ${migrationResult}`)
    if (migrationResult === 0) {
      const updateSettings = updateSettingData(pluginJson)
      console.log(`${configKey}: onUpdateOrInstall updateSettingData code: ${updateSettings}`)
    }
  } catch (error) {
    console.log(error)
  }
  console.log(`${configKey}: onUpdateOrInstall finished`)
}
