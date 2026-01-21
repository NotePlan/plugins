// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-11-28 for v2.3.0.b16, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  appendCalendarSectionsFilterToDescription,
  createSectionOpenItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
} from './dashboardHelpers'
import { openWeekParas, refWeekParas } from './demoData'
import { getNPWeekStr, MOMENT_FORMAT_NP_WEEK } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'

//-----------------------------------------------------------------

/**
 * Get open items from this Week's note, and scheduled to This Week from other notes.
 * Includes relevant Teamspace calendar notes.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getThisWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
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
    logInfo('getDataForDashboard', `---------- Gathering Week's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} (${thisFilename}) ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write first or combined section
      const sortedParas = config.separateSectionForReferencedNotes ? openWeekParas : openWeekParas.concat(refWeekParas)
      sortedParas.map((item) => {
        const thisID = `${thisSectionCode}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentWeeklyNote) {
        // const dateStr = getDateStringFromCalendarFilename(thisFilename)
        logDebug('getThisWeekSectionData', `- filename '${thisFilename}' for '${dateStr}'`)
        if (!thisFilename.includes(dateStr)) {
          logError('getThisWeekSectionData', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'week', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length
        // logDebug('getDataForDashboard', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No weekly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')
    const nextPeriodFilename = nextPeriodNote?.filename ?? '(error)'
    const doneCountData = getNumCompletedTasksFromNote(thisFilename, true, true, config)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const formFieldsBase: Array<TSettingItem> = [{ type: 'input', label: 'Task:', key: 'text', focus: true }]
    const thisWeekHeadings: Array<string> = currentWeeklyNote ? getHeadingsFromNote(currentWeeklyNote, false, true, true, true) : []
    const nextWeekHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    // Set the default heading to add to, unless it's '<<carry forward>>', in which case we'll use an empty string
    const defaultHeadingToAddTo: string = config.newTaskSectionHeading !== '<<carry forward>>' ? config.newTaskSectionHeading : ''
    const thisWeekFormFields: Array<TSettingItem> = formFieldsBase.concat(
      thisWeekHeadings.length

        ? // $FlowIgnore[incompatible-type]
          [
            {
              type: 'dropdown-select',
              label: 'Under Heading:',
              key: 'heading',
              // $FlowFixMe[incompatible-type]
              options: thisWeekHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
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
              // $FlowFixMe[incompatible-type]
              options: nextWeekHeadings,
              noWrapOptions: true,
              value: defaultHeadingToAddTo,
            },
          ]
        : [],
    )
    let sectionDescription = `{countWithLimit} {itemType} from ${dateStr}`
    sectionDescription = appendCalendarSectionsFilterToDescription(sectionDescription, config)
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Week',
      showSettingName: 'showWeekSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-week',
      sectionTitleColorPart: 'sidebarWeekly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: items.length,
      doneCounts: doneCountData,
      actionButtons: [
        {
          actionName: 'addTask',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a new task to this week's note",
          display: '<i class= "fa-regular fa-fw fa-circle-plus sidebarWeekly" ></i> ',
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
          display: '<i class= "fa-regular fa-fw fa-square-plus sidebarWeekly" ></i> ',
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
          display: '<i class= "fa-regular fa-fw fa-circle-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'addChecklist',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Add a checklist item to next week's note",
          display: '<i class= "fa-regular fa-fw fa-square-arrow-right sidebarWeekly" ></i> ',
          actionParam: nextPeriodFilename,
          formFields: nextWeekFormFields,
          submitOnEnter: true,
          submitButtonText: 'Add & Close',
        },
        {
          actionName: 'moveAllThisWeekNextWeek',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: config.rescheduleNotMove
            ? '(Re)Schedule all open items from this week to next week. (Press ⌘-click to move instead.)'
            : 'Move all open items from this week to next week. (Press ⌘-click to (re)schedule instead.)',
          display: 'All <i class="fa-solid fa-right-long"></i> Next Week',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['W'], // refresh the week section afterwards
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refWeekParas
        sortedRefParas.map((item) => {
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current weekly note (if it exists)
        if (sortedRefParas.length > 0) {
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (whether or not there are any items found; this is needed for React to render an empty section properly)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Week',
        showSettingName: 'showWeekSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-calendar-week',
        sectionTitleColorPart: 'sidebarWeekly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
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
 * Get open items from Last Week's note, and scheduled to Last Week from other notes.
 * Includes relevant Teamspace calendar notes.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {TSection} data
 */
export function getLastWeekSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'LW'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const NPSettings = getNotePlanSettings()
    const dateStr = new moment().subtract(1, 'week').format(MOMENT_FORMAT_NP_WEEK) // use moment instead of `new Date` to ensure we get a date in the local timezone
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`

    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logInfo('getLastWeekSectionData', `---------- Gathering Last Week's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} from ${thisFilename} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      const lastWeeklyNote = DataStore.calendarNoteByDateString(dateStr)
      // Get list of open tasks/checklists from last week's calendar note (if it exists)
      if (lastWeeklyNote) {
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'week', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionOpenItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logTimer('getLastWeekSectionData', startTime, `- finished finding weekly items from ${dateStr}`)
      } else {
        logDebug('getLastWeekSectionData', `No weekly note found for filename '${thisFilename}'`)
      }
    }

    const doneCountData = getNumCompletedTasksFromNote(thisFilename, true, true, config)
    let sectionDescription = `{countWithLimit} {itemType} from ${dateStr}`
    sectionDescription = appendCalendarSectionsFilterToDescription(sectionDescription, config)
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Last Week',
      showSettingName: 'showLastWeekSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-calendar-week',
      sectionTitleColorPart: 'sidebarWeekly',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: [
        {
          actionName: 'moveAllLastWeekThisWeek',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: config.rescheduleNotMove
            ? '(Re)Schedule all open items from last week to this week. (Press ⌘-click to move instead.)'
            : 'Move all open items from last week to this week. (Press ⌘-click to (re)schedule instead.)',
          display: 'All <i class="fa-solid fa-right-long"></i> This Week',
          actionParam: 'true', // refresh afterwards
          postActionRefresh: ['LW', 'W'], // refresh the week section afterwards
        },
      ],
      isReferenced: false,
    }
    sections.push(section)
    logTimer('getLastWeekSectionData', startTime, `- made LW-19 direct section with ${String(itemCount)} items`)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      const referencedSectionCode = `${thisSectionCode}_REF`
      let items: Array<TSectionItem> = []
      if (useDemoData) {
        const sortedRefParas = refWeekParas
        sortedRefParas.map((item) => {
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current weekly note (if it exists)
        if (sortedRefParas.length > 0) {
          items = createSectionOpenItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (whether or not there are any items found; this is needed for React to render an empty section properly)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Last Week',
        showSettingName: 'showLastWeekSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-calendar-week',
        sectionTitleColorPart: 'sidebarWeekly',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
      logTimer('getLastWeekSectionData', startTime, `- made LW-20 referenced section with ${String(itemCount)} items in total`)
    }

    logTimer('getLastWeekSectionData', startTime, `- found ${itemCount} weekly items from ${thisFilename}`)
    return sections
  } catch (error) {
    logError('getLastWeekSectionData', `ERROR: ${error.message}`)
    return []
  }
}
