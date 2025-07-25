// @flow

// -----------------------------------------------------------------------------
// NoteHelpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 2025-06-06 for v1.2.0 by @jgclark
// -----------------------------------------------------------------------------

// allow changes in plugin.json to trigger recompilation
import pluginJson from '../plugin.json'

import { JSP, logDebug, logError } from '@helpers/dev'
// import { migrateCommandsIfNecessary } from '@helpers/NPConfiguration'
import { editSettings } from '@helpers/NPSettings'
import { showMessage } from '@helpers/userInput'

export { countAndAddDays } from './countDays'
export { indexFolders, updateAllIndexes } from './indexFolders'
export { filenameToTitle } from './lib/commands/filenameToTitle'
export { listInconsistentNames } from './lib/commands/listInconsistentNames'
export { renameInconsistentNames } from './lib/commands/renameInconsistentNames'
export { titleToFilename } from './lib/commands/titleToFilename'
export { listPublishedNotes } from './listPublishedNotes'
export { newNote, newNoteFromClipboard, newNoteFromSelection } from './newNote'
export { addTriggerToNote, convertLocalLinksToPluginLinks, addFrontmatterToNote, moveNote, logEditorNoteDetailed, renameNoteFile, trashNote } from './noteHelpers'
export {
  jumpToDone,
  jumpToHeading,
  jumpToNoteHeading,
  // Following now in WindowTools:
  // openCurrentNoteNewSplit,
  // openNoteNewWindow,
  // openNoteNewSplit,
  openURLFromANote,
  showMonth,
  showQuarter,
  showYear,
} from './noteNavigation'
export { findUnlinkedNotesInCurrentNote, findUnlinkedNotesInAllNotes, triggerFindUnlinkedNotes } from './unlinkedNoteFinder'
export { writeModified } from './writeModified'
export { printNote } from '@helpers/NPnote'

export function resetCaches() {
  NotePlan.resetCaches()
}

const configKey = 'noteHelpers'

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export async function onSettingsUpdated(): Promise<void> {
  // Placeholder only to stop error in logs
}

/**
 * Executes when the plugin is updated or installed.
 */
export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(pluginJson, `${configKey}: onUpdateOrInstall running`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(pluginJson, error)
  }
  logDebug(pluginJson, `${configKey}: onUpdateOrInstall finished`)
}

/**
 * Update Settings/Preferences (for iOS/iPadOS)
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
