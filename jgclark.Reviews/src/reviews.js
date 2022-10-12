// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 5.10.2022 for v0.8.0-beta, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import moment from 'moment/min/moment-with-locales'
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
import { logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
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

//-----------------------------------------------------------------------------

// Settings
const reviewListPref = 'jgclark.Reviews.reviewList'
const fullReviewListFilename = 'full-review-list.md'

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
 * ordered by ??? oldest next review date.
 * This is V3, which uses ??? to store the list
 * @author @jgclark
 */
export async function makeFullReviewList(runInForeground: boolean = false): Promise<void> {
  try {
    const config = await getReviewSettings()
    logDebug('makeFullReviewList', `starting for ${config.noteTypeTags.toString()} tags:`)

    // Get list of folders, excluding @specials and our foldersToIgnore setting
    const filteredFolderList = getFilteredFolderList(config.foldersToIgnore, true)
    const summaryArray = []

    if (runInForeground) {
      CommandBar.showLoading(true, `Generating full Project Review list`)
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
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note.
          // Save those which are ready for review in projectsReadyToReview array
          for (const n of pnarr) {
            const np = new Project(n)
            // if (!config.foldersToIgnore.includes(np.folder)) {
            summaryArray.push(np.machineSummaryLine())
            // }
          }
        }
      }
    }
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
    // const outputArray = dedupedArray.slice().sort((first, second) => Number(first.split('\t')[0]) - Number(second.split('\t')[0]))
    const outputArray = dedupedArray.slice()

    // Write some metadata to top of file
    outputArray.unshift("---")
    outputArray.unshift(`date: ${moment().format()}`)
    outputArray.unshift("title: full-review-list")
    outputArray.unshift("---")

    // write summary to reviewList pref
    DataStore.saveData(outputArray.join('\n'), fullReviewListFilename, true)
    logDebug(`makeFullReviewList`, `written ${outputArray.length} lines to ${fullReviewListFilename}`)
    // logFullReviewList()
  }
  catch (error) {
    logError(pluginJson, `makeFullReviewList: ${error.message}`)
  }
}

/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
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
    // TODO: change this
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
        if (res === 'OK') {
          logDebug(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
          await Editor.openNoteByFilename(noteToReview.filename)
        }
      } else {
        logDebug(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      logInfo(pluginJson, '  🎉 No notes to review!')
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError(pluginJson, `startReviews: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then jump to the next one to review
 * @author @jgclark
*/
export async function nextReview(): Promise<void> {
  try {
    logDebug(pluginJson, 'nextReview: starting')
    const config = await getReviewSettings()

    // First update @review(date) on current open note
    const openNote: ?TNote = await finishReview()
    // update this note in the review list
    if (openNote != null) {
      await updateReviewListAfterReview(openNote)
    }

    // Read review list to work out what's the next one to review
    const noteToReview: ?TNote = await getNextNoteToReview()

    if (noteToReview != null) {
      if (config.confirmNextReview) {
        // Check whether to open that note in editor
        const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
        if (res === 'OK') {
          logInfo(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
          await Editor.openNoteByFilename(noteToReview.filename)
        }
      } else {
        logInfo(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      logInfo(pluginJson, `🎉 No more notes to review!`)
      await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
    }
  }
  catch (error) {
    logError(pluginJson, `nextReview: ${error.message}`)
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the full-review-list after completing a review or completing/cancelling a whole project.
 * TODO: update me
 * Note: Called by functions nextReview, completeProject, cancelProject
 * @author @jgclark
 * @param {TNote} note that has been reviewed
 * @param {boolean} simplyDelete the project line? (optional: default to false)
*/
export async function updateReviewListAfterReview(note: TNote, simplyDelete: boolean = false): Promise<void> {
  try {
    const reviewedTitle = note.title ?? ''
    logDebug('updateReviewListAfterReview', `Wanting to update '${reviewedTitle}' in full-review-list ...`)

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
    const firstLineAfterFrontmatter = 4 // TODO: use proper func findStartOfActivePartOfNote(), though this will need updating to take content, rather than TNote

    // Find right line to update
    let thisLine: number // deliberately undefined
    let thisTitle = ''
    for (let i = firstLineAfterFrontmatter; i < fileLines.length; i++) {
      const line = fileLines[i]
      // check for title match just using field 2
      const titleField = line.split('\t')[1]
      if (titleField.match(reviewedTitle)) {
        logDebug('updateReviewListAfterReview', `- Found '${reviewedTitle}' to update from '${line}' at line number ${i}`)
        thisLine = i
        thisTitle = reviewedTitle
        break
      }
    }

    // update (or delete) the note's summary in the full-review-list
    if (note != null && thisLine !== undefined) {
      const thisNote = note
      if (simplyDelete) {
        // delete line 'thisLine'
        fileLines.splice(thisLine, 1)
        DataStore.saveData(fileLines.join('\n'), fullReviewListFilename, true)
      } else {
        if (thisNote) {
          // Make a Project instance for this note
          const thisProject = new Project(thisNote)
          // Then get its machineSummaryLine()
          // FIXME: why does the following not include completedDate or the updated reviewed date?
          const newVersion = thisProject.machineSummaryLine()
          logDebug('updateReviewListAfterReview', `mSL -> '${newVersion}'`)
          // And update that line in the full-review-list
          fileLines[thisLine] = newVersion
          DataStore.saveData(fileLines.join('\n'), fullReviewListFilename, true)
        } else {
          throw new Error(`Couldn't load project note '${thisTitle}'`)
        }
      }
    } else {
      logDebug('updateReviewListAfterReview', `- Couldn't find '${reviewedTitle}' to update in full-review-list. Will run makeFullReviewList ...`)
      await makeFullReviewList(false)
      return
    }
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
    const firstLineAfterFrontmatter = 4 // TODO: use proper func
    const reviewLines = fileLines.slice(firstLineAfterFrontmatter)
    const reviewLinesFirstCols = reviewLines.map((m) => m.split('\t').slice(0, 2).join('\t'))
    // logDebug('getNextNoteToReview', `reviewLinesFirstCols: ${String(reviewLinesFirstCols)}`)
    const sortedReviewLines = reviewLinesFirstCols.slice().sort((first, second) => Number(first.split('\t')[0]) - Number(second.split('\t')[0]))
    // logDebug('getNextNoteToReview', `sortedReviewLines: ${String(sortedReviewLines)}`)

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
 * Update the @reviewed(date) in the note in the Editor to today's date.
 * @author @jgclark
 * @return { ?TNote } current note
 */
export async function finishReview(): Promise<?TNote> {
  try {
    const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
    const RE_REVIEW_MENTION = `${reviewedMentionStr}\\(${RE_DATE}\\)`
    const reviewedTodayString = `${reviewedMentionStr}(${hyphenatedDateString(new Date())})`

    let { note, paragraphs } = Editor
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (note == null || note.type === 'Calendar' || paragraphs.length < 2) {
      logWarn(pluginJson, `finishReview: We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLine(note, `<placeholder metadata line> ${reviewedTodayString}`)
    // Re-read paragraphs, as they might have changed
    paragraphs = note.paragraphs
    let metadataPara = paragraphs[metadataLineIndex]
    const metadataLineContent: string = metadataPara.content ?? '<error>'
    logDebug(pluginJson, `finishReview starting with metadataLineIndex ${metadataLineIndex} ('${metadataLineContent}')`)

    // get list of @mentions -- more generous approach than just using metadata line
    const firstReviewedMention = Editor.note?.mentions?.find((m) =>
      m.match(RE_REVIEW_MENTION),
    ) ?? null
    if (firstReviewedMention != null) {
      // find line in currently open note containing @reviewed() mention
      for (const para of Editor.paragraphs) {
        if (para.content.match(RE_REVIEW_MENTION)) {
          metadataPara = para
          logDebug(pluginJson, `- Found existing ${reviewedMentionStr}(...) in line ${para.lineIndex}`)
        }
      }

      // replace with today's date
      const older = metadataPara.content
      const newer = older.replace(firstReviewedMention, reviewedTodayString)
      metadataPara.content = newer
      logDebug(pluginJson, `- updating metadata para to '${newer}'`)

      // send update to Editor
      Editor.updateParagraph(metadataPara)
    } else {
      // no existing @reviewed(date), so append to note's default metadata line
      logDebug(pluginJson, `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
      metadataPara.content = `${metadataPara.content} ${reviewedTodayString}`.trim()
      // send update to Editor
      Editor.updateParagraph(metadataPara)
      logDebug(pluginJson, `- after update ${metadataPara.content}.`)
    }
    // update this note in the review list
    // if (note != null) {
    //   await updateReviewListAfterReview(note)
    //   // return current note, to help next function
    //   return note
    // }
    return note // for completeness
  }
  catch (error) {
    logError(pluginJson, `finishReview: ${error.message}`)
    return null
  }
}
