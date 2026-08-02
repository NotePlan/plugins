// @flow
//-----------------------------------------------------------------------------
// Generate data for OVERDUE Section
// Last updated 2026-08-01 for v2.4.0.b60, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { createSectionItemObject, filterParasByRelevantFolders, filterParasByIgnoreTerms, filterParasByIncludedCalendarSections, filterParasByExcludedCalendarSections, filterParasByAllowedTeamspaces, makeDashboardParas, getNotePlanSettings } from './dashboardHelpers'
import { assignReminderItemsToSection } from './reminderBuckets'
import { openYesterdayParas, refYesterdayParas } from './demoData'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem } from './types'
import { clo, clof, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getDueDateOrStartOfCalendarDate } from '@helpers/NPdateTime'
import { sortListBy } from '@helpers/sorting'
import { removeDuplicates } from '@helpers/utils'

// ----------------------------------------------------------
/**
 * Generate data for a section for Overdue tasks (and optionally overdue/past reminders).
 *
 * Yesterday task routing is owned by the orchestrator (`getSomeSectionsData`):
 * - When Yesterday is off, it passes open yesterday calendar/ref tasks as `yesterdaySpillDashboardParas`
 *   (those undated open items are not returned by DataStore.listOverdueTasks).
 * - When Yesterday is on, it passes the same flat list as `yesterdaysParasForDedupe` so this section
 *   drops content that already appears in DY. React Hide Duplicates (DY before OVERDUE) remains a display safety net.
 *
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 * @param {Array<TSectionItem>} overdueReminderItems? - past-dated (and yesterday-fallback) reminders to append
 * @param {Array<TParagraphForDashboard>} yesterdaySpillDashboardParas? - DY-off spill of yesterday open tasks
 * @param {$ReadOnlyArray<{ content: string, ... }>} yesterdaysParasForDedupe? - DY-on list used to strip DY duplicates from overdue (only `content` is read)
 */
export async function getOverdueSectionData(
  config: TDashboardSettings,
  useDemoData: boolean = false,
  overdueReminderItems: Array<TSectionItem> = [],
  yesterdaySpillDashboardParas: Array<TParagraphForDashboard> = [],
  yesterdaysParasForDedupe: $ReadOnlyArray<{ content: string, ... }> = [],
): Promise<TSection> {
  try {
    const thisSectionCode = 'OVERDUE'
    let totalOverdue = 0
    let preLimitCount = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getOverdueSectionData', `------- Gathering Overdue Tasks for section ${thisSectionCode} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      // Add a lot of 'overdue' items (to test the limiting)
      for (let c = 0; c < 13; c++) {
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 12 === 0 ? '!! ' : c % 11 === 0 ? '! ' : ''
        const fakeDateMom = new moment('2025-01-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${String(c + 1)} >${fakeIsoDateStr}`
        overdueParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Overdue Test Note ${(c % 10) + 1}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
            isTeamspace: false,
          },
        })
      }

      // Demo spill: only add yesterday demo items when Yesterday section would be off (mirrors live routing)
      if (!config.showYesterdaySection) {
        const yesterdayItems = openYesterdayParas.concat(refYesterdayParas)
        yesterdayItems.forEach((item) => {
          const thisExtendedPara = {
            ...item.para,
            note: {
              filename: item.para?.filename ?? 'test_filename.md',
              title: item.para?.title ?? undefined,
              type: item.para?.noteType ?? 'Notes',
              changedDate: item.para?.changedDate ?? new Date('2023-07-06T00:00:00.000Z'),
              isTeamspace: false,
            },
          }
          overdueParas.push(thisExtendedPara)
        })
        clo(yesterdayItems, 'yesterdaySpillDemoItems')
      }
      preLimitCount = overdueParas.length
      dashboardParas = overdueParas
    } else {
      // Get overdue tasks (de-duping any sync'd lines)
      // Note: Cannot move the reduce into here otherwise separate call to this function by scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      const { filteredOverdueParas, preLimitOverdueCount } = await getRelevantOverdueTasks(config, yesterdaysParasForDedupe)
      overdueParas = filteredOverdueParas
      preLimitCount = preLimitOverdueCount
      logDebug('getOverdueSectionData', `- found ${overdueParas.length} overdue paras in ${timer(thisStartTime)}`)

      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)

      // Merge DY-off spill of yesterday open tasks (calendar + refs). listOverdueTasks does not return
      // undated open items sitting in yesterday's note, so without this they would vanish when DY is off.
      if (yesterdaySpillDashboardParas.length > 0) {
        const beforeMerge = dashboardParas.length
        // Cast: removeDuplicates() is typed over a generic indexed object, so its result no longer
        // carries the exact TParagraphForDashboard shape even though the elements are unchanged.
        dashboardParas = (removeDuplicates(dashboardParas.concat(yesterdaySpillDashboardParas), ['filename', 'content']): any)
        logDebug(
          'getOverdueSectionData',
          `- merged ${String(yesterdaySpillDashboardParas.length)} yesterday-spill task(s); ${String(beforeMerge)} -> ${String(dashboardParas.length)} after filename+content dedupe`,
        )
      }
      logDebug('getOverdueSectionData', `- after reducing/merging paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []
    // Reserve slots for overdue / yesterday-spill reminders before limiting tasks.
    // Previously tasks filled maxItemsToShowInSection first, so reminders were dropped
    // whenever there were enough tasks -- then Hide Duplicates could free rows, but the
    // reminder had already been omitted (e.g. yesterday reminder with Yesterday section off).
    const sectionLimit = maxInSection ?? 24
    const reminderSlotsToReserve = Math.min(overdueReminderItems.length, sectionLimit)
    const taskSlots = Math.max(0, sectionLimit - reminderSlotsToReserve)

    if (dashboardParas.length > 0) {
      totalOverdue = dashboardParas.length

      // Sort all overdue paragraphs by one of several options
      const sortOrder =
        config.overdueSortOrder === 'priority'
          ? ['-priority', '-changedDate']
          : config.overdueSortOrder === 'earliest'
            ? ['changedDate', '-priority']
            : config.overdueSortOrder === 'due date'
              ? ['dueDate', '-priority']
              : ['-changedDate', '-priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(dashboardParas, sortOrder)
      logDebug('getOverdueSectionData', `- Sorted ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

      // Apply limit to ordered tasks, leaving room for reserved reminder slots.
      // Note: There is also display filtering in the Section component via useSectionSortAndFilter.
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const overdueTaskParasLimited = sortedOverdueTaskParas.length > taskSlots
        ? sortedOverdueTaskParas.slice(0, taskSlots)
        : sortedOverdueTaskParas
      logInfo('getOverdueSectionData', `- after limit (${String(taskSlots)} task slots, ${String(reminderSlotsToReserve)} reserved for reminders), now ${overdueTaskParasLimited.length} of ${totalOverdue} tasks will be passed to React`)

      // Create section items from the limited set of overdue tasks
      for (const p of overdueTaskParasLimited) {
        const thisID = `${thisSectionCode}-${itemCount}`
        if (p == null || Object.keys(p).length === 0) {
          logWarn('getOverdueSectionData', `- p is null for ${thisID}. Ignoring it.`)
        } else {
          items.push(createSectionItemObject(thisID, thisSectionCode, p))
          itemCount++
        }
      }
    }
    logDebug('getOverdueSectionData', `- finished processing ${String(totalOverdue)} overdue tasks after ${timer(thisStartTime)}`)

    // Append overdue reminders into the reserved slots (and any leftover task slots)
    if (overdueReminderItems.length > 0) {
      const remainingSlots = Math.max(0, sectionLimit - items.length)
      const remindersToAdd = overdueReminderItems.slice(0, remainingSlots)
      if (remindersToAdd.length > 0) {
        const assigned = assignReminderItemsToSection(remindersToAdd, thisSectionCode, thisSectionCode, itemCount)
        items.push(...assigned)
        itemCount += assigned.length
        // Count only what was actually added. Adding the full incoming length
        // inflated the header count whenever maxItemsToShowInSection left fewer
        // slots than there were reminders, so the section claimed more items
        // than it showed and the extras were silently unreachable.
        totalOverdue += assigned.length
        logDebug('getOverdueSectionData', `- added ${String(assigned.length)} of ${String(overdueReminderItems.length)} overdue reminder(s)`)
      }
      const droppedForSlots = overdueReminderItems.length - remindersToAdd.length
      if (droppedForSlots > 0) {
        logWarn('getOverdueSectionData', `- ${String(droppedForSlots)} overdue reminder(s) did not fit in maxItemsToShowInSection=${String(sectionLimit)} and are not shown anywhere`)
      }
    }

    let sectionDescription = `{countWithLimit} open {itemType}`
    if (config.lookBackDaysForOverdue > 0) {
      sectionDescription += ` from last ${String(config.lookBackDaysForOverdue)} days`
    }
    if (dashboardParas.length > 0) sectionDescription += ` ordered by ${config.overdueSortOrder}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

    // If we have more than the limit, then we need to show the total count as an extra information message
    // (lookBackDays filter only applies to listOverdueTasks results, not yesterday spill)
    if (preLimitCount > overdueParas.length) {
      items.push({
        ID: `${thisSectionCode}-${String(overdueParas.length)}`,
        sectionCode: 'OVERDUE',
        itemType: 'preLimitOverdues',
        message: `There are also ${preLimitCount - overdueParas.length} overdue tasks older than ${String(config.lookBackDaysForOverdue)} days. Settings:`,
        settingsDialogAnchor: 'lookBackDaysForOverdue',
      })
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-fw fa-alarm-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalOverdue,
      isReferenced: false,
      actionButtons: [
        {
          actionName: 'scheduleAllOverdueToday',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Schedule all Overdue tasks to Today',
          display: 'All Overdue <i class="fa-regular fa-right-long"></i> Today',
          actionParam: '',
          postActionRefresh: ['OVERDUE'],
        },
      ],
    }
    // console.log(JSON.stringify(section))
    logTimer('getOverdueSectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1000)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // KNOWN BUG - getOverdueSectionData is declared Promise<TSection> but returns null here, and its only
    // caller (getSomeSectionsData in dataGeneration.js) does `sections.push(await getOverdueSectionData(...))`
    // with no null guard, unlike the getTaggedSectionData call a few lines above it. So an error in this
    // function puts a null into Array<TSection> and everything downstream that reads section.sectionCode
    // throws. Typing the return as Promise<?TSection> is the right declaration but needs that caller fixed
    // first, so the suppression stays until then.
    // $FlowFixMe[incompatible-return]
    return null
  }
}

/**
 * Get all overdue tasks, filtered and sorted according to various settings:
 * - includedFolders
 * - excludedFolders
 * - ignoreItemsWithTerms
 * - lookBackDaysForOverdue
 * The results are deduped.
 * The number of items returned is not limited.
 * If we are showing the Yesterday section, and we have some yesterdaysParas passed, then don't return any ones matching this list.
 * Note: scheduleAllOverdueOpenToToday intentionally passes [] so yesterday-dated overdue tasks are still moved.
 * @param {TDashboardSettings} dashboardSettings
 * @param {$ReadOnlyArray<{ content: string, ... }>} yesterdaysParas - items already shown in DY (content match); empty skips this filter. Read-only + inexact so callers can pass their own wider para arrays (arrays are invariant).
 * @returns {{ filteredOverdueParas: Array<TParagraph>, preLimitOverdueCount: number }}
 */
export async function getRelevantOverdueTasks(
  dashboardSettings: TDashboardSettings,
  yesterdaysParas: $ReadOnlyArray<{ content: string, ... }>
): Promise<{
  filteredOverdueParas: Array<TParagraph>, preLimitOverdueCount: number
}> {
  try {
    const thisStartTime = new Date()
    const overdueParas: $ReadOnlyArray<TParagraph> = await DataStore.listOverdueTasks() // note: API does not return open checklist items
    logTimer('getRelevantOverdueTasks', thisStartTime, `Found ${overdueParas.length} overdue items`)

    // Filter out items from non-allowed teamspaces
    let filteredOverdueParas = filterParasByAllowedTeamspaces(overdueParas, dashboardSettings, thisStartTime, 'getRelevantOverdueTasks')
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after filtering by allowed teamspaces, ${filteredOverdueParas.length} overdue items`)

    // Filter out items in non-valid folders
    filteredOverdueParas = filterParasByRelevantFolders(filteredOverdueParas, dashboardSettings, thisStartTime, 'getRelevantOverdueTasks')
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after filtering by valid folders, ${filteredOverdueParas.length} overdue items`)

    // Filter out anything from 'ignoreItemsWithTerms' setting
    filteredOverdueParas = filterParasByIgnoreTerms(filteredOverdueParas, dashboardSettings, thisStartTime, 'getRelevantOverdueTasks')

    // Filter out anything not matching 'includedCalendarSections' setting, if set
    filteredOverdueParas = filterParasByIncludedCalendarSections(filteredOverdueParas, dashboardSettings, thisStartTime, 'getRelevantOverdueTasks')

    // Also if wanted, apply to calendar headings in this note
    filteredOverdueParas = filterParasByExcludedCalendarSections(filteredOverdueParas, dashboardSettings, thisStartTime, 'getRelevantOverdueTasks')
    logTimer('getRelevantOverdueTasks', thisStartTime, `After filtering, ${filteredOverdueParas.length} overdue items`)

    // Remove items that appear in this section twice (which can happen if a task is sync'd), based just on their content
    // Note: this is a quick operation
    // Casts: removeDuplicates() in helpers/utils.js is typed Array<{ [string]: any }> instead of generic
    // <T>, and NotePlan's Paragraph is a class, so neither the argument nor the result can be related to
    // Array<TParagraph>. Making removeDuplicates generic is the real fix; it lives outside this plugin.
    filteredOverdueParas = (removeDuplicates((filteredOverdueParas: any), ['content']): any)
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping, ${filteredOverdueParas.length} overdue items`)

    const preLimitOverdueCount = filteredOverdueParas.length
    logDebug('getRelevantOverdueTasks', `- preLimitOverdueCount: ${preLimitOverdueCount}`)

    // Limit overdues to last N days
    if (!Number.isNaN(dashboardSettings.lookBackDaysForOverdue) && dashboardSettings.lookBackDaysForOverdue > 0) {
      const numDaysToLookBack = dashboardSettings.lookBackDaysForOverdue
      const cutoffDate = moment().subtract(numDaysToLookBack, 'days').format('YYYY-MM-DD')
      logDebug('getRelevantOverdueTasks', `lookBackDaysForOverdue limiting to last ${String(numDaysToLookBack)} days (from ${cutoffDate})`)
      filteredOverdueParas = filteredOverdueParas.filter((p) => getDueDateOrStartOfCalendarDate(p, true) > cutoffDate)
      logTimer('getRelevantOverdueTasks', thisStartTime, `After limiting, ${filteredOverdueParas.length} overdue items`)
    }

    // Remove items already in Yesterday section (if turned on and paras were supplied by the orchestrator)
    if (dashboardSettings.showYesterdaySection && yesterdaysParas.length > 0) {
      // Filter out all items in array filteredOverdueParas that also appear in array yesterdaysParas
      // V1: Cursor says this includes an array mutation bug, because of the slice()
      // filteredOverdueParas.map((p) => {
      //   if (yesterdaysParas.filter((y) => y.content === p.content).length > 0) {
      //     logDebug('getRelevantOverdueTasks', `- removing duplicate item {${p.content}} from overdue list`)
      //     filteredOverdueParas.splice(filteredOverdueParas.indexOf(p), 1)
      //   }
      // })
      // V2
      filteredOverdueParas = filteredOverdueParas.filter((p): boolean =>
        !yesterdaysParas.some((y) => y.content === p.content)
      )
    }
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping with yesterday -> ${filteredOverdueParas.length}`)

    return { filteredOverdueParas, preLimitOverdueCount }
  } catch (error) {
    logError('getRelevantOverdueTasks', error.message)
    return { filteredOverdueParas: [], preLimitOverdueCount: 0 }
  }
}
