// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data for day-based notes
// Last updated for 2.1.0.b
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type {
  TDashboardSettings,
  TParagraphForDashboard,
  TSection,
  TSectionItem,
  TSettingItem,
} from './types'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  createSectionItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  // createSectionItemObject,
  getStartTimeFromPara,
  makeDashboardParas,
} from './dashboardHelpers'
import { openTodayItems, refTodayItems, openTomorrowParas, refTomorrowParas, openYesterdayParas, refYesterdayParas } from './demoData'
import {
  getTodaysDateHyphenated, getTodaysDateUnhyphenated,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import {
  getHeadingsFromNote,
} from '@helpers/NPnote'
import { getCurrentTimeBlockPara, getTimeBlockDetails } from '@helpers/timeblocks'

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
    let sectionNumStr = '0'
    const thisSectionCode = 'DT'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
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
    logInfo('getTodaySectionData', `--------- Gathering Today's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} from ${filenameDateStr} --------`)
    const timer = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section items
      // Note: parentID already supplied
      const sortedItems = config.separateSectionForReferencedNotes ? openTodayItems : openTodayItems.concat(refTodayItems)
      sortedItems.map((item) => {
        if (item.para) {
          const timeStr = getStartTimeFromPara(item.para)
          // $FlowIgnore[incompatible-use] already checked item.para exists
          item.para.startTime = timeStr
        }
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        // itemCount++
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

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length
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
          [{ type: 'dropdown-select', label: 'Under Heading:', key: 'heading', fixedWidth: 300, options: todayHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const tomorrowFormFields: Array<TSettingItem> = formFieldsBase.concat(
      tomorrowHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              fixedWidth: 300,
              // $FlowFixMe[incompatible-type]
              options: tomorrowHeadings,
              noWrapOptions: true,
              value: config.newTaskSectionHeading,
            },
          ]
        : [],
    )
    const anyDayFormFields: Array<TSettingItem> = formFieldsBase.concat([{ type: 'calendarpicker', label: 'Date:', key: 'date', numberOfMonths: 2 }])

    const section: TSection = {
      ID: sectionNumStr,
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
          submitButtonText: 'Add & Close',
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
          submitButtonText: 'Add & Close',
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
          submitButtonText: 'Add & Close',
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
          submitButtonText: 'Add & Close',
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
          submitButtonText: 'Add & Close',
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
      let items: Array<TSectionItem> = []
      sectionNumStr = '1'
      if (useDemoData) {
        const sortedRefParas = refTodayItems
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      if (items.length > 0) {
        const section: TSection = {
          ID: sectionNumStr,
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
    let sectionNumStr = '2'
    let itemCount = 0
    const sections: Array<TSection> = []
    const thisSectionCode = 'DY'
    const yesterday = new moment().subtract(1, 'days').toDate()
    const yesterdayDateLocale = toNPLocaleDateString(yesterday, 'short') // uses moment's locale info from NP
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${moment(yesterday).format('YYYYMMDD')}.${NPSettings.defaultFileExtension}`
    let items: Array<TSectionItem> = []
    // const yesterday = new moment().subtract(1, 'days').toDate()
    const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
    // let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day') // ❌ seems unreliable
    const yesterdaysNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} from ${filenameDateStr} ----------`)
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
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        // itemCount++
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

        // // write items for first (or combined) section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logDebug('getDataForDashboard', `- finished finding yesterday's items from ${filenameDateStr} after ${timer(startTime)}`)
        itemCount = items.length
      } else {
        logDebug('getDataForDashboard', `No yesterday note found using filename '${thisFilename}'`)
      }
    }
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNumStr,
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
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      sectionNumStr = '3'
      if (useDemoData) {
        const sortedRefParas = refYesterdayParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // make a sectionItem for each item, and then make a section too.
          // sortedRefParas.map((p) => {
          //   const thisID = `${sectionNumStr}-${itemCount}`
          //   items.push(createSectionItemObject(thisID, p))
          //   itemCount++
          // })
          // Iterate and write items for first (or combined) section
          items = createSectionItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
      if (items.length > 0) {
        const section: TSection = {
          ID: sectionNumStr,
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
        sections.push(section)
      }
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
    let sectionNumStr = '4'
    const thisSectionCode = 'DO'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
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
    logDebug('getDataForDashboard', `---------- Gathering Tomorrow's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
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
        const thisID = `${sectionNumStr}-${itemCount}`
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

        // // write items for first or combined section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logDebug('getDataForDashboard', `- finished finding tomorrow's items from ${filenameDateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    const section: TSection = {
      ID: sectionNumStr,
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
      let items: Array<TSectionItem> = []
      sectionNumStr = '5'
      if (useDemoData) {
        const sortedRefParas = refTomorrowParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // // make a sectionItem for each item, and then make a section too.
          // sortedRefParas.map((p) => {
          //   const thisID = `${sectionNumStr}-${itemCount}`
          //   items.push(createSectionItemObject(thisID, p))
          //   itemCount++
          // })
          // Iterate and write items for this section
          items = createSectionItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
      if (items.length > 0) {
        const section: TSection = {
          ID: sectionNumStr,
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
        sections.push(section)
      }
    }

    logDebug('getDataForDashboard', `- found ${itemCount} Tomorrow items from ${filenameDateStr} in ${timer(startTime)}`)
    return [section]
  } catch (error) {
    logError('getDataForDashboard/tomorrow', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get the current time block paras from Today's note if it exists.
 * Ignore any time block paras that are done or cancelled.
 * TODO: Make this cover time blocks for today scheduled from regular notes. Note: these are calculated normally about the same time as this section. So perhaps roll the two together and generate two sections?
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @returns {Array<TSection>}
 */
export function getTimeBlockSectionData(_config: TDashboardSettings, useDemoData: boolean = false): TSection {
  try {
    const sectionNumStr = '16'
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
      const thisID = `${sectionNumStr}-0`
      // I was trying to reorder the display of the timeblock para content, but that makes life very difficult for editing or checking off time block items
      const thisDParas = makeDashboardParas([timeblockPara])
      // // change text so that time details are always at the front
      // // If this timeblock is on a task or checklist line, leave the type alone, otherwise make it type 'timeblock'. This affects StatusIcon.
      // thisDPara.content = `${timeBlockString} ${contentWithoutTimeBlock}`
      // // handle priority markers
      // if (thisDPara.priority > 0) {
      //   const priorityMarker = ['!', '!!', '!!!', '>>'][thisDPara.priority - 1]
      //   thisDPara.content = `${priorityMarker} ${thisDPara.content}`
      // }
      if (thisDParas.length > 0) {
        const thisDPara = thisDParas[0]
        if (thisDPara) {
          const itemTypeToUse = thisDPara.type === 'open' || thisDPara.type === 'checklist' ? thisDPara.type : 'timeblock'
          const thisSectionItemObject = { ID: thisID, itemType: itemTypeToUse, para: thisDPara }
          // $FlowFixMe[incompatible-call]
          items.push(thisSectionItemObject)
        } else {
          logDebug('getTimeBlockSectionData', `Can't fully show time block as this is DEMO data.`)
        }
      } else {
        if (useDemoData) {
          logDebug('getTimeBlockSectionData', `Can't fully show time block as this is DEMO data.`)
        } else {
          logWarn('getTimeBlockSectionData', `Couldn't find thisDPara to match '${timeBlockParaContent}'. Doesn't `)
        }
      }
    }

    const section: TSection = {
      ID: sectionNumStr,
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
