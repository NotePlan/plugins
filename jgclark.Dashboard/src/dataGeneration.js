// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2026-07-29 for v2.4.0.b56 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import type { TDashboardSettings, TSectionCode, TSection } from './types'
import { allSectionCodes } from './constants.js'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  isCurrentRemindersEnabled,
  isUndatedOverdueRemindersEnabled,
  isTBSectionEnabled,
} from './dashboardHelpers'
import { getTodaySectionData, getTimeBlockSectionData, getYesterdaySectionData, getTomorrowSectionData } from './dataGenerationDays'
import { getOverdueSectionData } from './dataGenerationOverdue'
import { getThisMonthSectionData, getThisQuarterSectionData, getThisYearSectionData } from './dataGenerationPeriods'
import { getPrioritySectionData } from './dataGenerationPriority'
import { getProjectReviewSectionData, getProjectActiveSectionData } from './dataGenerationProjects'
import { getRemindersGeneratedData, type TRemindersGeneratedData } from './dataGenerationReminders'
import { getSavedSearchResults } from './dataGenerationSearch'
import { getTaggedSectionData } from './dataGenerationTags'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks'
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
      timedTodayItems: [],
      untimedTodayItems: [],
      yesterdayItems: [],
      tomorrowItems: [],
      overdueItems: [],
      remindersSection: null,
    }
    if (wantRemSection || wantRemForDaySections || wantRemForOverdue) {
      remindersData = await getRemindersGeneratedData(config, useDemoData)
    }

    // Yesterday reminders go to DY when Yesterday is on; otherwise spill into Overdue (if undated/overdue toggle allows)
    const yesterdayForDaySection = currentRemindersEnabled && config.showYesterdaySection ? remindersData.yesterdayItems : []
    const yesterdaySpillToOverdue =
      currentRemindersEnabled && !config.showYesterdaySection && undatedOverdueRemindersEnabled ? remindersData.yesterdayItems : []
    const overdueReminderItems = undatedOverdueRemindersEnabled
      ? remindersData.overdueItems.concat(yesterdaySpillToOverdue)
      : []
    // A reminder only reaches the UI if some section hosts it. Yesterday and overdue
    // reminders now fall back to the REM ("Undated/Overdue Reminders") section when
    // their own section is off, so they are only truly lost if REM is off too.
    // Tomorrow has no fallback by design, so it is lost whenever Tomorrow is off.
    const remCanHost = undatedOverdueRemindersEnabled
    const yesterdayHomeless =
      remindersData.yesterdayItems.length > 0 && yesterdayForDaySection.length === 0 && !Boolean(config.showOverdueSection) && !remCanHost
    const overdueHomeless = remindersData.overdueItems.length > 0 && !Boolean(config.showOverdueSection) && !remCanHost
    const tomorrowHomeless = remindersData.tomorrowItems.length > 0 && !config.showTomorrowSection
    // Untimed today falls back to REM, so it is only lost when REM cannot host either.
    // Timed today reminders that are not yet due are intentionally shown nowhere
    // (see the DESIGN DECISION note in dataGenerationDays.js), so they are not warned about.
    const untimedTodayHomeless = remindersData.untimedTodayItems.length > 0 && !config.showTodaySection && !remCanHost
    if (yesterdayHomeless || overdueHomeless || tomorrowHomeless || untimedTodayHomeless) {
      const parts = []
      if (yesterdayHomeless) parts.push(`${String(remindersData.yesterdayItems.length)} yesterday`)
      if (overdueHomeless) parts.push(`${String(remindersData.overdueItems.length)} overdue`)
      if (tomorrowHomeless) parts.push(`${String(remindersData.tomorrowItems.length)} tomorrow (no fallback: Tomorrow section off)`)
      if (untimedTodayHomeless) parts.push(`${String(remindersData.untimedTodayItems.length)} untimed today`)
      logWarn('getSomeSectionsData', `- ${parts.join('; ')} reminder(s) have no visible section and will not be shown anywhere`)
    }

    // DT and TB sections are now generated separately but share paragraph data fetching
    if (sectionCodesToGet.includes('DT')) {
      const todaySections = getTodaySectionData(
        config,
        useDemoData,
        useEditorWherePossible,
        currentRemindersEnabled ? remindersData.untimedTodayItems : [],
      )
      sections.push(...todaySections)
    }
    if (sectionCodesToGet.includes('TB') && isTBSectionEnabled(config)) {
      sections.push(
        ...getTimeBlockSectionData(
          config,
          useDemoData,
          useEditorWherePossible,
          currentRemindersEnabled ? remindersData.timedTodayItems : [],
        ),
      )
    }
    // Note: the WINS section is generated separately in the front end after the other sections are generated.
    if (wantRemSection && remindersData.remindersSection) {
      sections.push(remindersData.remindersSection)
    }
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) {
      sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible, yesterdayForDaySection))
    }
    if (sectionCodesToGet.includes('DO') && config.showTomorrowSection) {
      sections.push(
        ...getTomorrowSectionData(
          config,
          useDemoData,
          useEditorWherePossible,
          currentRemindersEnabled ? remindersData.tomorrowItems : [],
        ),
      )
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
    if (sectionCodesToGet.includes('OVERDUE') && config.showOverdueSection) {
      sections.push(await getOverdueSectionData(config, useDemoData, overdueReminderItems))
    }
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    // logDebug('getSomeSectionsData', `=> 🔹 sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)

    sections = sections.filter((s) => s) //get rid of any nulls b/c just in case any the sections above could return null

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
