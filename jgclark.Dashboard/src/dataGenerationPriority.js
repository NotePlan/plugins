// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-11-18 for v2.3.0.b14, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TDashboardSettings, TParagraphForDashboard, TSection, TSectionItem } from './types'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import {
  createSectionItemObject,
  filterParasByCalendarHeadingSections,
  filterParasByIgnoreTerms,
  filterParasByRelevantFolders,
  getNotePlanSettings,
  makeDashboardParas,
} from './dashboardHelpers'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getRegularNotesFromFilteredFolders } from '@helpers/folders'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { pastCalendarNotes } from '@helpers/note'
import { getNumericPriorityFromPara, sortListBy } from '@helpers/sorting'
import { isOpenNotScheduled, removeDuplicates } from '@helpers/utils'

// ----------------------------------------------------------

/**
 * Generate data for a section of raised Priority tasks
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getPrioritySectionData(config: TDashboardSettings, useDemoData: boolean = false): Promise<TSection> {
  try {
    const sectionNumStr = '14'
    const thisSectionCode = 'PRIORITY'
    let totalPriority = 0
    let itemCount = 0
    let priorityParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
    let dashboardParas: Array<TParagraphForDashboard> = []
    const maxInSection = config.maxItemsToShowInSection
    const NPSettings = getNotePlanSettings()
    const thisStartTime = new Date()

    logInfo('getPrioritySectionData', `------- Gathering Priority Tasks for section #${String(sectionNumStr)} -------`)
    if (useDemoData) {
      // Note: to make the same processing as the real data (later), this is done only in terms of extended paras
      for (let c = 0; c < 30; c++) {
        // const thisID = `${sectionNumStr}-${String(c)}`
        const thisType = c % 3 === 0 ? 'checklist' : 'open'
        const priorityPrefix = c % 30 === 0 ? '>> ' : c % 21 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : '! '
        const fakeDateMom = new moment('2023-10-01').add(c, 'days')
        const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
        const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
        const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${NPSettings.defaultFileExtension}` : `fake_note_${String(c % 7)}.${NPSettings.defaultFileExtension}`
        const type = c % 3 < 2 ? 'Calendar' : 'Notes'
        const content = `${priorityPrefix}test priority item ${String(c + 1)} >${fakeIsoDateStr}`
        priorityParas.push({
          filename: filename,
          content: content,
          rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
          type: thisType,
          note: {
            filename: filename,
            title: `Priority Test Note ${(c % 10) + 1}`,
            type: type,
            changedDate: fakeDateMom.toDate(),
          },
        })
      }
    } else {
      // Get priority tasks
      // Note: Cannot move the reduce into here otherwise scheduleAllPriorityOpenToToday() doesn't have all it needs to work
      priorityParas = await getRelevantPriorityTasks(config)
      logDebug('getPrioritySectionData', `- found ${priorityParas.length} priority paras in ${timer(thisStartTime)}`)
    }

    const items: Array<TSectionItem> = []

    if (priorityParas.length > 0) {
      // Create a much cut-down version of this array that just leaves a few key fields, plus filename, priority
      // Note: this takes ~600ms for 1,000 items
      dashboardParas = makeDashboardParas(priorityParas)
      logDebug('getPrioritySectionData', `- after reducing paras -> ${dashboardParas.length} in ${timer(thisStartTime)}`)

      // TODO(later): Remove possible dupes from sync'd lines
      // priorityParas = eliminateDuplicateParagraphs(priorityParas)
      // logTimer('getPrioritySectionData', thisStartTime, `- after sync lines dedupe -> ${priorityParas.length}`)

      totalPriority = dashboardParas.length

      // Sort paragraphs by priority
      const sortOrder = ['-priority', '-changedDate']
      const sortedPriorityTaskParas = sortListBy(dashboardParas, sortOrder)
      logTimer('getPrioritySectionData', thisStartTime, `- Sorted ${sortedPriorityTaskParas.length} items`)

      // Apply limit to set of ordered results
      // Note: Apply some limiting here, in case there are hundreds of items. There is also display filtering in the Section component via useSectionSortAndFilter.
      // Note: this doesn't attempt to calculate parentIDs. TODO: Should it?
      const priorityTaskParasLimited = totalPriority > maxInSection ? sortedPriorityTaskParas.slice(0, maxInSection) : sortedPriorityTaskParas
      logDebug('getPrioritySectionData', `- after limit, now ${priorityTaskParasLimited.length} items to show`)
      priorityTaskParasLimited.map((p) => {
        const thisID = `${sectionNumStr}-${itemCount}`
        items.push(createSectionItemObject(thisID, p))
        itemCount++
      })
    }
    logTimer('getPrioritySectionData', thisStartTime, `- finished finding priority items`)

    let sectionDescription = `{countWithLimit} open {itemType}`
    if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Priority Tasks',
      showSettingName: 'showPrioritySection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-angles-up',
      // FAIconClass: 'fa-light fa-star-exclamation',
      // no sectionTitleColorPart, so will use default
      sectionFilename: '',
      sectionItems: items,
      generatedDate: new Date(),
      totalCount: totalPriority,
      isReferenced: false,
      actionButtons: [],
    }
    logTimer('getPrioritySectionData', thisStartTime, `found ${itemCount} items for ${thisSectionCode}`, 1500)
    return section
  } catch (error) {
    logError(pluginJson, JSP(error))
    // $FlowFixMe[incompatible-return]
    return null
  }
}

// ----------------------------------------------------------

/**
 * Get all tasks marked with a priority, filtered and sorted according to various settings:
 * - includedFolders
 * - excludedFolders
 * - ignoreItemsWithTerms
 * - calendar headings
 * The number of items returned is not limited.
 * @param {TDashboardSettings} settings
 * @returns {Array<TParagraph>}
 */
async function getRelevantPriorityTasks(config: TDashboardSettings): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()

    await CommandBar.onAsyncThread()
    // Get list of folders to include or ignore
    // const includedFolders = config.includedFolders ? stringListOrArrayToArray(config.includedFolders, ',').map((folder) => folder.trim()) : []
    const excludedFolders = config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : []
    logInfo('getRelevantPriorityTasks', `excludedFolders: ${String(excludedFolders)}`)
    // Reduce list to all notes that are not blank or in @ folders or excludedFolders
    let notesToCheck = getRegularNotesFromFilteredFolders(excludedFolders, true).concat(pastCalendarNotes())
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Reduced to ${String(notesToCheck.length)} non-special regular notes + past calendar notes to check`)

    // Note: PDF and other non-notes are contained in the directories, and returned as 'notes' by `DataStore.projectNotes` (the call behind 'regularNotesFromFilteredFolders').
    // Some appear to have 'undefined' content length, but I had to find a different way to distinguish them.
    // Note: JGC has asked EM to not return other sorts of files
    // Note: this takes roughly 1ms per note for JGC.
    notesToCheck = notesToCheck.filter((n) => n.filename.match(/(.txt|.md)$/)).filter((n) => n.content && !isNaN(n.content.length) && n.content.length >= 1)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(notesToCheck.length)} non-blank MD notes to check`)

    // Now find all open items in them which have a priority marker
    const priorityParas = getAllOpenPriorityParas(notesToCheck)
    logTimer('getRelevantPriorityTasks', thisStartTime, `- Found ${String(priorityParas.length)} priorityParas`)
    await CommandBar.onMainThread()
    // Log for testing
    // for (const p of priorityParas) {
    //   console.log(`- ${displayTitle(p.note)} : ${p.content}`)
    // }

    // Filter out items in non-relevant folders
    let filteredPriorityParas = filterParasByRelevantFolders(priorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

    // Filter out anything from 'ignoreItemsWithTerms' setting
    filteredPriorityParas = filterParasByIgnoreTerms(filteredPriorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

    // Also if wanted, apply to calendar headings in this note
    filteredPriorityParas = filterParasByCalendarHeadingSections(filteredPriorityParas, config, thisStartTime, 'getRelevantPriorityTasks')

    // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
    // Note: not fully accurate, as it doesn't check the filename is identical, but this catches sync copies, which saves a lot of time
    // Note: this is a quick operation
    // $FlowFixMe[class-object-subtyping]
    filteredPriorityParas = removeDuplicates(filteredPriorityParas, ['content'])
    logTimer('getRelevantPriorityTasks', thisStartTime, `- after deduping -> ${filteredPriorityParas.length}`)

    // $FlowFixMe[class-object-subtyping]
    return filteredPriorityParas
  } catch (error) {
    logError('getRelevantPriorityTasks', error.message)
    return []
  }
}

/**
 * Get all paras with open items with Priority > 0.
 * @param {Array<TNote>} notesToCheck
 * @returns {Array<TParagraph>}
 */
function getAllOpenPriorityParas(notesToCheck: Array<TNote>): Array<TParagraph> {
  const priorityParas: Array<TParagraph> = []
  for (const note of notesToCheck) {
    const priorityParasForNote = getOpenPriorityItems(note)
    priorityParas.push(...priorityParasForNote)
  }
  return priorityParas
}

/**
 * Get all open items with Priority > 0 from the given note.
 * @param {TNote} note
 * @returns {Array<TParagraph>}
 */
function getOpenPriorityItems(note: TNote): Array<TParagraph> {
  const priorityParas: Array<TParagraph> = []
  for (const paragraph of note.paragraphs) {
    if (isOpenNotScheduled(paragraph) && getNumericPriorityFromPara(paragraph) > 0) {
      priorityParas.push(paragraph)
    }
  }
  return priorityParas
}
