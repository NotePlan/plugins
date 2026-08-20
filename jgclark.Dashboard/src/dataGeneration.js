// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2026-08-20 for v2.4.0.b67 by @CursorAI + @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSectionCode, TSection } from './types'
import { allSectionCodes } from './constants.js'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  isCurrentRemindersEnabled,
  isUndatedOverdueRemindersEnabled,
  isTBSectionEnabled,
} from './dashboardHelpers'
import {
  flattenYesterdayOpenItemParas,
  getTodaySectionData,
  getTimeBlockSectionData,
  getTomorrowSectionData,
  getYesterdayOpenItemParas,
  getYesterdaySectionData,
} from './dataGenerationDays'
import { getOverdueSectionData } from './dataGenerationOverdue'
import { getThisMonthSectionData, getThisQuarterSectionData, getThisYearSectionData } from './dataGenerationPeriods'
import { getPrioritySectionData } from './dataGenerationPriority'
import { getProjectReviewSectionData, getProjectActiveSectionData } from './dataGenerationProjects'
import { getRemindersGeneratedData, type TRemindersGeneratedData } from './dataGenerationReminders'
import { getSavedSearchResults } from './dataGenerationSearch'
import { getTaggedSectionData } from './dataGenerationTags'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks'
import type { TReminderPlacement } from './reminderPlacement'
import { getTagSectionDetails, selectTagSectionsToGenerate } from './react/components/Section/sectionHelpers'
import type { TReminderDisplayById } from '@helpers/NPReminders'
import { getNestedValue, setNestedValue } from '@helpers/dataManipulation'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getLiveWindowRect, getStoredWindowRect, rectToString } from '@helpers/NPWindows'

//-----------------------------------------------------------------

/**
 * Result from getSomeSectionsData / getAllSectionsData: section payloads plus optional reminder display lookup.
 */
export type TSomeSectionsDataResult = {
  sections: Array<TSection>,
  reminderDisplayById?: TReminderDisplayById,
}

/**
 * Whether generating any of the given section codes requires fetching Apple Reminders
 * (for REM itself and/or injection into TB / day sections / Overdue).
 * @param {Array<TSectionCode>} sectionCodesToGet
 * @param {TDashboardSettings} config
 * @returns {boolean}
 */
export function sectionCodesNeedRemindersFetch(sectionCodesToGet: Array<TSectionCode>, config: TDashboardSettings): boolean {
  const currentRemindersEnabled = isCurrentRemindersEnabled(config)
  const undatedOverdueRemindersEnabled = isUndatedOverdueRemindersEnabled(config)
  const wantRemSection = sectionCodesToGet.includes('REM') && undatedOverdueRemindersEnabled
  const wantRemForDaySections =
    currentRemindersEnabled &&
    (sectionCodesToGet.includes('DT') ||
      sectionCodesToGet.includes('DY') ||
      sectionCodesToGet.includes('DO') ||
      sectionCodesToGet.includes('TB'))
  const wantRemForOverdue =
    undatedOverdueRemindersEnabled && sectionCodesToGet.includes('OVERDUE') && Boolean(config.showOverdueSection)
  return wantRemSection || wantRemForDaySections || wantRemForOverdue
}

/**
 * Empty reminders payload used when Reminders are off or not needed for this batch.
 * @returns {TRemindersGeneratedData}
 */
function emptyRemindersGeneratedData(): TRemindersGeneratedData {
  return {
    placement: {
      forDT: [],
      forTB: [],
      forDY: [],
      forDO: [],
      forOVERDUE: [],
      forREM: [],
      remBucketsLabel: '',
      homeless: [],
    },
    remindersSection: null,
    displayById: {},
  }
}

//-----------------------------------------------------------------

/**
 * Config used when generating section payloads.
 * Demo mode never includes section timings in the UI (even if FFlag_ShowSectionTimings is on for live use).
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData
 * @returns {TDashboardSettings}
 */
export function applyDemoModeGenerationOverrides(config: TDashboardSettings, useDemoData: boolean): TDashboardSettings {
  if (!useDemoData || !config.FFlag_ShowSectionTimings) return config
  return { ...config, FFlag_ShowSectionTimings: false }
}

/**
 * Generate data for all the sections (that the user currently wants)
 * Note: don't forget there's also refreshClickHandlers.js::incrementallyRefreshSomeSections() and refreshSomeSections().
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @param {?TDashboardSettings} configOverride - when set, used instead of disk-only settings (open WebView refresh)
 * @returns {TSomeSectionsDataResult}
 */
export async function getAllSectionsData(
  useDemoData: boolean = false,
  forceLoadAll: boolean = false,
  useEditorWherePossible: boolean,
  configOverride?: ?TDashboardSettings,
): Promise<TSomeSectionsDataResult> {
  try {
    const config: any = configOverride ?? (await getDashboardSettings())

    // V2
    // Work out which sections to show
    const sectionsToShow: Array<TSectionCode> = forceLoadAll ? allSectionCodes : getListOfEnabledSections(config)
    logDebug('getAllSectionsData', `>>>>> Starting with ${String(sectionsToShow.length)} sections to show: ${String(sectionsToShow)}`)
    const { sections, reminderDisplayById } = await getSomeSectionsData(sectionsToShow, useDemoData, useEditorWherePossible, config)
    logDebug('getAllSectionsData', `<<<<< Finished`)

    return {
      sections: sections.filter((s) => s),
      reminderDisplayById,
    }
  } catch (error) {
    logError('getAllSectionsData', error.message)
    return { sections: [] }
  }
}

/**
 * Generate data for some specified sections (subject to user currently wanting them as well).
 * Note: Returns all wanted sections in one go.
 * Note: don't forget there's also refreshClickHandlers.js::incrementallyRefreshSomeSections() and refreshSomeSections()
 * @param {Array<string>} sectionCodesToGet (default: allSectionCodes)
 * @param {boolean} useDemoData (default: false)
 * @param {boolean} useEditorWherePossible?
 * @param {?TDashboardSettings} configOverride - when set (e.g. open WebView live settings), used instead of disk-only `getDashboardSettings()`
 * @param {?Array<string>} tagsToGenerate - when TAG is requested, optional subset of tag/mention names to generate (exact match to tagsToShow entries). Omit or empty = all enabled tags.
 * @param {?TRemindersGeneratedData} cachedRemindersData - when set (e.g. incremental startup prefetch), skips a repeat remindersByLists fetch for this batch
 * @returns {TSomeSectionsDataResult}
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  configOverride?: ?TDashboardSettings,
  tagsToGenerate?: ?Array<string>,
  cachedRemindersData?: ?TRemindersGeneratedData,
): Promise<TSomeSectionsDataResult> {
  try {
    logDebug('getSomeSectionsData', `🔹 Starting with ${sectionCodesToGet.toString()}${tagsToGenerate && tagsToGenerate.length > 0 ? ` tagsToGenerate=[${tagsToGenerate.join(',')}]` : ''} ...`)
    const baseConfig: TDashboardSettings = configOverride ?? (await getDashboardSettings())
    const config: TDashboardSettings = applyDemoModeGenerationOverrides(baseConfig, useDemoData)

    // Generation order is dependency-driven (Reminders / Yesterday / Overdue coupling, Projects, then slower sections).
    // Display order is owned by React via customSectionDisplayOrder -- do not reorder generation to match display.
    // An earlier attempt to generate in display order broke Project section generation (24.1.2026).

    let sections: Array<TSection> = []
    if (sectionCodesToGet.includes('INFO')) sections.push(...(await getInfoSectionData(config, useDemoData)))

    // Generate Reminders first when needed for day/TB/OVERDUE injection and/or the REM section itself.
    // Reminder date bucketing + section placement lives in reminderPlacement.js (not here).
    const undatedOverdueRemindersEnabled = isUndatedOverdueRemindersEnabled(config)
    const wantRemSection = sectionCodesToGet.includes('REM') && undatedOverdueRemindersEnabled
    const needRemindersFetch = sectionCodesNeedRemindersFetch(sectionCodesToGet, config)
    let remindersData: TRemindersGeneratedData = emptyRemindersGeneratedData()
    if (needRemindersFetch) {
      if (cachedRemindersData) {
        logDebug('getSomeSectionsData', `- using prefetched Reminders data for [${sectionCodesToGet.toString()}] (skipping remindersByLists)`)
        remindersData = cachedRemindersData
      } else {
        remindersData = await getRemindersGeneratedData(config, useDemoData)
      }
    }
    const placement: TReminderPlacement = remindersData.placement

    // -------------------------------------------------------------------------
    // Yesterday / Overdue task routing (orchestrator owns placement for tasks only).
    // Reminder placement is already resolved in placement above.
    // Tasks:
    //   DY on  -> Yesterday section; when OVERDUE also on, same paras used to dedupe overdue
    //   DY off -> spill open yesterday calendar/ref tasks into Overdue
    //            (listOverdueTasks does not return undated opens sitting in yesterday's note)
    // -------------------------------------------------------------------------
    const wantDY = sectionCodesToGet.includes('DY') && Boolean(config.showYesterdaySection)
    const wantOVERDUE = sectionCodesToGet.includes('OVERDUE') && Boolean(config.showOverdueSection)

    // Shared yesterday task fetch when either DY or OVERDUE needs those paras (skip demo: generators use demoData)
    let yesterdayOpenAndRef: ?[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] = null
    if (!useDemoData && (wantDY || wantOVERDUE)) {
      yesterdayOpenAndRef = getYesterdayOpenItemParas(config, useEditorWherePossible)
    }
    const yesterdayFlatTasks: Array<TParagraphForDashboard> = yesterdayOpenAndRef
      ? flattenYesterdayOpenItemParas(yesterdayOpenAndRef[0], yesterdayOpenAndRef[1])
      : []
    // DY off + OVERDUE on -> spill yesterday open tasks into Overdue
    const yesterdaySpillTaskParas: Array<TParagraphForDashboard> =
      !config.showYesterdaySection && wantOVERDUE ? yesterdayFlatTasks : []
    // DY on + OVERDUE on -> strip DY content from overdue (React Hide Duplicates is the display safety net)
    const yesterdayParasForOverdueDedupe: Array<TParagraphForDashboard> =
      config.showYesterdaySection && wantOVERDUE ? yesterdayFlatTasks : []
    if (yesterdaySpillTaskParas.length > 0) {
      logDebug('getSomeSectionsData', `- DY off: spilling ${String(yesterdaySpillTaskParas.length)} yesterday open task(s) into OVERDUE`)
    }

    if (placement.homeless.length > 0) {
      const parts = placement.homeless.map((h) => `${String(h.count)} ${h.label}`)
      logWarn('getSomeSectionsData', `- ${parts.join('; ')} reminder(s) have no visible section and will not be shown anywhere`)
    }

    // DT and TB sections are generated separately but share paragraph data fetching
    if (sectionCodesToGet.includes('DT')) {
      const todaySections = getTodaySectionData(config, useDemoData, useEditorWherePossible, placement.forDT)
      sections.push(...todaySections)
    }
    if (sectionCodesToGet.includes('TB') && isTBSectionEnabled(config)) {
      sections.push(...getTimeBlockSectionData(config, useDemoData, useEditorWherePossible, placement.forTB))
    }

    if (wantRemSection && remindersData.remindersSection) {
      sections.push(remindersData.remindersSection)
    }
    if (wantDY) {
      // Pass shared prefetch so we do not scan yesterday's note twice when OVERDUE also needs it
      sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible, placement.forDY, yesterdayOpenAndRef))
    }
    if (sectionCodesToGet.includes('DO') && config.showTomorrowSection) {
      sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible, placement.forDO))
    }
    if (sectionCodesToGet.includes('LW') && config.showLastWeekSection) sections.push(...getLastWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Y') && config.showYearSection) sections.push(...getThisYearSectionData(config, useDemoData, useEditorWherePossible))

    // moderately quick to generate
    if (sectionCodesToGet.includes('PROJACT') && config.showProjectActiveSection) {
      logDebug('getSomeSectionsData', `🔹 Getting Project section data as part of ${sectionCodesToGet.toString()}`)
      const projectSection = await getProjectActiveSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }
    if (sectionCodesToGet.includes('PROJREVIEW') && config.showProjectReviewSection) {
      logDebug('getSomeSectionsData', `🔹 Getting Project section data as part of ${sectionCodesToGet.toString()}`)
      const projectSection = await getProjectReviewSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }

    // The rest can all be slow to generate
    if (sectionCodesToGet.includes('SAVEDSEARCH')) sections.push(...(await getSavedSearchResults(config, useDemoData)))

    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      // Bulk TAG = all enabled tags; optional tagsToGenerate refreshes only those names (stable IDs allow merge).
      // Display interleaving of individual tags among other section types remains React/tagsToShow order for now.
      const tagSections = selectTagSectionsToGenerate(getTagSectionDetails(config), tagsToGenerate)
      for (const tagSection of tagSections) {
        // Cast: showSettingName is a dynamic `showTagSection_<tag>` key, so it can only be read through an indexed type.
        // TDashboardSettings deliberately has no indexer, to keep its keys checked.
        const showSettingForTag = (config: TAnyObject)[tagSection.showSettingName]
        if (typeof showSettingForTag === 'undefined' || showSettingForTag) {
          const newSection = await getTaggedSectionData(config, useDemoData, tagSection)
          if (newSection) sections.push(newSection)
        }
      }
    }

    if (wantOVERDUE) {
      const overdueSection = await getOverdueSectionData(config, useDemoData, placement.forOVERDUE, yesterdaySpillTaskParas, yesterdayParasForOverdueDedupe)
      if (overdueSection) sections.push(overdueSection)
    }

    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) {
      const prioritySection = await getPrioritySectionData(config, useDemoData)
      if (prioritySection) sections.push(prioritySection)
    }

    // Note: The WINS section is generated separately in the front end after the other sections are generated.

    // get rid of any nulls b/c just in case any the sections above could return null
    sections = sections.filter((s) => s)

    const reminderDisplayById =
      needRemindersFetch && Object.keys(remindersData.displayById).length > 0 ? remindersData.displayById : undefined

    return { sections, reminderDisplayById }
  } catch (error) {
    logError('getSomeSectionsData', error.message)
    return { sections: [] }
  }
}

/**
 * Get data for the Info section
 * @param {TDashboardSettings} _config
 * @param {boolean} _useDemoData?
 * @returns {Array<TSection>} data
 */
export async function getInfoSectionData(config: TDashboardSettings, _useDemoData: boolean = false): Promise<Array<TSection>> {
  const sections: Array<TSection> = []
  const thisSectionCode = 'INFO'
  const outputLines = []
  outputLines.push(`Device name '${NotePlan.environment.machineName}' (${NotePlan.environment.platform}) running NP v${NotePlan.environment.versionNumber} build ${NotePlan.environment.buildVersion}, and Dashboard v${pluginJson['plugin.version']}-${pluginJson['plugin.releaseStatus']}.`)
  outputLines.push(`Screen: ${NotePlan.environment.screenWidth}x${NotePlan.environment.screenHeight}. Window type requested: ${config?.preferredWindowType ?? '?'}`)
  const storedWindowRect: Rect | false = getStoredWindowRect('jgclark.Dashboard.main')
  const liveWindowRect: Rect | false = getLiveWindowRect('')
  if (liveWindowRect) { outputLines.push(`Live window rect: ${rectToString(liveWindowRect)}`) }
  outputLines.push(`Stored window rect: ${storedWindowRect ? rectToString(storedWindowRect) : 'no stored window rect'}`)
  sections.push({
    ID: thisSectionCode,
    name: 'Info',
    showSettingName: 'showInfoSection',
    sectionCode: thisSectionCode,
    description: 'Window Details',
    FAIconClass: 'fa-light fa-info-circle',
    sectionTitleColorPart: 'DefaultSectionColor',
    sectionItems: outputLines.map((line) => ({
      ID: `${thisSectionCode}-${line}`,
      sectionCode: thisSectionCode,
      itemType: 'info',
      message: line.trim(),
    })),
    isReferenced: false,
  })
  return sections
}

//-----------------------------------------------------------------

/**
 * Copies specified fields from a provided object into the corresponding sectionItems in the sections array.
 *
 * @param {Array<SectionItemIndex>} results - An array of results from the findSectionItems function, containing section and item indices.
 * @param {Array<string>} fieldPathsToReplace - An array of field paths (maybe nested) within TSectionItem (e.g. ['itemType', 'para.filename']) to copy from the provided object.
 * @param {Object} updatedValues - The object containing the field values to be copied -- the keys are the field paths (can be strings with dots, e.g. para.filename) and the values are the values to copy.
 * @param {Array<TSection>} sections - The original sections array to be modified.
 * @returns {Array<TSection>} The modified sections array with the specified fields copied into the corresponding sectionItems.
 */
export function copyUpdatedSectionItemData(
  results: Array<{ sectionIndex: number, itemIndex: number }>,
  fieldPathsToReplace: Array<string>,
  updatedValues: { [key: string]: any },
  sections: Array<TSection>,
): Array<TSection> {
  results.forEach(({ sectionIndex, itemIndex }) => {
    const sectionItem = sections[sectionIndex].sectionItems[itemIndex]

    fieldPathsToReplace.forEach((fieldPath) => {
      // const [firstField, ...remainingPath] = fieldPath.split('.')
      const value = getNestedValue(updatedValues, fieldPath)
      if (value !== undefined) {
        setNestedValue(sectionItem, fieldPath, value)
      }
    })
    sectionItem.updated = true
  })

  return sections
}
