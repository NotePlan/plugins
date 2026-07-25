// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin: generate data for month / quarter / year calendar sections
// Last updated 2026-07-23 for v2.4.0.b54 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TActionButton, TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getNumCompletedTasksFromCalendarNote } from './countDoneTasks'
import {
  buildAddTaskChecklistButtons,
  buildAddTaskFormFields,
  createSectionItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
} from './dashboardHelpers'
import { openMonthParas, refMonthParas } from './demoData'
import { getNPMonthStr, getNPQuarterStr, getNPYearStr } from '@helpers/dateTime'
import { logDebug, logError, logTimer, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'

//-----------------------------------------------------------------

/**
 * Get open items from this Month's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} data
 */
export function getThisMonthSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'M'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPMonthStr(today)
    const NPSettings = getNotePlanSettings()
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getThisMonthSectionData', `---------- Gathering Month's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      const sortedParas = config.separateSectionForReferencedNotes ? openMonthParas : openMonthParas.concat(refMonthParas)
      // Note: parentID already supplied
      sortedParas.map((item) => {
        const thisID = `${thisSectionCode}-${itemCount}`
        items.push({ ID: thisID, ...item })
        itemCount++
      })
    } else {
      if (currentMonthlyNote) {
        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'month', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        logTimer('getThisMonthSectionData', startTime, `- finished finding monthly items from ${dateStr}`)
      } else {
        logDebug('getThisMonthSectionData', `No monthly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'month').toDate(), 'month')
    // Omit "add to next month" buttons when NotePlan has no next-month note filename (do not ship a sentinel like '(error)')
    const nextPeriodFilename = nextPeriodNote?.filename || ''
    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const thisMonthHeadings: Array<string> = currentMonthlyNote ? getHeadingsFromNote(currentMonthlyNote, false, true, true, true) : []
    const nextMonthHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisMonthFormFields: Array<TSettingItem> = buildAddTaskFormFields(thisMonthHeadings, config)
    const nextMonthFormFields: Array<TSettingItem> = buildAddTaskFormFields(nextMonthHeadings, config)

    let sectionDescription = `{closedOrOpenTaskCount} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const actionButtons: Array<TActionButton> = [
      ...buildAddTaskChecklistButtons({
        filename: thisFilename,
        formFields: thisMonthFormFields,
        colorClass: 'MonthlyColor',
        taskTooltip: "Add a new task to this month's note",
        checklistTooltip: "Add a checklist item to this month's note",
        postActionRefresh: ['M'],
      }),
    ]
    if (nextPeriodFilename) {
      actionButtons.push(
        ...buildAddTaskChecklistButtons({
          filename: nextPeriodFilename,
          formFields: nextMonthFormFields,
          colorClass: 'MonthlyColor',
          taskTooltip: "Add a new task to next month's note",
          checklistTooltip: "Add a checklist item to next month's note",
          iconVariant: 'arrow-right',
        }),
      )
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Month',
      showSettingName: 'showMonthSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-range',
      sectionTitleColorPart: 'MonthlySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: actionButtons,
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        const sortedRefParas = refMonthParas
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current monthly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for first (or combined) section
          items = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Month',
        showSettingName: 'showMonthSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-range',
        sectionTitleColorPart: 'MonthlySectionColor',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logTimer('getThisMonthSectionData', startTime, `- found ${itemCount} monthly items from ${thisFilename}`)
    return sections
  } catch (error) {
    logError('getThisMonthSectionData', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Quarter's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} data
 */
export function getThisQuarterSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'Q'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPQuarterStr(today)
    const NPSettings = getNotePlanSettings()
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getThisQuarterSectionData', `---------- Gathering Quarter's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      if (currentQuarterlyNote) {
        // Get list of open tasks/checklists from this quarterly note (if it exists)
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'quarter', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logDebug('getThisQuarterSectionData', `- finished finding Quarterly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getThisQuarterSectionData', `No Quarterly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'quarter').toDate(), 'quarter')
    // Omit "add to next quarter" buttons when NotePlan has no next-quarter note filename
    const nextPeriodFilename = nextPeriodNote?.filename || ''
    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const thisQuarterHeadings: Array<string> = currentQuarterlyNote ? getHeadingsFromNote(currentQuarterlyNote, false, true, true, true) : []
    const nextQuarterHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisQuarterFormFields: Array<TSettingItem> = buildAddTaskFormFields(thisQuarterHeadings, config)
    const nextQuarterFormFields: Array<TSettingItem> = buildAddTaskFormFields(nextQuarterHeadings, config)

    let sectionDescription = `{countWithLimit} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const actionButtons: Array<TActionButton> = [
      ...buildAddTaskChecklistButtons({
        filename: thisFilename,
        formFields: thisQuarterFormFields,
        colorClass: 'QuarterlyColor',
        taskTooltip: "Add a new task to this quarter's note",
        checklistTooltip: "Add a checklist item to this quarter's note",
        postActionRefresh: ['Q'],
      }),
    ]
    if (nextPeriodFilename) {
      actionButtons.push(
        ...buildAddTaskChecklistButtons({
          filename: nextPeriodFilename,
          formFields: nextQuarterFormFields,
          colorClass: 'QuarterlyColor',
          taskTooltip: "Add a new task to next quarter's note",
          checklistTooltip: "Add a checklist item to next quarter's note",
          iconVariant: 'arrow-right',
        }),
      )
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Quarter',
      showSettingName: 'showQuarterSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-days',
      sectionTitleColorPart: 'QuarterlySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: actionButtons,
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current quarterly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Quarter',
        showSettingName: 'showQuarterSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-days',
        sectionTitleColorPart: 'QuarterlySectionColor',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getThisQuarterSectionData', `- found ${itemCount} quarterly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getThisQuarterSectionData', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get open items from this Year's note
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @returns {Array<TSection>} data
 */
export function getThisYearSectionData(config: TDashboardSettings, useDemoData: boolean = false, useEditorWherePossible: boolean): Array<TSection> {
  try {
    const thisSectionCode = 'Y'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const dateStr = getNPYearStr(today)
    const NPSettings = getNotePlanSettings()
    const currentYearlyNote = DataStore.calendarNoteByDate(today, 'year')
    const thisFilename = `${dateStr}.${NPSettings.defaultFileExtension}`
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []
    logDebug('getThisYearSectionData', `---------- Gathering Year's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      if (currentYearlyNote) {
        // Get list of open tasks/checklists from this yearly note (if it exists)
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'year', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logDebug('getThisYearSectionData', `- finished finding Yearly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getThisYearSectionData', `No Yearly note found for filename '${thisFilename}'`)
      }
    }
    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'year').toDate(), 'year')
    // Omit "add to next year" buttons when NotePlan has no next-year note filename
    const nextPeriodFilename = nextPeriodNote?.filename || ''
    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const thisYearHeadings: Array<string> = currentYearlyNote ? getHeadingsFromNote(currentYearlyNote, false, true, true, true) : []
    const nextYearHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisYearFormFields: Array<TSettingItem> = buildAddTaskFormFields(thisYearHeadings, config)
    const nextYearFormFields: Array<TSettingItem> = buildAddTaskFormFields(nextYearHeadings, config)

    let sectionDescription = `{countWithLimit} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const actionButtons: Array<TActionButton> = [
      ...buildAddTaskChecklistButtons({
        filename: thisFilename,
        formFields: thisYearFormFields,
        colorClass: 'YearlyColor',
        taskTooltip: "Add a new task to this year's note",
        checklistTooltip: "Add a checklist item to this year's note",
        postActionRefresh: ['Y'],
      }),
    ]
    if (nextPeriodFilename) {
      actionButtons.push(
        ...buildAddTaskChecklistButtons({
          filename: nextPeriodFilename,
          formFields: nextYearFormFields,
          colorClass: 'YearlyColor',
          taskTooltip: "Add a new task to next year's note",
          checklistTooltip: "Add a checklist item to next year's note",
          iconVariant: 'arrow-right',
        }),
      )
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Year',
      showSettingName: 'showYearSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-days',
      sectionTitleColorPart: 'YearlySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      doneCounts: doneCountData,
      totalCount: items.length,
      actionButtons: actionButtons,
      isReferenced: false,
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (useDemoData) {
        // No demo data
      } else {
        // Get list of open tasks/checklists from current yearly note (if it exists)
        if (sortedRefParas.length > 0) {
          // Iterate and write items for this section
          items = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          itemCount += items.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>This Year',
        showSettingName: 'showYearSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${dateStr}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-days',
        sectionTitleColorPart: 'YearlySectionColor',
        sectionFilename: thisFilename,
        sectionItems: items,
        totalCount: items.length,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getThisYearSectionData', `- found ${itemCount} yearly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getThisYearSectionData', `ERROR: ${error.message}`)
    return []
  }
}
