// @flow

import pluginJson from '../plugin.json'

import { logError } from '@np/helpers/dev'

import NPGlobals from 'NPGlobals'

// eslint-disable-next-line
export async function onUpdateOrInstall(config: any = { silent: false }): Promise<void> {
  try {
    const pluginSettingsData = await DataStore.loadJSON(`../${pluginJson['plugin.id']}/settings.json`)
    // if we don't have settings, this will be a first time install so we will perform migrations
    if (typeof pluginSettingsData == 'undefined') {
      // do work here
    }

    // ===== PLUGIN SPECIFIC SETTING UPDATE CODE
    // this will be different for all plugins, you can do whatever you wish to configuration
    const templateSettings = await NPGlobals.updateOrInstall(DataStore.settings, pluginJson['plugin.version'])

    // set application settings with any adjustments after template specific updates
    DataStore.settings = { ...templateSettings }
  } catch (error: any) {
    logError(pluginJson, error)
  }
}
