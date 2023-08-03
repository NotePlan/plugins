// @flow
//-----------------------------------------------------------------------------
// Dashboard triggering
// Last updated 14.7.2023 for v0.5.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { clo, JSP, /*logDebug,*/ logError, logInfo, logWarn } from '@helpers/dev'
import { rangeToString } from '@helpers/general'
import { selectedLinesIndex } from '@helpers/NPparagraph'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { isOpen } from '@helpers/utils'
import { formRegExForUsersOpenTasks } from '@helpers/regex'
import plugin from "@babel/core/lib/config/plugin";

/**
 * Local version of log, turned on only if we have a special local pref set
 * @param {any} pluginJson
 * @param {string} message
 */
function logDebug(pluginJson: any, message: string): void {
  const doLog: boolean = !!DataStore.preference('Dashboard-triggerLogging')
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
  const RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE = formRegExForUsersOpenTasks(true)
  // logDebug(pluginJson, String(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  const res = Array.from(content.matchAll(RE_USER_OPEN_TASK_OR_CHECKLIST_MARKER_MULTI_LINE))
  return res ? res.length : 0
}

/**
 * Decide whether to update Dashboard, to be called by an onSave or onChange trigger.
 * Decides whether the number of open items has changed, or if open item contents have changed.
 * But ignore if open items have just moved around.
 * @returns {boolean}
 */
export async function decideWhetherToUpdateDashboard(): Promise<void> {
  try {
    // Only proceed if the dashboard window is open
    if (!isHTMLWindowOpen('Dashboard')) {
      logDebug('decideWhetherToUpdateDashboard', `Dashboard window not open, so stopping.`)
      return
    }
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug('decideWhetherToUpdateDashboard', `Designed only to run on macOS. Stopping.`)
      return
    }

    if (!(Editor.content && Editor.note)) {
      logWarn('decideWhetherToUpdateDashboard', `Cannot get Editor details. Please open a note.`)
      return
    }

    // Get the details of what's been changed
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
      logDebug('decideWhetherToUpdateDashboard', `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
      // logDebug('decideWhetherToUpdateDashboard', `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
      // logDebug('decideWhetherToUpdateDashboard', `- new version: ${String(Date.now())} [${latestContent}]`)

      // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        logDebug('decideWhetherToUpdateDashboard', `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // // Get all open items from before and after
      // const beforeOpenParas = noteReadOnly.versions[0].paragraphs.filter((p) => isOpen(p))
      // const beforeOpenLines = beforeOpenParas.map((p) => p.rawContent)
      // const afterOpenParas = Editor.paragraphs.filter((p) => isOpen(p))
      // const afterOpenLines = afterOpenParas.map((p) => p.rawContent)

      // // Sort them
      // const beforeOpenSorted = beforeOpenLines.sort()
      // logDebug('\nbefore = ', beforeOpenSorted.join('\n'))
      // const afterOpenSorted = afterOpenLines.sort()
      // logDebug('\nafter = ', afterOpenSorted.join('\n'))

      // // Compare them
      // const openItemsHaveChanged = (beforeOpenSorted.length > 0 && (beforeOpenSorted === afterOpenSorted))

      // Decide if there are more or fewer open items than before
      // v3: Doesn't use ranges. This compares the whole of the current and previous content, asking are there a different number of open items?
      // (This avoids firing when simply moving task/checklist items around, or updating the text.)
      const hasNumberOfOpenItemsChanged = changeToNumberOfOpenItems(previousContent, latestContent)

      // TODO: now look for edits in open items
      // Get changed ranges
      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        logDebug('decideWhetherToUpdateDashboard', `No ranges returned, so stopping.`)
        return
      }
      const earliestStart = ranges[0].start
      let latestEnd = ranges[ranges.length - 1].end
      const overallRange: TRange = Range.create(earliestStart, latestEnd)
      logDebug('decideWhetherToUpdateDashboard', `- overall changed content from ${rangeToString(overallRange)}`)
      // Get changed lineIndexes

      // earlier method for changedExtent based on character region, which didn't seem to always include all the changed parts.
      // const changedExtent = latestContent?.slice(earliestStart, latestEnd)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      // logDebug('decideWhetherToUpdateDashboard', `Changed content extent: <${changedExtent}>`)

      // Newer method uses changed paragraphs: this will include more than necessary, but that's more useful in this case
      let changedExtent = ''
      const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
      logDebug('decideWhetherToUpdateDashboard', `- changed lines ${startParaIndex}-${endParaIndex}`)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].content
      }
      logDebug('decideWhetherToUpdateDashboard', `Changed content extent: <${changedExtent}>`)

      // TODO: first get changed range
      // TODO: then expand to get the paragraphs in the range
      const openItemsChanged = false

      if (hasNumberOfOpenItemsChanged || openItemsChanged) {
      // if (openItemsHaveChanged) {
        // TODO: try await Editor.save()? to get latest version available
        // Editor.save() // FIXME: hanging with or without await
        // DataStore.updateCache(Editor.note)
        // Update the dashboard, but don't ask for focus
        logDebug('decideWhetherToUpdateDashboard', `WILL update dashboard.`)
        showDashboardHTML(false)
      }
      else {
        logDebug('decideWhetherToUpdateDashboard', `Won't update dashboard.`)
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  }
  catch (error) {
    logError(pluginJson, `decideWhetherToUpdateDashboard: ${error.name}: ${error.message}`)
  }
}
