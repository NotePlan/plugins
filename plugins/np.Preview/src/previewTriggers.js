// @flow
//-----------------------------------------------------------------------------
// Preview triggering
// Last updated 29.9.2023 for v0.3.x+ by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { previewNote } from './previewMain'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

/**
 * Decide whether to update Dashboard, to be called by an onSave or onChange trigger
 */
export async function updatePreview(): Promise<void> {
  try {
    // Only proceed if the preview window is open
    if (!isHTMLWindowOpen('Preview')) {
      logDebug(pluginJson, `Preview window not open, so stopping.`)
      return
    }
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logInfo(pluginJson, `Designed only to run on macOS. Stopping.`)
      return
    }

    if (!(Editor.content && Editor.note)) {
      logWarn(pluginJson, `Cannot get Editor details. Please open a note.`)
      return
    }

    // Get the details of what's been changed
    const latestContent = Editor.content ?? ''
    const noteReadOnly: CoreNoteFields = Editor.note
    const previousContent = noteReadOnly.versions[0].content
    const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
    // logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
    // logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
    // logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

    // first check to see if this has been called in the last 2000ms: if so don't proceed, as this could be a double call.
    if (timeSinceLastEdit <= 2000) {
      logDebug(pluginJson, `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
      return
    }

    // Update the Preview
    logDebug(pluginJson, `WILL update Preview.`)
    previewNote()
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
