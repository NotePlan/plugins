// @flow
//-----------------------------------------------------------------------------
// Generate data for OVERDUE Section
// Last updated 2025-07-06 for v2.3.0.b4
//-----------------------------------------------------------------------------

import moment from 'moment'
import pluginJson from '../plugin.json'
import { createSectionItemObject, isLineDisallowedByExcludedTerms, getDueDateOrStartOfCalendarDate, getNotePlanSettings, makeDashboardParas } from './dashboardHelpers'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, timer } from '@helpers/dev'
import { filterOutParasInExcludeFolders } from '@helpers/note'
import { removeDuplicates } from '@helpers/utils'
import { sortListBy } from '@helpers/sorting'

// ----------------------------------------------------------
/**
 * Generate data for a section for Overdue tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getOverdueSectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNumStr = '13'
    const thisSectionCode = 'OVERDUE'
    let totalOverdue = 0
    let itemCount = 0
    let overdueParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getOverdueSectionData', `------- Gathering Overdue Tasks for section #${String(sectionNumStr)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 60; c++) {
        // const thisID = `${sectionNumStr}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 20 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : c % 5 === 0 ? '! ' : ''
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test overdue item ${c} >${fakeIsoDateStr}`
        overdueParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Overdue Test Note ${c % 10}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get overdue tasks (de-duping any sync'd lines)
      // Note: Cannot move the reduce into here otherwise separate call to this function by scheduleAllOverdueOpenToToday() doesn't have all it needs to work
      overdueParas = await getRelevantOverdueTasks(config, [])
      logDebug('getOverdueSectionData', `- found ${overdueParas.length} overdue paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (overdueParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(overdueParas)
      logDebug('getOverdueSectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      totalOverdue = dashboardParas.length

      // Sort paragraphs by one of several options
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

      // Apply limit to set of ordered results
      // Note: Apply some limiting here, in case there are hundreds of items. There is also display filtering in the Section component via useSectionSortAndFilter.
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const overdueTaskParasLimited = totalOverdue > maxInSection
        ? sortedOverdueTaskParas.slice(0, maxInSection)
        : sortedOverdueTaskParas
      logInfo('getOverdueSectionData', `- after limit, now ${overdueTaskParasLimited.length} of ${totalOverdue} items will be passed to React`)
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push(createSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logDebug('getOverdueSectionData', `- finished finding overdue items after ${timer(thisStartTime)}`)

    let sectionDescription = `{countWithLimit} open {itemType} ${config.lookBackDaysForOverdue > 0
      ? `from last ${String(config.lookBackDaysForOverdue)} days `
      : ''}ordered by ${config.overdueSortOrder}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Overdue Tasks',
      showSettingName: 'showOverdueSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-alarm-exclamation',
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
          display: 'All Overdue <i class="fa-solid fa-right-long"></i> Today',
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
    // $FlowFixMe[incompatible-return]
    return null
  }
}

/**
 * Get all overdue tasks, filtered and sorted according to various settings:
 * - excludedFolders
 * - ignoreItemsWithTerms
 * - lookBackDaysForOverdue
 * The results are deduped.
 * The number of items returned is not limited.
 * If we are showing the Yesterday section, and we have some yesterdaysParas passed, then don't return any ones matching this list.
 * @param {TDashboardSettings} dashboardSettings
 * @param {Array<TParagraph>} yesterdaysParas
 * @returns {Array<TParagraph>}
 */
export async function getRelevantOverdueTasks(dashboardSettings: TDashboardSettings, yesterdaysParas: Array<TParagraph>): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()
    const overdueParas: $ReadOnlyArray<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
    logTimer('getRelevantOverdueTasks', thisStartTime, `Found ${overdueParas.length} overdue items`)

    // Remove items referenced from items in 'excludedFolders' (but keep calendar note matches)
    const excludedFolders = dashboardSettings.excludedFolders ? stringListOrArrayToArray(dashboardSettings.excludedFolders, ',').map((folder) => folder.trim()) : []
    // $FlowIgnore(incompatible-call) returns $ReadOnlyArray type
    let filteredOverdueParas: Array<TParagraph> = filterOutParasInExcludeFolders(overdueParas, excludedFolders, true)
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after 'excludedFolders'(${String(excludedFolders)}) filter: ${filteredOverdueParas.length} paras`)

    // Filter out anything from 'ignoreItemsWithTerms' setting
    if (dashboardSettings.ignoreItemsWithTerms) {
      filteredOverdueParas = filteredOverdueParas.filter((p) => !isLineDisallowedByExcludedTerms(p.content, dashboardSettings.ignoreItemsWithTerms))
    } else {
      logDebug(
        'getRelevantOverdueTasks...',
        `ignoreItemsWithTerms not set; dashboardSettings (${Object.keys(dashboardSettings).length} keys)=${JSON.stringify(dashboardSettings, null, 2)}`
      )
    }
    logTimer(
      'getRelevantOverdueTasks', thisStartTime,
      `- after ignoreItemsWithTerms (${dashboardSettings.ignoreItemsWithTerms}) filter: ${filteredOverdueParas.length} paras`
    )

    // Limit overdues to last N days
    if (!Number.isNaN(dashboardSettings.lookBackDaysForOverdue) && dashboardSettings.lookBackDaysForOverdue > 0) {
      const numDaysToLookBack = dashboardSettings.lookBackDaysForOverdue
      const cutoffDate = moment().subtract(numDaysToLookBack, 'days').format('YYYY-MM-DD')
      logDebug('getRelevantOverdueTasks', `lookBackDaysForOverdue limiting to last ${String(numDaysToLookBack)} days (from ${cutoffDate})`)
      filteredOverdueParas = filteredOverdueParas.filter((p) => getDueDateOrStartOfCalendarDate(p, true) > cutoffDate)
    }

    // Remove items that appear in this section twice (which can happen if a task is sync'd), based just on their content
    // Note: this is a quick operation
    // $FlowFixMe[class-object-subtyping]
    filteredOverdueParas = removeDuplicates(filteredOverdueParas, ['content'])
    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping -> ${filteredOverdueParas.length}`)

    // Remove items already in Yesterday section (if turned on)
    if (dashboardSettings.showYesterdaySection) {
      if (yesterdaysParas.length > 0) {
        // Filter out all items in array filteredOverdueParas that also appear in array yesterdaysParas
        filteredOverdueParas.map((p) => {
          if (yesterdaysParas.filter((y) => y.content === p.content).length > 0) {
            logDebug('getRelevantOverdueTasks', `- removing duplicate item {${p.content}} from overdue list`)
            filteredOverdueParas.splice(filteredOverdueParas.indexOf(p), 1)
          }
        })
      }
    }

    logTimer('getRelevantOverdueTasks', thisStartTime, `- after deduping with yesterday -> ${filteredOverdueParas.length}`)
    // $FlowFixMe[class-object-subtyping]
    return filteredOverdueParas
  } catch (error) {
    logError('getRelevantOverdueTasks', error.message)
    return []
  }
}
