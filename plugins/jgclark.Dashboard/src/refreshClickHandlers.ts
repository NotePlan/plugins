// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for refresh-related dashboard clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated for v2.1.0.a
//-----------------------------------------------------------------------------
import { WEBVIEW_WINDOW_ID } from './constants'
import {
  updateDoneCountsFromChangedNotes,
} from './countDoneTasks'
import {
  getNotePlanSettings,
  handlerResult,
  mergeSections,
  setPluginData,
} from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import type { MessageDataObject, TAnyObject, TBridgeClickHandlerResult, TPluginData, } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer, dt } from '@np/helpers/dev'
import { getGlobalSharedData } from '@np/helpers/HTMLView'

/****************************************************************************************************************************
 *                             NOTES
 ****************************************************************************************************************************
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.

/****************************************************************************************************************************
 *                             Data types + constants
 ****************************************************************************************************************************/

/****************************************************************************************************************************
 *                             HANDLERS
 ****************************************************************************************************************************/

/**
 * Tell the React window to update by re-generating all Sections
 */
export async function refreshAllSections(): Promise<void> {
  const startTime = new Date()
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  // show refreshing message until done
  await setPluginData({ refreshing: true }, 'Starting Refreshing all sections')

  // refresh all sections' data
  const newSections = await getAllSectionsData(reactWindowData.demoMode, false, false)
  const changedData = {
    refreshing: false,
    sections: newSections,
    lastFullRefresh: new Date(),
    // totalDoneCounts: getTotalDoneCountsFromSections(newSections),
  }
  await setPluginData(changedData, 'Finished Refreshing all sections')
  logTimer('refreshAllSections', startTime, `at end for all sections`)

  // re-calculate all done task counts (if the appropriate setting is on)
  const NPSettings = await getNotePlanSettings()
  if (NPSettings.doneDatesAvailable) {
    // V1 method
    // const totalDoneCounts = rollUpDoneCounts([getTotalDoneCountsFromSections(reactWindowData.pluginData.sections)], buildListOfDoneTasksToday())
    // const changedData = {
    //   totalDoneCounts: totalDoneCounts,
    // }
    // V2 method
    const totalDoneCount = updateDoneCountsFromChangedNotes(`end of refreshAllSections()`)
    const changedData = {
      totalDoneCount: totalDoneCount,
    }
    await setPluginData(changedData, 'Updating doneCounts at end of refreshAllSections')
  }
}

// FIXME: DBW thinks this generates way more updates than necessary

/**
 * Loop through sectionCodes and tell the React window to update by re-generating a subset of Sections.
 * This is used on first launch to improve the UX and speed of first render.
 * Each section is returned to React as it's generated.
 * Today loads first and then this function is automatically called from a useEffect in
 * Dashboard.jsx to load the rest.
 * @param {MessageDataObject} data
 * @param {boolean} calledByTrigger? (default: false)
 * @param {boolean} setFullRefreshDate? (default: false) - whether to set the lastFullRefresh date (default is no)
 * @returns {TBridgeClickHandlerResult}
 */
export async function incrementallyRefreshSections(
  data: MessageDataObject,
  calledByTrigger: boolean = false,
  setFullRefreshDate: boolean = false,
): Promise<TBridgeClickHandlerResult> {
  const incrementalStart = new Date()
  const { sectionCodes } = data
  if (!sectionCodes) {
    logError('incrementallyRefreshSections', 'No sectionCodes provided')
    return handlerResult(false)
  }
  await setPluginData({ refreshing: true }, `Starting incremental refresh for sections ${String(sectionCodes)}`)
  // loop through sectionCodes
  for (const sectionCode of sectionCodes) {
    const start = new Date()
    await refreshSomeSections({ ...data, sectionCodes: [sectionCode] }, calledByTrigger)
    logDebug(`clickHandlers`, `incrementallyRefreshSections getting ${sectionCode}) took ${timer(start)}`)
  }
  logDebug('incrementallyRefreshSections', `Starting for ${sectionCodes.length} sections ${String(sectionCodes)}`)
  const updates: any = { refreshing: false }
  if (setFullRefreshDate) updates.lastFullRefresh = new Date()
  await setPluginData(updates, `Ending incremental refresh for sections ${String(sectionCodes)} (after ${timer(incrementalStart)})`)
  logTimer('incrementallyRefreshSections', incrementalStart, `for ${sectionCodes.length} sections`, 2000)

  // re-calculate done task counts (if the appropriate setting is on)
  const NPSettings = await getNotePlanSettings()
  if (NPSettings.doneDatesAvailable) {
    const totalDoneCount = updateDoneCountsFromChangedNotes(`update done counts at end of incrementallyRefreshSections (for [${sectionCodes.join(',')}])`)
    const changedData = {
      totalDoneCount: totalDoneCount,
    }
    await setPluginData(changedData, 'Updating doneCounts at end of incrementallyRefreshSections')
  }

  return handlerResult(true)
}

/**
 * Tell the React window to update by re-generating a subset of Sections.
 * Returns them all in one shot vs incrementallyRefreshSections which updates one at a time.
 * @param {MessageDataObject} data
 * @param {boolean} calledByTrigger? (default: false)
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSomeSections(data: MessageDataObject, calledByTrigger: boolean = false): Promise<TBridgeClickHandlerResult> {
  const start = new Date()
  const { sectionCodes } = data
  if (!sectionCodes) {
    logError('refreshSomeSections', 'No sectionCodes provided')
    return handlerResult(false)
  }
  logDebug('refreshSomeSections', `Starting for ${String(sectionCodes)}`)
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const pluginData: TPluginData = reactWindowData.pluginData
  // show refreshing message until done
  if (!pluginData.refreshing === true) await setPluginData({ refreshing: sectionCodes }, `Starting refresh for sections ${String(sectionCodes)}`)
  const existingSections = pluginData.sections

  // force the section refresh for the wanted sections
  const newSections = await getSomeSectionsData(sectionCodes, pluginData.demoMode, calledByTrigger)
  // logDebug('refreshSomeSections', `- after getSomeSectionsData(): ${timer(start)}`)
  const mergedSections = mergeSections(existingSections, newSections)
  // logDebug('refreshSomeSections', `- after mergeSections(): ${timer(start)}`)

  const updates: TAnyObject = { sections: mergedSections }
  // and update the total done counts
  // TODO: turning off for now, as was being called too often? Need to figure this out.
  // updates.totalDoneCounts = getTotalDoneCountsFromSections(mergedSections)

  if (!pluginData.refreshing === true) updates.refreshing = false
  await setPluginData(updates, `Finished refresh for sections: ${String(sectionCodes)} (${timer(start)})`)
  logTimer('refreshSomeSections', start, `for ${sectionCodes.toString()}`, 2000)
  // count sectionItems in all sections
  const totalSectionItems = mergedSections.reduce((acc, section) => acc + section.sectionItems.length, 0)
  logDebug('refreshSomeSections', `Total section items: ${totalSectionItems}`)
  return handlerResult(true, [], { sectionItems: totalSectionItems })
}
