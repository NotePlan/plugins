// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2026-08-01 for v2.4.0.b60 by @jgclark + @CursorAI
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
import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import { getNestedValue, setNestedValue } from '@helpers/dataManipulation'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getLiveWindowRect, getStoredWindowRect, rectToString } from '@helpers/NPWindows'

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * Note: don't forget there's also refreshClickHandlers.js::refreshAllSections().
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @param {?TDashboardSettings} configOverride - when set, used instead of disk-only settings (open WebView refresh)
 * @returns {Array<TSection>} array of sections
 */
export async function getAllSectionsData(
  useDemoData: boolean = false,
  forceLoadAll: boolean = false,
  useEditorWherePossible: boolean,
  configOverride?: ?TDashboardSettings,
): Promise<Array<TSection>> {
  try {
    const config: any = configOverride ?? (await getDashboardSettings())
    // clo(config, 'getAllSectionsData config is currently',2)

    // V2
    // Work out which sections to show
    const sectionsToShow: Array<TSectionCode> = forceLoadAll ? allSectionCodes : getListOfEnabledSections(config)
    logDebug('getAllSectionsData', `>>>>> Starting with ${String(sectionsToShow.length)} sections to show: ${String(sectionsToShow)}`)
    const sections: Array<TSection> = await getSomeSectionsData(sectionsToShow, useDemoData, useEditorWherePossible, config)
    // logDebug('getAllSectionsData', `=> sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)
    logDebug('getAllSectionsData', `<<<<< Finished`)

    return sections.filter((s) => s) //get rid of any nulls b/c some of the sections above could return null
  } catch (error) {
    logError('getAllSectionsData', error.message)
    return []
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
 * @returns {Array<TSection>} array of sections
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  configOverride?: ?TDashboardSettings,
): Promise<Array<TSection>> {
  try {
    logDebug('getSomeSectionsData', `🔹 Starting with ${sectionCodesToGet.toString()} ...`)
    const config: TDashboardSettings = configOverride ?? (await getDashboardSettings())

    // TODO: change generation order to suit the new custom section display order.  Note: Cursor's attempt on 24.1.2026 to do this broke generation of Project sections.

    let sections: Array<TSection> = []
    if (sectionCodesToGet.includes('INFO')) sections.push(...(await getInfoSectionData(config, useDemoData)))

    // Generate Reminders first when needed for day/TB/OVERDUE injection and/or the REM section itself.
    // Reminder date bucketing + section placement lives in reminderPlacement.js (not here).
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
    let remindersData: TRemindersGeneratedData = {
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
    }
    if (wantRemSection || wantRemForDaySections || wantRemForOverdue) {
      remindersData = await getRemindersGeneratedData(config, useDemoData)
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
    const wantOD = sectionCodesToGet.includes('OVERDUE') && Boolean(config.showOverdueSection)

    // Shared yesterday task fetch when either DY or OVERDUE needs those paras (skip demo: generators use demoData)
    let yesterdayOpenAndRef: ?[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] = null
    if (!useDemoData && (wantDY || wantOD)) {
      yesterdayOpenAndRef = getYesterdayOpenItemParas(config, useEditorWherePossible)
    }
    const yesterdayFlatTasks: Array<TParagraphForDashboard> = yesterdayOpenAndRef
      ? flattenYesterdayOpenItemParas(yesterdayOpenAndRef[0], yesterdayOpenAndRef[1])
      : []
    // DY off + OVERDUE on -> spill yesterday open tasks into Overdue
    const yesterdaySpillTaskParas: Array<TParagraphForDashboard> =
      !config.showYesterdaySection && wantOD ? yesterdayFlatTasks : []
    // DY on + OVERDUE on -> strip DY content from overdue (React Hide Duplicates is the display safety net)
    const yesterdayParasForOverdueDedupe: Array<TParagraphForDashboard> =
      config.showYesterdaySection && wantOD ? yesterdayFlatTasks : []
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
      // TODO: change so that tags can be generated separately from each other, letting them be specified in the section order component.
      const tagSections = getTagSectionDetails(config)
      // clo(tagSections, 'getSomeSectionsData tagSections')
      let index = 0
      for (const tagSection of tagSections) {
        // $FlowIgnore[invalid-computed-prop]
        const showSettingForTag = config[tagSection.showSettingName]
        // logDebug('getSomeSectionsData', `💚 sectionDetail.sectionName=${tagSection.sectionName} showSettingForTag=${showSettingForTag}`)
        if (typeof showSettingForTag === 'undefined' || showSettingForTag) {
          const newSection = await getTaggedSectionData(config, useDemoData, tagSection, index)
          if (newSection) sections.push(newSection)
          index++
        }
      }
    }
    if (wantOD) {
      sections.push(
        await getOverdueSectionData(
          config,
          useDemoData,
          placement.forOVERDUE,
          yesterdaySpillTaskParas,
          yesterdayParasForOverdueDedupe,
        ),
      )
    }
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    // Note: The WINS section is generated separately in the front end after the other sections are generated.

    // logDebug('getSomeSectionsData', `=> 🔹 sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)

    // get rid of any nulls b/c just in case any the sections above could return null
    sections = sections.filter((s) => s) 

    return sections
  } catch (error) {
    logError('getSomeSectionsData', error.message)
    return []
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
