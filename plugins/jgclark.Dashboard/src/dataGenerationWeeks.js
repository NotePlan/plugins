// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TItemType, TParagraphForDashboard, TSectionCode, TSection, TSectionItem, TSectionDetails, TSettingItem } from './types.js'
import { allSectionCodes } from './constants.js'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks.js'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  getRelevantOverdueTasks,
  getSectionItemObject,
  getStartTimeFromPara,
  makeDashboardParas,
} from './dashboardHelpers.js'
import {
  openWeekParas,
  refWeekParas,
  tagParasFromNote,
  nextProjectNoteItems,
} from './demoData.js'
import {
  getDateStringFromCalendarFilename,
  getNPWeekStr,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  filenameIsInFuture,
  includesScheduledFutureDate,
} from '@helpers/dateTime'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { getCurrentTimeBlockPara, getTimeBlockDetails } from '@helpers/timeblocks'
import { isOpen, isOpenTask } from '@helpers/utils'

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
    let sectionNum = '6'
    const thisSectionCode = 'W'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPWeekStr(today)
    const NPSettings = getNotePlanSettings()
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getDataForDashboard', `---------- Gathering Week's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
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
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisWeekHeadings: Array<string> = currentWeeklyNote ? getHeadingsFromNote(currentWeeklyNote, false, true, true, true) : []
    const nextWeekHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisWeekFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisWeekHeadings.length
        // $FlowIgnore[incompatible-type]
        ? [{ type: 'combo', label: 'Under Heading:', key: 'heading', fixedWidth: 560, options: thisWeekHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )
    const nextWeekFormFields: Array<TSettingItem> = formFieldsBase.concat(
      nextWeekHeadings.length
        // $FlowIgnore[incompatible-type]
        ? [{ type: 'combo', label: 'Under Heading:', key: 'heading', fixedWidth: 560, options: nextWeekHeadings, noWrapOptions: true, value: config.newTaskSectionHeading }]
        : [],
    )

    const section: TSection = {
      ID: sectionNum,
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
        },
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to next week's note",
          display: '<i class= "fa-regular fa-circle-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next week's note",
          display: '<i class= "fa-regular fa-square-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
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
        sectionTitleColorPart: 'sidebarWeekly',
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
 * Get open items from Last Week's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getLastWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    let sectionNum = '19' // FIXME: remove sectionNums
    const thisSectionCode = 'LW'
    const sections: Array<TSection> = []
    const items: Array<TSectionItem> = []
    let itemCount = 0
    const NPSettings = getNotePlanSettings()
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = new moment().subtract(1, 'week').format('YYYY-[W]WW')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    // const thisFilename = DataStore.calendarNoteByDate(new moment().subtract(1, 'week').toDate(), 'week')?.filename ?? '(error)'

    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getLastWeekSectionData', `---------- Gathering Last Week's ${useDemoData ? 'DEMO' : ''} items for section #${String(sectionNum)} from ${thisFilename} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${sectionNum}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      const lastWeeklyNote = DataStore.calendarNoteByDateString(dateStr)
      if (lastWeeklyNote) {
        // const thisFilename = lastWeeklyNote?.filename ?? '(error)'
        const dateStr = getDateStringFromCalendarFilename(thisFilename)
        if (!thisFilename.includes(dateStr)) {
          logError('getLastWeekSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod('week', lastWeeklyNote, config, useEditorWherePossible)

        // write one combined section
        sortedOrCombinedParas.map((p) => {
          const thisID = `${sectionNum}-${itemCount}`
          items.push(getSectionItemObject(thisID, p))
          itemCount++
        })
        // logDebug('getLastWeekSectionData', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getLastWeekSectionData', `No weekly note found for filename '${thisFilename}'`)
      }
    }

    const doneCountData = getNumCompletedTasksTodayFromNote(thisFilename, true)

    const section: TSection = {
      ID: sectionNum,
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

    logDebug('getLastWeekSectionData', `- found ${itemCount} weekly items from ${thisFilename} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getLastWeekSectionData', `ERROR: ${error.message}`)
    return []
  }
}
