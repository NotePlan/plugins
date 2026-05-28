// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for refresh-related dashboard clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-05-28 for v2.4.0.b45 by @CursorAI
//-----------------------------------------------------------------------------

import { SYNTHETIC_SECTION_CODES, WEBVIEW_WINDOW_ID } from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import {
  getDashboardSettings,
  getDashboardSettingsForOpenWebView,
  getDisplayListOfSectionCodes,
  getNotePlanSettings,
  handlerResult,
  mergeSections,
  setPluginData,
} from './dashboardHelpers'
import { getAllSectionsData, getSomeSectionsData } from './dataGeneration'
import { syncTagSectionsWithSettings } from './dashboardSettingsClean'
import { isTagMentionCacheGenerationScheduled, generateTagMentionCache } from './tagMentionCache'
import type { MessageDataObject, TBridgeClickHandlerResult, TPluginData, TSection } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getGlobalSharedData, sendBannerMessage } from '@helpers/HTMLView'
import { isHTMLWindowOpen } from '@helpers/NPWindows'

/**
 * TAG names that appear more than once in the section list.
 * @param {Array<TSection>} sections
 * @returns {Array<string>}
 */
function getDuplicateTagSectionNames(sections: Array<TSection>): Array<string> {
  const counts: Map<string, number> = new Map()
  sections.forEach((section) => {
    if (section.sectionCode !== 'TAG') return
    const name = section.name ?? ''
    counts.set(name, (counts.get(name) ?? 0) + 1)
  })
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
}

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
 * Tell the React window to update by re-generating all enabled Sections.
 * Used from v2.4 for the 'Reload' button when run in a "main window".
 */
export async function refreshDashboard(): Promise<void> {
  try {
    logInfo('refreshDashboard', `Starting to refresh Dashboard...`)

    if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      logInfo('refreshDashboard', `- my window is not visible, so not refreshing`)
      return
    }
    const startTime = new Date()

    // show refreshing message until done
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    await setPluginData({ refreshing: true, currentMaxPriorityFromAllVisibleSections: 0 }, 'Starting Refreshing all sections')

    const config = await getDashboardSettingsForOpenWebView(reactWindowData?.pluginData?.dashboardSettings)
    // refresh all sections' data
    const newSections = await getAllSectionsData(reactWindowData.demoMode, false, false, config)
    const changedData = {
      refreshing: false,
      firstRun: false,
      sections: newSections,
      lastFullRefresh: new Date(),
    }
    await setPluginData(changedData, 'Finished Refreshing all enabled sections')
    logTimer('refreshDashboard', startTime, `finished for all enabled sections`)

    // re-calculate all done task counts (if the appropriate setting is on)
    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const config: any = await getDashboardSettings()
      const totalDoneCount = await updateDoneCountsFromChangedNotes(`end of refreshDashboard()`, config.FFlag_ShowSectionTimings === true)
      const changedData = {
        totalDoneCount: totalDoneCount,
        firstRun: false, // Ensure firstRun remains false after refresh completes
      }
      await setPluginData(changedData, 'Updating doneCounts at end of refreshAllSections')
    }

    // TEST: Now *not* rebuilding the tag mention cache.
    // if (isTagMentionCacheGenerationScheduled()) {
    //   logInfo('refreshDashboard', `- now generating scheduled tag mention cache`)
    //   await generateTagMentionCache('After refresh')
    // }
  }
  catch (error) {
    // try to close the modal spinner and reset firstRun flag, if necessary
    await setPluginData({ refreshing: false, firstRun: false }, `Error in refreshDashboard; resetting state`)
    logError('refreshDashboard', error)
    await sendBannerMessage(WEBVIEW_WINDOW_ID, `Error in refreshDashboard: ${error.message}`, 'ERROR')
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

    if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      logInfo('incrementallyRefreshSomeSections', `- my window is not visible, so not refreshing`)
      return handlerResult(false, [], { errorMsg: 'Dashboard window not visible, so not refreshing', errorMessageLevel: 'INFO' })
    }

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
      const _promise = generateTagMentionCache('After incrementallyRefreshSomeSections') // no await, as we don't want to block the UI
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
 * Refresh the given sections in one batch and send a single setPluginData.
 * Used for perspective switch to avoid multiple redraws (one update instead of N).
 * @param {MessageDataObject} data - must include sectionCodes
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSectionsBatch(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const start = new Date()
    const { sectionCodes } = data
    if (!sectionCodes) {
      throw new Error('No sections to refresh. If this happens again, please report it to the developer.')
    }

    // - add check for window visibility to prevent errors when window is not visible
    if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      logInfo('refreshSectionsBatch', `- my window is not visible, so not refreshing`)
      return handlerResult(false, [], { errorMsg: 'Dashboard window not visible, so not refreshing', errorMessageLevel: 'INFO' })
    }

    logDebug('refreshSectionsBatch', `Starting batch refresh for sections [${String(sectionCodes)}]`)
    await setPluginData({ refreshing: true }, `Starting batch refresh for sections ${String(sectionCodes)}`)

    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const demoMode = reactWindowData?.pluginData?.demoMode ?? false
    const config = await getDashboardSettingsForOpenWebView(reactWindowData?.pluginData?.dashboardSettings)
    const newSections = await getSomeSectionsData(sectionCodes, demoMode, false, config)

    await setPluginData(
      { sections: newSections, refreshing: false, firstRun: false },
      `Finished batch refresh for [${String(sectionCodes)}] (${timer(start)})`,
    )
    logTimer('refreshSectionsBatch', start, `- ${sectionCodes.length} sections: ${sectionCodes.toString()}`)

    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const startTime = new Date()
      const config: any = await getDashboardSettings()
      const totalDoneCount = await updateDoneCountsFromChangedNotes(
        `update done counts at end of refreshSectionsBatch (for [${sectionCodes.join(',')}])`,
        config.FFlag_ShowSectionTimings === true,
      )
      await setPluginData({ totalDoneCount, firstRun: false }, 'Updating doneCounts at end of refreshSectionsBatch')
      logTimer('refreshSectionsBatch', startTime, `- done counts`, 200)
    }
    if (isTagMentionCacheGenerationScheduled()) {
      logInfo('refreshSectionsBatch', `- generating scheduled tag mention cache`)
      const _promise = generateTagMentionCache('After incremental refresh of sections')
    }
    return handlerResult(true)
  }
  catch (error) {
    await setPluginData({ refreshing: false, firstRun: false }, `Error in refreshSectionsBatch; closing modal spinner`)
    logError('refreshSectionsBatch', error)
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}

/**
 * Tell the React window to update by re-generating a subset of Sections.
 * Returns them all in one shot vs incrementallyRefreshSomeSections which updates one at a time.
 *
 * NOTE: We now call getDashboardSettingsForOpenWebView() instead of getDashboardSettings() in order to always use
 * the live, in-memory settings as configured in the React window (which may include unsaved or temporarily overridden values),
 * rather than re-reading from disk or plugin settings. 
 * This ensures that section refreshes accurately reflect any UI-changes made by the user that haven't yet been persisted, 
 * keeping the view consistent with the current dashboard experience (rather than the stale settings on disk).
 *
 * @param {MessageDataObject} data
 * @param {boolean} calledByTrigger? (default: false)
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSomeSections(data: MessageDataObject, calledByTrigger: boolean = false): Promise<TBridgeClickHandlerResult> {
  try {
    const startTime = new Date()
    let sectionCodesToRefresh = data.sectionCodes
    if (!sectionCodesToRefresh) {
      throw new Error('No sections to refresh. If this happens again, please report it to the developer.')
    }

    logDebug('refreshSomeSections', `Starting for ${String(sectionCodesToRefresh)}`)
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    if (!reactWindowData?.pluginData) {
      logDebug('refreshSomeSections', 'Dashboard shared data not ready yet (no pluginData); cannot refresh')
      return handlerResult(false, [], {
        errorMsg: 'Dashboard shared data not ready yet (no pluginData); refresh skipped',
        errorMessageLevel: 'INFO',
      })
    }
    const pluginData: TPluginData = reactWindowData.pluginData
    if (pluginData.dashboardSettings?.showTimeBlockSection === false && sectionCodesToRefresh.includes('TB')) {
      sectionCodesToRefresh = sectionCodesToRefresh.filter((sectionCode) => sectionCode !== 'TB')
      logDebug('refreshSomeSections', `Filtered TB from requested sections as Time Block is disabled -> ${String(sectionCodesToRefresh)}`)
      if (sectionCodesToRefresh.length === 0) {
        logDebug('refreshSomeSections', 'No eligible sections remain after filtering; skipping refresh')
        return handlerResult(true)
      }
    }
    // show refreshing message until done
    if (!pluginData.refreshing === true) {
      await setPluginData(
        { refreshing: sectionCodesToRefresh, currentMaxPriorityFromAllVisibleSections: 0 },
        `Starting refresh for sections ${sectionCodesToRefresh.toString()}`,
      )
    }
    const config = await getDashboardSettingsForOpenWebView(pluginData.dashboardSettings)
    let existingSections = pluginData.sections

    // Now remove any referenced sections if separateSectionForReferencedNotes is now off
    if (!pluginData.dashboardSettings.separateSectionForReferencedNotes) {
      logDebug('refreshSomeSections', `Removing any referenced sections from inherited set of sections. Started with ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
      existingSections = existingSections.filter((section) => !section.isReferenced)
      logDebug('refreshSomeSections', `removal -> ${existingSections.length} sections [${getDisplayListOfSectionCodes(existingSections)}]`)
    }

    // Optional hardening: synthetic sections are React-only; strip them from pluginData before merge.
    existingSections = existingSections.filter((section) => !SYNTHETIC_SECTION_CODES.includes(section.sectionCode))

    // Keep TAG rows in sync with current tagsToShow + showTagSection_* toggles, and dedupe by name.
    existingSections = syncTagSectionsWithSettings(existingSections, config)

    // Force the wanted sections to refresh
    const newSections = await getSomeSectionsData(sectionCodesToRefresh, pluginData.demoMode, calledByTrigger, config)
    // logTimer('refreshSomeSections', startTime, `- after getSomeSectionsData(): [${getDisplayListOfSectionCodes(newSections)}]`)
    const mergedSections = mergeSections(existingSections, newSections)
    let mergedSectionsClean = mergedSections.filter((section) => !SYNTHETIC_SECTION_CODES.includes(section.sectionCode))
    mergedSectionsClean = syncTagSectionsWithSettings(mergedSectionsClean, config)
    const duplicateTagNames = getDuplicateTagSectionNames(mergedSectionsClean)
    if (duplicateTagNames.length > 0) {
      logWarn('refreshSomeSections', `Found duplicate TAG section names after merge: [${duplicateTagNames.join(', ')}] in [${getDisplayListOfSectionCodes(mergedSectionsClean)}]`)
    }
    // logTimer('refreshSomeSections', startTime, `- after mergeSections(): [${getDisplayListOfSectionCodes(mergedSectionsClean)}]`)

    const updates: TAnyObject = { sections: mergedSectionsClean }

    // Update the total done counts. 
    // Note: this is being done somewhere else, so turning off here
    // updates.totalDoneCounts = getTotalDoneCountsFromSections(mergedSections)

    if (!pluginData.refreshing === true) updates.refreshing = false
    await setPluginData(updates, `Finished refreshSomeSections for [${String(sectionCodesToRefresh)}] (${timer(startTime)})`)

    // count sectionItems in all sections
    const totalSectionItems = mergedSectionsClean.reduce((acc, section) => acc + section.sectionItems.length, 0)
    // logDebug('refreshSomeSections', `Total section items: ${totalSectionItems} from [${sectionCodes.toString()}]`)
    logTimer('refreshSomeSections', startTime, `for section(s) ${sectionCodesToRefresh.toString()}`, 2000)
    return handlerResult(true, [], { sectionItems: totalSectionItems })
  }
  catch (error) {
    // try to close the modal spinner
    await setPluginData({ refreshing: false }, `Error in refreshSomeSections; closing modal spinner`)
    logError('refreshSomeSections', error.message)
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}
