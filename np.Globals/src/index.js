// @flow

import pluginJson from '../plugin.json'

import NPGlobals from 'NPGlobals'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData, getSetting } from '@helpers/NPconfiguration'

export async function onUpdateOrInstall(): Promise<void> {
  const result = updateSettingData(pluginJson)

  // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
  // this will be different for all plugins, you can do whatever you wish to configuration
  const templateSettings = await NPGlobals.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

  // set application settings with any adjustments after template specific updates
  DataStore.settings = { ...templateSettings }
}
