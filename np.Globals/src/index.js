// @flow

import pluginJson from '../plugin.json'

import NPGlobals from 'NPGlobals'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData } from '@helpers/NPconfiguration'

export async function onUpdateOrInstall(): Promise<void> {
  updateSettingData(pluginJson)
}
