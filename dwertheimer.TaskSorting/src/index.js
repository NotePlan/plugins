// @flow

/**
 * Imports
 */
// import pluginJson from '../plugin.json'
// import { clo } from '@helpers/dev'

// FETCH mocking for offline testing
// If you want to use external server calls in your plugin, it can be useful to mock the server responses
// while you are developing the plugin. This allows you to test the plugin without having to
// have a server running or having to have a network connection (or wait/pay for the server calls)
// Comment the following import line out if you want to use live fetch/server endpoints (normal operation)
// Uncomment it for using server mocks (fake/canned responses) you define in support/fetchOverrides.js
// import './support/fetchOverrides'

/**
 * Command Exports
 */
export {
  sortTasks,
  sortTasksByPerson,
  sortTasksByTag,
  sortTasksByDue,
  tasksToTop,
  openTasksToTop,
  sortTasksViaTemplate,
  sortTasksTagMention,
  sortTasksDefault,
  sortTasksUnderHeading,
} from './sortTasks'
export { addNoteTagsToAllTask, addNoteTagsTriggerToFm, copyTagsFromLineAbove, copyTagsFromHeadingAbove, copyLineForEachMention, copyLineForEachHashtag } from './tagTasks'
export { default as markTasks } from './markTasks'

/**
 * Other imports/exports - you will normally not need to edit these
 */
// eslint-disable-next-line import/order
export { editSettings } from '@helpers/NPSettings'
export { onUpdateOrInstall, init, onSettingsUpdated, triggerCopyNoteTags, versionCheck } from './NPTriggers-Hooks'
export { onOpen, onEditorWillSave } from './NPTriggers-Hooks'
