// @flow
// ----------------------------------------------------------------------------
// Helper functions for Filer plugin.
// Jonathan Clark
// last updated 2026-11-13, for v1.7.0, by @CursorAI
// ----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { getNoteFromEditorWindow } from '@helpers/NPEditor'
import { getNoteFromIdentifier } from '@helpers/NPnote'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id'] // was 'jgclark.Filer'

export type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  includeFromStartOfSection: boolean,
  allowNotePreambleBeforeHeading: boolean,
  useTightBlockDefinition: boolean,
  doneSectionHeadingName: string,
  recreateDoneSectionStructure: boolean,
  skipDoneSubtasksUnderOpenTasks: boolean,
  whenToMoveCompletedToDone: string, // from choices: 'ask each time', 'move when whole section complete', 'move when any are complete' in v1.5.3. Previously a boolean setting 'onlyMoveCompletedWhenWholeSectionComplete'.
  onlyMoveCompletedWhenWholeSectionComplete?: boolean, // legacy pre-v1.5.3 boolean setting; still read from older settings files to derive whenToMoveCompletedToDone
  whereToAddInSection: string, // 'start' (default) or 'end'
  typesToFile: string, // now a choice: all but incomplete tasks
  useBlocks: boolean,
  whereToAddInNote: string, // 'start' (default) or 'end'
  ignoreNoteLinkFilerTag: string,
  copyOrMove: string, // 'copy' or 'move'. Note: not set in plugin settings, but in object to send from wrappers to main functions
  recentDays: number,
  _logLevel: string,
  _logTimer: boolean,
}

/**
 * Load Filer settings. When `interactive` is false (an x-callback or template call), a missing settings file is only logged.
 * @param {boolean} interactive - when true, tell the user if settings cannot be loaded
 * @returns {Promise<any>} settings object, or undefined when they cannot be loaded
 */
export async function getFilerSettings(interactive: boolean = true): Promise<any> {
  try {
    // // TODO: add to np.Shared
    // // - doneSectionHeadingName
    // // First get global setting 'useTightBlockDefinition'
    // let useTightBlockDefinition = await getSetting('np.Shared', 'useTightBlockDefinition')
    // logDebug('getFilerSettings', `- useTightBlockDefinition: np.Globals: ${String(useTightBlockDefinition)}`)

    // Get settings using Config system
    const config: FilerConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(pluginJson, `getFilerSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      if (interactive) {
        await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      }
      return
    } else {
      // clo(config, `${pluginID} settings:`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `GetFilerSettings(): ${err.name}: ${err.message}`)
    if (interactive) {
      await showMessage(`Error: ${err.message}`)
    }
  }
}

/**
 * Resolve a note argument from an x-callback or template call.
 * An empty string means the note open in the editor.
 * Anything else is a filename (with extension), a note title, or a date phrase such as `today` (see getNoteFromIdentifier).
 * @param {string} noteArg
 * @returns {CoreNoteFields | null}
 */
export function resolveNoteArgument(noteArg: string): CoreNoteFields | null {
  const trimmed = (noteArg || '').trim()
  if (trimmed === '') {
    return getNoteFromEditorWindow(Editor) ?? null
  }
  return getNoteFromIdentifier(trimmed)
}

/**
 * Log a user-facing outcome. Show the same text in a dialog only when the command was started from the command bar.
 * @param {boolean} interactive
 * @param {string} message
 * @param {string} title - dialog title
 * @param {string} confirmButton
 */
export async function reportFiler(interactive: boolean, message: string, title: string = '', confirmButton: string = 'OK'): Promise<void> {
  logInfo(pluginID, `${title ? `${title}: ` : ''}${message}`)
  if (interactive) {
    await showMessage(message, confirmButton, title)
  }
}
