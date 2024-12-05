// @flow
//-----------------------------------------------------------------------------
// Tidy plugin
// Jonathan Clark
// Last updated 7.6.2024 for v0.14.0, @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@np/helpers/dev'
import { pluginUpdated, updateSettingData } from '@np/helpers/NPConfiguration'
import { editSettings } from '@np/helpers/NPSettings'

const pluginID = 'np.Tidy'

export {
  logNotesChangedInInterval,
  removeDoneMarkers,
  removeOrphanedBlockIDs,
  removeSectionFromAllNotes,
  removeSectionFromRecentNotes,
  removeTriggersFromRecentCalendarNotes,
  removeDoneTimeParts,
  removeBlankNotes,
  tidyUpAll,
  removeTodayTagsFromCompletedTodos,
} from './tidyMain'
export { listConflicts, openConflictSideBySide, resolveConflictWithCurrentVersion, resolveConflictWithOtherVersion } from './conflicts'
export { listDuplicates } from './duplicates'
export { fileRootNotes } from './fileRoot'
export { generateRepeatsFromRecentNotes } from './repeats'
export { listStubs } from './stubs'
export { moveTopLevelTasksInEditor } from './topLevelTasks'
export { listPotentialDoubles, openCalendarNoteInSplit } from './doubledNotes'

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
  } catch (error: any) {
    logError(pluginJson, JSP(error))
  }
}
