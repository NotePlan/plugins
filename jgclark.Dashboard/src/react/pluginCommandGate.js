// @flow
//--------------------------------------------------------------------------
// Which Dashboard WebView commands may be queued while the plugin is busy.
// Open-note clicks used to be dropped, so a task click during a long search did nothing.
// Last updated 2026-11-05 for v2.6.0.b10
//--------------------------------------------------------------------------

const MUTATION_COMMANDS = [
  'completeTask',
  'completeTaskThen',
  'completeChecklist',
  'cancelTask',
  'cancelChecklist',
  'deleteItem',
  'completeReminder',
  'deleteReminder',
  'convertReminderToTask',
]

const OPEN_NOTE_COMMANDS = [
  'showLineInEditorFromFilename',
  'showNoteInEditorFromFilename',
  'showNoteInEditorFromTitle',
  'openURL',
]

/**
 * True when this command changes a row and must not be dropped while a refresh holds the plugin.
 * @param {string} command
 * @returns {boolean}
 */
export function isQueueableUserMutationCommand(command: string): boolean {
  return MUTATION_COMMANDS.includes(command)
}

/**
 * True when this command opens a note or URL and must survive a long search/refresh.
 * @param {string} command
 * @returns {boolean}
 */
export function isOpenNoteCommand(command: string): boolean {
  return OPEN_NOTE_COMMANDS.includes(command)
}

/**
 * True when a user click should wait, rather than be sent into a busy plugin or dropped.
 * @param {string} command
 * @returns {boolean}
 */
export function isQueueableWhilePluginBusy(command: string): boolean {
  return isQueueableUserMutationCommand(command) || isOpenNoteCommand(command)
}

/**
 * True when pluginData says a generation, perspective switch, or section refresh is running.
 * @param {any} pluginDataIn
 * @returns {boolean}
 */
export function pluginDataLooksBusy(pluginDataIn: any): boolean {
  return Boolean(
    pluginDataIn?.firstRun ||
      pluginDataIn?.perspectiveChanging ||
      pluginDataIn?.refreshing === true ||
      (Array.isArray(pluginDataIn?.refreshing) && pluginDataIn.refreshing.length > 0),
  )
}
