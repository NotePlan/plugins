// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 23.11.2023 for v0.7.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter' // For reviewList functionality
import {
  getSettings,
  type dashboardConfigType,
  type Section, type SectionItem
} from './dashboardHelpers'
import {
  getDateStringFromCalendarFilename,
  includesScheduledFutureDate,
  toISOShortDateTimeString,
  toLocaleDateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { filterOutParasInExcludeFolders } from '@helpers/note'
import { findNotesMatchingHashtagOrMention, getReferencedParagraphs } from '@helpers/NPnote'
import {
  addPriorityToParagraphs,
  getNumericPriorityFromPara,
  getTasksByType,
  sortListBy,
  type GroupedTasks,
  type SortableParagraphSubset
} from '@helpers/sorting'
import { stripMailtoLinks, convertMarkdownLinks } from '@helpers/stringTransforms'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { isTimeBlockPara } from '@helpers/timeblocks'
import { isDone, isOpen, isScheduled, isOpenNotScheduled, isOpenTaskNotScheduled } from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

/**
 * Return list(s) of open task/checklist paragraphs from the current calendar note of type 'timePeriodName'.
 * Various config.* items are used:
 * - ignoreFolders? for folders to ignore for referenced notes
 * - separateSectionForReferencedNotes? if true, then two arrays will be returned: first from the calendar note; the second from references to that calendar note. If false, then both are included in a combined list (with the second being an empty array).
 * - ignoreTasksWithPhrase
 * - ignoreTasksScheduledToFuture
 * - excludeTasksWithTimeblocks & excludeChecklistsWithTimeblocks
 * @param {string} timePeriodName
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {dashboardConfigType} config
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
async function getOpenItemParasForCurrentTimePeriod(timePeriodName: string, timePeriodNote: TNote, config: dashboardConfigType): Promise<[Array<TParagraph>, Array<TParagraph>]> {
  try {
    let parasToUse: $ReadOnlyArray<TParagraph>

    //------------------------------------------------
    // Get paras from calendar note
    // Note: this takes 100-110ms for me
    let startTime = new Date() // for timing only
    if (Editor && (Editor?.note?.filename === timePeriodNote.filename)) {
      // If note of interest is open in editor, then use latest version available, as the DataStore is probably stale.
      logDebug('getOpenItemParasForCurrentTimePeriod', `Using EDITOR (${Editor.filename}) for the current time period: ${timePeriodName} which has ${String(Editor.paragraphs.length)} paras`)
      parasToUse = Editor.paragraphs
    } else {
      // read note from DataStore in the usual way
      logDebug('getOpenItemParasForCurrentTimePeriod', `Processing ${timePeriodNote.filename} which has ${String(timePeriodNote.paragraphs.length)} paras`)
      // parasToUse: $ReadOnlyArray<any> = timePeriodNote.paragraphs
      parasToUse = timePeriodNote.paragraphs
    }
    logInfo('getOpenItemParasForCurrentTimePeriod', `Got ${parasToUse.length} parasToUse (after ${timer(startTime)})`)

    // Run following in background thread
    // NB: Has to wait until after Editor has been accessed to start this
    // Note: Now commented out, as I found it more than doubled the time taken to run this section.
    // await CommandBar.onAsyncThread()

    // Need to filter out non-open task types for following function, and any scheduled tasks (with a >date) and any blank tasks.
    // Now also allow to ignore checklist items.
    let openParas = (config.ignoreChecklistItems)
      ? parasToUse.filter((p) => isOpenTaskNotScheduled(p) && p.content !== '')
      : parasToUse.filter((p) => isOpenNotScheduled(p) && p.content !== '')
    logInfo('getOpenItemParasForCurrentTimePeriod', `After 'isOpenNotScheduled + not blank' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out anything from 'ignoreTasksWithPhrase' setting
    if (config.ignoreTasksWithPhrase) {
      openParas = openParas.filter((p) => !p.content.includes(config.ignoreTasksWithPhrase))
    }
    // logInfo('getOpenItemParasForCurrentTimePeriod', `After 'ignore' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out tasks with timeblocks, if wanted
    if (config.excludeTasksWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'open' && isTimeBlockPara(p)))
    }
    // logInfo('getOpenItemParasForCurrentTimePeriod', `After 'exclude task timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out checklists with timeblocks, if wanted
    if (config.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isTimeBlockPara(p)))
    }
    // logInfo('getOpenItemParasForCurrentTimePeriod', `After 'exclude checklist timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Temporarily extend TParagraph with the task's priority
    openParas = addPriorityToParagraphs(openParas)
    // logInfo('getDataForDashboard', `  - finding cal items took ${timer(startTime)} for ${timePeriodName}`)

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // (This is 2-3x quicker than part above)
    // startTime = new Date() // for timing only
    let refParas = []
    if (timePeriodNote) {
      // Now also allow to ignore checklist items.
      refParas = (config.ignoreChecklistItems)
        ? getReferencedParagraphs(timePeriodNote, false).filter((p) => p.type === 'open' && p.content !== '')
        : getReferencedParagraphs(timePeriodNote, false).filter(isOpen).filter((p) => p.content !== '')
    }

    // Remove items referenced from items in 'ignoreFolders'
    refParas = filterOutParasInExcludeFolders(refParas, config.ignoreFolders)
    // Remove possible dupes from sync'd lines
    refParas = eliminateDuplicateSyncedParagraphs(refParas)
    // Temporarily extend TParagraph with the task's priority
    refParas = addPriorityToParagraphs(refParas)
    // logDebug('', `found ${String(refParas.length ?? 0)} references to ${timePeriodName}`)
    // logDebug('getDataForDashboard', `  - finding refs took ${timer(startTime)} for ${timePeriodName}`)

    // Sort the list only by priority, otherwise leaving order the same
    // Then decide whether to return two separate arrays, or one combined one
    // (This takes less than 1ms)
    if (config.separateSectionForReferencedNotes) {
      const sortedOpenParas = sortListBy(openParas, ['-priority'])
      const sortedRefParas = sortListBy(refParas, ['-priority'])
      // come back to main thread
      // await CommandBar.onMainThread()
      return [sortedOpenParas, sortedRefParas]
    } else {
      const combinedParas = sortListBy(openParas.concat(refParas), ['-priority'])
      const combinedSortedParas = sortListBy(combinedParas, ['-priority'])
      // come back to main thread
      // await CommandBar.onMainThread()
      return [combinedSortedParas, []]
    }
  } catch (err) {
    logError('getOpenItemParasForCurrentTimePeriod', err.message)
    return [[], []] // for completeness
  }
}

/**
 * Work out the data for the dashboard, ready to pass to a renderer.
 * Will instead use demo data if useDemoData is true.
 * @param {boolean} fullGenerate? If false then don't generate Overdue section
 * @returns {[Array<Section>, Array<SectionItem>]}
 */
export async function getDataForDashboard(fullGenerate: boolean = true): Promise<[Array<Section>, Array<SectionItem>]> {
  try {
    // Get settings
    const config: dashboardConfigType = await getSettings()
    logDebug('getDataForDashboard', `starting for ${fullGenerate ? 'full' : 'partial'} generation`)

    // Set up data structure to receive sections and their items
    const sections: Array<Section> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    let startTime = new Date() // for timing only

    // -------------------------------------------------------------
    startTime = new Date()
    // Get list of open tasks/checklists from current daily note (if it exists)
    let currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    if (currentDailyNote) {
      const thisFilename = currentDailyNote?.filename ?? '(error)'

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", currentDailyNote, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(combinedSortedParas, "today sortedOpenParas")
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
        sections.push({ ID: sectionCount, name: 'Today', dateType: 'DT', description: `{count} from daily note ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'Today', dateType: 'DT', description: `{count} scheduled to today`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
          sectionCount++
        }
      }
      else {
        // write one combined section
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(sortedRefParas, "sortedRefParas")
        sections.push({
          ID: sectionCount, name: 'Today', dateType: 'DT', description: `{count} from daily note or scheduled to ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename
        })
        sectionCount++
      }
      // Get count of tasks/checklists done today
      doneCount += currentDailyNote.paragraphs.filter(isDone).length

      // Note: ideally also add completed count for today from referenced notes as well

      logInfo('getDataForDashboard', `- finished finding daily items after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No daily note found for filename '${currentDailyNote?.filename ?? 'error'}'`)
    }

    // -------------------------------------------------------------
    // Get list of open tasks/checklists from yesterday's daily note (if wanted and it exists)
    if (config.showYesterdaySection) {
      const yesterday = new moment().subtract(1, 'days').toDate()
      let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day')
      if (yesterdaysNote) {
        const thisFilename = yesterdaysNote?.filename ?? '(error)'

        // Get list of open tasks/checklists from this calendar note
        const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)

        // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
        if (config.separateSectionForReferencedNotes) {
          // make a sectionItem for each item, and then make a section too.
          let itemCount = 0
          combinedSortedParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          // clo(combinedSortedParas, "yesterday sortedOpenParas")
          logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
          sections.push({ ID: sectionCount, name: 'Yesterday', dateType: 'DY', description: `{count} from daily note ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarDaily", filename: thisFilename })
          sectionCount++

          // clo(sortedRefParas, "sortedRefParas")
          if (sortedRefParas.length > 0) {
            itemCount = 0
            sortedRefParas.map((p) => {
              const thisID = `${sectionCount}-${itemCount}`
              sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
              itemCount++
            })
            sections.push({ ID: sectionCount, name: 'Yesterday', dateType: 'DY', description: `{count} scheduled to yesterday`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
            sectionCount++
          }
        }
        else {
          // write one combined section
          let itemCount = 0
          combinedSortedParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          // clo(sortedRefParas, "sortedRefParas")
          sections.push({
            ID: sectionCount, name: 'Yesterday', dateType: 'DY', description: `{count} from daily note or scheduled to ${toLocaleDateString(yesterday)}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarDaily", filename: thisFilename
          })
          sectionCount++
        }
        // Get count of tasks/checklists done today
        doneCount += yesterdaysNote.paragraphs.filter(isDone).length

        // Note: ideally also add completed count for yesterday from referenced notes as well

        logInfo('getDataForDashboard', `- finished finding yesterday's items after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No daily note found for filename '${yesterdaysNote?.filename ?? 'error'}'`)
      }
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from weekly note (if it exists)

    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (config.showWeekSection && currentWeeklyNote) {
      const thisFilename = currentWeeklyNote?.filename ?? '(error)'
      // const dateStr = thisFilename.replace('.md', '')
      const dateStr = getDateStringFromCalendarFilename(thisFilename)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("week", currentWeeklyNote, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(combinedSortedParas, "weekly sortedOpenParas")
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} weekly items`)
        sections.push({ ID: sectionCount, name: 'This week', dateType: 'W', description: `{count} from weekly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "weekly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This week', dateType: 'W', description: `{count} scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly", filename: '' })
          sectionCount++
        }
      } else {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(sortedRefParas, "weekly sortedRefParas")
        sections.push({ ID: sectionCount, name: 'This week', dateType: 'W', description: `{count} from weekly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
        sectionCount++
      }
      // Get count of tasks/checklists done this week
      doneCount += currentWeeklyNote.paragraphs.filter(isDone).length

      // Note: ideally also add completed count for today from referenced notes as well

      logInfo('getDataForDashboard', `- finished finding week items after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No weekly note found for filename '${currentWeeklyNote?.filename ?? 'error'}'`)
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from monthly note (if it exists)
    const currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    if (config.showMonthSection && currentMonthlyNote) {
      const thisFilename = currentMonthlyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("month", currentMonthlyNote, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
          itemCount++
        })
        // clo(combinedSortedParas, "monthly sortedOpenParas")
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} monthly items`)
        sections.push({ ID: sectionCount, name: 'This Month', dateType: 'M', description: `{count} from monthly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "monthly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This month', dateType: 'M', description: `{count} scheduled to this month`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarMonthly", filename: '' })
          sectionCount++
        }
      } else {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(sortedRefParas, "monthly sortedRefParas")
        sections.push({ ID: sectionCount, name: 'This month', dateType: 'M', description: `{count} from monthly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
        sectionCount++
      }

      // Get completed count too
      doneCount += currentMonthlyNote.paragraphs.filter(isDone).length

      logInfo('getDataForDashboard', `- finished finding monthly items after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No monthly note found for filename '${currentMonthlyNote?.filename ?? 'error'}'`)
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from quarterly note (if it exists)
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    if (config.showQuarterSection && currentQuarterlyNote) {
      const thisFilename = currentQuarterlyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = await getOpenItemParasForCurrentTimePeriod("quarter", currentQuarterlyNote, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(combinedSortedParas, "quarterly sortedOpenParas")
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} quarterly items`)
        sections.push({ ID: sectionCount, name: 'This quarter', dateType: 'Q', description: `{count} from quarterly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "quarterly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This quarter', dateType: 'Q', description: `{count} scheduled to this quarter`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarQuarterly", filename: '' })
          sectionCount++
        }
      } else {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(sortedRefParas, "quarterly sortedRefParas")
        sections.push({ ID: sectionCount, name: 'This quarter', dateType: 'Q', description: `{count} from quarterly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
        sectionCount++
      }
      // Get count of tasks/checklists done this quarter
      doneCount += currentQuarterlyNote.paragraphs.filter(isDone).length

      logInfo('getDataForDashboard', `- finished finding quarterly items after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No quarterly note found for filename '${currentQuarterlyNote?.filename ?? 'error'}'`)
    }

    //-----------------------------------------------------------
    // Note: If we want to do yearly in the future then the icon is fa-calendar-days (same as quarter)

    // ----------------------------------------------------------
    // Add a section for Overdue tasks, if wanted, and if not running because triggered by a change in the daily note
    if (config.showOverdueTaskSection && fullGenerate) {
      let thisStartTime = new Date()
      // $FlowFixMe(incompatible-call)
      const refParas: Array<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
      logDebug('getDataForDashboard', `Found ${refParas.length} overdue items in ${timer(thisStartTime)}`)

      // Remove items referenced from items in 'ignoreFolders'
      const filteredRefParas = filterOutParasInExcludeFolders(refParas, config.ignoreFolders)
      logDebug('getDataForDashboard', `- ${filteredRefParas.length} paras after excluding @special + [${String(config.ignoreFolders)}] folders`)
      // Remove possible dupes from sync'd lines
      // TODO: currently commented out, to save 2? secs of processing
      // const dedupedParas = eliminateDuplicateSyncedParagraphs(filteredRefParas)
      // logDebug('getDataForDashboard', `- after dedupe ->  ${dedupedParas.length}`)

      // Temporarily extend Paragraphs with the task's priority
      // $FlowFixMe(incompatible-call)
      const overdueTaskParasWithPriority = addPriorityToParagraphs(filteredRefParas)

      // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
      let reducedParas = overdueTaskParasWithPriority.map((p) => {
        const note = p.note
        const tempDate = note ? toISOShortDateTimeString(note.changedDate) : '?'
        const fieldSet = {
          filename: note?.filename ?? '<error>',
          changedDate: note?.changedDate,
          title: displayTitle(note),
          content: p.content,
          rawContent: p.rawContent,
          type: p.type,
          priority: p.priority,
        }
        return fieldSet
      })
      const totalOverdue = reducedParas.length

      // Sort paragraphs by most recently changed date on the note its in
      thisStartTime = new Date()
      const sortOrder = (config.overdueSortOrder === 'priority')
        ? ['-priority', '-changedDate']
        : (config.overdueSortOrder === 'earliest')
          ? ['changedDate', 'priority']
          : ['-changedDate', 'priority'] // 'most recent'
      const sortedOverdueTaskParas = sortListBy(reducedParas, sortOrder)
      logDebug('getDataForDashboard', `- Sorted  ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} in ${timer(thisStartTime)}`)
      // clo(sortedOverdueTaskParas, 'sortedOverdueTaskParas')

      // Apply limit to set of ordered results
      const max = config.maxOverdueTasksToShow ?? 100
      const overdueTaskParasLimited = (sortedOverdueTaskParas.length > max) ? sortedOverdueTaskParas.slice(0, max) : sortedOverdueTaskParas
      logDebug('getDataForDashboard', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
      // clo(overdueTaskParasLimited, 'overdueTaskParasLimited')
      let itemCount = 0
      overdueTaskParasLimited.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type })
        itemCount++
      })

      const overdueSectionDescription = (totalOverdue > itemCount) ? `first {count} from ${String(totalOverdue)} tasks ordered by ${config.overdueSortOrder}`
        : `all {count} tasks ordered by ${config.overdueSortOrder}`
      sections.push({ ID: sectionCount, name: 'Overdue Tasks', dateType: 'O', description: overdueSectionDescription, FAIconClass: "fa-regular fa-alarm-exclamation", sectionTitleClass: "overdue", filename: '' })
      sectionCount++
    }

    //-----------------------------------------------------------
    // Add a section for tagToShow, if set
    // Only find those which include open tasks that aren't scheduled in the future
    if (config.tagToShow) {
      const isHashtag: boolean = config.tagToShow.startsWith('#')
      const isMention: boolean = config.tagToShow.startsWith('@')

      if (isHashtag || isMention) {
        let itemCount = 0
        const notesWithTag = findNotesMatchingHashtagOrMention(config.tagToShow)
        for (const n of notesWithTag) {
          const tagParasFromNote = n.paragraphs.filter(p => p.content?.includes(config.tagToShow) && isOpen(p) && !includesScheduledFutureDate(p.content))
          if (tagParasFromNote.length > 0) {
            for (const p of tagParasFromNote) {
              const thisID = `${sectionCount}-${itemCount}`
              const thisFilename = p.note?.filename ?? ''
              sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
              itemCount++
            }
          }
        }

        if (itemCount > 0) {
          sections.push({
            ID: sectionCount,
            name: `${config.tagToShow}`,
            dateType: '',
            description: `{count} open task(s)`,
            FAIconClass: (isHashtag) ? 'fa-solid fa-hashtag' : 'fa-solid fa-at',
            sectionTitleClass: 'sidebarDaily',
            filename: ''
          })
          sectionCount++
        }
      } else {
        logWarn(`getDataForDashboard`, `tagToShow '${config.tagToShow}' is not a hashtag or mention`)
      }
      logInfo('getDataForDashboard', `- finished finding tagged items after ${timer(startTime)}`)
    }

    //-----------------------------------------------------------
    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      dateType: '',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
      filename: ''
    })

    //-----------------------------------------------------------
    // If Reviews plugin has produced a review list file, then show up to 4 of the most overdue things from it
    if (DataStore.fileExists(fullReviewListFilename)) {
      const nextNotesToReview: Array<TNote> = getNextNotesToReview(4)
      if (nextNotesToReview) {
        let itemCount = 0
        nextNotesToReview.map((n) => {
          const thisID = `${sectionCount}-${itemCount}`
          const thisFilename = n.filename ?? '<filename not found>'
          sectionItems.push({
            ID: thisID, content: '', rawContent: '', filename: thisFilename, type: 'review'
          })
          itemCount++
        })
        // clo(nextNotesToReview, "nextNotesToReview")
        sections.push({
          ID: sectionCount,
          name: 'Projects',
          dateType: '',
          description: `{count} next projects to review`,
          FAIconClass: 'fa-regular fa-calendar-check',
          sectionTitleClass: 'sidebarYearly',
          filename: ''
        }) // or "fa-solid fa-calendar-arrow-down" ?
        sectionCount++
      } else {
        logDebug('getDataForDashboard', `looked but found no notes to review`)
      }
    }
    // logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} items`)

    logInfo('getDataForDashboard', `finished generating ${String(sections.length)} sections and ${String(sectionItems.length)} items in ${timer(startTime)}`)
    return [sections, sectionItems]
  } catch (error) {
    logError(pluginJson, JSP(error))
    return [[], []] // for completeness
  }
}

/**
 * Generate data for dashboard and send to log
 */
export async function logDashboardData(): Promise<void> {
  try {
    const [sections, sectionItems] = await getDataForDashboard()

    // Log results
    logInfo('getDataForDashboard', `${String(sections.length)} sections and ${String(sectionItems.length)} items found:`)

    for (const section of sections) {
      const thisSectionItems = sectionItems.filter((i) => i.ID.startsWith(String(section.ID)))
      console.log(`\n# ${section.name}\t(${section.description})`)
      for (const item of thisSectionItems) {
        console.log(`- [${item.ID}] ${item?.content ?? ''} ${item.filename}`)
      }
    }
  } catch (error) {
    logError('pluginJson', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Get list of the next note(s) to review (if any).
 * It assumes the full-review-list exists and is sorted by nextReviewDate (earliest to latest).
 * Note: This is a variant of the original singular version in jgclark.Reviews/src/reviews.js
 * TODO: Should move this to the Reviews plugin?
 * @author @jgclark
 * @param { number } numToReturn first n notes to return
 * @return { Array<TNote> } next notes to review, up to numToReturn. Can be an empty array.
 */
function getNextNotesToReview(numToReturn: number): Array<TNote> {
  try {
    logDebug(pluginJson, `Starting dashboard/getNextNotesToReview())`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // If we get here, give a warning, as the file should exist and not be empty
      throw new Error(`full-review-list note empty or missing`)
    } else {
      const fileLines = reviewListContents.split('\n')

      // Use front-matter library to get past frontmatter
      const fmObj = fm(reviewListContents)
      const reviewLines = fmObj.body.split('\n')

      // Now read from the top until we find a line with a negative value in the first column (nextReviewDays)
      // and not complete ('finished').
      // Continue until we have found up to numToReturn such notes.
      const notesToReview: Array<TNote> = []
      for (let i = 0; i < reviewLines.length; i++) {
        const thisLine = reviewLines[i]
        const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
        const thisNoteTitle = thisLine.split('\t')[2] // get third field = title
        const tags = thisLine.split('\t')[5] ?? '' // get last field = tags
        if (nextReviewDays < 0 && !tags.includes('finished')) {
          logDebug('dashboard/getNextNotesToReview', `- Next to review = '${thisNoteTitle}'`)
          const nextNotes = DataStore.projectNoteByTitle(thisNoteTitle, true, false) ?? []
          notesToReview.push(nextNotes[0]) // add first matching note
          if (notesToReview.length >= numToReturn) {
            break // stop processing the loop
          }
        }
      }

      if (notesToReview.length === 0) {
        // If we get here then there are no projects needed for review
        logDebug('dashboard/getNextNotesToReview', `- No notes due for review 🎉`)
      }
      return notesToReview
    }
  } catch (error) {
    logError(pluginJson, `dashboard/getNextNotesToReview: ${error.message}`)
    return []
  }
}
