// @flow

import pluginJson from '../plugin.json'

import { log, logError, clo } from '@helpers/dev'
import { getSetting } from '@helpers/NPConfiguration'
import { updateSettingData } from '@helpers/NPconfiguration'

import NPGlobals from 'NPGlobals'

export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    // if we don't have settings, this will be a first time install so we will perform migrations
    if (typeof pluginSettingsData == 'undefined') {
    }

    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateSettings = await NPGlobals.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    // set application settings with any adjustments after template specific updates
    DataStore.settings = { ...templateSettings }
  } catch (error) {
    logError(pluginJson, error)
  }
}
