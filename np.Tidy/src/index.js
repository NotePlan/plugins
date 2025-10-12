// @flow
//-----------------------------------------------------------------------------
// Tidy plugin
// Jonathan Clark
// Last updated 2025-10-12 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'

const pluginID = 'np.Tidy'

export {
  logNotesChangedInInterval,
  removeBlankNotes,
  removeDoneMarkers,
  removeDoneTimeParts,
  removeOrphanedBlockIDs,
  removeTodayTagsFromCompletedTodos,
  removeTriggersFromRecentCalendarNotes,
  tidyUpAll,
} from './tidyMain'
export { listConflicts, openConflictSideBySide, resolveConflictWithCurrentVersion, resolveConflictWithOtherVersion } from './conflicts'
export { listPotentialDoubles } from './doubledNotes'
export { listDuplicates } from './duplicates'
export { removeEmptyElements } from './emptyElements'
export { fileRootNotes } from './fileRoot'
export { generateRepeatsFromRecentNotes } from './repeats'
export { removeSectionFromAllNotes, removeSectionFromRecentNotes } from './removeSections'
export { listStubs } from './stubs'
export { moveTopLevelTasksInEditor } from './topLevelTasks'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export { onUpdateOrInstall, init, onSettingsUpdated } from './triggers-hooks'
export { openCalendarNoteInSplit } from '@helpers/NPWindows'

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
