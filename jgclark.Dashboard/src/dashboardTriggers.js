// @flow
//-----------------------------------------------------------------------------
// Dashboard triggering
// Last updated 5.1.2024 for v0.5.0+ by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './main'
import { clo, JSP, /*logDebug,*/ logError, logInfo, logWarn } from '@helpers/dev'
import { rangeToString } from '@helpers/general'
import { makeBasicParasFromContent, selectedLinesIndex } from '@helpers/NPparagraph'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { isOpen } from '@helpers/utils'
import { formRegExForUsersOpenTasks } from '@helpers/regex'

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
 * Have the number of open items changed?
 * v3 Method: Return true if some task/checklist items have been added or completed when comparing 'previousContent' to 'currentContent'.
 * Note: now not used
 * @param {string} previousContent
 * @param {string} currentContent
 * @returns {boolean} changed?
 */
function changeToNumberOfOpenItems(previousContent: string, currentContent: string): boolean {
  const prevOpenNum = numberOfOpenItems(previousContent)
  const currentOpenNum = numberOfOpenItems(currentContent)
  logDebug(pluginJson, `prevOpenNum: ${prevOpenNum} / currentOpenNum: ${currentOpenNum} ->  ${String(prevOpenNum - currentOpenNum)}`)
  return prevOpenNum != currentOpenNum
}

/**
 * Have the number of open items changed?
 * v4 Method: Get all open items from current and previous version of note, and compare, having sorted so we ignore lines simply being moved around.
 * @param {TNote} note to compare versions
 * @returns {boolean}
 */
function haveOpenItemsChanged(note: TNote): boolean {
  const beforeContent = note.versions[0].content
  const beforeOpenParas = makeBasicParasFromContent(beforeContent).filter((p) => isOpen(p))
  const beforeOpenLines = beforeOpenParas.map((p) => p.rawContent)
  const afterOpenParas = Editor.paragraphs.filter((p) => isOpen(p))
  const afterOpenLines = afterOpenParas.map((p) => p.rawContent)

  // Sort them
  const beforeOpenSorted = beforeOpenLines.sort()
  const afterOpenSorted = afterOpenLines.sort()

  // Compare them
  return beforeOpenSorted.toString() !== afterOpenSorted.toString()
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
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug('decideWhetherToUpdateDashboard', `Designed only to run on macOS. Stopping.`)
      return
    }

    // Do we have the Editor open? If not, stop
    if (!(Editor.content && Editor.note)) {
      logWarn('decideWhetherToUpdateDashboard', `Cannot get Editor details. Please open a note.`)
      return
    }

    // Only proceed if the dashboard window is open
    if (!isHTMLWindowOpen(pluginJson['plugin.id'] + '.main')) {
      logDebug('decideWhetherToUpdateDashboard', `Dashboard window not open, so stopping.`)
      return
    }

    // Get the details of what's been changed
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
      logDebug(
        'decideWhetherToUpdateDashboard',
        `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`,
      )

      // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        logDebug('decideWhetherToUpdateDashboard', `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Decide if this is a relevant change, now looking for edits in open items as well.
      // V4: Get all open items from before and after, but sort so we ignore lines being moved around
      // const beforeContent = noteReadOnly.versions[0].content
      // const beforeOpenParas = makeBasicParasFromContent(beforeContent).filter((p) => isOpen(p))
      // const beforeOpenLines = beforeOpenParas.map((p) => p.rawContent)
      // const afterOpenParas = Editor.paragraphs.filter((p) => isOpen(p))
      // const afterOpenLines = afterOpenParas.map((p) => p.rawContent)

      // // Sort them
      // const beforeOpenSorted = beforeOpenLines.sort()
      // const afterOpenSorted = afterOpenLines.sort()

      // // Compare them
      // const openItemsHaveChanged = beforeOpenSorted.toString() !== afterOpenSorted.toString()
      const openItemsHaveChanged = haveOpenItemsChanged(noteReadOnly)

      // // Decide if there are more or fewer open items than before
      // // v3: Doesn't use ranges. This compares the whole of the current and previous content, asking are there a different number of open items?
      // // (This avoids firing when simply moving task/checklist items around, or updating the text.)
      // const hasNumberOfOpenItemsChanged = changeToNumberOfOpenItems(previousContent, latestContent)
      // let hasNumberOfOpenItemsChanged = false // TODO: remove workaround

      // if (hasNumberOfOpenItemsChanged || openItemsHaveChanged) {
      if (openItemsHaveChanged) {
        // Note: had wanted to try using Editor.save() here, but seems to trigger an infinite loop
        // Note: DataStore.updateCache(Editor.note) doesn't work either.
        // Instead we test for Editor in the dataGeneration::getOpenItemParasForCurrentTimePeriod() function

        // Update the dashboard
        logDebug('decideWhetherToUpdateDashboard', `WILL update dashboard.`)
        showDashboardHTML('trigger') // indicate this comes from a trigger, so won't take focus
      } else {
        logDebug('decideWhetherToUpdateDashboard', `Won't update dashboard.`)
      }
    } else {
      throw new Error('Cannot get Editor details. Is there a note open in the Editor?')
    }
  } catch (error) {
    logError(pluginJson, `decideWhetherToUpdateDashboard: ${error.name}: ${error.message}`)
  }
}
