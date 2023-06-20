// @flow
//-----------------------------------------------------------------------------
// Tidy plugin
// Jonathan Clark
// Last updated 15.6.2023 for v0.6.0, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

const pluginID = 'np.Tidy'

export {
  fileRootNotes
} from './fileRoot'

export {
  logNotesChangedInInterval,
  removeDoneMarkers,
  removeOrphanedBlockIDs,
  removeSectionFromAllNotes,
  removeSectionFromRecentNotes,
  removeTriggersFromRecentCalendarNotes,
  removeDoneTimeParts,
  removeBlankNotes,
  tidyUpAll
} from './tidyMain'

export { showDuplicates } from './duplicates'
export {
  resolveConflictWithCurrentVersion, resolveConflictWithOtherVersion,
  showConflicts
} from './conflicts'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export { onUpdateOrInstall, init, onSettingsUpdated } from './triggers-hooks'

// Note: not yet written or used:
// export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings() {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
