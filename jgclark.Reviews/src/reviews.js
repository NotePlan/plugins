// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 21.10.2022 for v0.9.0-betas, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import fm from 'front-matter'
import moment from 'moment/min/moment-with-locales'
import {
  getReviewSettings,
  logPreference,
  Project,
} from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import {
  getTodaysDateHyphenated,
  // hyphenatedDateString,
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
import { fieldSorter, sortListBy } from '@helpers/sorting'
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

    // Iterate over the folders ...
    // ... but ignoring any in the config.foldersToIgnore list
    const startTime = new Date()
    const projectInstances = []
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
            // Further check to see whether to exclude archived projects
            // TODO: This will need thought -- does it still make sense?
            // if (config.displayArchivedProjects) {
              projectInstances.push(np)
            // }
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

    // Get machineSummaryLine for each of the projectInstances
    let reviewLines = []
    let lineArrayObjs = []
    logDebug('makeFullReviewList', `- Starting loop for ${projectInstances.length} projectInstances`)
    for (const p of projectInstances) {
      const mSL = p.machineSummaryLine()
      reviewLines.push(mSL)
      const mSLFields = mSL.split('\t')
      lineArrayObjs.push({
        'reviewDays': mSLFields[0],
        'dueDays': mSLFields[1],
        'title': mSLFields[2],
        'folder': mSLFields[3],
        'tags': mSLFields[4],
      })
    }

    // sort the output list by the fields we want, and add frontmatter
    const outputArray = sortAndFormFullReviewList(reviewLines, config)

    // write summary to full-review-list file
    DataStore.saveData(outputArray.join('\n'), fullReviewListFilename, true)
    logDebug(`makeFullReviewList`, `- written ${outputArray.length} lines to ${fullReviewListFilename}`)
    // logFullReviewList()
  }
  catch (error) {
    logError(pluginJson, `makeFullReviewList: ${error.message}`)
  }
}

/**
 * Take a set of machineSummaryLines, sort them according to config, and then add frontmatter
 * @param {Array<string>} linesIn 
 * @param {any} config 
 * @returns {Array<string>} outputArray
 */
function sortAndFormFullReviewList(linesIn: Array<string>, config: any): Array<string> {
  try {
    logDebug('sortAndFormFullReviewList', `Started:`)
    const outputArray = []
    const lineArrayObjs = []

    // Method 3: use DW fieldSorter() function
    // Requires turning each TSV line into an Object (above)
    const sortingSpecification = []
    if (config.displayGroupedByFolder) {
      sortingSpecification.push('folder')
    }
    switch (config.displayOrder) {
      case 'review': {
        sortingSpecification.push('reviewDays')
        break
      }
      case 'due': {
        sortingSpecification.push('dueDays')
        break
      }
      case 'title': {
        sortingSpecification.push('title')
        break
      }
    }

    // turn each TSV string into an object
    for (const line of linesIn) {
      const fields = line.split('\t')
      lineArrayObjs.push({
        'reviewDays': fields[0],
        'dueDays': fields[1],
        'title': fields[2],
        'folder': fields[3],
        'tags': fields[4],
      })
    }

    logDebug('sortAndFormFullReviewList', `- sorting by ${String(sortingSpecification)}`)
    const sortedlineArrayObjs = sortListBy(lineArrayObjs, sortingSpecification)

    // turn each lineArrayObj back to a TSV string
    for (let lineObj of sortedlineArrayObjs) {
      outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    }

    // Method 2: use lodash _.orderBy() function
    // Requires turning each TSV line into an Object (above)
    // Note: Crashes for some reason neither DW or I can understand.
    // clo(lineArrayObjs, "Before orderBy")
    // if (lineArrayObjs) {
    //   lineArrayObjs = orderBy(lineArrayObjs, ['folder', 'reviewDays'], ['asc', 'asc'])
    //   clo(lineArrayObjs, "After orderBy")
    // }
    // // turn lineArrayObjs back to a TSV string
    // for (let lineObj of lineArrayObjs) {
    //   outputArray.push(lineObj.reviewDays + '\t' + lineObj.dueDays + '\t' + lineObj.title + '\t' + lineObj.folder + '\t' + lineObj.tags)
    // }

    // Write some metadata to start
    outputArray.unshift("---")
    outputArray.unshift(`key: revDays\tdueDays\ttitle\tfolder\ttags`)
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift("title: full-review-list")
    outputArray.unshift("---")
    clo(outputArray, '- returning outputArray:')

    return outputArray
  }
  catch (error) {
    logError('sortAndFormFullReviewList', error.message)
    return [] // for completeness
  }
}

// --------------------------------------------------------------------

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
      logInfo('startReviews', `Opening '${displayTitle(noteToReview)}' note to review ...`)
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
      logInfo(pluginJson, `nextReview: Starting for ${displayTitle(currentNote)}`)

      // First update @review(date) on current open note
      // Also updates the full-review-list
      const openNote: ?TNote = await finishReview()
    } else {
      logWarn('nextReview', `- There's no project note in the Editor to finish reviewing, so will just go to next review.`)
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
 * @param {any} config
 * @param {string?} updatedMachineSummaryLine to write to full-review-list (optional)
*/
export async function updateReviewListAfterChange(note: TNote, simplyDelete: boolean, configIn: any, updatedMachineSummaryLine: string = ''): Promise<void> {
  try {
    const reviewedTitle = note.title ?? ''
    logInfo('updateReviewListAfterChange', `Updating full-review-list for '${reviewedTitle}' -> ${String(simplyDelete)} / '${updatedMachineSummaryLine}'`)

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
    let reviewLines = fmObj.body.split('\n')
    // const firstLineAfterFrontmatter = fmObj.bodyBegin - 1

    // Find right line to update
    let thisLineNum: number = NaN
    let thisTitle = ''
    // for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
    for (let i = 0; i < reviewLines.length; i++) {
      // const line = fileLines[i]
      const line = reviewLines[i]
      // check for title match just using field 3
      const titleField = line.split('\t')[2] ?? ''
      if (titleField === reviewedTitle) {
        thisLineNum = i
        thisTitle = reviewedTitle
        logDebug('updateReviewListAfterChange', `- Found '${reviewedTitle}' to update from '${line}' at line number ${i}`)
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    // Note: this was ?always? failing at one point
    if (!isNaN(thisLineNum)) {
      if (simplyDelete) {
        // delete line 'thisLineNum'
        reviewLines.splice(thisLineNum, 1)
        const outputLines = sortAndFormFullReviewList(reviewLines, configIn)
        DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true) // OK to here
      } else {
        // update this line in the full-review-list
        reviewLines[thisLineNum] = updatedMachineSummaryLine
        // re-form the file
        const outputLines = sortAndFormFullReviewList(reviewLines, configIn)
        DataStore.saveData(outputLines.join('\n'), fullReviewListFilename, true)
        // TODO: OK to here
      }
    } else {
      logWarn('updateReviewListAfterChange', `- Can't find '${reviewedTitle}' to update in full-review-list. Will run makeFullReviewList ...`)
      await makeFullReviewList(false)
      return
    }

    // New: now we can refresh the rendered views as well, but don't open the windows unless they're already open
    await redisplayProjectList()
  }
  catch (error) {
    logError('updateReviewListAfterChange', error.message)
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
    logDebug('getNextNoteToReview', `Started`)

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
    const reviewLines = fmObj.body.split('\n')

    // Now read from the top until we find a line with a negative value in the first column (nextReviewDays)
    for (let i = 0; i < reviewLines.length; i++) {
      const thisLine = reviewLines[i]
      const nextReviewDays = Number(thisLine.split('\t')[0]) ?? NaN // get first field = nextReviewDays
      const nextNoteTitle = thisLine.split('\t')[2] // get third field = title
      if (nextReviewDays < 0) {
        logDebug('getNextNoteToReview', `- Next to review -> '${nextNoteTitle}'`)
        const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
        return nextNotes[0] // return first matching note
      }
    }

    // If we get here then there are no projects needed for review
    logInfo('getNextNoteToReview', `- No notes left due for review 🎉`)
    return
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
    const RE_REVIEWED_MENTION = `${reviewedMentionStr}\\(${RE_DATE}\\)`
    const reviewedTodayString = `${reviewedMentionStr}(${getTodaysDateHyphenated()})`

    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('finishReview', `- We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
      return
    }
    const thisNote = Editor.note

    // To try to work around a problem with updateParagraph() seeming not to flush before the following call, will not try creating the Project equivalent of the note straight away.
    const thisNoteAsProject = new Project(thisNote)

    const metadataLineIndex: number = getOrMakeMetadataLine(thisNote, `<placeholder metadata line> ${reviewedTodayString}`)
    // Re-read paragraphs, as they might have changed
    let metadataPara = thisNote.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(thisNote)}`)
    }
    const origMetadataLineContent: string = metadataPara.content
    logDebug(pluginJson, `finishReview: starting with for '${displayTitle(thisNote)}' with metadataLineIndex ${metadataLineIndex} ('${origMetadataLineContent}')`)

    // get first '@reviewed()' on metadata line
    const firstReviewedMention = thisNote.mentions?.find((m) =>
      m.match(RE_REVIEWED_MENTION),
    ) ?? null
    if (firstReviewedMention != null) {
      logDebug('finishReview', `- Found existing ${reviewedMentionStr}(...) in line ${metadataLineIndex}`)

      // // find line in currently open note containing @reviewed() mention
      // for (const para of Editor.paragraphs) {
      //   if (para.content.match(RE_REVIEWED_MENTION)) {
      //     metadataPara = para
      //   }
      // }

      // replace with today's date
      const older = origMetadataLineContent
      const newer = older.replace(firstReviewedMention, reviewedTodayString)
      metadataPara.content = newer
      logDebug('finishReview', `- Updating metadata para to '${newer} and updating reviewedDate in Project()`)
      thisNoteAsProject.reviewedDate = new Date()
      thisNoteAsProject.calcDurations()
    } else {
      // no existing @reviewed(date), so append to note's default metadata line
      logDebug('finishReview', `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
      metadataPara.content = `${origMetadataLineContent} ${reviewedTodayString}`.trimRight()
    }
    // send update to Editor
    thisNote.updateParagraph(metadataPara)
    logDebug('finishReview', `- After update ${metadataPara.content}.`)

    // update this note in the review list
    const config = await getReviewSettings()
    const updatedMachineSummaryLine = thisNoteAsProject.machineSummaryLine()
    await updateReviewListAfterChange(thisNote, false, config, updatedMachineSummaryLine)
    return thisNote
  }
  catch (error) {
    logError('finishReview', `${error.message}`)
    return null
  }
}

//---------------------------------------------------------------------
// Moved following from projectLists.js to avoid circular dependency
//---------------------------------------------------------------------

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
      // clo(config, 'Review settings updated with args:')
    } else {
      // clo(config, 'Review settings with no args:')
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
 */
export async function redisplayProjectList(): Promise<void> {
  try {
    logDebug('redisplayProjectList', `Started`)
    const config = await getReviewSettings()

    // Call the relevant function with config, but don't open up the display window unless already open
    if (config.outputStyle.match(/rich/i) && NotePlan.environment.buildVersion >= 845) {
      await renderProjectListsHTML(config, false)
    }
    if (config.outputStyle.match(/markdown/i)) {
      await renderProjectListsMarkdown(config, false)
    }
  }
  catch (error) {
    logError('redisplayProjectList', error.message)
  }
}
