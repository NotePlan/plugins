// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data for day-based notes
// Last updated 2026-08-01 for v2.4.0.b60 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TActionButton, TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem, TSettingItem } from './types'
import { getDoneCountsForToday, getNumCompletedTasksFromCalendarNote } from './countDoneTasks'
import {
  buildAddTaskChecklistButtons,
  buildAddTaskFormFields,
  createSectionItemObject,
  createSectionItemsFromParas,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  isCurrentRemindersEnabled,
  isTBSectionEnabled,
  setTimeFieldsOnDashboardPara,
  makeDashboardParas,
} from './dashboardHelpers'
import { openTodayItems, refTodayItems, openTomorrowParas, refTomorrowParas, openYesterdayParas, refYesterdayParas } from './demoData'
import { assignReminderItemsToSection } from './reminderBuckets'
import { getTodaysDateUnhyphenated } from '@helpers/dateTime'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { findStartOfActivePartOfNote, findEndOfActivePartOfNote } from '@helpers/paragraph'
import { isActiveOrFutureTimeBlockPara } from '@helpers/timeblocks'
import { isOpen } from '@helpers/utils'

//--------------------------------------------------------------------
/**
 * Get open items from Today's note, and scheduled to Today from other notes.
 * Includes relevant Teamspace calendar notes.
 * Note: This section only includes open tasks and checklists (not titles or other timeblock-only paragraphs).
 * Dated reminders from the Reminders buckets are added into the referenced dataset (untimed today only; timed today go to TB).
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @param {Array<TSectionItem>} referencedReminderItems? - untimed today's reminders (starting point for referenced items)
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getTodaySectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  referencedReminderItems: Array<TSectionItem> = [],
): Array<TSection> {
  try {
    const thisSectionCode = 'DT'
    const sections: Array<TSection> = []
    let items: Array<TSectionItem> = []
    let itemCount = 0
    const todayDateLocale = toNPLocaleDateString(new Date(), 'short') // uses moment's locale info from NP
    logDebug('getTodaySectionData', `--------- Gathering Today's ${useDemoData ? 'DEMO' : ''} items for section ${thisSectionCode} --------`)
    const startTime = new Date() // for timing only

    const NPSettings = getNotePlanSettings()
    const thisFilename = `${getTodaysDateUnhyphenated()}.${NPSettings.defaultFileExtension}`
    const filenameDateStr: string = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
    const currentDailyNote: ?TNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅ reliable
    let sortedOrCombinedParas: Array<TParagraphForDashboard> = []
    let sortedRefParas: Array<TParagraphForDashboard> = []

    if (!useDemoData && currentDailyNote) {
      // Get list of open tasks/checklists from this calendar note (without timeblock-only lines like titles)
      ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible, false)
      logDebug('getTodaySectionData', `getOpenItemParasForTimePeriod Found ${sortedOrCombinedParas.length} open items and ${sortedRefParas.length} refs to ${filenameDateStr}`)
    }

    if (useDemoData) {
      // write first or combined section items
      // Note: parentID already supplied
      const sortedItems = config.separateSectionForReferencedNotes ? openTodayItems : openTodayItems.concat(refTodayItems)
      sortedItems.map((item) => {
        // Cast: isOpen() in helpers/utils.js takes a full TParagraph (a NotePlan class instance), but only
        // reads .type. TSectionItem.para is the reduced TParagraphForDashboard, which can never satisfy it.
        // Making isOpen() accept { type: ParagraphType } is the real fix; it lives outside this plugin.
        if (isOpen((item.para: any))) {
          if (item.para) {
            setTimeFieldsOnDashboardPara(item.para)
          }
          const thisID = `${thisSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item }) // thisID is already present in demo data
        }
      })
      itemCount = items.length
    } else {
      // Get list of open tasks/checklists from current daily note (if it exists)
      if (currentDailyNote) {
        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length
      } else {
        logInfo('getTodaySectionData', `No daily note found using filename '${thisFilename}'`)
      }
    }

    // When referenced notes are combined into the main section, start referenced set with untimed today's reminders
    if (!config.separateSectionForReferencedNotes && referencedReminderItems.length > 0) {
      const assigned = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, thisSectionCode, itemCount)
      items = items.concat(assigned)
      itemCount += assigned.length
      logDebug('getTodaySectionData', `- added ${String(assigned.length)} untimed reminder(s) into combined Today section`)
    }

    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'day').toDate(), 'day')
    // Omit "add to tomorrow" buttons when NotePlan has no tomorrow note filename (do not ship a sentinel like '(error)')
    const nextPeriodFilename = nextPeriodNote?.filename || ''
    const doneCountData = getDoneCountsForToday()
    // clo(doneCountData, 'dataGenerationDays: doneCountData') // x zero here

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const todayHeadings: Array<string> = currentDailyNote ? getHeadingsFromNote(currentDailyNote, false, true, true, false) : []
    const tomorrowHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, false) : []
    const todayFormFields: Array<TSettingItem> = buildAddTaskFormFields(todayHeadings, config)
    const tomorrowFormFields: Array<TSettingItem> = buildAddTaskFormFields(tomorrowHeadings, config)

    let sectionDescription = `{closedOrOpenTaskCount}` // ` ` from ${todayDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    // Note: TB no longer needs to be in postActionRefresh for DT buttons; it refreshes along with DT when enabled
    const actionButtons: Array<TActionButton> = [
      ...buildAddTaskChecklistButtons({
        filename: thisFilename,
        formFields: todayFormFields,
        colorClass: 'DailyColor',
        taskTooltip: "Add a new task to today's note",
        checklistTooltip: "Add a checklist item to today's note",
        postActionRefresh: ['DT'],
      }),
    ]
    if (nextPeriodFilename) {
      actionButtons.push(
        ...buildAddTaskChecklistButtons({
          filename: nextPeriodFilename,
          formFields: tomorrowFormFields,
          colorClass: 'DailyColor',
          taskTooltip: "Add a new task to tomorrow's note",
          checklistTooltip: "Add a checklist item to tomorrow's note",
          postActionRefresh: ['DO'],
          iconVariant: 'arrow-right',
        }),
      )
    }
    actionButtons.push({
      actionName: 'moveAllTodayToTomorrow',
      actionParam: 'true' /* refresh afterwards */,
      actionPluginID: `${pluginJson['plugin.id']}`,
      display: 'All <i class="fa-regular fa-right-long"></i> Tomorrow',
      tooltip: config.rescheduleNotMove
        ? '(Re)Schedule all open items from today to tomorrow. (Press ⌘-click to move instead.)'
        : 'Move all open items from today to tomorrow. (Press ⌘-click to (re)schedule instead.)',
      postActionRefresh: ['DT', 'DO'], // Note: TB no longer needs to be specified here, as it will be refreshed along with DT (if enabled)
    })

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Today',
      showSettingName: 'showTodaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-star',
      sectionTitleColorPart: 'DailySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(), // Note: this often gets stringified to a string, but isn't underneath
      doneCounts: doneCountData,
      totalCount: items.length,
      isReferenced: false,
      actionButtons: actionButtons,
    }
    // clo(section, 'dataGenerationDays: content')
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      // Referenced items start with untimed today's reminders, then scheduled note refs
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (referencedReminderItems.length > 0) {
        items = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, referencedSectionCode, 0)
        itemCount = items.length
        logDebug('getTodaySectionData', `- started >Today with ${String(items.length)} untimed reminder(s)`)
      }
      if (useDemoData) {
        const sortedRefParas = refTodayItems
        // Note: parentID already supplied
        sortedRefParas.map((item) => {
          if (item.para) {
            setTimeFieldsOnDashboardPara(item.para)
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        if (sortedRefParas.length > 0) {
          const refFromNotes = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          // Re-ID note refs to continue after reminder starters
          const rebased = refFromNotes.map((item, i) => ({
            ...item,
            ID: `${referencedSectionCode}-${itemCount + i}`,
          }))
          items = items.concat(rebased)
          itemCount += rebased.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Today',
        showSettingName: 'showTodaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${todayDateLocale}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-star',
        sectionTitleColorPart: 'DailySectionColor',
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
 * Includes valid timeblocks in paragraphs of type 'title', 'open', 'list', and 'checklist' when Time Block is enabled.
 * Also includes today's timed reminders whose due time has been reached (when Reminders is enabled).
 * Section is generated when either Time Block or Reminders is enabled (or both).
 * Note: This is completely separate from getTodaySectionData() and fetches its own data.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} _useEditorWherePossible? (currently not used)
 * @param {Array<TSectionItem>} timedTodayReminderItems? - today's reminders that have a time
 * @returns {Array<TSection>} 1 section (TB) or empty array
 */
export function getTimeBlockSectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  _useEditorWherePossible: boolean,
  timedTodayReminderItems: Array<TSectionItem> = [],
): Array<TSection> {
  try {
    // Show TB when Time Block and/or Reminders is enabled (timed reminders live here)
    if (!isTBSectionEnabled(config)) {
      return []
    }

    const TBsectionCode = 'TB'
    const sections: Array<TSection> = []
    const NPSettings = getNotePlanSettings()
    logDebug('getTimeBlockSectionData', `--------- Gathering Timeblock ${useDemoData ? 'DEMO ' : ''}items for section ${TBsectionCode} --------`)
    const startTime = new Date() // for timing only

    const thisFilename = `${getTodaysDateUnhyphenated()}.${NPSettings.defaultFileExtension}`
    const filenameDateStr: string = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
    const currentDailyNote: ?TNote = DataStore.calendarNoteByDateString(filenameDateStr) // ✅ reliable
    let timeBlockItems: Array<TSectionItem> = []
    const mustContainString = NPSettings.timeblockMustContainString
    let itemCounter = 0
    // Missing showCurrentReminders means ON (default); only an explicit false disables Current Reminders.
    const remindersSectionEnabled = isCurrentRemindersEnabled(config)
    const timeBlockSectionEnabled = Boolean(config.showTimeBlockSection)

    // const combinedParas = sortedOrCombinedParas.concat(sortedRefParas)

    // NotePlan timeblocks only when the Time Block setting is on
    if (timeBlockSectionEnabled) {
      if (useDemoData) {
        // For demo data, filter demo items that have timeblocks
        // Includes valid timeblocks in paragraphs of type 'title', 'open', 'list', and 'checklist'
        const allDemoItems = openTodayItems.concat(refTodayItems)
        for (const item of allDemoItems) {
          // Cast: isActiveOrFutureTimeBlockPara() in helpers/timeblocks.js takes a full TParagraph (a
          // NotePlan class instance) but only reads .content/.type. TSectionItem.para is the reduced
          // TParagraphForDashboard, which can never satisfy it. Widening that helper is the real fix.
          if (item.para && isActiveOrFutureTimeBlockPara((item.para: any), mustContainString)) {
            const thisID = `${TBsectionCode}-${itemCounter}`
            // Cast: the `item.para &&` guard above is invalidated by the call in the same condition.
            const para: TParagraphForDashboard = (item.para: any)
            const paraType = para.type
            logDebug('getTimeBlockSectionData', `+ TB ${thisID}: {${para?.content ?? '(error)'} (type: ${paraType}) from ${para?.filename ?? '(error)'}`)
            // For title paragraphs with timeblocks, set itemType to 'timeblock' for consistent display
            const itemType = paraType === 'title' ? 'timeblock' : undefined
            const thisSectionItemObject = createSectionItemObject(thisID, 'TB', (item.para: any), itemType)
            timeBlockItems.push(thisSectionItemObject)
            itemCounter++
          }
        }
      } else if (currentDailyNote) {
        // Now iterate through the combined paras, and make a sectionItem for each that includes a time block
        // Includes valid timeblocks in paragraphs of type 'title', 'open', 'list', and 'checklist'
        // (isActiveOrFutureTimeBlockPara checks TIMEBLOCK_ACTIVE_PARA_TYPES which includes these type )
        const startOfActive = findStartOfActivePartOfNote(currentDailyNote)
        const endOfActive = findEndOfActivePartOfNote(currentDailyNote)
        const allParasInActivePartOfTodaysNote = currentDailyNote.paragraphs.slice(startOfActive, endOfActive)
        const currentTimeblockParas = allParasInActivePartOfTodaysNote.filter((p) => isActiveOrFutureTimeBlockPara(p, mustContainString))
        timeBlockItems = createSectionItemsFromParas(makeDashboardParas(currentTimeblockParas), TBsectionCode)
        itemCounter += timeBlockItems.length
      }
    }

    // NotePlan timeblocks collected above; remember count before appending reminders
    const noteTimeBlockCount = timeBlockItems.length
    let dueNowReminderCount = 0

    // Append today's timed reminders already filtered/placed by reminderPlacement.js (hide-until-due applied there).
    if (remindersSectionEnabled && timedTodayReminderItems.length > 0) {
      dueNowReminderCount = timedTodayReminderItems.length
      const assigned = assignReminderItemsToSection(timedTodayReminderItems, TBsectionCode, TBsectionCode, itemCounter)
      timeBlockItems = timeBlockItems.concat(assigned)
      itemCounter += assigned.length
      logDebug('getTimeBlockSectionData', `- added ${String(assigned.length)} timed reminder(s) into TB`)
    }

    // Set Title: 
    // - "Time Blocks" (reminders off);
    // - "Timed Reminders" (reminders only / no timeblocks);
    // - "Timed Items" (mixed or timeblocks-with-reminders-on)
    let sectionName = 'Time Blocks'
    if (!timeBlockSectionEnabled && remindersSectionEnabled) {
      sectionName = 'Timed Reminders'
    } else if (remindersSectionEnabled) {
      sectionName = noteTimeBlockCount === 0 && dueNowReminderCount > 0 ? 'Timed Reminders' : 'Timed Items'
    }

    const section: TSection = {
      ID: TBsectionCode,
      sectionCode: 'TB',
      name: sectionName,
      showSettingName: 'showTimeBlockSection',
      description: '',
      FAIconClass: 'fa-regular fa-fw fa-clock',
      sectionTitleColorPart: 'TimeBlockSectionColor',
      sectionFilename: thisFilename,
      sectionItems: timeBlockItems,
      generatedDate: new Date(),
      isReferenced: false,
      actionButtons: [],
    }
    logTimer('getTimeBlockSectionData', startTime, `- found ${String(timeBlockItems.length)} timeblock items from ${filenameDateStr}, 100`)
    sections.push(section)

    return sections
  } catch (error) {
    logError(`getTimeBlockSectionData`, error.message)
    return []
  }
}

/**
 * Fetch open items from yesterday's daily note and items scheduled to yesterday.
 * Shared by the orchestrator (`getSomeSectionsData`) so DY and OVERDUE can share one fetch and route consistently:
 * - DY on -> Yesterday section
 * - DY off + OVERDUE on -> spill into Overdue (open calendar items are not in listOverdueTasks)
 * - DY on + OVERDUE on -> pass flat list to overdue generator for content dedupe
 * @param {TDashboardSettings} config
 * @param {boolean} useEditorWherePossible?
 * @returns {[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>]} calendar (or combined) paras, referenced paras
 */
export function getYesterdayOpenItemParas(
  config: TDashboardSettings,
  useEditorWherePossible: boolean = false,
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  const filenameDateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
  return getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible)
}

/**
 * Flatten yesterday calendar + referenced paras into one list for OVERDUE spill / dedupe.
 * When separateSectionForReferencedNotes is off, sortedRefParas is already empty (combined into first array).
 * @param {Array<TParagraphForDashboard>} sortedOrCombinedParas
 * @param {Array<TParagraphForDashboard>} sortedRefParas
 * @returns {Array<TParagraphForDashboard>}
 */
export function flattenYesterdayOpenItemParas(
  sortedOrCombinedParas: Array<TParagraphForDashboard>,
  sortedRefParas: Array<TParagraphForDashboard>,
): Array<TParagraphForDashboard> {
  return sortedOrCombinedParas.concat(sortedRefParas)
}

/**
 * Get open items from Yesterday's note, and scheduled to Yesterday from other notes.
 * Includes relevant Teamspace calendar notes.
 * Dated reminders from the Reminders yesterday bucket are added into the referenced dataset.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @param {Array<TSectionItem>} referencedReminderItems? - yesterday's reminders (starting point for referenced items)
 * @param {?[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>]} prefetchedOpenAndRefParas? - from orchestrator shared fetch; skips a second getOpenItemParasForTimePeriod
 * @returns {Array<TSection>} 1 or 2 section(s)
 */
export function getYesterdaySectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  referencedReminderItems: Array<TSectionItem> = [],
  prefetchedOpenAndRefParas: ?[Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] = null,
): Array<TSection> {
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
    logDebug('getYesterdaySectionData', `--------- Gathering Yesterday's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} from ${filenameDateStr} ----------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write one or combined section items
      const sortedItems = config.separateSectionForReferencedNotes ? openYesterdayParas : openYesterdayParas.concat(refYesterdayParas)
      sortedItems.map((item) => {
        if (item.para) {
          setTimeFieldsOnDashboardPara(item.para)
        }
        const thisID = `${thisSectionCode}-${itemCount}`
        items.push({ ID: thisID, ...item })
        // itemCount++
      })
      itemCount = items.length
    } else {
      // Prefer orchestrator-prefetched paras (shared with OVERDUE spill/dedupe) to avoid a second vault scan
      if (prefetchedOpenAndRefParas) {
        ;[sortedOrCombinedParas, sortedRefParas] = prefetchedOpenAndRefParas
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length
      } else if (yesterdaysNote) {
        // Get list of open tasks/checklists from this calendar note
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(filenameDateStr, 'day', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        // Now get reminders as well as tasks/checklists
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logTimer('getYesterdaySectionData', startTime, `- finished finding yesterday's items from ${filenameDateStr}`)
      } else {
        logInfo('getYesterdaySectionData', `No yesterday note found using filename '${thisFilename}'`)
      }
    }

    // When referenced notes are combined into the main section, start referenced set with yesterday's reminders
    if (!config.separateSectionForReferencedNotes && referencedReminderItems.length > 0) {
      const assigned = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, thisSectionCode, itemCount)
      items = items.concat(assigned)
      itemCount += assigned.length
      logDebug('getYesterdaySectionData', `- added ${String(assigned.length)} reminder(s) into combined Yesterday section`)
    }
    // Completions in yesterday's note with @done(yesterday) (period range for that daily note)
    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)
    let sectionDescription = `{closedOrOpenTaskCount}` // ` ` from ${yesterdayDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Yesterday',
      showSettingName: 'showYesterdaySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-arrow-up',
      sectionTitleColorPart: 'DailySectionColor',
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
          display: 'All <i class="fa-regular fa-right-long"></i> Today',
          actionParam: 'true' /* refresh afterwards */,
          postActionRefresh: ['DT', 'DY'], // refresh 2 sections afterwards
        },
      ],
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      // Referenced items start with yesterday's reminders, then scheduled note refs
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (referencedReminderItems.length > 0) {
        items = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, referencedSectionCode, 0)
        itemCount = items.length
        logDebug('getYesterdaySectionData', `- started >Yesterday with ${String(items.length)} reminder(s)`)
      }
      if (useDemoData) {
        const sortedRefParas = refYesterdayParas
        sortedRefParas.map((item) => {
          if (item.para) {
            setTimeFieldsOnDashboardPara(item.para)
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          const refFromNotes = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          const rebased = refFromNotes.map((item, i) => ({
            ...item,
            ID: `${referencedSectionCode}-${itemCount + i}`,
          }))
          items = items.concat(rebased)
          itemCount += rebased.length
        }
      }

      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Yesterday',
        showSettingName: 'showYesterdaySection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${yesterdayDateLocale}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-star',
        sectionTitleColorPart: 'DailySectionColor',
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
 * Dated reminders from the Reminders tomorrow bucket are added into the referenced dataset.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @param {Array<TSectionItem>} referencedReminderItems? - tomorrow's reminders (starting point for referenced items)
 * @returns {TSection} data
 */
export function getTomorrowSectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  referencedReminderItems: Array<TSectionItem> = [],
): Array<TSection> {
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
    logDebug('getTomorrowSectionData', `---------- Gathering Tomorrow's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // write one or combined section items
      const sortedParas = config.separateSectionForReferencedNotes ? openTomorrowParas : openTomorrowParas.concat(refTomorrowParas)
      sortedParas.map((item) => {
        if (item.para) {
          setTimeFieldsOnDashboardPara(item.para)
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
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logTimer('getTomorrowSectionData', startTime, `- finished finding tomorrow's items from ${filenameDateStr}`)
      } else {
        logDebug('getTomorrowSectionData', `No tomorrow note found for filename '${thisFilename}'`)
      }
    }

    // When referenced notes are combined into the main section, start referenced set with tomorrow's reminders
    if (!config.separateSectionForReferencedNotes && referencedReminderItems.length > 0) {
      const assigned = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, thisSectionCode, itemCount)
      items = items.concat(assigned)
      itemCount += assigned.length
      logDebug('getTomorrowSectionData', `- added ${String(assigned.length)} reminder(s) into combined Tomorrow section`)
    }

    // Set up formFields for the 'add buttons' (applied in Section.jsx)
    const tomorrowHeadings: Array<string> = tomorrowsNote ? getHeadingsFromNote(tomorrowsNote, false, true, true, false) : []
    const tomorrowFormFields: Array<TSettingItem> = buildAddTaskFormFields(tomorrowHeadings, config)

    let sectionDescription = `{count}` // ` ` from ${tomorrowDateLocale}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Tomorrow',
      showSettingName: 'showTomorrowSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-arrow-down',
      sectionTitleColorPart: 'DailySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: items.length,
      isReferenced: false,
      actionButtons: buildAddTaskChecklistButtons({
        filename: thisFilename,
        formFields: tomorrowFormFields,
        colorClass: 'DailyColor',
        taskTooltip: "Add a new task to tomorrow's note",
        checklistTooltip: "Add a checklist item to tomorrow's note",
        postActionRefresh: ['DO'],
        iconVariant: 'arrow-right',
      }),
    }
    sections.push(section)

    // If we want this separated from the referenced items, then form a second section
    if (config.separateSectionForReferencedNotes) {
      // Referenced items start with tomorrow's reminders, then scheduled note refs
      let items: Array<TSectionItem> = []
      const referencedSectionCode = `${thisSectionCode}_REF`
      if (referencedReminderItems.length > 0) {
        items = assignReminderItemsToSection(referencedReminderItems, thisSectionCode, referencedSectionCode, 0)
        itemCount = items.length
        logDebug('getTomorrowSectionData', `- started >Tomorrow with ${String(items.length)} reminder(s)`)
      }
      if (useDemoData) {
        const sortedRefParas = refTomorrowParas
        sortedRefParas.map((item) => {
          if (item.para) {
            setTimeFieldsOnDashboardPara(item.para)
          }
          const thisID = `${referencedSectionCode}-${itemCount}`
          items.push({ ID: thisID, ...item })
          itemCount++
        })
      } else {
        // Get list of open tasks/checklists from current daily note (if it exists)
        if (sortedRefParas.length > 0) {
          const refFromNotes = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
          const rebased = refFromNotes.map((item, i) => ({
            ...item,
            ID: `${referencedSectionCode}-${itemCount + i}`,
          }))
          items = items.concat(rebased)
          itemCount += rebased.length
        }
      }
      // Add separate section (if there are any items found)
      const section: TSection = {
        ID: referencedSectionCode,
        name: '>Tomorrow',
        showSettingName: 'showTomorrowSection',
        sectionCode: thisSectionCode,
        description: `{count} scheduled to ${tomorrowDateLocale}`,
        FAIconClass: 'fa-regular fa-fw fa-calendar-arrow-down',
        sectionTitleColorPart: 'DailySectionColor',
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
