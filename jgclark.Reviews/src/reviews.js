// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 13.9.2022 for v0.8.0-beta3, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
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
  filterFolderList,
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { showHTML } from '@helpers/HTMLView'
import {
  findNotesMatchingHashtag,
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '@helpers/note'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-----------------------------------------------------------------------------

// Settings
const reviewListPref = 'jgclark.Reviews.reviewList'

//-------------------------------------------------------------------------------

/**
 * Log the machine-readable list of notes to review
 * @author @jgclark
 */
export function logReviewList(): void{
  logPreference(reviewListPref)
}

/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
 * @author @jgclark
 */
export async function makeReviewList(): Promise<void> {
  try {
    const config = await getReviewSettings()
    const filteredFolderList = filterFolderList(config.foldersToIgnore)
    const summaryArray = []

    logDebug(pluginJson, `makeReviewList: starting for ${config.noteTypeTags.toString()} tags:`)

    CommandBar.showLoading(true, `Generating Project Review list`)
    await CommandBar.onAsyncThread()

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
      logDebug(pluginJson, `- After findNotesMatchingHashtags, before loop`)
      const projectsReadyToReview = []
      for (const pnarr of projectNotesArrArr) {
        if (pnarr.length > 0) {
          // Get Project class representation of each note,
          // saving those which are ready for review in projectsReadyToReview array
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
          // logDebug(pluginJson, `-> ${thisProject.machineSummaryLine()}`)
        }
      }
    }
    logDebug(pluginJson, `- ${Number(config.noteTypeTags.length * filteredFolderList.length)} folder/tag combinations reviewed in ${timer(startTime)}s`)
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

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
    logInfo(pluginJson, `-> Now ${outputArray.length} lines in the reviewListPref`)
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
    await makeReviewList()

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
    // eslint-disable-next-line no-unused-vars, unused-imports/no-unused-vars
    const openNote: ?TNote = await finishReview()

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
 * Update the review list after completing a review
 * @author @jgclark
 * @param {TNote} note that has been reviewed
*/
export async function updateReviewListAfterReview(note: TNote): Promise<void> {
  try {
    const reviewedTitle = note.title ?? ''
    logDebug(pluginJson, `updateReviewListAfterReview: Removing '${reviewedTitle}' from review list`)

    // Get pref that contains the project list
    let reviewList = DataStore.preference(reviewListPref)
    if (reviewList === undefined) {
      logDebug(pluginJson, `Can't find pref ${reviewListPref}. Will run makeReviewList() ...`)
      await makeReviewList()
      return
    }

    // Now read contents and parse, this time as lines
    const lines = checkString(reviewList).split('\n')
    logDebug(pluginJson, `- (pref: has ${lines.length} items, starting ${lines[0]})`)
    let lineNum: number // deliberately undefined
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.match(reviewedTitle)) {
        logDebug(pluginJson, `- Found '${reviewedTitle}' in line '${line}' at line number ${i}`)
        lineNum = i
        break
      }
    }

    if (lineNum !== undefined) {
      lines.splice(lineNum, 1) // delete this one line
      DataStore.setPreference(reviewListPref, lines.join('\n'))
      logDebug(pluginJson, `- Removed line ${lineNum} from reviewList pref as its review is completed`)
    } else {
      logDebug(pluginJson, `- Couldn't find '${reviewedTitle}' to remove from review list. Will run makeReviewList ...`)
      await makeReviewList()
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
    // Get pref that contains the project list
    let reviewList = DataStore.preference(reviewListPref)
    if (reviewList === undefined) {
      logWarn(pluginJson, `getNextNoteToReview: Couldn't find pref ${reviewListPref}. Please run makeReviewList() ...`)
      await makeReviewList()
      reviewList = DataStore.preference(reviewListPref)
      return
    }
    const reviewListStr = checkString(reviewList)
    // Now read off the first line
    if (reviewListStr.length > 0) {
      const lines = reviewListStr.split('\n')
      const firstLine = lines[0]
      // logDebug(pluginJson, `pref: has ${lines.length} items, starting ${firstLine}`)
      const nextNoteTitle = firstLine.split('\t')[1] // get second field in list
      logDebug(pluginJson, `getNextNoteToReview: -> '${nextNoteTitle}'`)
      const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
      return nextNotes[0] // return first matching note
    } else {
      logInfo(pluginJson, `getNextNoteToReview: Review list was empty.`)
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
          logDebug(pluginJson, `- Found existing ${reviewedMentionStr}(date) in line ${para.lineIndex}`)
        }
      }

      // replace with today's date
      const older = metadataPara.content

      const newer = older.replace(firstReviewedMention, reviewedTodayString)
      metadataPara.content = newer
      // logDebug(pluginJson, `- updating para to '${newer}'`)

      // send update to Editor
      Editor.updateParagraph(metadataPara)
    } else {
      // no existing @mention, so append to note's default metadata line
      logDebug(pluginJson, `- No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineIndex}.`)
      metadataPara.content = `${metadataPara.content} ${reviewedTodayString}`.trim()
      // send update to Editor
      Editor.updateParagraph(metadataPara)
      logDebug(pluginJson, `- after update ${metadataPara.content}.`)
    }
    // remove this note from the review list
    if (note != null) {
      await updateReviewListAfterReview(note)
      // return current note, to help next function
      return note
    }
  }
  catch (error) {
    logError(pluginJson, `finishReview: ${error.message}`)
    return null
  }
}
