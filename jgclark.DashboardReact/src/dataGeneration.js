// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 14.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { getNextNotesToReview, makeFullReviewList } from '../../jgclark.Reviews/src/reviews.js'
import type {
  TSectionCode, TSection, TSectionItem, TParagraphForDashboard, TItemType,
} from './types'
import { allSectionCodes } from './types'
import { getCombinedSettings, getOpenItemParasForCurrentTimePeriod, getRelevantOverdueTasks, getSharedSettings, makeDashboardParas, type dashboardConfigType } from './dashboardHelpers'
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
  tagParasFromNote,
  nextProjectNoteItems,
} from './demoData'
import {
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  // includesScheduledFutureDate,
  // toISOShortDateTimeString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
// import { displayTitle } from '@helpers/general'
import {
  getTimeRangeFromTimeBlockString,
  // localeDateStr,
  toNPLocaleDateString,
  // setMomentLocaleFromEnvironment,
} from '@helpers/NPdateTime'
import {
  findNotesMatchingHashtagOrMention,
  // getReferencedParagraphs
} from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { getTimeBlockString } from '@helpers/timeblocks'
import {
  // isOpen, isOpenTask,
  isOpenNotScheduled, isOpenTaskNotScheduled,
  // removeDuplicates
} from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

/**
 * Generate data for all the sections (that the user currently wants)
 * @param {boolean} demoMode (default: false)
 */
export async function getAllSectionsData(demoMode: boolean = false): Promise<Array<TSection>> {
  try {
    // const config: dashboardConfigType = await getSettings()
    const config: any = await getCombinedSettings()
    // clo(config, 'getAllSectionsData config is currently',2)
    const sections: Array<TSection> = []
    sections.push(getTodaySectionData(config, demoMode))
    if (config.showYesterdaySection) sections.push(getYesterdaySectionData(config, demoMode))
    if (config.showWeekSection) sections.push(getTomorrowSectionData(config, demoMode))
    if (config.showWeekSection) sections.push(getThisWeekSectionData(config, demoMode))
    if (config.showMonthSection) sections.push(getThisMonthSectionData(config, demoMode))
    if (config.showQuarterSection) sections.push(getThisQuarterSectionData(config, demoMode))
    if (config.showTagSection) sections.push(getTaggedSectionData(config, demoMode))
    if (config.showOverdueSection) sections.push(await getOverdueSectionData(config, demoMode))
    sections.push(await getProjectSectionData(config, demoMode))

    return sections
  } catch (error) {
    logError('getAllSectionDetails', error.message)
    return []
  }
}

/**
 * Generate data for some specified sections (subject to user currently wanting them as well)
 * @param {Array<string>} sectionCodes (default: allSectionCodes)
 * @param {boolean} demoMode (default: false)
 * @param {boolean} force (default: false) - refresh sections even if setting is not enabled
 * @returns {Array<TSection>}
 */
export async function getSomeSectionsData(sectionCodes: Array<TSectionCode> = allSectionCodes, demoMode: boolean = false, force: boolean = false): Promise<Array<TSection>> {
  try {
    const sharedSettings: dashboardConfigType = await getSharedSettings()
    const sections: Array<TSection> = []
    if (sectionCodes.includes('DT')) sections.push(getTodaySectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('DY') && force || sharedSettings.showYesterdaySection) sections.push(getYesterdaySectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('DO') && force || sharedSettings.showWeekSection) sections.push(getTomorrowSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('W') && force || sharedSettings.showWeekSection) sections.push(getThisWeekSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('M') && force || sharedSettings.showMonthSection) sections.push(getThisMonthSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('Q') && force || sharedSettings.showQuarterSection) sections.push(getThisQuarterSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('TAG') && force || sharedSettings.tagToShow) sections.push(getTaggedSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('OVERDUE') && force || sharedSettings.showOverdueSection) sections.push(await getOverdueSectionData(sharedSettings, demoMode))
    if (sectionCodes.includes('PROJ') && force || sharedSettings.showProjectSection) sections.push(await getProjectSectionData(sharedSettings, demoMode))
    return sections
  } catch (error) {
    logError('getSomeSectionDetails', error.message)
    return []
  }
}

export function getTodaySectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  try {
    const sectionNum = 0
    const thissectionCode = 'DT'
    let itemCount = 0
    const items: Array<TSectionItem> = []
    const todayDateLocale = toNPLocaleDateString(new Date(), 'short') // uses moment's locale info from NP
    const thisFilename = `${getTodaysDateUnhyphenated()}.md`
    logDebug('getDataForDashboard', `------- Gathering Today's items for section #${String(sectionNum)} ------------`)

    if (useDemoData) {
      const combinedSortedItems = openTodayItems.concat(refTodayItems)
      // write one combined section
      combinedSortedItems.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      const startTime = new Date() // for timing only
      // let currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
      const filenameDateStr = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
      const currentDailyNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅
      if (currentDailyNote) {
        const thisFilename = currentDailyNote?.filename ?? '(error)'
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        logDebug('getDataForDashboard', `------------- Gathering Today's items for section #${String(sectionNum)} from ${filenameDateStr} --------------`)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', currentDailyNote, config)

        // write one combined section
        combinedSortedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          // $FlowIgnore[incompatible-call]
          items.push(getSectionItemObject(thisID,p))
          itemCount++
        })

        logDebug('getDataForDashboard', `- finished finding daily items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No daily note found for filename '${currentDailyNote?.filename ?? 'error'}'`)
      }
    }

    // Now find time blocks and save start and end times
    // finish TEST: support 12-hour times as well
    for (const item of items) {
      const para = item.para
      if (!para) {
        throw new Error(`No para found for item ${item.ID}`)
      }
      const timeBlock = getTimeBlockString(para.content)
      if (timeBlock) {
        // const [startTimeStr, endTimeStr] = timeBlock.split('-')
        const [startTimeStr, endTimeStr] = getTimeRangeFromTimeBlockString(timeBlock)
        para.startTime = startTimeStr
        para.endTime = endTimeStr ?? '' // might not have an end time
      }
    }

    const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')?.filename ?? '(error)'
    const section: TSection = {
      ID: sectionNum,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thissectionCode,
      description: `{count} from ${todayDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-star',
      sectionTitleClass: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      // Note: this often gets stringified to a string, but isn't underneath
      generatedDate: new Date(),
      actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: 'jgclark.DashboardReact',
          display: '<i class= "fa-regular fa-circle-plus sidebarDaily" ></i> ',
          tooltip: "Add a new task to today's note",
          postActionRefresh: ['DT'],
        },
        {
          actionName: 'addChecklist',
          actionParam: thisFilename,
          actionPluginID: 'jgclark.DashboardReact',
          display: '<i class= "fa-regular fa-square-plus sidebarDaily" ></i> ',
          tooltip: "Add a new task to today's note",
          postActionRefresh: ['DT'],
        },
        {
          actionName: 'addTask',
          actionParam: nextPeriodFilename,
          actionPluginID: 'jgclark.DashboardReact',
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a new task to tomorrow's note",
          postActionRefresh: ['DO'],
        },
        {
          actionName: 'addChecklist',
          actionParam: nextPeriodFilename,
          actionPluginID: 'jgclark.DashboardReact',
          display: '<i class= "fa-regular fa-square-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a new task to tomorrow's note",
          postActionRefresh: ['DO'],
        },
        {
          actionName: 'moveAllTodayToTomorrow',
          actionPluginID: 'jgclark.DashboardReact',
          display: 'All Today <i class="fa-solid fa-right-long"></i> Tomorrow',
          tooltip: 'Move or schedule all remaining open items to tomorrow',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DO'] // refresh 2 sections afterwards
        },
      ],
    }

    // logDebug('getTodaySectionData', JSON.stringify(section))
    return section
  } catch (error) {
    logError(`getTodaySectionData`, error.message)
    return {}
  }
}

export function getYesterdaySectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  try {
  const sectionNum = 1
  const thissectionCode = 'DY'
  const yesterday = new moment().subtract(1, 'days').toDate()
  const yesterdayDateLocale = toNPLocaleDateString(yesterday, 'short') // uses moment's locale info from NP
  const thisFilename = `${moment(yesterday).format('YYYYMMDD')}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []
  logDebug('getDataForDashboard', `------- Gathering Yesterday's items for section #${String(sectionNum)} ------------`)

  if (useDemoData) {
    const combinedYesterdaySortedParas = openYesterdayParas.concat(refYesterdayParas)
    // write one combined section
    combinedYesterdaySortedParas.map((item) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    // Get list of open tasks/checklists from yesterday's daily note (if wanted and it exists)
    // const yesterday = new moment().subtract(1, 'days').toDate()
    const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    // let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day') // ❌ seems unreliable
    const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅

    if (yesterdaysNote) {
      const startTime = new Date() // for timing only
      const thisFilename = yesterdaysNote?.filename ?? '(error)'
      // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
      logDebug('getDataForDashboard', `------- Gathering Yesterday's items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
      if (!thisFilename.includes(filenameDateStr)) {
        logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', yesterdaysNote, config)

      // write one combined section
      let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })

      logDebug('getDataForDashboard', `- finished finding yesterday's items from ${filenameDateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No yesterday note found for filename '${thisFilename}'`)
    }
  }
  const section: TSection = {
    ID: sectionNum,
    name: 'Yesterday',
    showSettingName: 'showYesterdaySection',
    sectionCode: thissectionCode,
    description: `{count} from ${yesterdayDateLocale}`,
    FAIconClass: 'fa-light fa-calendar-arrow-up',
    sectionTitleClass: 'sidebarDaily',
    sectionFilename: thisFilename,
    sectionItems: items,
    generatedDate: new Date(),
    actionButtons: [
      {
        actionName: 'moveAllYesterdayToToday',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: 'Move or schedule all open items from yesteday to today',
        display: 'All <i class="fa-solid fa-right-long"></i> Today',
        actionParam: 'true' /* refresh afterwards */,
        postActionRefresh: ['DT', 'DY'] // refresh 2 sections afterwards
      },
    ],
  }

  // return JSON.stringify(section)
  // logDebug('getYesterdaySectionData', JSON.stringify(section))
    return section
  } catch (error) {
    logError(`getYesterdaySectionData`, error.message)
    return {}
  }
}

export function getTomorrowSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  try {
    const sectionNum = 2
    const thissectionCode = 'DO'
    const tomorrow = new moment().add(1, 'days').toDate()
    const yesterdayDateLocale = toNPLocaleDateString(tomorrow, 'short') // uses moment's locale info from NP
    const filenameDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowsNote = DataStore.calendarNoteByDateString(filenameDateStr)
    const thisFilename = `${moment(tomorrow).format('YYYYMMDD')}.md`
    let itemCount = 0
    const items: Array<TSectionItem> = []
    logDebug('getDataForDashboard', `------- Gathering Tomorrow's items for section #${String(sectionNum)} ------------`)

    if (useDemoData) {
      const combinedTomorrowSortedParas = openTomorrowParas.concat(refTomorrowParas)
      // write one combined section
      combinedTomorrowSortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      // Get list of open tasks/checklists from tomorrow's daily note (if it exists)
      if (tomorrowsNote) {
        const startTime = new Date() // for timing only
        const thisFilename = tomorrowsNote?.filename ?? '(error)'
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        logDebug('getDataForDashboard', `------- Gathering tomorrow's items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('day', tomorrowsNote, config)

        // write one combined section
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          // $FlowIgnore[incompatible-call]
          items.push(getSectionItemObject(thisID,p))
          itemCount++
        })

        logDebug('getDataForDashboard', `- finished finding tomorrow's items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    const section: TSection = {
      ID: sectionNum,
      name: 'Tomorrow',
      showSettingName: 'showTomorrowSection',
      sectionCode: thissectionCode,
      description: `{count} from ${yesterdayDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-arrow-down',
      sectionTitleClass: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      actionButtons: [],
    }
    return section
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    // TODO(@dwertheimer): what's a more elegant solution than flow can like?
    return null
  }
}

export function getThisWeekSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 3
  const thissectionCode = 'W'
  const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const dateStr = getNPWeekStr(today)
  const thisFilename = `${dateStr}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []
  logDebug('getDataForDashboard', `------- Gathering Week items for section #${String(sectionNum)} ------------`)

  if (useDemoData) {
    const combinedWeekSortedParas = openWeekParas.concat(refWeekParas)
    // write one combined section
    combinedWeekSortedParas.map((item) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (currentWeeklyNote) {
      const startTime = new Date() // for timing only
      const thisFilename = currentWeeklyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)
      logDebug('getDataForDashboard', `---------------------------- Gathering Weekly items for section #${String(sectionNum)} from ${dateStr}`)
      if (!thisFilename.includes(dateStr)) {
        logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('week', currentWeeklyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })

      logDebug('getDataForDashboard', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No weekly note found for filename '${thisFilename}'`)
    }
  }
  const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')?.filename ?? '(error)'
  const section: TSection = {
    ID: sectionNum,
    name: 'This Week',
    showSettingName: 'showWeekSection',
    sectionCode: thissectionCode,
    description: `{count} from ${dateStr}`,
    FAIconClass: 'fa-light fa-calendar-week',
    sectionTitleClass: 'sidebarWeekly',
    sectionFilename: thisFilename,
    sectionItems: items,
    generatedDate: new Date(),
    actionButtons: [
      {
        actionName: 'addTask',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this week's note",
        display: '<i class= "fa-regular fa-circle-plus sidebarWeekly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['W'],
      },
      {
        actionName: 'addChecklist',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this week's note",
        display: '<i class= "fa-regular fa-square-plus sidebarWeekly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['W'],
      },
      {
        actionName: 'addTask',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to next week's note",
        display: '<i class= "fa-regular fa-circle-arrow-right sidebarWeekly" ></i> ',
        actionParam: nextPeriodFilename,
      },
      {
        actionName: 'addChecklist',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to next week's note",
        display: '<i class= "fa-regular fa-square-arrow-right sidebarWeekly" ></i> ',
        actionParam: nextPeriodFilename,
      },
    ],
  }
  // logDebug('getThisWeekSectionData', JSON.stringify(section))
  return section
}

export function getThisMonthSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 4
  const thissectionCode = 'M'
  const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const dateStr = getNPMonthStr(today)
  const thisFilename = `${dateStr}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []
  logDebug('getDataForDashboard', `------- Gathering Month items for section #${String(sectionNum)} from ${dateStr} ------------`)

  if (useDemoData) {
    const combinedMonthSortedParas = openMonthParas.concat(refMonthParas)
    // write one combined section
    combinedMonthSortedParas.map((item) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    if (currentMonthlyNote) {
      const startTime = new Date() // for timing only
      const thisFilename = currentMonthlyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)
      if (!thisFilename.includes(dateStr)) {
        logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('month', currentMonthlyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })

      logDebug('getDataForDashboard', `- finished finding monthly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
    }
  }
  const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')?.filename ?? '(error)'
  const section: TSection = {
    ID: sectionNum,
    name: 'This Month',
    showSettingName: 'showMonthSection',
    sectionCode: thissectionCode,
    description: `{count} from ${dateStr}`,
    FAIconClass: 'fa-light fa-calendar-range',
    sectionTitleClass: 'sidebarMonthly',
    sectionFilename: thisFilename,
    sectionItems: items,
    generatedDate: new Date(),
    actionButtons: [
      {
        actionName: 'addTask',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this month's note",
        display: '<i class= "fa-regular fa-circle-plus sidebarMonthly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['M'],
      },
      {
        actionName: 'addChecklist',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this month's note",
        display: '<i class= "fa-regular fa-square-plus sidebarMonthly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['M'],
      },
      {
        actionName: 'addTask',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to next month's note",
        display: '<i class= "fa-regular fa-circle-arrow-right sidebarMonthly" ></i> ',
        actionParam: nextPeriodFilename,
      },
      {
        actionName: 'addChecklist',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new checklist to next month's note",
        display: '<i class= "fa-regular fa-square-arrow-right sidebarMonthly" ></i> ',
        actionParam: nextPeriodFilename,
      },
    ],
  }
  // logDebug('getThisMonthSectionData', JSON.stringify(section))
  return section
}

export function getThisQuarterSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 5
  const thissectionCode = 'Q'
  const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const dateStr = getNPQuarterStr(today)
  const thisFilename = `${dateStr}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []

  if (useDemoData) {
    // Test for NO ITEMS
  } else {
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    if (currentQuarterlyNote) {
      const startTime = new Date() // for timing only
      const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)
      logDebug('getDataForDashboard', `---------------------------- Gathering Quarterly items for section #${String(sectionNum)} from ${dateStr}`)
      if (!thisFilename.includes(dateStr)) {
        logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod('quarter', currentQuarterlyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })

      logDebug('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
    }
  }
  // const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')?.filename
  const section: TSection = {
    ID: sectionNum,
    name: 'This Quarter',
    showSettingName: 'showQuarterSection',
    sectionCode: thissectionCode,
    description: `{count} from ${dateStr}`,
    FAIconClass: 'fa-light fa-calendar-days',
    sectionTitleClass: 'sidebarQuarterly',
    sectionFilename: thisFilename,
    sectionItems: items,
    generatedDate: new Date(),
    actionButtons: [
      {
        actionName: 'addTask',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this quarter's note",
        display: '<i class= "fa-regular fa-circle-plus sidebarQuarterly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['Q']
      },
      {
        actionName: 'addChecklist',
        actionPluginID: 'jgclark.DashboardReact',
        tooltip: "Add a new task to this quarter's note",
        display: '<i class= "fa-regular fa-square-plus sidebarQuarterly" ></i> ',
        actionParam: thisFilename,
        postActionRefresh: ['Q']
      },
      // { actionName: "addTask", actionPluginID: "jgclark.DashboardReact", tooltip: "Add a new task to next quarter's note", display: '<i class="fa-regular fa-circle-arrow-right sidebarQuarterly"></i>', actionParam: nextPeriodFilename },
      // { actionName: "addChecklist", actionPluginID: "jgclark.DashboardReact", tooltip: "Add a new checklist to next quarter's note", display: '<i class="fa-regular fa-square-arrow-right sidebarQuarterly"></i>', actionParam: nextPeriodFilename },
    ],
  }
  // logDebug('getThisQuarterSectionData', JSON.stringify(section))
  return section
}

//-----------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is fa-calendar-days (same as quarter). This would be #6
//-----------------------------------------------------------

/**
 * Add a section for tagToShow, if wanted, and if not running because triggered by a change in the daily note.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future
 * @param {dashboardConfigType} config
 * @param {boolean} useDemoData?
 */
export function getTaggedSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 7
  const thissectionCode = 'TAG'
  const maxInSection = config.maxTasksToShowInSection ?? 30
  logDebug('getTaggedSectionData', `------- Gathering Tag items for section #${String(sectionNum)} --------`)
  if (config.ignoreChecklistItems) logDebug('getTaggedSectionData', `Note: will filter out checklists`)
  let itemCount = 0
  let totalCount = 0
  const items: Array<TSectionItem> = []
  let isHashtag = false
  let isMention = false

  if (useDemoData) {
    isHashtag = true
    tagParasFromNote.map((item) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    const thisStartTime = new Date()
    isHashtag = config.tagToShow.startsWith('#')
    isMention = config.tagToShow.startsWith('@')
    if (isHashtag || isMention) {
      let filteredTagParas: Array<TParagraph> = []

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      // Note: this is slow (about 1ms per note, so 3100ms for 3250 notes)
      const notesWithTag = findNotesMatchingHashtagOrMention(config.tagToShow, true)

      for (const n of notesWithTag) {
        // Don't continue if this note is in an excluded folder
        const thisNoteFolder = getFolderFromFilename(n.filename)
        if (config.ignoreFolders.includes(thisNoteFolder)) {
          logDebug('getTaggedSectionData', `- ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const tagParasFromNote = n.paragraphs.filter((p) => p.content?.includes(config.tagToShow))
        // logDebug('getTaggedSectionData', `- found ${tagParasFromNote.length} paras`)

        // Further filter out checklists and otherwise empty items
        const filteredTagParasFromNote = config.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTaskNotScheduled(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpenNotScheduled(p) && p.content.trim() !== '')
        // logDebug('getTaggedSectionData', `- after filtering, ${filteredTagParasFromNote.length} paras`)

        // Save this para, unless in matches the 'ignoreTagMentionsWithPhrase' setting
        for (const p of filteredTagParasFromNote) {
          if (config.ignoreTagMentionsWithPhrase === '' || !p.content.includes(config.ignoreTagMentionsWithPhrase)) {
            filteredTagParas.push(p)
          } else {
            logDebug('getTaggedSectionData', `- ignoring para {${p.content}} as it contains '${config.ignoreTagMentionsWithPhrase}'`)
          }
        }
      }
      logDebug('getTaggedSectionData', `- ${filteredTagParas.length} paras (after ${timer(thisStartTime)})`)

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines
        filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
        logDebug('getTaggedSectionData', `- after sync dedupe -> ${filteredTagParas.length} (after ${timer(thisStartTime)})`)
        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // Note: this is a quick operation
        // const filteredReducedParas = removeDuplicates(reducedParas, ['content', 'filename'])
        // logDebug('getTaggedSectionData', `- after deduping overdue -> ${filteredReducedParas.length} (after ${timer(thisStartTime)})`)

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // Note: this is a quick operation
        const dashboardParas = makeDashboardParas(filteredTagParas)
        logDebug('getTaggedSectionData', `- after reducing -> ${dashboardParas.length} (after ${timer(thisStartTime)})`)

        totalCount = dashboardParas.length

        // Sort paragraphs by one of several options
        const sortOrder =
          config.overdueSortOrder === 'priority'
            ? ['-priority', '-changedDate']
            : config.overdueSortOrder === 'earliest'
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
        const sortedTagParas = sortListBy(dashboardParas, sortOrder)
        logDebug('getTaggedSectionData', `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)} (after ${timer(thisStartTime)})`)

        // Apply limit to set of ordered results
        const sortedTagParasLimited = sortedTagParas.length > maxInSection ? sortedTagParas.slice(0, maxInSection) : sortedTagParas
        logDebug('getTaggedSectionData', `- after limit, now ${sortedTagParasLimited.length} items to show`)

        for (const p of sortedTagParasLimited) {
          const thisID = `${sectionNum}-${itemCount}`
          // const thisFilename = p.filename ?? ''
          // $FlowIgnore[incompatible-call]
          items.push(getSectionItemObject(thisID,p))
          itemCount++
        }
      }
    }
  }

  // Return section details, even if no items found
  const tagSectionDescription =
    totalCount > itemCount ? `first {count} from ${String(totalCount)} items ordered by ${config.overdueSortOrder}` : `{count} items ordered by ${config.overdueSortOrder}`
  const section: TSection = {
    ID: sectionNum,
    name: `${config.tagToShow}`,
    showSettingName: `showTagSection`, // TODO(later): will need to change in v2.1
    sectionCode: thissectionCode,
    description: tagSectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleClass: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    generatedDate: new Date(),
    actionButtons: [],
  }
  return section
}

// ----------------------------------------------------------
// Add a section for Overdue tasks, if wanted, and if not running because triggered by a change in the daily note.
export async function getOverdueSectionData(config: dashboardConfigType, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = 8
    const thissectionCode = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxTasksToShowInSection
    const thisStartTime = new Date()

    logDebug('getDataForDashboard', `------- Gathering Overdue Tasks for section #${String(sectionNum)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNum}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : c % 5 === 0 ? '! ' : ''
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.md` : `fake_note_${String(c % 7)}.md`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${c} >${fakeIsoDateStr}`
        overdueParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Overdue Test Note ${c % 10}`,
            type: type,
            changedDate: `???`,
          },
        })
      }
    } else {
      // Get overdue tasks (and dedupe)
      // Note: Cannot move the reduce move into here otherwise scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      // TODO: find better way to dedupe again
      // const overdueParas = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas)
      overdueParas = await getRelevantOverdueTasks(config, [])
      logDebug('getDataForDashboard', `- after reducing paras -> ${overdueParas.length} in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logDebug('getDataForDashboard', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // Remove possible dupes from sync'd lines
      // Note: currently commented out, to save 2? secs of processing
      // overdueParas = eliminateDuplicateSyncedParagraphs(overdueParas)
      // logDebug('getDataForDashboard', `- after sync lines dedupe ->  ${overdueParas.length}`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder =
        config.overdueSortOrder === 'priority' ? ['-priority', '-changedDate'] : config.overdueSortOrder === 'earliest' ? ['changedDate', 'priority'] : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logDebug('getDataForDashboard', `- Sorted  ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

      // Apply limit to set of ordered results
      // Note: now apply 2x limit, because we also do filtering in the Section component
      const overdueTaskParasLimited = totalOverdue > maxInSection * 2 ? sortedOverdueTaskParas.slice(0, maxInSection * 2) : sortedOverdueTaskParas
      logDebug('getDataForDashboard', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        // const thisFilename = p.filename ?? ''
        // $FlowIgnore[incompatible-call]
        items.push(getSectionItemObject(thisID,p))
        itemCount++
      })
    }
    logDebug('getDataForDashboard', `- finished finding overdue items after ${timer(thisStartTime)}`)

    const overdueSectionDescription =
      totalOverdue > itemCount ? `{count} of {totalCount} tasks ordered by ${config.overdueSortOrder}` : `{count} tasks ordered by ${config.overdueSortOrder}`

    const section: TSection = {
      ID: sectionNum,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thissectionCode,
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
          actionPluginID: 'jgclark.DashboardReact',
          tooltip: 'Schedule all Overdue tasks to Today',
          display: 'All Overdue <i class="fa-solid fa-right-long"></i> Today',
          actionParam: '',
          postActionRefresh: ['OVERDUE']
        },

      ],
    }
    // console.log(JSON.stringify(section))
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    return null
  }
}

export async function getProjectSectionData(config: dashboardConfigType, useDemoData: boolean = false): Promise<TSection> {
  const sectionNum = 9
  const thissectionCode = 'PROJ'
  let itemCount = 0
  const maxProjectsToShow = 6
  let nextNotesToReview: Array<TNote> = []
  const items: Array<TSectionItem> = []
  logDebug('getDataForDashboard', `------- Gathering Project items for section #${String(sectionNum)} --------`)

  if (useDemoData) {
    nextNotesToReview = nextProjectNoteItems
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
        logDebug('getDataForDashboard', `Regenerating fullReviewList as too old`)
        // Call plugin command makeFullReviewList
        await makeFullReviewList()
      }

      nextNotesToReview = getNextNotesToReview(maxProjectsToShow)
    }
  }

  if (nextNotesToReview) {
    nextNotesToReview.map((n) => {
      const thisID = `${sectionNum}-${itemCount}`
      const thisFilename = n.filename ?? '<filename not found>'
      items.push({
        ID: thisID,
        itemType: 'project',
        project: {
          title: n.title ?? '(error)',
          filename: thisFilename,
        },
      })
      itemCount++
    })
    // clo(nextNotesToReview, "nextNotesToReview")
    const section = {
      name: 'Projects',
      showSettingName: 'showProjectSection',
      ID: sectionNum,
      sectionCode: thissectionCode,
      description: `{count} next projects to review`,
      sectionItems: items,
      FAIconClass: 'fa-light fa-calendar-check',
      sectionTitleClass: 'sidebarYearly',
      generatedDate: new Date(),
      actionButtons: [
        {
          display: '<i class="fa-regular fa-play"></i> Start Reviews',
          actionPluginID: 'jgclark.Reviews',
          actionName: 'start reviews',
          actionParam: '',
          tooltip: 'Start reviewing your Project notes',
        },
      ],
    }
    console.log(JSON.stringify(section))
    return section
  } else {
    logDebug('getDataForDashboard', `looked but found no notes to review`)
    return null
  }
}

// type SectionItemIndex = { sectionIndex: number, itemIndex: number }

/**
 * Finds all items within the provided sections that match the given field/value pairs.
 *
 * @param {Array<TSection>} sections - An array of section objects containing sectionItems.
 * @param {Array<string>} fieldPaths - An array of field paths (e.g., 'para.filename', 'itemType') to match against.
 * @param {Object<string, string|RegExp>} fieldValues - An object containing the field values to match against. Values can be strings or regular expressions.
 * @returns {Array<SectionItemIndex>} An array of objects containing the section index and item index for each matching item.
 * @example const indexes = findSectionItems(sections, ['itemType', 'filename', 'para.content'], { itemType: /open|checklist/, filename: oldFilename, 'para.content': oldContent }) // find all references to this content (could be in multiple sections)

 * @author @dwertheimer
 */
export function findSectionItems(
  sections: Array<TSection>,
  fieldPaths: Array<string>,
  fieldValues: { [key: string]: string | RegExp },
): Array<{ sectionIndex: number, itemIndex: number }> {
  const matches: Array<{ sectionIndex: number, itemIndex: number }> = []

  sections.forEach((section, sectionIndex) => {
    section.sectionItems.forEach((item, itemIndex) => {
      const isMatch = fieldPaths.every((fieldPath) => {
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
 * @param {Array<string>} fieldPaths - An array of field paths (e.g., 'para.filename', 'itemType') to copy from the provided object.
 * @param {Object} updatedValues - The object containing the field values to be copied.
 * @param {Array<TSection>} sections - The original sections array to be modified.
 * @returns {Array<TSection>} The modified sections array with the specified fields copied into the corresponding sectionItems.
 */
export function copyUpdatedSectionItemData(
  results: Array<{ sectionIndex: number, itemIndex: number }>,
  fieldPaths: Array<string>,
  updatedValues: { [key: string]: any },
  sections: Array<TSection>,
): Array<TSection> {
  results.forEach(({ sectionIndex, itemIndex }) => {
    const sectionItem = sections[sectionIndex].sectionItems[itemIndex]

    fieldPaths.forEach((fieldPath) => {
      // const [firstField, ...remainingPath] = fieldPath.split('.')
      const value = getNestedValue(updatedValues, fieldPath)
      if (value !== undefined) {
        setNestedValue(sectionItem, fieldPath, value)
      }
    })
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
export function getSectionItemObject(id:string,p:TParagraph|null = null,theType?:TItemType):TSectionItem {
  // $FlowIgnore - we are not using all the types in TParagraph
  return ({ ID: id, itemType: theType ?? p.type, para: p })
}