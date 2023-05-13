// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 7.4.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter' // For reviewList functionality
import {
  getSettings,
  type dashboardConfigType,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import { toLocaleDateString, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { filterParasAgainstExcludeFolders } from '@helpers/note'
import { getReferencedParagraphs } from '@helpers/NPnote'
import { makeBasicParasFromContent } from '@helpers/paragraph'
import {
  addPriorityToParagraphs,
  getNumericPriorityFromPara,
  getTasksByType,
  sortListBy,
  type GroupedTasks,
  type SortableParagraphSubset
} from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { isDone, isOpen } from '@helpers/utils'

//-----------------------------------------------------------------
// Constants

const reviewPluginID = 'jgclark.Reviews'
const fullReviewListFilename = `../${reviewPluginID}/full-review-list.md`

//-----------------------------------------------------------------

/**
 * Return list(s) of open task/checklist paragraphs from the current calendar note of type 'timePeriodName'. Optionally if 'includeReferencedItems' is true, then include references to this period as well.
 * Other config.* items are used:
 * - ignoreFolders? for folders to ignore for referenced notes
 * - separateSectionForReferencedNotes? if true, then two arrays will be returned: first from the calendar note; the second from references to that calendar note. If false, then both are included in a combined list (with the second being an empty array).
 * - ignoreTasksWithPhrase
 * @param {string} timePeriodName
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {boolean} includeReferencedItems?
 * @param {dashboardConfigType} dashboardConfig
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
function getOpenItemParasForCurrentTimePeriod(timePeriodName: string, timePeriodNote: TNote, includeReferencedItems: boolean, dashboardConfig: dashboardConfigType): [Array<TParagraph>, Array<TParagraph>] {
  logDebug('getDataForDashboard/gOIPFCTP', `Processing ${timePeriodNote.filename} which has ${String(timePeriodNote.paragraphs.length)} paras`)

  let parasToUse: $ReadOnlyArray<any> = []
  // TODO: un-comment when makeBasicParasFromContent() is ready
  // if (Editor && timePeriodNote.filename === Editor.filename) {
  //   // timePeriodNote = Editor.note // Note: produces content, but not the most recent change. FIXME: switch to Editor not Editor.note?
  //   logDebug('getDataForDashboard', `Starting for Editor version of '${timePeriodNote?.filename ?? 'error'}' with ${String(Editor.note?.versions?.length ?? NaN)} versions`)
  //   console.log(`Editor.content latest version: <${Editor.content ?? 'no content'}>`)
  //   parasToUse = makeBasicParasFromContent(Editor.content ?? '')
  // } else {
  logDebug('getDataForDashboard', `Starting for '${timePeriodNote.filename ?? 'error'}'`)
  parasToUse = timePeriodNote.paragraphs
  // }

  // Need to filter out non-open task types for following function, and any blank tasks
  let openParas = parasToUse.filter(isOpen).filter((p) => p.content !== '')
  // Filter out anything from 'ignoreTasksWithPhrase' setting
  if (dashboardConfig.ignoreTasksWithPhrase) {
    logDebug('getDataForDashboard', `Before 'ignore' filter: ${openParas.length} paras`)
    openParas = openParas.filter((p) => !p.content.includes(dashboardConfig.ignoreTasksWithPhrase))
  }
  logDebug('getDataForDashboard', `After 'ignore' filter: ${openParas.length} paras`)
  // openParas.map((p) => console.log(`\t<${p.content}>`))
  // Temporarily extend TParagraph with the task's priority
  openParas = addPriorityToParagraphs(openParas)

  // -------------------------------------------------------------
  // Get list of open tasks/checklists scheduled to today from other notes, and of the right paragraph type
  let refParas = timePeriodNote ? getReferencedParagraphs(timePeriodNote, false).filter(isOpen).filter((p) => p.content !== '') : []
  // Remove items referenced from items in 'ignoreFolders'
  refParas = filterParasAgainstExcludeFolders(refParas, dashboardConfig.ignoreFolders, true)
  // Remove possible dupes from sync'd lines
  refParas = eliminateDuplicateSyncedParagraphs(refParas)
  // Temporarily extend TParagraph with the task's priority
  refParas = addPriorityToParagraphs(refParas)
  logDebug('', `found ${String(refParas.length ?? 0)} references to today`)
  // sort the list only by priority, otherwise leaving order the same

  // Decide whether to return two separate arrays, or one combined one
  if (dashboardConfig.separateSectionForReferencedNotes) {
    const sortedOpenParas = sortListBy(openParas, ['-priority'])
    const sortedRefParas = sortListBy(refParas, ['-priority'])
    return [sortedOpenParas, sortedRefParas]
  } else {
    const combinedParas = sortListBy(openParas.concat(refParas), ['-priority'])
    const combinedSortedParas = sortListBy(combinedParas, ['-priority'])
    return [combinedSortedParas, []]
  }
}

/**
 * Work out the data for the dashboard, ready to pass to a renderer.
 * Will instead use demo data if useDemoData is true.
 * @param {boolean} useDemoData
 * @returns {[Array<SectionDetails>, Array<SectionItem>]}
 */
export async function getDataForDashboard(): Promise<[Array<SectionDetails>, Array<SectionItem>]> {
  try {
    // Get settings
    const config: dashboardConfigType = await getSettings()

    // Set up data structure to receive sections and their items
    const sections: Array<SectionDetails> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

    // -------------------------------------------------------------
    // Get list of open tasks/checklists from daily note (if it exists)
    let currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    if (currentDailyNote) {
      const thisFilename = currentDailyNote?.filename ?? '(error)'

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", currentDailyNote, config.separateSectionForReferencedNotes, config)

      // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
      if (config.separateSectionForReferencedNotes) {
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        combinedSortedParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
          itemCount++
        })
        // clo(combinedSortedParas, "daily sortedOpenParas")
        logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
        sections.push({ ID: sectionCount, name: 'Today', description: `from daily note ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "sortedRefParas")
        if (sortedRefParas.length > 0) {

          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'Today', description: `scheduled to today`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
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
          ID: sectionCount, name: 'Today', description: `from daily note or scheduled to ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename
        })
        sectionCount++
      }
      // Get count of tasks/checklists done today
      doneCount += currentDailyNote.paragraphs.filter(isDone).length

      // TODO: add completed count for today from referenced notes as well
    } else {
      logDebug('getDataForDashboard', `No daily note found for filename '${currentDailyNote?.filename ?? 'error'}'`)
    }

    // TODO: Include context for sub-tasks/checklist?
    // config.includeTaskContext

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from weekly note (if it exists)

    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (currentWeeklyNote) {
      const thisFilename = currentWeeklyNote?.filename ?? '(error)'
      const dateStr = thisFilename.replace('.md', '') // getDateStringFromCalendarFilename(thisFilename) FIXME: fix whether this function or its description should be changed

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", currentWeeklyNote, config.separateSectionForReferencedNotes, config)

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
        sections.push({ ID: sectionCount, name: 'This week', description: `from weekly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "weekly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This week', description: `scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This week', description: `from weekly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
        sectionCount++
      }
      // Get count of tasks/checklists done this week
      doneCount += currentWeeklyNote.paragraphs.filter(isDone).length
    } else {
      logDebug('getDataForDashboard', `No weekly note found for filename '${currentWeeklyNote?.filename ?? 'error'}'`)
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from monthly note (if it exists)
    let currentCalendarNote = DataStore.calendarNoteByDate(today, 'month')
    if (currentCalendarNote) {
      const thisFilename = currentCalendarNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)
      logDebug('getDataForDashboard', `Processing ${thisFilename} (${dateStr}) which has ${String(currentCalendarNote?.paragraphs?.length ?? NaN)} paras`)
      let parasToUse: $ReadOnlyArray<any> = []

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("month", currentCalendarNote, config.separateSectionForReferencedNotes, config)

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
        sections.push({ ID: sectionCount, name: 'This Month', description: `from monthly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "monthly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This month', description: `scheduled to this month`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarMonthly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This month', description: `from monthly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
        sectionCount++
      }

      // Get completed count too
      doneCount += currentCalendarNote.paragraphs.filter(isDone).length
    } else {
      logDebug('getDataForDashboard', `No monthly note found for filename '${currentCalendarNote?.filename ?? 'error'}'`)
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from quarterly note (if it exists)
    const currentQuarterlyNote = DataStore.calendarNoteByDate(today, 'quarter')
    if (currentQuarterlyNote) {
      const thisFilename = currentDailyNote?.filename ?? '(error)'
      const dateStr = getDateStringFromCalendarFilename(thisFilename)

      // Get list of open tasks/checklists from this calendar note
      const [combinedSortedParas, sortedRefParas] = getOpenItemParasForCurrentTimePeriod("day", currentQuarterlyNote, config.separateSectionForReferencedNotes, config)

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
        sections.push({ ID: sectionCount, name: 'This quarter', description: `from quarterly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
        sectionCount++

        // clo(sortedRefParas, "quarterly sortedRefParas")
        if (sortedRefParas.length > 0) {
          itemCount = 0
          sortedRefParas.map((p) => {
            const thisID = `${sectionCount}-${itemCount}`
            sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note?.filename ?? '', type: p.type })
            itemCount++
          })
          sections.push({ ID: sectionCount, name: 'This quarter', description: `scheduled to this quarter`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarQuarterly", filename: '' })
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
        sections.push({ ID: sectionCount, name: 'This quarter', description: `from quarterly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-days", sectionTitleClass: "sidebarQuarterly", filename: thisFilename })
        sectionCount++
      }
      // Get count of tasks/checklists done this quarter
      doneCount += currentQuarterlyNote.paragraphs.filter(isDone).length
    } else {
      logDebug('getDataForDashboard', `No quarterly note found for filename '${currentQuarterlyNote?.filename ?? 'error'}'`)
    }

    // Note: If we want to do yearly then the icon is fa-calendar-days (same as quarter)

    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
      filename: ''
    })

    // If Reviews plugin has produced a review list file, then show up to 4 of the most overdue things from it
    if (DataStore.fileExists(fullReviewListFilename)) {
      const nextNotesToReview: Array<TNote> = await getNextNotesToReview(4)
      if (nextNotesToReview) {
        let itemCount = 0
        nextNotesToReview.map((n) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({
            ID: thisID, content: '', rawContent: '', filename: n.filename, type: 'review'
          })
          itemCount++
        })
        // clo(nextNotesToReview, "nextNotesToReview")
        sections.push({
          ID: sectionCount,
          name: 'Projects',
          description: `next projects to review`,
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

    logDebug('getDataForDashboard', `getDataForDashboard finished, with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)
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
 * TODO: Should this move to the other plugin?
 * @author @jgclark
 * @param { number } numToReturn first n notes to return
 * @return { Array<TNote> } next notes to review, up to numToReturn. Can be an empty array.
 */
async function getNextNotesToReview(numToReturn: number): Promise<Array<TNote>> {
  try {
    logDebug(pluginJson, `Starting dashboard::getNextNotesToReview())`)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // If we get here, log error, as the file should exist and not be empty
      logError('dashboard / getNextNotesToReview', `full-review-list note empty or missing`)
      return []
    } else {
      const fileLines = reviewListContents.split('\n')

      // Use front-matter library to get past frontmatter
      const fmObj = fm(reviewListContents)
      const reviewLines = fmObj.body.split('\n')

      // Now read from the top until we find a line with a negative value in the first column (nextReviewDays).
      // Continue until we have found up to numToReturn such notes.
      const notesToReview: Array<TNote> = []
      for (let i = 0; i < reviewLines.length; i++) {
        const thisLine = reviewLines[i]
        const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
        const nextNoteTitle = thisLine.split('\t')[2] // get third field = title
        if (nextReviewDays < 0) {
          // logDebug('dashboard / getNextNotesToReview', `- Next to review = '${nextNoteTitle}'`)
          const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
          notesToReview.push(nextNotes[0]) // add first matching note
          if (notesToReview.length >= numToReturn) {
            break // stop processing the loop
          }
        }
      }

      if (notesToReview.length > 0) {
        return notesToReview // return array of ntoes
      } else {
        // If we get here then there are no projects needed for review
        logInfo('getNextNotesToReview', `- No notes due for review 🎉`)
        return []
      }
    }
  } catch (error) {
    logError(pluginJson, `dashboard::getNextNotesToReview: ${error.message}`)
    return []
  }
}

// TODO: move these to the right places

// Strip mailto links from the start of email addresses
function stripMailtoLinks(email: string): string {
  return email.replace(/^mailto:/, '')
}

// Convert markdown links to HTML links
function convertMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$1">$2</a>')
}
