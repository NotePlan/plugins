// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-05-16 for v2.3.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSettingItem } from './types'
import { allSectionCodes } from './constants.js'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  createSectionOpenItemsFromParas,
  createSectionItemObject,
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getRelevantPriorityTasks,
  makeDashboardParas,
} from './dashboardHelpers'
import { getTodaySectionData, getYesterdaySectionData, getTomorrowSectionData } from './dataGenerationDays'
import { getOverdueSectionData } from './dataGenerationOverdue'
import { getProjectSectionData } from './dataGenerationProjects'
import { getSavedSearchResults } from './dataGenerationSearch'
import { getTaggedSectionData } from './dataGenerationTags'
import { getLastWeekSectionData, getThisWeekSectionData } from './dataGenerationWeeks'
import { openMonthParas, refMonthParas, tagParasFromNote } from './demoData'
import { getTagSectionDetails } from './react/components/Section/sectionHelpers'
import { removeInvalidTagSections } from './perspectiveHelpers'
import { getNestedValue, setNestedValue } from '@helpers/dataManipulation'
import { getDateStringFromCalendarFilename, getNPMonthStr, getNPQuarterStr } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
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
    logDebug('getSomeSectionsData', `🔹 Starting with ${sectionCodesToGet.toString()} ...`)
    const config: TDashboardSettings = await getDashboardSettings()

    const sections: Array<TSection> = []
    if (sectionCodesToGet.includes('INFO')) sections.push(...getInfoSectionData(config, useDemoData))
    // v2: for Timeblocks, now done inside getTodaySectionData()
    if (sectionCodesToGet.includes('DT') || sectionCodesToGet.includes('TB')) sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DO') && config.showTomorrowSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('LW') && config.showLastWeekSection) sections.push(...getLastWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    // moderately quick to generate
    if (sectionCodesToGet.includes('PROJ') && config.showProjectSection) {
      logInfo('getSomeSectionsData', `🔹 Getting Project section data as part of ${sectionCodesToGet.toString()}`)
      const projectSection = await getProjectSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }
    // The rest can all be slow to generate
    if (sectionCodesToGet.includes('SAVEDSEARCH')) sections.push(...(await getSavedSearchResults(config, useDemoData)))
    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      // v1:
      // const tagSections = getTaggedSections(config, useDemoData).filter((s) => s) //get rid of any nulls
      // sections = tagSections.length ? sections.concat(tagSections) : sections

      // v2:
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

    sections.filter((s) => s) //get rid of any nulls b/c just in case any the sections above could return null
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
export function getInfoSectionData(_config: TDashboardSettings, _useDemoData: boolean = false): Array<TSection> {
  const sections: Array<TSection> = []
  const outputLines = []
  outputLines.push(`Device name '${NotePlan.environment.machineName}' (${NotePlan.environment.platform}). Screen: ${NotePlan.environment.screenWidth}x${NotePlan.environment.screenHeight}`)
  const storedWindowRect: Rect | false = getStoredWindowRect('jgclark.Dashboard.main')
  const liveWindowRect: Rect | false = getLiveWindowRect('')
  outputLines.push(`stored window rect: ${storedWindowRect ? rectToString(storedWindowRect) : 'no stored window rect'}`)
  outputLines.push(`live window rect: ${liveWindowRect ? rectToString(liveWindowRect) : 'no live window rect'}`)
  const sectionNumStr = '20'
  let itemCount = 0
  const items: Array<TSectionItem> = outputLines.map((line) => {
    const item = {
      ID: `${sectionNumStr}-${itemCount}`,
      itemType: 'info',
      message: line,
    }
    itemCount += 1
    return item
  })
  sections.push({
    ID: 'INFO',
    name: 'Info',
    showSettingName: 'showInfoSection',
    sectionCode: 'INFO',
    description: 'Window Details',
    FAIconClass: 'fa-light fa-info-circle',
    sectionTitleColorPart: 'sidebarInfo',
    sectionItems: items,
    isReferenced: false,
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
    let sectionNumStr = '8'
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
    logInfo('getDataForDashboard', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      const sortedParas = config.separateSectionForReferencedNotes ? openMonthParas : openMonthParas.concat(refMonthParas)
      // Note: parentID already supplied
      sortedParas.map((item) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentMonthlyNote) {
        // const thisFilename = currentMonthlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisMonthSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'month', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
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
      ID: sectionNumStr,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-light fa-calendar-range',
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
      sectionNumStr = '9'
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: sectionNumStr,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-range',
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
    let sectionNumStr = '10'
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
    logDebug('getDataForDashboard', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // No demo data
    } else {
      if (currentQuarterlyNote) {
        const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisQuarterSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'quarter', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
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
      ID: sectionNumStr,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-light fa-calendar-days',
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
      sectionNumStr = '11'
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: sectionNumStr,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-days',
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

//----------------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is
//   fa-calendar-days (same as quarter). This would be section #6
//----------------------------------------------------------------

// ----------------------------------------------------------
/**
 * Generate data for a section of raised Priority tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getPrioritySectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNumStr = '14'
    const thisSectionCode = 'PRIORITY'
    let totalPriority = 0
    let itemCount = 0
    let priorityParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getPrioritySectionData', `------- Gathering Priority Tasks for section #${String(sectionNumStr)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 30; c++) {
        // const thisID = `${sectionNumStr}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 30 === 0 ? '>> ' : c % 21 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : '! '
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test priority item ${String(c + 1)} >${fakeIsoDateStr}`
        priorityParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Priority Test Note ${(c % 10) + 1}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get priority tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllPriorityOpenToToday() doesn't have all it needs to work
      priorityParas = await getRelevantPriorityTasks(config)
      logDebug('getPrioritySectionData', `- found ${priorityParas.length} priority paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (priorityParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(priorityParas)
      logDebug('getPrioritySectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // TODO(later): Remove possible dupes from sync'd lines
      // priorityParas = eliminateDuplicateParagraphs(priorityParas)
      // logTimer('getPrioritySectionData', thisStartTime, `- after sync lines dedupe -> ${priorityParas.length}`)

      totalPriority = dashboardParas.length

      // Sort paragraphs by priority
      const sortOrder = ['-priority', '-changedDate']
      const sortedPriorityTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getPrioritySectionData', thisStartTime, `- Sorted ${sortedPriorityTaskParas.length} items`)

      // Apply limit to set of ordered results
      // Note: Apply some limiting here, in case there are hundreds of items. There is also display filtering in the Section component via useSectionSortAndFilter.
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const priorityTaskParasLimited = totalPriority > maxInSection ? sortedPriorityTaskParas.slice(0, maxInSection) : sortedPriorityTaskParas
      logDebug('getPrioritySectionData', `- after limit, now ${priorityTaskParasLimited.length} items to show`)
      priorityTaskParasLimited.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push(createSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logTimer('getPrioritySectionData', thisStartTime, `- finished finding priority items`)

    let sectionDescription = `{countWithLimit} open {itemType}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Priority Tasks',
      showSettingName: 'showPrioritySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-angles-up',
      // FAIconClass: 'fa-light fa-star-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalPriority,
      isReferenced: false,
      actionButtons: [],
    }
    logTimer('getPrioritySectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1500)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

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
