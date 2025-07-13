// @flow
// Last updated: 2024-10-13 for v1.1.1 by @jgclark
import pluginJson from '../plugin.json'
import { clo, logDebug, logError } from '@helpers/dev'

export { editSettings } from '@helpers/NPSettings'
export { onUpdateOrInstall, init, onSettingsUpdated, triggerCopyNoteTags, versionCheck } from './NPTriggers-Hooks'
export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'

/**
 * Command Exports
 */
export {
  sortTasks,
  sortTasksByPerson,
  sortTasksByTag,
  sortTasksByDue,
  tasksToTop,
  // openTasksToTop,
  sortTasksViaExternalCall,
  sortTasksTagMention,
  sortTasksDefault,
  sortTasksUnderHeading,
} from './sortTasks'
export { addNoteTagsToAllTask, addNoteTagsTriggerToFm, copyTagsFromLineAbove, copyTagsFromHeadingAbove, copyLineForEachMention, copyLineForEachHashtag } from './tagTasks'
export { default as markTasks } from './markTasks'
