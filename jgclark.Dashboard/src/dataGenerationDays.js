// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data for day-based notes
// Last updated 2026-01-01 for v2.4.0-b4
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getDoneCountsForToday, getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  createSectionItemObject,
  createSectionOpenItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getStartTimeFromPara,
} from './dashboardHelpers'
import { openTodayItems, refTodayItems, openTomorrowParas, refTomorrowParas, openYesterdayParas, refYesterdayParas } from './demoData'
import { getTodaysDateUnhyphenated } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { isActiveOrFutureTimeBlockPara } from '@helpers/timeblocks'
import { isOpen } from '@helpers/utils'

//--------------------------------------------------------------------
/**
 * Shared helper function to get paragraph data for today's note.
 * Used by both DT and TB section generation to avoid duplicate data fetching.
 * TODO: look at caching this data for slightly better performance.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>, string, string, TNote?]} [sortedOrCombinedParas, sortedRefParas, filenameDateStr, thisFilename, currentDailyNote]
 */
function getTodayParasData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>, string, string, TNote | null] {
  const NPSettings = getNotePlanSettings()
  const thisFilename = `${getTodaysDateUnhyphenated()}.${NPSettings.defaultFileExtension}`
  const filenameDateStr: string = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
  const currentDailyNote: ?TNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅ reliable
  let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
  let sortedRefParas: Array<TParagraphForDashboard> = []

  if (!useDemoData && currentDailyNote) {
    // Get list of open tasks/checklists from this calendar note
    // Note: returns timeblocks (which may include just bullets) as well as tasks/checklists
    ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible, true)
    logDebug('getTodayParasData', `getOpenItemParasForTimePeriod Found ${sortedOrCombinedParas.length} open items and ${sortedRefParas.length} refs to ${filenameDateStr}`)
  }

  return [sortedOrCombinedParas, sortedRefParas, filenameDateStr, thisFilename, currentDailyNote ?? null]
}

//--------------------------------------------------------------------
/**
 * Get open items from Today's note, and scheduled to Today from other notes.
 * Includes relevant Teamspace calendar notes.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getTodaySectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'DT'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const todayDateLocale = toNPLocaleDateString(new Date(), 'short') // uses moment's locale info from NP
    logInfo('getTodaySectionData', `--------- Gathering Today's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} --------`)
    const startTime = new Date() // for timing only

    // Get shared paragraph data
    const [sortedOrCombinedParas, sortedRefParas, filenameDateStr, thisFilename, currentDailyNote] = getTodayParasData(config, useDemoData, useEditorWherePossible)

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
          const thisID = `${thisSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item }) // thisID is already present in demo data
        }
      })
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      if (currentDailyNote) {
        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length
      } else {
        logDebug('getTodaySectionData', `No daily note found using filename '${thisFilename}'`)
      }
    }

    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(errorthisFilename'
    const doneCountData = getDoneCountsForToday()
    clo(doneCountData, 'dataGenerationDays: doneCountData') // x zero here

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
      ID: thisSectionCode,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-star',
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
          postActionRefresh: config.showTimeBlockSection ? ['DT', 'TB'] : ['DT'],
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
          postActionRefresh: config.showTimeBlockSection ? ['DT', 'TB'] : ['DT'],
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
          actionParam: 'true' /* refresh afterwards */,
          actionPluginID: `${pluginJson['plugin.id']}`,
          display: 'All <i class="fa-solid fa-right-long"></i> Tomorrow',
          tooltip: config.rescheduleNotMove
            ? '(Re)Schedule all open items from today to tomorrow. (Press ⌘-click to move instead.)'
            : 'Move all open items from today to tomorrow. (Press ⌘-click to (re)schedule instead.)',
          postActionRefresh: config.showTimeBlockSection ? ['DT', 'TB', 'DO'] : ['DT', 'DO'],
        },
      ],
    }
    // clo(section, 'dataGenerationDays: content')
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refTodayItems
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowIgnore[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Today',
        showSettingName: 'showTodaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${todayDateLocale}`,
        FAIconClass: 'fa-regular fa-calendar-star',
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

    return sections
  } catch (error) {
    logError(`getTodaySectionData`, error.message)
    return []
  }
}

/**
 * Get timeblock section data for today's note.
 * Uses shared helper to get paragraph data, then filters for timeblocks.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} 1 section (TB) or empty array
 */
export function getTimeBlockSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    if (!config.showTimeBlockSection) {
      return []
    }

    const TBsectionCode = 'TB'
    const sections: Array<TSection> = []
    const NPSettings = getNotePlanSettings()
    logInfo('getTimeBlockSectionData', `--------- Gathering Timeblock ${useDemoData ? 'DEMO' : ''} items for section ${TBsectionCode} --------`)
    const startTime = new Date() // for timing only

    // Get shared paragraph data
    const [sortedOrCombinedParas, sortedRefParas, filenameDateStr, thisFilename, currentDailyNote] = getTodayParasData(config, useDemoData, useEditorWherePossible)

    const timeBlockItems: Array<TSectionItem> = []
    const combinedParas = sortedOrCombinedParas.concat(sortedRefParas)
    const mustContainString = NPSettings.timeblockMustContainString

    if (useDemoData) {
      // For demo data, filter demo items that have timeblocks
      const allDemoItems = openTodayItems.concat(refTodayItems)
      let itemCounter = 0
      for (const item of allDemoItems) {
        // $FlowIgnore[prop-missing]
        // $FlowIgnore[incompatible-call]
        if (item.para && isActiveOrFutureTimeBlockPara(item.para, mustContainString)) {
          const thisID = `${TBsectionCode}-${itemCounter}`
          logDebug('getTimeBlockSectionData', `+ TB ${thisID}: {${item.para?.content ?? '(error)'} from ${item.para?.filename ?? '(error)'}`)
          // $FlowIgnore[prop-missing]
          // $FlowIgnore[incompatible-call]
          const thisSectionItemObject = createSectionItemObject(thisID, 'TB', item.para)
          timeBlockItems.push(thisSectionItemObject)
          itemCounter++
        }
      }
    } else {
      // Now iterate through the combined paras, and make a sectionItem for each that includes a time block
      // Note: this is a cut-down version of createSectionOpenItemsFromParas
      let itemCounter = 0
      for (const p of combinedParas) {
        // $FlowIgnore[prop-missing]
        // $FlowIgnore[incompatible-use]
        if (isActiveOrFutureTimeBlockPara(p, mustContainString)) {
          const thisID = `${TBsectionCode}-${itemCounter}`
          logDebug('getTimeBlockSectionData', `+ TB ${thisID}: {${p.content}} from ${p.filename}`)
          const thisSectionItemObject = createSectionItemObject(thisID, 'TB', p)
          timeBlockItems.push(thisSectionItemObject)
          itemCounter++
        } else {
          // logDebug('getTimeBlockSectionData', `- no TB in {${p.content}} from ${p.filename}`)
        }
      }
    }

    const section: TSection = {
      ID: TBsectionCode,
      sectionCode: 'TB',
      name: 'Current time block',
      showSettingName: 'showTimeBlockSection',
      description: '',
      FAIconClass: 'fa-regular fa-calendar-clock',
      sectionTitleColorPart: 'sidebarYearly',
      sectionFilename: thisFilename,
      sectionItems: timeBlockItems,
      generatedDate: new Date(),
      isReferenced: false,
      actionButtons: [],
    }
    logTimer('getTimeBlockSectionData', startTime, `- found ${String(timeBlockItems.length)} timeblock items from ${filenameDateStr}`)
    sections.push(section)

    return sections
  } catch (error) {
    logError(`getTimeBlockSectionData`, error.message)
    return []
  }
}

/**
 * Get open items from Yesterday's note, and scheduled to Yesterday from other notes.
 * Includes relevant Teamspace calendar notes.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getYesterdaySectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
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
    logInfo('getYesterdaySectionData', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} from ${filenameDateStr} ----------`)
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
        const thisID = `${thisSectionCode}-${itemCount}`
        items.push({ ID: thisID, ...item })
        // itemCount++
      })
    } else {
      // Get list of open tasks/checklists from yesterday's daily note (if it exists)
      if (yesterdaysNote) {
        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logTimer('getYesterdaySectionData', startTime, `- finished finding yesterday's items from ${filenameDateStr}`)
      } else {
        logDebug('getYesterdaySectionData', `No yesterday note found using filename '${thisFilename}'`)
      }
    }
    // Note: this only counts from yesterday's note
    const doneCountData = getNumCompletedTasksFromNote(thisFilename)
    let sectionDescription = `{closedOrOpenTaskCount} from ${yesterdayDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Yesterday',
      showSettingName: 'showYesterdaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-arrow-up',
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
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refYesterdayParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowIgnore[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Yesterday',
        showSettingName: 'showYesterdaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${yesterdayDateLocale}`,
        FAIconClass: 'fa-regular fa-calendar-star',
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
    logDebug('getTomorrowSectionData', `---------- Gathering Tomorrow's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
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
        const thisID = `${thisSectionCode}-${itemCount}`
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
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
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
      ID: thisSectionCode,
      name: 'Tomorrow',
      showSettingName: 'showTomorrowSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-arrow-down',
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
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refTomorrowParas
        sortedRefParas.map((item) => {
          if (item.para) {
            const timeStr = getStartTimeFromPara(item.para)
            // $FlowFixMe[incompatible-use] already checked item.para exists
            item.para.startTime = timeStr
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }
      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Tomorrow',
        showSettingName: 'showTomorrowSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${tomorrowDateLocale}`,
        FAIconClass: 'fa-regular fa-calendar-arrow-down',
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
