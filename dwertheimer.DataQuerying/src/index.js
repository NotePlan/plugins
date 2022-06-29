// @flow

import pluginJson from '../plugin.json'

// updateSettingsData will execute whenever your plugin is installed or updated
import { updateSettingData } from '@helpers/NPConfiguration'

export { searchTest } from './support/fuse-helpers'
export {
  buildIndex,
  writeIndex,
  searchUserInput,
  searchButShowTitlesOnly,
  searchMatchingLines,
  searchSaveUserInput,
} from './NPDataQuerying'
export { runSearch } from './NPRunSearch'

export async function onUpdateOrInstall(): Promise<void> {
  updateSettingData(pluginJson)
}
