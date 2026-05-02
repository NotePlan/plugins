// @flow
// -----------------------------------------------------------------
// Editor helpers that only need ./dev (no NPParagraph / userInput).
// Split from NPEditor.js so plugin code (e.g. repeat generation) can use
// these without creating Rollup circular dependency:
// NPParagraph → … → NPEditor → NPParagraph
// -----------------------------------------------------------------

import { logDebug, logError } from './dev'

/**
 * Run Editor.save() if active Editor is dirty and needs saving
 * Does nothing if Editor and Editor.note are the same (has been saved)
 * If they don't match, it saves
 * @usage await saveEditorIfNecessary()
 * @dwertheimer sometimes found that calling Editor.save() on a note which didn't need saving would crash the plugin
 */
export async function saveEditorIfNecessary(): Promise<void> {
  if (!Editor?.note) {
    logDebug('saveEditorIfNecessary', 'We are not in the Editor; Nothing to do.')
    return
  }
  if (Editor.note?.content !== Editor.content) {
    logDebug('saveEditorIfNecessary', 'Editor.note?.content !== Editor.content; Saving Editor')
    try {
      await Editor.save() // ensure recent/unsaved changes get saved first
    } catch (error) {
      logError('saveEditorIfNecessary', `Error saving Editor: ${error.message}`)
      throw error
    }
  }
}

/**
 * Returns the first open Editor window that matches a given filename (if any).
 * If 'getLastOpenEditor' is true, then return the last matching open Editor window (which is the most recently opened one) instead.
 * @author @jgclark
 * @param {string} openNoteFilename to find in list of open Editor windows
 * @param {boolean} getLastOpenEditor - whether to return the last open Editor window (which is the most recently opened one) instead of the first one that matches the filename (the default)
 * @returns {TEditor | false} the matching open Editor window or false if not found
 */
export function getOpenEditorFromFilename(openNoteFilename: string, getLastOpenEditor: boolean = false): TEditor | false {
  const allEditorWindows = NotePlan.editors
  const matchingEditorWindows = allEditorWindows.filter((ew) => ew.filename === openNoteFilename)
  if (matchingEditorWindows.length === 0) {
    logDebug('getOpenEditorFromFilename', `No open Editor window found for filename '${openNoteFilename}'`)
    return false
  }
  if (getLastOpenEditor) {
    return matchingEditorWindows[matchingEditorWindows.length - 1]
  }
  return matchingEditorWindows[0]
}
