// @flow
import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { /* getPluginJson ,*/ updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'
import { rememberPresetsAfterInstall } from '@helpers/NPPresets'

export { editSettings } from '@helpers/NPSettings'

export { setFavorite, openFavorite, removeFavorite } from './NPFavorites'

export {
  changePreset,
  runPreset01,
  runPreset02,
  runPreset03,
  runPreset04,
  runPreset05,
  runPreset06,
  runPreset07,
  runPreset08,
  runPreset09,
  runPreset10,
  runPreset11,
  runPreset12,
  runPreset13,
  runPreset14,
  runPreset15,
  runPreset16,
  runPreset17,
  runPreset18,
  runPreset19,
  runPreset20,
} from './NPFavoritePresets'

/**
 * NotePlan calls this function after the plugin is installed or updated.
 * The `updateSettingData` function looks through the new plugin settings in plugin.json and updates
 * the user preferences to include any new fields
 */
export async function onUpdateOrInstall(): Promise<void> {
  logDebug(pluginJson, 'dwertheimer.Favorites::onUpdateOrInstall running')
  await updateSettingData(pluginJson)
  await rememberPresetsAfterInstall(pluginJson)
}

/**
 * NotePlan calls this function every time the plugin is run (any command in this plugin)
 * You should not need to edit this function. All work should be done in the commands themselves
 */
export function init(): void {
  //   clo(DataStore.settings, `${pluginJson['plugin.id']} Plugin Settings`)
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], true, false, false).then((r) => pluginUpdated(pluginJson, r))
}

export function onSettingsUpdated(): void {
  logDebug(pluginJson, 'dwertheimer.Favorites::onSettingsUpdated called (but this plugin does not do anything after settings are updated)')
}
