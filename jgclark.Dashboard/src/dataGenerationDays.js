// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data for day-based notes
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TItemType, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSectionDetails, TSettingItem } from './types'
import { allSectionCodes } from './constants.js'
import { getTagSectionDetails } from './react/components/Section/sectionHelpers.js'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getSectionItemObject,
  getStartTimeFromPara,
  makeDashboardParas,
} from './dashboardHelpers'
import { openTodayItems, refTodayItems, openTomorrowParas, refTomorrowParas, openYesterdayParas, refYesterdayParas } from './demoData'
import { getDateStringFromCalendarFilename, getTodaysDateHyphenated, getTodaysDateUnhyphenated, filenameIsInFuture, includesScheduledFutureDate } from '@helpers/dateTime'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { getCurrentTimeBlockPara, getTimeBlockDetails } from '@helpers/timeblocks'
import { isOpen, isOpenTask } from '@helpers/utils'

//--------------------------------------------------------------------
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
    logInfo('getTodaySectionData', `--------- Gathering Today's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} from ${filenameDateStr} --------`)
    const timer = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section items
      const sortedItems = config.separateSectionForReferencedNotes ? openTodayItems : openTodayItems.concat(refTodayItems)
      sortedItems.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowIgnore[incompatible-use] already checked item.para exists
          item.para.startTime = timeStr
          // item.parentID = ''
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
          logError('getTodaySectionData', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('day', currentDailyNote, config, useEditorWherePossible)
        // logDebug('getTodaySectionData', `getOpenItemParasForTimePeriod Found ${sortedOrCombinedParas.length} open items and ${sortedRefParas.length} refs to ${filenameDateStr}`)

        // write items for first (or combined) section
        let lastIndent0ParentID = ''
        let lastIndent1ParentID = ''
        let lastIndent2ParentID = ''
        let lastIndent3ParentID = ''
        for (const socp of sortedOrCombinedParas) {
          const thisID = `${sectionNum}-${itemCount}`
          const thisSectionItemObject = getSectionItemObject(thisID, socp)
          // Now add parentID where relevant
          if (socp.isAChild) {
            const parentParaID =
              socp.indentLevel === 1
                ? lastIndent0ParentID
                : socp.indentLevel === 2
                ? lastIndent1ParentID
                : socp.indentLevel === 3
                ? lastIndent2ParentID
                : socp.indentLevel === 4
                ? lastIndent3ParentID
                : '' // getting silly by this point, so stop
            thisSectionItemObject.parentID = parentParaID
            logInfo(``, `- found parentID ${parentParaID} for ID ${thisID}`)
          }
          if (socp.hasChild) {
            switch (socp.indentLevel) {
              case 0: {
                lastIndent0ParentID = thisID
                break
              }
              case 1: {
                lastIndent1ParentID = thisID
                break
              }
              case 2: {
                lastIndent2ParentID = thisID
                break
              }
              case 3: {
                lastIndent3ParentID = thisID
                break
              }
            }
          }
          items.push(thisSectionItemObject)
          itemCount++
        }
      } else {
        logDebug('getTodaySectionData', `No daily note found using filename '${thisFilename}'`)
      }
    }

    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    logDebug('getTodaySectionData', `- nextPeriodFilename = ${nextPeriodFilename}`)
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const todayHeadings: Array<string> = currentDailyNote ? getHeadingsFromNote(currentDailyNote, false, true, true, true) : []
    const tomorrowHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const todayFormFields: Array<TSettingItem> = formFieldsBase.concat(
      todayHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', fixedWidth: 560, options: todayHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const tomorrowFormFields: Array<TSettingItem> = formFieldsBase.concat(
      tomorrowHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [{ type: 'combo', label: 'Under Heading:', key: 'heading', fixedWidth: 560, options: tomorrowHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const anyDayFormFields: Array<TSettingItem> = formFieldsBase.concat([{ type: 'calendarpicker', label: 'Date:', key: 'date', numberOfMonths: 2 }])

    const section: TSection = {
      ID: sectionNum,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thisSectionCode,
      description: `{count} from ${todayDateLocale}`,
      FAIconClass: 'fa-light fa-calendar-star',
      sectionTitleColorPart: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-circle-plus sidebarDaily" ></i> ',
          tooltip: "Add a new task to today's note",
          postActionRefresh: ['DT'],
          formFields: todayFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-square-plus sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to today's note",
          postActionRefresh: ['DT'],
          formFields: todayFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addTask',
          actionParam: nextPeriodFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a new task to tomorrow's note",
          postActionRefresh: ['DO'],
          formFields: tomorrowFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionParam: nextPeriodFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-square-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to tomorrow's note",
          postActionRefresh: ['DO'],
          formFields: tomorrowFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addTaskToFuture',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-calendar-plus sidebarDaily" ></i> ',
          tooltip: 'Add a new task to future note',
          postActionRefresh: ['DT'],
          formFields: anyDayFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'moveAllTodayToTomorrow',
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: 'All <i class="fa-solid fa-right-long"></i> Tomorrow',
          tooltip: 'Move or schedule all remaining open items to tomorrow',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DO'], // refresh 2 sections afterwards
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
        sectionTitleColorPart: 'sidebarDaily',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
        actionButtons: [],
      }
      sections.push(section)
    }

    logTimer('getTodaySectionData', timer, `- found ${itemCount} daily items from ${filenameDateStr}`)

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
    const thisFilename = `${moment(yesterday).format('YYYYMMDD')}.${NPSettings.defaultFileExtension}`
    const items: Array<TSectionItem> = []
    // const yesterday = new moment().subtract(1, 'days').toDate()
    const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    // let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day') // ❌ seems unreliable
    const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} from ${filenameDateStr} ----------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write one or combined section items
      const sortedItems = config.separateSectionForReferencedNotes ? openYesterdayParas : openYesterdayParas.concat(refYesterdayParas)
      sortedItems.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowIgnore[incompatible-use] already checked item.para exists
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
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('day', yesterdaysNote, config, useEditorWherePossible)

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
      sectionTitleColorPart: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'moveAllYesterdayToToday',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Move or schedule all open items from yesteday to today',
          display: 'All <i class="fa-solid fa-right-long"></i> Today',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DY'], // refresh 2 sections afterwards
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
        sectionTitleColorPart: 'sidebarDaily',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
      }
      // clo(section)
      sections.push(section)
    }

    logTimer('getDataForDashboard', startTime, `- found ${itemCount} yesterday items from ${filenameDateStr}`)
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
      const sortedParas = config.separateSectionForReferencedNotes ? openTomorrowParas : openTomorrowParas.concat(refTomorrowParas)
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
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('day', tomorrowsNote, config, useEditorWherePossible)

        // write items for first or combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
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
      sectionTitleColorPart: 'sidebarDaily',
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
        sectionTitleColorPart: 'sidebarDaily',
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
 * Get the current time block paras from Today's note if it exists. Ignore any time block paras that are done or cancelled.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {Array<TSection>}
 */
export function getTimeBlockSectionData(_config: TDashboardSettings, useDemoData: boolean = false): TSection {
  try {
    const sectionNum = '16'
    const thisSectionCode = 'TB'
    const items: Array<TSectionItem> = []
    const NPSettings = getNotePlanSettings()
    const mustContainString = NPSettings.timeblockMustContainString
    const thisFilename = `${getTodaysDateUnhyphenated()}.${NPSettings.defaultFileExtension}`
    const filenameDateStr = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
    const currentDailyNote = DataStore.calendarNoteByDateString(filenameDateStr)
    logInfo('getTimeBlockSectionData', `--------- Gathering${useDemoData ? ' DEMO' : ''} time blocks from ${filenameDateStr} with mCS ${mustContainString} ----------`)
    const startTime = new Date() // for timing only
    let timeblockPara: ?TParagraph

    if (useDemoData) {
      const fakeTodayNoteParagraphs: Array<TParagraphForDashboard> = []
      for (const item of openTodayItems) {
        if (item.para) fakeTodayNoteParagraphs.push(item.para)
      }
      // $FlowFixMe[prop-missing]
      // $FlowFixMe[incompatible-type]
      const fakeTodayNote: TNote = {
        // $FlowFixMe[incompatible-type]
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-exact]
        paragraphs: fakeTodayNoteParagraphs,
        type: 'Calendar',
        title: getTodaysDateHyphenated(),
        filename: `${filenameDateStr}.md`,
      }
      clo(fakeTodayNote, `fakeTodayNote`)
      timeblockPara = getCurrentTimeBlockPara(fakeTodayNote, true, mustContainString)
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      if (currentDailyNote) {
        timeblockPara = getCurrentTimeBlockPara(currentDailyNote, true, mustContainString)
      } else {
        logDebug('getTimeBlockSectionData', `No daily note found using filename '${filenameDateStr}'`)
      }
    }

    if (!timeblockPara) {
      logDebug('getTimeBlockSectionData', `-> none`)
    } else {
      const timeBlockParaContent = timeblockPara?.content ?? ''
      const [timeBlockString, contentWithoutTimeBlock] = getTimeBlockDetails(timeBlockParaContent, mustContainString)
      logDebug('getTimeBlockSectionData', `-> ${timeBlockString} / ${contentWithoutTimeBlock}`)

      // write item for section
      const thisID = `${sectionNum}-0`
      // I was trying to reorder the display of the timeblock para content, but that makes life very difficult for editing or checking off time block items
      const thisDPara = makeDashboardParas([timeblockPara])[0]
      // // change text so that time details are always at the front
      // // If this timeblock is on a task or checklist line, leave the type alone, otherwise make it type 'timeblock'. This affects StatusIcon.
      // thisDPara.content = `${timeBlockString} ${contentWithoutTimeBlock}`
      // // handle priority markers
      // if (thisDPara.priority > 0) {
      //   const priorityMarker = ['!', '!!', '!!!', '>>'][thisDPara.priority - 1]
      //   thisDPara.content = `${priorityMarker} ${thisDPara.content}`
      // }
      const itemTypeToUse = thisDPara.type === 'open' || thisDPara.type === 'checklist' ? thisDPara.type : 'timeblock'
      const thisSectionItemObject = { ID: thisID, itemType: itemTypeToUse, para: thisDPara }
      // $FlowFixMe[incompatible-call]
      items.push(thisSectionItemObject)
    }

    const section: TSection = {
      ID: sectionNum,
      name: 'Current time block',
      showSettingName: 'showTimeBlockSection',
      sectionCode: thisSectionCode,
      description: '', //`current time block`,
      FAIconClass: 'fa-light fa-calendar-clock',
      sectionTitleColorPart: 'sidebarYearly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      actionButtons: [],
    }
    // clo(section)
    logTimer('getTimeBlockSectionData', startTime, `- found Current Time Block from ${filenameDateStr}`)

    return section
  } catch (error) {
    logError(`getTimeBlockSectionData`, error.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}
