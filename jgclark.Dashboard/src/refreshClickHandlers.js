// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for refresh-related dashboard clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated for v2.1.10
//-----------------------------------------------------------------------------
import { WEBVIEW_WINDOW_ID } from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import { getDisplayListOfSectionCodes, getNotePlanSettings, handlerResult, mergeSections, setPluginData } from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import type { MessageDataObject, TBridgeClickHandlerResult, TPluginData } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getGlobalSharedData, sendBannerMessage } from '@helpers/HTMLView'

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
    firstRun: false,
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

/**
 * Loop through sectionCodes and tell the React window to update by re-generating a subset of Sections.
 * This is used on first launch to improve the UX and speed of first render.
 * Each section is returned to React as it's generated.
 * Today loads first and then this function is automatically called from a useEffect in Dashboard.jsx to load the rest.
 * TODO: DBW thinks this generates way more updates than necessary
 * 
 * @param {MessageDataObject} data
 * @param {boolean} calledByTrigger? (default: false)
 * @param {boolean} setFullRefreshDate? (default: false) - whether to set the lastFullRefresh date (default is no)
 * @returns {TBridgeClickHandlerResult}
 */
export async function incrementallyRefreshSomeSections(
  data: MessageDataObject,
  calledByTrigger: boolean = false,
  setFullRefreshDate: boolean = false,
): Promise<TBridgeClickHandlerResult> {
  try {
    const incrementalStart = new Date()
    const { sectionCodes } = data
    if (!sectionCodes) {
      logError('incrementallyRefreshSomeSections', 'No sectionCodes provided')
      return handlerResult(false)
    }
    logDebug('incrementallyRefreshSomeSections', `Starting incremental refresh for sections [${String(sectionCodes)}]`)
    await setPluginData({ refreshing: true }, `Starting incremental refresh for sections ${String(sectionCodes)}`)
    // loop through sectionCodes
    for (const sectionCode of sectionCodes) {
      // const start = new Date()
      await refreshSomeSections({ ...data, sectionCodes: [sectionCode] }, calledByTrigger)
      // logTimer(`incrementallyRefreshSomeSections`, start, `- to get section: ${sectionCode}`, 1000)
    }
    const updates: any = { refreshing: false, firstRun: false }
    if (setFullRefreshDate) updates.lastFullRefresh = new Date()
    await setPluginData(updates, `Ending incremental refresh for sections ${String(sectionCodes)} (after ${timer(incrementalStart)})`)
    logTimer('incrementallyRefreshSomeSections', incrementalStart, `- to refresh ${sectionCodes.length} sections: ${sectionCodes.toString()}`, 2000)

    // re-calculate done task counts (if the appropriate setting is on)
    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const startTime = new Date()
      const totalDoneCount = updateDoneCountsFromChangedNotes(`update done counts at end of incrementallyRefreshSomeSections (for [${sectionCodes.join(',')}])`)
      const changedData = {
        totalDoneCount: totalDoneCount,
      }
      await setPluginData(changedData, 'Updating doneCounts at end of incrementallyRefreshSomeSections')
      logTimer('incrementallyRefreshSomeSections', startTime, `- to calculate done counts at end of incrementallyRefreshSomeSections`, 1000)
    }

    return handlerResult(true)
  }
  catch (error) {
    await setPluginData({ refreshing: false }, `Error in incrementallyRefreshSomeSections; closing modal spinner`)
    logError('incrementallyRefreshSomeSections', error)
    await sendBannerMessage(WEBVIEW_WINDOW_ID, `Error in incrementallyRefreshSomeSections: ${error.message}`)
    logDebug('incrementallyRefreshSomeSections', `Will also hide modal spinner`)
    return handlerResult(false)
  }
}

/**
 * Tell the React window to update by re-generating a subset of Sections.
 * Returns them all in one shot vs incrementallyRefreshSomeSections which updates one at a time.
 * @param {MessageDataObject} data
 * @param {boolean} calledByTrigger? (default: false)
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSomeSections(data: MessageDataObject, calledByTrigger: boolean = false): Promise<TBridgeClickHandlerResult> {
  const startTime = new Date()
  const { sectionCodes } = data
  if (!sectionCodes) {
    logError('refreshSomeSections', 'No sectionCodes provided')
    return handlerResult(false)
  }
  logDebug('refreshSomeSections', `Starting for ${String(sectionCodes)}`)
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const pluginData: TPluginData = reactWindowData.pluginData
  // show refreshing message until done
  if (!pluginData.refreshing === true) await setPluginData({ refreshing: sectionCodes }, `Starting refresh for sections ${sectionCodes.toString()}`)
  let existingSections = pluginData.sections

  // Now remove some sections that are no longer wanted:
  // - referenced sections if separateSectionForReferencedNotes is off
  // - TODO: sections that no longer match the sectionCodes. (Though this is clearly done somewhere else that works, so leaving alone for now)
  if (!pluginData.dashboardSettings.separateSectionForReferencedNotes) {
    logDebug('refreshSomeSections', `Removing any referenced sections from inherited set of sections. Started with ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
    existingSections = existingSections.filter((section) => !section.isReferenced)
    logDebug('refreshSomeSections', `removal → ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
  }

  // force the section refresh for the wanted sections
  const newSections = await getSomeSectionsData(sectionCodes, pluginData.demoMode, calledByTrigger)
  // logTimer('refreshSomeSections', startTime, `- after getSomeSectionsData(): [${getDisplayListOfSectionCodes(newSections)}]`)
  const mergedSections = mergeSections(existingSections, newSections)
  // logTimer('refreshSomeSections', startTime, `- after mergeSections(): [${getDisplayListOfSectionCodes(mergedSections)}]`)

  const updates: TAnyObject = { sections: mergedSections }
  // and update the total done counts
  // TODO: turning off for now, as was being called too often? Need to figure this out.
  // updates.totalDoneCounts = getTotalDoneCountsFromSections(mergedSections)

  if (!pluginData.refreshing === true) updates.refreshing = false
  await setPluginData(updates, `Finished refreshSomeSections for [${String(sectionCodes)}] (${timer(startTime)})`)
  // count sectionItems in all sections
  const totalSectionItems = mergedSections.reduce((acc, section) => acc + section.sectionItems.length, 0)
  // logDebug('refreshSomeSections', `Total section items: ${totalSectionItems} from [${sectionCodes.toString()}]`)
  logTimer('refreshSomeSections', startTime, `for refreshSomeSections: ${sectionCodes.toString()}`, 2000)
  return handlerResult(true, [], { sectionItems: totalSectionItems })
}
