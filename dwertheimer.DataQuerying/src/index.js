// @flow

import pluginJson from '../plugin.json'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData } from '@helpers/NPconfiguration'

export { searchTest } from './support/fuse-helpers'
export { buildIndex, writeIndex, searchUserInput, searchButShowTitlesOnly } from './NPDataQuerying'

export async function onUpdateOrInstall(): Promise<void> {
  updateSettingData(pluginJson)
}
