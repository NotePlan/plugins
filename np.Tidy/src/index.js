// @flow
//-----------------------------------------------------------------------------
// Tidy plugin
// Jonathan Clark
// Last updated 2025-02-16 for v0.14.8 by @jgclark
//-----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { pluginUpdated, updateSettingData } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { findHeadingInNotes } from '@helpers/NPParagraph'

const pluginID = 'np.Tidy'

export {
  removeSectionFromAllNotes,
  removeSectionFromRecentNotes,
} from './removeSections'
export {
  logNotesChangedInInterval,
  removeDoneMarkers,
  removeOrphanedBlockIDs,
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
export { listPotentialDoubles } from './doubledNotes'

/**
 * Other imports/exports
 */
// eslint-disable-next-line import/order
export { onUpdateOrInstall, init, onSettingsUpdated } from './triggersHooks'

// Note: not yet written or used:
// export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'

/**
 * Update Settings/Preferences (for iOS etc)
 * Plugin entrypoint for command: "/<plugin>: Update Plugin Settings/Preferences"
 * @author @dwertheimer
 */
export async function updateSettings(): Promise<void> {
  try {
    logDebug(pluginJson, `updateSettings running`)
    await editSettings(pluginJson)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
