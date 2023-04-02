// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2.4.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter' // For reviewList functionality
import {
  getSettings,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import { toLocaleDateString, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, timer } from '@helpers/dev'
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

export async function getDataForDashboard(): Promise<[Array<SectionDetails>, Array<SectionItem>]> {
  try {
    // Get any settings
    const config = await getSettings()

    // Set up data structure to receive sections and their items
    const sections: Array<SectionDetails> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    const today = new Date()

    // Get list of open tasks/checklists from daily note
    // First check to see whether this note is open in Editor. If so use that version, otherwise if this was triggered from it, it will be out of date.
    let currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    if (currentDailyNote) {
      const thisFilename = currentDailyNote.filename

      logDebug('getDataForDashboard', `Processing ${thisFilename} which has ${String(currentDailyNote.paragraphs.length)} paras`)

      let parasToUse: $ReadOnlyArray<any> = []
      // TODO: un-comment when makeBasicParasFromContent() is ready
      // if (Editor && currentDailyNote.filename === Editor.filename) {
      //   // currentDailyNote = Editor.note // Note: produces content, but not the most recent change
      //   logDebug('getDataForDashboard', `Starting for Editor version of '${currentDailyNote?.filename ?? 'error'}' with ${String(Editor.note?.versions?.length ?? NaN)} versions`)
      //   console.log(`Editor.content latest version: <${Editor.content ?? 'no content'}>`)
      //   parasToUse = makeBasicParasFromContent(Editor.content ?? '')
      // } else {
      logDebug('getDataForDashboard', `Starting for '${currentDailyNote.filename ?? 'error'}'`)
      parasToUse = currentDailyNote.paragraphs
      // }

      // Need to filter out non-open task types for following function, and any blank tasks
      let openParas = parasToUse.filter(isOpen).filter((p) => p.content !== '')
      // Filter out anything from 'ignoreTasksWithPhrase' setting
      if (config.ignoreTasksWithPhrase) {
        logDebug('getDataForDashboard', `Before 'ignore' filter: ${openParas.length} paras`)
        openParas = openParas.filter((p) => !p.content.includes(config.ignoreTasksWithPhrase))
      }

      logDebug('getDataForDashboard', `After 'ignore' filter: ${openParas.length} paras:`)
      openParas.map((p) => console.log(`\t<${p.content}>`))

      // Temporarily extend TParagraph with the task's priority
      openParas = addPriorityToParagraphs(openParas)
      // sort the list only by priority, otherwise leaving order the same
      const sortedOpenParas = sortListBy(openParas, ['-priority'])
      // make a sectionItem for each item, and then make a section too.
      let itemCount = 0
      sortedOpenParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({
          ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type
        })
        itemCount++
      })
      // clo(sortedOpenParas, "daily sortedOpenParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'Today', description: `from ${toLocaleDateString(today)} daily note`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
      sectionCount++

      // TODO: Include context for sub-tasks/checklist?
      // config.includeTaskContext

      // Get count of tasks/checklists done today
      doneCount += currentDailyNote.paragraphs.filter(isDone).length

      //-----------------------------------------------------------
      // Get list of open tasks/checklists scheduled to today from other notes, and of the right paragraph type
      let refParas = currentDailyNote ? getReferencedParagraphs(currentDailyNote, false).filter(isOpen).filter((p) => p.content !== '') : []
      // Remove items referenced from items in 'ignoreFolders'
      refParas = filterParasAgainstExcludeFolders(refParas, config.includeFolders, true)
      // Remove possible dupes from sync'd lines
      refParas = eliminateDuplicateSyncedParagraphs(refParas)

      // Temporarily extend TParagraph with the task's priority
      refParas = addPriorityToParagraphs(refParas)

      // logDebug('', `found ${String(refParas.length ?? 0)} references to today`)
      if (refParas) {
        // sort the list only by priority, otherwise leaving order the same
        const sortedRefParas = sortListBy(refParas, ['-priority'])
        // make a sectionItem for each item, and then make a section too.
        let itemCount = 0
        sortedRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({
            ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note.filename, type: p.type
          })
          itemCount++
        })
        // clo(sortedRefParas, "sortedRefParas")
        sections.push({ ID: sectionCount, name: 'Today', description: `scheduled to today`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily" })
        sectionCount++
      }

      // // Get completed count for today (in either >today or >YYYY-MM-DD style or >YYYY-Www) from reviewing notes changed in last 24 hours
      // const notesChangedInLastDay = [currentDailyNote] // TODO
      // for (const ncild of notesChangedInLastDay) {
      //   doneCount += ncild?.paragraphs.filter((p) => ["done", "checklistDone"].includes(p.type)).length ?? 0
      // }
    }
    // logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from weekly note (if it exists)
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (currentWeeklyNote) {
      const thisFilename = currentWeeklyNote.filename
      const dateStr = thisFilename.replace('.md', '') // getDateStringFromCalendarFilename(thisFilename) TODO: fix whether this function or its description should be changed
      logDebug('getDataForDashboard', `Processing ${thisFilename} (${dateStr}) which has ${String(currentWeeklyNote.paragraphs.length)} paras`)
      // Need to filter out non-task types for following function
      let openParas = currentWeeklyNote.paragraphs.filter(isOpen).filter((p) => p.content !== '')
      // clo(openParas, `${(String(openParas.length))} openParas:`)
      // Temporarily extend TParagraph with the task's priority
      openParas = addPriorityToParagraphs(openParas)
      // sort the list only by priority, otherwise leaving order the same
      const sortedParas = sortListBy(openParas, ['-priority'])
      // make a sectionItem for each item, and then make a section too.
      // sortedParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type }))
      let itemCount = 0
      sortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({
          ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type
        })
        itemCount++
      })
      // clo(sortedParas, "weekly sortedParas")
      sections.push({ ID: sectionCount, name: 'This Week', description: `from weekly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
      sectionCount++
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} weekly items`)

      // Get completed count too
      doneCount += currentWeeklyNote.paragraphs.filter(isDone).length

      //-----------------------------------------------------------
      // Get list of open tasks/checklists scheduled to this week from other notes, and of the right paragraph types
      let refParas = currentWeeklyNote
        ? getReferencedParagraphs(currentWeeklyNote, false).filter(isOpen).filter((p) => p.content !== '')
        : []
      // Remove items referenced from items in 'ignoreFolders'
      refParas = filterParasAgainstExcludeFolders(refParas, config.includeFolders, true)
      // Remove possible dupes from sync'd lines
      refParas = eliminateDuplicateSyncedParagraphs(refParas)
      if (refParas) {
        // Temporarily extend TParagraph with the task's priority
        refParas = addPriorityToParagraphs(refParas)
        // sort the list only by priority, otherwise leaving order the same
        const sortedRefParas = sortListBy(refParas, ['-priority'])
        // sortedRefParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, rawContent: p.rawContent, filename: p.note.filename, type: p.type }))
        let itemCount = 0
        sortedRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({
            ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note.filename, type: p.type
          })
          itemCount++
        })
        // clo(sortedRefParas, "sortedRefParas")
        sections.push({ ID: sectionCount, name: 'This week', description: `scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly" })
        sectionCount++
      }
    }

    //-----------------------------------------------------------
    // Get list of open tasks/checklists from monthly note (if it exists)
    let currentMonthlyNote = DataStore.calendarNoteByDate(today, 'month')
    const thisFilename = currentMonthlyNote?.filename ?? '<error>'
    const dateStr = thisFilename.replace('.md', '') // getDateStringFromCalendarFilename(thisFilename) TODO: fix whether this function or its description should be changed
    logDebug('getDataForDashboard', `Processing ${thisFilename} (${dateStr}) which has ${String(currentMonthlyNote?.paragraphs?.length ?? NaN)} paras`)
    if (currentMonthlyNote) {
      let parasToUse: $ReadOnlyArray<any> = []
      // TODO: un-comment when makeBasicParasFromContent() is ready
      // if (Editor && currentMonthlyNote?.filename === Editor.filename) {
      //   currentMonthlyNote = Editor.note // Note: produces content, but not the most recent change
      //   logDebug('getDataForDashboard', `Starting for Editor version of '${currentMonthlyNote?.filename ?? 'error'}' with ${String(Editor.note?.versions?.length ?? NaN)} versions`)
      //   console.log(`Editor.content latest version: <${Editor.content ?? 'no content'}>`)
      //   parasToUse = makeBasicParasFromContent(Editor.content ?? '')
      // } else {
      logDebug('getDataForDashboard', `Starting for '${currentMonthlyNote?.filename ?? 'error'}'`)
      parasToUse = currentMonthlyNote?.paragraphs
      // }

      // Need to filter out non-task types for following function
      let openParas = parasToUse.filter(isOpen).filter((p) => p.content !== '') ?? []
      // clo(openParas, `${(String(openParas.length))} openParas:`)
      // Temporarily extend TParagraph with the task's priority
      openParas = addPriorityToParagraphs(openParas)
      // sort the list only by priority, otherwise leaving order the same
      const sortedParas = sortListBy(openParas, ['-priority'])
      // make a sectionItem for each item, and then make a section too.
      let itemCount = 0
      sortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({
          ID: thisID, content: p.content, rawContent: p.rawContent, filename: thisFilename, type: p.type
        })
        itemCount++
      })
      // clo(sortedParas, "monthly sortedParas")
      sections.push({ ID: sectionCount, name: 'This Month', description: `from monthly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
      sectionCount++
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} monthly items`)

      // Get completed count too
      // $FlowFixMe(incompatible-use)
      doneCount += currentMonthlyNote.paragraphs.filter(isDone).length

      //-----------------------------------------------------------
      // Get list of open tasks/checklists scheduled to this month from other notes, and of the right paragraph types
      let refParas = currentMonthlyNote
        ? getReferencedParagraphs(currentMonthlyNote, false).filter(isOpen).filter((p) => p.content !== '')
        : []
      // Remove items referenced from items in 'ignoreFolders'
      refParas = filterParasAgainstExcludeFolders(refParas, config.includeFolders, true)
      // Remove possible dupes from sync'd lines
      refParas = eliminateDuplicateSyncedParagraphs(refParas)
      if (refParas) {
        // Temporarily extend TParagraph with the task's priority
        refParas = addPriorityToParagraphs(refParas)
        // sort the list only by priority, otherwise leaving order the same
        const sortedRefParas = sortListBy(refParas, ['-priority'])
        let itemCount = 0
        sortedRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({
            ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.note.filename, type: p.type
          })
          itemCount++
        })
        // clo(sortedRefParas, "sortedRefParas")
        sections.push({ ID: sectionCount, name: 'This month', description: `scheduled to this month`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarMonthly" })
        sectionCount++
      }
    }

    // Note: If we want to do quarterly or yearly then the icon is fa-calendar-days

    // logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} items`)

    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
    })

    // If Reviews plugin has produced a review list file, then show up to 4 of the most overdue things from it
    if (DataStore.fileExists(fullReviewListFilename)) {
      const nextNotesToReview: Array<TNote> = await getNextNotesToReview(4)
      if (nextNotesToReview) {
        // for (const n of nextNotesToReview) {          
        //   sectionItems.push({ ID: sectionCount, content: '', rawContent: '', filename: n.filename, type: 'review-note' })
        // }
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
    logError(pluginJson, error.message)
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
