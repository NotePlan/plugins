// @flow
//-----------------------------------------------------------------------------
// Dashboard triggering
// Last updated 1.3.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { rangeToString } from '@helpers/general'
import { selectedLinesIndex } from '@helpers/NPparagraph'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { RE_ANY_TYPE_OF_TASK_OR_CHECKLIST_MARKER } from '@helpers/regex'

/**
 * Decide whether to update Dashboard, to be called by an onSave or onChange trigger
 * @returns {boolean}
 */
export function decideWhetherToUpdateDashboard(): void {
  try {
    // Only proceed if the dashboard window is open
    // FIXME: Eduard needs to fix something
    // if (!isHTMLWindowOpen('Dashboard')) {
    //   logDebug(pluginJson, `Not updating dashboard because the change hasn't added or completed or removed a task or checklist.`)
    //   return
    // }
    // FIXME: Temporary check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug(pluginJson, `Designed only to run on macOS. Stopping.`)
      return
    }

    if (!(Editor.content && Editor.note)) {
      logDebug(pluginJson, `Cannot get Editor details. Is there a note open in the Editor?`)
      return
    }

    // Get the details of what's been changed
    const latestContent = Editor.content ?? ''
    const noteReadOnly: CoreNoteFields = Editor.note
    const previousContent = noteReadOnly.versions[0].content
    const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
    logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
    // logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
    // logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

    // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
    if (timeSinceLastEdit <= 2000) {
      logDebug(pluginJson, `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
      return
    }

    // Get changed ranges
    const ranges = NotePlan.stringDiff(previousContent, latestContent)
    if (!ranges || ranges.length === 0) {
      logDebug(`No ranges returned, so stopping.`)
      return
    }
    const earliestStart = ranges[0].start
    let latestEnd = ranges[ranges.length - 1].end
    const overallRange: TRange = Range.create(earliestStart, latestEnd)
    logDebug('dashboard/decideWhetherToUpdateDashboard', `- overall changed content from ${rangeToString(overallRange)}`)

    // earlier method for changedExtent based on character region, which didn't seem to always include all the changed parts.
    let changedExtent = latestContent?.slice(earliestStart, latestEnd)
    // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
    logDebug('dashboard/decideWhetherToUpdateDashboard', `Changed content  (method 1): <${changedExtent}>`)

    // // Newer method uses changed paragraphs: this will include more than necessary, but that's more useful in this case
    // changedExtent = ''
    // const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
    // logDebug('dashboard/decideWhetherToUpdateDashboard', `- changed lines ${startParaIndex}-${endParaIndex}`)
    // // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
    // for (let i = startParaIndex; i <= endParaIndex; i++) {
    //   changedExtent += Editor.paragraphs[i].content
    // }
    // logDebug('dashboard/decideWhetherToUpdateDashboard', `Changed content (method 2): <${changedExtent}>`)

    // Is the change to the note in question one that adds or completes or removes a task or checklist?
    const isThisChangeSignificant = RE_ANY_TYPE_OF_TASK_OR_CHECKLIST_MARKER.test(changedExtent) // TODO:
    if (isThisChangeSignificant) {
      // Update the dashboard
      logDebug(pluginJson, `Have decided to update dashboard.`)
      showDashboardHTML()
    }
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
