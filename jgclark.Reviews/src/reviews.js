// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 17.10.2022 for v0.9.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import moment from 'moment/min/moment-with-locales'
import fm from 'front-matter'
// import { getAttributes, getBody } from '@np.Templating/lib/support/modules/FrontmatterModule'
import {
  getReviewSettings,
  logPreference,
  Project,
} from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import {
  hyphenatedDateString,
  nowLocaleDateTime,
  RE_DATE,
} from '@helpers/dateTime'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
  overrideSettingsWithStringArgs,
  timer
} from '@helpers/dev'
import {
  getFilteredFolderList,
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import {
  findNotesMatchingHashtag,
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '@helpers/note'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'
import { sortListBy } from '@helpers/sorting'
import {
  // makeProjectLists,
  // redisplayProjectList,
  renderProjectListsHTML,
  renderProjectListsMarkdown,
} from "./projectLists"

//-----------------------------------------------------------------------------

// Settings
const reviewListPref = 'jgclark.Reviews.reviewList'
const fullReviewListFilename = 'full-review-list.md'
const fullReviewJSONFilename = 'full-review-list.json'

//-------------------------------------------------------------------------------

/**
 * Log the machine-readable list of notes to review
 * @author @jgclark
 */
export function logReviewList(): void{
  logPreference(reviewListPref)
}

/**
 * Log the machine-readable list of project-type notes
 * @author @jgclark
 */
export function logFullReviewList(): void {
  const content = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
  console.log(`Contents of ${fullReviewListFilename}:\n${content}`)
}

/**
 * Generate machine-readable list of all project-type notes,
 * ordered by the setting 'displayOrder', optionally also pre-ordered by 'folder'.
 * This is V3, which uses Plugins/data/jgclark.Reviews/full-review-list.md to store the list
 * @author @jgclark
 */
export async function makeFullReviewList(runInForeground: boolean = false): Promise<void> {
  try {
    const config = await getReviewSettings()
    logDebug('makeFullReviewList', `Starting for ${config.noteTypeTags.toString()} tags:`)

    // Get list of folders, excluding @specials and our foldersToIgnore setting
    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore, true)

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating full Project Review list`)
      await CommandBar.onAsyncThread()
    }

    const startTime = new Date()
    const projectInstances = []
    // Iterate over the folders ...
    // ... but ignoring any in the config.foldersToIgnore list
    for (const folder of filteredFolderList) {
      // Either we have defined tag(s) to filter and group by, or just use ''
      const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
        ? config.noteTypeTags
        : []

      // Get notes that include noteTag in this folder, ignoring subfolders
      const projectNotesArrArr = findNotesMatchingHashtags(tags, folder, false)
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note.
          // Save those which are ready for review in projectsReadyToReview array
          for (const n of pnarr) {
            const np = new Project(n)
            // summaryArray.push(np.machineSummaryLine())
            projectInstances.push(np)
          }
        }
      }
    }
    if (runInForeground) {
      await CommandBar.onMainThread()
      CommandBar.showLoading(false)
    }

    // Write to JSON file (an option I thought about)
    // const outputJSON = JSON.stringify(projectInstances, null, 1)
    // DataStore.saveData(outputJSON, fullReviewJSONFilename, true)
    // logDebug(`makeFullReviewList`, `written to ${fullReviewJSONFilename}`)

    // dedupe the list, in case it contains duplicates
    // const dedupedArray = []
    // summaryArray.forEach((element) => {
    //   if (!dedupedArray.includes(element)) {
    //     dedupedArray.push(element)
    //   }
    // })

    // Get machineSummaryLine for each of the sorted set of projectInstances
    let outputArray = []
    const lineArrayFields = []
    logDebug('makeFullReviewList', `- Starting loop for ${projectInstances.length} projectInstances`)
    for (const p of projectInstances) {
      // TODO: This can presumably be slimmed way down now?
      const mSL = p.machineSummaryLine()
      outputArray.push(mSL)
      lineArrayFields.push(mSL.split('\t'))
    }
    // clo(lineArrayFields)

    // sort the output list by the fields we want
    // TODO: SORT by folder name as well (if group by folder)
    // TODO: Replace this with TSV->Array and then sortListBy([2,0]) on array index
    // const sortedArray = sortListBy(lineArrayFields, ["3", "2", "0"])
    // console.log(`\n${String(sortedArray)}`)
    // // sort this array by key set in config.displayOrder
    // outputArray = sortedArray.slice()

    // Simplified version of this
    outputArray = outputArray.sort()

    // Previous method: sorted a list of Instances, but this is harder to extend
    // // NB: the Compare function needs to return negative, zero, or positive values.
    // let sortedProjects = []
    // logDebug(`makeFullReviewList`, `- sorting by field '${config.displayOrder}'`)
    // switch (config.displayOrder) {
    //   case 'due': {
    //     sortedProjects = projectInstances.sort(
    //       (first, second) => (first.dueDays ?? 0) - (second.dueDays ?? 0))
    //     break
    //   }
    //   case 'review': {
    //     // FIXME: quick test here first
    //     // The 'or 400' means ones with no nextReviewDays (e.g. completed ones) get sorted to the end
    //     sortedProjects = projectInstances.sort(
    //       (first, second) => (first.nextReviewDays ?? 400) - (second.nextReviewDays ?? 400))
    //     break
    //   }
    //   default: { // = title
    //     sortedProjects = projectInstances.sort(
    //       (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
    //     break
    //   }
    // }

    // Write some metadata to top of file
    outputArray.unshift("---")
    outputArray.unshift(`key: revDays\ttitle\tfolder\ttags`)
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift("title: full-review-list")
    outputArray.unshift("---")

    // write summary to full-review-list file
    DataStore.saveData(outputArray.join('\n'), fullReviewListFilename, true)
    logDebug(`makeFullReviewList`, `- written ${outputArray.length} lines to ${fullReviewListFilename}:`)
    // logFullReviewList()
  }
  catch (error) {
    logError(pluginJson, `makeFullReviewList: ${error.message}`)
  }
}

// Hopefully deprecated now
// function sortByFolderThenReview(first, second): number {
//   if (first.folder === second.folder) {
//     cosnt nrd1 = first.nextReviewDays != null ? first.nextReviewDays : 400
//     cosnt nrd2 = second.nextReviewDays != null ? second.nextReviewDays : 400
//     return (nrd1 < nrd2) ? -1 : (nrd1 > nrd2) ? 1 : 0
//   } else {
//     return (first.folder < second.folder) ? 1 : -1
//   }
// }


/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
 * Note: This is now deprecated in favour of makeFullReviewList!
 * @author @jgclark
 */
export async function makeReviewList(runInForeground: boolean = false): Promise<void> {
  try {
    const config = await getReviewSettings()

    // Get list of folders, excluding @specials and our foldersToIgnore setting
    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore, true)
    const summaryArray = []

    logDebug('makeReviewList', `starting for ${config.noteTypeTags.toString()} tags:`)

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating Project Review list`)
      await CommandBar.onAsyncThread()
    }

    const startTime = new Date()
    // Iterate over the folders ...
    // ... but ignoring any in the config.foldersToIgnore list
    for (const folder of filteredFolderList) {
      // Either we have defined tag(s) to filter and group by, or just use ''
      const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
        ? config.noteTypeTags
        : []

      // Get notes that include noteTag in this folder, ignoring subfolders
      const projectNotesArrArr = findNotesMatchingHashtags(tags, folder, false)
      const projectsReadyToReview = []
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note.
          // Save those which are ready for review in projectsReadyToReview array
          for (const n of pnarr) {
            const np = new Project(n)
            if (np.isReadyForReview && !config.foldersToIgnore.includes(np.folder)) {
              projectsReadyToReview.push(np)
            }
          }
        }
        // For each readyToReview note get the machine-readable summary line for it
        for (const thisProject of projectsReadyToReview) {
          summaryArray.push(thisProject.machineSummaryLine())
        }
      }
    }
    logDebug(pluginJson, `- ${Number(config.noteTypeTags.length * filteredFolderList.length)} folder/tag combinations reviewed in ${timer(startTime)}s`)
    if (runInForeground) {
      await CommandBar.onMainThread()
      CommandBar.showLoading(false)
    }

    // dedupe the list, in case it contains duplicates
    const dedupedArray = []
    summaryArray.forEach((element) => {
      if (!dedupedArray.includes(element)) {
        dedupedArray.push(element)
      }
    })

    // sort the list by first field
    const outputArray = dedupedArray.slice().sort((first, second) =>
      Number(first.split('\t')[0]) - Number(second.split('\t')[0]))

    // write summary to reviewList pref
    DataStore.setPreference(reviewListPref, outputArray.join('\n'))
    logReviewList()
    // logInfo(pluginJson, `-> Now ${outputArray.length} lines in the reviewListPref`)
  }
  catch (error) {
    logError(pluginJson, `makeReviewList: ${error.message}`)
  }
}

/**
 * Start a series of project reviews.
 * This starts by generating a new machine-readable list of project-type notes ready
 * for review, ordered by oldest next review date.
 * Then offers to load the first note to review.
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  try {
    const config = await getReviewSettings()

    // Make/update list of projects ready for review
    await makeFullReviewList(true)

    // Now offer first review
    const noteToReview = await getNextNoteToReview()
    // Open that note in editor
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logDebug('startReviews', `Opening '${displayTitle(noteToReview)}' note to review ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('startReviews', '🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError('startReviews', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then open the next one to review in the Editor.
 * @author @jgclark
*/
export async function nextReview(): Promise<void> {
  try {
    const config = await getReviewSettings()
    const currentNote = Editor.note
    if (currentNote != null && currentNote.type == 'Notes') {
      logDebug(pluginJson, `nextReview: Starting for ${displayTitle(currentNote)}`)

      // First update @review(date) on current open note
      // Also updates the full-review-list
      const openNote: ?TNote = await finishReview()
      // TODO: decide whether to delete this lot
      // Make Project instance for this note and get its machineSummaryLine
      // const thisProject = new Project(currentNote)
      // const updatedMachineSummaryLine = thisProject.machineSummaryLine()
      // // update this note in the review list
      // await updateReviewListAfterReview(currentNote, false, updatedMachineSummaryLine)
    } else {
      logWarn('nextReview', `- There's no project note in the Editor, so will just go to next review.`)
    }

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()
    if (noteToReview != null) {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res !== 'OK') {
          return
        }
      }
      logInfo('nextReview', `- Opening '${displayTitle(noteToReview)}' as nextReview note ...`)
      await Editor.openNoteByFilename(noteToReview.filename)
    } else {
      logInfo('nextReview', `- 🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError('nextReview', error.message)
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the full-review-list after completing a review or completing/cancelling a whole project.
 * Note: Called by functions nextReview, completeProject, cancelProject.
 * Note: The first param is now only used to get the title, so could be simplified?
 * @author @jgclark
 * @param {TNote} note that has been reviewed
 * @param {boolean} simplyDelete the project line?
 * @param {string?} updatedMachineSummaryLine to write to full-review-list (optional)
*/
export async function updateReviewListAfterReview(note: TNote, simplyDelete: boolean, updatedMachineSummaryLine: string = ''): Promise<void> {
  try {
    const reviewedTitle = note.title ?? ''
    logDebug(pluginJson, `updateReviewListAfterReview: updating mSL to '${reviewedTitle}' in full-review-list with ${simplyDelete.toString()} and '${updatedMachineSummaryLine}'`)

    // // Get pref that contains the project list
    // let reviewList = DataStore.preference(reviewListPref)
    // if (reviewList === undefined) {
    //   logDebug('updateReviewListAfterReview', `Can't find pref ${reviewListPref}. Will run makeReviewList() ...`)
    //   await makeReviewList(false)
    //   return
    // }

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')
    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const firstLineAfterFrontmatter = fmObj.bodyBegin - 1
    logDebug(pluginJson, firstLineAfterFrontmatter)

    // Find right line to update
    let thisLineNum: number // deliberately undefined
    let thisTitle = ''
    for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
      const line = fileLines[i]
      // check for title match just using field 2
      const titleField = line.split('\t')[1] ?? ''
      // logDebug('updateReviewListAfterReview', `- Comparing '${titleField}' to '${reviewedTitle}'`)
      if (titleField === reviewedTitle) {
        thisLineNum = i
        thisTitle = reviewedTitle
        logDebug('updateReviewListAfterReview', `- Found '${reviewedTitle}' to update from '${line}' at line number ${i}`)
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    // FIXME: this is ?always? failing
    if (thisLineNum !== undefined) {
      if (simplyDelete) {
        // delete line 'thisLineNum'
        fileLines.splice(thisLineNum, 1)
        DataStore.saveData(fileLines.join('\n'), fullReviewListFilename, true)
      } else {
        // update this line in the full-review-list
        fileLines[thisLineNum] = updatedMachineSummaryLine
        DataStore.saveData(fileLines.join('\n'), fullReviewListFilename, true)
      }
    } else {
      logWarn('updateReviewListAfterReview', `- Can't find '${reviewedTitle}' to update in full-review-list. Will run makeFullReviewList ...`)
      await makeFullReviewList(false)
      return
    }

    // New: now we can refresh the rendered views as well, but don't open the windows unless they're already open
    const config = await getReviewSettings()
    await redisplayProjectList(config)
  }
  catch (error) {
    logError(pluginJson, `updateReviewListAfterReview: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/** 
 * Work out the next note to review (if any)
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  try {
    logDebug(pluginJson, `getNextNoteToReview starting`)
    // // Get pref that contains the project list
    // let reviewList = DataStore.preference(reviewListPref)
    // if (reviewList === undefined) {
    //   logWarn('getNextNoteToReview', `Couldn't find pref ${reviewListPref}. Please run /rev:makeReviewList ...`)
    //   await makeReviewList(true)
    //   reviewList = DataStore.preference(reviewListPref)
    //   return
    // }
    // const reviewListStr = checkString(reviewList)

    // Get contents of full-review-list
    let reviewListContents = DataStore.loadData(fullReviewListFilename, true)
    if (!reviewListContents) {
      // Try to make the full-review-list
      await makeFullReviewList(true)
      reviewListContents = DataStore.loadData(fullReviewListFilename, true)
      if (!reviewListContents) {
        // If still no luck, throw an error
        throw new Error('full-review-list note empty or missing')
      }
    }
    const fileLines = reviewListContents.split('\n')

    // Now ignore frontmatter and sort rest by days before next review (first column)
    // Use front-matter library to get past frontmatter
    const fmObj = fm(reviewListContents)
    const firstLineAfterFrontmatter = fmObj.bodyBegin - 1
    logDebug(pluginJson, firstLineAfterFrontmatter)
    const reviewLines = fileLines.slice(firstLineAfterFrontmatter)
    const reviewLinesFirstCols = reviewLines.map((m) => m.split('\t').slice(0, 2).join('\t'))
    const sortedReviewLines = reviewLinesFirstCols.slice().sort((first, second) => Number(first.split('\t')[0]) - Number(second.split('\t')[0]))

    // Now read off the first line
    if (sortedReviewLines.length > 0) {
      const firstLine = sortedReviewLines[0]
      const nextNoteTitle = firstLine.split('\t')[1] // get second field in list
      logDebug('getNextNoteToReview', `Next to review -> '${nextNoteTitle}'`)
      const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
      return nextNotes[0] // return first matching note
    } else {
      logInfo('getNextNoteToReview', `No notes left due for review 🎉`)
      return
    }
  }
  catch (error) {
    logError(pluginJson, `getNextNoteToReview: ${error.message}`)
    return
  }
}

//-------------------------------------------------------------------------------
/** 
 * Update the @reviewed(date) in the note in the Editor to today's date, and update the full-review-list too
 * @author @jgclark
 * @return { ?TNote } current note
 */
export async function finishReview(): Promise<?TNote> {
  try {
    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const RE_REVIEW_MENTION = `${reviewedMentionStr}\\(${RE_DATE}\\)`
    const reviewedTodayString = `${reviewedMentionStr}(${hyphenatedDateString(new Date())})`

    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('finishReview', `- We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLine(Editor.note, `<placeholder metadata line> ${reviewedTodayString}`)
    // Re-read paragraphs, as they might have changed
    // $FlowIgnore[incompatible-use]
    let metadataPara = Editor.note.paragraphs[metadataLineIndex]
    if (metadataPara) {
      const origMetadataLineContent: string = metadataPara.content
      logDebug(pluginJson, `finishReview: starting with for '${displayTitle(Editor.note)}' with metadataLineIndex ${metadataLineIndex} ('${origMetadataLineContent}')`)

      // get list of @mentions -- more generous approach than just using metadata line
      const firstReviewedMention = Editor.note?.mentions?.find((m) =>
        m.match(RE_REVIEW_MENTION),
      ) ?? null
      if (firstReviewedMention != null) {
        // find line in currently open note containing @reviewed() mention
        for (const para of Editor.paragraphs) {
          if (para.content.match(RE_REVIEW_MENTION)) {
            metadataPara = para
            logDebug('finishReview', `- Found existing ${reviewedMentionStr}(...) in line ${para.lineIndex}`)
          }
        }

        // replace with today's date
        const older = origMetadataLineContent
        const newer = older.replace(firstReviewedMention, reviewedTodayString)
        metadataPara.content = newer
        logDebug('finishReview', `- Updating metadata para to '${newer}'`)

        // send update to Editor
        // $FlowIgnore[incompatible-use]
        Editor.note.updateParagraph(metadataPara)
      } else {
        // no existing @reviewed(date), so append to note's default metadata line
        logDebug('finishReview', `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
        metadataPara.content = `${origMetadataLineContent} ${reviewedTodayString}`.trim()
        // send update to Editor
        Editor.note?.updateParagraph(metadataPara)
        logDebug('finishReview', `- After update ${metadataPara.content}.`)
      }
    }

    // update this note in the review list
    // TEST: is this now working again?
    // $FlowIgnore[incompatible-call]
    const thisNoteAsProject = new Project(Editor.note)
    const updatedMachineSummaryLine = thisNoteAsProject.machineSummaryLine()
    // $FlowIgnore[incompatible-call]
    await updateReviewListAfterReview(Editor.note, false, updatedMachineSummaryLine)
    return Editor.note
  }
  catch (error) {
    logError('finishReview', `${error.message}`)
    return null
  }
}

//-----------------------------------------------------------------------
// Moved following from projectLists.js to avoid circular dependency
//-----------------------------------------------------------------------

/**
 * Decide which of the project list outputs to call (or more than one) based on x-callback args or config.outputStyle.
 * Now includes support for calling from x-callback, using simple "a=b;x=y" version of settings and values that will override ones in the user's settings.
 * @param {string | null} arguments list of form "a=b;x=y"
 */
export async function makeProjectLists(argsIn?: string | null = null): Promise<void> {
  try {
    let args = argsIn?.toString() || ''
    logDebug(pluginJson, `makeProjectLists: starting with args <${args}>`)
    let config = await getReviewSettings()
    if (args !== '') {
      config = overrideSettingsWithStringArgs(config, args)
      clo(config, 'Review settings updated with args:')
    } else {
      clo(config, 'Review settings with no args:')
    }

    // If more than a day old re-calculate the full-review-list
    // Using frontmatter library: https://github.com/jxson/front-matter
    const fileContent = DataStore.loadData(fullReviewListFilename, true) ?? `<error reading ${fullReviewListFilename}>`
    const fmObj = fm(fileContent)
    const listUpdatedDate = fmObj.attributes.date
    const bodyBegin = fmObj.bodyBegin
    const listUpdatedMoment = new moment(listUpdatedDate)
    const timeDiff = moment().diff(listUpdatedMoment, 'hours')
    if (timeDiff >= 24) {
      await makeFullReviewList(true)
    }

    // Call the relevant function with the updated config
    if (config.outputStyle.match(/rich/i) && NotePlan.environment.buildVersion >= 845) {
      await renderProjectListsHTML(config, true)
    }
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, true)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Redisplay the project list, by calling the relevant renderer but asking not 
 * to pop up a new window for this output, but refresh any that are already open.
 * @author @jgclark
 * @param {any} config 
 */
export async function redisplayProjectList(config: any): Promise<void> {
  try {
    logDebug(pluginJson, `redisplayProjectList: starting`)

    // Call the relevant function with config, but don't open up the display window unless already open
    if (config.outputStyle.match(/rich/i) && NotePlan.environment.buildVersion >= 845) {
      await renderProjectListsHTML(config, false)
    }
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, false)
    }
  }
  catch (error) {
    logError(pluginJson, error.message)
  }
}
