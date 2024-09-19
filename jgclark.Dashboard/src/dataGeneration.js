/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2024-09-19 for v2.1.0.a8+ by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project } from '../../jgclark.Reviews/src/reviewHelpers.js'
import { getNextNotesToReview, makeFullReviewList } from '../../jgclark.Reviews/src/reviews.js'
import { allSectionCodes } from "./constants.js"
import { getTagSectionDetails } from './react/components/Section/sectionHelpers.js'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  getDashboardSettings,
  getNotePlanSettings,
  getOpenItemParasForCurrentTimePeriod,
  getRelevantOverdueTasks,
  getRelevantPriorityTasks,
  getStartTimeFromPara,
  makeDashboardParas,
} from './dashboardHelpers'
import {
  openTodayItems,
  refTodayItems,
  openYesterdayParas,
  refYesterdayParas,
  openTomorrowParas,
  refTomorrowParas,
  openWeekParas,
  refWeekParas,
  openMonthParas,
  refMonthParas,
  demoTaggedSectionDetails,
  demoTaggedParas,
  nextProjectNoteItems,
  makeDummyOverdueItems,
  makeDummyPriorityItems
} from './demoData'
import {
  isLineDisallowedByExcludedTerms,
  isNoteInAllowedFolderList,
} from './perspectiveHelpers'
import {
  isFilenameAllowedInFolderList
, getCurrentlyAllowedFolders } from './perspectivesShared.js'
import type {
  TDashboardSettings,
  TSectionCode, TSection, TSectionItem, TParagraphForDashboard, TItemType, TSectionDetails,
} from './types'
import {
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  filenameIsInFuture,
  includesScheduledFutureDate,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import {
  toNPLocaleDateString,
} from '@helpers/NPdateTime'
import {
  findNotesMatchingHashtagOrMention,
} from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import {
  isOpen, isOpenTask,
} from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * @param {boolean} useDemoData? (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getAllSectionsData(useDemoData: boolean = false, forceLoadAll: boolean = false, useEditorWherePossible: boolean): Promise<Array<TSection>> {
  try {
    const config: any = await getDashboardSettings()
    logInfo('getAllSectionsData', `starting ...'`)
    // clo(config, 'getAllSectionsData config is currently',2)

    let sections: Array<TSection> = []
    sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
    if (forceLoadAll || config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (forceLoadAll || config.showWeekSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (forceLoadAll || config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (forceLoadAll || config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (forceLoadAll || config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))

    // out of display order, but quicker to generate
    if (forceLoadAll || config.showProjectSection) sections.push(await getProjectSectionData(config, useDemoData))

    if (forceLoadAll || config.tagsToShow) sections = sections.concat(getTaggedSections(config, useDemoData))

    if (forceLoadAll || config.showOverdueSection) sections.push(await getOverdueSectionData(config, useDemoData))

    if (forceLoadAll || config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))


    return sections.filter((s) => s) //get rid of any nulls b/c some of the sections above could return null

  } catch (error) {
    logError('getAllSectionDetails', error.message)
    return []
  }
}

/**
 * Generate data for some specified sections (subject to user currently wanting them as well)
 * NOTE: Always refreshes today and the TAG sections
 * @param {Array<string>} sectionCodesToGet (default: allSectionCodes)
 * @param {boolean} useDemoData (default: false)
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} array of sections
 */
export async function getSomeSectionsData(
  sectionCodesToGet: Array<TSectionCode> = allSectionCodes,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean
): Promise<Array<TSection>> {
  try {
    const config: TDashboardSettings = await getDashboardSettings()
    // const perspectiveSettings = await getPerspectiveSettings()
    // const currentPerspectiveDef = getActivePerspectiveDef(config, perspectiveSettings)
    logInfo('getSomeSectionsData', `starting for [${String(sectionCodesToGet)}] ...'`)

    let sections: Array<TSection> = []
    if (sectionCodesToGet.includes('DT')) sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DY') && config.showYesterdaySection) sections.push(...getYesterdaySectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('DO') && config.showWeekSection) sections.push(...getTomorrowSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('W') && config.showWeekSection) sections.push(...getThisWeekSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('M') && config.showMonthSection) sections.push(...getThisMonthSectionData(config, useDemoData, useEditorWherePossible))
    if (sectionCodesToGet.includes('Q') && config.showQuarterSection) sections.push(...getThisQuarterSectionData(config, useDemoData, useEditorWherePossible))
    // out of display order, but quicker to generate
    if (sectionCodesToGet.includes('PROJ') && config.showProjectSection) {
      const projectSection = await getProjectSectionData(config, useDemoData)
      if (projectSection) sections.push(projectSection)
    }
    if (sectionCodesToGet.includes('TAG') && config.tagsToShow) {
      const tagSections = getTaggedSections(config, useDemoData).filter((s) => s) //get rid of any nulls
      sections = tagSections.length ? sections.concat(tagSections) : sections
    }
    if (sectionCodesToGet.includes('OVERDUE') && config.showOverdueSection) sections.push(await getOverdueSectionData(config, useDemoData))
    if (sectionCodesToGet.includes('PRIORITY') && config.showPrioritySection) sections.push(await getPrioritySectionData(config, useDemoData))

    return sections.filter((s) => s) //get rid of any nulls

  } catch (error) {
    logError('getSomeSectionData', error.message)
    return []
  }
}

/**
 * Get open items from Today's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getTodaySectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '0'
    const thisSectionCode = 'DT'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const todayDateLocale = toNPLocaleDateString(new Date(), 'short') // uses moment's locale info from NP
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${getTodaysDateUnhyphenated()}.${NPSettings.defaultFileExtension}`
    const filenameDateStr = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
    // let currentDailyNote = DataStore.calendarNoteByDate(today, 'day') // ❌ not reliable
    const currentDailyNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅ reliable
    // const thisFilename = currentDailyNote?.filename ?? '(error)'
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `--------- Gathering Today's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section items
      const sortedItems = (config.separateSectionForReferencedNotes) ? openTodayItems : openTodayItems.concat(refTodayItems)
      sortedItems.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowFixMe[incompatible-use] already checked item.para exists
          item.para.startTime = timeStr
        }
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      if (currentDailyNote) {
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', currentDailyNote, config, useEditorWherePossible)
        // logDebug('getDataForDashboard', `getOpenItemParasForCurrentTimePeriod Found ${sortedOrCombinedParas.length} open items and ${sortedRefParas.length} refs to ${filenameDateStr}`)

        // write items for first (or combined) section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
      } else {
        logDebug('getDataForDashboard', `No daily note found using filename '${thisFilename}'`)
      }
    }

    const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thisSectionCode,
      description: `{count} from ${todayDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-star',
      sectionTitleClass: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: '<i class= "fa-regular fa-circle-plus sidebarDaily" ></i> ',
          tooltip: "Add a new task to today's note",
          postActionRefresh: ['DT'],
        },
        {
          actionName: 'addChecklist',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: '<i class= "fa-regular fa-square-plus sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to today's note",
          postActionRefresh: ['DT'],
        },
        {
          actionName: 'addTask',
          actionParam: nextPeriodFilename,
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a new task to tomorrow's note",
          postActionRefresh: ['DO'],
        },
        {
          actionName: 'addChecklist',
          actionParam: nextPeriodFilename,
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: '<i class= "fa-regular fa-square-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to tomorrow's note",
          postActionRefresh: ['DO'],
        },
        {
          actionName: 'moveAllTodayToTomorrow',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          display: 'All <i class="fa-solid fa-right-long"></i> Tomorrow',
          tooltip: 'Move or schedule all remaining open items to tomorrow',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DO'] // refresh 2 sections afterwards
        },
      ],
    }
    // clo(section)
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '1'
      if (useDemoData) {
        const sortedRefParas = refTodayItems
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }

      const section: TSection = {
        ID: sectionNum,
        name: '>Today',
        showSettingName: 'showTodaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${todayDateLocale}`,
        FAIconClass: 'fa-light fa-calendar-star',
        sectionTitleClass: 'sidebarDaily',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} daily items from ${filenameDateStr} in ${timer(startTime)}`)

    return sections
  } catch (error) {
    logError(`getTodaySectionData`, error.message)
    return []
  }
}

/**
 * Get open items from Yesterday's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getYesterdaySectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '2'
    let itemCount = 0
    const sections: Array<TSection> = []
    const thisSectionCode = 'DY'
    const yesterday = new moment().subtract(1, 'days').toDate()
    const yesterdayDateLocale = toNPLocaleDateString(yesterday, 'short') // uses moment's locale info from NP
    const NPSettings = getNotePlanSettings()
    const thisFilename =
      `${moment(yesterday).format('YYYYMMDD')}.${NPSettings.defaultFileExtension}`
    const items: Array<TSectionItem> = []
    // const yesterday = new moment().subtract(1, 'days').toDate()
    const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    // let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day') // ❌ seems unreliable
    const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} from ${filenameDateStr} ----------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write one or combined section items
      const sortedItems = (config.separateSectionForReferencedNotes) ? openYesterdayParas : openYesterdayParas.concat(refYesterdayParas)
      sortedItems.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowFixMe[incompatible-use] already checked item.para exists
          item.para.startTime = timeStr
        }
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      // Get list of open tasks/checklists from yesterday's daily note (if wanted and it exists)
      if (yesterdaysNote) {
        const thisFilename = yesterdaysNote?.filename ?? '(error)'
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', yesterdaysNote, config, useEditorWherePossible)

        // write items for first (or combined) section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding yesterday's items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No yesterday note found using filename '${thisFilename}'`)
      }
    }
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
      name: 'Yesterday',
      showSettingName: 'showYesterdaySection',
      sectionCode: thisSectionCode,
      description: `{count} from ${yesterdayDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-arrow-up',
      sectionTitleClass: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'moveAllYesterdayToToday',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: 'Move or schedule all open items from yesteday to today',
          display: 'All <i class="fa-solid fa-right-long"></i> Today',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DY'] // refresh 2 sections afterwards
        },
      ],
    }
    // clo(section)
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '3'
      if (useDemoData) {
        const sortedRefParas = refYesterdayParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>Yesterday',
        showSettingName: 'showYesterdaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${yesterdayDateLocale}`,
        FAIconClass: 'fa-light fa-calendar-star',
        sectionTitleClass: 'sidebarDaily',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      // clo(section)
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} yesterday items from ${filenameDateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError(`getYesterdaySectionData`, error.message)
    return []
  }
}

/**
 * Get open items from Tomorrow's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getTomorrowSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '4'
    const thisSectionCode = 'DO'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const tomorrow = new moment().add(1, 'days').toDate()
    const tomorrowDateLocale = toNPLocaleDateString(tomorrow, 'short') // uses moment's locale info from NP
    const filenameDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowsNote = DataStore.calendarNoteByDateString(filenameDateStr)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${moment(tomorrow).format('YYYYMMDD')}.${NPSettings.defaultFileExtension}`
    // const thisFilename = tomorrowsNote?.filename ?? '(error)'
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Tomorrow's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write one or combined section items
      const sortedParas = (config.separateSectionForReferencedNotes) ? openTomorrowParas : openTomorrowParas.concat(refTomorrowParas)
      sortedParas.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowFixMe[incompatible-use] already checked item.para exists
          item.para.startTime = timeStr
        }
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      // Get list of open tasks/checklists from tomorrow's daily note (if it exists)
      if (tomorrowsNote) {
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', tomorrowsNote, config, useEditorWherePossible)

        // write items for first or combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID,p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding tomorrow's items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    const section: TSection = {
      ID: sectionNum,
      name: 'Tomorrow',
      showSettingName: 'showTomorrowSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${tomorrowDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-arrow-down',
      sectionTitleClass: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      actionButtons: [],
    }
    // clo(section)
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '5'
      if (useDemoData) {
        const sortedRefParas = refTomorrowParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>Tomorrow',
        showSettingName: 'showTomorrowSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${tomorrowDateLocale}`,
        FAIconClass: 'fa-light fa-calendar-arrow-down',
        sectionTitleClass: 'sidebarDaily',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      // clo(section)
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} Tomorrow items from ${filenameDateStr} in ${timer(startTime)}`)
    return [section]
  } catch (error) {
    logError('getDataForDashboard/tomorrow', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Week's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '6'
    const thisSectionCode = 'W'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPWeekStr(today)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Week's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = (config.separateSectionForReferencedNotes) ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
      if (currentWeeklyNote) {
        // const thisFilename = currentWeeklyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('week', currentWeeklyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No weekly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
      name: 'This Week',
      showSettingName: 'showWeekSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-week',
      sectionTitleClass: 'sidebarWeekly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to this week's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarWeekly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['W'],
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to this week's note",
          display: '<i class= "fa-regular fa-square-plus sidebarWeekly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['W'],
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to next week's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to next week's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '7'
      if (useDemoData) {
        const sortedRefParas = refWeekParas
        sortedRefParas.map((item) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current weekly note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>This Week',
        showSettingName: 'showWeekSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-week',
        sectionTitleClass: 'sidebarWeekly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} weekly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('xxx', `ERROR: ${error.message}`)
    return []
  }
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
    let sectionNum = '8'
    const thisSectionCode = 'M'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPMonthStr(today)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = (config.separateSectionForReferencedNotes) ? openMonthParas : openMonthParas.concat(refMonthParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
      if (currentMonthlyNote) {
        // const thisFilename = currentMonthlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('month', currentMonthlyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding monthly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-range',
      sectionTitleClass: 'sidebarMonthly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to this month's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to this month's note",
          display: '<i class= "fa-regular fa-square-plus sidebarMonthly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['M'],
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to next month's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to next month's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarMonthly" ></i> ',
          actionParam: nextPeriodFilename,
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '9'
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        sortedRefParas.map((item) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-range',
        sectionTitleClass: 'sidebarMonthly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getDataForDashboard', `- found ${itemCount} monthly items from ${thisFilename} in ${timer(startTime)}`)
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
    let sectionNum = '10'
    const thisSectionCode = 'Q'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPQuarterStr(today)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getDataForDashboard', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // No demo data
    } else {
      const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
      if (currentQuarterlyNote) {
        const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        [sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod('quarter', currentQuarterlyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')?.filename ?? ''
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-days',
      sectionTitleClass: 'sidebarQuarterly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to this quarter's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q']
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to this quarter's note",
          display: '<i class= "fa-regular fa-square-plus sidebarQuarterly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['Q']
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a new task to next quarter's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: "Add a checklist item to next quarter's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarQuarterly" ></i> ',
          actionParam: nextPeriodFilename,
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const items: Array<TSectionItem> = []
      sectionNum = '11'
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          sortedRefParas.map((p) => {
            const thisID = `${sectionNum}-${itemCount}`
            items.push(getSectionItemObject(thisID, p))
            itemCount++
          })
        }
      }
      const section: TSection = {
        ID: sectionNum,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-light fa-calendar-days',
        sectionTitleClass: 'sidebarQuarterly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
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

//-----------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is fa-calendar-days (same as quarter). This would be #6
//-----------------------------------------------------------

/**
 * Get the tagged sections (plural) for each tag:
 * - they will all be sectionCode=TAG,
 * - sectionName will be the tag name,
 * - showSettingName will be unique for this tag.
 * @param {TDashboardSettings} config
 * @param {boolean} [useDemoData=false]
 * @returns {Array<TSection>}
 */
export function getTaggedSections(config: TDashboardSettings, useDemoData: boolean = false): Array<TSection> {
  try {
    const tagSections = useDemoData ? demoTaggedSectionDetails : getTagSectionDetails(config)
    logInfo('getTaggedSections', `------- Gathering ${String(tagSections.length)}${useDemoData ? ' DEMO' : ''} Tags for section 12 --------`)

    const output = tagSections.reduce((acc: Array<TSection>, sectionDetail: TSectionDetails, index: number) => {
      const showSettingForTag = config[sectionDetail.showSettingName]
      if (typeof showSettingForTag === 'undefined' || showSettingForTag) acc.push(getTaggedSectionData(config, useDemoData, sectionDetail, index))
      return acc  // Return the accumulator
    }, [])
    return output
  } catch (error) {
    logError('getTaggedSections', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Generate data for a section for items with a Tag/Mention.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export function getTaggedSectionData(dashboardSettings: TDashboardSettings, useDemoData: boolean = false, sectionDetail: TSectionDetails, index: number): TSection {
  const thisStartTime = new Date()
  const sectionNum = `12-${index}`
  const thisSectionCode = 'TAG'
  const maxInSection = dashboardSettings.maxItemsToShowInSection ?? 30
  logInfo('getTaggedSectionData', `---- Gathering Tag items for section #${String(sectionNum)}: ${sectionDetail.sectionName} ----`)
  let itemCount = 0
  let totalCount = 0
  let ignoredNotes = 0
  let ignoredItems = 0
  const items: Array<TSectionItem> = []
  const isHashtag = sectionDetail.sectionName.startsWith('#')
  const isMention = sectionDetail.sectionName.startsWith('@')
  let filteredTagParas: Array<TParagraph> = []

  // Get list of suitable folders to filter by
  const currentlyAllowedFolders: Array<string> = getCurrentlyAllowedFolders(dashboardSettings)

  if (useDemoData) {
    let filteredTagParasFromDemoData = demoTaggedParas.filter((p) => p.content.includes(sectionDetail.sectionName))
    logTimer('getTaggedSectionData', thisStartTime, `- ${filteredTagParasFromDemoData.length} DEMO paras before filters`)

    // Filter out checklists and otherwise empty items
    filteredTagParasFromDemoData = dashboardSettings.ignoreChecklistItems
      ? filteredTagParasFromDemoData.filter((p) => isOpenTask(p) && p.content.trim() !== '')
      : filteredTagParasFromDemoData.filter((p) => isOpen(p) && p.content.trim() !== '')

    // Save this para, unless in matches the 'ignoreItemsWithTerms' setting
    for (const p of filteredTagParasFromDemoData) {
      if (!isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms)) {
        filteredTagParas.push(p)
      } else {
        ignoredItems++
        logDebug('getTaggedSectionData', `- ignoring para {${p.content}} as it contains '${dashboardSettings.ignoreItemsWithTerms}'`)
      }
    }
    logTimer('getTaggedSectionData', thisStartTime, `-> ${filteredTagParas.length} DEMO paras (Perspective: ignored ${String(ignoredItems)} items)`)

  } else {
    if (isHashtag || isMention) {

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      // Note: this is slow (about 1ms per note, so 3100ms for 3250 notes)
      const notesWithTag = findNotesMatchingHashtagOrMention(sectionDetail.sectionName, true)
      logTimer('getTaggedSectionData', thisStartTime, `to find ${notesWithTag.length} notes with ${sectionDetail.sectionName}`)

      for (const n of notesWithTag) {
        // Only continue if this is an allowed folder
        if (currentlyAllowedFolders !== [] && n.type === 'Notes' && !isFilenameAllowedInFolderList(n.filename, currentlyAllowedFolders)) {
          // logDebug('getTaggedSectionData', `- ignoring note '${n.filename}' as it is not in allowed list`)
          ignoredNotes++
          continue
        }

        // Get the relevant paras from this note
        const tagParasFromNote = n.paragraphs.filter((p) => p.content?.includes(sectionDetail.sectionName))
        // logTimer('getTaggedSectionData', thisStartTime, `- found ${tagParasFromNote.length} paras containing ${sectionDetail.sectionName} in ${n.filename}`)
        // clo(tagParasFromNote, `tagParasFromNote for ${sectionDetail.sectionName} in ${n.filename}`)

        // Filter out checklists and otherwise empty items
        const filteredTagParasFromNote = dashboardSettings.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTask(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpen(p) && p.content.trim() !== '')
        logTimer('getTaggedSectionData', thisStartTime, `- after filtering for open only (${dashboardSettings.ignoreChecklistItems ? 'tasks only' : 'tasks or checklists'}), ${filteredTagParasFromNote.length} paras`)

        // Save this para, unless in matches the 'ignoreItemsWithTerms' setting
        for (const p of filteredTagParasFromNote) {
          // if (!dashboardSettings.ignoreTagMentionsWithPhrase || dashboardSettings.ignoreTagMentionsWithPhrase === '' || !p.content.includes(dashboardSettings.ignoreTagMentionsWithPhrase)) {
          if (!isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms)) {
            filteredTagParas.push(p)
          } else {
            ignoredItems++
            logDebug('getTaggedSectionData', `- ignoring para {${p.content}} as it contains '${dashboardSettings.ignoreItemsWithTerms}'`)
          }
        }
        logTimer('getTaggedSectionData', thisStartTime, `- after filtering for ${dashboardSettings.ignoreItemsWithTerms}, ${filteredTagParas.length} paras`)
      }
      logTimer('getTaggedSectionData', thisStartTime, `-> ${filteredTagParas.length} paras (Perspective: ignored ${String(ignoredNotes)} notes, and ${String(ignoredItems)} items)`)
    }

    // filter out paras in the future
    const dateToUseUnhyphenated = dashboardSettings.showTomorrowSection ? new moment().add(1, 'days').format("YYYYMMDD") : new moment().format("YYYYMMDD")
    filteredTagParas = filteredTagParas.filter(p => !filenameIsInFuture(p.filename || '', dateToUseUnhyphenated))
    const dateToUseHyphenated = dashboardSettings.showTomorrowSection ? new moment().add(1, 'days').format("YYYY-MM-DD") : new moment().format("YYYY-MM-DD")
    filteredTagParas = filteredTagParas.filter(p => !includesScheduledFutureDate(p.content, dateToUseHyphenated))
    logTimer('getTaggedSectionData', thisStartTime, `- after filtering for future, ${filteredTagParas.length} paras`)

    if (filteredTagParas.length > 0) {
      // Remove possible dupes from these sync'd lines
      filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
      logTimer('getTaggedSectionData', thisStartTime, `- after sync dedupe -> ${filteredTagParas.length}`)
    // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
    // Note: this is a quick operation
    // const filteredReducedParas = removeDuplicates(reducedParas, ['content', 'filename'])
    // logTimer('getTaggedSectionData',thisStartTime, `- after deduping overdue -> ${filteredReducedParas.length}`)

      // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
      // Note: this is a quick operation
      const dashboardParas = makeDashboardParas(filteredTagParas)
      logTimer('getTaggedSectionData', thisStartTime, `- after eliminating dupes -> ${dashboardParas.length}`)

      totalCount = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder =
        dashboardSettings.overdueSortOrder === 'priority'
          ? ['-priority', '-changedDate']
          : dashboardSettings.overdueSortOrder === 'earliest'
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
      const sortedTagParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getTaggedSectionData', thisStartTime, `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)}`)

      // Apply limit to set of ordered results
      const sortedTagParasLimited = sortedTagParas.length > maxInSection ? sortedTagParas.slice(0, maxInSection) : sortedTagParas
      logDebug('getTaggedSectionData', `- after applying [${maxInSection}] limit, now ${sortedTagParasLimited.length} items to show for ${sectionDetail.sectionName}`)
      // sortedTagParasLimited.length ? clo(sortedTagParasLimited, 'getTaggedSectionData sortedTagParasLimited') : null
      for (const p of sortedTagParasLimited) {
        const thisID = `${sectionNum}.${itemCount}`
      // const thisFilename = p.filename ?? ''
      // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID, p))
        itemCount++
      }
      logTimer('getTaggedSectionData', thisStartTime, `- found ${itemCount} items for ${sectionNum}`)
    } else {
      logDebug('getTaggedSectionData', `- no items to show for ${sectionDetail.sectionName}`)
    }
  }

  // Return section details, even if no items found
  // const tagSectionDescription =
  // totalCount > itemCount ? `first {count} from ${String(totalCount)} items ordered by ${dashboardSettings.overdueSortOrder}` : `{count} item{s} ordered by ${dashboardSettings.overdueSortOrder}`
  const tagSectionDescription = `{count} item{s} ordered by ${dashboardSettings.overdueSortOrder}`
  const section: TSection = {
    ID: sectionNum,
    name: sectionDetail.sectionName,
    showSettingName: sectionDetail.showSettingName,
    sectionCode: thisSectionCode,
    description: tagSectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleClass: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    totalCount: totalCount, // Note: Now not sure how this is used (if it is)
    generatedDate: new Date(),
    actionButtons: [],
  }
  logTimer('getTaggedSectionData', thisStartTime, `to find ${itemCount} ${sectionDetail.sectionName} items`, 1000)
  return section
}

// ----------------------------------------------------------
/**
 * Generate data for a section for Overdue tasks
 * @param {TDashboardSettings} dashboardSettings
 * @param {boolean} useDemoData?
 * @returns {TSection} section data
 */
export async function getOverdueSectionData(dashboardSettings: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = '13'
    const thisSectionCode = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = dashboardSettings.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getOverdueSectionData', `------- Gathering ${useDemoData ? 'DEMO' : ''} Overdue Tasks for section #${String(sectionNum)} -------`)

    // Get overdue tasks
    if (useDemoData) {
      overdueParas = makeDummyOverdueItems(NPSettings.defaultFileExtension)

      // TODO: filtering ...

    } else {
      // Note: Cannot move the reduce into here otherwise scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      overdueParas = await getRelevantOverdueTasks(dashboardSettings, [])
      logTimer('getOverdueSectionData', thisStartTime, `- found ${overdueParas.length} overdue paras`)
    }

    // Get list of suitable folders to filter by
    const currentlyAllowedFolders: Array<string> = getCurrentlyAllowedFolders(dashboardSettings)

    // Remove items that are not in an allowed note folder (but allow all in Calendar notes)
    if (currentlyAllowedFolders !== []) {
      // $FlowIgnore[incompatible-call]
      overdueParas = overdueParas.filter((p) => isNoteInAllowedFolderList(p.note, currentlyAllowedFolders, true))
      logTimer('getOverdueSectionData', thisStartTime, `- -> ${overdueParas.length} overdue paras after filtering to ${String(currentlyAllowedFolders.length)} allowed folders`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logTimer('getOverdueSectionData', thisStartTime, `- ${dashboardParas.length} reduced paras`)

      // Remove possible dupes from sync'd lines
      // Note: currently commented out, to save 2? secs of processing
      // overdueParas = eliminateDuplicateSyncedParagraphs(overdueParas)
      logDebug('getOverdueSectionData', `- after sync lines dedupe -> ${overdueParas.length} items`)

      // Remove paras with disallowed terms
      dashboardParas = dashboardParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
      logTimer('getOverdueSectionData', thisStartTime, `- after ignoreTerms filter -> ${dashboardParas.length} items`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder =
        dashboardSettings.overdueSortOrder === 'priority' ? ['-priority', '-changedDate'] : dashboardSettings.overdueSortOrder === 'earliest' ? ['changedDate', 'priority'] : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getOverdueSectionData', thisStartTime, `- sorted ${sortedOverdueTaskParas.length} items by ${String(sortOrder)}`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      const overdueTaskParasLimited = totalOverdue > maxInSection ? sortedOverdueTaskParas.slice(0, maxInSection) : sortedOverdueTaskParas
      logDebug('getOverdueSectionData', `- ${overdueTaskParasLimited.length} after limit`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })
    }
    logTimer('getOverdueSectionData', thisStartTime, `- finished finding overdue items`)

    const overdueSectionDescription =
      totalOverdue > itemCount ? `first {count} of {totalCount} ordered by ${dashboardSettings.overdueSortOrder}` : `{count} ordered by ${dashboardSettings.overdueSortOrder}`

    const section: TSection = {
      ID: sectionNum,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thisSectionCode,
      description: overdueSectionDescription,
      FAIconClass: 'fa-regular fa-alarm-exclamation',
      sectionTitleClass: 'overdue',
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalOverdue,
      actionButtons: [
        {
          actionName: 'scheduleAllOverdueToday',
          actionPluginID: `${pluginJson["plugin.id"]}`,
          tooltip: 'Schedule all Overdue tasks to Today',
          display: 'All Overdue <i class="fa-solid fa-right-long"></i> Today',
          actionParam: '',
          postActionRefresh: ['OVERDUE']
        },

      ],
    }
    // console.log(JSON.stringify(section))
    logTimer('getOverdueSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

// ----------------------------------------------------------
/**
 * Generate data for a section of raised Priority tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {TSection}
 */
export async function getPrioritySectionData(dashboardSettings: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = '14'
    const thisSectionCode = 'PRIORITY'
    let totalPriority = 0
    let itemCount = 0
    let priorityParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = dashboardSettings.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getPrioritySectionData', `------- Gathering ${useDemoData ? 'DEMO' : ''} Priority Tasks for section #${String(sectionNum)} -------`)

    // Get priority tasks
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      priorityParas = makeDummyPriorityItems(NPSettings.defaultFileExtension)

      // TODO: filtering ...

    } else {
      // Note: Cannot move the reduce into here otherwise scheduleAllPriorityOpenToToday() doesn't have all it needs to work
      priorityParas = await getRelevantPriorityTasks(dashboardSettings)
      logDebug('getPrioritySectionData', `- found ${priorityParas.length} priority paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (priorityParas.length > 0) {
      // Get list of suitable folders to filter by
      const currentlyAllowedFolders: Array<string> = getCurrentlyAllowedFolders(dashboardSettings)

      // Remove items that are not in an allowed note folder (but allow all in Calendar notes)
      if (currentlyAllowedFolders !== []) {
        // $FlowIgnore[incompatible-call]
        priorityParas = priorityParas.filter((p) => isNoteInAllowedFolderList(p.note, currentlyAllowedFolders, true))
        logTimer('getPrioritySectionData', thisStartTime, `- -> ${priorityParas.length} priority paras after filtering to ${String(currentlyAllowedFolders.length)} allowed folders`)
      }

      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      // $FlowIgnore[incompatible-exact]
      dashboardParas = makeDashboardParas(priorityParas)
      logTimer('getPrioritySectionData', thisStartTime, `- after reducing paras -> ${dashboardParas.length}`)

      // TODO(later): Remove possible dupes from sync'd lines
      // priorityParas = eliminateDuplicateSyncedParagraphs(priorityParas)
      // logTimer('getPrioritySectionData', thisStartTime, `- after sync lines dedupe -> ${priorityParas.length}`)

      // Remove paras with disallowed terms
      dashboardParas = dashboardParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
      logTimer('getPrioritySectionData', thisStartTime, `- after ignoreTerms filter -> ${dashboardParas.length} items`)

      totalPriority = dashboardParas.length

      // Sort paragraphs by priority
      const sortOrder = ['-priority', '-changedDate']
      const sortedPriorityTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getPrioritySectionData', thisStartTime, `- Sorted ${sortedPriorityTaskParas.length} items`)

      // Apply limit to set of ordered results
      // Note: there is also filtering in the Section component
      const priorityTaskParasLimited = totalPriority > maxInSection ? sortedPriorityTaskParas.slice(0, maxInSection) : sortedPriorityTaskParas
      logDebug('getPrioritySectionData', `- after limit, now ${priorityTaskParasLimited.length} items to show`)
      priorityTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push(getSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logTimer('getPrioritySectionData', thisStartTime, `- finished finding priority items`)

    const prioritySectionDescription =
      totalPriority > itemCount ? `first {count} of {totalCount}` : `{count}`

    const section: TSection = {
      ID: sectionNum,
      name: 'Priority Tasks',
      showSettingName: 'showPrioritySection',
      sectionCode: thisSectionCode,
      description: prioritySectionDescription,
      FAIconClass: 'fa-regular fa-angles-up',
      // FAIconClass: 'fa-light fa-star-exclamation',
      sectionTitleClass: 'priority',
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalPriority,
      actionButtons: [
      ],
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
 * Make a Section for all projects ready for review
 * Note: this is taking 1815ms for JGC
 * @param {TDashboardSettings} dashboardSettings 
 * @param {boolean} useDemoData?
 * @returns {TSection}
 */
export async function getProjectSectionData(dashboardSettings: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = '15'
    const thisSectionCode = 'PROJ'
    let itemCount = 0
    const maxProjectsToShow = dashboardSettings.maxItemsToShowInSection
    let nextNotesToReview: Array<TNote> = []
    const items: Array<TSectionItem> = []
    logDebug('getProjectSectionData', `------- Gathering ${useDemoData ? 'DEMO' : ''} Project items for section #${String(sectionNum)} --------`)
    const thisStartTime = new Date()

    if (useDemoData) {
      nextNotesToReview = nextProjectNoteItems
      nextNotesToReview.map((n) => {
        const thisID = `${sectionNum}-${itemCount}`
        const thisFilename = n.filename ?? '<filename not found>'
        items.push({
          ID: thisID,
          itemType: 'project',
          project: {
            title: n.title ?? '(error)',
            filename: thisFilename,
            // $FlowIgnore[prop-missing]
            reviewInterval: n.reviewInterval ?? '',
            // $FlowIgnore[prop-missing]
            percentComplete: n.percentComplete ?? NaN,
            // $FlowIgnore[prop-missing]
            lastProgressComment: n.lastProgressComment ?? '',
          },
        })
        itemCount++
      })
    } else {
      if (DataStore.fileExists(fullReviewListFilename)) {
        // But first check to see if it is more than a day old
        const fullReviewListContent = DataStore.loadData(fullReviewListFilename, true)
        // Get date of last generation from file contents, lineIndex 2 ('date: 2024-01-04T23:20:08+00:00')
        const reviewListDateStr = fullReviewListContent?.match(/date: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)?.[1]
        const reviewListDate = moment(reviewListDateStr).toDate()
        const fileAge = Date.now() - reviewListDate
        // If this note is more than a day old, then regenerate it
        if (fileAge > 1000 * 60 * 60 * 24) {
          logDebug('getProjectSectionData', `Regenerating fullReviewList as too old`)
          // Call plugin command makeFullReviewList
          await makeFullReviewList()
        }

        nextNotesToReview = await getNextNotesToReview(0) // get all overdue
      }

      if (nextNotesToReview) {
        // Get list of suitable folders to filter by
        const currentlyAllowedFolders: Array<string> = getCurrentlyAllowedFolders(dashboardSettings)

        nextNotesToReview.map((n) => {
          // If we already have enough projects to show, return early
          if (itemCount >= maxProjectsToShow) { return }

          const thisFilename = n.filename

          // Only continue if this is an allowed folder
          // FIXME: continuing when it shouldn't?
          if (currentlyAllowedFolders !== [] && isFilenameAllowedInFolderList(thisFilename, currentlyAllowedFolders)) {
            // Make a project instance for this note, as a quick way of getting its metadata
            // Note: to avoid getting 'You are running this on an async thread' warnings, ask it not to check Editor.
            const projectInstance = new Project(n, '', false)
            const thisID = `${sectionNum}-${itemCount}`
            items.push({
              ID: thisID,
              itemType: 'project',
              project: {
                title: n.title ?? '(error)',
                filename: thisFilename,
                reviewInterval: projectInstance.reviewInterval,
                percentComplete: projectInstance.percentComplete,
                lastProgressComment: projectInstance.lastProgressComment,
              },
            })
            itemCount++
          }
        })
      } else {
        logDebug('getProjectSectionData', `looked but found no notes to review`)
        // $FlowFixMe[incompatible-return]
        return null
      }
    }
    // clo(nextNotesToReview, "nextNotesToReview")

    const section = {
      name: 'Projects',
      showSettingName: 'showProjectSection',
      ID: sectionNum,
      sectionCode: thisSectionCode,
      description: `{count} project{s} ready to review`,
      sectionItems: items,
      FAIconClass: 'fa-regular fa-chart-gantt',
      // FAIconClass: 'fa-light fa-square-kanban',
      sectionTitleClass: 'projects',
      generatedDate: new Date(),
      actionButtons: [
        {
          display: '<i class="fa-regular fa-play"></i> Start Reviews',
          actionPluginID: 'jgclark.Reviews',
          actionName: 'startReviews',
          actionParam: '',
          tooltip: 'Start reviewing your Project notes',
        },
      ],
    }
    // console.log(JSON.stringify(section))
    logTimer('getProjectSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
    return section
  } catch (error) {
    logError(`getProjectSectionData`, `ERROR: ${error.message}`)
    // $FlowFixMe[incompatible-return]
    return null
  }
}

/**
 * Finds all items within the provided sections that match the given field/value pairs.
 *
 * @param {Array<TSection>} sections - An array of section objects containing sectionItems.
 * @param {Array<string>} fieldPathsToMatch - An array of field paths (e.g., 'para.filename', 'itemType') to match against.
 * @param {Object<string, string|RegExp>} fieldValues - An object containing the field values to match against. Values can be strings or regular expressions.
 * @returns {Array<SectionItemIndex>} An array of objects containing the section index and item index for each matching item.
 * @example const indexes = findSectionItems(sections, ['itemType', 'filename', 'para.content'], { itemType: /open|checklist/, filename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)

 * @author @dwertheimer
 */
export function findSectionItems(
  sections: Array<TSection>,
  fieldPathsToMatch: Array<string>,
  fieldValues: { [key: string]: string | RegExp },
): Array<{ sectionIndex: number, itemIndex: number }> {
  const matches: Array<{ sectionIndex: number, itemIndex: number }> = []

  sections.forEach((section, sectionIndex) => {
    section.sectionItems.forEach((item, itemIndex) => {
      const isMatch = fieldPathsToMatch.every((fieldPath) => {
        const itemFieldValue = getNestedValue(item, fieldPath)
        if (!itemFieldValue) {
          logDebug(`findSectionItems: ${fieldPath} is undefined in ${JSP(item)} -- may be ok if you are looking for a task and this is a review item`)
          return false
        }
        const fieldValue = fieldValues[fieldPath]
        if (fieldValue instanceof RegExp) {
          return fieldValue.test(itemFieldValue)
        } else {
          // logDebug(
          //   `findSectionItems:`,
          //   `${item.ID} itemFieldValue: ${itemFieldValue} ${
          //     itemFieldValue ? (itemFieldValue === fieldValue ? 'equals' : 'does not equal') : 'is undefined'
          //   } fieldValue: ${fieldValue}`,
          // )
          return itemFieldValue ? itemFieldValue === fieldValue : false
        }
      })

      if (isMatch) {
        matches.push({ sectionIndex, itemIndex })
      }
    })
  })

  return matches
}

/**
 * Copies specified fields from a provided object into the corresponding sectionItems in the sections array.
 *
 * @param {Array<SectionItemIndex>} results - An array of results from the findSectionItems function, containing section and item indices.
 * @param {Array<string>} fieldPathsToReplace - An array of field paths (maybe nested) within TSectionItem (e.g. 'itemType', 'para.filename') to copy from the provided object.
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

/**
 * Helper function to get the value of a nested field in an object.
 *
 * @param {Object} obj - The object to search for the nested field.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @returns {any} The value of the nested field, or undefined if the field doesn't exist.
 */
function getNestedValue(obj: any, path: string) {
  const fields = path.split('.')
  let value = obj

  for (const field of fields) {
    if (value && typeof value === 'object' && field in value) {
      value = value[field]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Helper function to set the value of a nested field in an object.
 *
 * @param {Object} obj - The object to set the nested field value in.
 * @param {string} path - The path to the nested field, e.g., 'para.filename'.
 * @param {any} value - The value to set for the nested field.
 */
function setNestedValue(obj: any, path: string, value: any) {
  const fields = path.split('.')
  let currentObj = obj

  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i]
    if (!currentObj.hasOwnProperty(field)) {
      currentObj[field] = {}
    }
    currentObj = currentObj[field]
  }
  const finalField = fields[fields.length - 1]
  currentObj[finalField] = value
}

/**
 * Helper function to create a sectionItem object.
 *
 * @param {string} id - The ID of the sectionItem.
 * @param {TParagraph} p - The paragraph data for the sectionItem.
 * @param {string} theType - The type of the sectionItem (if left blank, will use the para's type)
 * @returns {SectionItem} A sectionItem object.
 */
export function getSectionItemObject(id: string, p: TParagraph | TParagraphForDashboard | null = null, theType?: TItemType): TSectionItem {
  // $FlowIgnore - we are not using all the types in TParagraph
  return ({ ID: id, itemType: theType ?? p.type, para: p })
}