// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2026-10-23 for v2.6.0.b1 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TActionButton, TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem } from './types'
import { getNumCompletedTasksFromCalendarNote } from './countDoneTasks'
import {
  buildAddTaskButton,
  getDefaultHeadingForNewTask,
  createSectionItemObject,
  createSectionItemsFromParas,
  filterDueMarkerSearchHits,
  getNotePlanSettings,
  getOpenItemParasForTimePeriod,
  makeDashboardParas,
} from './dashboardHelpers'
import { openWeekParas, refWeekParas } from './demoData'
import { getNPWeekStr, MOMENT_FORMAT_NP_WEEK } from '@helpers/dateTime'
import { explainThisWeekSpan, thisWeekIsInStartDueWeekSpan } from '@helpers/dueStartDates'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getHeadingsFromNote } from '@helpers/NPnote'

//-----------------------------------------------------------------

/**
 * Get open items from this Week's note, and scheduled to This Week from other notes.
 * Includes relevant Teamspace calendar notes.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {boolean} useEditorWherePossible?
 * @param {?$ReadOnlyArray<TParagraph>} prefetchedWeekMarkers? - lines already found by the shared `!>` search this refresh; null means search here
 * @param {string} prefetchedWeekMarkerTiming - duration of that shared search, shown on the section when timings are on
 * @returns {Promise<Array<TSection>>} data
 */
export async function getThisWeekSectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  useEditorWherePossible: boolean,
  prefetchedWeekMarkers: ?$ReadOnlyArray<TParagraph> = null,
  prefetchedWeekMarkerTiming: string = '',
): Promise<Array<TSection>> {
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
    logDebug('getThisWeekSectionData', `---------- Gathering Week's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} (${thisFilename}) ------------`)
    const startTime = new Date() // for timing only
    let weekWindowTiming = ''
    // Span tasks from other notes. When referenced notes are split, these go in >This Week.
    let spanRefParas: Array<TParagraphForDashboard> = []

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
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length
        // logDebug('getThisWeekSectionData', `- finished finding weekly items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getThisWeekSectionData', `No weekly note found for filename '${thisFilename}'`)
      }
    }

    // A !> week due still ahead is not overdue, and a start week that is not this week is not a >This Week reference.
    if (!useDemoData) {
      try {
        const windowResult = await loadWeekSpanParas(config, sortedOrCombinedParas.concat(sortedRefParas), prefetchedWeekMarkers, prefetchedWeekMarkerTiming)
        weekWindowTiming = windowResult.timing
        const spanDashboardParas = makeDashboardParas(windowResult.windowParas)
        if (config.separateSectionForReferencedNotes) {
          spanRefParas = spanDashboardParas
        } else {
          for (const p of spanDashboardParas) {
            const thisID = `${thisSectionCode}-${itemCount}`
            items.push(createSectionItemObject(thisID, thisSectionCode, p))
            itemCount++
          }
        }
      } catch (windowError) {
        logError('getThisWeekSectionData', `week due span lookup failed: ${windowError.message}`)
      }
    }

    const nextPeriodNote = DataStore.calendarNoteByDate(new moment().add(1, 'week').toDate(), 'week')
    // Omit "add to next week" buttons when NotePlan has no next-week note filename (do not ship a sentinel like '(error)')
    const nextPeriodFilename = nextPeriodNote?.filename || ''
    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)

    // Default heading for the header add dialog (applied when the section button opens it)
    const thisWeekHeadings: Array<string> = currentWeeklyNote ? getHeadingsFromNote(currentWeeklyNote, false, true, true, true) : []
    const nextWeekHeadings: Array<string> = nextPeriodNote ? getHeadingsFromNote(nextPeriodNote, false, true, true, true) : []
    const thisWeekDefaultHeading = getDefaultHeadingForNewTask(config, thisWeekHeadings)
    const nextWeekDefaultHeading = getDefaultHeadingForNewTask(config, nextWeekHeadings)
    let sectionDescription = `{closedOrOpenTaskCount} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) {
      sectionDescription += weekWindowTiming ? ` [${timer(startTime)}, due window ${weekWindowTiming}]` : ` [${timer(startTime)}]`
    }

    const actionButtons: Array<TActionButton> = [
      ...buildAddTaskButton({
        filename: thisFilename,
        defaultHeading: thisWeekDefaultHeading,
        colorClass: 'WeeklyColor',
        tooltip: "Add a task, checklist, or reminder to this week's note",
        postActionRefresh: ['W'],
      }),
    ]
    if (nextPeriodFilename) {
      actionButtons.push(
        ...buildAddTaskButton({
          filename: nextPeriodFilename,
          defaultHeading: nextWeekDefaultHeading,
          colorClass: 'WeeklyColor',
          tooltip: "Add a task, checklist, or reminder to next week's note",
          iconVariant: 'arrow-right',
        }),
      )
    }
    actionButtons.push({
      actionName: 'moveAllThisWeekNextWeek',
      actionPluginID: `${pluginJson['plugin.id']}`,
      tooltip: config.rescheduleNotMove
        ? '(Re)Schedule all open items from this week to next week. (Press ⌘-click to move instead.)'
        : 'Move all open items from this week to next week. (Press ⌘-click to (re)schedule instead.)',
      display: 'All <i class="fa-regular fa-right-long"></i> Next Week',
      actionParam: 'true' /* refresh afterwards */,
      postActionRefresh: ['W'], // refresh the week section afterwards
    })

    const section: TSection = {
      ID: thisSectionCode,
      name: 'This Week',
      showSettingName: 'showWeekSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-week',
      sectionTitleColorPart: 'WeeklySectionColor',
      sectionFilename: thisFilename,
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: items.length,
      doneCounts: doneCountData,
      actionButtons: actionButtons,
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
        // Get list of open tasks/checklists from current weekly note (if it exists), plus week-span tasks from other notes
        const refParas = sortedRefParas.concat(spanRefParas)
        if (refParas.length > 0) {
          items = createSectionItemsFromParas(refParas, referencedSectionCode)
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
        FAIconClass: 'fa-regular fa-fw fa-calendar-week',
        sectionTitleColorPart: 'WeeklySectionColor',
        sectionFilename: thisFilename,
        sectionItems: items,
        generatedDate: new Date(),
        actionButtons: [],
        isReferenced: true,
      }
      sections.push(section)
    }

    logDebug('getThisWeekSectionData', `- found ${itemCount} weekly items from ${dateStr} in ${timer(startTime)}`)
    return sections
  } catch (error) {
    logError('getThisWeekSectionData', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Lines that contain `!>`. Today, This Week, and Overdue share one search per refresh.
 * A leading `-` in DataStore.search means "exclude", so a query of `-W` does not find `YYYY-Wnn`.
 * @returns {Promise<Array<TParagraph>>}
 */
export async function searchBangGtParagraphs(): Promise<Array<TParagraph>> {
  const noteHits: $ReadOnlyArray<TParagraph> = await DataStore.search('!>', ['notes'], [], [], false)
  const calendarHits: $ReadOnlyArray<TParagraph> = await DataStore.searchCalendarNotes('!>', false)
  logDebug('getThisWeekSectionData', `- !> search returned ${String(noteHits.length)} note line(s) and ${String(calendarHits.length)} calendar line(s)`)
  return noteHits.concat(calendarHits)
}

/**
 * Short single-line preview for the week-span debug log.
 * @param {string} content
 * @returns {string}
 */
function weekSpanPreview(content: string): string {
  const preview = content.replace(/\s+/g, ' ').trim()
  return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview
}

/**
 * Open tasks whose start week is on or before this week and whose `!>YYYY-Wnn` due week is still this week or ahead.
 * @param {TDashboardSettings} config
 * @param {Array<TParagraphForDashboard>} alreadyShown - This Week and >This Week rows already collected
 * @param {?$ReadOnlyArray<TParagraph>} prefetchedWeekMarkers
 * @param {string} prefetchedWeekMarkerTiming
 * @returns {Promise<{ windowParas: Array<TParagraph>, timing: string }>}
 */
async function loadWeekSpanParas(
  config: TDashboardSettings,
  alreadyShown: Array<TParagraphForDashboard>,
  prefetchedWeekMarkers: ?$ReadOnlyArray<TParagraph>,
  prefetchedWeekMarkerTiming: string,
): Promise<{ windowParas: Array<TParagraph>, timing: string }> {
  const windowStart = new Date()
  const hits: $ReadOnlyArray<TParagraph> = prefetchedWeekMarkers != null ? prefetchedWeekMarkers : await searchBangGtParagraphs()
  const filtered = filterDueMarkerSearchHits(hits, config, 'getThisWeekSectionData')
  const shownContent = new Set(alreadyShown.map((p) => p.content))
  const windowParas: Array<TParagraph> = []
  for (const p of filtered) {
    const content = p.content || ''
    const shown = weekSpanPreview(content)
    const where = p.filename ?? ''
    const inSpan = thisWeekIsInStartDueWeekSpan(content)
    const already = shownContent.has(content)
    const reason = already ? `already shown in This Week; ${explainThisWeekSpan(content)}` : explainThisWeekSpan(content)
    const include = inSpan && !already
    if (include) windowParas.push(p)
    logDebug('getThisWeekSectionData', `- ${include ? 'include' : 'skip'} week span (${reason}) {${shown}} in ${where}`)
  }
  const timing = prefetchedWeekMarkerTiming || timer(windowStart)
  logInfo('getThisWeekSectionData', `week due span lookup took ${timing} and is adding ${String(windowParas.length)} task(s)`)
  return { windowParas, timing }
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
    logDebug('getLastWeekSectionData', `---------- Gathering Last Week's ${useDemoData ? 'DEMO ' : ''}items for section ${thisSectionCode} from ${thisFilename} ------------`)
    const startTime = new Date() // for timing only

    if (useDemoData) {
      // Deliberately no demo data defined
    } else {
      const lastWeeklyNote = DataStore.calendarNoteByDateString(dateStr)
      // Get list of open tasks/checklists from last week's calendar note (if it exists)
      if (lastWeeklyNote) {
        ;[sortedOrCombinedParas, sortedRefParas] = getOpenItemParasForTimePeriod(dateStr, 'week', config, useEditorWherePossible)

        // Iterate and write items for first (or combined) section
        items = createSectionItemsFromParas(sortedOrCombinedParas, thisSectionCode)
        itemCount += items.length

        // logTimer('getLastWeekSectionData', startTime, `- finished finding weekly items from ${dateStr}`)
      } else {
        logDebug('getLastWeekSectionData', `No weekly note found for filename '${thisFilename}'`)
      }
    }

    const doneCountData = getNumCompletedTasksFromCalendarNote(thisFilename)
    let sectionDescription = `{closedOrOpenTaskCount} from ${dateStr}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(startTime)}]`

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Last Week',
      showSettingName: 'showLastWeekSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-calendar-week',
      sectionTitleColorPart: 'WeeklySectionColor',
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
          display: 'All <i class="fa-regular fa-right-long"></i> This Week',
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
          items = createSectionItemsFromParas(sortedRefParas, referencedSectionCode)
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
        FAIconClass: 'fa-regular fa-fw fa-calendar-week',
        sectionTitleColorPart: 'WeeklySectionColor',
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
