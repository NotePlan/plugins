// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for refresh-related dashboard clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-01-04 for v2.4.0.b by @jgclark
//-----------------------------------------------------------------------------

import { WEBVIEW_WINDOW_ID } from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import { getDashboardSettings, getDisplayListOfSectionCodes, getNotePlanSettings, handlerResult, mergeSections, setPluginData } from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import { isTagMentionCacheGenerationScheduled, generateTagMentionCache } from './tagMentionCache'
import type { MessageDataObject, TBridgeClickHandlerResult, TPluginData } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getGlobalSharedData, sendBannerMessage } from '@helpers/HTMLView'

/********************************************************************************
 *                             Data types + constants
 *********************************************************************************/

/********************************************************************************
 *                                   HANDLERS
- Handlers should use the standard return type of TBridgeClickHandlerResult
- handlerResult() can be used to create the result object
- Types are defined in types.js
    - type TActionOnReturn = 'UPDATE_CONTENT' | 'REMOVE_LINE' | 'REFRESH_JSON' | 'START_DELAYED_REFRESH_TIMER' etc.
 *********************************************************************************/

/**
 * Tell the React window to update by re-generating all Sections.
 * Note: I don't think this is used anymore (by v2.4 if not v2.3)
 */
export async function refreshAllSections(): Promise<void> {
  try {
    logInfo('refreshAllSections', `👉👉👉👉 Starting ...so update codebase to note it is still used!`)
    const startTime = new Date()
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    // show refreshing message until done
    await setPluginData({ refreshing: true, currentMaxPriorityFromAllVisibleSections: 0 }, 'Starting Refreshing all sections')

    // refresh all sections' data
    const newSections = await getAllSectionsData(reactWindowData.demoMode, false, false)
    const changedData = {
      refreshing: false,
      firstRun: false,
      sections: newSections,
      lastFullRefresh: new Date(),
    }
    await setPluginData(changedData, 'Finished Refreshing all sections')
    logTimer('refreshAllSections', startTime, `at end for all sections`)

    // re-calculate all done task counts (if the appropriate setting is on)
    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const config: any = await getDashboardSettings()
      const totalDoneCount = await updateDoneCountsFromChangedNotes(`end of refreshAllSections()`, config.FFlag_ShowSectionTimings === true)
      const changedData = {
        totalDoneCount: totalDoneCount,
        firstRun: false, // Ensure firstRun remains false after refresh completes
      }
      await setPluginData(changedData, 'Updating doneCounts at end of refreshAllSections')
    }

    // Finally, if relevant, rebuild the tag mention cache.
    if (isTagMentionCacheGenerationScheduled()) {
      logInfo('refreshAllSections', `- now generating scheduled tag mention cache`)
      await generateTagMentionCache()
    }
  }
  catch (error) {
    // try to close the modal spinner and reset firstRun flag, if necessary
    await setPluginData({ refreshing: false, firstRun: false }, `Error in refreshAllSections; resetting state`)
    logError('refreshAllSections', error)
    await sendBannerMessage(WEBVIEW_WINDOW_ID, `Error in refreshAllSections: ${error.message}`, 'ERROR')
  }
}

/**
 * Loop through sectionCodes and tell the React window to update by re-generating a subset of Sections.
 * This is used on first launch to improve the UX and speed of first render.
 * Each section is returned to React as it's generated.
 * Today loads first and then this function is automatically called from a useEffect in Dashboard.jsx to load the rest.
 * TODO: DBW thinks this generates way more updates than necessary. Or is it that it is being called more often than necessary?
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
    const start = new Date()
    const { sectionCodes } = data
    if (!sectionCodes) {
      throw new Error('No sections to incrementally refresh. If this happens again, please report it to the developer.')
    }
    // logDebug('incrementallyRefreshSomeSections', `[ENCODING DEBUG] ===== incrementallyRefreshSomeSections CALLED for sections [${String(sectionCodes)}] =====`)
    logDebug('incrementallyRefreshSomeSections', `Starting incremental refresh for sections [${String(sectionCodes)}]`)
    await setPluginData({ refreshing: true }, `Starting incremental refresh for sections ${String(sectionCodes)}`)

    // loop through sectionCodes
    for (const sectionCode of sectionCodes) {
      await refreshSomeSections({ ...data, sectionCodes: [sectionCode] }, calledByTrigger)
    }
    const updates: any = { refreshing: false, firstRun: false }
    if (setFullRefreshDate) updates.lastFullRefresh = new Date()
    await setPluginData(updates, `Ending incremental refresh for sections ${String(sectionCodes)} (after ${timer(start)})`)
    logTimer('incrementallyRefreshSomeSections', start, `- to refresh ${sectionCodes.length} sections: ${sectionCodes.toString()}`)

    // re-calculate done task counts (if the appropriate setting is on)
    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const startTime = new Date()
      const config: any = await getDashboardSettings()
      const totalDoneCount = await updateDoneCountsFromChangedNotes(`update done counts at end of incrementallyRefreshSomeSections (for [${sectionCodes.join(',')}])`, config.FFlag_ShowSectionTimings === true)
      const changedData = {
        totalDoneCount: totalDoneCount,
        firstRun: false, // Ensure firstRun remains false after generation completes
      }
      await setPluginData(changedData, 'Updating doneCounts at end of incrementallyRefreshSomeSections')
      logTimer('incrementallyRefreshSomeSections', startTime, `- to calculate done counts at end of incrementallyRefreshSomeSections`, 200)
    }

    // Finally, if relevant, rebuild the tag mention cache.
    if (isTagMentionCacheGenerationScheduled()) {
      logInfo('incrementallyRefreshSomeSections', `- generating scheduled tag mention cache`)
      const _promise = generateTagMentionCache() // no await, as we don't want to block the UI
    }

    return handlerResult(true)
  }
  catch (error) {
    // try to close the modal spinner and reset firstRun flag, if necessary
    await setPluginData({ refreshing: false, firstRun: false }, `Error in incrementallyRefreshSomeSections; closing modal spinner`)
    logError('incrementallyRefreshSomeSections', error)
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
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
  try {
    const startTime = new Date()
    
    // Log encoding for debugging emoji corruption - check data right after generation
    // logDebug('refreshSomeSections', `[ENCODING DEBUG] ===== refreshSomeSections CALLED for sections: ${String(data.sectionCodes)} =====`)
    const { sectionCodes } = data
    if (!sectionCodes) {
      throw new Error('No sections to refresh. If this happens again, please report it to the developer.')
    }

    logDebug('refreshSomeSections', `Starting for ${String(sectionCodes)}`)
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const pluginData: TPluginData = reactWindowData.pluginData
    // show refreshing message until done
    if (!pluginData.refreshing === true) await setPluginData({ refreshing: sectionCodes, currentMaxPriorityFromAllVisibleSections: 0 }, `Starting refresh for sections ${sectionCodes.toString()}`)
    let existingSections = pluginData.sections

    // Now remove any referenced sections if separateSectionForReferencedNotes is now off
    if (!pluginData.dashboardSettings.separateSectionForReferencedNotes) {
      logDebug('refreshSomeSections', `Removing any referenced sections from inherited set of sections. Started with ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
      existingSections = existingSections.filter((section) => !section.isReferenced)
      logDebug('refreshSomeSections', `removal -> ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
    }

    // Now remove any sections that no longer match the sectionCodes to display.
    // Note: this is clearly done somewhere else! (so won't do here as well)

    // Force the wanted sections to refresh
    const newSections = await getSomeSectionsData(sectionCodes, pluginData.demoMode, calledByTrigger)
    // // Log encoding for debugging emoji corruption - check data right after getSomeSectionsData
    // // Check ALL titles that contain "Dashboard Plugin" to catch corruption
    // for (const section of newSections || []) {
    //   for (const item of section.sectionItems || []) {
    //     const title = item.para?.title
    //     if (title && title.includes('Dashboard Plugin')) {
    //       const charCodes = title.split('').map(c => c.charCodeAt(0)).join(',')
    //       logDebug('refreshSomeSections', `[ENCODING DEBUG] AFTER getSomeSectionsData - Section ${section.sectionCode}, title: "${title}" (length=${title.length}, charCodes=${charCodes})`)
    //     }
    //   }
    // }

    // logTimer('refreshSomeSections', startTime, `- after getSomeSectionsData(): [${getDisplayListOfSectionCodes(newSections)}]`)
    const mergedSections = mergeSections(existingSections, newSections)

    // // Log encoding for debugging emoji corruption - check data right after mergeSections
    // // Check ALL titles that contain "Dashboard Plugin" to catch corruption
    // for (const section of mergedSections || []) {
    //   for (const item of section.sectionItems || []) {
    //     const title = item.para?.title
    //     if (title && title.includes('Dashboard Plugin')) {
    //       const charCodes = title.split('').map(c => c.charCodeAt(0)).join(',')
    //       logDebug('refreshSomeSections', `[ENCODING DEBUG] AFTER mergeSections - Section ${section.sectionCode}, title: "${title}" (length=${title.length}, charCodes=${charCodes})`)
    //     }
    //   }
    // }
    // logTimer('refreshSomeSections', startTime, `- after mergeSections(): [${getDisplayListOfSectionCodes(mergedSections)}]`)

    const updates: TAnyObject = { sections: mergedSections }

    // Log encoding for debugging emoji corruption - check data right before setPluginData
    // Check ALL titles that contain "Dashboard Plugin" to catch corruption
    // for (const section of updates.sections || []) {
    //   for (const item of section.sectionItems || []) {
    //     if (item.para?.title && item.para.title.includes('Dashboard Plugin')) {
    //       const charCodes = item.para.title.split('').map(c => c.charCodeAt(0)).join(',')
    //       logDebug('refreshSomeSections', `[ENCODING DEBUG] BEFORE setPluginData - Section ${section.sectionCode}, title: "${item.para.title}" (length=${item.para.title.length}, charCodes=${charCodes})`)
    //     }
    //   }
    // }

    // Update the total done counts. 
    // Note: this is being done somewhere else, so turning off here
    // updates.totalDoneCounts = getTotalDoneCountsFromSections(mergedSections)

    if (!pluginData.refreshing === true) updates.refreshing = false
    await setPluginData(updates, `Finished refreshSomeSections for [${String(sectionCodes)}] (${timer(startTime)})`)

    // count sectionItems in all sections
    const totalSectionItems = mergedSections.reduce((acc, section) => acc + section.sectionItems.length, 0)
    // logDebug('refreshSomeSections', `Total section items: ${totalSectionItems} from [${sectionCodes.toString()}]`)
    logTimer('refreshSomeSections', startTime, `for section(s) ${sectionCodes.toString()}`, 2000)
    return handlerResult(true, [], { sectionItems: totalSectionItems })
  }
  catch (error) {
    // try to close the modal spinner
    await setPluginData({ refreshing: false }, `Error in refreshSomeSections; closing modal spinner`)
    logError('refreshSomeSections', error.message)
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}
