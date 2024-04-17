// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 15.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getNextNotesToReview,
  makeFullReviewList
} from '../../jgclark.Reviews/src/reviews.js'
import type { TSection, TSectionItem, TParagraphForDashboard } from './types'
import {
  getOpenItemParasForCurrentTimePeriod,
  getRelevantOverdueTasks,
  getSettings,
  makeDashboardParas,
  type dashboardConfigType,
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
  tagParasFromNote,
  nextProjectNoteItems,
} from './demoData'
import {
  getDateStringFromCalendarFilename,
  getNPMonthStr,
  getNPQuarterStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  includesScheduledFutureDate,
  // toISOShortDateTimeString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
// import { displayTitle } from '@helpers/general'
import {
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
import { isOpen } from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

export function getTodaySectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 0
  const thisSectionType = 'DT'
  let itemCount = 0
  const items: Array<TSectionItem> = []
  const todayDateLocale = toNPLocaleDateString(new Date(), "short") // uses moment's locale info from NP
  const thisFilename = `${getTodaysDateUnhyphenated()}.md`

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
      logInfo('getDataForDashboard', `------------- Gathering Today's items for section #${String(sectionNum)} from ${filenameDateStr} --------------`)
      if (!thisFilename.includes(filenameDateStr)) {
        logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", currentDailyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: currentDailyNote.type, para: p })
        itemCount++
      })

      logInfo('getDataForDashboard', `- finished finding daily items from ${filenameDateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No daily note found for filename '${currentDailyNote?.filename ?? 'error'}'`)
    }
  }

  const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')?.filename ?? '(error)'
  const section: TSection = {
    ID: sectionNum, name: 'Today', sectionType: thisSectionType,
    description: `{count} from ${todayDateLocale}`,
    FAIconClass: "fa-light fa-calendar-star",
    sectionTitleClass: "sidebarDaily", sectionFilename: thisFilename,
    sectionItems: items, generated: new Date(),
    actionButtons: [
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to today's note", display: '<i class="fa-regular fa-circle-plus sidebarDaily"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to today's note", display: '<i class="fa-regular fa-square-plus sidebarDaily"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to tomorrow's note", display: '<i class="fa-regular fa-circle-arrow-right sidebarDaily"></i>', actionFunctionParam: nextPeriodFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to tomorrow's note", display: '<i class="fa-regular fa-square-arrow-right sidebarDaily"></i>', actionFunctionParam: nextPeriodFilename },
      { actionFunctionName: "schedule today to tomorrow", actionPluginID: "jgclark.Dashboard", tooltip: "Move or schedule all remaining open items to tomorrow", display: 'All Today <i class="fa-solid fa-right-long"></i> Tomorrow', actionFunctionParam: 'true' /* refresh afterwards */ },
    ]
  }

  // logDebug('getTodaySectionData', JSON.stringify(section))
  return section
}

export function getYesterdaySectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 1
  const thisSectionType = 'DY'
  const yesterday = new moment().subtract(1, 'days').toDate()
  const yesterdayDateLocale = toNPLocaleDateString(yesterday, "short") // uses moment's locale info from NP
  const thisFilename = `${moment(yesterday).format("YYYYMMDD")}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []

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
      logInfo('getDataForDashboard', `------- Gathering Yesterday's items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
      if (!thisFilename.includes(filenameDateStr)) {
        logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)

      // write one combined section
      let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: yesterdaysNote.type, para: p })
        itemCount++
      })

      logInfo('getDataForDashboard', `- finished finding yesterday's items from ${filenameDateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No yesterday note found for filename '${thisFilename}'`)
    }
  }
  const section: TSection = {
    ID: sectionNum, name: 'Yesterday', sectionType: thisSectionType,
    description: `{count} from ${yesterdayDateLocale}`,
    FAIconClass: "fa-light fa-calendar-arrow-up",
    sectionTitleClass: "sidebarDaily", sectionFilename: thisFilename,
    sectionItems: items, generated: new Date(),
    actionButtons: [
      { actionFunctionName: "schedule yesterday to today", actionPluginID: "jgclark.Dashboard", tooltip: 'Move or schedule all open items from yesteday to today', display: 'All <i class="fa-solid fa-right-long"></i> Today', actionFunctionParam: 'true' /* refresh afterwards */ },
    ]
  }

  // return JSON.stringify(section)
  logDebug('getYesterdaySectionData', JSON.stringify(section))
  return section
}

export function getTomorrowSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  try {
    const sectionNum = 2
    const thisSectionType = 'DO'
    const tomorrow = new moment().add(1, 'days').toDate()
    const yesterdayDateLocale = toNPLocaleDateString(tomorrow, "short") // uses moment's locale info from NP
    const filenameDateStr = new moment().add(1, 'days').format('YYYYMMDD')
    const tomorrowsNote = DataStore.calendarNoteByDateString(filenameDateStr)
    const thisFilename = `${moment(tomorrow).format("YYYYMMDD")}.md`
    let itemCount = 0
    const items: Array<TSectionItem> = []

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
        logInfo('getDataForDashboard', `------- Gathering tomorrow's items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getDataForDashboard', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", tomorrowsNote, config)

        // write one combined section
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: tomorrowsNote.type, para: p })
          itemCount++
        })

        logInfo('getDataForDashboard', `- finished finding tomorrow's items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    const section: TSection = {
      ID: sectionNum, name: 'Tomorrow', sectionType: thisSectionType,
      description: `{count} from ${yesterdayDateLocale}`,
      FAIconClass: "fa-light fa-calendar-arrow-down", sectionTitleClass: "sidebarDaily",
      sectionFilename: thisFilename,
      sectionItems: items, generated: new Date(),
      actionButtons: []
    }
    return section
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    return
  }
}

export function getThisWeekSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 3
  const thisSectionType = 'W'
  const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const dateStr = getNPWeekStr(today)
  const thisFilename = `${dateStr}.md`
  let itemCount = 0
  const items: Array<TSectionItem> = []
  logInfo('getDataForDashboard', `------- Gathering Week items for section #${String(sectionNum)} ------------`)

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
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("week", currentWeeklyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: currentWeeklyNote.type, para: p })
        itemCount++
      })

      logInfo('getDataForDashboard', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No weekly note found for filename '${thisFilename}'`)
    }
  }
  const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')?.filename ?? '(error)'
  const section: TSection = {
    ID: sectionNum, name: 'This Week', sectionType: thisSectionType, description: `{count} from ${dateStr}`,
    FAIconClass: "fa-light fa-calendar-week",
    sectionTitleClass: "sidebarWeekly", sectionFilename: thisFilename,
    sectionItems: items, generated: new Date(),
    actionButtons: [
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this week's note", display: '<i class="fa-regular fa-circle-plus sidebarWeekly"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this week's note", display: '<i class="fa-regular fa-square-plus sidebarWeekly"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to tomorrow's note", display: '<i class="fa-regular fa-circle-arrow-right sidebarWeekly"></i>', actionFunctionParam: nextPeriodFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to tomorrow's note", display: '<i class="fa-regular fa-square-arrow-right sidebarWeekly"></i>', actionFunctionParam: nextPeriodFilename },
    ]
  }
  // logDebug('getThisWeekSectionData', JSON.stringify(section))
  return section
}

export function getThisMonthSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 4
  const thisSectionType = 'M'
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
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("month", currentMonthlyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: currentMonthlyNote.type, para: p })
        itemCount++
      })

      logInfo('getDataForDashboard', `- finished finding monthly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No monthly note found for filename '${thisFilename}'`)
    }
  }
  const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')?.filename ?? '(error)'
  const section: TSection = {
    ID: sectionNum, name: 'This Month', sectionType: thisSectionType, description: `{count} from ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", sectionFilename: thisFilename,
    sectionItems: items, generated: new Date(),
    actionButtons: [
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this month's note", display: '<i class="fa-regular fa-circle-plus sidebarMonthly"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this month's note", display: '<i class="fa-regular fa-square-plus sidebarMonthly"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to next month's note", display: '<i class="fa-regular fa-circle-arrow-right sidebarMonthly"></i>', actionFunctionParam: nextPeriodFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new checklist to next month's note", display: '<i class="fa-regular fa-square-arrow-right sidebarMonthly"></i>', actionFunctionParam: nextPeriodFilename },
    ]
  }
  // logDebug('getThisMonthSectionData', JSON.stringify(section))
  return section
}

export function getThisQuarterSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 5
  const thisSectionType = 'M'
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
      const [combinedSortedParas, _sortedRefParas] = getOpenItemParasForCurrentTimePeriod("quarter", currentQuarterlyNote, config)

      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: currentQuarterlyNote.type, para: p })
        itemCount++
      })

      logInfo('getDataForDashboard', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No Quarterly note found for filename '${thisFilename}'`)
    }
  }
  // TODO: This doesn't work in Moment:
  // const nextPeriodFilename = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')?.filename
  const section: TSection = {
    ID: sectionNum, name: 'This Quarter', sectionType: thisSectionType, description: `{count} from ${dateStr}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", sectionFilename: thisFilename,
    sectionItems: items, generated: new Date(),
    actionButtons: [
      { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this quarter's note", display: '<i class="fa-regular fa-circle-plus sidebarQuarterly"></i>', actionFunctionParam: thisFilename },
      { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to this quarter's note", display: '<i class="fa-regular fa-square-plus sidebarQuarterly"></i>', actionFunctionParam: thisFilename },
      // { actionFunctionName: "addTask", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new task to next quarter's note", display: '<i class="fa-regular fa-circle-arrow-right sidebarQuarterly"></i>', actionFunctionParam: nextPeriodFilename },
      // { actionFunctionName: "addChecklist", actionPluginID: "jgclark.Dashboard", tooltip: "Add a new checklist to next quarter's note", display: '<i class="fa-regular fa-square-arrow-right sidebarQuarterly"></i>', actionFunctionParam: nextPeriodFilename },
    ]
  }
  // logDebug('getThisQuarterSectionData', JSON.stringify(section))
  return section
}

//-----------------------------------------------------------
// Note: If we want to do yearly in the future then the icon is fa-calendar-days (same as quarter). This would be #5


/**
 * Add a section for tagToShow, if wanted, and if not running because triggered by a change in the daily note.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future
 * @param {dashboardConfigType} config 
 * @param {boolean} useDemoData?
 */
export function getTaggedSectionData(config: dashboardConfigType, useDemoData: boolean = false): TSection {
  const sectionNum = 7
  const thisSectionType = 'TAG'
  const maxInSection = config.maxTasksToShowInSection ?? 30
  logInfo('getDataForDashboard', `------- Gathering Tag items for section #${String(sectionNum)} --------`)
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
          logDebug('getDataForDashboard', `- ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const tagParasFromNote = n.paragraphs.filter(p => p.content?.includes(config.tagToShow) && isOpen(p) && !includesScheduledFutureDate(p.content))
        // logDebug('getDataForDashboard', `- found ${tagParasFromNote.length} paras`)

        // Save this para, unless in matches the 'ignoreTagMentionsWithPhrase' setting

        for (const p of tagParasFromNote) {
          if (config.ignoreTagMentionsWithPhrase === '' || !p.content.includes(config.ignoreTagMentionsWithPhrase)) {
            filteredTagParas.push(p)
          } else {
            logDebug('getDataForDashboard', `- ignoring para {${p.content}} as it contains '${config.ignoreTagMentionsWithPhrase}'`)
          }
        }

      }
      logInfo('getDataForDashboard', `- ${filteredTagParas.length} paras (after ${timer(thisStartTime)})`)

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines
        filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
        logDebug('getDataForDashboard', `- after sync dedupe -> ${filteredTagParas.length} (after ${timer(thisStartTime)})`)
      // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
      // Note: this is a quick operation
      // const filteredReducedParas = removeDuplicates(reducedParas, ['content', 'filename'])
      // logInfo('getDataForDashboard', `- after deduping overdue -> ${filteredReducedParas.length} (after ${timer(thisStartTime)})`)

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // Note: this is a quick operation
        const dashboardParas = makeDashboardParas(filteredTagParas)
        logInfo('getDataForDashboard', `- after reducing -> ${dashboardParas.length} (after ${timer(thisStartTime)})`)

        totalCount = dashboardParas.length

        // Sort paragraphs by one of several options
        const sortOrder = (config.overdueSortOrder === 'priority')
          ? ['-priority', '-changedDate']
          : (config.overdueSortOrder === 'earliest')
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
        const sortedTagParas = sortListBy(dashboardParas, sortOrder)
        logInfo('getDataForDashboard', `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)} (after ${timer(thisStartTime)})`)

        // Apply limit to set of ordered results
        const sortedTagParasLimited = (sortedTagParas.length > maxInSection) ? sortedTagParas.slice(0, maxInSection) : sortedTagParas
        logDebug('getDataForDashboard', `- after limit, now ${sortedTagParasLimited.length} items to show`)

        for (const p of sortedTagParasLimited) {
          const thisID = `${sectionNum}-${itemCount}`
          const thisFilename = p.filename ?? ''
          items.push({
            ID: thisID, itemType: p.type,
            itemFilename: thisFilename, para: p,
            itemNoteTitle: p.title, noteType: p.type
          })
          itemCount++
        }
      }
    }
  }

  // Return section details, even if no items found
  const tagSectionDescription = (totalCount > itemCount) ? `first {count} from ${String(totalCount)} items ordered by ${config.overdueSortOrder}`
    : `{count} items ordered by ${config.overdueSortOrder}`
  const section: TSection = {
    ID: sectionNum, name: `${config.tagToShow}`,
    sectionType: thisSectionType,
    description: tagSectionDescription,
    FAIconClass: (isHashtag) ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleClass: (isHashtag) ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    generated: new Date(), actionButtons: [],
  }
  return section
}

// ----------------------------------------------------------
// Add a section for Overdue tasks, if wanted, and if not running because triggered by a change in the daily note.
export async function getOverdueSectionData(config: dashboardConfigType, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNum = 8
    const thisSectionType = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxTasksToShowInSection
    const thisStartTime = new Date()

    logInfo('getDataForDashboard', `------- Gathering Overdue Tasks for section #${String(sectionNum)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNum}-${String(c)}`
        const thisType = (c % 3 === 0) ? 'checklist' : 'open'
        const priorityPrefix = (c % 20 === 0) ? '!!! '
          : (c % 10 === 0) ? '!! '
            : (c % 5 === 0) ? '! '
              : ''
        const fakeDateMom = new moment("2023-10-01").add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = (c % 3 < 2)
          ? `${fakeFilenameDateStr}.md`
          : `fake_note_${String(c % 7)}.md`
        const type = (c % 3 < 2) ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${c} >${fakeIsoDateStr}`
        // $FlowIgnore[prop-missing]
        overdueParas.push({
          content: content,
          rawContent: `${(thisType === 'open') ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          filename: filename,
          // $FlowIgnore[prop-missing]
          note: {
            filename: filename,
            title: `Overdue Test Note ${c % 10}`,
            type: type,
            changedDate: `???`,
          }
        })
      }

    } else {
      // Get overdue tasks (and dedupe)
      // Note: Cannot move the reduce move into here otherwise scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      // TODO: find better way to dedupe again
      // const overdueParas = await getRelevantOverdueTasks(config, yesterdaysCombinedSortedParas)
      overdueParas = await getRelevantOverdueTasks(config, [])
      logInfo('getDataForDashboard', `- after reducing paras -> ${overdueParas.length} in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logInfo('getDataForDashboard', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // Remove possible dupes from sync'd lines
      // Note: currently commented out, to save 2? secs of processing
      // overdueParas = eliminateDuplicateSyncedParagraphs(overdueParas)
      // logDebug('getDataForDashboard', `- after sync lines dedupe ->  ${overdueParas.length}`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
      const sortOrder = (config.overdueSortOrder === 'priority')
        ? ['-priority', '-changedDate']
        : (config.overdueSortOrder === 'earliest')
          ? ['changedDate', 'priority']
          : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logInfo('getDataForDashboard', `- Sorted  ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

      // Apply limit to set of ordered results
      // Note: now apply 2x limit, because we also do filtering in the Section component
      const overdueTaskParasLimited = (totalOverdue > (maxInSection * 2)) ? sortedOverdueTaskParas.slice(0, maxInSection * 2) : sortedOverdueTaskParas
      logDebug('getDataForDashboard', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNum}-${itemCount}`
        const thisFilename = p.filename ?? ''
        items.push({ ID: thisID, itemType: p.type, itemFilename: thisFilename, noteType: p.type, para: p })
        itemCount++
      })
    }
    logInfo('getDataForDashboard', `- finished finding overdue items after ${timer(thisStartTime)}`)

    let overdueSectionDescription = (totalOverdue > itemCount)
      ? `first {count} of {totalCount} tasks ordered by ${config.overdueSortOrder}`
      : `all {count} tasks ordered by ${config.overdueSortOrder}`
    overdueSectionDescription += ` {scheduleAllOverdueToday}`

    const section: TSection = {
      ID: sectionNum, name: 'Overdue Tasks', sectionType: thisSectionType,
      description: overdueSectionDescription, FAIconClass: "fa-regular fa-alarm-exclamation", sectionTitleClass: "overdue", sectionFilename: '',
      sectionItems: items, generated: new Date(),
      totalCount: totalOverdue, actionButtons: []
    }
    console.log(JSON.stringify(section))
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    return
  }
}

export async function getProjectSectionData(config: dashboardConfigType, useDemoData: boolean = false): Promise<TSection> {
  const sectionNum = 9
  const thisSectionType = 'PROJ'
  let itemCount = 0
  const maxProjectsToShow = 6
  let nextNotesToReview: Array<TNote> = []
  const items: Array<TSectionItem> = []
  logInfo('getDataForDashboard', `------- Gathering Project items for section #${String(sectionNum)} --------`)

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
      if (fileAge > (1000 * 60 * 60 * 24)) {
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
        itemType: 'review',
        itemNoteTitle: n.title,
        itemFilename: thisFilename,
        noteType: n.type
      })
      itemCount++
    })
    // clo(nextNotesToReview, "nextNotesToReview")
    const section = {
      name: 'Projects',
      ID: sectionNum,
      sectionType: thisSectionType,
      description: `{count} next projects to review`,
      FAIconClass: 'fa-light fa-calendar-check',
      sectionTitleClass: 'sidebarYearly', // TODO:
      // sectionFilename: '',
      sectionItems: items,
      generated: new Date(),
      actionButtons: [{
        display: '<i class="fa-regular fa-play"></i>\u00A0Start\u00A0Reviews',
        actionPluginID: 'jgclark.Reviews',
        actionFunctionName: 'start reviews',
        actionFunctionParam: '',
        tooltip: 'Start reviewing your Project notes',
      }],
    }
    console.log(JSON.stringify(section))
    return section
  } else {
    logDebug('getDataForDashboard', `looked but found no notes to review`)
    return null
  }

}
