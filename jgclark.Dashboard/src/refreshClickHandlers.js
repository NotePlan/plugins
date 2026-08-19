// @flow
//-----------------------------------------------------------------------------
// clickHandlers.js
// Handler functions for refresh-related dashboard clicks that come over the bridge.
// The routing is in pluginToHTMLBridge.js/bridgeClickDashboardItem()
// Last updated 2026-08-19 for v2.4.0.b65 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { SYNTHETIC_SECTION_CODES, WEBVIEW_WINDOW_ID } from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import {
  getDashboardSettingsForOpenWebView,
  getDisplayListOfSectionCodes,
  getNotePlanSettings,
  handlerResult,
  mergeSections,
  setPluginData,
  isTBSectionEnabled,
  isUndatedOverdueRemindersEnabled,
} from './dashboardHelpers'
import { getSomeSectionsData, sectionCodesNeedRemindersFetch } from './dataGeneration'
import { getRemindersGeneratedData, type TRemindersGeneratedData } from './dataGenerationReminders'
import { syncTagSectionsWithSettings } from './dashboardSettingsClean'
import { isTagMentionCacheGenerationScheduled, generateTagMentionCache } from './tagMentionCache'
import type { MessageDataObject, TAnyObject, TBridgeClickHandlerResult, TPluginData, TSection } from './types'
import { mergeReminderDisplayById } from '@helpers/NPReminders'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getGlobalSharedData } from '@helpers/HTMLView'
import { isHTMLWindowOpen, storeWindowRect } from '@helpers/NPWindows'

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
 * Loop through sectionCodes and tell the React window to update by re-generating a subset of Sections.
 * Used on first launch (from reactWindowInitialisedSoStartGeneratingData after Dashboard.jsx reports ready) and on full Refresh,
 * so each section can pop in as it is generated.
 *
 * One UPDATE_DATA per section is intentional for that UX. Extra redraws used to come from:
 * - a React useEffect ping-pong after Today loaded (removed; plugin now generates the full enabled list)
 * - a trailing setPluginData for refreshing/firstRun after the last section (now folded into that last section update)
 * - callers using this for 1-3 section post-action refreshes (those now use refreshSomeSections)
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
    if (!sectionCodes || sectionCodes.length === 0) {
      throw new Error('No sections to incrementally refresh. If this happens again, please report it to the developer.')
    }

    if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      logInfo('incrementallyRefreshSomeSections', `- my window is not visible, so not refreshing`)
      return handlerResult(false, [], { errorMsg: 'Dashboard window not visible, so not refreshing', errorMessageLevel: 'INFO' })
    }

    // Opportunistic window size/position save (no WebView JS). Captures pure moves while open; closes the gap if
    // onViewWillDisappear never delivers windowResized (common for floating HTML windows).
    storeWindowRect(WEBVIEW_WINDOW_ID)

    logDebug('incrementallyRefreshSomeSections', `Starting incremental refresh for sections [${String(sectionCodes)}]`)
    await setPluginData({ refreshing: true }, `Starting incremental refresh for sections ${String(sectionCodes)}`)

    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const config = await getDashboardSettingsForOpenWebView(reactWindowData?.pluginData?.dashboardSettings)
    const demoMode = reactWindowData?.pluginData?.demoMode ?? false

    // Prefetch Reminders once for the whole batch. Each per-section refresh would otherwise call
    // Calendar.remindersByLists again (TB, REM, DT, DY, DO, OVERDUE each trigger placement).
    let cachedRemindersData: ?TRemindersGeneratedData = null
    if (sectionCodesNeedRemindersFetch(sectionCodes, config)) {
      logDebug('incrementallyRefreshSomeSections', `Prefetching Reminders once for incremental refresh of ${String(sectionCodes.length)} sections`)
      cachedRemindersData = await getRemindersGeneratedData(config, demoMode)
    }

    // One UPDATE_DATA per section (progressive pop-in). Fold spinner/firstRun/lastFullRefresh into the last
    // section patch so React does not redraw everything again after the last section is already on screen.
    const endFlags: TAnyObject = { refreshing: false, firstRun: false }
    if (setFullRefreshDate) endFlags.lastFullRefresh = new Date()
    for (let i = 0; i < sectionCodes.length; i++) {
      const sectionCode = sectionCodes[i]
      const extraPatch = i === sectionCodes.length - 1 ? endFlags : null
      await refreshSomeSections({ ...data, sectionCodes: [sectionCode] }, calledByTrigger, cachedRemindersData, extraPatch)
    }
    logTimer('incrementallyRefreshSomeSections', start, `- to generate ${sectionCodes.length} sections: ${sectionCodes.toString()}`)

    // Header done counts after sections have been sent (this scan can take >1s)
    const NPSettings = await getNotePlanSettings()
    if (NPSettings.doneDatesAvailable) {
      const startTime = new Date()
      const totalDoneCount = await updateDoneCountsFromChangedNotes(`update done counts at end of incrementallyRefreshSomeSections (for [${sectionCodes.join(',')}])`)
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
      const _promise = generateTagMentionCache('After incrementally refreshing some sections, as scheduled') // no await, as we don't want to block the UI
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
 * Generate the given sectionCodes in one shot and replace pluginData.sections wholesale.
 * One setPluginData (no merge). Used for perspective switch: one paint after the sections: [] wipe,
 * so we do not re-serialize a growing list N times while the switch spinner hides pop-in.
 * Caller must pass the complete set of sectionCodes to show.
 *
 * Does not recount header done-task totals. That total is all completions today anywhere, not
 * perspective-scoped, so a switch cannot change it. The scan (`updateDoneCountsFromChangedNotes`)
 * is synchronous and often >1s; running it here kept the "Switching perspectives" spinner up after
 * the new sections were already on screen.
 *
 * Clears `perspectiveChanging` in the same payload as the new sections. A follow-up
 * `setPluginData({ perspectiveChanging: false })` would `getGlobalSharedData` (serialize the whole
 * window state back to the plugin) immediately after posting a large UPDATE_DATA, which blocks the
 * WebView from painting for several seconds.
 *
 * @param {MessageDataObject} data - must include sectionCodes
 * @returns {TBridgeClickHandlerResult}
 */
export async function batchReplaceSections(data: MessageDataObject): Promise<TBridgeClickHandlerResult> {
  try {
    const start = new Date()
    const { sectionCodes } = data
    if (!sectionCodes) {
      throw new Error('No sections to replace. If this happens again, please report it to the developer.')
    }

    // - add check for window visibility to prevent errors when window is not visible
    if (!isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      logInfo('batchReplaceSections', `- my window is not visible, so not replacing sections`)
      return handlerResult(false, [], { errorMsg: 'Dashboard window not visible, so not refreshing', errorMessageLevel: 'INFO' })
    }

    logDebug('batchReplaceSections', `Starting batch replace for sections [${String(sectionCodes)}]`)
    await setPluginData({ refreshing: true }, `Starting batch replace for sections ${String(sectionCodes)}`)

    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    const demoMode = reactWindowData?.pluginData?.demoMode ?? false
    const config = await getDashboardSettingsForOpenWebView(reactWindowData?.pluginData?.dashboardSettings)
    const { sections: newSections, reminderDisplayById } = await getSomeSectionsData(sectionCodes, demoMode, false, config, data.tagsToGenerate)

    const pluginDataPatch: TAnyObject = { sections: newSections, refreshing: false, firstRun: false, perspectiveChanging: false }
    if (reminderDisplayById) {
      pluginDataPatch.reminderDisplayById = mergeReminderDisplayById(
        reactWindowData?.pluginData?.reminderDisplayById,
        reminderDisplayById,
      )
    }
    await setPluginData(
      pluginDataPatch,
      `Finished batch replace for [${String(sectionCodes)}] (${timer(start)})`,
    )
    logTimer('batchReplaceSections', start, `- to generate ${sectionCodes.length} sections: ${sectionCodes.toString()}`)

    // Do not recount header done counts here (not perspective-scoped; scan would hold the switch spinner). See JSDoc.

    // If scheduled, rebuild the tag/mention cache without blocking the switch spinner.
    if (isTagMentionCacheGenerationScheduled()) {
      logInfo('batchReplaceSections', `- generating scheduled tag mention cache`)
      const _promise = generateTagMentionCache('After batch replacing sections, as scheduled')
    }
    return handlerResult(true)
  }
  catch (error) {
    await setPluginData({ refreshing: false, firstRun: false, perspectiveChanging: false }, `Error in batchReplaceSections; closing modal spinner`)
    logError('batchReplaceSections', error)
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
 * @param {?TRemindersGeneratedData} cachedRemindersData? - prefetched Reminders payload reused across an incremental batch
 * @param {?TAnyObject} extraPluginDataPatch? - folded into this call's setPluginData (used by incrementallyRefreshSomeSections on the last section so spinner / firstRun / lastFullRefresh do not need a trailing extra redraw)
 * @returns {TBridgeClickHandlerResult}
 */
export async function refreshSomeSections(
  data: MessageDataObject,
  calledByTrigger: boolean = false,
  cachedRemindersData?: ?TRemindersGeneratedData,
  extraPluginDataPatch?: ?TAnyObject,
): Promise<TBridgeClickHandlerResult> {
  try {
    const startTime = new Date()
    let sectionCodesToRefresh = data.sectionCodes
    if (!sectionCodesToRefresh) {
      throw new Error('No sections to refresh. If this happens again, please report it to the developer.')
    }

    logDebug('refreshSomeSections', `Starting for ${String(sectionCodesToRefresh)}`)
    // Save window size and position first, before any WebView JS - this is often the last successful plugin entry while still open.
    if (isHTMLWindowOpen(WEBVIEW_WINDOW_ID)) {
      storeWindowRect(WEBVIEW_WINDOW_ID)
    }
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
    if (!reactWindowData?.pluginData) {
      logDebug('refreshSomeSections', 'Dashboard shared data not ready yet (no pluginData); cannot refresh')
      return handlerResult(false, [], {
        errorMsg: 'Dashboard shared data not ready yet (no pluginData); refresh skipped',
        errorMessageLevel: 'INFO',
      })
    }
    const pluginData: TPluginData = reactWindowData.pluginData
    if (pluginData.dashboardSettings && !isTBSectionEnabled(pluginData.dashboardSettings) && sectionCodesToRefresh.includes('TB')) {
      sectionCodesToRefresh = sectionCodesToRefresh.filter((sectionCode) => sectionCode !== 'TB')
      logDebug('refreshSomeSections', `Filtered TB from requested sections as Time Block and Current Reminders are both disabled -> ${String(sectionCodesToRefresh)}`)
      if (sectionCodesToRefresh.length === 0) {
        logDebug('refreshSomeSections', 'No eligible sections remain after filtering; skipping refresh')
        if (extraPluginDataPatch) {
          await setPluginData(extraPluginDataPatch, 'No eligible sections after TB filter; applying extra pluginData patch')
        }
        return handlerResult(true)
      }
    }
    if (sectionCodesToRefresh.includes('REM') && pluginData.dashboardSettings && !isUndatedOverdueRemindersEnabled(pluginData.dashboardSettings)) {
      sectionCodesToRefresh = sectionCodesToRefresh.filter((sectionCode) => sectionCode !== 'REM')
      logDebug('refreshSomeSections', `Filtered REM from requested sections as Undated/Overdue Reminders (or master Show Reminders) is disabled -> ${String(sectionCodesToRefresh)}`)
      if (sectionCodesToRefresh.length === 0) {
        logDebug('refreshSomeSections', 'No eligible sections remain after filtering; skipping refresh')
        if (extraPluginDataPatch) {
          await setPluginData(extraPluginDataPatch, 'No eligible sections after REM filter; applying extra pluginData patch')
        }
        return handlerResult(true)
      }
    }
    // show refreshing message until done
    // `refreshing` is not always a boolean: it can also be an array of section codes while a refresh is in flight.
    // Only start a new refresh marker when there is no active refresh already underway; otherwise preserve the current state.
    if (pluginData.refreshing !== true && !Array.isArray(pluginData.refreshing)) {
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
    const { sections: newSections, reminderDisplayById } = await getSomeSectionsData(
      sectionCodesToRefresh,
      pluginData.demoMode,
      calledByTrigger,
      config,
      data.tagsToGenerate,
      cachedRemindersData,
    )
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

    if (reminderDisplayById) {
      updates.reminderDisplayById = mergeReminderDisplayById(pluginData.reminderDisplayById, reminderDisplayById)
    } else if (cachedRemindersData?.displayById) {
      updates.reminderDisplayById = mergeReminderDisplayById(pluginData.reminderDisplayById, cachedRemindersData.displayById)
    }

    // Note: updating total done counts is being done elsewhere now

    // Refreshing flag for this payload:
    // - extraPluginDataPatch: parent incremental pass is finishing; its end flags (refreshing false, firstRun false, optional lastFullRefresh) go out with this section update.
    // - else this function started the in-flight marker above (pluginData.refreshing was not true and not an array at entry -- that snapshot is still what `pluginData` holds). Clear it here so a standalone refreshSomeSections does not leave the header spinning.
    // - else a parent already owns refreshing (true, or an array of codes); leave it alone.
    if (extraPluginDataPatch) {
      Object.assign(updates, extraPluginDataPatch)
    } else if (pluginData.refreshing !== true && !Array.isArray(pluginData.refreshing)) {
      updates.refreshing = false
    }
    await setPluginData(updates, `Finished refreshSomeSections for [${String(sectionCodesToRefresh)}] (${timer(startTime)})`)

    // count sectionItems in all sections
    const totalSectionItems = mergedSectionsClean.reduce((acc, section) => acc + section.sectionItems.length, 0)
    // logDebug('refreshSomeSections', `Total section items: ${totalSectionItems} from [${sectionCodes.toString()}]`)
    logTimer('refreshSomeSections', startTime, `- to generate ${sectionCodesToRefresh.length} section(s) ${sectionCodesToRefresh.toString()}`, 2000)
    return handlerResult(true, [], { sectionItems: totalSectionItems })
  }
  catch (error) {
    // try to close the modal spinner
    await setPluginData({ refreshing: false }, `Error in refreshSomeSections; closing modal spinner`)
    logError('refreshSomeSections', error.message)
    return handlerResult(false, [], { errorMsg: error.message, errorMessageLevel: 'ERROR' })
  }
}
