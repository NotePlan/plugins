// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated for 2.1.0.b
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  createSectionItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  // createSectionItemObject,
} from './dashboardHelpers'
import { openWeekParas, refWeekParas } from './demoData'
import {
  getDateStringFromCalendarFilename,
  getNPWeekStr,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'

//-----------------------------------------------------------------

/**
 * Get open items from this Week's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNumStr = '6'
    const thisSectionCode = 'W'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPWeekStr(today)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `---------- Gathering Week's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentWeeklyNote) {
        // const thisFilename = currentWeeklyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisWeekSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('week', currentWeeklyNote, config, useEditorWherePossible)

        // // write one combined section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length
        // logDebug('getDataForDashboard', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No weekly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisWeekHeadings: Array<string> = currentWeeklyNote ? getHeadingsFromNote(currentWeeklyNote, false, true, true, true) : []
    const nextWeekHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisWeekFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisWeekHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              fixedWidth: 300,
              // $FlowFixMe[incompatible-type]
              options: thisWeekHeadings,
              noWrapOptions: true,
              value: config.newTaskSectionHeading,
            },
          ]
        : [],
    )
    const nextWeekFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextWeekHeadings.length
        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              fixedWidth: 300,
              // $FlowFixMe[incompatible-type]
              options: nextWeekHeadings,
              noWrapOptions: true,
              value: config.newTaskSectionHeading,
            },
          ]
        : [],
    )

    const section: TSection = {
      ID: sectionNumStr,
      name: 'This Week',
      showSettingName: 'showWeekSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-week',
      sectionTitleColorPart: 'sidebarWeekly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this week's note",
          display: '<i class= "fa-regular fa-circle-plus sidebarWeekly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['W'],
          formFields: thisWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to this week's note",
          display: '<i class= "fa-regular fa-square-plus sidebarWeekly" ></i> ',
          actionParam: thisFilename,
          postActionRefresh: ['W'],
          formFields: thisWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next week's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next week's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'moveAllThisWeekNextWeek',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Move or schedule all open items from this week to next week',
          display: 'All <i class="fa-solid fa-right-long"></i> Next Week',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['W'], // refresh the week section afterwards
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      sectionNumStr = '7'
      if (useDemoData) {
        const sortedRefParas = refWeekParas
        sortedRefParas.map((item) => {
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current weekly note (if it exists)
        if (sortedRefParas.length > 0) {
          // // make a sectionItem for each item, and then make a section too.
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
          name: '>This Week',
          showSettingName: 'showWeekSection',
          sectionCode: thisSectionCode,
          description: `{count} scheduled to ${dateStr}`,
          FAIconClass: 'fa-light fa-calendar-week',
          sectionTitleColorPart: 'sidebarWeekly',
          sectionFilename: thisFilename,
          sectionItems: items,
          generatedDate: new Date(),
          actionButtons: [],
        }
        sections.push(section)
      }
    }

    logDebug('getDataForDashboard', `- found ${itemCount} weekly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('xxx', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from Last Week's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getLastWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNumStr = '19' // TODO: remove sectionNumStrs
    const thisSectionCode = 'LW'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const NPSettings = getNotePlanSettings()
    const dateStr = new moment().subtract(1, 'week').format('YYYY-[W]WW') // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`

    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getLastWeekSectionData', `---------- Gathering Last Week's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNumStr)} from ${thisFilename} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      const lastWeeklyNote = DataStore.calendarNoteByDateString(dateStr)
      if (lastWeeklyNote) {
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getLastWeekSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('week', lastWeeklyNote, config, useEditorWherePossible)

        // write one combined section
        // sortedOrCombinedParas.map((p) => {
        //   const thisID = `${sectionNumStr}-${itemCount}`
        //   items.push(createSectionItemObject(thisID, p))
        //   itemCount++
        // })
        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, sectionNumStr)
        itemCount += items.length

        // logDebug('getLastWeekSectionData', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getLastWeekSectionData', `No weekly note found for filename '${thisFilename}'`)
      }
    }

    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Last Week',
      showSettingName: 'showLastWeekSection',
      sectionCode: thisSectionCode,
      description: `{count} from ${dateStr}`,
      FAIconClass: 'fa-light fa-calendar-week',
      sectionTitleColorPart: 'sidebarWeekly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'moveAllLastWeekThisWeek',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Move or schedule all open items from last week to this week',
          display: 'All <i class="fa-solid fa-right-long"></i> This Week',
          actionParam: 'true', // refresh afterwards
          postActionRefresh: ['LW', 'W'], // refresh the week section afterwards
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      sectionNumStr = '20'
      if (useDemoData) {
        const sortedRefParas = refWeekParas
        sortedRefParas.map((item) => {
          const thisID = `${sectionNumStr}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current weekly note (if it exists)
        if (sortedRefParas.length > 0) {
          // // make a sectionItem for each item, and then make a section too.
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
          name: '>Last Week',
          showSettingName: 'showWeekSection',
          sectionCode: thisSectionCode,
          description: `{count} scheduled to ${dateStr}`,
          FAIconClass: 'fa-light fa-calendar-week',
          sectionTitleColorPart: 'sidebarWeekly',
          sectionFilename: thisFilename,
          sectionItems: items,
          generatedDate: new Date(),
          actionButtons: [],
        }
        sections.push(section)
      }
    }

    logDebug('getLastWeekSectionData', `- found ${itemCount} weekly items from ${thisFilename} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getLastWeekSectionData', `ERROR: ${error.message}`)
    return []
  }
}
