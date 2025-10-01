// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data for day-based notes
// Last updated 2025-05-09 for v2.2.2
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  createSectionItemObject,
  createSectionOpenItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getStartTimeFromPara,
} from './dashboardHelpers'
import { openTodayItems, refTodayItems, openTomorrowParas, refTomorrowParas, openYesterdayParas, refYesterdayParas } from './demoData'
import { getTodaysDateUnhyphenated } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { isActiveOrFutureTimeBlockPara } from '@helpers/timeblocks'
import { isOpen } from '@helpers/utils'

//--------------------------------------------------------------------
/**
 * Get open items from Today's note
 * TODO: finish? add support for Teamspace daily notes
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
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section items
      // Note: parentID already supplied
      const sortedItems = config.separateSectionForReferencedNotes ? openTodayItems : openTodayItems.concat(refTodayItems)
      sortedItems.map((item) => {
        // $FlowIgnore[prop-missing]
        // $FlowFixMe[incompatible-call]
        if (isOpen(item.para)) {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowIgnore[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item }) // thisID is already present in demo data
        }
      })
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      if (currentDailyNote) {
        // const filenameDateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(filenameDateStr)) {
          logError('getTodaySectionData', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        // Note: now returns timeblocks (which may include just bullets) as well as tasks/checklists
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible, true)
        logDebug('getTodaySectionData', `getOpenItemParasForTimePeriod Found ${sortedOrCombinedParas.length} open items and ${sortedRefParas.length} refs to ${filenameDateStr}`)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length
      } else {
        logDebug('getTodaySectionData', `No daily note found using filename '${thisFilename}'`)
      }
    }

    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(errorthisFilename'
    logDebug('getTodaySectionData', `- nextPeriodFilename = ${nextPeriodFilename}`)
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const todayHeadings: Array<string> = currentDailyNote ? getHeadingsFromNote(currentDailyNote, false, true, true, false) : []
    const tomorrowHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, false) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const todayFormFields: Array<TSettingItem> = formFieldsBase.concat(
      todayHeadings.length
        ? // $FlowIgnore[incompatible-type]
        [{ type: 'dropdown-select', label: 'Under Heading:', key: 'heading', options: todayHeadings, noWrapOptions: true, value: defaultHeadingToAddTo }]
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
              // $FlowIgnore[incompatible-type]
              options: tomorrowHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )

    let sectionDescription = `{closedOrOpenTaskCount} from ${todayDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-light fa-calendar-star',
      sectionTitleColorPart: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
      doneCounts: doneCountData,
      totalCount: items.length,
      isReferenced: false,
      actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-fw  fa-circle-plus sidebarDaily" ></i> ',
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
          display: '<i class= "fa-regular fa-fw  fa-square-plus sidebarDaily" ></i> ',
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
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarDaily" ></i> ',
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
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to tomorrow's note",
          postActionRefresh: ['DO'],
          formFields: tomorrowFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'moveAllTodayToTomorrow',
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: 'All <i class="fa-solid fa-right-long"></i> Tomorrow',
          tooltip: config.rescheduleNotMove
            ? '(Re)Schedule all open items from today to tomorrow. (Press ⌘-click to move instead.)'
            : 'Move all open items from today to tomorrow. (Press ⌘-click to (re)schedule instead.)',
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
            // $FlowIgnore[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
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
        totalCount: items.length,
        generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
        isReferenced: true,
        actionButtons: [],
      }
      sections.push(section)
    }

    logTimer('getTodaySectionData', startTime, `- found ${itemCount} daily items from ${filenameDateStr}`)

    //------------------------------------------------------------
    // Add a section for time blocks, if wanted
    if (config.showTimeBlockSection) {
      const TBsectionNumStr = '16'
      const timeBlockItems: Array<TSectionItem> = []
      const combinedParas = sortedOrCombinedParas.concat(sortedRefParas)
      const mustContainString = NPSettings.timeblockMustContainString

      // Now iterate through the combined paras, and make a sectionItem for each that includes a time block
      // Note: this is a cut-down version of createSectionOpenItemsFromParas
      let itemCounter = 0
      for (const p of combinedParas) {
        // $FlowIgnoree[prop-missing]
        // $FlowIgnoree[incompatible-use]
        if (isActiveOrFutureTimeBlockPara(p, mustContainString)) {
          const thisID = `${TBsectionNumStr}-${itemCounter}`
          logDebug('getTodaySectionData', `+ TB ${thisID}: {${p.content}} from ${p.filename}`)
          const thisSectionItemObject = createSectionItemObject(thisID, p)
          timeBlockItems.push(thisSectionItemObject)
          itemCounter++
        } else {
          // logDebug('getTodaySectionData', `- no TB in {${p.content}} from ${p.filename}`)
        }
      }

      const section: TSection = {
        ID: TBsectionNumStr,
        sectionCode: 'TB',
        name: 'Current time block',
        showSettingName: 'showTimeBlockSection',
        description: '',
        FAIconClass: 'fa-light fa-calendar-clock',
        sectionTitleColorPart: 'sidebarYearly',
        sectionFilename: thisFilename,
        sectionItems: timeBlockItems,
        generatedDate: new Date(),
        isReferenced: false,
        actionButtons: [],
      }
      logTimer('getTodaySectionData', startTime, `- found ${String(timeBlockItems.length)} timeblock items from ${filenameDateStr}`)
      sections.push(section)
    }

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
    logInfo('getYesterdaySectionData', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} from ${filenameDateStr} ----------`)
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
          logError('getYesterdaySectionData', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logTimer('getYesterdaySectionData', startTime, `- finished finding yesterday's items from ${filenameDateStr}`)
        itemCount = items.length
      } else {
        logDebug('getYesterdaySectionData', `No yesterday note found using filename '${thisFilename}'`)
      }
    }
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)
    let sectionDescription = `{closedOrOpenTaskCount} from ${yesterdayDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Yesterday',
      showSettingName: 'showYesterdaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-light fa-calendar-arrow-up',
      sectionTitleColorPart: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      isReferenced: false,
      actionButtons: [
        {
          actionName: 'moveAllYesterdayToToday',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: config.rescheduleNotMove
            ? '(Re)Schedule all open items from yesterday to today. (Press ⌘-click to move instead.)'
            : 'Move all open items from yesterday to today. (Press ⌘-click to (re)schedule instead.)',
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
            // $FlowIgnore[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
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
        totalCount: items.length,
        generatedDate: new Date(),
        isReferenced: true,
        actionButtons: [],
      }
      sections.push(section)
    }

    logTimer('getYesterdaySectionData', startTime, `- found ${itemCount} yesterday items from ${filenameDateStr}`)
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
    logDebug('getTomorrowSectionData', `---------- Gathering Tomorrow's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
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
          logError('getTomorrowSectionData', `- found filename '${thisFilename}' but '${filenameDateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logTimer('getTomorrowSectionData', startTime, `- finished finding tomorrow's items from ${filenameDateStr}`)
      } else {
        logDebug('getTomorrowSectionData', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const tomorrowHeadings: Array<string> = tomorrowsNote ? getHeadingsFromNote(tomorrowsNote, false, true, true, false) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const tomorrowFormFields: Array<TSettingItem> = formFieldsBase.concat(
      tomorrowHeadings.length
        ? // $FlowIgnore[incompatible-type]
        [{ type: 'dropdown-select', label: 'Under Heading:', key: 'heading', options: tomorrowHeadings, noWrapOptions: true, value: defaultHeadingToAddTo }]
        : [],
    )

    let sectionDescription = `{count} from ${tomorrowDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Tomorrow',
      showSettingName: 'showTomorrowSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-light fa-calendar-arrow-down',
      sectionTitleColorPart: 'sidebarDaily',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: items.length,
      isReferenced: false,
      actionButtons: [
        {
          actionName: 'addTask',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-fw  fa-circle-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a new task to tomorrow's note",
          postActionRefresh: ['DO'],
          formFields: tomorrowFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionParam: thisFilename,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: '<i class= "fa-regular fa-fw  fa-square-arrow-right sidebarDaily" ></i> ',
          tooltip: "Add a checklist item to tomorrow's note",
          postActionRefresh: ['DO'],
          formFields: tomorrowFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
      ],
    }
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
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, sectionNumStr)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
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
        totalCount: items.length,
        generatedDate: new Date(),
        isReferenced: true,
        actionButtons: [],
      }
      sections.push(section)
    }

    logDebug('getTomorrowSectionData', `- found ${itemCount} Tomorrow items from ${filenameDateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getTomorrowSectionData', `ERROR: ${error.message}`)
    return []
  }
}
