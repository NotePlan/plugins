// @flow

//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// by @jgclark
// Last updated 14.6.2022 for v0.6.5, @jgclark
//-----------------------------------------------------------------------------

// Import Helper functions
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
  RE_DATE, // find dates of form YYYY-MM-DD
} from '@helpers/dateTime'
import { log, logWarn, logError } from '@helpers/dev'
import {
  filterFolderList,
  getFolderFromFilename
} from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import {
  findNotesMatchingHashtags,
  getOrMakeNote,
} from '@helpers/note'
import { getOrMakeMetadataLine } from '@helpers/paragraph'
import {
  showMessage,
  showMessageYesNo,
} from '@helpers/userInput'

//-----------------------------------------------------------------------------

// Settings
let filteredFolderList: Array<string> = []
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
 * Generate human-readable lists of project notes for each tag of interest
 * and write out to note(s) in the config.folderToStore folder.
 * @author @jgclark
 */
export async function projectLists(): Promise<void> {
  const config = await getReviewSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)

  log(pluginJson, `projectLists() starting for ${config.noteTypeTags.toString()} tags:`)

  if (config.noteTypeTags.length > 0) {
    // We have defined tag(s) to filter and group by
    for (const tag of config.noteTypeTags) {
      // handle #hashtags in the note title (which get stripped out by NP, it seems)
      const tagWithoutHash = tag.replace('#','')
      const noteTitle = `${tag} List`
      const noteTitleWithoutHash = `${tagWithoutHash} List`

      // Do the main work
      const note: ?TNote = await getOrMakeNote(noteTitleWithoutHash, config.folderToStore)
      if (note != null) {
        // Calculate the Summary list(s)
        const outputArray = await makeNoteTypeSummary(tag)
        outputArray.unshift(`# ${noteTitle}`)

        // Save the list(s) to this note
        log(pluginJson, `writing results to the note with filename '${note.filename}'`)
        note.content = outputArray.join('\n')
        log(pluginJson, `written results to note '${noteTitle}'`)
      } else {
        await showMessage('Oops: failed to find or make project summary note', 'OK')
        logError(pluginJson, "Shouldn't get here -- no valid note to write to!")
        return
      }
    }
  } else {
    // We will just use all notes with a @review() string, in one go     
    const noteTitle = `Review List`
    const note: ?TNote = await getOrMakeNote(noteTitle, config.folderToStore)
    if (note != null) {
      // Calculate the Summary list(s)
      const outputArray = await makeNoteTypeSummary('')
      outputArray.unshift(`# ${noteTitle}`)

      // Save the list(s) to this note
      log(pluginJson, `writing results to the note with filename '${note.filename}'`)
      note.content = outputArray.join('\n')
      log(pluginJson, `written results to note '${noteTitle}'`)
    } else {
      await showMessage('Oops: failed to find or make project summary note', 'OK')
      logError(pluginJson, "Shouldn't get here -- no valid note to write to!")
      return
    }
  }
}

//-------------------------------------------------------------------------------
/**
 * Generate machine-readable list of project-type notes ready for review,
 * ordered by oldest next review date.
 * This is V2, which uses reviewList pref to store the list
 * @author @jgclark
 */
export async function startReviews(): Promise<void> {
  const config = await getReviewSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)
  const summaryArray = []
  
  log(pluginJson, `startReviews() starting for ${config.noteTypeTags.toString()} tags:`)

  CommandBar.showLoading(true, `Generating Project Review list`)
  await CommandBar.onAsyncThread()

  // Iterate over the folders ...
  // ... but ignoring any in the config.foldersToIgnore list
  for (const folder of filteredFolderList) {
    // Either we have defined tag(s) to filter and group by, or just use ''
    const tags = (config.noteTypeTags != null && config.noteTypeTags.length > 0)
      ? config.noteTypeTags
      : []
    for (const tag of tags) {
      // Get notes that include noteTag in this folder, ignoring subfolders
      const notes = findNotesMatchingHashtags(tag, folder, false)
      const projectsReadyToReview = []
      if (notes.length > 0) {
        // Get Project class representation of each note,
        // saving those which are ready for review in projectsReadyToReview array
        for (const n of notes) {
          const np = new Project(n)
          if (np.isReadyForReview && !config.foldersToIgnore.includes(np.folder)) {
            projectsReadyToReview.push(np)
          }
        }
      }
      // For each readyToReview note get the machine-readable summary line for it
      for (const thisProject of projectsReadyToReview) {
        summaryArray.push(thisProject.machineSummaryLine())
        // log(pluginJson, thisProject.machineSummaryLine())
      }
    }
  }

  await CommandBar.onMainThread()
  CommandBar.showLoading(false)

  // dedupe the list, in case it contains duplicates
  let dedupedArray = []  
  summaryArray.forEach((element) => {
    if (!dedupedArray.includes(element)) {
      dedupedArray.push(element);
    }
  })
  
  // sort the list by first field
  // $FlowIgnore[unsafe-addition]
  const outputArray = dedupedArray.slice().sort((first, second) => first.split('\t')[0] - second.split('\t')[0])

  // write summary to reviewList pref
  DataStore.setPreference(reviewListPref, outputArray.join('\n'))
  log(pluginJson, `  There are ${outputArray.length} lines in the reviewListPref`)

  // Now offer first review
  const noteToReview = await getNextNoteToReview()
  // Open that note in editor
  if (noteToReview != null) {
    if (config.confirmNextReview) {
      const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
      if (res === 'OK') {
        log(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      log(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review (from startReviews)`)
      await Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    log(pluginJson, '  🎉 No notes to review!')
    await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
  }
}

//-------------------------------------------------------------------------------
/** 
 * Return summary of notes that contain a particular tag, for all relevant folders
 * @author @jgclark
 * 
 * @param {string} noteTag - hashtag to look for
 * @return {Array<string>} summary lines to write out to a note
 */
async function makeNoteTypeSummary(noteTag: string): Promise<Array<string>> {
  log(pluginJson, `makeNoteTypeSummary(): for '${noteTag}'`)
  const config = await getReviewSettings()
  const filteredFolderList = filterFolderList(config.foldersToIgnore)

  let noteCount = 0
  let overdue = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = config.displayGroupedByFolder ? DataStore.folders : ['/']
  // log(pluginJson, `  Processing ${folderList.length} folders`)

  // Iterate over the folders (ignoring any in the pref_foldersToIgnore list)
  CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`)
  await CommandBar.onAsyncThread()
  for (const folder of filteredFolderList) {
    // Get notes that include noteTag in this folder, ignoring subfolders
    const notes = findNotesMatchingHashtags(noteTag, folder, false)
    if (notes.length > 0) {
      // Create array of Project class representation of each note,
      // ignoring any in a folder we want to ignore (by one of the settings)
      const projects = []
      
      for (const note of notes) {
        const np = new Project(note)
        if (!np.isArchived || config.displayArchivedProjects) {
          projects.push(np)
        } else {
          log(pluginJson, `  Ignoring ${np.title} as archived`)
        }
        if (np.nextReviewDays != null && np.nextReviewDays < 0) {
          overdue += 1
        }
      }
      // sort this array by key set in config.displayOrder
      let sortedProjects = []
      // NB: the Compare function needs to return negative, zero, or positive values. 
      switch (config.displayOrder) {
        case 'due': {
          sortedProjects = projects.sort(
            (first, second) => (first.dueDays ?? 0) - (second.dueDays ?? 0))
          break
        }
        case 'review': {
          sortedProjects = projects.sort(
            (first, second) => (first.nextReviewDays ?? 0) - (second.nextReviewDays ?? 0))
          break
        }
        default: {
          sortedProjects = projects.sort(
            (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
          break
        }
      }
      if (config.displayGroupedByFolder) {
        outputArray.push(`### ${(folder !== '' ? folder : '/')} (${sortedProjects.length} notes)`)
      }
      // iterate over this folder's notes, using Class functions
      for (const p of sortedProjects) {
        outputArray.push(p.detailedSummaryLine(false))
      }
      noteCount += sortedProjects.length
    } else {
      log(pluginJson, `No notes found for '${noteTag}'`)
    }
    CommandBar.showLoading(true, `Summarising ${noteTag} in ${filteredFolderList.length} folders`, (noteCount / filteredFolderList.length))
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)

  // Add summary/ies onto the start (remember: unshift adds to the very front each time)
  if (noteCount > 0) {
    outputArray.unshift(Project.detailedSummaryLineHeader())
  }
  outputArray.unshift(`Total: **${noteCount} active notes**${(overdue > 0) ? `, ${overdue} ready for review` : ''}`)
  outputArray.unshift(`Last updated: ${nowLocaleDateTime}`)
  if (!config.displayGroupedByFolder) {
    outputArray.unshift(`### All folders (${noteCount} notes)`)
  }
  return outputArray
}

//-------------------------------------------------------------------------------
/**
 * Complete current review, then jump to the next one to review
 * @author @jgclark
*/
export async function nextReview(): Promise<void> {
  // log(pluginJson, 'nextReview')
  const config = await getReviewSettings()

  // First update @review(date) on current open note
  const openNote: ?TNote = await finishReview()

  // Read review list to work out what's the next one to review
  const noteToReview: ?TNote = await getNextNoteToReview()

  if (noteToReview != null) {
    if (config.confirmNextReview) {
      // Check whether to open that note in editor
      const res = await showMessageYesNo(`Ready to review '${displayTitle(noteToReview)}'?`, ['OK', 'Cancel'])
      if (res === 'OK') {
        log(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
        await Editor.openNoteByFilename(noteToReview.filename)
      }
    } else {
      log(pluginJson, `Opening '${displayTitle(noteToReview)}' note to review`)
      await Editor.openNoteByFilename(noteToReview.filename)
    }
  } else {
    log(pluginJson, `🎉 No more notes to review!`)
    await showMessage('🎉 No notes to review!', 'Great', 'Reviews')
  }
}

//-------------------------------------------------------------------------------
/**
 * Update the review list after completing a review
 * @author @jgclark
 * @param {TNote} note that has been reviewed
*/
export async function updateReviewListAfterReview(note: TNote): Promise<void> {
  const reviewedTitle = note.title ?? ''
  log(pluginJson, `Removing '${reviewedTitle}' from review list`)

  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    logWarn(pluginJson, `Can't find pref ${reviewListPref}. Please re-run '/start reviews'.`)
    return
  }

  // Now read contents and parse, this time as lines
  const lines = checkString(reviewList).split('\n')
  // log(pluginJson, `\t(pref: has ${lines.length} items, starting ${lines[0]})`)
  let lineNum: number // deliberately undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(reviewedTitle)) {
      // log(pluginJson, `\tFound '${reviewedTitle}' in line '${line}' at line number ${i}`)
      lineNum = i
      break
    }
  }

  if (lineNum !== undefined) {
    lines.splice(lineNum, 1) // delete this one line
    DataStore.setPreference(reviewListPref, lines.join('\n'))
    // log(pluginJson, `\tRemoved line ${lineNum} from reviewList pref as its review is completed`)
  } else {
    logError(pluginJson, `Couldn't find '${reviewedTitle}' to remove from review list`)
    return
  }
}

//-------------------------------------------------------------------------------
/** 
 * Work out the next note to review (if any)
 * @author @jgclark
 * @return { ?TNote } next note to review
 */
async function getNextNoteToReview(): Promise<?TNote> {
  // Get pref that contains the project list
  const reviewList = DataStore.preference(reviewListPref)
  if (reviewList === undefined) {
    await showMessage(`Oops: I now can't find my pref. Try re-running '/start reviews' command.`, 'OK')
    logError(pluginJson, `getNextNoteToReview(): Can't find pref jgclark.Review.reviewList. Try re-running '/start reviews' command.`)
    return
  }
  const reviewListStr = checkString(reviewList)
  // Now read off the first line
  if (reviewListStr.length > 0) {
    const lines = reviewListStr.split('\n')
    const firstLine = lines[0]
    // log(pluginJson, `pref: has ${lines.length} items, starting ${firstLine}`)
    const nextNoteTitle = firstLine.split('\t')[1] // get second field in list
    log(pluginJson, `Next project note to review = '${nextNoteTitle}'`)
    const nextNotes = DataStore.projectNoteByTitle(nextNoteTitle, true, false) ?? []
    return nextNotes[0] // return first matching note
  } else {
    log(pluginJson, `getNextNoteToReview(): Review list was empty. Try re-running '/start reviews' command.`)
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
  const reviewedMentionStr = checkString(DataStore.preference('reviewedMentionStr'))
  const RE_REVIEW_MENTION = `${reviewedMentionStr}\\(${RE_DATE}\\)`
  const reviewedTodayString = `${reviewedMentionStr}(${hyphenatedDateString(new Date())})`

  // only proceed if we're in a valid Project note (with at least 2 lines)
  if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.paragraphs.length < 2) {
    logWarn(pluginJson, `finishReview(): We're not in a valid Project note (and with at least 2 lines). Note title = '${Editor.title ?? ''}'`)
    return
  }

  const metadataLineNum = getOrMakeMetadataLine(Editor.note)
  let metadataPara: ?TParagraph

  // get list of @mentions
  const firstReviewedMention = Editor.note?.mentions.find((m) =>
    m.match(RE_REVIEW_MENTION),
  )
  if (firstReviewedMention != null) {
    // find line in currently open note containing @reviewed() mention
    for (const para of Editor.paragraphs) {
      if (para.content.match(RE_REVIEW_MENTION)) {
        metadataPara = para
        log(pluginJson, `finishReview(): Found existing ${reviewedMentionStr}(date) in line ${para.lineIndex}`)
      }
    }
    
    const metaPara = Editor.paragraphs[metadataLineNum]
    // replace with today's date
    const older = metaPara.content
    const newer = older.replace(firstReviewedMention, reviewedTodayString)
    metaPara.content = newer
    // log(pluginJson, `\tupdating para to '${newer}'`)

    // send update to Editor
    Editor.updateParagraph(metaPara)
  } else {
    // no existing mention, so append to note's default metadata line
    log(pluginJson, `finishReview(): No matching ${reviewedMentionStr}(date) string found. Will append to line ${metadataLineNum}.`)
    metadataPara = Editor.note?.paragraphs[metadataLineNum]
    if (metadataPara == null) {
      return null
    }
    const metaPara = metadataPara
    metaPara.content += ` ${reviewedTodayString}`
    // send update to Editor
    Editor.updateParagraph(metaPara)
  }
  // remove this note from the review list
  // $FlowIgnore[incompatible-call]
  await updateReviewListAfterReview(Editor.note)

  // return current note, to help next function
  return Editor.note
}
