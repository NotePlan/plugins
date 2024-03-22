// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 15.3.2024 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
// import fm from 'front-matter' // For reviewList functionality
import {
  getNextNotesToReview,
  makeFullReviewList
} from '../../jgclark.Reviews/src/reviews.js'
import {
  getOpenItemParasForCurrentTimePeriod,
  getSettings,
  type dashboardConfigType,
  type Section, type SectionItem
} from './dashboardHelpers'
import {
  getDateStringFromCalendarFilename,
  includesScheduledFutureDate,
  // toISOShortDateTimeString,
  toLocaleDateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { filterOutParasInExcludeFolders } from '@helpers/note'
import {
  findNotesMatchingHashtagOrMention,
  // getReferencedParagraphs
} from '@helpers/NPnote'
import {
  addPriorityToParagraphs,
  sortListBy,
} from '@helpers/sorting'
// import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import {
  isDone, isOpen, removeDuplicates,
} from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

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
    const today = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    const maxInSection = config.maxTasksToShowInSection ?? 30

    // -------------------------------------------------------------
    // Get list of open tasks/checklists from current daily note (if it exists)
    const startTime = new Date() // for timing only
    // let currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    const dateStr = moment().format('YYYYMMDD') // use Moment so we can work on local time and ignore TZs
    // let currentDailyNote = DataStore.calendarNoteByDate(today, 'day') // ❌ seems unreliable
    const currentDailyNote = DataStore.calendarNoteByDateString(dateStr) // ✅ 
    if (currentDailyNote) {
      const thisFilename = currentDailyNote?.filename ?? '(error)'
      // const dateStr = getDateStringFromCalendarFilename(thisFilename)
      logInfo('getDataForDashboard', `---------------------------- Looking for Today's items for section #${String(sectionCount)} from ${dateStr}`)
      if (!thisFilename.includes(dateStr)) {
        logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", currentDailyNote, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
        sections.push({ ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} from daily note ${toLocaleDateString(today)} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
        sectionCount++

        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} scheduled to today`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
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
        sections.push({
          ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} from daily note or scheduled to ${toLocaleDateString(today)} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename
        })
        sectionCount++
      }
      // Get count of tasks/checklists done today
      doneCount += currentDailyNote.paragraphs.filter(isDone).length

      // Note: ideally also add completed count for today from referenced notes as well

      logInfo('getDataForDashboard', `- finished finding daily items from ${dateStr} after ${timer(startTime)}`)
    } else {
      logDebug('getDataForDashboard', `No daily note found for filename '${currentDailyNote?.filename ?? 'error'}'`)
    }

    // -------------------------------------------------------------
    // Get list of open tasks/checklists from yesterday's daily note (if wanted and it exists)
    let yesterdaysCombinedSortedParas: Array<TParagraph> = []
    if (config.showYesterdaySection) {
      const yesterday = new moment().subtract(1, 'days').toDate()
      const dateStr = new moment().subtract(1, 'days').format('YYYYMMDD')
      // let yesterdaysNote = DataStore.calendarNoteByDate(yesterday, 'day') // ❌ seems unreliable
      const yesterdaysNote = DataStore.calendarNoteByDateString(dateStr) // ✅ 

      if (yesterdaysNote) {
        const thisFilename = yesterdaysNote?.filename ?? '(error)'
        // const dateStr = getDateStringFromCalendarFilename(thisFilename)
        logInfo('getDataForDashboard', `---------------------------- Looking for Yesterday's items for section #${String(sectionCount)} from ${dateStr}`)
        if (!thisFilename.includes(dateStr)) {
          logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
        }

        // Get list of open tasks/checklists from this calendar note
        const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", yesterdaysNote, config)

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
          sections.push({ ID: sectionCount, name: 'Yesterday', sectionType: 'DY', description: `{count} from daily note ${toLocaleDateString(today)} {scheduleAllYesterdayToday}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarDaily", filename: thisFilename })
          sectionCount++

          // clo(sortedRefParas, "sortedRefParas")
          if (sortedRefParas.length > 0) {
            itemCount = 0
            sortedRefParas.map((p) => {
              const thisID = `${sectionCount}-${itemCount}`
              sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
              itemCount++
            })
            sections.push({ ID: sectionCount, name: 'Yesterday', sectionType: 'DY', description: `{count} scheduled to yesterday {scheduleAllToday}`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
            sectionCount++
          }
          // Save these paras for later deduping
          yesterdaysCombinedSortedParas = combinedSortedParas.concat(sortedRefParas)
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
            ID: sectionCount, name: 'Yesterday', sectionType: 'DY', description: `{count} from daily note or scheduled to ${toLocaleDateString(yesterday)} {scheduleAllYesterdayToday}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarDaily", filename: thisFilename
          })
          sectionCount++
          // Save these paras for later deduping
          yesterdaysCombinedSortedParas = combinedSortedParas
        }
        // Get count of tasks/checklists done today
        doneCount += yesterdaysNote.paragraphs.filter(isDone).length


        // Note: ideally also add completed count for yesterday from referenced notes as well

        logInfo('getDataForDashboard', `- finished finding yesterday's items from ${dateStr} after ${timer(startTime)}`)
      } else {
        logDebug('getDataForDashboard', `No daily note found for filename '${yesterdaysNote?.filename ?? 'error'}'`)
      }
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from weekly note (if it exists)

    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (config.showWeekSection && currentWeeklyNote) {
      const thisFilename = currentWeeklyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)
      logDebug('getDataForDashboard', `---------------------------- Looking for Weekly items for section #${String(sectionCount)} from ${dateStr}`)
      if (!thisFilename.includes(dateStr)) {
        logError('Please', `- filename '${thisFilename}' but '${dateStr}' ??`)
      }

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("week", currentWeeklyNote, config)

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
        sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} from weekly note ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "weekly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} from weekly note or scheduled to ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
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
      logDebug('getDataForDashboard', `---------------------------- Looking for Month items for section #${String(sectionCount)} -----------------------------`)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("month", currentMonthlyNote, config)

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
        sections.push({ ID: sectionCount, name: 'This Month', sectionType: 'M', description: `{count} from monthly note ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "monthly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This month', sectionType: 'M', description: `{count} scheduled to this month`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarMonthly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This month', sectionType: 'M', description: `{count} from monthly note or scheduled to ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
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
      logDebug('getDataForDashboard', `---------------------------- Looking for Quarter items for section #${String(sectionCount)} -----------------------------`)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("quarter", currentQuarterlyNote, config)

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
        sections.push({ ID: sectionCount, name: 'This quarter', sectionType: 'Q', description: `{count} from quarterly note ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "quarterly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This quarter', sectionType: 'Q', description: `{count} scheduled to this quarter`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarQuarterly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This quarter', sectionType: 'Q', description: `{count} from quarterly note or scheduled to ${dateStr} {addItems}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
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
    // Add a section for Overdue tasks, if wanted, and if not running because triggered by a change in the daily notex
    if (config.showOverdueTaskSection && (config.updateOverdueOnTrigger || fullGenerate)) {
      logInfo('getDataForDashboard', `---------------------------- Looking for Overdue Tasks for section #${String(sectionCount)} -----------------------------`)
      let thisStartTime = new Date()
      let totalOverdue = 0

      // $FlowFixMe(incompatible-call) returns $ReadOnlyArray type
      const refParas: Array<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
      logInfo('getDataForDashboard', `Found ${refParas.length} overdue items in ${timer(thisStartTime)}`)

      // Remove items referenced from items in 'ignoreFolders'
      const filteredRefParas = filterOutParasInExcludeFolders(refParas, config.ignoreFolders)
      logDebug('getDataForDashboard', `- ${filteredRefParas.length} paras after excluding @special + [${String(config.ignoreFolders)}] folders`)

      // Remove items already in Yesterday section (if turned on)
      if (config.showYesterdaySection && yesterdaysCombinedSortedParas.length > 0) {
        // Filter out all items in array filteredRefParas that also appear in array yesterdaysCombinedSortedParas
        filteredRefParas.map((p) => {
          if (yesterdaysCombinedSortedParas.filter((y) => y.content === p.content).length > 0) {
            logDebug('getDataForDashboard', `- removing duplicate item {${p.content}} from overdue list`)
            filteredRefParas.splice(filteredRefParas.indexOf(p), 1)
          }
        })
      }
      logInfo('getDataForDashboard', `- after deduping with yesterday -> ${filteredRefParas.length} in ${timer(thisStartTime)}`)

      if (filteredRefParas.length > 0) {
        // Remove possible dupes from sync'd lines
        // Note: currently commented out, to save 2? secs of processing
        // BUT now covered by the later removeDuplicates() call
        // filteredRefParas = eliminateDuplicateSyncedParagraphs(filteredRefParas)
        // logDebug('getDataForDashboard', `- after sync lines dedupe ->  ${filteredRefParas.length}`)

        // Temporarily extend Paragraphs with the task's priority
        const overdueTaskParasWithPriority = addPriorityToParagraphs(filteredRefParas)
        logInfo('getDataForDashboard', `- after adding priority -> ${overdueTaskParasWithPriority.length} in ${timer(thisStartTime)}`)

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // TODO: this takes >600ms for 1,000 items
        const reducedParas = overdueTaskParasWithPriority.map((p) => {
          const note = p.note
          const fieldSet = {
            filename: note?.filename ?? '<error>',
            changedDate: note?.changedDate,
            title: displayTitle(note), // this isn't expensive
            content: p.content,
            rawContent: p.rawContent,
            type: p.type,
            priority: p.priority,
          }
          return fieldSet
        })
        logInfo('getDataForDashboard', `- after reducing paras -> ${reducedParas.length} in ${timer(thisStartTime)}`)

        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // Note: not fully accurate, as it doesn't check the filename is identical, but this catches sync copies, which saves a lot of time
        // Note: this is a quick operation
        const filteredReducedParas = removeDuplicates(reducedParas, ['content'])
        logInfo('getDataForDashboard', `- after deduping overdue -> ${filteredReducedParas.length} in ${timer(thisStartTime)}`)

        totalOverdue = filteredReducedParas.length

        // Sort paragraphs by one of several options
        thisStartTime = new Date()
        const sortOrder = (config.overdueSortOrder === 'priority')
          ? ['-priority', '-changedDate']
          : (config.overdueSortOrder === 'earliest')
            ? ['changedDate', 'priority']
            : ['-changedDate', 'priority'] // 'most recent'
        const sortedOverdueTaskParas = sortListBy(filteredReducedParas, sortOrder)
        logInfo('getDataForDashboard', `- Sorted  ${sortedOverdueTaskParas.length} items by ${String(sortOrder)} in ${timer(thisStartTime)}`)

        // Apply limit to set of ordered results
        const overdueTaskParasLimited = (sortedOverdueTaskParas.length > maxInSection) ? sortedOverdueTaskParas.slice(0, maxInSection) : sortedOverdueTaskParas
        logDebug('getDataForDashboard', `- after limit, now ${overdueTaskParasLimited.length} items to show`)
        let itemCount = 0
        overdueTaskParasLimited.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type })
          itemCount++
        })

        let overdueSectionDescription = (totalOverdue > itemCount)
          ? `first {count} of ${String(totalOverdue)} tasks ordered by ${config.overdueSortOrder}`
          : `all {count} tasks ordered by ${config.overdueSortOrder}`
        overdueSectionDescription += ` {scheduleAllOverdueToday}`
        sections.push({
          ID: sectionCount,
          name: 'Overdue Tasks', sectionType: 'OVERDUE', description: overdueSectionDescription, FAIconClass: "fa-regular fa-alarm-exclamation", sectionTitleClass: "overdue", filename: ''
        })
        sectionCount++
      }
      logInfo('getDataForDashboard', `- finished finding overdue items after ${timer(startTime)}`)
    }

    //-----------------------------------------------------------
    // Add a section for tagToShow, if set
    // Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future
    if (config.tagToShow) {
      logInfo('getDataForDashboard', `---------------------------- Looking for tag '${config.tagToShow}'  for section #${String(sectionCount)} -----------------------------`)
      const thisStartTime = new Date()
      const isHashtag: boolean = config.tagToShow.startsWith('#')
      const isMention: boolean = config.tagToShow.startsWith('@')
      if (isHashtag || isMention) {
        let itemCount = 0
        let totalCount = 0
        const filteredTagParas: Array<TParagraph> = []

        // Get notes with matching hashtag or mention (as can't get list of paras directly)
        const notesWithTag = findNotesMatchingHashtagOrMention(config.tagToShow)

        for (const n of notesWithTag) {
          // Don't continue if this note is in an excluded folder
          const thisNoteFolder = getFolderFromFilename(n.filename)
          if (config.ignoreFolders.includes(thisNoteFolder)) {
            logDebug('getDataForDashboard', `- ignoring note '${n.filename}' as it is in an ignored folder`)
            continue
          }

          // Get the relevant paras from this note
          const tagParasFromNote = n.paragraphs.filter(p => p.content?.includes(config.tagToShow) && isOpen(p) && !includesScheduledFutureDate(p.content))
          logDebug('getDataForDashboard', `- found ${tagParasFromNote.length} paras`)

          // Save this para, unless in matches the 'ignoreTagMentionsWithPhrase' setting

          for (const p of tagParasFromNote) {
              if (config.ignoreTagMentionsWithPhrase === '' || !p.content.includes(config.ignoreTagMentionsWithPhrase)) {
                filteredTagParas.push(p)
              } else {
                logDebug('getDataForDashboard', `- ignoring para {${p.content}} as it contains '${config.ignoreTagMentionsWithPhrase}'`)
              }
            }

        }
        logInfo('getDataForDashboard', `- ${filteredTagParas.length} paras (after ${timer(startTime)})`)

        if (filteredTagParas.length > 0) {
          // Remove possible dupes from sync'd lines
          // TODO: currently commented out, to save 2? secs of processing
          // const dedupedParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
          // logDebug('getDataForDashboard', `- after dedupe ->  ${dedupedParas.length}`)

          // Temporarily extend Paragraphs with the task's priority
          const filteredTagParasWithPriority = addPriorityToParagraphs(filteredTagParas)
          logInfo('getDataForDashboard', `- after adding priority -> ${filteredTagParasWithPriority.length} in ${timer(thisStartTime)}`)

          // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
          // Note: this is a quick operation
          const reducedParas = filteredTagParasWithPriority.map((p) => {
            const note = p.note
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

          // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
          // Note: this is a quick operation
          const filteredReducedParas = removeDuplicates(reducedParas, ['content', 'filename'])
          logInfo('getDataForDashboard', `- after deduping overdue -> ${filteredReducedParas.length} in ${timer(thisStartTime)}`)

          totalCount = filteredReducedParas.length

          // Sort paragraphs by one of several options
          const sortOrder = (config.overdueSortOrder === 'priority')
            ? ['-priority', '-changedDate']
            : (config.overdueSortOrder === 'earliest')
              ? ['changedDate', 'priority']
              : ['-changedDate', 'priority'] // 'most recent'
          const sortedTagParas = sortListBy(filteredReducedParas, sortOrder)
          logInfo('getDataForDashboard', `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)} after ${timer(thisStartTime)}`)

          // Apply limit to set of ordered results
          const sortedTagParasLimited = (sortedTagParas.length > maxInSection) ? sortedTagParas.slice(0, maxInSection) : sortedTagParas
          logDebug('getDataForDashboard', `- after limit, now ${sortedTagParasLimited.length} items to show`)

          for (const p of sortedTagParasLimited) {
            const thisID = `${sectionCount}-${itemCount}`
            const thisFilename = p.filename ?? ''
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
            itemCount++
          }
        }

        if (itemCount > 0) {
          const tagSectionDescription = (totalCount > itemCount) ? `first {count} from ${String(totalCount)} items ordered by ${config.overdueSortOrder}`
            : `all {count} items ordered by ${config.overdueSortOrder}`
          sections.push({
            ID: sectionCount,
            name: `${config.tagToShow}`,
            sectionType: 'TAG',
            description: tagSectionDescription,
            FAIconClass: (isHashtag) ? 'fa-solid fa-hashtag' : 'fa-solid fa-at',
            sectionTitleClass: 'sidebarDaily',
            filename: ''
          })
          sectionCount++
        }
      } else {
        logWarn(`getDataForDashboard`, `tagToShow '${config.tagToShow}' is not a hashtag or mention`)
      }
      logInfo('getDataForDashboard', `- finished finding tagged items after ${timer(thisStartTime)}`)
    }

    //-----------------------------------------------------------
    // If Reviews plugin has produced a review list file, then show up to 4 of the most overdue things from it
    if (DataStore.fileExists(fullReviewListFilename)) {
      logInfo('getDataForDashboard', `---------------------------- Looking for Project items for section #${String(sectionCount)} -----------------------------`)

      // But first check to see if it is more than a day old
      const fullReviewListContent = DataStore.loadData(fullReviewListFilename, true)
      // Get date of last generation from file contents, lineIndex 2 ('date: 2024-01-04T23:20:08+00:00')
      const reviewListDateStr = fullReviewListContent?.match(/date: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)?.[1]
      const reviewListDate = moment(reviewListDateStr).toDate()
      const fileAge = Date.now() - reviewListDate
      // If this note is more than a day old, then regenerate it
      if (fileAge > (1000 * 60 * 60 * 24)) {
        logDebug('getDataForDashboard', `Regenerating fullReviewList as too old`)
        // Call plugin command makeFullReviewList
        await makeFullReviewList()
      }

      const nextNotesToReview: Array<TNote> = getNextNotesToReview(6)
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
          sectionType: 'PROJ',
          description: `{count} next projects to review {startReviews}`,
          FAIconClass: 'fa-regular fa-calendar-check',
          sectionTitleClass: 'sidebarYearly',
          filename: ''
        })
        sectionCount++
      } else {
        logDebug('getDataForDashboard', `looked but found no notes to review`)
      }
    }
    // logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      sectionType: '',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
      filename: ''
    })

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
