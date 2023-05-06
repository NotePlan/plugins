// @flow
//-----------------------------------------------------------------------------
// Dashboard triggering
// Last updated 27.4.2023 for v0.4.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { clo, JSP, /*logDebug,*/ logError, logInfo, logWarn } from '@helpers/dev'
import { rangeToString } from '@helpers/general'
import { selectedLinesIndex } from '@helpers/NPparagraph'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { formRegExForUsersOpenTasks } from '@helpers/regex'
import plugin from "@babel/core/lib/config/plugin";

/**
 * Local version of log, turned on only if we have a special local pref set
 * @param {any} pluginJson 
 * @param {string} message 
 */
function logDebug(pluginJson: any, message: string): void {
  const doLog: boolean = !!DataStore.preference('Dashboard-Trigger-Log')
  if (doLog) {
    console.log(message)
  }
}

/**
 * Return true if some task/checklist items have been added or completed when comparing 'previousContent' to 'currentContent'.
 * @param {string} previousContent 
 * @param {string} currentContent 
 * @returns {boolean} changed?
 */
function changeToNumberOfOpenItems(previousContent: string, currentContent: string): boolean {
  const prevOpenNum = numberOfOpenItems(previousContent)
  const currentOpenNum = numberOfOpenItems(currentContent)
  logDebug(pluginJson, `prevOpenNum: ${prevOpenNum} / currentOpenNum: ${currentOpenNum} ->  ${String(prevOpenNum - currentOpenNum)}`)
  return (prevOpenNum != currentOpenNum)
}

/**
 * Return number of open items in a multi-line string
 * @param {number} content 
 * @returns {number}
 */
function numberOfOpenItems(content: string): number {
  const RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE = formRegExForUsersOpenTasks()
  // logDebug(pluginJson, String(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  const res = Array.from(content.matchAll(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  return res ? res.length : 0
}

/**
 * Decide whether to update Dashboard, to be called by an onSave or onChange trigger
 * @returns {boolean}
 */
export function decideWhetherToUpdateDashboard(): void {
  try {
    // Only proceed if the dashboard window is open
    if (!isHTMLWindowOpen('Dashboard')) {
      logDebug(pluginJson, `Dashboard window not open, so stopping.`)
      return
    }
    // TODO: Temporary check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug(pluginJson, `Designed only to run on macOS. Stopping.`)
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
    logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
    logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
    logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

    // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
    if (timeSinceLastEdit <= 2000) {
      logDebug(pluginJson, `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
      return
    }

    // Decide if there are relevant changes
    // v3: Doesn't use ranges. This compares the whole of the current and previous content, asking are there a different number of open items?
    // (This avoids firing when simply moving task/checklist items around, or updating the text.)
    const isThisChangeSignificant = changeToNumberOfOpenItems(previousContent, latestContent)

    if (isThisChangeSignificant) {
      // ??? Cache the current content
      // DataStore.updateCache(Editor.note)
      // Update the dashboard
      logDebug(pluginJson, `WILL update dashboard.`)
      showDashboardHTML()
    }
    else {
      logDebug(pluginJson, `Won't update dashboard.`)
    }
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
