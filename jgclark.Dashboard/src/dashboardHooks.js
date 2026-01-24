/* eslint-disable require-await */
// @flow
//-----------------------------------------------------------------------------
// Dashboard triggers and other hooks
// Last updated  for v2.1.0
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { incrementallyRefreshSomeSections, refreshSomeSections } from './refreshClickHandlers'
import { allSectionCodes, WEBVIEW_WINDOW_ID } from './constants'
// import { getSomeSectionsData } from './dataGeneration'
import type { MessageDataObject, TSectionCode } from './types'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
} from '@helpers/dateTime'
import { makeBasicParasFromContent } from '@helpers/NPParagraph'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { isOpen } from '@helpers/utils'

//-----------------------------------------------------------------------------

/**
 * Have the number of open items changed?
 * v3 Method: Return true if some task/checklist items have been added or completed when comparing 'previousContent' to 'currentContent'.
 * Note: now not used
 * @param {string} previousContent
 * @param {string} currentContent
 * @returns {boolean} changed?
 */
// function changeToNumberOfOpenItems(previousContent: string, currentContent: string): boolean {
//   const prevOpenNum = numberOfOpenItems(previousContent)
//   const currentOpenNum = numberOfOpenItems(currentContent)
//   logDebug(pluginJson, `prevOpenNum: ${prevOpenNum} / currentOpenNum: ${currentOpenNum} ->  ${String(prevOpenNum - currentOpenNum)}`)
//   return prevOpenNum != currentOpenNum
// }

/**
 * Have the number of open items changed?
 * v4 Method: Get all open items from current and previous version of note, and compare, having sorted so we ignore lines simply being moved around.
 * @param {TNote} note to compare versions
 * @returns {boolean}
 */
function haveOpenItemsChanged(note: TNote): boolean {
  if (!note.versions || note.versions.length === 0) {
    logDebug('haveOpenItemsChanged', `No versions found, so won't compare.`)
    return false
  }
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
 * Make array of calendar section codes and their current filename
 * @returns {Array<{string, string}>}
 */
function makeFilenameToSectionCodeList(): Array<{ filename: string, sectionCode: TSectionCode }> {
  const todayFilename = `${getTodaysDateUnhyphenated()}.md`
  const FTSCList: Array<Object> = [{ sectionCode: 'DT', filename: todayFilename }]

  const yesterday = new moment().subtract(1, 'days').toDate()
  const yesterdayFilename = `${moment(yesterday).format('YYYYMMDD')}.md`
  FTSCList.push({ sectionCode: 'DY', filename: yesterdayFilename })

  const tomorrow = new moment().add(1, 'days').toDate()
  const tomorrowFilename = `${moment(tomorrow).format('YYYYMMDD')}.md`
  FTSCList.push({ sectionCode: 'DO', filename: tomorrowFilename })

  const today = new moment().toDate()
  const WDateStr = getNPWeekStr(today)
  const weekFilename = `${WDateStr}.md`
  FTSCList.push({ sectionCode: 'W', filename: weekFilename })

  const MDateStr = getNPMonthStr(today)
  const monthFilename = `${MDateStr}.md`
  FTSCList.push({ sectionCode: 'M', filename: monthFilename })

  const QDateStr = getNPQuarterStr(today)
  const quarterFilename = `${QDateStr}.md`
  FTSCList.push({ sectionCode: 'Q', filename: quarterFilename })

  return FTSCList
}

/**
 * Decide whether to update Dashboard, to be called by an onSave or onChange trigger, *and if so, update the dashboard*.
 * Note: ideally should have left this named 'onEditorWillSave', for the current name is misleading. So now the work has moved to that new function, and this one just calls that function.
 */
export async function decideWhetherToUpdateDashboard(): Promise<void> {
  await onEditorWillSave()
}

/**
 * Decides whether the number of open items in the Editor has changed, or if open item contents have changed. Ignore open items have just moved around.
 * If open items have changed, then update the dashboard for this calendar period (if it is one), or all sections if not.
 */
export async function onEditorWillSave(): Promise<void> {
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
    if (!isHTMLWindowOpen(`${pluginJson['plugin.id']}.main`)) {
      logDebug('decideWhetherToUpdateDashboard', `Dashboard window not open, so stopping.`)
      return
    }

    // Get the details of what's been changed
    if (Editor.content && Editor.note) {
      const note: Note = Editor.note
      if (!note.versions || note.versions.length === 0) {
        logDebug('decideWhetherToUpdateDashboard', `No versions found, so won't proceed to check for changes.`)
        return
      }
      const versionDate: Date = new Date(note.versions[0].date)
      const timeSinceLastEdit: number = Date.now() - versionDate.getTime()
      logDebug(
        'decideWhetherToUpdateDashboard',
        `onEditorWillSave triggered for '${note.filename}' with ${note.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago at ${versionDate.toLocaleString()}`,
      )

      // first check to see if this has been called in the last 1000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        logDebug('decideWhetherToUpdateDashboard', `decideWhetherToUpdateDashboard fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Decide if there are more or fewer open items than before, or they have changed content
      const openItemsHaveChanged = haveOpenItemsChanged(note)
      if (openItemsHaveChanged) {
        // Note: had wanted to try using Editor.save() here, but seems to trigger an infinite loop
        // Note: DataStore.updateCache(Editor.note) doesn't work either.
        // Instead we test for Editor in the dataGeneration::getOpenItemParasForTimePeriod() function

        // Update the dashboard
        // v3 only update the section for this note (or if not found then all sections still)
        const FTSCList = makeFilenameToSectionCodeList()
        const filename = note.filename
        // find element in FTSCList matching filename and return the sectionCode
        const thisObject = FTSCList.find((obj) => obj.filename === filename)
        const theseSectionCodes: Array<TSectionCode> = thisObject?.sectionCode ? [thisObject.sectionCode] : allSectionCodes
        const data: MessageDataObject = { actionType: 'refreshSomeSections', sectionCodes: theseSectionCodes }
        // ask to update section(s), noting this is called by a trigger (which changes whether we use Editor.note.content or note.content)
        logDebug('decideWhetherToUpdateDashboard', `WILL update dashboard section(s) ${theseSectionCodes.toString()}`)
        const res = await incrementallyRefreshSomeSections(data, true)
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

/**
 * Refresh a section given by its code -- if the Dashboard is open already.
 */
export async function refreshSectionByCode(sectionCode: TSectionCode): Promise<void> {
  if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
    logDebug('refreshSectionByCode', `Dashboard not open, so won't proceed ...`)
    return
  }
  logDebug('refreshSectionByCode', `Dashboard is open, so will refresh section ${sectionCode} ...`)
  const data: MessageDataObject = {
    sectionCodes: [sectionCode],
    actionType: 'refreshSomeSections',
  }
  const res = await refreshSomeSections(data, true)
  logDebug('refreshSectionByCode', `done.`)
}

/**
 * Refresh a section given by its code -- if the Dashboard is open already.
 */
export async function refreshSectionsByCode(sectionCodes: Array<TSectionCode>): Promise<void> {
  if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
    logDebug('refreshSectionsByCode', `Dashboard not open, so won't proceed ...`)
    return
  }
  logDebug('refreshSectionsByCode', `Dashboard is open, so will refresh sections ${String(sectionCodes)} ...`)
  const data: MessageDataObject = {
    sectionCodes: sectionCodes,
    actionType: 'refreshSomeSections',
  }
  const res = await refreshSomeSections(data, true)
  logDebug('refreshSectionsByCode', `done.`)
}
