// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 17.2.2023 for v0.1.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter' // For reviewList functionality
import { getSettings } from './dashboardHelpers'
import {
  toLocaleDateString,
  getDateStringFromCalendarFilename,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { getReferencedParagraphs } from '@helpers/NPnote'
import {
  getTasksByType, sortListBy,
  type GroupedTasks,
  type SortableParagraphSubset
} from '@helpers/sorting'

//-----------------------------------------------------------------
// Data types

export type SectionDetails = {
  ID: number,
  name: string,
  description: string,
  FAIconClass: string,
  sectionTitleClass: string,
  // FAIconColor: string,
}

export type SectionItem = {
  ID: number,
  content: string,
  filename: string,
  type: ParagraphType | string,
}

//-----------------------------------------------------------------
// Settings

// const pluginID = 'jgclark.Dashboard' // is this needed?

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
    const currentDailyNote = DataStore.calendarNoteByDate(today, 'day')
    if (currentDailyNote) {
      const thisFilename = currentDailyNote.filename
      logDebug('getDataForDashboard', `Processing ${thisFilename} which has ${String(currentDailyNote.paragraphs.length)} paras`)
      // Need to filter out non-task types for following function
      const allParas: GroupedTasks = getTasksByType(currentDailyNote.paragraphs.filter((p) => ["open", "checklist"].includes(p.type)), true)
      const openParas: Array<SortableParagraphSubset> = (allParas.open).concat(allParas.checklist)
      // clo(openParas, `${(String(openParas.length))} openParas:`)
      // sort the list only by priority, otherwise leaving order the same
      const sortedOpenParas = sortListBy(openParas, ['-priority'])
      // clo(sortedOpenParas, `${(String(sortedOpenParas.length))} sortedOpenParas:`)
      sortedOpenParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: thisFilename, type: p.calculatedType }))
      sections.push({ ID: sectionCount, name: 'Today', description: `${openParas.length} from daily note for ${toLocaleDateString(today)}`, FAIconClass: "fa-regular fa-calendar-star", sectionTitleClass: "sidebarDaily" })
      // sections.push({ ID: sectionCount, name: 'Today', description: `${openParas.length} from daily note for ${toLocaleDateString(today)}`, FAIconClass: "fa-regular fa-calendar-star", FAIconColor: "#d0703c" })
      sectionCount++

      // TODO: Include context for sub-tasks/checklist
      // config.includeTaskContext


      // Get count of tasks/checklists done today
      doneCount += currentDailyNote.paragraphs.filter((p) => ["done", "checklistDone"].includes(p.type)).length

      // Get list of open tasks/checklists scheduled to today from other notes
      const refParas = currentDailyNote ? getReferencedParagraphs(currentDailyNote, false) : []
      // FIXME: apply logic above here
      // logDebug('', `found ${String(refParas.length ?? 0)} references to today`)
      if (refParas) {
        // $FlowFixMe[incompatible-use]
        refParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: p.note.filename, type: p.type }))
        sections.push({ ID: sectionCount, name: 'Today', description: `${refParas.length} scheduled to today from other notes`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily" })
        // sections.push({ ID: sectionCount, name: 'Today', description: `${refParas.length} scheduled to today from other notes`, FAIconClass: "fa-regular fa-clock", FAIconColor: "#d0703c" })
        sectionCount++
      }

      // // Get completed count for today (in either >today or >YYYY-MM-DD style or >YYYY-Www) from reviewing notes changed in last 24 hours
      // const notesChangedInLastDay = [currentDailyNote] // TODO
      // for (const ncild of notesChangedInLastDay) {
      //   doneCount += ncild?.paragraphs.filter((p) => ["done", "checklistDone"].includes(p.type)).length ?? 0
      // }
    }

    // Get list of open tasks/checklists from weekly note
    const currentWeeklyNote = DataStore.calendarNoteByDate(today, 'week')
    if (currentWeeklyNote) {
      // FIXME: apply logic above here
      const thisFilename = currentWeeklyNote.filename
      const dateStr = getDateStringFromCalendarFilename(currentWeeklyNote.filename)
      logDebug('getDataForDashboard', `Processing ${thisFilename} which has ${String(currentWeeklyNote.paragraphs.length)} paras`)
      // Need to filter out non-task types for following function
      const allParas: GroupedTasks = getTasksByType(currentWeeklyNote.paragraphs.filter((p) => ["open", "checklist"].includes(p.type)), true)
      const openParas: Array<SortableParagraphSubset> = (allParas.open).concat(allParas.checklist)
      // clo(openParas, `${(String(openParas.length))} openParas:`)
      // sort the list only by priority, otherwise leaving order the same
      const sortedOpenParas = sortListBy(openParas, ['-priority'])
      // clo(sortedOpenParas, `${(String(sortedOpenParas.length))} sortedOpenParas:`)
      sortedOpenParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: thisFilename, type: p.calculatedType }))
      sections.push({ ID: sectionCount, name: 'This Week', description: `${openParas.length} from weekly note ${dateStr}`, FAIconClass: "fa-regular fa-calendar-week", sectionTitleClass: "sidebarWeekly" })
      // sections.push({ ID: sectionCount, name: 'This Week', description: `${openParas.length} from weekly note ${dateStr}`, FAIconClass: "fa-regular fa-calendar-week", FAIconColor: "#be23b6" })
      sectionCount++

      // Get completed count too
      doneCount += currentWeeklyNote.paragraphs.filter((p) => ["done", "checklistDone"].includes(p.type)).length

      // Get list of open tasks/checklists scheduled to this week from other notes
      // FIXME: apply logic above here
      const refParas = currentWeeklyNote ? getReferencedParagraphs(currentWeeklyNote, false) : []
      if (refParas) {
        // $FlowFixMe[incompatible-use]
        refParas.map((p) => sectionItems.push({ ID: sectionCount, content: p.content, filename: p.note.filename, type: p.type }))
        sections.push({ ID: sectionCount, name: 'This week', description: `${refParas.length} scheduled to this week from other notes`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly" })
        // sections.push({ ID: sectionCount, name: 'This week', description: `${refParas.length} scheduled to this week from other notes`, FAIconClass: "fa-regular fa-clock", FAIconColor: "#be23b6" })
        sectionCount++
      }
    }

    // If Reviews plugin has produced a review list file, then show the overdue things from it
    // TODO: change this to .fileExists when EM provides it
    logDebug('does file exist?', String(DataStore.fileExists(fullReviewListFilename)))
    let testReviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (testReviewListContents && testReviewListContents.length > 0) {
      const nextNotesToReview: Array<TNote> = await getNextNotesToReview(3)
      if (nextNotesToReview) {
        for (const n of nextNotesToReview) {
          // sectionItems.push({ ID: sectionCount, content: '', filename: 'CCC Areas/Services.md', type: 'note' }) // Example for testing only
          sectionItems.push({ ID: sectionCount, content: '', filename: n.filename, type: 'review-note' })
        }
        sections.push({ ID: sectionCount, name: 'Projects', description: `Next ${nextNotesToReview.length} projects ready to review`, FAIconClass: "fa-regular fa-calendar-check", sectionTitleClass: "sidebarYearly" }) // or "fa-solid fa-calendar-arrow-down" ?
        // sections.push({ ID: sectionCount, name: 'Projects', description: `Next ${nextNotesToReview.length} projects ready to review`, FAIconClass: "fa-regular fa-calendar-check", FAIconColor: "#bc782e" }) // or "fa-solid fa-calendar-arrow-down" ?
        sectionCount++
      } else {
        logDebug('getDataForDashboard', `looked but found no notes to review`)
      }
    }

    // Let's also pass count of completed things, to help morale!
    sections.push({ ID: sectionCount, name: 'Done', description: String(doneCount), FAIconClass: "fa-regular fa-circle-check", sectionTitleClass: "" })
    sectionCount++

    logDebug('getDataForDashboard', `getDataForDashboard finished, with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)
    return [sections, sectionItems]
  }
  catch (error) {
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
      const thisSectionItems = sectionItems.filter((i) => i.ID === section.ID)
      console.log(`\n# ${section.name}\t(${section.description})`)
      for (const item of thisSectionItems) {
        console.log(`- ${item?.content ?? ''} ${item.filename}`)
      }
    }
  }
  catch (error) {
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
  }
  catch (error) {
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