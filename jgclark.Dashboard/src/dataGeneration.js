// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2026-01-08 for v2.4.0.b10, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSettingItem } from './types'
import { allSectionCodes } from './constants.js'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  createSectionOpenItemsFromParas,
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
} from './dashboardHelpers'
import { getTodaySectionData, getTimeBlockSectionData, getYesterdaySectionData, getTomorrowSectionData } from './dataGenerationDays'
import { getOverdueSectionData } from './dataGenerationOverdue'
import { getPrioritySectionData } from './dataGenerationPriority'
import { getProjectSectionData } from './dataGenerationProjects'
import { getSavedSearchResults } from './dataGenerationSearch'
import { getTaggedSectionData } from './dataGenerationTags'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks'
import { openMonthParas, refMonthParas, tagParasFromNote } from './demoData'
import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import { removeInvalidTagSections } from './perspectiveHelpers'
import { getNestedValue, setNestedValue } from '@helpers/dataManipulation'
import { getNPMonthStr, getNPQuarterStr, getNPYearStr } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'
// import { sortListBy } from '@helpers/sorting'
import { getSettings } from '@helpers/NPConfiguration'
import { getLiveWindowRect, getStoredWindowRect, logWindowsList, rectToString } from '@helpers/NPWindows'

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * Note: don't forget there's also refreshClickHandlers.js::refreshAllSections().
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getAllSectionsData(useDemoData: boolean = false, forceLoadAll: boolean = false, useEditorWherePossible: boolean): Promise<Array<TSection>> {
  try {
    const config: any = await getDashboardSettings()
    // clo(config, 'getAllSectionsData config is currently',2)

    // V2
    // Work out which sections to show
    const sectionsToShow: Array<TSectionCode> = forceLoadAll ? allSectionCodes : getListOfEnabledSections(config)
    logDebug('getAllSectionsData', `>>>>> Starting with ${String(sectionsToShow.length)} sections to show: ${String(sectionsToShow)}`)
    const sections: Array<TSection> = await getSomeSectionsData(sectionsToShow, useDemoData, useEditorWherePossible)
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
 * @returns {Array<TSection>} array of sections
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
): Promise<Array<TSection>> {
  try {
    logDebug('getSomeSectionsData', `[ENCODING DEBUG] ===== getSomeSectionsData CALLED for sections: [${String(sectionCodesToGet)}] =====`)
    // logDebug('getSomeSectionsData', `🔹 Starting with ${sectionCodesToGet.toString()} ...`)
    const config: TDashboardSettings = await getDashboardSettings()

    // TODO: change generation order to suit the new custom section display order

    let sections: Array<TSection> = []
    if (sectionCodesToGet.includes('INFO')) sections.push(...(await getInfoSectionData(config, useDemoData)))
    // DT and TB sections are now generated separately but share paragraph data fetching
    if (sectionCodesToGet.includes('DT')) {
      const todaySections = getTodaySectionData(config, useDemoData, useEditorWherePossible)
      // Log encoding for debugging emoji corruption - check data right after getTodaySectionData returns
      for (const section of todaySections || []) {
        for (const item of section.sectionItems || []) {
          const title = item?.para?.title
          if (title && (title.includes('🧩') || title.includes('ð'))) {
            const charCodes = title.split('').map((c: string) => c.charCodeAt(0)).join(',')
            logDebug('getSomeSectionsData', `[ENCODING DEBUG] AFTER getTodaySectionData returns - Section ${section.sectionCode}, title: "${title}" (length=${title.length}, charCodes=${charCodes})`)
          }
        }
      }
      sections.push(...todaySections)
      // Log encoding for debugging emoji corruption - check data right after pushing today sections
      for (const section of sections || []) {
        for (const item of section.sectionItems || []) {
          const title = item?.para?.title
          if (title && (title.includes('🧩') || title.includes('ð'))) {
            const charCodes = title.split('').map((c: string) => c.charCodeAt(0)).join(',')
            logDebug('getSomeSectionsData', `[ENCODING DEBUG] AFTER pushing today sections - Section ${section.sectionCode}, title: "${title}" (length=${title.length}, charCodes=${charCodes})`)
          }
        }
      }
    }
    if (sectionCodesToGet.includes('TB') && config.showTimeBlockSection) sections.push(...getTimeBlockSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DO') && config.showTomorrowSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('LW') && config.showLastWeekSection) sections.push(...getLastWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Y') && config.showYearSection) sections.push(...getThisYearSectionData(config, useDemoData, useEditorWherePossible))

    // moderately quick to generate
    if (sectionCodesToGet.includes('PROJ') && config.showProjectSection) {
      logInfo('getSomeSectionsData', `🔹 Getting Project section data as part of ${sectionCodesToGet.toString()}`)
      const projectSection = await getProjectSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }

    // The rest can all be slow to generate
    if (sectionCodesToGet.includes('SAVEDSEARCH')) sections.push(...(await getSavedSearchResults(config, useDemoData)))
    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      // TODO: change so that tags can be generated separately from each other, letting them be specified in the section order component.
      const tagSections = getTagSectionDetails(removeInvalidTagSections(config))
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
    if (sectionCodesToGet.includes('OVERDUE') && config.showOverdueSection) sections.push(await getOverdueSectionData(config, useDemoData))
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    // logDebug('getSomeSectionsData', `=> 🔹 sections ${getDisplayListOfSectionCodes(sections)} (unfiltered)`)

    sections = sections.filter((s) => s) //get rid of any nulls b/c just in case any the sections above could return null
    
    // Log encoding for debugging emoji corruption - check data right before returning from getSomeSectionsData
    for (const section of sections || []) {
      for (const item of section.sectionItems || []) {
        const title = item?.para?.title
        if (title && (title.includes('🧩') || title.includes('ð'))) {
          const charCodes = title.split('').map((c: string) => c.charCodeAt(0)).join(',')
          logDebug('getSomeSectionsData', `[ENCODING DEBUG] BEFORE return - Section ${section.sectionCode}, title: "${title}" (length=${title.length}, charCodes=${charCodes})`)
        }
      }
    }
    
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
export async function getInfoSectionData(_config: TDashboardSettings, _useDemoData: boolean = false): Promise<Array<TSection>> {
  const sections: Array<TSection> = []
  const thisSectionCode = 'INFO'
  const outputLines = []
  const settings = await getSettings(pluginJson['plugin.id'])
  outputLines.push(`Device name '${NotePlan.environment.machineName}' (${NotePlan.environment.platform}) running NP v${NotePlan.environment.versionNumber} build ${NotePlan.environment.buildVersion}, and Dashboard v${pluginJson['plugin.version']}-${pluginJson['plugin.releaseStatus']}.`)
  outputLines.push(`Screen: ${NotePlan.environment.screenWidth}x${NotePlan.environment.screenHeight}. Window type requested: ${settings?.preferredWindowType ?? '?'}`)
  const storedWindowRect: Rect | false = getStoredWindowRect('jgclark.Dashboard.main')
  const liveWindowRect: Rect | false = getLiveWindowRect('')
  outputLines.push(`Stored window rect: ${storedWindowRect ? rectToString(storedWindowRect) : 'no stored window rect'}`)
  outputLines.push(`Live window rect: ${liveWindowRect ? rectToString(liveWindowRect) : 'no live window rect'}`)
  sections.push({
    ID: thisSectionCode,
    name: 'Info',
    showSettingName: 'showInfoSection',
    sectionCode: thisSectionCode,
    description: 'Window Details',
    FAIconClass: 'fa-light fa-info-circle',
    sectionTitleColorPart: 'sidebarInfo',
    sectionItems: outputLines.map((line) => ({
      ID: `${thisSectionCode}-${line}`,
      sectionCode: thisSectionCode,
      itemType: 'info',
      message: line.trim(),
    })),
    isReferenced: false,
    // TODO(later): remove this once we have a proper banner system
    actionButtons: (_config.FFlag_ShowBannerTestButtons ? [
      {
        actionName: 'testBannerInfo',
        actionParam: 'jgclark.Dashboard.main',
        actionPluginID: `${pluginJson['plugin.id']}`,
        display: '<i class= "fa-regular fa-info-circle sidebarInfo" ></i> ',
        tooltip: 'Show an info banner',
      },
      {
        actionName: 'testBannerWarning',
        actionParam: 'jgclark.Dashboard.main',
        actionPluginID: `${pluginJson['plugin.id']}`,
        display: '<i class= "fa-regular fa-triangle-exclamation sidebarInfo" ></i> ',
        tooltip: 'Show a warning banner',
      },
      {
        actionName: 'testBannerError',
        actionParam: 'jgclark.Dashboard.main',
        actionPluginID: `${pluginJson['plugin.id']}`,
        display: '<i class= "fa-regular fa-circle-exclamation sidebarInfo" ></i> ',
        tooltip: 'Show an error banner',
      },
      {
        actionName: 'testRemoveBanner',
        actionParam: 'jgclark.Dashboard.main',
        actionPluginID: `${pluginJson['plugin.id']}`,
        display: '<i class= "fa-regular fa-xmark sidebarInfo" ></i> ',
        tooltip: 'Remove the banner',
      },
    ] : []),
  })
  return sections
}

/**
 * Get open items from this Month's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisMonthSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'M'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPMonthStr(today)
    const NPSettings = getNotePlanSettings()
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      const sortedParas = config.separateSectionForReferencedNotes ? openMonthParas : openMonthParas.concat(refMonthParas)
      // Note: parentID already supplied
      sortedParas.map((item) => {
        const thisID = `${thisSectionCode}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentMonthlyNote) {
        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'month', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        logTimer('getDataForDashboard', startTime, `- finished finding monthly items from ${dateStr}`)
      } else {
        logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisMonthHeadings: Array<string> = currentMonthlyNote ? getHeadingsFromNote(currentMonthlyNote, false, true, true, true) : []
    const nextMonthHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisMonthHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: thisMonthHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )
    const nextMonthFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextMonthHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: nextMonthHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )

    let sectionDescription = `{closedOrOpenTaskCount} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-range',
      sectionTitleColorPart: 'sidebarMonthly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this month's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this month's note",
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
          formFields: thisMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next month's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next month's note",
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextMonthFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-calendar-range',
        sectionTitleColorPart: 'sidebarMonthly',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logTimer('getDataForDashboard', startTime, `- found ${itemCount} monthly items from ${thisFilename}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/month', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Quarter's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisQuarterSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'Q'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPQuarterStr(today)
    const NPSettings = getNotePlanSettings()
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      if (currentQuarterlyNote) {
        // Get list of open tasks/checklists from this quarterly note (if it exists)
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'quarter', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logDebug('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')
    const nextPeriodFilename = nextPeriodNote?.filename ?? ''
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisQuarterHeadings: Array<string> = currentQuarterlyNote ? getHeadingsFromNote(currentQuarterlyNote, false, true, true, true) : []
    const nextQuarterHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisQuarterHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: thisQuarterHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )
    const nextQuarterFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextQuarterHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: nextQuarterHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )

    let sectionDescription = `{countWithLimit} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-days',
      sectionTitleColorPart: 'sidebarQuarterly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q'],
          formFields: thisQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next quarter's note",
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-calendar-days',
        sectionTitleColorPart: 'sidebarQuarterly',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} quarterly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/quarter', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Year's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisYearSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'Y'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPYearStr(today)
    const NPSettings = getNotePlanSettings()
    const currentYearlyNote = DataStore.calendarNoteByDate(today, 'year')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Year's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      if (currentYearlyNote) {
        // Get list of open tasks/checklists from this yearly note (if it exists)
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'year', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logDebug('getDataForDashboard', `- finished finding Yearly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No Yearly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'year').toDate(), 'year')
    const nextPeriodFilename = nextPeriodNote?.filename ?? ''
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisYearHeadings: Array<string> = currentYearlyNote ? getHeadingsFromNote(currentYearlyNote, false, true, true, true) : []
    const nextYearHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisYearFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisYearHeadings.length
        ? // $FlowIgnore[incompatible-type]
        [
          {
            type: 'dropdown-select',
            label: 'Under Heading:',
            key: 'heading',
            // $FlowFixMe[incompatible-type]
            options: thisYearHeadings,
            noWrapOptions: true,
            value: defaultHeadingToAddTo,
          },
        ]
        : [],
    )
    const nextYearFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextYearHeadings.length
        ? // $FlowIgnore[incompatible-type]
        [
          {
            type: 'dropdown-select',
            label: 'Under Heading:',
            key: 'heading',
            // $FlowFixMe[incompatible-type]
            options: nextYearHeadings,
            noWrapOptions: true,
            value: defaultHeadingToAddTo,
          },
        ]
        : [],
    )

    let sectionDescription = `{countWithLimit} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Year',
      showSettingName: 'showYearSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-days',
      sectionTitleColorPart: 'sidebarYearly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this year's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarYearly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Y'],
          formFields: thisYearFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this year's note",
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarYearly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Y'],
          formFields: thisYearFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next year's note",
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarYearly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextYearFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next year's note",
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarYearly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextYearFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current yearly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Year',
        showSettingName: 'showYearSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-calendar-days',
        sectionTitleColorPart: 'sidebarYearly',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} yearly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getDataForDashboard/year', `ERROR: ${error.message}`)
    return []
  }
}

//----------------------------------------------------------------

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
